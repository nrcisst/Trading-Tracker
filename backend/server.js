require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require("express");
const cors = require("cors");
const path = require("path");
const session = require("express-session");
const multer = require("multer");
const fs = require("fs");
const { db, initializeDatabase } = require("./db");
const { register, login } = require("./auth");
const authMiddleware = require("./authMiddleware");
const passport = require("./oauth");
const jwt = require("jsonwebtoken");
const PORT = process.env.PORT || 4000;

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

const app = express();
app.use(cors());
app.use(express.json());

// Session for OAuth flow only
app.use(session({
  secret: process.env.SESSION_SECRET || 'session-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 10 * 60 * 1000 } // 10 min
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(express.static(path.join(__dirname, '../frontend')));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Configure multer for profile image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/profiles');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `user-${req.userId}-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WebP allowed.'));
    }
  }
});

// Auth routes (public)
app.post("/api/auth/register", register);
app.post("/api/auth/login", login);

// OAuth routes
app.get('/auth/google', passport.authenticate('google', { 
  scope: ['profile', 'email'] 
}));

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/?error=oauth_failed' }),
  (req, res) => {
    const token = jwt.sign({ userId: req.user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.redirect(`/?token=${token}`);
  }
);

// User profile routes
app.get('/api/user/me', authMiddleware, (req, res) => {
  db.get('SELECT id, email, oauth_email, display_name, profile_image_url, created_at FROM users WHERE id = ?', 
    [req.userId], (err, user) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (!user) return res.status(404).json({ error: 'User not found' });
      
      res.json({
        id: user.id,
        email: user.email || user.oauth_email,
        displayName: user.display_name,
        profileImage: user.profile_image_url,
        memberSince: user.created_at
      });
    });
});

app.post('/api/user/profile-image', authMiddleware, upload.single('profileImage'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const imageUrl = `/uploads/profiles/${req.file.filename}`;
  
  // Get old image to delete
  db.get('SELECT profile_image_url FROM users WHERE id = ?', [req.userId], (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    // Delete old image file if exists
    if (user && user.profile_image_url) {
      const oldPath = path.join(__dirname, '..', user.profile_image_url);
      fs.unlink(oldPath, () => {});
    }
    
    // Update database
    db.run('UPDATE users SET profile_image_url = ? WHERE id = ?', 
      [imageUrl, req.userId], (err) => {
        if (err) return res.status(500).json({ error: 'Failed to update profile' });
        res.json({ profileImage: imageUrl });
      });
  });
});



// Get all trades for a specific month
app.get("/api/trades", authMiddleware, (req, res) => {
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

    db.all(query, [userId, datePattern], (err, rows) => {
        if (err) {
            console.error("[GET /api/trades] DB error:", err.message);
            return res.status(500).json({ error: "Database error retrieving trades" });
        }
        res.json({ data: rows });
    });
});

app.get("/api/trades/:date", authMiddleware, (req, res) => {
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

    db.get(query, [userId, dateKey], (err, row) => {
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
app.get("/api/entries/month", authMiddleware, (req, res) => {
    const { year, month } = req.query;
    const userId = req.userId;
    
    if (!year || !month) {
        console.error("[GET /api/entries/month] Missing year or month parameter");
        return res.status(400).json({ error: "Year and month are required" });
    }

    const monthStr = String(month).padStart(2, "0");
    const datePattern = `${year}-${monthStr}%`;

    const query = "SELECT * FROM trade_entries WHERE user_id = ? AND trade_date LIKE ? ORDER BY trade_date DESC, created_at DESC";
    db.all(query, [userId, datePattern], (err, rows) => {
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
app.get("/api/entries/:date", authMiddleware, (req, res) => {
    const dateKey = req.params.date;
    const userId = req.userId;
    
    const query = "SELECT * FROM trade_entries WHERE user_id = ? AND trade_date = ? ORDER BY created_at DESC";
    db.all(query, [userId, dateKey], (err, rows) => {
        if (err) {
            console.error(`[GET /api/entries/${dateKey}] DB error:`, err.message);
            return res.status(500).json({ error: "Database error retrieving entries" });
        }
        res.json({ data: rows });
    });
});

// Add a new entry
app.post("/api/entries", authMiddleware, (req, res) => {
    const { trade_date, ticker, direction, entry_price, exit_price, size, pnl, notes, tag, confidence, setup_quality } = req.body;
    const userId = req.userId;

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

    const insertQuery = `INSERT INTO trade_entries (user_id, trade_date, ticker, direction, entry_price, exit_price, size, pnl, notes, tag, confidence, setup_quality) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    db.run(insertQuery, [userId, trade_date, ticker, direction || 'LONG', entry_price || 0, exit_price || 0, size || 0, pnl, notes || '', tag, confidence, setup_quality], function (err) {
        if (err) {
            console.error("[POST /api/entries] DB error:", err.message);
            return res.status(500).json({ error: "Database error saving entry" });
        }

        const entryId = this.lastID;

        // Ensure a trades record exists for this date
        const ensureTradeQuery = `INSERT INTO trades (user_id, trade_date, notes) VALUES (?, ?, '') ON CONFLICT (user_id, trade_date) DO NOTHING`;
        db.run(ensureTradeQuery, [userId, trade_date], (err) => {
            if (err) {
                console.error("[POST /api/entries] DB error creating trade record:", err.message);
                return res.status(500).json({ error: "Database error updating trade record" });
            }
            res.status(200).json({ success: true, id: entryId });
        });
    });
});

// Update an entry
app.put("/api/entries/:id", authMiddleware, (req, res) => {
    const id = req.params.id;
    const userId = req.userId;
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
                         WHERE id = ? AND user_id = ?`;

    db.run(updateQuery, [ticker, direction, pnl, tag, confidence, setup_quality, id, userId], function (err) {
        if (err) {
            console.error(`[PUT /api/entries/${id}] DB error:`, err.message);
            return res.status(500).json({ error: "Database error updating entry" });
        }
        res.json({ success: true });
    });
});


// Delete an entry
app.delete("/api/entries/:id", authMiddleware, (req, res) => {
    const id = req.params.id;
    const userId = req.userId;
    
    const query = "DELETE FROM trade_entries WHERE id = ? AND user_id = ?";
    db.run(query, [id, userId], function (err) {
        if (err) {
            console.error(`[DELETE /api/entries/${id}] DB error:`, err.message);
            return res.status(500).json({ error: "Database error deleting entry" });
        }
        res.json({ success: true });
    });
});

app.post("/api/trades/:date", authMiddleware, (req, res) => {
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

    db.run(query, [userId, dateKey, notes || ''], function (err) {
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