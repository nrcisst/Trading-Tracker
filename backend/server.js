const express = require("express");
const cors = require("cors");
const path = require("path");
const { db, initializeDatabase } = require("./db");
const PORT = process.env.PORT || 4000;
require('dotenv').config({ path: '../.env' });

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));



// Get all trades for a specific month
app.get("/api/trades", (req, res) => {
    const { year, month } = req.query;
    if (!year || !month) {
        console.error("[GET /api/trades] Missing year or month parameter");
        return res.status(400).json({ error: "Year and month are required" });
    }

    // Format: YYYY-MM%
    const monthStr = String(month).padStart(2, "0");
    const datePattern = `${year}-${monthStr}%`;

    // Get all unique trade dates for the month and calculate P/L from entries
    const query = `
        SELECT 
            t.trade_date,
            COALESCE(SUM(te.pnl), 0) as pl,
            t.notes
        FROM trades t
        LEFT JOIN trade_entries te ON t.trade_date = te.trade_date
        WHERE t.trade_date LIKE ?
        GROUP BY t.trade_date
    `;

    db.all(query, [datePattern], (err, rows) => {
        if (err) {
            console.error("[GET /api/trades] DB error:", err.message);
            return res.status(500).json({ error: "Database error retrieving trades" });
        }
        res.json({ data: rows });
    });
});

app.get("/api/trades/:date", (req, res) => {
    const dateKey = req.params.date;

    // Calculate P/L from trade entries
    const query = `
        SELECT 
            t.trade_date,
            COALESCE(SUM(te.pnl), 0) as pl,
            t.notes
        FROM trades t
        LEFT JOIN trade_entries te ON t.trade_date = te.trade_date
        WHERE t.trade_date = ?
        GROUP BY t.trade_date
    `;

    db.get(query, [dateKey], (err, row) => {
        if (err) {
            console.error(`[GET /api/trades/${dateKey}] DB error:`, err.message);
            return res.status(500).json({ error: "Database error retrieving trade" });
        }

        if (!row) {
            return res.json({ date: dateKey, data: null });
        }

        res.json({
            date: row.trade_date,
            data: {
                pl: row.pl,
                notes: row.notes,
            },
        });
    });
});

// ---- Trade Entries Endpoints ----

// Get all entries for a month (bulk fetch to avoid N+1)
app.get("/api/entries/month", (req, res) => {
    const { year, month } = req.query;
    if (!year || !month) {
        console.error("[GET /api/entries/month] Missing year or month parameter");
        return res.status(400).json({ error: "Year and month are required" });
    }

    const monthStr = String(month).padStart(2, "0");
    const datePattern = `${year}-${monthStr}%`;

    const query = "SELECT * FROM trade_entries WHERE trade_date LIKE ? ORDER BY trade_date DESC, created_at DESC";
    db.all(query, [datePattern], (err, rows) => {
        if (err) {
            console.error(`[GET /api/entries/month] DB error:`, err.message);
            return res.status(500).json({ error: "Database error retrieving entries" });
        }

        // Group by date
        const grouped = {};
        rows.forEach(entry => {
            if (!grouped[entry.trade_date]) {
                grouped[entry.trade_date] = [];
            }
            grouped[entry.trade_date].push(entry);
        });

        res.json({ data: grouped });
    });
});

// Get entries for a specific date
app.get("/api/entries/:date", (req, res) => {
    const dateKey = req.params.date;
    const query = "SELECT * FROM trade_entries WHERE trade_date = ? ORDER BY created_at DESC";
    db.all(query, [dateKey], (err, rows) => {
        if (err) {
            console.error(`[GET /api/entries/${dateKey}] DB error:`, err.message);
            return res.status(500).json({ error: "Database error retrieving entries" });
        }
        res.json({ data: rows });
    });
});

