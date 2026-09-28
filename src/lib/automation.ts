import "server-only";
import crypto from "node:crypto";
import { db, loadDb, saveDb } from "./db";
import { resolveContract, roundToTick } from "./contracts";
import { rootSymbol } from "./instruments";
import * as tv from "./tradovate";
import type { TradovateEnv } from "./tradovate";

// ---------------- settings ----------------

export interface AutomationSettings {
  enabled: boolean; // master switch / kill switch — off by default
  mode: TradovateEnv; // "demo" by default; "live" only via the guarded switch
  accountDemo: string; // Tradovate account name (spec); blank = the only account
  accountLive: string;
  allowedSymbols: string[];
  maxQty: number; // per order and per target position
  maxOrdersPerDay: number;
  contractOverrides: Record<string, string>; // root → contract, e.g. { NQ: "NQZ6" }
}

export const DEFAULT_AUTOMATION: AutomationSettings = {
  enabled: false,
  mode: "demo",
  accountDemo: "",
  accountLive: "",
  allowedSymbols: ["NQ", "MNQ", "ES", "MES"],
  maxQty: 2,
  maxOrdersPerDay: 10,
  contractOverrides: {},
};

export function getAutomationSettings(): AutomationSettings {
  const row = db().prepare("SELECT value FROM settings WHERE key = 'automation'").get() as { value: string } | undefined;
  const saved = row ? (JSON.parse(row.value) as Partial<AutomationSettings>) : {};
  return { ...DEFAULT_AUTOMATION, ...saved };
}

