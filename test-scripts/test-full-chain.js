// test-scripts/test-full-chain.js
//
// Integration test: full user chain.
// Simulates: create recipe → add comment → rate → verify points.
// IDEMPOTENT: cleans up all created data in finally block.
// Run: node test-scripts/test-full-chain.js

'use strict';

require('dotenv').config();


const Recipe = require('../src/models/Recipe');
const Comment = require('../src/models/Comment');
const Rating = require('../src/models/Rating');
const User = require('../src/models/User');
const { pool } = require('../src/database/connection');

let passed = 0;
let failed = 0;

// IDs created during the test — collected here for teardown
const created = { recipeId: null, commentId: null };

function assert(condition, label) {
    if (condition) { console.log(`  ✅ ${label}`); passed++; }
    else { console.error(`  ❌ ${label}`); failed++; }
}

async function teardown() {
    const conn = await pool.getConnection();
    try {
        // Delete in FK order: ratings → comments → recipes
        if (created.recipeId) {
            await conn.query('DELETE FROM ratings  WHERE recipe_id = ?', [created.recipeId]);
            await conn.query('DELETE FROM comments WHERE recipe_id = ?', [created.recipeId]);
            await conn.query('DELETE FROM recipes  WHERE id = ?', [created.recipeId]);
        }
        // Reset points for user 2 (author used in this test)
        await conn.query('UPDATE users SET points = 0 WHERE id = 2');
        console.log('\n  [teardown] DB restored to seed state.');
    } finally {
        conn.release();
    }
}

async function run() {
    console.log('\n=== Full chain test: recipe → comment → rating → points ===\n');

    // ── Step 1: create recipe ────────────────────────────────────────────────
    console.log('── Step 1: Recipe.create() ──');
    const recipe = await Recipe.create({
        user_id: 2,
        category_id: 1,
        title: 'Chain Test Recipe',
        ingredients: ['ingredient A', 'ingredient B'],
        steps: ['step 1', 'step 2'],
        anecdote: 'Created by the full-chain test.',
        prep_time: 10,
        cost_per_portion: 1.50,
    });
    created.recipeId = recipe.id;

    assert(recipe.id > 0, 'recipe created with a valid id');
    assert(recipe.status === 'pending', 'recipe starts as pending');
    assert(recipe.title === 'Chain Test Recipe', 'recipe title is correct');

    // ── Step 2: publish it (required for comment/rating) ────────────────────
    console.log('\n── Step 2: Recipe.updateStatus() → published ──');
    const published = await Recipe.updateStatus(recipe.id, 'published');
    assert(published === true, 'recipe published successfully');

    // ── Step 3: add a comment ────────────────────────────────────────────────
    console.log('\n── Step 3: Comment.create() ──');
    const comment = await Comment.create({
        recipe_id: recipe.id,
        user_id: 1,
        guest_name: null,
        content: 'Looks great from the chain test.',
    });
    created.commentId = comment.id;

    assert(comment.id > 0, 'comment created with valid id');
    assert(comment.recipe_id === recipe.id, 'comment linked to correct recipe');
    assert(comment.user_id === 1, 'comment linked to correct user');

    // ── Step 4: rate the recipe (user 1 rates recipe authored by user 2) ─────
    console.log('\n── Step 4: Rating.rate() — score 5 ──');
    const authorBefore = await User.findById(2);
    const rating = await Rating.rate({ userId: 1, recipeId: recipe.id, score: 5 });
    const authorAfter = await User.findById(2);

    assert(rating.isNew === true, 'rating is new');
    assert(rating.pointsAwarded === true, 'points awarded for score >= 4');
    assert(authorAfter.points === authorBefore.points + 5, 'author received +5 points');

    // ── Step 5: verify average_rating updated on recipe ──────────────────────
    console.log('\n── Step 5: average_rating updated on recipe ──');
    const updated = await Recipe.findById(recipe.id);
    assert(parseFloat(updated.average_rating) === 5.00, 'average_rating is 5.00 after one vote');
    assert(updated.rating_count === 1, 'rating_count is 1');

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
}

run()
    .catch(err => console.error('Unexpected error:', err))
    .finally(async () => {
        await teardown();
        await pool.end();
        process.exit(failed > 0 ? 1 : 0);
    });
