"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { money, moneyShort } from "@/lib/format";
import type { DayStat } from "@/lib/stats";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const pad = (n: number) => String(n).padStart(2, "0");
const key = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

export default function PnlCalendar({
  days,
  variant = "full",
}: {
  days: Record<string, DayStat>;
  variant?: "compact" | "full";
}) {
  const today = new Date();
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const compact = variant === "compact";

  const first = new Date(cursor.y, cursor.m, 1);
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(first.getDay()).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  const monthStats = Object.values(days).filter((d) => d.date.startsWith(`${cursor.y}-${pad(cursor.m + 1)}`));
  const monthPnl = monthStats.reduce((a, d) => a + d.pnl, 0);
  const monthTrades = monthStats.reduce((a, d) => a + d.trades, 0);
  const todayKey = key(today.getFullYear(), today.getMonth(), today.getDate());

  const shift = (delta: number) =>
    setCursor(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => shift(-1)} className="rounded-md p-1.5 text-muted hover:bg-card-2 hover:text-ink" aria-label="Previous month">
            <ChevronLeft className="size-4" />
          </button>
          <span className={`min-w-32 text-center font-semibold ${compact ? "text-sm" : "text-base"}`}>
            {first.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </span>
          <button onClick={() => shift(1)} className="rounded-md p-1.5 text-muted hover:bg-card-2 hover:text-ink" aria-label="Next month">
            <ChevronRight className="size-4" />
          </button>
          <button
            onClick={() => setCursor({ y: today.getFullYear(), m: today.getMonth() })}
            className="ml-1 rounded-md border border-line px-2 py-0.5 text-xs text-muted hover:text-ink"
          >
            Today
          </button>
        </div>
        <div className="text-right text-sm">
          <span className="text-muted">Month: </span>
          <span className={`font-mono font-medium ${monthPnl > 0 ? "text-profit" : monthPnl < 0 ? "text-loss" : "text-ink-2"}`}>
            {money(monthPnl, { sign: true })}
          </span>
          {!compact && <span className="ml-3 text-muted">{monthTrades} trade{monthTrades === 1 ? "" : "s"}</span>}
        </div>
      </div>

      <div className={`grid gap-1.5 ${compact ? "grid-cols-7" : "grid-cols-7 lg:grid-cols-8"}`}>
        {WEEKDAYS.map((d) => (
          <div key={d} className="pb-1 text-center text-[11px] font-medium text-muted uppercase">
            {compact ? d[0] : d}
          </div>
        ))}
        {!compact && <div className="hidden pb-1 text-center text-[11px] font-medium text-muted uppercase lg:block">Week</div>}

        {weeks.map((week, wi) => {
          const weekStats = week
            .map((d) => (d ? days[key(cursor.y, cursor.m, d)] : undefined))
            .filter(Boolean) as DayStat[];
          const weekPnl = weekStats.reduce((a, s) => a + s.pnl, 0);
          return [
            ...week.map((d, di) => {
              if (!d) return <div key={`${wi}-${di}`} />;
              const k = key(cursor.y, cursor.m, d);
              const s = days[k];
              const tone = !s ? "" : s.pnl > 0 ? "border-profit/40 bg-profit/15" : s.pnl < 0 ? "border-loss/40 bg-loss/15" : "border-line bg-card-2";
              const body = (
                <div
                  className={`flex h-full flex-col rounded-lg border p-1.5 transition ${
                    tone || "border-line/60 bg-bg/40"
                  } ${compact ? "min-h-12" : "min-h-20 sm:min-h-24 sm:p-2"} ${k === todayKey ? "ring-1 ring-accent" : ""} ${
                    s ? "hover:brightness-125" : ""
                  }`}
                  title={s ? `${k}: ${money(s.pnl, { sign: true })} · ${s.trades} trade(s)` : k}
                >
                  <span className={`text-[11px] ${k === todayKey ? "font-semibold text-accent" : "text-muted"}`}>{d}</span>
                  {s && (
                    <div className="mt-auto text-right">
                      <div className={`font-mono font-semibold ${compact ? "text-[10px] sm:text-[11px]" : "text-xs sm:text-sm"} ${s.pnl > 0 ? "text-profit" : s.pnl < 0 ? "text-loss" : "text-ink-2"}`}>
                        {moneyShort(s.pnl)}
                      </div>
                      {!compact && (
                        <div className="hidden text-[11px] text-muted sm:block">
                          {s.trades} trade{s.trades === 1 ? "" : "s"} · {Math.round((s.wins / s.trades) * 100)}%
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
              return s ? (
                <Link key={k} href={`/journal?from=${k}&to=${k}`}>
                  {body}
                </Link>
              ) : (
                <div key={k}>{body}</div>
              );
            }),
            !compact && (
              <div
                key={`w${wi}`}
                className="hidden flex-col justify-center rounded-lg border border-line bg-card-2 p-2 text-right lg:flex"
              >
                <span className="text-[11px] text-muted">Week {wi + 1}</span>
                <span className={`font-mono text-sm font-semibold ${weekPnl > 0 ? "text-profit" : weekPnl < 0 ? "text-loss" : "text-ink-2"}`}>
                  {weekStats.length ? moneyShort(weekPnl) : "—"}
                </span>
                <span className="text-[11px] text-muted">{weekStats.length} day{weekStats.length === 1 ? "" : "s"}</span>
              </div>
            ),
          ];
        })}
      </div>
    </div>
  );
}
