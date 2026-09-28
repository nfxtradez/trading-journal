import Link from "next/link";
import { Suspense } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Plus, Upload } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import TagChip from "@/components/TagChip";
import TradeFilters from "@/components/TradeFilters";
import { listSymbols, listTags, listTrades, type SortKey } from "@/lib/trades";
import { filtersFromSearchParams } from "@/lib/filters";
import { summarize } from "@/lib/stats";
import { dateTime, duration, money, pct, pnlColor, price } from "@/lib/format";
import { ready } from "@/lib/session";

const COLUMNS: { key: SortKey | null; label: string; align?: "right" }[] = [
  { key: "entry_time", label: "Date" },
  { key: "symbol", label: "Symbol" },
  { key: "direction", label: "Side" },
  { key: "quantity", label: "Qty", align: "right" },
  { key: "entry_price", label: "Entry", align: "right" },
  { key: "exit_price", label: "Exit", align: "right" },
  { key: null, label: "Hold", align: "right" },
  { key: "pnl", label: "P&L", align: "right" },
  { key: null, label: "Tags" },
];

export default async function JournalPage({ searchParams }: PageProps<"/journal">) {
  await ready();
  const sp = await searchParams;
  const filters = filtersFromSearchParams(sp);
  const trades = listTrades(filters);
  const s = summarize(trades);
  const sort = filters.sort ?? "entry_time";
  const dir = filters.dir ?? "desc";

  const sortHref = (key: SortKey) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v) next.set(k, v);
    next.set("sort", key);
    next.set("dir", sort === key && dir === "desc" ? "asc" : "desc");
    return `?${next.toString()}`;
  };

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Journal" subtitle="Every trade you've logged or imported.">
        <Link href="/journal/import" className="btn-ghost">
          <Upload className="size-4" /> Import CSV
        </Link>
        <Link href="/journal/new" className="btn-primary">
          <Plus className="size-4" /> Log trade
        </Link>
      </PageHeader>

      <Suspense>
        <TradeFilters symbols={listSymbols()} tags={listTags()} />
      </Suspense>

      <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 px-1 text-sm text-muted">
        <span>
          <span className="text-ink">{s.totalTrades}</span> trades
        </span>
        <span>
          Net <span className={pnlColor(s.netPnl)}>{money(s.netPnl, { sign: true })}</span>
        </span>
        <span>
          Win rate <span className="text-ink">{pct(s.winRate)}</span>
        </span>
        <span>
          Profit factor <span className="text-ink">{s.profitFactor === null ? "—" : s.profitFactor.toFixed(2)}</span>
        </span>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted uppercase">
              {COLUMNS.map((c) => (
                <th key={c.label} className={`px-4 py-3 font-medium ${c.align === "right" ? "text-right" : ""}`}>
                  {c.key ? (
                    <Link href={sortHref(c.key)} className="inline-flex items-center gap-1 hover:text-ink">
                      {c.label}
                      {sort === c.key ? (
                        dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
                      ) : (
                        <ChevronsUpDown className="size-3 opacity-40" />
                      )}
                    </Link>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => (
              <tr key={t.id} className="group border-b border-line/60 last:border-0 hover:bg-card-2">
                <td className="px-4 py-3 whitespace-nowrap text-ink-2">
                  <Link href={`/journal/${t.id}`} className="hover:text-accent">{dateTime(t.entry_time)}</Link>
                </td>
                <td className="px-4 py-3 font-medium">
                  <Link href={`/journal/${t.id}`} className="hover:text-accent">{t.symbol}</Link>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold uppercase ${t.direction === "long" ? "text-profit" : "text-loss"}`}>
                    {t.direction}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-ink-2">{t.quantity}</td>
                <td className="px-4 py-3 text-right font-mono text-ink-2">{price(t.entry_price)}</td>
                <td className="px-4 py-3 text-right font-mono text-ink-2">{price(t.exit_price)}</td>
                <td className="px-4 py-3 text-right text-muted">{duration(t.entry_time, t.exit_time)}</td>
                <td className={`px-4 py-3 text-right font-mono font-medium ${pnlColor(t.pnl)}`}>
                  {t.pnl === null ? <span className="text-muted">Open</span> : money(t.pnl, { sign: true })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex max-w-64 flex-wrap gap-1">
                    {t.tags.map((g) => (
                      <TagChip key={g.id} tag={g} />
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {trades.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-16 text-center text-muted">
                  No trades match.{" "}
                  <Link href="/journal/new" className="text-accent hover:underline">Log a trade</Link> or{" "}
                  <Link href="/journal/import" className="text-accent hover:underline">import from TradingView</Link>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
