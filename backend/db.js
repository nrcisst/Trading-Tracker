const sqlite3 = require("sqlite3").verbose();
const path = require("path");


const dbPath = path.join(__dirname, "trades.db");

const db = new sqlite3.Database(dbPath);

module.exports = db;

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trade_date TEXT NOT NULL UNIQUE,   -- "YYYY-MM-DD"
      pl REAL,
      notes TEXT
    )
  `);
});
