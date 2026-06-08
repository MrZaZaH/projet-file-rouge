// src/config/database.js
// Database configuration – reads from environment variables.
// Never hardcode credentials here.

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    // Pool settings
    // A pool is a set of pre-opened connections reused across requests.
    // Without a pool, every request opens and closes a connection → slow and wasteful.
    // Think of it as a parking lot: cars (connections) wait ready to be used.
    waitForConnections: true,  // Queue requests when all connections are busy
    connectionLimit: 10,       // Max simultaneous connections – adjust based on MariaDB max_connections
    queueLimit: 0,             // 0 = unlimited queue (requests wait instead of failing)

    // Security: ensure SSL is used in production
    // ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,

    // We use snake_case in DB and snake_case in JS to avoid confusion.
    namedPlaceholders: true,   // Allows :paramName syntax instead of ? – clearer queries
};

// Validate required fields at startup – fail fast rather than fail mysteriously later
const requiredFields = ['user', 'password', 'database'];
for (const field of requiredFields) {
    if (!dbConfig[field]) {
        throw new Error(`Database configuration error: DB_${field.toUpperCase()} is not defined in environment variables`);
    }
}

module.exports = dbConfig;
