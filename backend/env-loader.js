/**
 * Environment loader - automatically loads .env.development for local dev
 * or .env for production based on NODE_ENV or file existence
 */
const path = require('path');
const fs = require('fs');

const rootDir = path.join(__dirname, '..');
const devEnvPath = path.join(rootDir, '.env.development');
const prodEnvPath = path.join(rootDir, '.env');

// Check if we're in development (no NODE_ENV set yet, or explicitly development)
// and .env.development exists
let envPath = prodEnvPath;

if (fs.existsSync(devEnvPath) && process.env.NODE_ENV !== 'production') {
    envPath = devEnvPath;
}

require('dotenv').config({ path: envPath });

console.log(`[env-loader] Loaded: ${path.basename(envPath)} (NODE_ENV: ${process.env.NODE_ENV || 'not set'})`);
