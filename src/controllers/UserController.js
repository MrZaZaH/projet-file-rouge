// src/controllers/UserController.js
//
// User dashboard endpoints.
// Returns profile stats and user's recipes for the front-end dashboard.

'use strict';

const { pool } = require('../database/connection');
const User = require('../models/User');
const Recipe = require('../models/Recipe');
const Favorite = require('../models/Favorite');
const { sendSuccess, sendError } = require('../utils/apiResponse');

class UserController {

    // GET /api/v1/users/me/profile
    static async getProfile(req, res, next) {
        try {
            const userId = Number(req.user.id);

            const user = await User.findById(userId);
            if (!user) {
                return sendError(res, 'User not found', 404);
            }

            const [statsRows] = await pool.execute(
                `SELECT
                    COUNT(*) AS total_recipes,
                    COALESCE(SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END), 0) AS published_recipes,
                    COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_recipes,
                    COALESCE(SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END), 0) AS rejected_recipes
                 FROM recipes
                 WHERE user_id = ? AND deleted_at IS NULL`,
                [userId]
            );
            const stats = statsRows[0];

            const [commentRows] = await pool.execute(
                `SELECT COALESCE(COUNT(*), 0) AS total
                 FROM comments c
                 JOIN recipes r ON c.recipe_id = r.id
                 WHERE r.user_id = ? AND r.deleted_at IS NULL AND c.deleted_at IS NULL`,
                [userId]
            );

            const favoriteCount = await Favorite.countByUserId(userId);

            const result = {
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    created_at: user.created_at,
                },
                stats: {
                    total_recipes: Number(stats.total_recipes ?? 0),
                    published_recipes: Number(stats.published_recipes ?? 0),
                    pending_recipes: Number(stats.pending_recipes ?? 0),
                    rejected_recipes: Number(stats.rejected_recipes ?? 0),
                    total_comments_received: Number(commentRows[0].total ?? 0),
                    favorite_count: favoriteCount,
                }
            };

            return sendSuccess(res, result);

        } catch (error) {
            next(error);
        }
    }

    // GET /api/v1/users/me/recipes
    static async getMyRecipes(req, res, next) {
        try {
            const recipes = await Recipe.findByUserId(req.user.id);
            return sendSuccess(res, recipes);
        } catch (error) {
            next(error);
        }
    }
}

module.exports = UserController;
