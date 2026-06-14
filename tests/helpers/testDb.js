// tests/helpers/testDb.js
//
// Test database utilities.
// Provides functions to reset test data between test suites.
// Never import this in production code.

'use strict';

const pool = require('../src/database/connection');

/**
 * Clears all test data in the correct order (foreign keys).
 * Called in beforeEach or beforeAll depending on the test suite.
 */
const clearDatabase = async () => {
    const conn = await pool.getConnection();
    try {
        await conn.query('SET FOREIGN_KEY_CHECKS = 0');
        await conn.query('TRUNCATE TABLE admin_logs');
        await conn.query('TRUNCATE TABLE ratings');
        await conn.query('TRUNCATE TABLE comments');
        await conn.query('TRUNCATE TABLE recipes');
        await conn.query('TRUNCATE TABLE users');
        await conn.query('TRUNCATE TABLE categories');
        await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    } finally {
        conn.release();
    }
};

/**
 * Inserts a minimal category for tests that need one.
 * Returns the inserted category id.
 */
const seedCategory = async () => {
    const conn = await pool.getConnection();
    try {
        const [result] = await conn.query(
            'INSERT INTO categories (name, slug) VALUES (?, ?)',
            ['Test Category', 'test-category']
        );
        return result.insertId;
    } finally {
        conn.release();
    }
};

/**
 * Closes the database pool.
 * Must be called in afterAll to prevent Jest from hanging.
 */
const closeDatabase = async () => {
    await pool.end();
};

module.exports = { clearDatabase, seedCategory, closeDatabase };
