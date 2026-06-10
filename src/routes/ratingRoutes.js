// src/routes/ratingRoutes.js
//
// Mounted at /api/v1/recipes/:recipeId/ratings (mergeParams: true).

'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router({ mergeParams: true });

const RatingController = require('../controllers/RatingController');
const { authenticate } = require('../middlewares/jwtAuth');

const ratingRules = [
    body('score')
        .notEmpty().withMessage('Score is required.')
        .isInt({ min: 1, max: 5 }).withMessage('Score must be an integer between 1 and 5.'),
];

function validate(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }
    next();
}

router.post('/', authenticate, ratingRules, validate, RatingController.rateRecipe);

module.exports = router;
