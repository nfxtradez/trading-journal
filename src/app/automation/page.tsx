import { headers } from "next/headers";
import { CheckCircle2, CircleDashed } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { ready } from "@/lib/session";
import { REMOTE } from "@/lib/db";
import { authEnabled } from "@/lib/auth";
import { getAutomationSettings, listSignals } from "@/lib/automation";
import { credentialStatus, hasCredentials, liveAllowed } from "@/lib/tradovate";
import { ConnectionTest, CopyBox, MasterSwitch, ModeSwitch, RiskForm, TestSignalForm } from "./components";

const STATUS_STYLE: Record<string, string> = {
  submitted: "bg-profit/15 text-profit",
  ignored: "bg-card-2 text-muted",
  rejected: "bg-amber-400/15 text-amber-300",
  error: "bg-loss/15 text-loss",
};

const TEMPLATE_STRATEGY = `{
  "secret": "YOUR_TV_WEBHOOK_SECRET",
  "ticker": "{{ticker}}",
  "market_position": "{{strategy.market_position}}",
  "market_position_size": "{{strategy.market_position_size}}",
  "price": "{{close}}",
  "sl_points": 20,
  "tp_points": 40
}`;

const TEMPLATE_ALERT = `{
  "secret": "YOUR_TV_WEBHOOK_SECRET",
  "ticker": "{{ticker}}",
  "action": "buy",
  "contracts": 1,
  "price": "{{close}}",
  "sl_points": 20,
  "tp_points": 40
}`;

