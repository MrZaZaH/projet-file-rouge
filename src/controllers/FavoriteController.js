'use strict';

const Favorite = require('../models/Favorite');
const Recipe = require('../models/Recipe');
const { sendSuccess, sendError } = require('../utils/apiResponse');

class FavoriteController {

    static async toggle(req, res, next) {
        try {
            const userId = Number(req.user.id);
            const recipeId = Number(req.params.recipeId);

            if (!recipeId || recipeId < 1) {
                return sendError(res, 'Invalid recipe ID', 400);
            }

            const recipe = await Recipe.findById(recipeId);
            if (!recipe) {
                return sendError(res, 'Recipe not found', 404);
            }

            const result = await Favorite.toggle(userId, recipeId);

            return sendSuccess(res, {
                favorited: result.favorited,
                recipe_id: recipeId,
            });

        } catch (error) {
            next(error);
        }
    }

    static async getMyFavorites(req, res, next) {
        try {
            const userId = Number(req.user.id);
            const favorites = await Favorite.findByUserId(userId);
            return sendSuccess(res, favorites);
        } catch (error) {
            next(error);
        }
    }
}

module.exports = FavoriteController;