export function saveAutomationSettings(s: AutomationSettings) {
  db()
    .prepare("INSERT INTO settings (key, value) VALUES ('automation', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(JSON.stringify(s));
}

// ---------------- signals ----------------

export interface SignalRow {
  id: number;
  received_at: string;
  source: string;
  mode: string;
  symbol: string | null;
  action: string | null;
  quantity: number | null;
  contract: string | null;
  status: "ignored" | "rejected" | "submitted" | "error";
  reason: string | null;
  order_ids: string | null;
  payload: string | null;
}

export function listSignals(limit = 50): SignalRow[] {
  return db().prepare("SELECT * FROM signals ORDER BY id DESC LIMIT ?").all(limit) as SignalRow[];
}

type Intent =
  | { kind: "order"; side: "Buy" | "Sell"; qty: number }
  | { kind: "flatten" }
  | { kind: "target"; target: number }; // signed desired net position

export interface Alert {
  secret?: string;
  ticker: string;
  intent: Intent;
  price?: number;
  stop?: number;
  target?: number;
  stopPoints?: number;
  targetPoints?: number;
}

const numOrUndef = (v: unknown) => {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Parse a TradingView alert body (JSON). Two styles are accepted:
 *  - position sync (recommended for strategies): market_position + market_position_size
 *    → the broker position is moved to match the strategy's position.
 *  - order: action (buy/sell/long/short/exit/flat/close) + contracts/qty.
 */
export function parseAlert(body: string): Alert {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(body);
  } catch {
    throw new Error("Alert message must be JSON.");
  }
  if (!raw || typeof raw !== "object") throw new Error("Alert message must be a JSON object.");
  const ticker = String(raw.ticker ?? raw.symbol ?? "").trim();
  if (!ticker) throw new Error('Missing "ticker".');

  const common = {
    secret: raw.secret === undefined ? undefined : String(raw.secret),
    ticker,
    price: numOrUndef(raw.price),
    stop: numOrUndef(raw.sl ?? raw.stop_loss),
    target: numOrUndef(raw.tp ?? raw.take_profit),
    stopPoints: numOrUndef(raw.sl_points),
    targetPoints: numOrUndef(raw.tp_points),
  };

  const mp = String(raw.market_position ?? "").toLowerCase();
  if (mp === "long" || mp === "short" || mp === "flat") {
    const size = Math.abs(numOrUndef(raw.market_position_size) ?? (mp === "flat" ? 0 : NaN));
    if (!Number.isFinite(size)) throw new Error('Missing "market_position_size".');
    return { ...common, intent: { kind: "target", target: mp === "flat" ? 0 : mp === "long" ? size : -size } };
  }

  const action = String(raw.action ?? "").toLowerCase();
  if (["exit", "close", "flat", "flatten", "closeall"].includes(action)) return { ...common, intent: { kind: "flatten" } };
  const side = action === "buy" || action === "long" ? "Buy" : action === "sell" || action === "short" ? "Sell" : null;
  if (!side) throw new Error(`Unknown action "${raw.action ?? ""}" (use buy, sell or exit).`);
  const qty = numOrUndef(raw.contracts ?? raw.qty ?? raw.quantity) ?? 1;
  if (!(qty > 0) || !Number.isInteger(qty)) throw new Error(`Invalid quantity "${raw.contracts ?? raw.qty}".`);
  return { ...common, intent: { kind: "order", side, qty } };
}

export function secretMatches(given: string | undefined): boolean {
  const expected = process.env.TV_WEBHOOK_SECRET ?? "";
  if (!expected || !given) return false;
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function describe(intent: Intent): { action: string; quantity: number | null } {
  if (intent.kind === "order") return { action: intent.side.toLowerCase(), quantity: intent.qty };
  if (intent.kind === "flatten") return { action: "flatten", quantity: null };
  return { action: "target", quantity: intent.target };
}

/** "Today" for the order limit is the New York trading date. */
function nyDate(d: Date) {
  return d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function ordersToday(): number {
  const rows = db()
    .prepare("SELECT received_at FROM signals WHERE status = 'submitted' AND received_at >= datetime('now', '-2 days')")
    .all() as { received_at: string }[];
  const today = nyDate(new Date());
  return rows.filter((r) => nyDate(new Date(r.received_at.replace(" ", "T") + "Z")) === today).length;
}

function isDuplicate(fingerprint: string): boolean {
  return !!db()
    .prepare("SELECT 1 FROM signals WHERE fingerprint = ? AND received_at >= datetime('now', '-15 seconds') AND status != 'ignored'")
    .get(fingerprint);
}

function bracketPrices(alert: Alert, root: string, side: "Buy" | "Sell"): { stopPrice?: number; targetPrice?: number } {
  const dir = side === "Buy" ? 1 : -1;
  let stop = alert.stop;
  let target = alert.target;
  if (stop === undefined && alert.stopPoints && alert.price) stop = alert.price - dir * alert.stopPoints;
  if (target === undefined && alert.targetPoints && alert.price) target = alert.price + dir * alert.targetPoints;
  const ref = alert.price;
  if (ref !== undefined) {
    if (stop !== undefined && (stop - ref) * dir >= 0) throw new Error(`Stop ${stop} is on the wrong side of price ${ref} for a ${side}.`);
    if (target !== undefined && (target - ref) * dir <= 0) throw new Error(`Target ${target} is on the wrong side of price ${ref} for a ${side}.`);
  }
  return {
    stopPrice: stop === undefined ? undefined : roundToTick(root, stop),
    targetPrice: target === undefined ? undefined : roundToTick(root, target),
  };
}

export interface SignalOutcome {
  status: SignalRow["status"];
  reason: string;
  contract?: string;
  orderIds?: number[];
}

/** Run one alert through the risk checks and, if everything passes, send it to Tradovate. */
export async function processAlert(alert: Alert, source: "tradingview" | "test", payload: string): Promise<SignalOutcome> {
  await loadDb();
  const s = getAutomationSettings();
  const { action, quantity } = describe(alert.intent);
  const fingerprint = crypto.createHash("sha256").update(payload).digest("hex");
  const base = { source, mode: s.mode, action, quantity, payload, fingerprint };

  let outcome: SignalOutcome;
  const root = rootSymbol(alert.ticker);
  const ids: number[] = []; // orders already sent, kept even if a later step fails
  const ctx = { root, contract: undefined as string | undefined };
  try {
    outcome = await execute(alert, s, ctx, fingerprint, ids);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    outcome = {
      status: e instanceof tv.TradovateError || ids.length ? "error" : "rejected",
      reason: ids.length ? `Partially executed (orders ${ids.join(", ")} were sent) — check your Tradovate account. ${msg}` : msg,
      contract: ctx.contract,
      orderIds: ids.length ? ids : undefined,
    };
  }
  await recordSignal({ ...base, symbol: root, ...outcome });
  return outcome;
}

async function execute(
  alert: Alert,
  s: AutomationSettings,
  ctx: { root: string; contract?: string },
  fingerprint: string,
  ids: number[],
): Promise<SignalOutcome> {
  const { root } = ctx;
  const ignored = (reason: string): SignalOutcome => ({ status: "ignored", reason, contract: ctx.contract });
  const rejected = (reason: string): SignalOutcome => ({ status: "rejected", reason, contract: ctx.contract });

  // ---- risk checks (nothing is sent to the broker unless all pass) ----
  if (!s.enabled) return ignored("Auto-trading is off.");
  if (s.mode === "live" && !tv.liveAllowed()) return rejected("Live mode is not permitted on this server (TRADOVATE_ALLOW_LIVE is not true).");
  if (!tv.hasCredentials()) return rejected("Tradovate credentials are not configured.");
  if (!s.allowedSymbols.includes(root)) return rejected(`${root} is not in the allowed symbols (${s.allowedSymbols.join(", ")}).`);
  const size = alert.intent.kind === "order" ? alert.intent.qty : alert.intent.kind === "target" ? Math.abs(alert.intent.target) : 0;
  if (size > s.maxQty) return rejected(`${size} contracts exceeds the max of ${s.maxQty}.`);
  if (ordersToday() >= s.maxOrdersPerDay) return rejected(`Daily limit of ${s.maxOrdersPerDay} orders reached.`);
  if (isDuplicate(fingerprint)) return ignored("Duplicate of a signal received in the last 15 seconds.");
  const contract = (ctx.contract = resolveContract(alert.ticker, s.contractOverrides).contract);

  // ---- broker ----
  const env = s.mode;
  const account = await tv.findAccount(env, env === "live" ? s.accountLive : s.accountDemo);
  const c = await tv.findContract(env, contract);
  const intent = alert.intent;
  const done = (reason: string): SignalOutcome => ({ status: "submitted", reason: `${reason} on ${account.name} (${env})`, contract, orderIds: ids });

  if (intent.kind === "flatten") {
    const pos = await tv.netPosition(env, account.id, c.id);
    if (pos === 0) return ignored("Already flat.");
    ids.push(...(await tv.liquidate(env, account.id, c.id)));
    return done(`Flattened ${pos > 0 ? "long" : "short"} ${Math.abs(pos)}`);
  }

  if (intent.kind === "order") {
    const brackets = bracketPrices(alert, root, intent.side);
    ids.push(...(await tv.placeMarketOrder(env, { account, contract, side: intent.side, qty: intent.qty, ...brackets })));
    return done(`${intent.side} ${intent.qty} ${contract} market${bracketNote(brackets)}`);
  }

  // Position sync.
  const pos = await tv.netPosition(env, account.id, c.id);
  const target = intent.target;
  if (pos === target) return ignored(`Position already ${target}.`);
  if (target === 0) {
    ids.push(...(await tv.liquidate(env, account.id, c.id)));
    return done(`Flattened ${Math.abs(pos)}`);
  }
  const notes: string[] = [];
  let from = pos;
  if (pos !== 0 && Math.sign(pos) !== Math.sign(target)) {
    ids.push(...(await tv.liquidate(env, account.id, c.id))); // reversal: close (and cancel brackets) first
    notes.push(`flattened ${Math.abs(pos)}`);
    from = 0;
  }
  const diff = target - from;
  const side = diff > 0 ? "Buy" : "Sell";
  const brackets = from === 0 ? bracketPrices(alert, root, side) : {}; // brackets only when opening from flat
  ids.push(...(await tv.placeMarketOrder(env, { account, contract, side, qty: Math.abs(diff), ...brackets })));
  notes.push(`${side} ${Math.abs(diff)} ${contract}${bracketNote(brackets)}`);
  return done(`Position ${pos} → ${target}: ${notes.join(", then ")}`);
}

function bracketNote(b: { stopPrice?: number; targetPrice?: number }) {
  const parts = [b.stopPrice !== undefined && `stop ${b.stopPrice}`, b.targetPrice !== undefined && `target ${b.targetPrice}`].filter(Boolean);
  return parts.length ? ` with ${parts.join(" / ")}` : "";
}

/** Append to the signal log, retrying if another device saved the database at the same moment. */
async function recordSignal(r: {
  source: string;
  mode: string;
  symbol: string | null;
  action: string;
  quantity: number | null;
  contract?: string;
  status: string;
  reason: string;
  orderIds?: number[];
  payload: string;
  fingerprint: string;
}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await loadDb();
      db()
        .prepare(
          `INSERT INTO signals (source, mode, symbol, action, quantity, contract, status, reason, order_ids, payload, fingerprint)
           VALUES (@source, @mode, @symbol, @action, @quantity, @contract, @status, @reason, @order_ids, @payload, @fingerprint)`,
        )
        .run({
          source: r.source,
          mode: r.mode,
          symbol: r.symbol,
          action: r.action,
          quantity: r.quantity,
          contract: r.contract ?? null,
          status: r.status,
          reason: r.reason,
          order_ids: r.orderIds?.length ? r.orderIds.join(",") : null,
          payload: redact(r.payload),
          fingerprint: r.fingerprint,
        });
      await saveDb();
      return;
    } catch (e) {
      if (attempt === 2) console.error("Could not record signal", e);
    }
  }
}

/** Never store the webhook secret in the log. */
function redact(payload: string): string {
  try {
    const o = JSON.parse(payload);
    if (o && typeof o === "object" && "secret" in o) o.secret = "•••";
    return JSON.stringify(o);
  } catch {
    return payload.slice(0, 2000);
  }
}
