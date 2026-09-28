import "server-only";
import { db } from "./db";
import type { Tag, TagCategory, Trade, TradeWithTags } from "./types";

export interface TradeFilters {
  symbol?: string;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  outcome?: "win" | "loss" | "breakeven";
  direction?: "long" | "short";
  tag?: number;
  sort?: SortKey;
  dir?: "asc" | "desc";
}

export const SORT_KEYS = ["entry_time", "symbol", "direction", "quantity", "pnl", "entry_price", "exit_price"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export type TradeInput = Omit<Trade, "id" | "created_at" | "updated_at">;

const TRADE_COLUMNS = [
  "symbol", "raw_symbol", "direction", "entry_price", "exit_price", "quantity", "entry_time",
  "exit_time", "stop_loss", "take_profit", "fees", "pnl", "notes", "rating", "source", "external_id",
] as const;

export function listTrades(f: TradeFilters = {}): TradeWithTags[] {
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (f.symbol) {
    where.push("t.symbol = @symbol");
    params.symbol = f.symbol.toUpperCase();
  }
  if (f.from) {
    where.push("substr(t.entry_time, 1, 10) >= @from");
    params.from = f.from;
  }
  if (f.to) {
    where.push("substr(t.entry_time, 1, 10) <= @to");
    params.to = f.to;
  }
  if (f.outcome === "win") where.push("t.pnl > 0");
  if (f.outcome === "loss") where.push("t.pnl < 0");
  if (f.outcome === "breakeven") where.push("t.pnl = 0");
  if (f.direction) {
    where.push("t.direction = @direction");
    params.direction = f.direction;
  }
  if (f.tag) {
    where.push("EXISTS (SELECT 1 FROM trade_tags tt WHERE tt.trade_id = t.id AND tt.tag_id = @tag)");
    params.tag = f.tag;
  }
  const sort = f.sort && SORT_KEYS.includes(f.sort) ? f.sort : "entry_time";
  const dir = f.dir === "asc" ? "ASC" : "DESC";
  const sql = `SELECT t.* FROM trades t ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY t.${sort} ${dir} NULLS LAST, t.id ${dir}`;
  const trades = db.prepare(sql).all(params) as Trade[];
  return attachRelations(trades);
}

function attachRelations(trades: Trade[]): TradeWithTags[] {
  if (trades.length === 0) return [];
  const tagRows = db
    .prepare(
      `SELECT tt.trade_id, g.id, g.name, g.category FROM trade_tags tt
       JOIN tags g ON g.id = tt.tag_id ORDER BY g.category, g.name`,
    )
    .all() as (Tag & { trade_id: number })[];
  const shotRows = db.prepare("SELECT id, trade_id, filename FROM screenshots ORDER BY id").all() as {
    id: number;
    trade_id: number;
    filename: string;
  }[];
  const tagsBy = new Map<number, Tag[]>();
  for (const { trade_id, ...tag } of tagRows) {
    (tagsBy.get(trade_id) ?? tagsBy.set(trade_id, []).get(trade_id)!).push(tag);
  }
  const shotsBy = new Map<number, { id: number; filename: string }[]>();
  for (const { trade_id, ...s } of shotRows) {
    (shotsBy.get(trade_id) ?? shotsBy.set(trade_id, []).get(trade_id)!).push(s);
  }
  return trades.map((t) => ({ ...t, tags: tagsBy.get(t.id) ?? [], screenshots: shotsBy.get(t.id) ?? [] }));
}

export function getTrade(id: number): TradeWithTags | null {
  const t = db.prepare("SELECT * FROM trades WHERE id = ?").get(id) as Trade | undefined;
  return t ? attachRelations([t])[0] : null;
}

export function listSymbols(): string[] {
  return (db.prepare("SELECT DISTINCT symbol FROM trades ORDER BY symbol").all() as { symbol: string }[]).map(
    (r) => r.symbol,
  );
}

export function insertTrade(input: TradeInput): number {
  const cols = TRADE_COLUMNS.join(", ");
  const vals = TRADE_COLUMNS.map((c) => "@" + c).join(", ");
  const res = db.prepare(`INSERT INTO trades (${cols}) VALUES (${vals})`).run(input);
  return Number(res.lastInsertRowid);
}

/** Insert unless a trade with the same external_id exists. Returns new id or null if skipped. */
export function insertTradeIfNew(input: TradeInput): number | null {
  const cols = TRADE_COLUMNS.join(", ");
  const vals = TRADE_COLUMNS.map((c) => "@" + c).join(", ");
  const res = db.prepare(`INSERT OR IGNORE INTO trades (${cols}) VALUES (${vals})`).run(input);
  return res.changes ? Number(res.lastInsertRowid) : null;
}

export function updateTrade(id: number, input: Omit<TradeInput, "source" | "external_id" | "raw_symbol">) {
  const editable = TRADE_COLUMNS.filter((c) => !["source", "external_id", "raw_symbol"].includes(c));
  const set = editable.map((c) => `${c} = @${c}`).join(", ");
  db.prepare(`UPDATE trades SET ${set}, updated_at = datetime('now') WHERE id = @id`).run({ ...input, id });
}

export function deleteTrade(id: number): string[] {
  const files = (db.prepare("SELECT filename FROM screenshots WHERE trade_id = ?").all(id) as { filename: string }[]).map(
    (r) => r.filename,
  );
  db.prepare("DELETE FROM trades WHERE id = ?").run(id);
  return files;
}

export function setTradeTags(tradeId: number, tagIds: number[]) {
  db.transaction(() => {
    db.prepare("DELETE FROM trade_tags WHERE trade_id = ?").run(tradeId);
    const ins = db.prepare("INSERT OR IGNORE INTO trade_tags (trade_id, tag_id) VALUES (?, ?)");
    for (const tagId of tagIds) ins.run(tradeId, tagId);
  })();
}

export function addScreenshot(tradeId: number, filename: string) {
  db.prepare("INSERT INTO screenshots (trade_id, filename) VALUES (?, ?)").run(tradeId, filename);
}

export function removeScreenshot(id: number): string | null {
  const row = db.prepare("SELECT filename FROM screenshots WHERE id = ?").get(id) as { filename: string } | undefined;
  if (!row) return null;
  db.prepare("DELETE FROM screenshots WHERE id = ?").run(id);
  return row.filename;
}

// ---- tags ----

export function listTags(): Tag[] {
  return db.prepare("SELECT id, name, category FROM tags ORDER BY category, name COLLATE NOCASE").all() as Tag[];
}

export function tagUsage(): Map<number, number> {
  const rows = db.prepare("SELECT tag_id, COUNT(*) AS n FROM trade_tags GROUP BY tag_id").all() as {
    tag_id: number;
    n: number;
  }[];
  return new Map(rows.map((r) => [r.tag_id, r.n]));
}

export function ensureTag(name: string, category: TagCategory): number {
  db.prepare("INSERT OR IGNORE INTO tags (name, category) VALUES (?, ?)").run(name, category);
  return (db.prepare("SELECT id FROM tags WHERE name = ? AND category = ?").get(name, category) as { id: number }).id;
}

export function deleteTag(id: number) {
  db.prepare("DELETE FROM tags WHERE id = ?").run(id);
}

export function renameTag(id: number, name: string) {
  db.prepare("UPDATE tags SET name = ? WHERE id = ?").run(name, id);
}

// ---- settings ----

export interface Settings {
  startingBalance: number;
}

export function getSettings(): Settings {
  const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const m = new Map(rows.map((r) => [r.key, r.value]));
  return {
    startingBalance: Number(m.get("startingBalance") ?? 50000),
  };
}

export function saveSetting(key: keyof Settings, value: string) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(
    key,
    value,
  );
}
