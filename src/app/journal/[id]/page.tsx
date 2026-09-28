import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import DeleteTradeButton from "@/components/DeleteTradeButton";
import TagChip from "@/components/TagChip";
import { getTrade } from "@/lib/trades";
import { pointValue } from "@/lib/instruments";
import { dateTime, duration, money, pnlColor, price } from "@/lib/format";
import { TAG_CATEGORIES } from "@/lib/types";
import { ready } from "@/lib/session";

export default async function TradePage({ params }: PageProps<"/journal/[id]">) {
  await ready();
  const { id } = await params;
  const t = getTrade(Number(id));
  if (!t) notFound();

  const pv = pointValue(t.symbol);
  const risk = t.stop_loss !== null ? Math.abs(t.entry_price - t.stop_loss) * t.quantity * pv : null;
  const r = risk && t.pnl !== null ? t.pnl / risk : null;
  const points = t.exit_price !== null ? (t.exit_price - t.entry_price) * (t.direction === "long" ? 1 : -1) : null;

  const rows: [string, React.ReactNode][] = [
    ["Entry", `${price(t.entry_price)} · ${dateTime(t.entry_time)}`],
    ["Exit", t.exit_price === null ? "Open" : `${price(t.exit_price)} · ${dateTime(t.exit_time)}`],
    ["Contracts", t.quantity],
    ["Points", points === null ? "—" : `${points >= 0 ? "+" : ""}${points.toFixed(2)}`],
    ["Duration", duration(t.entry_time, t.exit_time)],
    ["Stop loss", price(t.stop_loss)],
    ["Take profit", price(t.take_profit)],
    ["Fees", money(t.fees)],
    ["R-multiple", r === null ? "—" : `${r >= 0 ? "+" : ""}${r.toFixed(2)}R`],
    ["Rating", t.rating ? "★".repeat(t.rating) + "☆".repeat(5 - t.rating) : "—"],
    ["Source", t.source === "tradingview" ? `TradingView import (${t.raw_symbol})` : "Manual"],
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/journal" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Journal
      </Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{t.symbol}</h1>
          <span
            className={`rounded-md px-2 py-0.5 text-xs font-semibold uppercase ${
              t.direction === "long" ? "bg-profit/15 text-profit" : "bg-loss/15 text-loss"
            }`}
          >
            {t.direction}
          </span>
          <span className={`font-mono text-2xl font-semibold ${pnlColor(t.pnl)}`}>{money(t.pnl, { sign: true })}</span>
        </div>
        <div className="flex gap-2">
          <Link href={`/journal/${t.id}/edit`} className="btn-ghost">
            <Pencil className="size-4" /> Edit
          </Link>
          <DeleteTradeButton id={t.id} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-5">
          <dl className="divide-y divide-line text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2.5">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right text-ink-2">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <div className="card p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink-2">Tags</h2>
            {t.tags.length === 0 ? (
              <p className="text-sm text-muted">No tags yet.</p>
            ) : (
              <div className="space-y-2">
                {TAG_CATEGORIES.map(({ key, label }) => {
                  const list = t.tags.filter((g) => g.category === key);
                  if (!list.length) return null;
                  return (
                    <div key={key} className="flex flex-wrap items-center gap-2">
                      <span className="w-20 text-xs text-muted">{label}</span>
                      {list.map((g) => (
                        <TagChip key={g.id} tag={g} />
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="card p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink-2">Notes</h2>
            {t.notes ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink-2">{t.notes}</p>
            ) : (
              <p className="text-sm text-muted">No notes.</p>
            )}
          </div>
          {t.screenshots.length > 0 && (
            <div className="card p-5">
              <h2 className="mb-3 text-sm font-semibold text-ink-2">Screenshots</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {t.screenshots.map((s) => (
                  <a key={s.id} href={`/api/uploads/${s.filename}`} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/uploads/${s.filename}`} alt="Trade screenshot" className="w-full rounded-lg border border-line" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
