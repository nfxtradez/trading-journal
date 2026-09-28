// Trading journal schema (SQLite). Applied on every connection; all statements are idempotent.
// Times are stored as local, timezone-naive ISO strings: "YYYY-MM-DDTHH:MM[:SS]".
export const SCHEMA = /* sql */ `
CREATE TABLE IF NOT EXISTS trades (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol        TEXT    NOT NULL,             -- root symbol, e.g. NQ, ES, MNQ
  raw_symbol    TEXT,                         -- symbol as imported, e.g. CME_MINI:NQZ2025
  direction     TEXT    NOT NULL CHECK (direction IN ('long', 'short')),
  entry_price   REAL    NOT NULL,
  exit_price    REAL,
  quantity      REAL    NOT NULL DEFAULT 1,   -- contracts
  entry_time    TEXT    NOT NULL,
  exit_time     TEXT,
  stop_loss     REAL,
  take_profit   REAL,
  fees          REAL    NOT NULL DEFAULT 0,
  pnl           REAL,                         -- net P&L in $ (after fees)
  notes         TEXT,
  rating        INTEGER,                      -- optional 1-5 self rating
  source        TEXT    NOT NULL DEFAULT 'manual', -- manual | tradingview
  external_id   TEXT UNIQUE,                  -- dedupe key for imports
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_trades_entry_time ON trades (entry_time);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades (symbol);

CREATE TABLE IF NOT EXISTS tags (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL,
  category  TEXT NOT NULL CHECK (category IN ('setup', 'mistake', 'strategy')),
  UNIQUE (name, category)
);

CREATE TABLE IF NOT EXISTS trade_tags (
  trade_id  INTEGER NOT NULL REFERENCES trades (id) ON DELETE CASCADE,
  tag_id    INTEGER NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
  PRIMARY KEY (trade_id, tag_id)
);

CREATE TABLE IF NOT EXISTS screenshots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  trade_id    INTEGER NOT NULL REFERENCES trades (id) ON DELETE CASCADE,
  filename    TEXT    NOT NULL,               -- stored under data/uploads/
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
`;
