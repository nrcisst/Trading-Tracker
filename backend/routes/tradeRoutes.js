const express = require('express');
const router = express.Router();
const { dbClient } = require('../db-client');
const authMiddleware = require('../authMiddleware');

// Apply authMiddleware to all routes
router.use(authMiddleware);

// ---- Trades Endpoints ----

// Get all trades for a specific month
router.get("/trades", (req, res) => {
    const { year, month } = req.query;
    const userId = req.userId;

    if (!year || !month) {
        console.error("[GET /api/trades] Missing year or month parameter");
        return res.status(400).json({ error: "Year and month are required" });
    }

    const monthStr = String(month).padStart(2, "0");
    const datePattern = `${year}-${monthStr}%`;

    const query = `
        SELECT 
            t.trade_date,
            COALESCE(SUM(te.pnl), 0) as pl,
            t.notes
        FROM trades t
        LEFT JOIN trade_entries te ON t.trade_date = te.trade_date AND t.user_id = te.user_id
        WHERE t.user_id = ? AND t.trade_date LIKE ?
        GROUP BY t.trade_date
    `;

    dbClient.all(query, [userId, datePattern], (err, rows) => {
        if (err) {
            console.error("[GET /api/trades] DB error:", err.message);
            return res.status(500).json({ error: "Database error retrieving trades" });
        }
        res.json({ data: rows });
    });
});

