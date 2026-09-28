import PageHeader from "@/components/PageHeader";
import PnlCalendar from "@/components/PnlCalendar";
import { DailyPnlChart } from "@/components/Charts";
import { listTrades } from "@/lib/trades";
import { dailyStats } from "@/lib/stats";
import { money, pct, pnlColor } from "@/lib/format";
import { ready } from "@/lib/session";

export default async function CalendarPage() {
  await ready();
  const trades = listTrades();
  const dayMap = dailyStats(trades);
  const days = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  const green = days.filter((d) => d.pnl > 0).length;
  const best = days.reduce<(typeof days)[number] | null>((b, d) => (!b || d.pnl > b.pnl ? d : b), null);
  const worst = days.reduce<(typeof days)[number] | null>((b, d) => (!b || d.pnl < b.pnl ? d : b), null);
  const avg = days.length ? days.reduce((a, d) => a + d.pnl, 0) / days.length : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="Calendar" subtitle="Daily P&L by the day each trade closed. Click a day to see its trades." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Green days" value={`${green} / ${days.length}`} sub={pct(days.length ? (green / days.length) * 100 : 0) + " day win rate"} />
        <Tile label="Avg day" value={money(avg, { sign: true })} tone={avg} />
        <Tile label="Best day" value={best ? money(best.pnl, { sign: true }) : "—"} sub={best?.date} tone={best?.pnl} />
        <Tile label="Worst day" value={worst ? money(worst.pnl, { sign: true }) : "—"} sub={worst?.date} tone={worst?.pnl} />
      </div>
      <div className="card p-5 sm:p-6">
        <PnlCalendar days={Object.fromEntries(dayMap)} />
      </div>
      <div className="card p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-semibold text-ink-2">Daily P&amp;L</h2>
        <DailyPnlChart data={days.slice(-60)} />
      </div>
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: number }) {
  return (
    <div className="card p-5">
      <div className="text-xs font-medium tracking-wide text-muted uppercase">{label}</div>
      <div className={`mt-2 font-mono text-xl font-semibold ${tone === undefined ? "text-ink" : pnlColor(tone)}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}
