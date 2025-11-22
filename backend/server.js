const express = require("express");
const cors = require("cors");
const PORT = process.env.PORT || 4000;
require('dotenv').config({ path: '../.env' });


const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('../'));

const tradesByDate = {};

app.get("/api/trades/:date", (req, res) => {
    const dateKey = req.params.date;
    const data = tradesByDate[dateKey] || null;
    res.json({date: dateKey, data});
});

app.post("/api/trades/:date", (req, res) => {
    const dateKey = req.params.date;
    const {pl,notes} = req.body;

    tradesByDate[dateKey] = {pl, notes};
    res.status(200).json({success: true});
});



app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});