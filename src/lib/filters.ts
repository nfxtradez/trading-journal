import { SORT_KEYS, type SortKey, type TradeFilters } from "./trades";

type SP = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export function filtersFromSearchParams(sp: SP): TradeFilters {
  const outcome = one(sp.outcome);
  const direction = one(sp.direction);
  const sort = one(sp.sort);
  return {
    symbol: one(sp.symbol),
    from: one(sp.from),
    to: one(sp.to),
    outcome: outcome === "win" || outcome === "loss" || outcome === "breakeven" ? outcome : undefined,
    direction: direction === "long" || direction === "short" ? direction : undefined,
    tag: one(sp.tag) ? Number(one(sp.tag)) : undefined,
    sort: SORT_KEYS.includes(sort as SortKey) ? (sort as SortKey) : undefined,
    dir: one(sp.dir) === "asc" ? "asc" : undefined,
  };
}
