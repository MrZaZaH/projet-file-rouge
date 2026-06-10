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

// ─── GET /api/v1/recipes ──────────────────────────────────────────────────────
// Public. Accepts query params: status, category_id, max_prep_time, max_cost, search.
// Forces status = 'published' for non-admins.
async function getAllRecipes(req, res, next) {
    try {
        const isAdmin = req.user?.role === 'admin';

        const filters = {
            // Non-admins can only see published recipes, period.
            // An admin can pass ?status=pending to review the queue.
            status: isAdmin ? req.query.status : 'published',

            category_id: req.query.category_id || null,
            max_prep_time: req.query.max_prep_time ? Number(req.query.max_prep_time) : null,
            max_cost: req.query.max_cost ? Number(req.query.max_cost) : null,
            search: req.query.search || null,
        };

        // Strip null values so the model doesn't apply empty filters.
        // Object.entries + filter + Object.fromEntries = clean object without nulls.
        const cleanFilters = Object.fromEntries(
            Object.entries(filters).filter(([, v]) => v !== null)
        );

        const recipes = await Recipe.findAllWithFilters(cleanFilters);
        res.json({ data: recipes });
    } catch (err) {
        next(err);
        // Always pass errors to next() — the errorHandler middleware formats the response.
        // Never catch and respond manually, or error logs break.
    }
}

// ─── GET /api/v1/recipes/random ───────────────────────────────────────────────
// Public. Returns one random published recipe (US-01 "Surprends-moi").
async function getRandomRecipe(req, res, next) {
    try {
        const recipe = await Recipe.findRandom();
        if (!recipe) {
            return res.status(404).json({ message: 'No published recipe found.' });
        }
        res.json({ data: recipe });
    } catch (err) {
        next(err);
    }
}

// ─── GET /api/v1/recipes/:id ──────────────────────────────────────────────────
// Public. Returns full recipe detail (ingredients, steps, author, category).
// Soft-deleted recipes return 404.
async function getRecipeById(req, res, next) {
    try {
        const recipe = await Recipe.findById(req.params.id);
        if (!recipe) {
            return res.status(404).json({ message: 'Recipe not found.' });
        }

        // Non-admins cannot access non-published recipes by direct ID either.
        const isAdmin = req.user?.role === 'admin';
        if (!isAdmin && recipe.status !== 'published') {
            return res.status(404).json({ message: 'Recipe not found.' });
            // Deliberately 404, not 403 — don't leak that the recipe exists.
        }

        res.json({ data: recipe });
    } catch (err) {
        next(err);
    }
}

// ─── POST /api/v1/recipes ─────────────────────────────────────────────────────
// Protected (any authenticated user).
// Validation is handled by express-validator in the route file.
async function createRecipe(req, res, next) {
    try {
        const { category_id, title, anecdote, ingredients, steps, prep_time, cost_per_portion } = req.body;

        const recipe = await Recipe.create({
            user_id: req.user.id,
            // req.user is set by the authenticate middleware (jwtAuth.js).
            // If we're here, the token is valid — req.user.id is trustworthy.
            category_id,
            title,
            anecdote,
            ingredients,
            steps,
            prep_time,
            cost_per_portion,
        });

        res.status(201).json({ data: recipe });
    } catch (err) {
        next(err);
    }
}

// ─── PUT /api/v1/recipes/:id ──────────────────────────────────────────────────
// Protected. Author or admin only.
// An admin can edit any recipe. A user can only edit their own.
async function updateRecipe(req, res, next) {
    try {
        const recipe = await Recipe.findById(req.params.id);

        if (!recipe) {
            return res.status(404).json({ message: 'Recipe not found.' });
        }

        // Authorization check: is the requester the author OR an admin?
        const isAdmin = req.user.role === 'admin';
        const isAuthor = recipe.user_id === req.user.id;

        if (!isAdmin && !isAuthor) {
            return res.status(403).json({ message: 'Forbidden.' });
            // 403 here (not 404) because the user knows the recipe exists — they got here legitimately.
        }

        const { category_id, title, anecdote, ingredients, steps, prep_time, cost_per_portion } = req.body;

        const updated = await Recipe.update(req.params.id, {
            category_id,
            title,
            anecdote,
            ingredients,
            steps,
            prep_time,
            cost_per_portion,
        });

        res.json({ data: updated });
    } catch (err) {
        next(err);
    }
}

// ─── DELETE /api/v1/recipes/:id ───────────────────────────────────────────────
// Protected. Author or admin only. Soft delete.
async function deleteRecipe(req, res, next) {
    try {
        const recipe = await Recipe.findById(req.params.id);

        if (!recipe) {
            return res.status(404).json({ message: 'Recipe not found.' });
        }

        const isAdmin = req.user.role === 'admin';
        const isAuthor = recipe.user_id === req.user.id;

        if (!isAdmin && !isAuthor) {
            return res.status(403).json({ message: 'Forbidden.' });
        }

        await Recipe.delete(req.params.id);
        res.status(204).send();
        // 204 No Content = success, nothing to return.
    } catch (err) {
        next(err);
    }
}

module.exports = { getAllRecipes, getRandomRecipe, getRecipeById, createRecipe, updateRecipe, deleteRecipe };
