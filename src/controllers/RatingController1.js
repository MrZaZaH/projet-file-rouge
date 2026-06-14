express// src/controllers/RatingController.js
//
// HTTP logic for ratings.
// Only logged-in users can rate (we need a stable identity for the unique constraint).
// A user cannot rate their own recipe — rewarding your own content is pointless.

'use strict';

const Rating = require('../models/Rating');
const Recipe = require('../models/Recipe');

// POST /api/v1/recipes/:recipeId/ratings
// Protected. Creates or updates a rating.
async function rateRecipe(req, res, next) {
    try {
        const recipeId = Number(req.params.recipeId);
        const userId = req.user.id;
        const score = Number(req.body.score);

        const recipe = await Recipe.findById(recipeId);
        if (!recipe || recipe.status !== 'published') {
            return res.status(404).json({ message: 'Recipe not found.' });
        }

        // Prevent self-rating.
        if (recipe.user_id === userId) {
            return res.status(403).json({ message: 'You cannot rate your own recipe.' });
        }

        const result = await Rating.rate({ userId, recipeId, score });

        return res.status(result.isNew ? 201 : 200).json({
            data: result.rating,
            isNew: result.isNew,
            pointsAwarded: result.pointsAwarded,
        });
        // 201 = new rating created, 200 = existing rating updated.
        // The client can use isNew to show "Thanks for rating!" vs "Rating updated".

    } catch (err) {
        // The DB unique constraint can fire in a race condition (two simultaneous
        // first-time ratings). Catch that specific error and return 409.
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Rating conflict. Please retry.' });
        }
        next(err);
    }
}

module.exports = { rateRecipe };
