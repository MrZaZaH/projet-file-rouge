// test-scripts/test-recipe-model.js
//
// Manual test script for Recipe model.
// Run with: node test-scripts/test-recipe-model.js
// Requires at least one user and one category in the database.

'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
// dotenv must be called BEFORE any import that reads process.env.
// test-scripts/ is one level below the project root where .env lives.
// path.resolve ensures we find it regardless of where node is invoked from.


const Recipe = require('../src/models/Recipe');
const { pool } = require('../src/database/connection');

async function runTests() {
    let createdRecipeId = null;
    const suffix = Date.now();

    try {
        // ── Prerequisites ────────────────────────────────────────────────────
        // Fetch a real user_id and category_id from the DB.
        // We don't hardcode IDs — they may differ between environments.
        const [users] = await pool.execute(
            'SELECT id FROM users WHERE deleted_at IS NULL LIMIT 1'
        );
        const [categories] = await pool.execute(
            'SELECT id FROM categories WHERE deleted_at IS NULL LIMIT 1'
        );

        if (!users.length || !categories.length) {
            throw new Error('No user or category found. Run seed script first.');
        }

        const userId = users[0].id;
        const categoryId = categories[0].id;

        console.log(`Using user_id=${userId}, category_id=${categoryId}\n`);

        // ── TEST 1: create ───────────────────────────────────────────────────
        console.log('TEST 1: create()');
        const created = await Recipe.create({
            user_id: userId,
            category_id: categoryId,
            title: `Test Recipe ${suffix}`,
            anecdote: 'This recipe was born out of desperation at 11pm.',
            ingredients: [{ name: 'pear', quantity: 1, unit: 'piece' }],
            steps: ['Eat the pear.', 'Feel accomplished.'],
            prep_time: 5,
            cost_per_portion: 0.50,
        });

        if (!created || !created.id) throw new Error('create() failed — no id returned');
        createdRecipeId = created.id;
        console.log(`  ✅ Created id=${created.id}, status=${created.status}`);
        console.log(`  ✅ ingredients is array: ${Array.isArray(created.ingredients)}`);
        console.log(`  ✅ steps is array:       ${Array.isArray(created.steps)}`);

        // ── TEST 2: findById ─────────────────────────────────────────────────
        console.log('\nTEST 2: findById()');
        const found = await Recipe.findById(createdRecipeId);
        if (!found) throw new Error('findById() returned null');
        console.log(`  ✅ Found: "${found.title}" by ${found.author_username}`);

        // ── TEST 3: findAllWithFilters — no filters ──────────────────────────
        console.log('\nTEST 3: findAllWithFilters() — no filters');
        const all = await Recipe.findAllWithFilters();
        console.log(`  ✅ ${all.length} recipe(s) returned`);

        // ── TEST 4: filter by status ─────────────────────────────────────────
        console.log('\nTEST 4: findAllWithFilters({ status: "pending" })');
        const pending = await Recipe.findAllWithFilters({ status: 'pending' });
        const hasPending = pending.some(r => r.id === createdRecipeId);
        console.log(`  ✅ New recipe in pending list: ${hasPending}`);

        // ── TEST 5: filter by max_prep_time ──────────────────────────────────
        console.log('\nTEST 5: findAllWithFilters({ max_prep_time: 10 })');
        const quick = await Recipe.findAllWithFilters({ max_prep_time: 10 });
        const isQuick = quick.some(r => r.id === createdRecipeId);
        console.log(`  ✅ 5-min recipe in <10min filter: ${isQuick}`);

        // ── TEST 6: filter by max_cost ───────────────────────────────────────
        console.log('\nTEST 6: findAllWithFilters({ max_cost: 1 })');
        const cheap = await Recipe.findAllWithFilters({ max_cost: 1 });
        const isCheap = cheap.some(r => r.id === createdRecipeId);
        console.log(`  ✅ 0.50€ recipe in <1€ filter: ${isCheap}`);

        // ── TEST 7: filter by search ─────────────────────────────────────────
        console.log('\nTEST 7: findAllWithFilters({ search: "Test Recipe" })');
        const searched = await Recipe.findAllWithFilters({ search: 'Test Recipe' });
        const isFound = searched.some(r => r.id === createdRecipeId);
        console.log(`  ✅ Recipe found by search: ${isFound}`);

        // ── TEST 8: update ───────────────────────────────────────────────────
        console.log('\nTEST 8: update()');
        const updated = await Recipe.update(createdRecipeId, {
            category_id: categoryId,
            title: `Updated Recipe ${suffix}`,
            anecdote: 'Updated anecdote.',
            ingredients: [{ name: 'chocolate', quantity: 50, unit: 'g' }],
            steps: ['Melt chocolate.', 'Eat it.'],
            prep_time: 3,
            cost_per_portion: 1.20,
        });
        if (updated.title !== `Updated Recipe ${suffix}`) throw new Error('update() title mismatch');
        console.log(`  ✅ Title updated: "${updated.title}"`);

        // ── TEST 9: updateStatus ─────────────────────────────────────────────
        console.log('\nTEST 9: updateStatus("published")');
        const statusOk = await Recipe.updateStatus(createdRecipeId, 'published');
        console.log(`  ✅ updateStatus returned: ${statusOk}`);
        const afterStatus = await Recipe.findById(createdRecipeId);
        console.log(`  ✅ status is now: ${afterStatus.status}`);

        // ── TEST 10: updateRating ────────────────────────────────────────────
        console.log('\nTEST 10: updateRating(score=4)');
        await Recipe.updateRating(createdRecipeId, 4);
        const afterRating = await Recipe.findById(createdRecipeId);
        console.log(`  ✅ average_rating: ${afterRating.average_rating}, rating_count: ${afterRating.rating_count}`);

        // ── TEST 11: findRandom ──────────────────────────────────────────────
        console.log('\nTEST 11: findRandom()');
        const random = await Recipe.findRandom();
        // Could be null if no published recipe exists yet — acceptable.
        console.log(`  ✅ findRandom returned: ${random ? `id=${random.id}` : 'null (no published recipes)'}`);

        // ── TEST 12: soft delete ─────────────────────────────────────────────
        console.log('\nTEST 12: delete()');
        const deleted = await Recipe.delete(createdRecipeId);
        console.log(`  ✅ delete() returned: ${deleted}`);
        const afterDelete = await Recipe.findById(createdRecipeId);
        console.log(`  ✅ findById after delete: ${afterDelete === null ? 'null ✅' : 'still visible ❌'}`);

        console.log('\n─────────────────────────────────────');
        console.log('All tests passed.');

    } catch (err) {
        console.error('\n❌ Test failed:', err.message);

        // Cleanup: soft-delete the test recipe if something blew up mid-run
        if (createdRecipeId) {
            await Recipe.delete(createdRecipeId).catch(() => { });
            console.log(`  Cleaned up recipe id=${createdRecipeId}`);
        }
    } finally {
        await pool.end();
    }
}

runTests();
