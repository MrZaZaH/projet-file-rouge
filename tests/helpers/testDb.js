/**
 * Test Database Helper
 * 
 * Manages test database lifecycle for Jest tests.
 * Provides utilities to clear data between tests and close connections.
 */

'use strict';

const { pool } = require('../../src/database/connection');

/**
 * clearDatabase()
 * 
 * Removes all test data while respecting foreign key constraints.
 * Disables FK checks, truncates all tables, re-enables FK checks.
 * TRUNCATE resets auto_increment (unlike DELETE), giving predictable IDs.
 */
async function clearDatabase() {
    await pool.execute('SET FOREIGN_KEY_CHECKS = 0');
    await pool.execute('TRUNCATE TABLE admin_logs');
    await pool.execute('TRUNCATE TABLE comments');
    await pool.execute('TRUNCATE TABLE ratings');
    await pool.execute('TRUNCATE TABLE recipes');
    await pool.execute('TRUNCATE TABLE users');
    await pool.execute('TRUNCATE TABLE categories');
    await pool.execute('SET FOREIGN_KEY_CHECKS = 1');
}

/**
 * closeDatabase()
 * 
 * Closes all connections in the pool.
 * Must be called in afterAll() to prevent Jest from hanging.
 */
async function closeDatabase() {
    try {
        await pool.end();
    } catch (error) {
        console.warn('⚠ Warning closing database:', error.message);
    }
}

module.exports = { clearDatabase, closeDatabase };
