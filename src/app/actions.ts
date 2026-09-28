"use server";

import fs from "node:fs/promises";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, uploadPath } from "@/lib/db";
import { computePnl, rootSymbol } from "@/lib/instruments";
import * as repo from "@/lib/trades";
import { parseTradingViewCsv, num } from "@/lib/tradingview";
import { TAG_CATEGORIES, type Direction, type TagCategory } from "@/lib/types";

export interface FormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

const IMAGE_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function revalidateAll() {
  revalidatePath("/", "layout");
}

function parseTradeForm(fd: FormData) {
  const fieldErrors: Record<string, string> = {};
  const rawSymbol = str(fd, "symbol").toUpperCase();
  const direction = str(fd, "direction") as Direction;
  const entry_price = num(str(fd, "entry_price"));
  const exit_price = num(str(fd, "exit_price"));
  const quantity = num(str(fd, "quantity")) ?? 1;
  const entry_time = str(fd, "entry_time");
  const exit_time = str(fd, "exit_time") || null;
  const fees = num(str(fd, "fees")) ?? 0;
  let pnl = num(str(fd, "pnl"));
  const ratingRaw = num(str(fd, "rating"));

  if (!rawSymbol) fieldErrors.symbol = "Symbol is required";
  if (direction !== "long" && direction !== "short") fieldErrors.direction = "Pick long or short";
  if (entry_price === null) fieldErrors.entry_price = "Entry price is required";
  if (quantity <= 0) fieldErrors.quantity = "Must be greater than 0";
  if (!entry_time) fieldErrors.entry_time = "Entry time is required";
  if (exit_time && entry_time && exit_time < entry_time) fieldErrors.exit_time = "Exit is before entry";

  const symbol = rawSymbol ? rootSymbol(rawSymbol) : "";
  if (pnl === null && exit_price !== null && entry_price !== null && !fieldErrors.direction) {
    pnl = computePnl({ symbol, direction, entry_price, exit_price, quantity, fees });
  }

  return {
    fieldErrors,
    trade: {
      symbol,
      direction,
      entry_price: entry_price ?? 0,
      exit_price,
      quantity,
      entry_time,
      exit_time,
      stop_loss: num(str(fd, "stop_loss")),
      take_profit: num(str(fd, "take_profit")),
      fees,
      pnl,
      notes: str(fd, "notes") || null,
      rating: ratingRaw && ratingRaw >= 1 && ratingRaw <= 5 ? Math.round(ratingRaw) : null,
      raw_symbol: rawSymbol,
    },
  };
}

/** Selected tag ids + comma-separated new tag names per category. */
function collectTagIds(fd: FormData): number[] {
  const ids = new Set(fd.getAll("tag_ids").map(Number).filter(Boolean));
  for (const { key } of TAG_CATEGORIES) {
    for (const name of str(fd, `new_tags_${key}`).split(",")) {
      const n = name.trim();
      if (n) ids.add(repo.ensureTag(n.slice(0, 60), key));
    }
  }
  return [...ids];
}

async function saveScreenshots(fd: FormData, tradeId: number): Promise<string | null> {
  const files = fd.getAll("screenshots").filter((f): f is File => f instanceof File && f.size > 0);
  for (const file of files) {
    const ext = IMAGE_EXT[file.type];
    if (!ext) return `"${file.name}" is not a supported image (PNG, JPG, GIF, WebP).`;
    if (file.size > 10 * 1024 * 1024) return `"${file.name}" is larger than 10MB.`;
    const filename = `${crypto.randomUUID()}${ext}`;
    await fs.writeFile(uploadPath(filename), Buffer.from(await file.arrayBuffer()));
    repo.addScreenshot(tradeId, filename);
  }
  return null;
}

export async function createTrade(_prev: FormState, fd: FormData): Promise<FormState> {
  const { fieldErrors, trade } = parseTradeForm(fd);
  if (Object.keys(fieldErrors).length) return { error: "Please fix the highlighted fields.", fieldErrors };

  const id = db.transaction(() => {
    const newId = repo.insertTrade({ ...trade, source: "manual", external_id: null });
    repo.setTradeTags(newId, collectTagIds(fd));
    return newId;
  })();
  const shotError = await saveScreenshots(fd, id);
  revalidateAll();
  if (shotError) return { error: `Trade saved, but a screenshot failed: ${shotError}` };
  redirect(str(fd, "after") === "new" ? "/journal/new?saved=1" : `/journal/${id}`);
}

export async function updateTrade(id: number, _prev: FormState, fd: FormData): Promise<FormState> {
  if (!repo.getTrade(id)) return { error: "Trade not found." };
  const { fieldErrors, trade } = parseTradeForm(fd);
  if (Object.keys(fieldErrors).length) return { error: "Please fix the highlighted fields.", fieldErrors };

  db.transaction(() => {
    repo.updateTrade(id, trade);
    repo.setTradeTags(id, collectTagIds(fd));
  })();
  for (const shotId of fd.getAll("remove_screenshot").map(Number)) {
    const file = repo.removeScreenshot(shotId);
    if (file) await fs.rm(uploadPath(file), { force: true });
  }
  const shotError = await saveScreenshots(fd, id);
  revalidateAll();
  if (shotError) return { error: `Trade saved, but a screenshot failed: ${shotError}` };
  redirect(`/journal/${id}`);
}

export async function deleteTrade(id: number) {
  const files = repo.deleteTrade(id);
  await Promise.all(files.map((f) => fs.rm(uploadPath(f), { force: true })));
  revalidateAll();
  redirect("/journal");
}

// ---- import ----

export interface ImportResult {
  imported: number;
  duplicates: number;
  warnings: string[];
  error?: string;
}

export async function importTradingView(csvText: string, tagIds: number[] = []): Promise<ImportResult> {
  const result = parseTradingViewCsv(csvText);
  if (result.format === "unknown" || result.trades.length === 0) {
    return { imported: 0, duplicates: 0, warnings: result.warnings, error: result.warnings[0] ?? "No trades found in file." };
  }
  let imported = 0;
  db.transaction(() => {
    for (const t of result.trades) {
      const id = repo.insertTradeIfNew({
        ...t,
        stop_loss: null,
        take_profit: null,
        notes: null,
        rating: null,
        source: "tradingview",
      });
      if (id !== null) {
        imported++;
        if (tagIds.length) repo.setTradeTags(id, tagIds);
      }
    }
  })();
  revalidateAll();
  return { imported, duplicates: result.trades.length - imported, warnings: result.warnings };
}

// ---- settings & tags ----

export async function saveSettings(_prev: FormState, fd: FormData): Promise<FormState> {
  const bal = num(str(fd, "startingBalance"));
  if (bal === null || bal < 0) return { fieldErrors: { startingBalance: "Enter a valid balance" } };
  repo.saveSetting("startingBalance", String(bal));
  revalidateAll();
  return {};
}

export async function createTag(fd: FormData) {
  const name = str(fd, "name").slice(0, 60);
  const category = str(fd, "category") as TagCategory;
  if (!name || !TAG_CATEGORIES.some((c) => c.key === category)) return;
  repo.ensureTag(name, category);
  revalidateAll();
}

export async function removeTag(id: number) {
  repo.deleteTag(id);
  revalidateAll();
}
