// Futures contract resolution (pure). TradingView sends tickers like "NQ1!", "CME_MINI:NQ1!" or "NQZ2026";
// Tradovate wants a specific contract such as "NQZ6".
import { rootSymbol } from "./instruments";

const MONTH_CODES = "FGHJKMNQUVXZ";
/** Equity index futures roll quarterly (Mar/Jun/Sep/Dec). */
export const QUARTERLY_ROOTS = new Set(["NQ", "MNQ", "ES", "MES", "YM", "MYM", "RTY", "M2K"]);
export const TICK_SIZE: Record<string, number> = { NQ: 0.25, MNQ: 0.25, ES: 0.25, MES: 0.25, YM: 1, MYM: 1, RTY: 0.1, M2K: 0.1 };

function thirdFriday(year: number, month: number): Date {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (5 - first.getUTCDay() + 7) % 7; // days until first Friday
  return new Date(Date.UTC(year, month, 1 + offset + 14));
}

/**
 * Front-month contract for a quarterly index future on `date`. Volume rolls to the next quarter on the
 * second Thursday of the expiry month (8 days before the third-Friday expiration), so switch then.
 */
export function frontMonth(root: string, date = new Date()): string {
  const y = date.getUTCFullYear();
  for (const [yy, m] of [[y, 2], [y, 5], [y, 8], [y, 11], [y + 1, 2]] as const) {
    const roll = thirdFriday(yy, m);
    roll.setUTCDate(roll.getUTCDate() - 8);
    if (date < roll) return `${root}${MONTH_CODES[m]}${yy % 10}`;
  }
  throw new Error("unreachable");
}

/**
 * Resolve an alert ticker to a Tradovate contract name.
 * Explicit months are kept ("NQZ2026" → "NQZ6"); continuous tickers use `overrides[root]` or the front month.
 */
export function resolveContract(ticker: string, overrides: Record<string, string> = {}, date = new Date()): { root: string; contract: string } {
  let s = ticker.trim().toUpperCase();
  if (s.includes(":")) s = s.split(":").pop()!;
  const root = rootSymbol(s);
  const explicit = s.match(new RegExp(`^${root}([${MONTH_CODES}])(\\d{1,4})$`));
  if (explicit) return { root, contract: `${root}${explicit[1]}${Number(explicit[2]) % 10}` };
  if (overrides[root]) return { root, contract: overrides[root].toUpperCase() };
  if (!QUARTERLY_ROOTS.has(root)) throw new Error(`Can't pick a front month for ${root}; add a contract override in Auto Trading settings.`);
  return { root, contract: frontMonth(root, date) };
}

export function roundToTick(root: string, price: number): number {
  const t = TICK_SIZE[root] ?? 0.01;
  return Math.round(Math.round(price / t) * t * 1e6) / 1e6;
}
