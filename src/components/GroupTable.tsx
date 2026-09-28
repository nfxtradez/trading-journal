import { money, pct, pnlColor } from "@/lib/format";
import type { GroupStat } from "@/lib/stats";

export default function GroupTable({ rows, label, compact = false }: { rows: GroupStat[]; label: string; compact?: boolean }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted">No data</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm whitespace-nowrap">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted uppercase">
            <th className="py-2 pr-2 font-medium">{label}</th>
            <th className="px-2 py-2 text-right font-medium">Trades</th>
            {!compact && <th className="px-2 py-2 text-right font-medium">W / L</th>}
            <th className="px-2 py-2 font-medium">Win rate</th>
            {!compact && <th className="px-2 py-2 text-right font-medium">Avg</th>}
            <th className="py-2 pl-2 text-right font-medium">Net P&amp;L</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-line/60 last:border-0">
              <td className={`truncate py-2.5 pr-2 font-medium ${compact ? "max-w-28" : "max-w-40"}`} title={r.key}>{r.key}</td>
              <td className="px-2 py-2.5 text-right text-ink-2">{r.trades}</td>
              {!compact && (
                <td className="px-2 py-2.5 text-right">
                  <span className="text-profit">{r.wins}</span>
                  <span className="text-muted"> / </span>
                  <span className="text-loss">{r.losses}</span>
                </td>
              )}
              <td className="px-2 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-loss/30 2xl:block">
                    <div className="h-full rounded-full bg-profit" style={{ width: `${r.winRate}%` }} />
                  </div>
                  <span className="text-xs text-ink-2">{pct(r.winRate, 0)}</span>
                </div>
              </td>
              {!compact && (
                <td className={`px-2 py-2.5 text-right font-mono ${pnlColor(r.avgPnl)}`}>{money(r.avgPnl, { sign: true })}</td>
              )}
              <td className={`py-2.5 pl-2 text-right font-mono font-medium ${pnlColor(r.netPnl)}`}>{money(r.netPnl, { sign: true })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
