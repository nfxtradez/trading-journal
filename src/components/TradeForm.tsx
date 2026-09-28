"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";
import type { FormState } from "@/app/actions";
import { computePnl, pointValue, rootSymbol } from "@/lib/instruments";
import { money } from "@/lib/format";
import type { Tag, TradeWithTags } from "@/lib/types";
import TagPicker from "./TagPicker";
import ScreenshotInput from "./ScreenshotInput";

const QUICK_SYMBOLS = ["NQ", "ES", "MNQ", "MES"];

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

function nowLocal() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const s = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

export default function TradeForm({
  action,
  tags,
  trade,
}: {
  action: Action;
  tags: Tag[];
  trade?: TradeWithTags;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [f, setF] = useState({
    symbol: trade?.raw_symbol ?? trade?.symbol ?? "NQ",
    direction: trade?.direction ?? "long",
    entry_price: s(trade?.entry_price),
    exit_price: s(trade?.exit_price),
    quantity: s(trade?.quantity ?? 1),
    stop_loss: s(trade?.stop_loss),
    take_profit: s(trade?.take_profit),
    fees: s(trade?.fees || null),
    entry_time: trade?.entry_time.slice(0, 19) ?? "",
    exit_time: trade?.exit_time?.slice(0, 19) ?? "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  // Only prefill P&L when it was overridden (differs from what the prices imply).
  const [initialPnl] = useState(() =>
    trade && trade.pnl !== null && (trade.exit_price === null || computePnl({ ...trade, exit_price: trade.exit_price }) !== trade.pnl)
      ? String(trade.pnl)
      : "",
  );
  const fe = state.fieldErrors ?? {};
  const n = (v: string) => (v.trim() === "" ? null : Number(v));
  const entry = n(f.entry_price);
  const exit = n(f.exit_price);
  const qty = n(f.quantity) ?? 1;
  const stop = n(f.stop_loss);
  const target = n(f.take_profit);
  const dir = f.direction as "long" | "short";
  const pv = pointValue(f.symbol);

  const autoPnl =
    entry !== null && exit !== null
      ? computePnl({ symbol: f.symbol, direction: dir, entry_price: entry, exit_price: exit, quantity: qty, fees: n(f.fees) })
      : null;
  const risk = entry !== null && stop !== null ? Math.abs(entry - stop) * qty * pv : null;
  const reward = entry !== null && target !== null ? Math.abs(target - entry) * qty * pv : null;
  const rMultiple = autoPnl !== null && risk ? autoPnl / risk : null;

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <div className="rounded-lg border border-loss/40 bg-loss/10 px-4 py-3 text-sm text-loss">{state.error}</div>
      )}

      <section className="card p-5 sm:p-6">
        <h2 className="mb-5 text-sm font-semibold text-ink-2">Trade details</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Symbol" error={fe.symbol}>
            <input name="symbol" value={f.symbol} onChange={set("symbol")} className="input uppercase" placeholder="NQ" required />
            <div className="mt-2 flex gap-1.5">
              {QUICK_SYMBOLS.map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onClick={() => setF((p) => ({ ...p, symbol: sym }))}
                  className={`rounded-md border px-2 py-0.5 text-xs ${
                    rootSymbol(f.symbol) === sym ? "border-accent bg-accent/15 text-accent" : "border-line text-muted hover:text-ink"
                  }`}
                >
                  {sym}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Direction" error={fe.direction}>
            <input type="hidden" name="direction" value={f.direction} />
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-bg p-1">
              {(["long", "short"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setF((p) => ({ ...p, direction: d }))}
                  className={`rounded-md py-1.5 text-sm font-medium capitalize transition ${
                    f.direction === d
                      ? d === "long"
                        ? "bg-profit/20 text-profit"
                        : "bg-loss/20 text-loss"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Contracts" error={fe.quantity}>
            <input name="quantity" type="number" min="0" step="any" value={f.quantity} onChange={set("quantity")} className="input" />
            <p className="mt-1.5 text-xs text-muted">${pv}/point per contract</p>
          </Field>

          <Field label="Fees / commission ($)">
            <input name="fees" type="number" min="0" step="any" value={f.fees} onChange={set("fees")} className="input" placeholder="0.00" />
          </Field>

          <Field label="Entry price" error={fe.entry_price}>
            <input name="entry_price" type="number" step="any" value={f.entry_price} onChange={set("entry_price")} className="input" required />
          </Field>
          <Field label="Exit price" error={fe.exit_price}>
            <input name="exit_price" type="number" step="any" value={f.exit_price} onChange={set("exit_price")} className="input" placeholder="Leave blank if open" />
          </Field>
          <Field label="Stop loss">
            <input name="stop_loss" type="number" step="any" value={f.stop_loss} onChange={set("stop_loss")} className="input" />
          </Field>
          <Field label="Take profit">
            <input name="take_profit" type="number" step="any" value={f.take_profit} onChange={set("take_profit")} className="input" />
          </Field>

          <Field label="Entry time" error={fe.entry_time} className="lg:col-span-2">
            <TimeInput name="entry_time" value={f.entry_time} onChange={(v) => setF((p) => ({ ...p, entry_time: v }))} required />
          </Field>
          <Field label="Exit time" error={fe.exit_time} className="lg:col-span-2">
            <TimeInput name="exit_time" value={f.exit_time} onChange={(v) => setF((p) => ({ ...p, exit_time: v }))} />
          </Field>
        </div>

        <div className="mt-6 grid gap-4 rounded-lg border border-line bg-bg/60 p-4 sm:grid-cols-4">
          <Field label="P&L ($)" error={fe.pnl}>
            <input
              name="pnl"
              type="number"
              step="any"
              defaultValue={initialPnl}
              className="input"
              placeholder={autoPnl !== null ? `Auto: ${autoPnl.toFixed(2)}` : "Auto-calculated"}
            />
            <p className="mt-1.5 text-xs text-muted">Leave blank to calculate from prices</p>
          </Field>
          <Metric label="Calculated P&L" value={autoPnl === null ? "—" : money(autoPnl, { sign: true })} tone={autoPnl} />
          <Metric label="Planned risk / reward" value={risk === null ? "—" : `${money(risk, { cents: false })} / ${reward === null ? "—" : money(reward, { cents: false })}`} />
          <Metric label="R-multiple" value={rMultiple === null ? "—" : `${rMultiple >= 0 ? "+" : ""}${rMultiple.toFixed(2)}R`} tone={rMultiple} />
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="mb-5 text-sm font-semibold text-ink-2">Tags</h2>
        <TagPicker tags={tags} selected={trade?.tags.map((t) => t.id)} />
      </section>

      <section className="card grid gap-6 p-5 sm:p-6 lg:grid-cols-2">
        <div>
          <label className="label" htmlFor="notes">Notes</label>
          <textarea
            id="notes"
            name="notes"
            rows={8}
            defaultValue={trade?.notes ?? ""}
            className="input resize-y leading-relaxed"
            placeholder="Why did you take it? What was the market doing? What would you do differently?"
          />
          <div className="mt-4">
            <span className="label">Execution rating</span>
            <select name="rating" defaultValue={s(trade?.rating)} className="input w-auto">
              <option value="">Not rated</option>
              {[5, 4, 3, 2, 1].map((r) => (
                <option key={r} value={r}>
                  {"★".repeat(r)}{"☆".repeat(5 - r)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <span className="label">Screenshots</span>
          <ScreenshotInput existing={trade?.screenshots} />
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Link href={trade ? `/journal/${trade.id}` : "/journal"} className="btn-ghost">
          Cancel
        </Link>
        {!trade && (
          <button type="submit" name="after" value="new" disabled={pending} className="btn-ghost">
            Save &amp; log another
          </button>
        )}
        <button type="submit" disabled={pending} className="btn-primary min-w-32">
          {pending ? "Saving…" : trade ? "Save changes" : "Save trade"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  className = "",
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <span className="label">{label}</span>
      {children}
      {error && <p className="mt-1.5 text-xs text-loss">{error}</p>}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: number | null }) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className={`py-2 font-mono text-lg ${tone ? (tone > 0 ? "text-profit" : "text-loss") : "text-ink"}`}>{value}</div>
    </div>
  );
}

function TimeInput({
  name,
  value,
  onChange,
  required,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <input
        name={name}
        type="datetime-local"
        step="1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input"
        required={required}
      />
      <button type="button" onClick={() => onChange(nowLocal())} className="btn-ghost shrink-0 px-3" title="Set to now">
        <Clock className="size-4" /> Now
      </button>
    </div>
  );
}
