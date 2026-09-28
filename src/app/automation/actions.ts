"use server";

import { revalidatePath } from "next/cache";
import { saveDb, REMOTE } from "@/lib/db";
import { ready } from "@/lib/session";
import { authEnabled } from "@/lib/auth";
import { rootSymbol } from "@/lib/instruments";
import { getAutomationSettings, parseAlert, processAlert, saveAutomationSettings } from "@/lib/automation";
import * as tv from "@/lib/tradovate";

export interface ActionState {
  ok?: string;
  error?: string;
}

async function persist(): Promise<string | null> {
  try {
    await saveDb();
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Could not save.";
  }
}

function refresh() {
  revalidatePath("/automation");
}

export async function saveRiskSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await ready();
  const s = getAutomationSettings();
  const symbols = String(fd.get("allowedSymbols") ?? "")
    .split(/[\s,]+/)
    .map((x) => rootSymbol(x))
    .filter(Boolean);
  const maxQty = Number(fd.get("maxQty"));
  const maxOrders = Number(fd.get("maxOrdersPerDay"));
  if (!symbols.length) return { error: "Allow at least one symbol." };
  if (!Number.isInteger(maxQty) || maxQty < 1 || maxQty > 50) return { error: "Max contracts must be a whole number from 1 to 50." };
  if (!Number.isInteger(maxOrders) || maxOrders < 1 || maxOrders > 500) return { error: "Max orders per day must be 1–500." };

  const overrides: Record<string, string> = {};
  for (const line of String(fd.get("contractOverrides") ?? "").split(/[\n,]+/)) {
    const m = line.trim().toUpperCase().match(/^([A-Z0-9]+)\s*[=:]\s*([A-Z0-9]+)$/);
    if (m) overrides[m[1]] = m[2];
    else if (line.trim()) return { error: `Can't read contract override "${line.trim()}" — use ROOT=CONTRACT, e.g. NQ=NQZ6.` };
  }
  saveAutomationSettings({
    ...s,
    allowedSymbols: [...new Set(symbols)],
    maxQty,
    maxOrdersPerDay: maxOrders,
    accountDemo: String(fd.get("accountDemo") ?? "").trim(),
    accountLive: String(fd.get("accountLive") ?? "").trim(),
    contractOverrides: overrides,
  });
  const err = await persist();
  refresh();
  return err ? { error: err } : { ok: "Saved." };
}

export async function setAutoTrading(enabled: boolean): Promise<ActionState> {
  await ready();
  const s = getAutomationSettings();
  if (enabled) {
    if (!tv.hasCredentials()) return { error: "Add your Tradovate credentials (environment variables) first." };
    if (REMOTE && !authEnabled()) return { error: "Set APP_PASSWORD before turning on auto-trading, so nobody else can control it." };
    if (s.mode === "live" && !tv.liveAllowed()) return { error: "Live trading is not permitted on this server." };
  }
  saveAutomationSettings({ ...s, enabled });
  const err = await persist();
  refresh();
  return err ? { error: err } : { ok: enabled ? "Auto-trading is on." : "Auto-trading stopped." };
}

export async function testConnection(): Promise<ActionState> {
  await ready();
  const s = getAutomationSettings();
  try {
    const accounts = await tv.listAccounts(s.mode);
    if (!accounts.length) return { error: `Connected to Tradovate ${s.mode}, but no active accounts were found.` };
    return { ok: `Connected to Tradovate ${s.mode}. Accounts: ${accounts.map((a) => a.name).join(", ")}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Switch to LIVE trading. Requires ALL of:
 *  - TRADOVATE_ALLOW_LIVE=true on the server (set by you in Netlify / .env.local),
 *  - typing LIVE and ticking the acknowledgement,
 *  - a successful login to your live Tradovate account.
 * Auto-trading is paused by the switch; you turn it back on yourself.
 */
export async function switchToLive(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await ready();
  if (!tv.liveAllowed()) return { error: "Live trading is disabled on this server. Set TRADOVATE_ALLOW_LIVE=true first." };
  if (String(fd.get("confirm") ?? "").trim() !== "LIVE") return { error: 'Type LIVE (in capitals) to confirm.' };
  if (fd.get("ack") !== "on") return { error: "Tick the box to confirm you understand real orders will be placed." };
  if (!tv.hasCredentials()) return { error: "Tradovate credentials are not configured." };
  if (REMOTE && !authEnabled()) return { error: "Set APP_PASSWORD before enabling live trading." };
  const s = getAutomationSettings();
  try {
    await tv.findAccount("live", s.accountLive);
  } catch (e) {
    return { error: `Couldn't verify your live account: ${e instanceof Error ? e.message : e}` };
  }
  saveAutomationSettings({ ...s, mode: "live", enabled: false });
  const err = await persist();
  refresh();
  return err ? { error: err } : { ok: "Switched to LIVE. Auto-trading is paused — review your limits, then turn it on." };
}

export async function switchToDemo(): Promise<ActionState> {
  await ready();
  saveAutomationSettings({ ...getAutomationSettings(), mode: "demo" });
  const err = await persist();
  refresh();
  return err ? { error: err } : { ok: "Back in demo (paper) mode." };
}

export async function sendTestSignal(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await ready();
  const s = getAutomationSettings();
  if (s.mode !== "demo") return { error: "Test signals only run in demo mode." };
  const body: Record<string, unknown> = {
    ticker: String(fd.get("ticker") ?? "NQ1!"),
    action: String(fd.get("action") ?? "buy"),
    contracts: Number(fd.get("contracts") ?? 1),
  };
  const price = Number(fd.get("price"));
  if (price) body.price = price;
  if (Number(fd.get("sl_points"))) body.sl_points = Number(fd.get("sl_points"));
  if (Number(fd.get("tp_points"))) body.tp_points = Number(fd.get("tp_points"));
  const payload = JSON.stringify(body);
  try {
    const outcome = await processAlert(parseAlert(payload), "test", payload);
    refresh();
    return outcome.status === "submitted" ? { ok: outcome.reason } : { error: `${outcome.status}: ${outcome.reason}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
