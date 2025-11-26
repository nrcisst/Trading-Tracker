const sqlite3 = require("sqlite3").verbose();
const path = require("path");


const dbFile = process.env.NODE_ENV === 'test' ? 'test_trades.db' : 'trades.db';
const dbPath = path.join(__dirname, dbFile);

const db = new sqlite3.Database(dbPath);

console.log(`Using database: ${dbFile}`);

function initializeDatabase(callback) {
  db.serialize(() => {
    // V1 Schema - trades table (one row per day)
    db.run(`
      CREATE TABLE IF NOT EXISTS trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trade_date TEXT NOT NULL UNIQUE,
        notes TEXT DEFAULT '',
        has_trades INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error("Error creating trades table:", err.message);
        return;
      }

      // V1 Schema - trade_entries table (one row per trade)
      db.run(`
        CREATE TABLE IF NOT EXISTS trade_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          trade_date TEXT NOT NULL,
          ticker TEXT NOT NULL,
          direction TEXT CHECK(direction IN ('LONG', 'SHORT')) NOT NULL DEFAULT 'LONG',
          entry_price REAL DEFAULT 0,
          exit_price REAL DEFAULT 0,
          size REAL DEFAULT 0,
          pnl REAL NOT NULL,
          notes TEXT DEFAULT '',
          tag TEXT,
          confidence INTEGER CHECK(confidence BETWEEN 1 AND 5),
          setup_quality TEXT CHECK(setup_quality IN ('A', 'B', 'C')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (trade_date) REFERENCES trades(trade_date)
        )
      `, (err) => {
        if (err) {
          console.error("Error creating trade_entries table:", err.message);
          return;
        }

        // Create indexes for faster lookups
        // Index on trade_date: speeds up queries filtering by date (most common)
        db.run(`CREATE INDEX IF NOT EXISTS idx_entries_trade_date ON trade_entries(trade_date)`, (err) => {
          if (err) console.error("Error creating trade_date index:", err.message);
        });

        // Index on ticker: speeds up ticker-based filtering in journal view
        db.run(`CREATE INDEX IF NOT EXISTS idx_entries_ticker ON trade_entries(ticker)`, (err) => {
          if (err) console.error("Error creating ticker index:", err.message);
        });

        // Composite index for date + ticker lookups
        db.run(`CREATE INDEX IF NOT EXISTS idx_entries_date_ticker ON trade_entries(trade_date, ticker)`, (err) => {
          if (err) console.error("Error creating composite index:", err.message);
        });

        // Migration: Add columns if they don't exist (for existing DBs)
        db.run(`ALTER TABLE trade_entries ADD COLUMN tag TEXT`, () => {});
        db.run(`ALTER TABLE trade_entries ADD COLUMN confidence INTEGER CHECK(confidence BETWEEN 1 AND 5)`, () => {});
        db.run(`ALTER TABLE trade_entries ADD COLUMN setup_quality TEXT CHECK(setup_quality IN ('A', 'B', 'C'))`, () => {});
        db.run(`ALTER TABLE trades ADD COLUMN has_trades INTEGER DEFAULT 0`, () => {});

        console.log("Database initialized successfully with indexes");
        if (callback) callback();
      });
    });
  });
}

module.exports = { db, initializeDatabase };
