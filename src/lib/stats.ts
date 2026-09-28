// Pure statistics helpers — safe to use on server or client.
import type { Trade } from "./types";

type T = Pick<Trade, "pnl" | "symbol" | "entry_time" | "exit_time" | "direction">;

export interface Summary {
  totalTrades: number;
  wins: number;
  losses: number;
  breakeven: number;
  netPnl: number;
  grossProfit: number;
  grossLoss: number; // positive number
  winRate: number; // 0..100 over all closed trades
  profitFactor: number | null; // null when there are no losses
  avgWin: number;
  avgLoss: number; // positive number
  largestWin: number;
  largestLoss: number;
  expectancy: number;
}

export function closed<X extends T>(trades: X[]): X[] {
  return trades.filter((t) => t.pnl !== null && t.pnl !== undefined);
}

export function summarize(trades: T[]): Summary {
  const c = closed(trades);
  const wins = c.filter((t) => t.pnl! > 0);
  const losses = c.filter((t) => t.pnl! < 0);
  const grossProfit = wins.reduce((a, t) => a + t.pnl!, 0);
  const grossLoss = -losses.reduce((a, t) => a + t.pnl!, 0);
  const netPnl = grossProfit - grossLoss;
  return {
    totalTrades: c.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: c.length - wins.length - losses.length,
    netPnl,
    grossProfit,
    grossLoss,
    winRate: c.length ? (wins.length / c.length) * 100 : 0,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
    avgWin: wins.length ? grossProfit / wins.length : 0,
    avgLoss: losses.length ? grossLoss / losses.length : 0,
    largestWin: wins.length ? Math.max(...wins.map((t) => t.pnl!)) : 0,
    largestLoss: losses.length ? Math.min(...losses.map((t) => t.pnl!)) : 0,
    expectancy: c.length ? netPnl / c.length : 0,
  };
}

/** Trading day for a trade: the date it was closed (falls back to entry). */
export function tradeDay(t: Pick<Trade, "entry_time" | "exit_time">): string {
  return (t.exit_time ?? t.entry_time).slice(0, 10);
}

export interface DayStat {
  date: string;
  pnl: number;
  trades: number;
  wins: number;
}

export function dailyStats(trades: T[]): Map<string, DayStat> {
  const m = new Map<string, DayStat>();
  for (const t of closed(trades)) {
    const d = tradeDay(t);
    const cur = m.get(d) ?? { date: d, pnl: 0, trades: 0, wins: 0 };
    cur.pnl += t.pnl!;
    cur.trades += 1;
    if (t.pnl! > 0) cur.wins += 1;
    m.set(d, cur);
  }
  return m;
}

/** Cumulative P&L per trading day, oldest first. */
export function equityCurve(trades: T[], startingBalance = 0): { date: string; pnl: number; cumulative: number; balance: number }[] {
  const days = [...dailyStats(trades).values()].sort((a, b) => a.date.localeCompare(b.date));
  let cum = 0;
  return days.map((d) => {
    cum += d.pnl;
    return { date: d.date, pnl: round(d.pnl), cumulative: round(cum), balance: round(startingBalance + cum) };
  });
}

export interface GroupStat {
  key: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  netPnl: number;
  avgPnl: number;
}

export function groupBy<X extends T>(trades: X[], keyOf: (t: X) => string | string[]): GroupStat[] {
  const m = new Map<string, X[]>();
  for (const t of closed(trades)) {
    const keys = keyOf(t);
    for (const k of Array.isArray(keys) ? keys : [keys]) {
      (m.get(k) ?? m.set(k, []).get(k)!).push(t);
    }
  }
  return [...m.entries()]
    .map(([key, list]) => {
      const s = summarize(list);
      return {
        key,
        trades: s.totalTrades,
        wins: s.wins,
        losses: s.losses,
        winRate: s.winRate,
        netPnl: round(s.netPnl),
        avgPnl: round(s.expectancy),
      };
    })
    .sort((a, b) => b.netPnl - a.netPnl);
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
