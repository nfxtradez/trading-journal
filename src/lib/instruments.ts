// Futures contract specs used to compute P&L from prices.
export const POINT_VALUES: Record<string, number> = {
  NQ: 20,
  MNQ: 2,
  ES: 50,
  MES: 5,
  YM: 5,
  MYM: 0.5,
  RTY: 50,
  M2K: 5,
  CL: 1000,
  MCL: 100,
  GC: 100,
  MGC: 10,
};

const MONTH_CODES = "FGHJKMNQUVXZ";

/**
 * Normalize a TradingView / broker symbol to its root.
 *   "CME_MINI:NQ1!" -> "NQ", "NQZ2025" -> "NQ", "MESH5" -> "MES", "es" -> "ES"
 */
export function rootSymbol(raw: string): string {
  let s = raw.trim().toUpperCase();
  if (s.includes(":")) s = s.split(":").pop()!;
  s = s.replace(/\d+!$/, ""); // continuous contract: NQ1!
  const m = s.match(new RegExp(`^([A-Z0-9]+?)[${MONTH_CODES}](\\d{1,4})$`));
  if (m && POINT_VALUES[m[1]] !== undefined) return m[1];
  return s;
}

export function pointValue(symbol: string): number {
  return POINT_VALUES[rootSymbol(symbol)] ?? 1;
}

/** Net P&L in dollars for a round-trip. */
export function computePnl(t: {
  symbol: string;
  direction: "long" | "short";
  entry_price: number;
  exit_price: number;
  quantity: number;
  fees?: number | null;
}): number {
  const sign = t.direction === "long" ? 1 : -1;
  const gross = (t.exit_price - t.entry_price) * sign * t.quantity * pointValue(t.symbol);
  return round2(gross - (t.fees ?? 0));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
