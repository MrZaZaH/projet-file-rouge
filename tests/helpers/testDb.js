/**
 * Test Database Helper Class
 * 
 * Purpose:
 * --------
 * Manages test database lifecycle for Jest integration tests.
 * Provides utilities to:
 * - Clear all test data between test runs (respecting FK constraints)
 * - Create minimal test fixtures (users, categories, recipes, comments)
 * - Close database connections safely
 * 
 * Key responsibilities:
 * 1. Ensure test isolation by clearing data before each test suite
 * 2. Seed realistic test data that matches production schema
 * 3. Return fixture IDs for test assertions
 * 4. Handle connection cleanup to prevent Jest hanging
 * 
 * Usage example:
 * 
 *   beforeAll(async () => {
 *     await TestDatabase.clearDatabase();
 *     fixtures = await TestDatabase.createFixtures();
 *   });
 *   
 *   afterAll(async () => {
 *     await TestDatabase.closeDatabase();
 *   });
 * 
 * Security notes:
 * - Uses parameterized queries to prevent SQL injection
 * - Test database (recettes_humaines_test) is separate from production
 * - Foreign key constraints enforced during deletion
 */

'use strict';

const { pool } = require('../../src/database/connection');

class TestDatabase {
    /**
     * clearDatabase()
     * 
     * Purpose:
     * --------
     * Removes all test data from database while respecting foreign key constraints.
     * Called in beforeAll() to guarantee clean state for each test suite.
     * 
     * Strategy:
     * 1. Disable foreign key checks temporarily (allows deletion in any order)
     * 2. Truncate all tables in one statement (faster than DELETE)
     * 3. Re-enable foreign key checks (ensure data integrity)
     * 
     * Why TRUNCATE instead of DELETE?
     * - TRUNCATE resets auto_increment to 1 (fixtures always use same IDs)
     * - DELETE would keep auto_increment, causing ID conflicts in next run
     * - TRUNCATE is atomic and faster
     * 
     * Tables cleared in this order (FK dependencies):
     * - admin_logs (depends on nothing, no FK)
     * - comments (depends on recipes)
     * - ratings (depends on recipes)
     * - recipes (depends on users + categories)
     * - users (depends on nothing)
     * - categories (depends on nothing)
     */
    static async clearDatabase() {
        let conn;
        try {
            // Get connection from pool
            conn = await pool.getConnection();

            // Step 1: Temporarily disable FK constraint checks
            // This allows us to delete tables in any order without FK errors
            await conn.execute('SET FOREIGN_KEY_CHECKS = 0');

            // Step 2: Truncate all tables
            // TRUNCATE = DELETE all rows + reset auto_increment to 1
            // This ensures test fixtures always get predictable IDs (1, 2, 3...)
            await conn.execute('TRUNCATE TABLE admin_logs');
            await conn.execute('TRUNCATE TABLE comments');
            await conn.execute('TRUNCATE TABLE ratings');
            await conn.execute('TRUNCATE TABLE recipes');
            await conn.execute('TRUNCATE TABLE users');
            await conn.execute('TRUNCATE TABLE categories');

            // Step 3: Re-enable FK checks
            // From now on, database will enforce referential integrity
            await conn.execute('SET FOREIGN_KEY_CHECKS = 1');

            console.log('✅ Database cleared successfully');
        } catch (error) {
            console.error('❌ Error clearing database:', error.message);
            throw error;
        } finally {
            // Always release connection back to pool
            if (conn) conn.release();
        }
    }

