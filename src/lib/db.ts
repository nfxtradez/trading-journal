import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { getStore } from "@netlify/blobs";
import { SCHEMA } from "./schema";

/**
 * Storage backends:
 *  - "local" (default): SQLite file at ./data/journal.db, screenshots in ./data/uploads.
 *  - "blobs" (Netlify): the SQLite database is kept as a single blob in Netlify Blobs. Each request
 *    loads it into memory (re-downloading only when it changed), and every mutation writes it back.
 *    Screenshots are stored as individual blobs.
 * JOURNAL_STORAGE is inlined at build time (see next.config.ts) and is "blobs" for Netlify builds.
 */
export const REMOTE = process.env.JOURNAL_STORAGE === "blobs";

export const DATA_DIR = process.env.JOURNAL_DATA_DIR
  ? path.resolve(process.env.JOURNAL_DATA_DIR)
  : path.join(process.cwd(), "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

const DB_KEY = "journal.db";

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

function init(db: Database.Database): Database.Database {
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  const hasTags = db.prepare("SELECT COUNT(*) AS n FROM tags").get() as { n: number };
  if (hasTags.n === 0) {
    const insert = db.prepare("INSERT INTO tags (name, category) VALUES (?, ?)");
    db.transaction(() => DEFAULT_TAGS.forEach(([n, c]) => insert.run(n, c)))();
  }
  return db;
}

// Survive dev hot reloads / warm serverless invocations.
const g = globalThis as unknown as { __journal?: { db: Database.Database; etag?: string; exists?: boolean } };

export function blobStore(name: "tradelog" | "tradelog-uploads") {
  return getStore({ name, consistency: "strong" });
}

/** Open (or refresh) the database. Call once at the start of every page, action and route. */
export async function loadDb(): Promise<Database.Database> {
  if (!REMOTE) {
    if (!g.__journal) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      const db = new Database(path.join(DATA_DIR, "journal.db"));
      db.pragma("journal_mode = WAL");
      g.__journal = { db: init(db) };
    }
    return g.__journal.db;
  }

  const store = blobStore("tradelog");
  const meta = await store.getMetadata(DB_KEY);
  if (g.__journal && meta?.etag && meta.etag === g.__journal.etag) return g.__journal.db;

  const found = meta ? await store.getWithMetadata(DB_KEY, { type: "arrayBuffer" }) : null;
  g.__journal?.db.close();
  const db = found ? new Database(Buffer.from(found.data)) : new Database(":memory:");
  g.__journal = { db: init(db), etag: found?.etag, exists: !!found };
  return db;
}

/** The loaded database. Throws if loadDb() wasn't awaited first. */
export function db(): Database.Database {
  if (!g.__journal) throw new Error("Database not loaded — call `await loadDb()` first.");
  return g.__journal.db;
}

/** Persist changes. No-op locally (SQLite writes straight to disk); uploads the database on Netlify. */
export async function saveDb(): Promise<void> {
  if (!REMOTE || !g.__journal) return;
  const cur = g.__journal;
  const res = await blobStore("tradelog").set(
    DB_KEY,
    toArrayBuffer(cur.db.serialize()),
    // Optimistic concurrency: only overwrite the version we loaded. (If the store didn't report an
    // ETag for an existing blob, fall back to a plain overwrite.)
    cur.etag ? { onlyIfMatch: cur.etag } : cur.exists ? {} : { onlyIfNew: true },
  );
  if (!res.modified) {
    // Someone else (another device/tab) saved in between. Drop our copy so the next load is fresh.
    cur.db.close();
    g.__journal = undefined;
    throw new Error("Your journal was changed from another device at the same time. Reload and try again.");
  }
  cur.etag = res.etag;
  cur.exists = true;
}

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}
