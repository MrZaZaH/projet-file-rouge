// src/routes/recipeRoutes.js
//
// Recipe routes with input validation via express-validator.
// Public routes: GET (list, random, detail).
// Protected routes: POST, PUT, DELETE — require valid JWT.

'use strict';

const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { authenticate, attachUser } = require('../middlewares/jwtAuth');
const RecipeController = require('../controllers/RecipeController');

const router = express.Router();

// ─── Reusable validation middleware ──────────────────────────────────────────
// Reads the result of express-validator checks and returns 422 if anything failed.
// 422 Unprocessable Entity = "the request is well-formed but semantically wrong".
function validate(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }
    next();
}

// ─── Body validation rules (shared between create and update) ─────────────
const recipeBodyRules = [
    body('title')
        .trim()
        .notEmpty().withMessage('Title is required.')
        .isLength({ max: 255 }).withMessage('Title must be 255 characters or fewer.'),

    body('anecdote')
        .trim()
        .notEmpty().withMessage('Anecdote is required.')
        // Core value of the project — a recipe without a story gets rejected.
        .isLength({ min: 20 }).withMessage('Anecdote must be at least 20 characters.'),

    body('category_id')
        .notEmpty().withMessage('Category is required.')
        .isInt({ min: 1 }).withMessage('category_id must be a positive integer.'),

    body('ingredients')
        .isArray({ min: 1 }).withMessage('ingredients must be a non-empty array.'),

    body('ingredients.*')
        .trim()
        .notEmpty().withMessage('Each ingredient must be a non-empty string.'),

    body('steps')
        .isArray({ min: 1 }).withMessage('steps must be a non-empty array.'),

    body('steps.*')
        .trim()
        .notEmpty().withMessage('Each step must be a non-empty string.'),

    body('prep_time')
        .isInt({ min: 1 }).withMessage('prep_time must be a positive integer (minutes).'),

    body('cost_per_portion')
        .isFloat({ min: 0.01 }).withMessage('cost_per_portion must be a positive number.'),
];

// ─── Routes ───────────────────────────────────────────────────────────────────

// Public
router.get('/', RecipeController.getAllRecipes);
router.get('/random', RecipeController.getRandomRecipe);
// /random MUST be declared before /:id — otherwise Express matches "random" as an id.
router.get('/:id', attachUser, RecipeController.getRecipeById);

// Protected
router.post(
    '/',
    authenticate,
    recipeBodyRules,
    validate,
    RecipeController.createRecipe
);

router.put(
    '/:id',
    authenticate,
    recipeBodyRules,
    validate,
    RecipeController.updateRecipe
);

router.delete(
    '/:id',
    authenticate,
    RecipeController.deleteRecipe
    // No body to validate on delete.
);

module.exports = router;
