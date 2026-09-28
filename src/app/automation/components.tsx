"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, Check, Copy, PlugZap, Power, Send, ShieldAlert } from "lucide-react";
import {
  saveRiskSettings,
  sendTestSignal,
  switchToDemo,
  switchToLive,
  testConnection,
  setAutoTrading,
  type ActionState,
} from "./actions";
import type { AutomationSettings } from "@/lib/automation";

function Message({ state }: { state: ActionState }) {
  if (state.error) return <p className="mt-3 text-sm text-loss">{state.error}</p>;
  if (state.ok) return <p className="mt-3 text-sm text-profit">{state.ok}</p>;
  return null;
}

export function MasterSwitch({ enabled, live }: { enabled: boolean; live: boolean }) {
  const [state, action, pending] = useActionState<ActionState>(setAutoTrading.bind(null, !enabled), {});
  return (
    <form action={action}>
      <button
        disabled={pending}
        className={
          enabled
            ? "btn-danger px-5 py-2.5"
            : live
              ? "btn px-5 py-2.5 bg-loss text-white hover:bg-loss/90"
              : "btn-primary px-5 py-2.5"
        }
      >
        <Power className="size-4" />
        {pending ? "…" : enabled ? "Stop auto-trading" : live ? "Turn on LIVE auto-trading" : "Turn on auto-trading"}
      </button>
      <Message state={state} />
    </form>
  );
}

export function ConnectionTest({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState<ActionState>(testConnection, {});
  return (
    <form action={action}>
      <button className="btn-ghost" disabled={disabled || pending}>
        <PlugZap className="size-4" /> {pending ? "Connecting…" : "Test connection"}
      </button>
      <Message state={state} />
    </form>
  );
}

export function RiskForm({ s }: { s: AutomationSettings }) {
  const [state, action, pending] = useActionState(saveRiskSettings, {});
  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="allowedSymbols">Allowed symbols</label>
          <input id="allowedSymbols" name="allowedSymbols" defaultValue={s.allowedSymbols.join(", ")} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="maxQty">Max contracts</label>
          <input id="maxQty" name="maxQty" type="number" min={1} max={50} defaultValue={s.maxQty} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="maxOrdersPerDay">Max orders / day</label>
          <input id="maxOrdersPerDay" name="maxOrdersPerDay" type="number" min={1} max={500} defaultValue={s.maxOrdersPerDay} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="accountDemo">Demo account</label>
          <input id="accountDemo" name="accountDemo" defaultValue={s.accountDemo} placeholder="Blank = your only demo account" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="accountLive">Live account</label>
          <input id="accountLive" name="accountLive" defaultValue={s.accountLive} placeholder="Blank = your only live account" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="contractOverrides">Contract overrides</label>
          <input
            id="contractOverrides"
            name="contractOverrides"
            defaultValue={Object.entries(s.contractOverrides).map(([k, v]) => `${k}=${v}`).join(", ")}
            placeholder="Auto front month, e.g. NQ=NQZ6"
            className="input"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save limits"}</button>
        <Message state={state} />
      </div>
    </form>
  );
}

export function CopyBox({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="label mb-0">{label}</span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {multiline ? (
        <pre className="overflow-x-auto rounded-lg border border-line bg-bg p-3 font-mono text-xs leading-relaxed text-ink-2">{value}</pre>
      ) : (
        <div className="truncate rounded-lg border border-line bg-bg px-3 py-2 font-mono text-xs text-ink-2">{value}</div>
      )}
    </div>
  );
}

export function TestSignalForm({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState(sendTestSignal, {});
  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        <div className="col-span-2 sm:col-span-1">
          <span className="label">Ticker</span>
          <input name="ticker" defaultValue="MNQ1!" className="input" />
        </div>
        <div>
          <span className="label">Action</span>
          <select name="action" className="input">
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
            <option value="exit">Exit / flatten</option>
          </select>
        </div>
        <div>
          <span className="label">Contracts</span>
          <input name="contracts" type="number" min={1} defaultValue={1} className="input" />
        </div>
        <div>
          <span className="label">Price</span>
          <input name="price" type="number" step="any" placeholder="For brackets" className="input" />
        </div>
        <div>
          <span className="label">Stop (pts)</span>
          <input name="sl_points" type="number" step="any" className="input" />
        </div>
        <div>
          <span className="label">Target (pts)</span>
          <input name="tp_points" type="number" step="any" className="input" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-ghost" disabled={disabled || pending}>
          <Send className="size-4" /> {pending ? "Sending…" : "Send test signal (demo)"}
        </button>
        <Message state={state} />
      </div>
    </form>
  );
}

export function ModeSwitch({ mode, liveAllowed }: { mode: "demo" | "live"; liveAllowed: boolean }) {
  const [liveState, liveAction, livePending] = useActionState(switchToLive, {});
  const [demoState, demoAction, demoPending] = useActionState<ActionState>(switchToDemo, {});
  const [open, setOpen] = useState(false);

  if (mode === "live") {
    return (
      <form action={demoAction} className="space-y-3">
        <p className="flex items-start gap-2 text-sm text-loss">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          Live mode is active. Switching pauses auto-trading, so turn it on at the top of the page only when you&apos;re ready.
        </p>
        <button className="btn-primary" disabled={demoPending}>{demoPending ? "Switching…" : "Switch back to demo (paper)"}</button>
        <Message state={demoState} />
      </form>
    );
  }
  if (!liveAllowed) {
    return (
      <p className="text-sm text-muted">
        Live trading is locked on this server. To unlock it, set the environment variable{" "}
        <code className="text-ink-2">TRADOVATE_ALLOW_LIVE=true</code> and redeploy — then come back here to switch.
      </p>
    );
  }
  if (!open) {
    return (
      <button type="button" className="btn-danger" onClick={() => setOpen(true)}>
        <ShieldAlert className="size-4" /> Switch to live trading…
      </button>
    );
  }
  return (
    <form action={liveAction} className="space-y-4 rounded-lg border border-loss/40 bg-loss/5 p-4">
      <div className="flex items-start gap-2 text-sm text-loss">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <p>
          Live mode sends <b>real orders with real money</b> to your Tradovate live account whenever a TradingView alert
          fires. Test your alerts in demo first. Auto-trading will be paused after switching so you can review your limits.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-2">
        <input type="checkbox" name="ack" className="size-4 accent-[var(--color-loss)]" />
        I understand automated orders can lose money, and I have tested this setup in demo.
      </label>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <span className="label">Type LIVE to confirm</span>
          <input name="confirm" autoComplete="off" className="input w-40 font-mono" />
        </div>
        <button className="btn px-4 py-2 bg-loss text-white hover:bg-loss/90" disabled={livePending}>
          {livePending ? "Verifying…" : "Switch to LIVE"}
        </button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      <Message state={liveState} />
    </form>
  );
}
