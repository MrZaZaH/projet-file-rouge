// src/routes/commentRoutes.js
//
// Mounted at /api/v1/recipes/:recipeId/comments (mergeParams: true).
// mergeParams is required — without it, req.params.recipeId is invisible here
// because it belongs to the parent router in app.js.

'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router({ mergeParams: true });

const CommentController = require('../controllers/CommentController');
const { authenticate } = require('../middlewares/jwtAuth');

// ─── attachUser ───────────────────────────────────────────────────────────────
// Soft version of authenticate: sets req.user if token is valid, but does NOT
// block the request if there is no token.
// Used on POST /comments so guests can comment without a token.
const jwt = require('jsonwebtoken');

function attachUser(req, _res, next) {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
        try {
            const token = header.slice(7);
            req.user = jwt.verify(token, process.env.JWT_SECRET);
        } catch {
            // Invalid or expired token — treat as guest, don't block.
            req.user = undefined;
        }
    }
    next();
    // Why not just call authenticate? authenticate returns 401 if no token.
    // Here we want: token present + valid → req.user set.
    //               token absent or invalid → req.user = undefined, continue anyway.
}

// ─── Validation ───────────────────────────────────────────────────────────────
const commentRules = [
    body('content')
        .trim()
        .notEmpty().withMessage('Content is required.')
        .isLength({ max: 1000 }).withMessage('Content must be under 1000 characters.'),

    body('guest_name')
        .if((_, { req }) => !req.user)
        // Only validate guest_name if the user is NOT logged in.
        // If logged in, guest_name is ignored entirely — no need to validate it.
        .trim()
        .notEmpty().withMessage('A name is required to comment as a guest.')
        .isLength({ max: 50 }).withMessage('Name must be under 50 characters.'),
];

function validate(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }
    next();
}

// ─── Routes ───────────────────────────────────────────────────────────────────
router.get('/', CommentController.getCommentsByRecipe);
router.post('/', attachUser, commentRules, validate, CommentController.createComment);
router.delete('/:id', authenticate, CommentController.deleteComment);

module.exports = router;
