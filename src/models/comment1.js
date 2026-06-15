// src/models/Comment.js
//
// Data access layer for the comments table.
// US-13: comments are allowed without an account.
//   - Logged-in user  → user_id filled, guest_name NULL
//   - Guest           → user_id NULL,   guest_name filled
// This dual-mode is enforced at application level (controller + validator).
// At model level: we trust the caller has already validated the input.
// Soft delete: deleted_at IS NULL = active. No hard DELETE used.

'use strict';

const { pool } = require('../database/connection');

class Comment {

    // ─── Read ──────────────────────────────────────────────────────────────────

    // Fetch all active comments for a given recipe, ordered oldest first.
    // Returns user_id, username (if logged-in), guest_name, content, created_at.
    // Used to display the comment thread on a recipe detail page.
    static async findByRecipeId(recipeId) {
        const [rows] = await pool.execute(
            `SELECT
                c.id,
                c.recipe_id,
                c.user_id,
                u.username   AS author_username,
                -- NULL if guest comment — handle display fallback in the view
                c.guest_name,
                c.content,
                c.created_at
             FROM comments c
             LEFT JOIN users u ON c.user_id = u.id AND u.deleted_at IS NULL
             -- LEFT JOIN: if user_id is NULL (guest) or user was soft-deleted,
             -- the row still comes back — we just get NULL for author_username.
             WHERE c.recipe_id = ?
               AND c.deleted_at IS NULL
             ORDER BY c.created_at ASC`,
            [recipeId]
        );
        return rows;
        // Empty array if no comments — never null.
    }

    // ─── Write ─────────────────────────────────────────────────────────────────

    // Create a comment.
    // Accepts either { recipe_id, user_id, content }        ← logged-in user
    //             or { recipe_id, guest_name, content }      ← guest
    // The caller (controller) is responsible for ensuring exactly one of
    // user_id / guest_name is provided, never both, never neither.
    static async create({ recipe_id, user_id = null, guest_name = null, content }) {
        const [result] = await pool.execute(
            `INSERT INTO comments (recipe_id, user_id, guest_name, content)
             VALUES (?, ?, ?, ?)`,
            [recipe_id, user_id, guest_name, content]
            // user_id and guest_name default to null — safe to pass either as null.
        );

        // Return the inserted comment with author info for immediate display.
        const [rows] = await pool.execute(
            `SELECT
                c.id,
                c.recipe_id,
                c.user_id,
                u.username  AS author_username,
                c.guest_name,
                c.content,
                c.created_at
             FROM comments c
             LEFT JOIN users u ON c.user_id = u.id
             WHERE c.id = ?`,
            [result.insertId]
        );
        return rows[0];
    }

    // Soft delete a comment.
    // Ownership check (user is the author OR user is admin) belongs in the controller.
    static async delete(id) {
        const [result] = await pool.execute(
            `UPDATE comments
             SET deleted_at = NOW()
             WHERE id = ?
               AND deleted_at IS NULL`,
            [id]
        );
        return result.affectedRows > 0;
        // false = comment not found or already deleted.
    }
}

module.exports = Comment;
