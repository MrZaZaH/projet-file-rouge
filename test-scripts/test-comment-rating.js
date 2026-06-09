// test-scripts/test-comment-rating.js
//
// Manual integration tests for Comment.js and Rating.js.
// Run: node test-scripts/test-comment-rating.js
// Requires: seeded database (04_seed_data.sql already run).
//
// IDEMPOTENT: this test cleans up after itself.
// It can be run multiple times without manual DB reset.

'use strict';

require('dotenv').config();
const Comment = require('../src/models/Comment');
const Rating = require('../src/models/Rating');
const User = require('../src/models/User');
const { pool } = require('../src/database/connection');

let passed = 0;
let failed = 0;

function assert(condition, label) {
    if (condition) {
        console.log(`  ✅ ${label}`);
        passed++;
    } else {
        console.error(`  ❌ ${label}`);
        failed++;
    }
}

// ── TEARDOWN ─────────────────────────────────────────────────────────────────
// Restores the DB to its seed state after each run.
// Called in both success and error paths.
async function teardown() {
    const conn = await pool.getConnection();
    try {
        // Restore rating modified by the "update" test (user 1 / recipe 1 → score 5)
        await conn.execute(
            'UPDATE ratings SET score = 5, updated_at = NOW() WHERE user_id = 1 AND recipe_id = 1'
        );
        // Remove ratings inserted by this test run
        await conn.execute(
            'DELETE FROM ratings WHERE user_id = 2 AND recipe_id = 7'
        );
        await conn.execute(
            'DELETE FROM ratings WHERE user_id = 3 AND recipe_id = 7'
        );
        // Reset all points to 0 (seed state)
        await conn.execute('UPDATE users SET points = 0');

        // Hard-delete comments inserted by this test (soft-deleted or guest)
        // We target comments with our specific test content to avoid touching real data
        await conn.execute(
            `DELETE FROM comments WHERE content IN (
                'Test comment from logged-in user — day 9 test run.',
                'Test comment from guest — day 9 test run.'
            )`
        );
    } finally {
        conn.release();
    }
}

// ── TESTS ─────────────────────────────────────────────────────────────────────
async function run() {
    console.log('\n=== Day 9 — Comment & Rating model tests ===\n');

    // ── COMMENT TESTS ────────────────────────────────────────────────────────

    console.log('── Comment.findByRecipeId ──');
    const comments = await Comment.findByRecipeId(1);
    assert(Array.isArray(comments), 'returns an array');
    assert(comments.length >= 1, 'recipe 1 has at least one comment');
    assert('content' in comments[0], 'comment has content field');
    assert('created_at' in comments[0], 'comment has created_at field');

    console.log('\n── Comment.create (logged-in user) ──');
    const newComment = await Comment.create({
        recipe_id: 1,
        user_id: 2,
        content: 'Test comment from logged-in user — day 9 test run.'
    });
    assert(newComment !== null, 'returns created comment');
    assert(newComment.user_id === 2, 'user_id is correct');
    assert(newComment.guest_name === null, 'guest_name is null for logged-in user');
    assert(newComment.author_username === 'sofia_r', 'username is joined correctly');

    console.log('\n── Comment.create (guest) ──');
    const guestComment = await Comment.create({
        recipe_id: 1,
        guest_name: 'TestGuest',
        content: 'Test comment from guest — day 9 test run.'
    });
    assert(guestComment !== null, 'returns created guest comment');
    assert(guestComment.user_id === null, 'user_id is null for guest');
    assert(guestComment.guest_name === 'TestGuest', 'guest_name is set');

    console.log('\n── Comment.delete ──');
    const deleted = await Comment.delete(newComment.id);
    assert(deleted === true, 'soft delete returns true');
    const deletedAgain = await Comment.delete(newComment.id);
    assert(deletedAgain === false, 'deleting already-deleted returns false');

    // ── RATING TESTS ─────────────────────────────────────────────────────────

    console.log('\n── Rating.findByUserAndRecipe ──');
    const existingRating = await Rating.findByUserAndRecipe(1, 1);
    assert(existingRating !== null, 'finds existing rating from seed');
    assert(existingRating.score === 5, 'seed score is correct (5)');

    const noRating = await Rating.findByUserAndRecipe(1, 99);
    assert(noRating === null, 'returns null for non-existent rating');

    console.log('\n── Rating.rate (new rating — user 2 rates recipe 7) ──');
    // Recipe 7 author is user 4
    const authorBefore = await User.findById(4);
    const result = await Rating.rate({ userId: 2, recipeId: 7, score: 4 });
    assert(result.isNew === true, 'first rating is marked as new');
    assert(result.pointsAwarded === true, 'points awarded for score >= 4');
    const authorAfter = await User.findById(4);
    assert(
        authorAfter.points === authorBefore.points + 5,
        `author points increased by 5 (was ${authorBefore.points}, now ${authorAfter.points})`
    );

    console.log('\n── Rating.rate (update — user 1 re-rates recipe 1) ──');
    const updateResult = await Rating.rate({ userId: 1, recipeId: 1, score: 3 });
    assert(updateResult.isNew === false, 'update is not marked as new');
    assert(updateResult.pointsAwarded === false, 'no points awarded on update');

    console.log('\n── Rating.rate (new rating, score < 4 — no points) ──');
    const r4Before = await User.findById(4);
    const lowScore = await Rating.rate({ userId: 3, recipeId: 7, score: 2 });
    const r4After = await User.findById(4);
    assert(lowScore.isNew === true, 'new rating with low score');
    assert(lowScore.pointsAwarded === false, 'no points for score < 4');
    assert(r4After.points === r4Before.points, 'author points unchanged for score < 4');

    // ── SUMMARY ──────────────────────────────────────────────────────────────
    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
}

// ── ENTRY POINT ───────────────────────────────────────────────────────────────
run()
    .catch(err => {
        console.error('Unexpected error:', err);
    })
    .finally(async () => {
        // teardown runs whether the tests passed or crashed
        await teardown();
        await pool.end();
        process.exit(failed > 0 ? 1 : 0);
    });
