const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "trades.db");
const db = new sqlite3.Database(dbPath);

console.log("Starting migration...");

db.serialize(() => {
  // Create users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error("Error creating users table:", err);
    else console.log("✓ Users table created");
  });

  // Create new trades table with user_id
  db.run(`
    CREATE TABLE IF NOT EXISTS trades_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      trade_date TEXT NOT NULL,
      notes TEXT DEFAULT '',
      has_trades INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, trade_date)
    )
  `, (err) => {
    if (err) console.error("Error creating trades_new:", err);
    else console.log("✓ trades_new table created");
  });

  // Create new trade_entries table with user_id
  db.run(`
    CREATE TABLE IF NOT EXISTS trade_entries_new (
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
    if (err) console.error("Error creating trade_entries_new:", err);
    else console.log("✓ trade_entries_new table created");
  });

  // Rename new tables
  setTimeout(() => {
    db.run("ALTER TABLE trades_new RENAME TO trades", (err) => {
      if (err) console.error("Error renaming trades_new:", err);
      else console.log("✓ trades_new renamed to trades");
    });
    db.run("ALTER TABLE trade_entries_new RENAME TO trade_entries", (err) => {
      if (err) console.error("Error renaming trade_entries_new:", err);
      else console.log("✓ trade_entries_new renamed to trade_entries");
    });

    // Create indexes
    setTimeout(() => {
      db.run("CREATE INDEX IF NOT EXISTS idx_trades_user_date ON trades(user_id, trade_date)");
      db.run("CREATE INDEX IF NOT EXISTS idx_entries_user_date ON trade_entries(user_id, trade_date)");
      db.run("CREATE INDEX IF NOT EXISTS idx_entries_ticker ON trade_entries(ticker)", () => {
        console.log("✓ Indexes created");
        console.log("\nMigration complete!");
        db.close();
      });
    }, 500);
  }, 500);
});
