// scripts/test-models.js
// Manual test script — run with: node scripts/test-models.js
// Tests Category and User models against the development database
// NOT a replacement for automated tests — just a quick sanity check

require('dotenv').config();
const Category = require('../src/models/Category');
const User = require('../src/models/User');
const bcrypt = require('bcryptjs');
const { pool } = require('../src/database/connection');

async function runTests() {
    console.log('=== Starting model tests ===\n');

    try {
        // ── Category tests ──────────────────────────────────────────────────────

        console.log('--- Category.findAll() ---');
        const categories = await Category.findAll();
        console.log(`Found ${categories.length} categories`);
        console.log(categories);

        console.log('\n--- Category.findById(1) ---');
        const cat = await Category.findById(1);
        console.log(cat);

        console.log('\n--- Category.findById(99999) --- (should return null)');
        const notFound = await Category.findById(99999);
        console.log(notFound); // Expected: null

        console.log('\n--- Category.create() ---');
        const newCat = await Category.create({
            name: 'Test Category ' + Date.now()
            // No description — column does not exist in the schema
        });
        console.log('Created:', newCat);

        console.log('\n--- Category.update() ---');
        const updatedName = 'Updated Category ' + Date.now();

        const updated = await Category.update(newCat.id, {
            name: updatedName
        });
        console.log('Updated:', updated);

        console.log('\n--- Category.delete() ---');
        const deleted = await Category.delete(newCat.id);
        console.log('Deleted (should be true):', deleted);

        const afterDelete = await Category.findById(newCat.id);
        console.log('After soft delete (should be null):', afterDelete);

        // ── User tests ──────────────────────────────────────────────────────────

        console.log('\n--- User.findAll() ---');
        const users = await User.findAll();
        console.log(`Found ${users.length} users`);

        console.log('\n--- User.create() ---');
        const hash = await bcrypt.hash('TestPassword123!', 12);
        const newUser = await User.create({
            username: 'testuser_' + Date.now(),
            email: `test_${Date.now()}@example.com`,
            password_hash: hash
        });
        console.log('Created user (no password):', newUser);

        console.log('\n--- User.findById() ---');
        const foundUser = await User.findById(newUser.id);
        console.log(foundUser);

        console.log('\n--- User.addPoints() ---');
        await User.addPoints(newUser.id, 10);
        const afterPoints = await User.findById(newUser.id);
        console.log('Points after +10:', afterPoints.points); // Expected: 10

        console.log('\n--- User.delete() ---');
        await User.delete(newUser.id);
        const afterUserDelete = await User.findById(newUser.id);
        console.log('After soft delete (should be null):', afterUserDelete);

        console.log('\n=== All tests passed ===');

    } catch (err) {
        console.error('\n❌ Test failed:', err.message);
        console.error(err);
    } finally {
        // Close the pool — otherwise the script hangs forever waiting for connections
        await pool.end();
        console.log('\nPool closed.');
    }
}

runTests();
