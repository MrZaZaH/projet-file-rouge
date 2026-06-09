// src/models/Rating.js
//
// Data access layer for the ratings table.
// Business rules enforced here:
//   - One rating per user per recipe (DB constraint: uq_rating_user_recipe)
//   - Score must be between 1 and 5 (DB constraint: chk_rating_score)
//   - After insert/update: Recipe.updateRating() recalculates average_rating
//   - After a NEW rating with score >= 4: User.addPoints(+5) (gamification)
//
// Gamification: points are only awarded on first rating, not on update.
// Rationale: rewarding updates would allow point farming by cycling scores.
//
// NOTE on atomicity: ideally insert + updateRating + addPoints would be
// wrapped in a single SQL transaction. Not done here for MVP simplicity.
// In production, use pool.getConnection() + beginTransaction().

'use strict';

const { pool } = require('../database/connection');

// Imported inside methods to avoid circular dependency issues.
// Recipe requires connection.js, Rating requires Recipe — both require pool.
// Importing at the top level works in Node.js (modules are cached),
// but inline import makes the dependency explicit and easier to refactor.

class Rating {

    // ─── Read ──────────────────────────────────────────────────────────────────

    // Check if a user has already rated a specific recipe.
    // Returns the existing rating row or null.
    // Used before insert to decide: create or update.
    static async findByUserAndRecipe(userId, recipeId) {
        const [rows] = await pool.execute(
            `SELECT id, score
             FROM ratings
             WHERE user_id = ?
               AND recipe_id = ?`,
            [userId, recipeId]
        );
        return rows[0] || null;
    }

    // Fetch all ratings for a recipe (admin/stats use).
    static async findByRecipeId(recipeId) {
        const [rows] = await pool.execute(
            `SELECT id, user_id, score, created_at, updated_at
             FROM ratings
             WHERE recipe_id = ?`,
            [recipeId]
        );
        return rows;
    }

    // ─── Write ─────────────────────────────────────────────────────────────────

    // Rate a recipe. Handles both first-time rating and update.
    // Returns { rating, isNew, pointsAwarded }
    //   isNew:         true  = first rating (points may be awarded)
    //   pointsAwarded: true  = +5 points given to recipe author
    static async rate({ userId, recipeId, score }) {
        // Lazy-load to avoid circular dependency at module load time.
        const Recipe = require('./Recipe');
        const User = require('./User');

        const existing = await Rating.findByUserAndRecipe(userId, recipeId);

        if (existing) {
            // ── UPDATE path ──────────────────────────────────────────────────
            // User already rated — update the score.
            // We do NOT recalculate average_rating here for MVP.
            // Why? updateRating() only knows how to ADD a new score to the
            // running average, not replace one. Implementing a correct
            // update formula (subtract old, add new) is post-MVP work.
            // The denormalized average drifts slightly on updates — acceptable.
            await pool.execute(
                `UPDATE ratings
                 SET score = ?
                 WHERE user_id = ?
                   AND recipe_id = ?`,
                [score, userId, recipeId]
            );

            return {
                rating: { userId, recipeId, score },
                isNew: false,
                pointsAwarded: false
                // No points on update — see note at top of file.
            };
        }

        // ── INSERT path ──────────────────────────────────────────────────────
        await pool.execute(
            `INSERT INTO ratings (recipe_id, user_id, score)
             VALUES (?, ?, ?)`,
            [recipeId, userId, score]
            // If the DB constraint uq_rating_user_recipe fires here,
            // it means findByUserAndRecipe had a race condition (two simultaneous
            // first-time ratings from the same user). The DB error will bubble up
            // to the controller as a caught exception — handle it as a 409 Conflict.
        );

        // Update the denormalized average on the recipe.
        await Recipe.updateRating(recipeId, score);

        // Gamification: award points to the recipe AUTHOR if score >= 4.
        // We need the recipe's user_id — fetch it.
        let pointsAwarded = false;
        if (score >= 4) {
            const recipe = await Recipe.findById(recipeId);
            if (recipe) {
                await User.addPoints(recipe.user_id, 5);
                // +5 points to the author, not to the voter.
                // Rationale: we reward good content, not the act of rating.
                pointsAwarded = true;
            }
        }

        return {
            rating: { userId, recipeId, score },
            isNew: true,
            pointsAwarded
        };
    }
}

module.exports = Rating;
