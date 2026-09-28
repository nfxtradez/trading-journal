import "server-only";
import crypto from "node:crypto";
import { REMOTE, blobStore } from "./db";

/**
 * Minimal Tradovate REST client.
 * Credentials come ONLY from environment variables (Netlify env vars / .env.local) — never the database.
 *   TRADOVATE_USERNAME, TRADOVATE_PASSWORD   your Tradovate login
 *   TRADOVATE_CID, TRADOVATE_SECRET          API key from Tradovate → Settings → API Access
 *   TRADOVATE_APP_ID, TRADOVATE_APP_VERSION  optional (default "TradeLog", "1.0")
 *   TRADOVATE_DEVICE_ID                      optional stable device id
 *   TRADOVATE_ALLOW_LIVE=true                required before live trading can be switched on
 */
export type TradovateEnv = "demo" | "live";

const BASE_URL: Record<TradovateEnv, string> = {
  demo: process.env.TRADOVATE_DEMO_URL || "https://demo.tradovateapi.com/v1",
  live: process.env.TRADOVATE_LIVE_URL || "https://live.tradovateapi.com/v1",
};

export const CREDENTIAL_VARS = ["TRADOVATE_USERNAME", "TRADOVATE_PASSWORD", "TRADOVATE_CID", "TRADOVATE_SECRET"] as const;

export function credentialStatus(): Record<(typeof CREDENTIAL_VARS)[number], boolean> {
  return Object.fromEntries(CREDENTIAL_VARS.map((k) => [k, !!process.env[k]])) as Record<(typeof CREDENTIAL_VARS)[number], boolean>;
}

export function hasCredentials(): boolean {
  return CREDENTIAL_VARS.every((k) => !!process.env[k]);
}

export function liveAllowed(): boolean {
  return process.env.TRADOVATE_ALLOW_LIVE === "true";
}

export class TradovateError extends Error {}

// ---------- auth ----------

interface Token {
  accessToken: string;
  expiresAt: number; // ms epoch
}

// On globalThis so route handlers and server actions (separate bundles) share one token.
const g = globalThis as unknown as { __tradovateTokens?: Map<TradovateEnv, Token> };
const memTokens = (g.__tradovateTokens ??= new Map<TradovateEnv, Token>());
const tokenKey = (env: TradovateEnv) => `tradovate-token-${env}`;

async function loadToken(env: TradovateEnv): Promise<Token | null> {
  const mem = memTokens.get(env);
  if (mem) return mem;
  if (!REMOTE) return null;
  // Share the token across serverless instances so cold starts don't re-authenticate (Tradovate rate-limits logins).
  const t = (await blobStore("tradelog").get(tokenKey(env), { type: "json" })) as Token | null;
  if (t) memTokens.set(env, t);
  return t;
}

async function storeToken(env: TradovateEnv, t: Token | null) {
  if (t) memTokens.set(env, t);
  else memTokens.delete(env);
  if (!REMOTE) return;
  if (t) await blobStore("tradelog").setJSON(tokenKey(env), t);
  else await blobStore("tradelog").delete(tokenKey(env));
}

function deviceId(): string {
  return (
    process.env.TRADOVATE_DEVICE_ID ||
    crypto.createHash("sha256").update(`tradelog:${process.env.TRADOVATE_USERNAME ?? ""}`).digest("hex").slice(0, 32)
  );
}

