require('./env-loader');
const { pool } = require('./db-mysql');

const tables = [
    `CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(30) UNIQUE,
        email VARCHAR(255) UNIQUE,
        password_hash VARCHAR(255),
        oauth_provider VARCHAR(50),
        oauth_id VARCHAR(255),
        oauth_email VARCHAR(255),
        display_name VARCHAR(255),
        profile_image_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_oauth (oauth_provider, oauth_id)
    )`,

    `CREATE TABLE IF NOT EXISTS trades (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        trade_date DATE NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_date (user_id, trade_date),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,

    `CREATE TABLE IF NOT EXISTS trade_entries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        trade_date DATE NOT NULL,
        ticker VARCHAR(15) NOT NULL,
        direction VARCHAR(10) DEFAULT 'LONG',
        entry_price DECIMAL(10,2) DEFAULT 0,
        exit_price DECIMAL(10,2) DEFAULT 0,
        size INT DEFAULT 0,
        pnl DECIMAL(10,2) NOT NULL,
        notes TEXT,
        tag VARCHAR(50),
        confidence INT,
        setup_quality VARCHAR(1),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_date (user_id, trade_date)
    )`
];

let completed = 0;
tables.forEach((sql, i) => {
    pool.query(sql, (err) => {
        if (err) {
            console.error(`Error creating table ${i + 1}:`, err.message);
            process.exit(1);
        }
        completed++;
        if (completed === tables.length) {
            console.log('Database schema created successfully');
            process.exit(0);
        }
    });
});
