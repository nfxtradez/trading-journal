import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export const DATA_DIR = process.env.JOURNAL_DATA_DIR
  ? path.resolve(process.env.JOURNAL_DATA_DIR)
  : path.join(process.cwd(), "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

const SCHEMA = fs.readFileSync(path.join(process.cwd(), "src/lib/schema.sql"), "utf8");

const DEFAULT_TAGS: Array<[string, "setup" | "mistake" | "strategy"]> = [
  ["Opening Range Breakout", "setup"],
  ["VWAP Reclaim", "setup"],
  ["Pullback", "setup"],
  ["Reversal", "setup"],
  ["FOMO Entry", "mistake"],
  ["Moved Stop", "mistake"],
  ["Oversized", "mistake"],
  ["Early Exit", "mistake"],
  ["Revenge Trade", "mistake"],
  ["Trend Following", "strategy"],
  ["Mean Reversion", "strategy"],
  ["Scalp", "strategy"],
];

function open(): Database.Database {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const db = new Database(path.join(DATA_DIR, "journal.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);

  const hasTags = db.prepare("SELECT COUNT(*) AS n FROM tags").get() as { n: number };
  if (hasTags.n === 0) {
    const insert = db.prepare("INSERT INTO tags (name, category) VALUES (?, ?)");
    db.transaction(() => DEFAULT_TAGS.forEach(([n, c]) => insert.run(n, c)))();
  }
  return db;
}

// Reuse one connection across hot reloads in dev.
const g = globalThis as unknown as { __journalDb?: Database.Database };
export const db = g.__journalDb ?? (g.__journalDb = open());

/** Absolute path of an uploaded screenshot. */
export function uploadPath(filename: string): string {
  return path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, path.basename(filename));
}
