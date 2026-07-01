// src/controllers/RecipeController.js
//
// Handles all HTTP logic for the recipes resource.
// Business rules enforced here:
//   - Only the recipe author or an admin can update/delete a recipe.
//   - Status filtering: public routes see only 'published' recipes.
//   - Admin routes see all statuses.
// The model layer handles SQL — this layer handles HTTP + authorization.



'use strict';

const Recipe = require('../models/Recipe');
const Favorite = require('../models/Favorite');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { pool } = require('../database/connection');
const { logger } = require('../middlewares/logger');


// GET all recipes with filters
async function getAllRecipes(req, res, next) {
    try {
        const isAdmin = req.user?.role === 'admin'; // Check if user is admin

        // Build filters object
        // Only include keys that findAllWithFilters() explicitly supports.
        // search is excluded — text search is not part of the MVP (filter-based navigation only).
        const filters = {
            status: isAdmin ? req.query.status : 'published',
            category_id: req.query.category_id ? Number(req.query.category_id) : null,
            max_prep_time: req.query.max_prep_time ? Number(req.query.max_prep_time) : null,
            max_cost: req.query.max_cost ? Number(req.query.max_cost) : null,
            min_rating: req.query.min_rating ? Number(req.query.min_rating) : null,
            limit: req.query.limit ? Number(req.query.limit) : null,
            offset: req.query.offset ? Number(req.query.offset) : null,
        };


        // Remove null values from filters
        const cleanFilters = Object.fromEntries(
            Object.entries(filters).filter(([, v]) => v !== null)
        );

        const recipes = await Recipe.findAllWithFilters(cleanFilters); // Fetch recipes

        return sendSuccess(res, recipes); // Return standardized response

    } catch (err) {
        next(err); // Pass error to global handler
    }
}

// GET random recipe
async function getRandomRecipe(req, res, next) {
    try {
        const recipe = await Recipe.findRandom(); // Fetch random recipe

        if (!recipe) {
            return sendError(res, 'No published recipe found.', 404);
        }

        return sendSuccess(res, recipe);

    } catch (err) {
        next(err);
    }
}

// GET recipe by ID
async function getRecipeById(req, res, next) {
    try {
        const recipe = await Recipe.findById(req.params.id); // Fetch recipe

        if (!recipe) {
            return sendError(res, 'Recipe not found.', 404);
        }

        const isAdmin = req.user?.role === 'admin';

        // Prevent access to unpublished recipes for non-admins
        if (!isAdmin && recipe.status !== 'published') {
            return sendError(res, 'Recipe not found.', 404);
        }
        // Attach is_favorited if user is authenticated
        if (req.user) {
            recipe.is_favorited = await Favorite.isFavorited(req.user.id, recipe.id);
        }

        // Increment view counter — fire and forget, don't block the response
        const id = req.params.id;
        pool.query(
            'UPDATE recipes SET views = views + 1 WHERE id = ?',
            [id]
        ).catch(err =>
            logger.warn(`Failed to increment views for recipe ${id}: ${err.message}`)
        );

        return sendSuccess(res, recipe);

    } catch (err) {
        next(err);
    }
}

// CREATE recipe
async function createRecipe(req, res, next) {
    try {
        const {
            category_id,
            title,
            anecdote,
            ingredients,
            steps,
            prep_time,
            cost_per_portion
        } = req.body;

        // Create recipe linked to authenticated user
        const recipe = await Recipe.create({
            user_id: req.user.id,
            category_id,
            title,
            anecdote,
            ingredients,
            steps,
            prep_time,
            cost_per_portion,
        });

        return sendSuccess(res, recipe, 'Recipe submitted for review.', 201);

    } catch (err) {
        next(err);
    }
}

// UPDATE recipe
async function updateRecipe(req, res, next) {
    try {
        const recipe = await Recipe.findById(req.params.id);

        if (!recipe) {
            return sendError(res, 'Recipe not found.', 404);
        }

        const isAdmin = req.user.role === 'admin';
        const isAuthor = recipe.user_id === req.user.id;

        // Only admin or author can update
        if (!isAdmin && !isAuthor) {
            return sendError(res, 'Forbidden.', 403);
        }

        const {
            category_id,
            title,
            anecdote,
            ingredients,
            steps,
            prep_time,
            cost_per_portion
        } = req.body;

        const updated = await Recipe.update(req.params.id, {
            category_id,
            title,
            anecdote,
            ingredients,
            steps,
            prep_time,
            cost_per_portion,
        });

        return sendSuccess(res, updated);

    } catch (err) {
        next(err);
    }
}

// DELETE recipe
async function deleteRecipe(req, res, next) {
    try {
        const recipe = await Recipe.findById(req.params.id);

        if (!recipe) {
            return sendError(res, 'Recipe not found.', 404);
        }

        const isAdmin = req.user.role === 'admin';
        const isAuthor = recipe.user_id === req.user.id;

        // Only admin or author can delete
        if (!isAdmin && !isAuthor) {
            return sendError(res, 'Forbidden.', 403);
        }

        await Recipe.softDelete(req.params.id); // Soft delete

        // If admin deletes, notify author and log
        if (isAdmin) {
            const message = `Votre recette "${recipe.title}" a été supprimée par un administrateur.`;
            await pool.query(
                `INSERT INTO user_notifications (user_id, type, message, recipe_id, created_at)
                 VALUES (?, ?, ?, ?, NOW())`,
                [recipe.user_id, 'recipe_deleted', message, Number(req.params.id)]
            );
            await pool.query(
                `INSERT INTO admin_logs (admin_id, action, recipe_id, target_type, target_id, created_at)
                 VALUES (?, ?, ?, ?, ?, NOW())`,
                [req.user.id, 'recipe_deleted', Number(req.params.id), 'recipe', Number(req.params.id)]
            );
        }

        return sendSuccess(res, null, 'Recipe deleted.', 200);

    } catch (err) {
        next(err);
    }
}

module.exports = {
    getAllRecipes,
    getRandomRecipe,
    getRecipeById,
    createRecipe,
    updateRecipe,
    deleteRecipe
};
