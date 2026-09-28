export type Direction = "long" | "short";
export type TagCategory = "setup" | "mistake" | "strategy";

export const TAG_CATEGORIES: { key: TagCategory; label: string }[] = [
  { key: "setup", label: "Setup" },
  { key: "mistake", label: "Mistakes" },
  { key: "strategy", label: "Strategy" },
];

export interface Tag {
  id: number;
  name: string;
  category: TagCategory;
}

export interface Trade {
  id: number;
  symbol: string;
  raw_symbol: string | null;
  direction: Direction;
  entry_price: number;
  exit_price: number | null;
  quantity: number;
  entry_time: string;
  exit_time: string | null;
  stop_loss: number | null;
  take_profit: number | null;
  fees: number;
  pnl: number | null;
  notes: string | null;
  rating: number | null;
  source: string;
  external_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TradeWithTags extends Trade {
  tags: Tag[];
  screenshots: { id: number; filename: string }[];
}