router.get("/trades/:date", (req, res) => {
    const dateKey = req.params.date;
    const userId = req.userId;

    const query = `
        SELECT 
            t.trade_date,
            COALESCE(SUM(te.pnl), 0) as pl,
            t.notes
        FROM trades t
        LEFT JOIN trade_entries te ON t.trade_date = te.trade_date AND t.user_id = te.user_id
        WHERE t.user_id = ? AND t.trade_date = ?
        GROUP BY t.trade_date
    `;

    dbClient.get(query, [userId, dateKey], (err, row) => {
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

router.post("/trades/:date", (req, res) => {
    const dateKey = req.params.date;
    const userId = req.userId;
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

    const query = `INSERT INTO trades (user_id, trade_date, notes) 
                    VALUES (?, ?, ?)
                    ON CONFLICT (user_id, trade_date) 
                    DO UPDATE SET notes = excluded.notes;`;

    dbClient.run(query, [userId, dateKey, notes || ''], function (err) {
        if (err) {
            console.error(`[POST /api/trades/${dateKey}] DB error:`, err.message);
            return res.status(500).json({ error: "Database error saving notes" });
        }
        res.status(200).json({ success: true });
    });
});

// ---- Trade Entries Endpoints ----

// Get all entries for a month (bulk fetch to avoid N+1)
router.get("/entries/month", (req, res) => {
    const { year, month } = req.query;
    const userId = req.userId;

    if (!year || !month) {
        console.error("[GET /api/entries/month] Missing year or month parameter");
        return res.status(400).json({ error: "Year and month are required" });
    }

    const monthStr = String(month).padStart(2, "0");
    const datePattern = `${year}-${monthStr}%`;

    const query = "SELECT * FROM trade_entries WHERE user_id = ? AND trade_date LIKE ? ORDER BY trade_date DESC, created_at DESC";
    dbClient.all(query, [userId, datePattern], (err, rows) => {
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
router.get("/entries/:date", (req, res) => {
    const dateKey = req.params.date;
    const userId = req.userId;

    const query = "SELECT * FROM trade_entries WHERE user_id = ? AND trade_date = ? ORDER BY created_at DESC";
    dbClient.all(query, [userId, dateKey], (err, rows) => {
        if (err) {
            console.error(`[GET /api/entries/${dateKey}] DB error:`, err.message);
            return res.status(500).json({ error: "Database error retrieving entries" });
        }
        res.json({ data: rows });
    });
});

// Add a new entry
router.post("/entries", (req, res) => {
    let { trade_date, ticker, direction, entry_price, exit_price, size, pnl, notes, tag, confidence, setup_quality } = req.body;
    const userId = req.userId;

    // Trim strings
    ticker = ticker?.trim();
    notes = notes?.trim() || '';
    tag = tag?.trim();

    // Validation
    if (!trade_date || !ticker) {
        console.error("[POST /api/entries] Missing required fields");
        return res.status(400).json({ error: "Date and ticker are required" });
    }

    if (ticker.length < 1 || ticker.length > 15) {
        console.error("[POST /api/entries] Ticker length invalid");
        return res.status(400).json({ error: "Ticker too long (max 15 chars)" });
    }

    if (notes.length > 2000) {
        console.error("[POST /api/entries] Notes too long");
        return res.status(400).json({ error: "Notes too long (max 2000 chars)" });
    }

    if (tag && tag.length > 50) {
        console.error("[POST /api/entries] Tag too long");
        return res.status(400).json({ error: "Tag too long (max 50 chars)" });
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

    const insertQuery = `INSERT INTO trade_entries (user_id, trade_date, ticker, direction, entry_price, exit_price, size, pnl, notes, tag, confidence, setup_quality) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    dbClient.run(insertQuery, [
        userId, 
        trade_date, 
        ticker, 
        direction || 'LONG', 
        entry_price || 0, 
        exit_price || 0, 
        size || 0, 
        pnl, 
        notes || '', 
        tag || null, 
        confidence || null, 
        setup_quality || null
    ], function (err) {
        if (err) {
            console.error("[POST /api/entries] DB error:", err.message);
            return res.status(500).json({ error: "Database error saving entry" });
        }

        const entryId = this.lastID;

        // Ensure a trades record exists for this date
        const ensureTradeQuery = `INSERT INTO trades (user_id, trade_date, notes) VALUES (?, ?, '') ON CONFLICT (user_id, trade_date) DO NOTHING`;
        dbClient.run(ensureTradeQuery, [userId, trade_date], (err) => {
            if (err) {
                console.error("[POST /api/entries] DB error creating trade record:", err.message);
                return res.status(500).json({ error: "Database error updating trade record" });
            }
            res.status(200).json({ success: true, id: entryId });
        });
    });
});

// Update an entry
router.put("/entries/:id", (req, res) => {
    const id = req.params.id;
    const userId = req.userId;
    let { ticker, direction, pnl, tag, confidence, setup_quality } = req.body;

    // Trim strings
    ticker = ticker?.trim();
    tag = tag?.trim();

    // Validation
    if (!ticker) {
        console.error(`[PUT /api/entries/${id}] Missing ticker`);
        return res.status(400).json({ error: "Ticker is required" });
    }

    if (ticker.length < 1 || ticker.length > 15) {
        console.error(`[PUT /api/entries/${id}] Ticker length invalid`);
        return res.status(400).json({ error: "Ticker too long (max 15 chars)" });
    }

    if (tag && tag.length > 50) {
        console.error(`[PUT /api/entries/${id}] Tag too long`);
        return res.status(400).json({ error: "Tag too long (max 50 chars)" });
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
                         WHERE id = ? AND user_id = ?`;

    dbClient.run(updateQuery, [
        ticker, 
        direction || 'LONG', 
        pnl, 
        tag || null, 
        confidence || null, 
        setup_quality || null, 
        id, 
        userId
    ], function (err) {
        if (err) {
            console.error(`[PUT /api/entries/${id}] DB error:`, err.message);
            return res.status(500).json({ error: "Database error updating entry" });
        }
        res.json({ success: true });
    });
});

// Delete an entry
router.delete("/entries/:id", (req, res) => {
    const id = req.params.id;
    const userId = req.userId;

    const query = "DELETE FROM trade_entries WHERE id = ? AND user_id = ?";
    dbClient.run(query, [id, userId], function (err) {
        if (err) {
            console.error(`[DELETE /api/entries/${id}] DB error:`, err.message);
            return res.status(500).json({ error: "Database error deleting entry" });
        }
        res.json({ success: true });
    });
});

module.exports = router;
