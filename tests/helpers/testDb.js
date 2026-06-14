// tests/helpers/testDb.js
/**
 * Test Database Utilities
 * 
 * Provides functions to manage test database state:
 * - Clear all test data between test runs
 * - Seed minimal data (categories, users)
 * - Handle connection safely without crashes
 * 
 * This file is ONLY used in tests, never in production.
 */

'use strict';

// Import the pool directly from connection.js
// connection.js exports { pool, testConnection }
const { pool } = require('../../src/database/connection');

/**
 * Clears all test data from the database in correct order (respecting foreign keys)
 * 
 * Steps:
 * 1. Disable foreign key checks temporarily
 * 2. Truncate tables in reverse dependency order
 * 3. Re-enable foreign key checks
 * 
 * Called in beforeEach to ensure clean state for each test
 */
const clearDatabase = async () => {
    // Get a connection from the pool using mysql2/promise API
    let conn;
    try {
        // pool.getConnection() is the standard mysql2/promise method
        // Returns a connection object with query() and release() methods
        conn = await pool.getConnection();

        // Temporarily disable foreign key constraint checking
        // This allows us to truncate tables in any order
        await conn.execute('SET FOREIGN_KEY_CHECKS = 0');

        // Truncate all tables in reverse order of dependencies
        // Order: admin_logs → ratings → comments → recipes → users → categories
        await conn.execute('TRUNCATE TABLE admin_logs');
        await conn.execute('TRUNCATE TABLE ratings');
        await conn.execute('TRUNCATE TABLE comments');
        await conn.execute('TRUNCATE TABLE recipes');
        await conn.execute('TRUNCATE TABLE users');
        await conn.execute('TRUNCATE TABLE categories');

        // Re-enable foreign key constraint checking
        // This ensures data integrity for subsequent operations
        await conn.execute('SET FOREIGN_KEY_CHECKS = 1');

    } catch (error) {
        // Log the error for debugging purposes
        console.error('❌ Error clearing database:', error.message);

        // Re-throw the error so the test fails appropriately
        throw error;
    } finally {
        // ALWAYS release the connection back to the pool
        // Forgetting this causes the pool to exhaust and tests hang
        if (conn) {
            conn.release();
        }
    }
};

/**
 * Inserts a minimal category for tests that need one
 * 
 * Returns: The inserted category ID
 * 
 * Used when a test needs to create recipes without dealing with category setup
 */
const seedCategory = async () => {
    // Get a connection from the pool
    let conn;
    try {
        conn = await pool.getConnection();

        // Insert a test category with predictable data
        // execute() returns [result, fields] for mysql2/promise
        // result.insertId contains the auto-incremented ID
        const [result] = await conn.execute(
            'INSERT INTO categories (name, slug) VALUES (?, ?)',
            ['Test Category', 'test-category']
        );

        // Return the auto-incremented ID of the inserted category
        return result.insertId;

    } catch (error) {
        // If category already exists from previous test run
        if (error.code === 'ER_DUP_ENTRY') {
            console.warn('⚠ Test category already exists, fetching existing ID');

            // Get a fresh connection to query for the existing category
            const queryConn = await pool.getConnection();
            try {
                const [rows] = await queryConn.execute(
                    'SELECT id FROM categories WHERE slug = ?',
                    ['test-category']
                );
                return rows[0]?.id || null;
            } finally {
                queryConn.release();
            }
        }

        console.error('❌ Error seeding category:', error.message);
        throw error;
    } finally {
        // Always release the connection
        if (conn) {
            conn.release();
        }
    }
};

/**
 * Inserts a test user with hashed password
 * 
 * Returns: The inserted user object (without password_hash)
 * 
 * Used when tests need to test authentication or user-specific features
 */
const seedUser = async (userData = {}) => {
    // Get a connection from the pool
    let conn;
    try {
        conn = await pool.getConnection();

        // Set default values for test user if not provided
        const username = userData.username || 'testuser';
        const email = userData.email || `${username}@test.local`;
        // This is a pre-hashed password using bcryptjs
        // Real password would be 'password123' but we store the hash
        const password_hash = userData.password_hash || '$2b$10$E9g2k6R4F9n2K3m5L9p0Z.7W8Q5J3H1D6G4C2N9S8V5R7T4K2E9'; // bcrypt hash of "TestPassword123!"
        const role = userData.role || 'user';

        // Insert the test user
        const [result] = await conn.execute(
            'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
            [username, email, password_hash, role]
        );

        // Return the created user WITHOUT the password_hash (security best practice)
        return {
            id: result.insertId,
            username,
            email,
            role,
            points: 0,
            created_at: new Date(),
        };

    } catch (error) {
        console.error('❌ Error seeding user:', error.message);
        throw error;
    } finally {
        // Always release the connection
        if (conn) {
            conn.release();
        }
    }
};

/**
 * Closes the database pool gracefully
 * 
 * Must be called in afterAll() hook to prevent Jest from hanging
 * This ensures all database connections are properly closed
 */
const closeDatabase = async () => {
    try {
        // pool.end() closes all connections in the pool and prevents new ones
        // This is the proper way to shut down mysql2/promise pools
        await pool.end();
        console.log('✓ Database pool closed successfully');
    } catch (error) {
        // Log error but don't throw - we want tests to finish even if close fails
        console.error('⚠ Warning: Error closing database pool:', error.message);
    }
};

// Export all test utilities for use in test files
module.exports = {
    clearDatabase,      // Clear all test data between tests
    seedCategory,       // Create a test category
    seedUser,          // Create a test user
    closeDatabase,     // Gracefully close the pool
};
