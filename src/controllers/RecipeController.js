// src/controllers/RecipeController.js
//
// Handles all HTTP logic for the recipes resource.
// Business rules enforced here:
//   - Only the recipe author or an admin can update/delete a recipe.
//   - Status filtering: public routes see only 'published' recipes.
//   - Admin routes see all statuses.
// The model layer handles SQL — this layer handles HTTP + authorization.



'use strict';

const Recipe = require('../models/Recipe'); // Model handling DB logic
const { sendSuccess, sendError } = require('../utils/apiResponse'); // Standard API responses

// GET all recipes with filters
async function getAllRecipes(req, res, next) {
    try {
        const isAdmin = req.user?.role === 'admin'; // Check if user is admin

        // Build filters object
        const filters = {
            status: isAdmin ? req.query.status : 'published', // Non-admins only see published
            category_id: req.query.category_id || null,
            max_prep_time: req.query.max_prep_time ? Number(req.query.max_prep_time) : null,
            max_cost: req.query.max_cost ? Number(req.query.max_cost) : null,
            search: req.query.search || null,
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

        await Recipe.delete(req.params.id); // Soft delete

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