// Add a new entry
app.post("/api/entries", (req, res) => {
    const { trade_date, ticker, direction, entry_price, exit_price, size, pnl, notes, tag, confidence, setup_quality } = req.body;

    // Validation
    if (!trade_date || !ticker) {
        console.error("[POST /api/entries] Missing required fields");
        return res.status(400).json({ error: "Date and ticker are required" });
    }

    if (typeof pnl !== 'number' || isNaN(pnl)) {
        console.error("[POST /api/entries] Invalid P/L value");
        return res.status(400).json({ error: "Valid P/L number is required" });
    }

    if (direction && !['LONG', 'SHORT'].includes(direction)) {
        console.error("[POST /api/entries] Invalid direction");
        return res.status(400).json({ error: "Direction must be LONG or SHORT" });
    }

    if (confidence && (confidence < 1 || confidence > 5)) {
        console.error("[POST /api/entries] Invalid confidence");
        return res.status(400).json({ error: "Confidence must be between 1 and 5" });
    }

    if (setup_quality && !['A', 'B', 'C'].includes(setup_quality)) {
        console.error("[POST /api/entries] Invalid setup quality");
        return res.status(400).json({ error: "Setup quality must be A, B, or C" });
    }

    const insertQuery = `INSERT INTO trade_entries (trade_date, ticker, direction, entry_price, exit_price, size, pnl, notes, tag, confidence, setup_quality) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    db.run(insertQuery, [trade_date, ticker, direction || 'LONG', entry_price || 0, exit_price || 0, size || 0, pnl, notes || '', tag, confidence, setup_quality], function (err) {
        if (err) {
            console.error("[POST /api/entries] DB error:", err.message);
            return res.status(500).json({ error: "Database error saving entry" });
        }

        const entryId = this.lastID;

        // Ensure a trades record exists for this date
        const ensureTradeQuery = `INSERT INTO trades (trade_date, notes) VALUES (?, '') ON CONFLICT (trade_date) DO NOTHING`;
        db.run(ensureTradeQuery, [trade_date], (err) => {
            if (err) {
                console.error("[POST /api/entries] DB error creating trade record:", err.message);
                return res.status(500).json({ error: "Database error updating trade record" });
            }
            res.status(200).json({ success: true, id: entryId });
        });
    });
});

// Update an entry
app.put("/api/entries/:id", (req, res) => {
    const id = req.params.id;
    const { ticker, direction, pnl, tag, confidence, setup_quality } = req.body;

    // Validation
    if (!ticker) {
        console.error(`[PUT /api/entries/${id}] Missing ticker`);
        return res.status(400).json({ error: "Ticker is required" });
    }

    if (typeof pnl !== 'number' || isNaN(pnl)) {
        console.error(`[PUT /api/entries/${id}] Invalid P/L value`);
        return res.status(400).json({ error: "Valid P/L number is required" });
    }

    if (direction && !['LONG', 'SHORT'].includes(direction)) {
        console.error(`[PUT /api/entries/${id}] Invalid direction`);
        return res.status(400).json({ error: "Direction must be LONG or SHORT" });
    }

    if (confidence && (confidence < 1 || confidence > 5)) {
        console.error(`[PUT /api/entries/${id}] Invalid confidence`);
        return res.status(400).json({ error: "Confidence must be between 1 and 5" });
    }

    if (setup_quality && !['A', 'B', 'C'].includes(setup_quality)) {
        console.error(`[PUT /api/entries/${id}] Invalid setup quality`);
        return res.status(400).json({ error: "Setup quality must be A, B, or C" });
    }

    const updateQuery = `UPDATE trade_entries 
                         SET ticker = ?, direction = ?, pnl = ?, tag = ?, confidence = ?, setup_quality = ?
                         WHERE id = ?`;

    db.run(updateQuery, [ticker, direction, pnl, tag, confidence, setup_quality, id], function (err) {
        if (err) {
            console.error(`[PUT /api/entries/${id}] DB error:`, err.message);
            return res.status(500).json({ error: "Database error updating entry" });
        }
        res.json({ success: true });
    });
});


// Delete an entry
app.delete("/api/entries/:id", (req, res) => {
    const id = req.params.id;
    const query = "DELETE FROM trade_entries WHERE id = ?";
    db.run(query, [id], function (err) {
        if (err) {
            console.error(`[DELETE /api/entries/${id}] DB error:`, err.message);
            return res.status(500).json({ error: "Database error deleting entry" });
        }
        res.json({ success: true });
    });
});

app.post("/api/trades/:date", (req, res) => {
    const dateKey = req.params.date;
    const { notes } = req.body;

    // Validation
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateKey)) {
        console.error(`[POST /api/trades/${dateKey}] Invalid date format`);
        return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
    }

    if (notes && typeof notes !== 'string') {
        console.error(`[POST /api/trades/${dateKey}] Invalid notes type`);
        return res.status(400).json({ error: "Notes must be a string" });
    }

    if (notes && notes.length > 4000) {
        console.error(`[POST /api/trades/${dateKey}] Notes too long`);
        return res.status(400).json({ error: "Notes too long (max 4000 chars)" });
    }

    // Only save notes, P/L is auto-calculated from trade entries
    const query = `INSERT INTO trades (trade_date, notes) 
                    VALUES (?, ?)
                    ON CONFLICT (trade_date) 
                    DO UPDATE SET notes = excluded.notes;`;

    db.run(query, [dateKey, notes || ''], function (err) {
        if (err) {
            console.error(`[POST /api/trades/${dateKey}] DB error:`, err.message);
            return res.status(500).json({ error: "Database error saving notes" });
        }
        res.status(200).json({ success: true });
    });

});



// Initialize database and start server
initializeDatabase(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});