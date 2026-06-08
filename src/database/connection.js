// src/database/connection.js
// Creates and exports the MariaDB connection pool.
// All database queries go through this single pool instance.
// 
// Security measures:
// - Uses connection pooling (prevents connection exhaustion)
// - Relies on parameterized queries (SQL injection prevention)
// - Credentials loaded from environment variables only

'use strict';

const mysql = require('mysql2/promise');
const dbConfig = require('../config/database');

// createPool returns a pool object, not a connection.
// mysql2/promise gives us async/await support out of the box.
const pool = mysql.createPool(dbConfig);

/**
 * Tests the database connection by acquiring one connection from the pool.
 * Call this at server startup to catch misconfigurations immediately.
 * @returns {Promise<void>}
 */
async function testConnection() {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.query('SELECT 1');
        // We log from here but import logger carefully to avoid circular deps
        console.info('[DB] Connection pool established successfully');
    } catch (error) {
        console.error('[DB] Failed to connect to database:', error.message);
        // Hard exit – there is no point running without a database
        process.exit(1);
    } finally {
        // ALWAYS release the connection back to the pool, even on error
        // Forgetting this is how you silently exhaust your pool
        if (connection) connection.release();
    }
}

module.exports = { pool, testConnection };
