import { Suspense } from "react";
import PageHeader from "@/components/PageHeader";
import TradeFilters from "@/components/TradeFilters";
import GroupTable from "@/components/GroupTable";
import { EquityChart, GroupPnlChart } from "@/components/Charts";
import { listSymbols, listTags, listTrades } from "@/lib/trades";
import { filtersFromSearchParams } from "@/lib/filters";
import { equityCurve, groupBy, summarize } from "@/lib/stats";
import { money, pct, pnlColor } from "@/lib/format";
import { TAG_CATEGORIES } from "@/lib/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  const filters = filtersFromSearchParams(await searchParams);
  const trades = listTrades({ ...filters, sort: "entry_time", dir: "asc" });
  const s = summarize(trades);
  const curve = equityCurve(trades);

  // Max drawdown from peak of cumulative P&L, trade by trade in close order.
  let cum = 0;
  let peak = 0;
  let maxDd = 0;
  const byClose = trades
    .filter((t) => t.pnl !== null)
    .sort((a, b) => (a.exit_time ?? a.entry_time).localeCompare(b.exit_time ?? b.entry_time));
  for (const t of byClose) {
    cum += t.pnl!;
    peak = Math.max(peak, cum);
    maxDd = Math.min(maxDd, cum - peak);
  }

  const bySymbol = groupBy(trades, (t) => t.symbol);
  const byDirection = groupBy(trades, (t) => (t.direction === "long" ? "Long" : "Short"));
  const byHour = groupBy(trades, (t) => `${t.entry_time.slice(11, 13)}:00`).sort((a, b) => a.key.localeCompare(b.key));
  const byWeekday = groupBy(trades, (t) => {
    const [y, m, d] = t.entry_time.slice(0, 10).split("-").map(Number);
    return WEEKDAYS[new Date(y, m - 1, d).getDay()];
  }).sort((a, b) => WEEKDAYS.indexOf(a.key) - WEEKDAYS.indexOf(b.key));
  const byTag = TAG_CATEGORIES.map((c) => ({
    ...c,
    rows: groupBy(trades, (t) => t.tags.filter((g) => g.category === c.key).map((g) => g.name)),
  }));

  const kpis: [string, string, number | null][] = [
    ["Net P&L", money(s.netPnl, { sign: true }), s.netPnl],
    ["Win rate", pct(s.winRate), null],
    ["Profit factor", s.profitFactor === null ? "—" : s.profitFactor.toFixed(2), null],
    ["Expectancy", money(s.expectancy, { sign: true }), s.expectancy],
    ["Largest win", money(s.largestWin, { sign: true }), s.largestWin],
    ["Largest loss", money(s.largestLoss, { sign: true }), s.largestLoss],
    ["Max drawdown", money(maxDd), maxDd],
    ["Trades", String(s.totalTrades), null],
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="Analytics" subtitle="Filter to slice every chart below." />
      <Suspense>
        <TradeFilters symbols={listSymbols()} tags={listTags()} />
      </Suspense>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpis.map(([label, value, tone]) => (
          <div key={label} className="card p-4">
            <div className="text-xs font-medium tracking-wide text-muted uppercase">{label}</div>
            <div className={`mt-1.5 font-mono text-lg font-semibold ${tone === null ? "text-ink" : pnlColor(tone)}`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="card p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-semibold text-ink-2">Equity curve · cumulative P&amp;L</h2>
        <EquityChart data={curve} height={320} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5 sm:p-6">
          <h2 className="mb-4 text-sm font-semibold text-ink-2">P&amp;L by symbol</h2>
          <GroupPnlChart data={bySymbol} />
          <div className="mt-4">
            <GroupTable rows={bySymbol} label="Symbol" />
          </div>
        </div>
        <div className="card p-5 sm:p-6">
          <h2 className="mb-4 text-sm font-semibold text-ink-2">Win / loss breakdown</h2>
          <WinLossBar wins={s.wins} losses={s.losses} breakeven={s.breakeven} />
          <div className="mt-6">
            <GroupTable rows={byDirection} label="Direction" />
          </div>
          <div className="mt-6">
            <GroupTable rows={byWeekday} label="Weekday" />
          </div>
        </div>
      </div>

      <div className="card p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-semibold text-ink-2">P&amp;L by entry hour</h2>
        <GroupPnlChart data={byHour} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {byTag.map(({ key, label, rows }) => (
          <div key={key} className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-ink-2">By {label.toLowerCase()}</h2>
            <GroupTable rows={rows} label={label} compact />
          </div>
        ))}
      </div>
    </div>
  );
}

function WinLossBar({ wins, losses, breakeven }: { wins: number; losses: number; breakeven: number }) {
  const total = wins + losses + breakeven;
  if (!total) return <p className="text-sm text-muted">No closed trades</p>;
  const seg = [
    { n: wins, label: "Wins", cls: "bg-profit", text: "text-profit" },
    { n: breakeven, label: "Breakeven", cls: "bg-muted", text: "text-ink-2" },
    { n: losses, label: "Losses", cls: "bg-loss", text: "text-loss" },
  ];
  return (
    <div>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
        {seg.map((x) => x.n > 0 && <div key={x.label} className={x.cls} style={{ flexGrow: x.n }} />)}
      </div>
      <div className="mt-3 flex gap-6 text-sm">
        {seg.map((x) => (
          <div key={x.label}>
            <span className={`font-mono font-semibold ${x.text}`}>{x.n}</span>{" "}
            <span className="text-muted">
              {x.label} ({Math.round((x.n / total) * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