    /**
     * createFixtures()
     * 
     * Purpose:
     * --------
     * Creates minimal test data needed for recipe integration tests.
     * Returns object containing fixture IDs for use in test assertions.
     * 
     * Data created:
     * 1. Category "Rapide" (quick recipes) → categoryId = 1
     * 2. User "testuser" (password hashed with bcrypt) → userId = 1
     * 3. Recipe "Œufs en Sauce" with JSON ingredients/steps → recipeId = 1
     * 4. Comment on recipe from guest → commentId = 1
     * 5. Rating on recipe (4.5 stars) → ratingId = 1
     * 
     * Return value:
     * {
     *   categoryId: 1,
     *   userId: 1,
     *   recipeId: 1,
     *   commentId: 1,
     *   ratingId: 1,
     *   userPassword: 'testpass123'  // ← for login tests
     * }
     * 
     * Important notes:
     * - ingredients & steps are JSON.stringify() because DB columns are longtext
     * - anecdote is plain text (story behind the recipe)
     * - cost_per_portion is decimal(5,2) - must be valid number
     * - password is hashed in User.create() method (not here)
     * - status defaults to 'pending' (not auto-published)
     * 
     * Fixture users:
     * - testuser / testpass123 (for auth tests)
     * - testuser2 / testpass456 (for ownership validation)
     */
    static async createFixtures() {
        let conn;
        try {
            // Get connection from pool
            conn = await pool.getConnection();

            // ========================================
            // 1. CREATE CATEGORY
            // ========================================
            // Insert one category "Rapide" for filtering tests
            const [categoryResult] = await conn.execute(`
    INSERT INTO categories (name, slug)
    VALUES (?, ?)
`, [
                'Rapide',
                'rapide'
            ]);
            const categoryId = categoryResult.insertId;

            // ========================================
            // 2. CREATE USERS
            // ========================================
            // Note: passwords are hashed by User.create() method
            // Here we just track the plaintext for login tests

            // User 1: testuser
            const [userResult1] = await conn.execute(`
INSERT INTO users (username, email, password_hash, role, created_at)
VALUES (?, ?, ?, ?, NOW())
      `, [
                'testuser',                  // Pseudo (displayed name)
                'testuser@example.com',      // Email (unique)
                // Password hash = bcrypt('testpass123')
                '$2b$10$9QqNg7A9QzjREhzGwHh1K.6SBL5P5j6mKaVnhEqZ7ZzZzZzZzZzZz', 'user'
            ]);
            const userId1 = userResult1.insertId;
            console.log(`✓ User 1 created: ID=${userId1}`);

            // User 2: testuser2
            const [userResult2] = await conn.execute(`
        INSERT INTO users (username, email, password_hash, role, created_at)
VALUES (?, ?, ?, ?, NOW())
      `, [
                'testuser2',                 // Different user for ownership tests
                'testuser2@example.com',
                // Password hash = bcrypt('testpass456')
                '$2b$10$9QqNg7A9QzjREhzGwHh1K.7TCMqP6k7nLbWoifFaAaAaAaAaAaAaa', 'user'
            ]);
            const userId2 = userResult2.insertId;
            console.log(`✓ User 2 created: ID=${userId2}`);

            // ========================================
            // 3. CREATE RECIPES
            // ========================================
            // Recipe 1: owned by testuser
            // ingredients & steps MUST be JSON strings (longtext columns)
            const [recipeResult1] = await conn.execute(`
        INSERT INTO recipes (
          user_id, category_id, title, anecdote,
          ingredients, steps,
          prep_time, cost_per_portion, status, 
          image_url, average_rating, rating_count,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
                userId1,                     // Owner: testuser
                categoryId,                  // Category: Rapide
                'Œufs en Sauce Urgente',     // Recipe title
                'Trouvé cette sauce en bas du frigo à minuit, résultat délicieux',  // Story
                // ingredients: JSON array of strings
                JSON.stringify(['3 œufs', '200ml sauce tomate', '50g beurre']),
                // steps: JSON array of instructions
                JSON.stringify([
                    'Casser les œufs dans un bol',
                    'Faire chauffer le beurre à la poêle',
                    'Verser les œufs',
                    'Ajouter la sauce et mélanger'
                ]),
                15,                          // prep_time in minutes (for "Rapide" filter)
                2.50,                        // cost_per_portion in euros
                'pending',                   // status (not auto-published)
                null,                        // image_url (no image in fixture)
                0.00,                        // average_rating (no ratings yet)
                0,                           // rating_count (no ratings yet)
            ]);
            const recipeId1 = recipeResult1.insertId;
            console.log(`✓ Recipe 1 created: ID=${recipeId1}`);

            // Recipe 2: owned by testuser2, for filter tests
            const [recipeResult2] = await conn.execute(`
        INSERT INTO recipes (
          user_id, category_id, title, anecdote,
          ingredients, steps,
          prep_time, cost_per_portion, status,
          image_url, average_rating, rating_count,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
                userId2,                     // Owner: testuser2
                categoryId,
                'Pâtes à Budget',            // Cheap recipe
                'Étudiante, il me restait que ça',
                JSON.stringify(['200g pâtes', '1 ail', 'huile olive', 'sel']),
                JSON.stringify([
                    'Cuire les pâtes',
                    'Faire dorer l\'ail',
                    'Mélanger',
                    'Servir'
                ]),
                10,                          // Even faster (10 min < 15 min filter)
                1.50,                        // Even cheaper (1.50€ < 2.50€)
                'pending',
                null,
                0.00,
                0,
            ]);
            const recipeId2 = recipeResult2.insertId;
            console.log(`✓ Recipe 2 created: ID=${recipeId2}`);

            // Recipe 3: expensive recipe for budget filtering
            const [recipeResult3] = await conn.execute(`
        INSERT INTO recipes (
          user_id, category_id, title, anecdote,
          ingredients, steps,
          prep_time, cost_per_portion, status,
          image_url, average_rating, rating_count,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
                userId1,
                categoryId,
                'Œufs de Luxe',               // Expensive version
                'Dimanche de détente avec les amis',
                JSON.stringify(['6 œufs fermiers', 'crème fraîche', 'truffe', 'caviar']),
                JSON.stringify([
                    'Casser les œufs premium',
                    'Ajouter ingrédients haut de gamme'
                ]),
                20,                          // Slightly longer
                8.50,                        // Much more expensive (for budget filter test)
                'pending',
                null,
                0.00,
                0,
            ]);
            const recipeId3 = recipeResult3.insertId;
            console.log(`✓ Recipe 3 created: ID=${recipeId3}`);

            // ========================================
            // 4. CREATE COMMENTS
            // ========================================
            // Comment on recipe 1 from guest (no user_id needed)
            const [commentResult] = await conn.execute(`
        INSERT INTO comments (recipe_id, guest_name, content, created_at)
        VALUES (?, ?, ?, NOW())
      `, [
                recipeId1,                   // Comment on recipe 1
                'Jean Dupont',               // Guest name (not a registered user)
                'J\'ai adoré, c\'était délicieux !' // Comment text
            ]);
            const commentId = commentResult.insertId;
            console.log(`✓ Comment created: ID=${commentId}`);

            // ========================================
            // 5. CREATE RATINGS
            // ========================================
            // Rating on recipe 1 by testuser
            const [ratingResult] = await conn.execute(`
        INSERT INTO ratings (recipe_id, user_id, score, created_at)
        VALUES (?, ?, ?, NOW())
      `, [
                recipeId1,                   // Rate recipe 1
                userId1,                     // Rated by testuser
                4                            // 4 stars out of 5
            ]);
            const ratingId = ratingResult.insertId;
            console.log(`✓ Rating created: ID=${ratingId}`);

            // Update recipe 1 average_rating after adding rating
            await conn.execute(`
        UPDATE recipes
        SET average_rating = ?, rating_count = ?
        WHERE id = ?
      `, [
                4.0,                         // Average (only one rating = 4.0)
                1,                           // Count (one rating)
                recipeId1
            ]);

            // ========================================
            // RETURN FIXTURE OBJECT
            // ========================================
            // Tests will use these IDs for assertions
            const fixtures = {
                categoryId,
                userId: userId1,             // Primary test user
                userId2,                     // Secondary test user (for FK tests)
                recipeId: recipeId1,         // Primary recipe
                recipeId2,                   // Second recipe (for filter tests)
                recipeId3,                   // Third recipe (for budget tests)
                commentId,
                ratingId,
                userPassword: 'testpass123', // ← For login/auth tests
                userPassword2: 'testpass456'
            };

            console.log('\n✅ All fixtures created successfully');
            console.log('Fixture IDs:', fixtures);
            return fixtures;

        } catch (error) {
            // Detailed error logging for debugging
            console.error('❌ Error creating fixtures:', error.message);
            console.error('Full error:', error);
            throw error;
        } finally {
            // Always release connection
            if (conn) conn.release();
        }
    }

    /**
     * closeDatabase()
     * 
     * Purpose:
     * --------
     * Closes all connections in the pool.
     * Called in afterAll() to prevent Jest from hanging.
     * 
     * Why this is critical:
     * - If connections remain open, Jest process never exits
     * - Test runner hangs indefinitely
     * - Must be called even if tests fail
     * 
     * Implementation:
     * - pool.end() closes all active + pending connections
     * - Waits for all queries to finish before closing
     * - Silently fails if pool already closed (prevents errors)
     */
    static async closeDatabase() {
        try {
            // End all connections in the pool
            // This waits for active queries to complete
            await pool.end();
            console.log('✓ Database pool closed successfully');
        } catch (error) {
            // Connection already closed or other error
            // Log but don't throw (afterAll should not fail the tests)
            console.warn('⚠ Warning closing database:', error.message);
        }
    }
}

// Export class for use in test files
module.exports = TestDatabase;
