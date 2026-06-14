// src/controllers/RatingController.js
//
// HTTP logic for ratings.
// Only logged-in users can rate (we need a stable identity for the unique constraint).
// A user cannot rate their own recipe — rewarding your own content is pointless.


'use strict';

const Rating = require('../models/Rating'); // Rating model
const Recipe = require('../models/Recipe'); // Recipe model
const { sendSuccess, sendError } = require('../utils/apiResponse'); // Response helpers

// POST rate a recipe
async function rateRecipe(req, res, next) {
    try {
        const recipeId = Number(req.params.recipeId); // Extract recipe ID
        const userId = req.user.id; // Authenticated user ID
        const score = Number(req.body.score); // Rating score

        const recipe = await Recipe.findById(recipeId);

        // Ensure recipe exists and is published
        if (!recipe || recipe.status !== 'published') {
            return sendError(res, 'Recipe not found.', 404);
        }

        // Prevent users from rating their own recipes
        if (recipe.user_id === userId) {
            return sendError(res, 'You cannot rate your own recipe.', 403);
        }

        // Create or update rating
        const result = await Rating.rate({ userId, recipeId, score });

        return sendSuccess(
            res,
            {
                rating: result.rating,
                isNew: result.isNew,
                pointsAwarded: result.pointsAwarded
            },
            result.isNew ? 'Rating created' : 'Rating updated',
            result.isNew ? 201 : 200
        );

    } catch (err) {
        // Handle race condition (duplicate rating)
        if (err.code === 'ER_DUP_ENTRY') {
            return sendError(res, 'Rating conflict. Please retry.', 409);
        }
        next(err);
    }
}

module.exports = { rateRecipe };
