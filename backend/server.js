const express = require("express");
const cors = require("cors");
const path = require("path");
const db = require("./db");
const PORT = process.env.PORT || 4000;
require('dotenv').config({ path: '../.env' });


const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));



app.get("/api/trades/:date", (req, res) => {
    const dateKey = req.params.date;
    const query =  "SELECT trade_date, pl, notes FROM trades WHERE trade_date = ?";

    db.get(query, [dateKey], (err, row) => {
        if(err){
            console.error(err);
            return res.status(500).json({ error: "Error retrieving data"});
        }

        if(!row){
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

app.post("/api/trades/:date", (req, res) => {
    const dateKey = req.params.date;
    const { pl, notes } = req.body;
    const query = "INSERT INTO trades (trade_date, pl, notes) VALUES (?, ?, ?)";

    db.run(query, [dateKey, pl, notes], function(err){
        if(err){
            console.error(err);
            return res.status(500).json({ error: "Error saving data"})
        }
        res.status(200).json({ success: true});
    });

});



app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});