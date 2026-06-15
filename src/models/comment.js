// src/models/Comment.js
//
// Comment model = handles comment system
//
// Responsibilities:
// - Create comment with validation
// - Fetch comments by recipe
// - Soft delete comments
//
// Rules:
// - A comment must have pseudo + text
// - Text must be at least 3 characters
// - Soft delete only (deleted_at)

'use strict';

// Import DB pool
const { pool } = require('../database/connection');

class Comment {

    // Get comments for a recipe
    static async findByRecipeId(recipeId) {
        const [rows] = await pool.execute(
            `SELECT *
             FROM comments
             WHERE recipe_id = ?
               AND deleted_at IS NULL
             ORDER BY created_at DESC`,
            [recipeId]
        );

        return rows; // Return all comments
    }

    // Create comment
    static async create(data) {

        // Validate pseudo
        if (!data.pseudo || data.pseudo.trim() === '') {
            throw new Error('Pseudo is required');
        }

        // Validate text length
        if (!data.text || data.text.trim().length < 3) {
            throw new Error('Text must be at least 3 characters');
        }

        try {
            const [result] = await pool.execute(
                `INSERT INTO comments (recipe_id, pseudo, text)
                 VALUES (?, ?, ?)`,
                [
                    data.recipe_id,
                    data.pseudo,
                    data.text
                ]
            );

            return {
                id: result.insertId,
                ...data,
                created_at: new Date()
            };

        } catch (error) {

            // FK error handling
            if (error.code === 'ER_NO_REFERENCED_ROW_2') {
                throw new Error('Recipe not found');
            }

            throw error;
        }
    }

    // ✅ FIX: softDelete (expected by tests)
    static async softDelete(id) {
        await pool.execute(
            `UPDATE comments
             SET deleted_at = NOW()
             WHERE id = ?`,
            [id]
        );
    }
}

// Export model
module.exports = Comment;
