const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

// Store database in data/ directory (outside backend/ to avoid nodemon restarts)
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbFile = process.env.NODE_ENV === 'test' ? 'test_trades.db' : 'trades.db';
const dbPath = path.join(dataDir, dbFile);

const db = new sqlite3.Database(dbPath);

console.log(`Using database: ${dbPath}`);

function initializeDatabase(callback) {
  db.serialize(() => {
    // Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        password_hash TEXT,
        oauth_provider TEXT,
        oauth_provider_id TEXT,
        oauth_email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Trades table (one row per user per day)
    db.run(`
      CREATE TABLE IF NOT EXISTS trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        trade_date TEXT NOT NULL,
        notes TEXT DEFAULT '',
        has_trades INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, trade_date)
      )
    `);

      // V1 Schema - trade_entries table (one row per trade)
      db.run(`
        CREATE TABLE IF NOT EXISTS trade_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
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
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) {
          console.error("Error creating trade_entries table:", err.message);
          return;
        }

        // Create indexes for faster lookups
        db.run(`CREATE INDEX IF NOT EXISTS idx_trades_user_date ON trades(user_id, trade_date)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_entries_user_date ON trade_entries(user_id, trade_date)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_entries_ticker ON trade_entries(ticker)`);

        console.log("Database initialized successfully with indexes");
        if (callback) callback();
      });
  });
}

module.exports = { db, initializeDatabase };
