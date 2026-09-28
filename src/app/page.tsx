import Link from "next/link";
import { BarChart3, BookOpen, Plus, Settings, Wallet } from "lucide-react";
import Greeting from "@/components/Greeting";
import StatCard from "@/components/StatCard";
import Ring from "@/components/Ring";
import PnlCalendar from "@/components/PnlCalendar";
import TagChip from "@/components/TagChip";
import { EquityChart } from "@/components/Charts";
import { getSettings, listTrades } from "@/lib/trades";
import { dailyStats, equityCurve, summarize } from "@/lib/stats";
import { dateTime, money, pct, pnlColor } from "@/lib/format";

const QUICK = [
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Dashboard() {
  const trades = listTrades();
  const { startingBalance } = getSettings();
  const s = summarize(trades);
  const balance = startingBalance + s.netPnl;
  const returnPct = startingBalance ? (s.netPnl / startingBalance) * 100 : 0;
  const curve = equityCurve(trades);
  const days = Object.fromEntries(dailyStats(trades));
  const recent = trades.slice(0, 6);
  const avgRatio = s.avgLoss ? s.avgWin / s.avgLoss : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Greeting />
        <div className="flex flex-wrap gap-2">
          {QUICK.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="btn-ghost">
              <Icon className="size-4" /> {label}
            </Link>
          ))}
          <Link href="/journal/new" className="btn-primary">
            <Plus className="size-4" /> Log trade
          </Link>
        </div>
      </div>

      {/* Account */}
      <div className="card grid gap-6 bg-gradient-to-br from-accent/15 via-card to-card p-6 sm:grid-cols-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted uppercase">
            <Wallet className="size-4 text-accent" /> Account balance
          </div>
          <div className="mt-2 font-mono text-3xl font-semibold">{money(balance)}</div>
          <div className="mt-1 text-xs text-muted">Starting {money(startingBalance, { cents: false })}</div>
        </div>
        <div>
          <div className="text-xs font-medium tracking-wide text-muted uppercase">Net P&amp;L</div>
          <div className={`mt-2 font-mono text-3xl font-semibold ${pnlColor(s.netPnl)}`}>{money(s.netPnl, { sign: true })}</div>
          <div className="mt-1 text-xs text-muted">
            {money(s.grossProfit)} won · {money(-s.grossLoss)} lost
          </div>
        </div>
        <div>
          <div className="text-xs font-medium tracking-wide text-muted uppercase">Return</div>
          <div className={`mt-2 font-mono text-3xl font-semibold ${pnlColor(returnPct)}`}>
            {returnPct > 0 ? "+" : ""}
            {pct(returnPct, 2)}
          </div>
          <div className="mt-1 text-xs text-muted">on starting balance</div>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="card flex flex-col p-5 sm:col-span-2 lg:col-span-1 lg:row-span-1">
          <span className="text-xs font-medium tracking-wide text-muted uppercase">Total P&amp;L</span>
          <span className={`mt-2 font-mono text-2xl font-semibold ${pnlColor(s.netPnl)}`}>{money(s.netPnl, { sign: true })}</span>
          <div className="mt-2 -mx-1">
            <EquityChart data={curve} mini height={56} />
          </div>
        </div>
        <StatCard
          label="Profit factor"
          value={s.profitFactor === null ? (s.grossProfit > 0 ? "∞" : "—") : s.profitFactor.toFixed(2)}
          tone={s.profitFactor === null ? null : s.profitFactor >= 1 ? "profit" : "loss"}
          sub="Gross profit ÷ gross loss"
        />
        <div className="card flex items-center justify-between gap-3 p-5">
          <div className="flex flex-col">
            <span className="text-xs font-medium tracking-wide text-muted uppercase">Win rate</span>
            <span className="mt-2 font-mono text-2xl font-semibold">{pct(s.winRate)}</span>
            <span className="mt-1 text-xs text-muted">
              <span className="text-profit">{s.wins}W</span> · <span className="text-loss">{s.losses}L</span>
              {s.breakeven > 0 && ` · ${s.breakeven}BE`}
            </span>
          </div>
          <Ring value={s.winRate} />
        </div>
        <StatCard label="Total trades" value={s.totalTrades} sub={`${Object.keys(days).length} trading days`} />
        <div className="card flex flex-col p-5">
          <span className="text-xs font-medium tracking-wide text-muted uppercase">Avg win / loss</span>
          <span className="mt-2 font-mono text-lg font-semibold">
            <span className="text-profit">{money(s.avgWin, { cents: false })}</span>
            <span className="text-muted"> / </span>
            <span className="text-loss">{money(-s.avgLoss, { cents: false })}</span>
          </span>
          <span className="mt-1 text-xs text-muted">Ratio {avgRatio === null ? "—" : avgRatio.toFixed(2)}</span>
          {s.avgWin + s.avgLoss > 0 && (
            <div className="mt-3 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
              <div className="bg-profit" style={{ flexGrow: s.avgWin }} />
              <div className="bg-loss" style={{ flexGrow: s.avgLoss }} />
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="card min-w-0 p-5 lg:col-span-3">
          <PnlCalendar days={days} variant="compact" />
        </div>
        <div className="card min-w-0 p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-2">Recent trades</h2>
            <Link href="/journal" className="text-xs text-accent hover:underline">View all</Link>
          </div>
          {recent.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted">
              No trades yet.{" "}
              <Link href="/journal/new" className="text-accent hover:underline">Log your first trade</Link>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((t) => (
                <li key={t.id}>
                  <Link href={`/journal/${t.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:opacity-80">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{t.symbol}</span>
                        <span className={`text-[11px] font-semibold uppercase ${t.direction === "long" ? "text-profit" : "text-loss"}`}>
                          {t.direction}
                        </span>
                        <span className="text-xs text-muted">×{t.quantity}</span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted">
                        {dateTime(t.entry_time)}
                        {t.tags.slice(0, 2).map((g) => (
                          <TagChip key={g.id} tag={g} />
                        ))}
                      </div>
                    </div>
                    <span className={`font-mono text-sm font-medium ${pnlColor(t.pnl)}`}>
                      {t.pnl === null ? "Open" : money(t.pnl, { sign: true })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

