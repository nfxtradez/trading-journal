# TradeLog — Trading Journal

A local, single-user trading journal for NQ / ES futures (in the spirit of TradeZella / TradeX).
Dark UI, SQLite storage, TradingView Paper Trading CSV import.

**Stack:** Next.js 16 (App Router, Server Actions) · SQLite via `better-sqlite3` · Tailwind CSS v4 · Recharts.
No external database or auth — everything lives in `./data/`.

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
```

For day-to-day use, `npm run build && npm start` is faster than dev mode.

Data is stored in `data/journal.db` and screenshots in `data/uploads/` (both git-ignored).
Back up the `data/` folder to keep your journal. Set `JOURNAL_DATA_DIR=/some/path` to store it elsewhere.

## Features

| Page | What's there |
| --- | --- |
| **Dashboard** | Time-of-day greeting, account balance / net P&L / return %, quick links, cumulative P&L mini chart, profit factor, win rate, total trades, avg win/loss, monthly P&L calendar, recent trades |
| **Journal** | Sortable trade table, filters (symbol, date range, win/loss, long/short, tag), trade detail view, edit & delete |
| **Log trade** | Symbol, direction, entry/exit price, contracts, entry/exit time, stop, target, fees, P&L (auto-calculated if blank), notes, rating, tags, screenshots (click, drag & drop, or paste from clipboard) |
| **Import** | TradingView Paper Trading CSV → round-trip trades, with preview and duplicate detection |
| **Analytics** | KPIs, max drawdown, equity curve, P&L by symbol, win/loss breakdown, by direction / weekday / entry hour / tag |
| **Calendar** | Full-month daily P&L with weekly totals, best/worst day, daily P&L bars |
| **Settings** | Starting balance, tag management, contract specs |

### P&L calculation

`(exit − entry) × direction × contracts × point value − fees`, using
NQ $20, MNQ $2, ES $50, MES $5 per point (plus YM, RTY, CL, GC and micros — see `src/lib/instruments.ts`).
Type a P&L yourself to override the calculation.

### TradingView CSV import

In TradingView open the Trading Panel → **Paper Trading** → export one of:

- **History** (order history) — *recommended*. Filled orders are replayed per symbol and grouped
  flat → position → flat into one trade, so scale-ins, partial exits and position flips are handled
  and you get exact entry and exit times. Cancelled/rejected orders are skipped; positions still open
  at the end of the file are left out.
- **Account History** (balance history) — each "Close long/short position…" row becomes a trade.
  This export has no entry time, so entry time = exit time.

Symbols like `CME_MINI:NQ1!` or `NQZ2025` are normalized to `NQ`. Re-importing an overlapping export is safe:
trades already in the journal are skipped. Example files are in `samples/`.

### Tags

Three categories — **Setup**, **Mistakes**, **Strategy** — with sensible defaults. Pick them on the trade form
or type new ones inline (comma separated). Analytics breaks down performance by each tag.

## Project layout

```
src/
  app/
    page.tsx                 Dashboard
    journal/                 List, new, [id] detail, [id]/edit, import
    analytics/ calendar/ settings/
    api/uploads/[file]/      Serves screenshots from data/uploads
    actions.ts               Server actions (create/update/delete trade, import, tags, settings)
  components/                UI (TradeForm, PnlCalendar, Charts, Sidebar, …)
  lib/
    schema.sql               Database schema
    db.ts                    SQLite connection + migrations + default tags
    trades.ts                Queries
    stats.ts                 Win rate, profit factor, equity curve, grouping (pure)
    tradingview.ts           CSV parser (pure — used for preview and import)
    instruments.ts           Futures point values + symbol normalization
samples/                     Example TradingView exports
```

Times are stored as local, timezone-naive strings (`YYYY-MM-DDTHH:MM:SS`), exactly as you enter them or as
TradingView exports them. A trade counts toward the day it was closed.
