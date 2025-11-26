# Trading Tracker

A simple web-based trading journal application to track daily profit/loss (P/L) and trading notes.

## Features

- Calendar view for tracking trading days
- Record daily P/L for each trading session
- Add notes and observations for each trading day
- Navigate between months to review historical data
- Data persistence via REST API

## Tech Stack

**Frontend:**
- HTML5
- CSS3
- Vanilla JavaScript

**Backend:**
- Node.js
- Express.js
- CORS enabled for cross-origin requests

## Project Structure

```
TradingTracker/
├── frontend/
│   ├── index.html          # Main HTML page
│   ├── css/
│   │   └── styles.css      # Styling
│   └── js/
│       └── app.js          # Frontend JavaScript logic
├── backend/
│   ├── server.js           # Express server
│   ├── db.js               # Database initialization
│   └── trades.db           # SQLite database
├── package.json            # All dependencies
└── README.md
```

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd TradingTracker
```

2. Install dependencies:
```bash
npm install
```

### Running the Application

1. Start the backend server:
```bash
npm run dev
```
The server will run on `http://localhost:4000`

2. Open your browser and navigate to `http://localhost:4000`

## Usage

1. **View Calendar**: The calendar displays the current month by default
2. **Navigate Months**: Use the arrow buttons to move between months
3. **Add Trade Data**: Click on any day to open a modal where you can:
   - Enter the P/L for that day
   - Add trading notes and observations
4. **Save**: Click "Save" to store your data
5. **View Saved Data**: Days with saved P/L will display the value on the calendar

## API Endpoints

### GET `/api/trades/:date`
Fetch trading data for a specific date.

**Parameters:**
- `date`: Date in format `YYYY-MM-DD`

**Response:**
```json
{
  "date": "2025-01-15",
  "data": {
    "pl": 150.50,
    "notes": "Good trading day with disciplined entries"
  }
}
```

### POST `/api/trades/:date`
Save trading data for a specific date.

**Parameters:**
- `date`: Date in format `YYYY-MM-DD`

**Body:**
```json
{
  "pl": 150.50,
  "notes": "Trading notes here"
}
```

## Future Enhancements

- Database integration for persistent storage
- User authentication
- Trading statistics and analytics
- Export data to CSV/PDF
- Dark mode
- Responsive mobile design

## License

MIT License
