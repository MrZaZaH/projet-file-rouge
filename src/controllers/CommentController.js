// src/controllers/CommentController.js
//
// HTTP logic for comments.
// US-13: comments are open to guests (no account required).
//   - Logged-in user: token present → user_id from req.user, guest_name ignored.
//   - Guest: no token → guest_name required in body.
// The authenticate middleware is NOT applied to POST here —
// instead we use the optional `attachUser` middleware (defined below in routes).

'use strict';

const Comment = require('../models/Comment');
const Recipe = require('../models/Recipe');

// GET /api/v1/recipes/:recipeId/comments
// Public. Returns all comments for a recipe.
// 404 if the recipe doesn't exist (avoid leaking comment counts on ghost recipes).
async function getCommentsByRecipe(req, res, next) {
    try {
        const recipeId = Number(req.params.recipeId);

        const recipe = await Recipe.findById(recipeId);
        if (!recipe || recipe.status !== 'published') {
            return res.status(404).json({ message: 'Recipe not found.' });
        }

        const comments = await Comment.findByRecipeId(recipeId);
        return res.status(200).json({ data: comments });

    } catch (err) {
        next(err);
    }
}

// POST /api/v1/recipes/:recipeId/comments
// Open to guests AND logged-in users.
// Validation (express-validator) already ran before this function is called.
async function createComment(req, res, next) {
    try {
        const recipeId = Number(req.params.recipeId);

        const recipe = await Recipe.findById(recipeId);
        if (!recipe || recipe.status !== 'published') {
            return res.status(404).json({ message: 'Recipe not found.' });
        }

        // req.user is set by attachUser if a valid token is present, undefined otherwise.
        const userId = req.user?.id || null;
        const guestName = userId ? null : req.body.guest_name;
        // If the user is logged in, we ignore guest_name entirely.
        // A logged-in user cannot post as a guest — their identity is already known.

        const comment = await Comment.create({
            recipe_id: recipeId,
            user_id: userId,
            guest_name: guestName,
            content: req.body.content,
        });

        return res.status(201).json({ data: comment });

    } catch (err) {
        next(err);
    }
}

// DELETE /api/v1/recipes/:recipeId/comments/:id
// Protected. Author of the comment OR admin can delete.
// Guests cannot delete their own comments (no identity to verify).
async function deleteComment(req, res, next) {
    try {
        const commentId = Number(req.params.id);
        const recipeId = Number(req.params.recipeId);

        // We need to fetch the comment to check ownership.
        // findByRecipeId returns all comments for a recipe — not ideal for a single lookup.
        // We'll do it the simple way: fetch all and find the one we need.
        // Post-MVP: add Comment.findById() to the model.
        const comments = await Comment.findByRecipeId(recipeId);
        const comment = comments.find(c => c.id === commentId);

        if (!comment) {
            return res.status(404).json({ message: 'Comment not found.' });
        }

        const isAdmin = req.user.role === 'admin';
        const isAuthor = comment.user_id === req.user.id;
        // guest comments (user_id = null) can only be deleted by admins.

        if (!isAdmin && !isAuthor) {
            return res.status(403).json({ message: 'Forbidden.' });
        }

        await Comment.delete(commentId);
        return res.status(204).send();

    } catch (err) {
        next(err);
    }
}

module.exports = { getCommentsByRecipe, createComment, deleteComment };