export default async function AutomationPage() {
  await ready();
  const s = getAutomationSettings();
  const signals = listSignals(50);
  const creds = credentialStatus();
  const live = s.mode === "live";
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "your-site.netlify.app";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const webhookUrl = `${proto}://${host}/api/webhooks/tradingview`;

  const checklist: [string, boolean, string][] = [
    ...Object.entries(creds).map(([k, v]) => [k, v, "Tradovate login / API key"] as [string, boolean, string]),
    ["TV_WEBHOOK_SECRET", !!process.env.TV_WEBHOOK_SECRET, "Shared secret for TradingView alerts"],
    ...(REMOTE ? ([["APP_PASSWORD", authEnabled(), "Protects this page"]] as [string, boolean, string][]) : []),
    ["TRADOVATE_ALLOW_LIVE", liveAllowed(), "Optional — unlocks live trading"],
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Auto Trading" subtitle="Execute TradingView alerts on your Tradovate account." />

      {/* Status */}
      <section className={`card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6 ${live ? "border-loss/50" : ""}`}>
        <div className="flex flex-wrap items-center gap-4">
          <span
            className={`rounded-md px-2.5 py-1 text-xs font-bold tracking-wider ${
              live ? "bg-loss text-white" : "bg-accent/15 text-accent"
            }`}
          >
            {live ? "LIVE" : "DEMO · PAPER"}
          </span>
          <div>
            <div className="font-semibold">
              Auto-trading is{" "}
              <span className={s.enabled ? (live ? "text-loss" : "text-profit") : "text-muted"}>{s.enabled ? "ON" : "OFF"}</span>
            </div>
            <div className="text-sm text-muted">
              {s.enabled
                ? `Alerts are sent to your Tradovate ${live ? "LIVE" : "demo"} account.`
                : "Alerts are logged but no orders are placed."}
            </div>
          </div>
        </div>
        <MasterSwitch enabled={s.enabled} live={live} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Credentials */}
        <section className="card p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-ink-2">Connection</h2>
          <p className="mt-1 mb-4 text-sm text-muted">
            Keys are read from environment variables only — never stored in the journal database or shown here.
          </p>
          <ul className="mb-4 space-y-1.5 text-sm">
            {checklist.map(([k, ok, hint]) => (
              <li key={k} className="flex items-center gap-2">
                {ok ? <CheckCircle2 className="size-4 text-profit" /> : <CircleDashed className="size-4 text-muted" />}
                <code className={ok ? "text-ink-2" : "text-muted"}>{k}</code>
                <span className="text-xs text-muted">· {hint}</span>
              </li>
            ))}
          </ul>
          <ConnectionTest disabled={!hasCredentials()} />
        </section>

        {/* TradingView */}
        <section className="card space-y-4 p-5 sm:p-6">
          <div>
            <h2 className="text-sm font-semibold text-ink-2">TradingView alert setup</h2>
            <p className="mt-1 text-sm text-muted">
              In the alert dialog: <b>Notifications → Webhook URL</b>, and paste a message below with your secret.
            </p>
          </div>
          <CopyBox label="Webhook URL" value={webhookUrl} />
          <CopyBox label="Message · strategy alerts (keeps position in sync)" value={TEMPLATE_STRATEGY} multiline />
          <CopyBox label="Message · indicator / manual alerts" value={TEMPLATE_ALERT} multiline />
          <p className="text-xs text-muted">
            <code>sl_points</code>/<code>tp_points</code> attach an OCO stop and target when opening a position (or use
            absolute <code>sl</code>/<code>tp</code> prices). Remove them for plain market orders. Use{" "}
            <code>&quot;action&quot;: &quot;exit&quot;</code> to flatten.
          </p>
        </section>
      </div>

      {/* Risk */}
      <section className="card p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-ink-2">Risk limits</h2>
        <p className="mt-1 mb-5 text-sm text-muted">Every alert is checked against these before anything is sent to Tradovate.</p>
        <RiskForm s={s} />
      </section>

      {/* Test */}
      <section className="card p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-ink-2">Test signal</h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          Runs a fake alert through the same checks and sends it to your <b>demo</b> account (auto-trading must be on).
        </p>
        <TestSignalForm disabled={live} />
      </section>

      {/* Mode */}
      <section className={`card p-5 sm:p-6 ${live ? "border-loss/50" : ""}`}>
        <h2 className="text-sm font-semibold text-ink-2">Trading mode</h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          {live
            ? "You are in LIVE mode. Orders go to your real Tradovate account."
            : "Demo mode uses your Tradovate simulation account — no real money."}
        </p>
        <ModeSwitch key={s.mode} mode={s.mode} liveAllowed={liveAllowed()} />
      </section>

      {/* Log */}
      <section className="card overflow-hidden">
        <h2 className="px-5 pt-5 text-sm font-semibold text-ink-2 sm:px-6">Signal log</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-y border-line text-left text-xs text-muted uppercase">
                <th className="px-4 py-2.5 font-medium sm:pl-6">Received (UTC)</th>
                <th className="px-3 py-2.5 font-medium">Source</th>
                <th className="px-3 py-2.5 font-medium">Mode</th>
                <th className="px-3 py-2.5 font-medium">Signal</th>
                <th className="px-3 py-2.5 font-medium">Contract</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium sm:pr-6">Details</th>
              </tr>
            </thead>
            <tbody>
              {signals.map((r) => (
                <tr key={r.id} className="border-b border-line/60 align-top last:border-0">
                  <td className="px-4 py-2.5 whitespace-nowrap text-ink-2 sm:pl-6">{r.received_at}</td>
                  <td className="px-3 py-2.5 text-muted">{r.source === "tradingview" ? "TradingView" : "Test"}</td>
                  <td className={`px-3 py-2.5 text-xs font-semibold uppercase ${r.mode === "live" ? "text-loss" : "text-accent"}`}>{r.mode}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="font-medium">{r.symbol}</span>{" "}
                    <span className="text-muted">
                      {r.action}
                      {r.quantity !== null && ` ${r.quantity}`}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-ink-2">{r.contract ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-ink-2 sm:pr-6">
                    {r.reason}
                    {r.order_ids && <span className="text-muted"> · orders {r.order_ids}</span>}
                  </td>
                </tr>
              ))}
              {signals.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted">No signals yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
