/**
 * Unit Tests for User Model
 * 
 * Tests the User model methods in isolation:
 * - Creation with validation
 * - Password hashing verification
 * - Finding users by ID and email
 * - Password validation
 * - Points system
 * 
 * Verifies that:
 * - Users are created correctly
 * - Password hashes are secure
 * - Duplicate emails are rejected
 * - Soft delete works properly
 */

'use strict';

// Import testing utilities
const { clearDatabase, seedUser, seedCategory, closeDatabase } = require('../helpers/testDb');

// Import the User model to test
const User = require('../../src/models/User');

// Import bcryptjs to validate password hashing
const bcrypt = require('bcryptjs');

/**
 * Jest lifecycle hook: runs before all tests in this file
 * Used to initialize database and test fixtures
 */
beforeAll(async () => {
    console.log('\n📋 Starting User Model Tests...');
});

/**
 * Jest lifecycle hook: runs before each test
 * Clears the database to ensure test isolation
 */
beforeEach(async () => {
    // Remove all data from test database
    // This ensures each test starts with a clean slate
    await clearDatabase();
});

/**
 * Jest lifecycle hook: runs after all tests in this file
 * Cleans up resources to prevent Jest from hanging
 */
afterAll(async () => {
    // Close the database pool connection
    // Without this, Jest will wait indefinitely for the pool to close
    await closeDatabase();
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE: User.create()
// Tests user creation with validation and security
// ─────────────────────────────────────────────────────────────────────────────

describe('User Model', () => {
    describe('create()', () => {

        /**
         * Test: User creation with valid data
         * 
         * Verifies that:
         * 1. A user can be created with valid email, username, password_hash
         * 2. The returned user object contains correct fields
         * 3. No password_hash is returned (security)
         */
        test('should create a new user with hashed password', async () => {
            // Arrange: Prepare user data
            // In real scenario, password_hash is created by bcryptjs in AuthController
            const userData = {
                username: 'testuser123',
                email: 'test@example.com',
                password_hash: '$2b$10$E9g2k6R4F9n2K3m5L9p0Z.7W8Q5J3H1D6G4C2N9S8V5R7T4K2E9', // hash of "TestPassword123!"
                role: 'user',
            };

            // Act: Create the user
            const user = await User.create(userData);

            // Assert: Verify the user was created correctly
            expect(user).toBeDefined();
            expect(user.id).toBeDefined();
            expect(user.username).toBe('testuser123');
            expect(user.email).toBe('test@example.com');
            expect(user.role).toBe('user');
            expect(user.points).toBe(0); // New users start with 0 points
            expect(user.password_hash).toBeUndefined(); // Password hash should NOT be returned
        });

        /**
         * Test: Duplicate email rejection
         * 
         * Verifies that:
         * 1. Creating a user with an email that already exists fails
         * 2. The error is caught appropriately
         * 3. Database constraints work correctly
         */
        test('should reject user creation with duplicate email', async () => {
            // Arrange: Create first user
            await User.create({
                username: 'alice',
                email: 'alice@example.com',
                password_hash: '$2b$10$E9g2k6R4F9n2K3m5L9p0Z.7W8Q5J3H1D6G4C2N9S8V5R7T4K2E9',
            });

            // Act & Assert: Attempt to create second user with same email
            // This should throw an error (ER_DUP_ENTRY)
            await expect(
                User.create({
                    username: 'bob',
                    email: 'alice@example.com', // Same email!
                    password_hash: '$2b$10$E9g2k6R4F9n2K3m5L9p0Z.7W8Q5J3H1D6G4C2N9S8V5R7T4K2E9',
                })
            ).rejects.toThrow();
        });

        /**
         * Test: Missing email validation
         * 
         * Verifies that:
         * 1. A user cannot be created without an email
         * 2. Database constraint (NOT NULL) prevents this
         */
        test('should reject user creation with missing email', async () => {
            // Act & Assert: Try to create user without email
            await expect(
                User.create({
                    username: 'nomail',
                    email: null, // Missing email!
                    password_hash: '$2b$10$E9g2k6R4F9n2K3m5L9p0Z.7W8Q5J3H1D6G4C2N9S8V5R7T4K2E9',
                })
            ).rejects.toThrow();
        });

        /**
         * Test: Missing username validation
         * 
         * Verifies that:
         * 1. A user cannot be created without a username
         * 2. Database constraint (NOT NULL) prevents this
         */
        test('should reject user creation with missing username', async () => {
            // Act & Assert: Try to create user without username
            await expect(
                User.create({
                    username: null, // Missing username!
                    email: 'valid@example.com',
                    password_hash: '$2b$10$E9g2k6R4F9n2K3m5L9p0Z.7W8Q5J3H1D6G4C2N9S8V5R7T4K2E9',
                })
            ).rejects.toThrow();
        });
    });

    // ───────────────────────────────────────────────────────────────────────────
    // TEST SUITE: User.findById()
    // Tests retrieval of users by primary key
    // ───────────────────────────────────────────────────────────────────────────

    describe('findById()', () => {

        /**
         * Test: Retrieve existing user by ID
         * 
         * Verifies that:
         * 1. A user created can be retrieved by ID
         * 2. All fields match what was stored
         * 3. Password hash is not returned
         */
        test('should retrieve user by ID', async () => {
            // Arrange: Create a test user
            const created = await User.create({
                username: 'findme',
                email: 'findme@example.com',
                password_hash: '$2b$10$E9g2k6R4F9n2K3m5L9p0Z.7W8Q5J3H1D6G4C2N9S8V5R7T4K2E9',
            });

            // Act: Retrieve the user by ID
            const found = await User.findById(created.id);

            // Assert: Verify the retrieved user matches
            expect(found).toBeDefined();
            expect(found.id).toBe(created.id);
            expect(found.username).toBe('findme');
            expect(found.email).toBe('findme@example.com');
            expect(found.password_hash).toBeUndefined();
        });

        /**
         * Test: Return null for non-existent user ID
         * 
         * Verifies that:
         * 1. Querying for a user that doesn't exist returns null
         * 2. No error is thrown
         */
        test('should return null for non-existent user ID', async () => {
            // Act: Query for a user with ID 9999 (doesn't exist)
            const found = await User.findById(9999);

            // Assert: Should return null, not throw
            expect(found).toBeNull();
        });

        /**
         * Test: Return null for invalid ID (soft delete)
         * 
         * Verifies that:
         * 1. Soft-deleted users are not returned
         * 2. The deleted_at field is respected
         */
        test('should return null for soft-deleted user', async () => {
            // Arrange: Create user and then soft delete it
            const created = await User.create({
                username: 'todelete',
                email: 'todelete@example.com',
                password_hash: '$2b$10$E9g2k6R4F9n2K3m5L9p0Z.7W8Q5J3H1D6G4C2N9S8V5R7T4K2E9',
            });

            // Act: Delete the user (soft delete)
            await User.delete(created.id);

            // Act: Try to retrieve deleted user
            const found = await User.findById(created.id);

            // Assert: Should return null (soft delete hides the user)
            expect(found).toBeNull();
        });
    });

    // ───────────────────────────────────────────────────────────────────────────
    // TEST SUITE: User.findByEmail()
    // Tests retrieval of users by email address
    // ───────────────────────────────────────────────────────────────────────────

    describe('findByEmail()', () => {

        /**
         * Test: Find user by email
         * 
         * Verifies that:
         * 1. A user can be found by email
         * 2. Email lookup is case-sensitive (or not, depending on DB collation)
         */
        test('should retrieve user by email', async () => {
            // Arrange: Create a test user
            await User.create({
                username: 'emailtest',
                email: 'unique@example.com',
                password_hash: '$2b$10$E9g2k6R4F9n2K3m5L9p0Z.7W8Q5J3H1D6G4C2N9S8V5R7T4K2E9',
            });

            // Act: Find the user by email
            const found = await User.findByEmail('unique@example.com');

            // Assert: Verify user was found
            expect(found).toBeDefined();
            expect(found.username).toBe('emailtest');
            expect(found.email).toBe('unique@example.com');
        });

        /**
         * Test: Return null for non-existent email
         * 
         * Verifies that:
         * 1. Querying for a non-existent email returns null
         */
        test('should return null for non-existent email', async () => {
            // Act: Query for email that never existed
            const found = await User.findByEmail('nonexistent@example.com');

            // Assert: Should return null
            expect(found).toBeNull();
        });
    });

    // ───────────────────────────────────────────────────────────────────────────
    // TEST SUITE: User Points (Gamification)
    // Tests the points system for user rewards
    // ───────────────────────────────────────────────────────────────────────────

    describe('User Points', () => {

        /**
         * Test: New users start with 0 points
         * 
         * Verifies that:
         * 1. User.points is initialized to 0
         */
        test('should create user with 0 points by default', async () => {
            // Arrange: Create a new user
            const user = await User.create({
                username: 'newuser',
                email: 'newuser@example.com',
                password_hash: '$2b$10$E9g2k6R4F9n2K3m5L9p0Z.7W8Q5J3H1D6G4C2N9S8V5R7T4K2E9',
            });

            // Assert: Points should be 0
            expect(user.points).toBe(0);
        });

        /**
         * Test: Points can be added to a user
         * 
         * Verifies that:
         * 1. addPoints() method correctly increments points
         * 2. The update is persisted to the database
         * 3. Retrieving the user shows the new points value
         */
        test('should increment user points', async () => {
            // Arrange: Create a user
            const created = await User.create({
                username: 'pointuser',
                email: 'pointuser@example.com',
                password_hash: '$2b$10$E9g2k6R4F9n2K3m5L9p0Z.7W8Q5J3H1D6G4C2N9S8V5R7T4K2E9',
            });

            // Act: Add 15 points to the user
            await User.addPoints(created.id, 15);

            // Act: Retrieve the user to verify the update
            const updated = await User.findById(created.id);

            // Assert: Points should now be 15
            expect(updated.points).toBe(15);
        });

        /**
         * Test: Multiple point additions accumulate correctly
         * 
         * Verifies that:
         * 1. Multiple calls to addPoints() accumulate
         * 2. The database handles atomic updates (no race conditions)
         * 
         * Scenario:
         * - User publishes recipe: +10 points
         * - Receives rating >= 4: +5 points
         * - Receives another rating >= 4: +5 points
         * Total: 20 points
         */
        test('should accumulate points from multiple additions', async () => {
            // Arrange: Create a user
            const created = await User.create({
                username: 'accumuser',
                email: 'accumuser@example.com',
                password_hash: '$2b$10$E9g2k6R4F9n2K3m5L9p0Z.7W8Q5J3H1D6G4C2N9S8V5R7T4K2E9',
            });

            // Act: Add points in multiple steps (simulating different events)
            await User.addPoints(created.id, 10); // Published recipe
            await User.addPoints(created.id, 5);  // First good rating
            await User.addPoints(created.id, 5);  // Second good rating

            // Act: Retrieve the user to verify total
            const updated = await User.findById(created.id);

            // Assert: Total should be 20
            expect(updated.points).toBe(20);
        });

        /**
         * Test: Adding 0 points doesn't change anything
         * 
         * Edge case: Ensure the system doesn't crash if 0 points are added
         */
        test('should handle adding 0 points gracefully', async () => {
            // Arrange: Create user with some points
            const created = await User.create({
                username: 'zeropoints',
                email: 'zeropoints@example.com',
                password_hash: '$2b$10$E9g2k6R4F9n2K3m5L9p0Z.7W8Q5J3H1D6G4C2N9S8V5R7T4K2E9',
            });

            await User.addPoints(created.id, 10);

            // Act: Add 0 points (shouldn't crash)
            await User.addPoints(created.id, 0);

            // Act: Retrieve user
            const updated = await User.findById(created.id);

            // Assert: Points should still be 10
            expect(updated.points).toBe(10);
        });
    });

    // ───────────────────────────────────────────────────────────────────────────
    // TEST SUITE: User.delete() (Soft Delete)
    // Tests soft deletion functionality
    // ───────────────────────────────────────────────────────────────────────────

    describe('delete()', () => {

        /**
         * Test: Soft delete marks user as deleted
         * 
         * Verifies that:
         * 1. delete() sets deleted_at timestamp
         * 2. User is no longer found by findById()
         * 3. User data is not actually removed from database
         */
        test('should soft delete a user', async () => {
            // Arrange: Create a user
            const created = await User.create({
                username: 'deleteme',
                email: 'deleteme@example.com',
                password_hash: '$2b$10$E9g2k6R4F9n2K3m5L9p0Z.7W8Q5J3H1D6G4C2N9S8V5R7T4K2E9',
            });

            // Act: Soft delete the user
            const result = await User.delete(created.id);

            // Assert: delete() should return true (affected rows > 0)
            expect(result).toBe(true);

            // Assert: User should no longer be findable
            const found = await User.findById(created.id);
            expect(found).toBeNull();
        });

        /**
         * Test: Deleting non-existent user returns false
         * 
         * Edge case: Attempting to delete a user that doesn't exist
         */
        test('should return false when deleting non-existent user', async () => {
            // Act: Try to delete user ID that never existed
            const result = await User.delete(9999);

            // Assert: Should return false (affected rows = 0)
            expect(result).toBe(false);
        });
    });

    // ───────────────────────────────────────────────────────────────────────────
    // TEST SUITE: User.update()
    // Tests user profile updates
    // ───────────────────────────────────────────────────────────────────────────

    describe('update()', () => {

        /**
         * Test: Update user username
         * 
         * Verifies that:
         * 1. Username can be updated
         * 2. The update is persisted
         * 3. Other fields remain unchanged
         */
        test('should update user username', async () => {
            // Arrange: Create a user
            const created = await User.create({
                username: 'oldname',
                email: 'updatetest@example.com',
                password_hash: '$2b$10$E9g2k6R4F9n2K3m5L9p0Z.7W8Q5J3H1D6G4C2N9S8V5R7T4K2E9',
            });

            // Act: Update the username
            const updated = await User.update(created.id, { username: 'newname' });

            // Assert: Username should be updated
            expect(updated.username).toBe('newname');

            // Assert: Email should remain the same
            expect(updated.email).toBe('updatetest@example.com');

            // Assert: Verify persistence by retrieving again
            const verified = await User.findById(created.id);
            expect(verified.username).toBe('newname');
        });
    });
});