async function requestToken(env: TradovateEnv): Promise<Token> {
  if (!hasCredentials()) throw new TradovateError("Tradovate credentials are not configured.");
  const body: Record<string, unknown> = {
    name: process.env.TRADOVATE_USERNAME,
    password: process.env.TRADOVATE_PASSWORD,
    appId: process.env.TRADOVATE_APP_ID || "TradeLog",
    appVersion: process.env.TRADOVATE_APP_VERSION || "1.0",
    deviceId: deviceId(),
    cid: Number(process.env.TRADOVATE_CID) || process.env.TRADOVATE_CID,
    sec: process.env.TRADOVATE_SECRET,
  };
  const res = await fetch(`${BASE_URL[env]}/auth/accesstokenrequest`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (json["p-ticket"]) {
    throw new TradovateError(
      `Tradovate is rate-limiting logins; try again in ${json["p-time"] ?? "a few"} seconds.` +
        (json["p-captcha"] ? " It is also asking for a captcha — log in once on tradovate.com." : ""),
    );
  }
  if (!res.ok || !json.accessToken) {
    throw new TradovateError(`Tradovate login failed: ${json.errorText || res.statusText || res.status}`);
  }
  const expiresAt = json.expirationTime ? Date.parse(String(json.expirationTime)) : Date.now() + 75 * 60_000;
  return { accessToken: String(json.accessToken), expiresAt };
}

async function getToken(env: TradovateEnv): Promise<string> {
  const t = await loadToken(env);
  const now = Date.now();
  if (t && t.expiresAt - now > 10 * 60_000) return t.accessToken;
  if (t && t.expiresAt - now > 30_000) {
    // Renew instead of logging in again.
    const res = await fetch(`${BASE_URL[env]}/auth/renewaccesstoken`, {
      headers: { Authorization: `Bearer ${t.accessToken}`, Accept: "application/json" },
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok && json.accessToken) {
      const renewed = {
        accessToken: String(json.accessToken),
        expiresAt: json.expirationTime ? Date.parse(String(json.expirationTime)) : now + 75 * 60_000,
      };
      await storeToken(env, renewed);
      return renewed.accessToken;
    }
  }
  const fresh = await requestToken(env);
  await storeToken(env, fresh);
  return fresh.accessToken;
}

// ---------- API ----------

async function call<T>(env: TradovateEnv, method: "GET" | "POST", path: string, body?: unknown, retried = false): Promise<T> {
  const token = await getToken(env);
  const res = await fetch(`${BASE_URL[env]}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (res.status === 401 && !retried) {
    await storeToken(env, null);
    return call<T>(env, method, path, body, true);
  }
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new TradovateError(`Tradovate ${path} failed (${res.status}): ${json?.errorText ?? text.slice(0, 200)}`);
  return json as T;
}

export interface Account {
  id: number;
  name: string;
  active?: boolean;
  archived?: boolean;
}

export async function listAccounts(env: TradovateEnv): Promise<Account[]> {
  const list = await call<Account[]>(env, "GET", "/account/list");
  return list.filter((a) => a.active !== false && !a.archived);
}

export async function findAccount(env: TradovateEnv, spec: string): Promise<Account> {
  const accounts = await listAccounts(env);
  if (accounts.length === 0) throw new TradovateError(`No active Tradovate ${env} accounts found.`);
  if (spec) {
    const hit = accounts.find((a) => a.name === spec);
    if (!hit) throw new TradovateError(`Account "${spec}" not found. Available: ${accounts.map((a) => a.name).join(", ")}`);
    return hit;
  }
  if (accounts.length > 1) {
    throw new TradovateError(`Several accounts found (${accounts.map((a) => a.name).join(", ")}); choose one in Auto Trading settings.`);
  }
  return accounts[0];
}

export async function findContract(env: TradovateEnv, name: string): Promise<{ id: number; name: string }> {
  const c = await call<{ id: number; name: string } | null>(env, "GET", `/contract/find?name=${encodeURIComponent(name)}`);
  if (!c?.id) throw new TradovateError(`Contract ${name} not found on Tradovate.`);
  return c;
}

export async function netPosition(env: TradovateEnv, accountId: number, contractId: number): Promise<number> {
  const positions = await call<{ accountId: number; contractId: number; netPos: number }[]>(env, "GET", "/position/list");
  return positions.filter((p) => p.accountId === accountId && p.contractId === contractId).reduce((a, p) => a + p.netPos, 0);
}

interface OrderResult {
  orderId?: number;
  oso1Id?: number;
  oso2Id?: number;
  failureReason?: string;
  failureText?: string;
}

function check(r: OrderResult, what: string): number[] {
  if (r.failureReason || !r.orderId) throw new TradovateError(`${what} rejected: ${r.failureText || r.failureReason || "unknown reason"}`);
  return [r.orderId, r.oso1Id, r.oso2Id].filter((x): x is number => typeof x === "number");
}

/** Market order, optionally with an attached OCO stop-loss / take-profit bracket. Returns order ids. */
export async function placeMarketOrder(
  env: TradovateEnv,
  o: { account: Account; contract: string; side: "Buy" | "Sell"; qty: number; stopPrice?: number; targetPrice?: number },
): Promise<number[]> {
  const base = {
    accountSpec: o.account.name,
    accountId: o.account.id,
    action: o.side,
    symbol: o.contract,
    orderQty: o.qty,
    orderType: "Market",
    isAutomated: true, // required by CME for orders not entered by hand
  };
  const exit = o.side === "Buy" ? "Sell" : "Buy";
  if (o.stopPrice === undefined && o.targetPrice === undefined) {
    return check(await call<OrderResult>(env, "POST", "/order/placeorder", base), "Order");
  }
  const brackets: Record<string, unknown> = {};
  const legs = [
    o.targetPrice !== undefined ? { action: exit, orderType: "Limit", price: o.targetPrice } : null,
    o.stopPrice !== undefined ? { action: exit, orderType: "Stop", stopPrice: o.stopPrice } : null,
  ].filter(Boolean);
  legs.forEach((leg, i) => (brackets[`bracket${i + 1}`] = leg));
  return check(await call<OrderResult>(env, "POST", "/order/placeoso", { ...base, ...brackets }), "Bracket order");
}

/** Close the position in a contract and cancel its working orders (brackets). */
export async function liquidate(env: TradovateEnv, accountId: number, contractId: number): Promise<number[]> {
  return check(await call<OrderResult>(env, "POST", "/order/liquidateposition", { accountId, contractId, admin: false }), "Flatten");
}
