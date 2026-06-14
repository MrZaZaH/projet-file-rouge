// src/controllers/CommentController.js
//
// HTTP logic for comments.
// US-13: comments are open to guests (no account required).
//   - Logged-in user: token present → user_id from req.user, guest_name ignored.
//   - Guest: no token → guest_name required in body.
// The authenticate middleware is NOT applied to POST here —
// instead we use the optional `attachUser` middleware (defined below in routes).


'use strict';

const Comment = require('../models/Comment'); // Comment model
const Recipe = require('../models/Recipe'); // Recipe model
const { sendSuccess, sendError } = require('../utils/apiResponse'); // Response helpers

// GET comments for a recipe
async function getCommentsByRecipe(req, res, next) {
    try {
        const recipeId = Number(req.params.recipeId); // Convert param to number

        const recipe = await Recipe.findById(recipeId); // Check recipe existence
        if (!recipe || recipe.status !== 'published') {
            return sendError(res, 'Recipe not found.', 404);
        }

        const comments = await Comment.findByRecipeId(recipeId); // Fetch comments

        return sendSuccess(res, comments); // Return list

    } catch (err) {
        next(err);
    }
}

// POST create comment
async function createComment(req, res, next) {
    try {
        const recipeId = Number(req.params.recipeId);

        const recipe = await Recipe.findById(recipeId);
        if (!recipe || recipe.status !== 'published') {
            return sendError(res, 'Recipe not found.', 404);
        }

        // If user logged in → use user_id, else use guest_name
        const userId = req.user?.id || null;
        const guestName = userId ? null : req.body.guest_name;

        // Create comment
        const comment = await Comment.create({
            recipe_id: recipeId,
            user_id: userId,
            guest_name: guestName,
            content: req.body.content,
        });

        return sendSuccess(res, comment, 'Comment created', 201);

    } catch (err) {
        next(err);
    }
}

// DELETE comment
async function deleteComment(req, res, next) {
    try {
        const commentId = Number(req.params.id);
        const recipeId = Number(req.params.recipeId);

        // Fetch all comments and find target
        const comments = await Comment.findByRecipeId(recipeId);
        const comment = comments.find(c => c.id === commentId);

        if (!comment) {
            return sendError(res, 'Comment not found.', 404);
        }

        const isAdmin = req.user.role === 'admin';
        const isAuthor = comment.user_id === req.user.id;

        // Only admin or author can delete
        if (!isAdmin && !isAuthor) {
            return sendError(res, 'Forbidden.', 403);
        }

        await Comment.delete(commentId); // Delete comment

        return sendSuccess(res, null, 'Comment deleted');

    } catch (err) {
        next(err);
    }
}

module.exports = { getCommentsByRecipe, createComment, deleteComment };
