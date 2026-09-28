// Parser for TradingView Paper Trading CSV exports. Pure — runs on client (preview) and server (import).
//
// Two exports are supported:
//  1. Order history ("History" tab → Export): one row per order with Symbol, Side, Qty, Fill Price,
//     Status, Commission, Placing/Closing Time. Filled orders are replayed per symbol and grouped
//     into round-trip trades (flat → position → flat), so entry AND exit times are captured.
//  2. Account/balance history ("Account History" tab → Export): rows with Time, Realized P&L and an
//     Action like "Close long position for symbol CME_MINI:NQ1! at price 21500.25 for 1 units.
//     Position AVG Price was 21480.00 ...". Only the close time is known for these.
import Papa from "papaparse";
import { pointValue, rootSymbol, round2 } from "./instruments";
import type { Direction } from "./types";

export interface ParsedTrade {
  symbol: string;
  raw_symbol: string;
  direction: Direction;
  entry_price: number;
  exit_price: number;
  quantity: number;
  entry_time: string;
  exit_time: string;
  fees: number;
  pnl: number;
  external_id: string;
}

export interface ParseResult {
  format: "orders" | "balance" | "unknown";
  trades: ParsedTrade[];
  warnings: string[];
}

type Row = Record<string, string>;

export function parseTradingViewCsv(text: string): ParseResult {
  const parsed = Papa.parse<Row>(text.replace(/^﻿/, "").trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const headers = (parsed.meta.fields ?? []).map((h) => h.toLowerCase());
  const rows = parsed.data;

  if (headers.includes("action") && headers.some((h) => h.startsWith("realized p&l"))) {
    return parseBalanceHistory(rows);
  }
  if (headers.includes("side") && headers.includes("symbol") && findCol(headers, PRICE_COLS)) {
    return parseOrders(rows, headers);
  }
  return {
    format: "unknown",
    trades: [],
    warnings: [
      `Unrecognized CSV columns: ${(parsed.meta.fields ?? []).join(", ") || "(none)"}. ` +
        "Export the History (orders) or Account History tab from TradingView's Paper Trading panel.",
    ],
  };
}

// ---------- helpers ----------

const PRICE_COLS = ["avg fill price", "fill price", "avg price", "price"];
const QTY_COLS = ["filled qty", "qty", "quantity", "filled quantity"];
const TIME_COLS = ["closing time", "fill time", "filled time", "time", "placing time"];

function findCol(headers: string[], candidates: string[]): string | undefined {
  return candidates.find((c) => headers.includes(c));
}

function get(row: Row, lowerKey: string | undefined): string {
  if (!lowerKey) return "";
  for (const k of Object.keys(row)) if (k.toLowerCase() === lowerKey) return (row[k] ?? "").trim();
  return "";
}

export function num(s: string | undefined | null): number | null {
  if (s === undefined || s === null) return null;
  const cleaned = String(s).replace(/[$,\s]/g, "").replace(/^\((.*)\)$/, "-$1");
  if (cleaned === "" || cleaned === "-") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Normalize a timestamp to a local, timezone-naive "YYYY-MM-DDTHH:MM:SS". */
export function normalizeTime(s: string): string | null {
  const v = s.trim();
  if (!v) return null;
  // Already local: 2025-01-15 14:30:05 / 2025-01-15T14:30
  const m = v.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(:\d{2})?(\.\d+)?$/);
  if (m) return `${m[1]}T${m[2]}${m[3] ?? ":00"}`;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function externalId(t: Omit<ParsedTrade, "external_id">, extra = ""): string {
  return ["tv", t.raw_symbol, t.direction, t.entry_time, t.exit_time, t.entry_price, t.exit_price, t.quantity, extra].join("|");
}

// ---------- format 1: order history ----------

interface Fill {
  rawSymbol: string;
  side: 1 | -1;
  qty: number;
  price: number;
  fee: number;
  time: string;
  orderId: string;
}

function parseOrders(rows: Row[], headers: string[]): ParseResult {
  const warnings: string[] = [];
  const priceCol = findCol(headers, PRICE_COLS);
  const qtyCol = findCol(headers, QTY_COLS);
  const timeCol = findCol(headers, TIME_COLS);
  const hasStatus = headers.includes("status");
  const feeCol = findCol(headers, ["commission", "fee", "fees"]);

  let fills: Fill[] = [];
  let skipped = 0;
  for (const r of rows) {
    if (hasStatus && !/^fill/i.test(get(r, "status"))) {
      skipped++;
      continue;
    }
    const sideStr = get(r, "side").toLowerCase();
    const side = sideStr.startsWith("b") || sideStr === "long" ? 1 : sideStr.startsWith("s") ? -1 : 0;
    const qty = num(get(r, qtyCol));
    const price = num(get(r, priceCol));
    const time = normalizeTime(get(r, timeCol) || get(r, "placing time"));
    if (!side || !qty || price === null || !time) {
      skipped++;
      continue;
    }
    fills.push({
      rawSymbol: get(r, "symbol"),
      side: side as 1 | -1,
      qty: Math.abs(qty),
      price,
      fee: Math.abs(num(get(r, feeCol)) ?? 0),
      time,
      orderId: get(r, "order id") || get(r, "id"),
    });
  }
  if (skipped) warnings.push(`Skipped ${skipped} row(s) that were not filled orders (cancelled, rejected, or incomplete).`);

  // TradingView lists newest first; replay in chronological order, keeping same-second fills in file order.
  if (fills.length > 1 && fills[0].time > fills[fills.length - 1].time) fills = fills.reverse();
  fills = fills.map((f, i) => ({ f, i })).sort((a, b) => a.f.time.localeCompare(b.f.time) || a.i - b.i).map((x) => x.f);

  const trades: ParsedTrade[] = [];
  const bySymbol = new Map<string, Fill[]>();
  for (const f of fills) (bySymbol.get(f.rawSymbol) ?? bySymbol.set(f.rawSymbol, []).get(f.rawSymbol)!).push(f);

  let openCount = 0;
  for (const [rawSymbol, list] of bySymbol) {
    const pv = pointValue(rawSymbol);
    let pos = 0; // signed contracts
    let avg = 0; // average cost of open position
    let cur: {
      dir: 1 | -1;
      entryQty: number;
      entryNotional: number;
      exitQty: number;
      exitNotional: number;
      realized: number;
      fees: number;
      entryTime: string;
      firstOrder: string;
    } | null = null;

    const apply = (f: Fill, qty: number, fee: number) => {
      if (pos === 0 || Math.sign(pos) === f.side) {
        if (pos === 0 || !cur) {
          cur = { dir: f.side, entryQty: 0, entryNotional: 0, exitQty: 0, exitNotional: 0, realized: 0, fees: 0, entryTime: f.time, firstOrder: f.orderId };
          avg = 0;
        }
        avg = (avg * Math.abs(pos) + f.price * qty) / (Math.abs(pos) + qty);
        pos += f.side * qty;
        cur.entryQty += qty;
        cur.entryNotional += f.price * qty;
        cur.fees += fee;
        return;
      }
      const closeQty = Math.min(qty, Math.abs(pos));
      const c = cur!;
      c.realized += (f.price - avg) * closeQty * c.dir * pv;
      c.exitQty += closeQty;
      c.exitNotional += f.price * closeQty;
      c.fees += (fee * closeQty) / qty;
      pos += f.side * closeQty;
      if (pos === 0) {
        const base = {
          symbol: rootSymbol(rawSymbol),
          raw_symbol: rawSymbol,
          direction: (c.dir === 1 ? "long" : "short") as Direction,
          entry_price: round6(c.entryNotional / c.entryQty),
          exit_price: round6(c.exitNotional / c.exitQty),
          quantity: c.entryQty,
          entry_time: c.entryTime,
          exit_time: f.time,
          fees: round2(c.fees),
          pnl: round2(c.realized - c.fees),
        };
        trades.push({ ...base, external_id: externalId(base, c.firstOrder) });
        cur = null;
      }
      const rest = qty - closeQty;
      if (rest > 0) apply(f, rest, (fee * rest) / qty); // position flipped
    };

    for (const f of list) apply(f, f.qty, f.fee);
    if (pos !== 0) openCount++;
  }
  if (openCount) warnings.push(`${openCount} position(s) still open at the end of the file were not imported.`);

  trades.sort((a, b) => a.entry_time.localeCompare(b.entry_time));
  return { format: "orders", trades, warnings };
}

// ---------- format 2: balance / account history ----------

const CLOSE_RE =
  /close\s+(long|short)\s+position\s+for\s+symbol\s+(\S+)\s+at\s+price\s+([\d.,]+)\s+for\s+([\d.,]+)\s+units?\.?\s*position\s+avg\s+price\s+was\s+([\d.,]+)/i;

function parseBalanceHistory(rows: Row[]): ParseResult {
  const warnings: string[] = [];
  const trades: ParsedTrade[] = [];
  let commissionTotal = 0;
  const pnlKey = Object.keys(rows[0] ?? {}).find((k) => /^realized p&l \(value\)$/i.test(k)) ??
    Object.keys(rows[0] ?? {}).find((k) => /^realized p&l/i.test(k) && !/currency/i.test(k));

  rows.forEach((r, i) => {
    const action = get(r, "action");
    const m = action.match(CLOSE_RE);
    if (!m) {
      if (/commission/i.test(action)) commissionTotal += Math.abs(num(get(r, "realized p&l (value)")) ?? 0);
      return;
    }
    const [, dir, rawSymbol, exitStr, qtyStr, avgStr] = m;
    const time = normalizeTime(get(r, "time"));
    const exit = num(exitStr)!;
    const entry = num(avgStr)!;
    const qty = num(qtyStr)!;
    if (!time) return;
    const direction = dir.toLowerCase() as Direction;
    const sign = direction === "long" ? 1 : -1;
    const pnl = num(pnlKey ? r[pnlKey] : "") ?? (exit - entry) * sign * qty * pointValue(rawSymbol);
    const base = {
      symbol: rootSymbol(rawSymbol),
      raw_symbol: rawSymbol,
      direction,
      entry_price: entry,
      exit_price: exit,
      quantity: qty,
      entry_time: time,
      exit_time: time,
      fees: 0,
      pnl: round2(pnl),
    };
    trades.push({ ...base, external_id: externalId(base, get(r, "balance after") || String(i)) });
  });

  if (trades.length) {
    warnings.push(
      "Account History exports only include the close time, so entry time is set to the exit time. " +
        "Use the History (orders) export for exact entry/exit times.",
    );
  }
  if (commissionTotal) warnings.push(`Commission rows ($${commissionTotal.toFixed(2)} total) are not attributed to trades.`);
  trades.sort((a, b) => a.entry_time.localeCompare(b.entry_time));
  return { format: "balance", trades, warnings };
}

function round6(n: number) {
  return Math.round(n * 1e6) / 1e6;
}
