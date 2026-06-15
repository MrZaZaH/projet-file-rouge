/**
 * Comment Model
 * 
 * Handles comment system for recipes.
 * 
 * Responsibilities:
 * - Create comment with validation
 * - Fetch comments by recipe
 * - Soft delete comments
 * 
 * Rules:
 * - A comment must have guest_name + content
 * - Content must be at least 3 characters
 * - Soft delete only (deleted_at IS NULL for queries)
 * - No authentication required (guest comments)
 */

'use strict';

const { pool } = require('../database/connection');

class Comment {

    /**
     * findByRecipeId(recipeId)
     * 
     * Purpose:
     * Retrieve all non-deleted comments for a recipe, ordered by newest first
     * 
     * Returns:
     * Array of comment objects with: id, recipe_id, guest_name, content, created_at
     */
    static async findByRecipeId(recipeId) {
        const [rows] = await pool.execute(
            `SELECT id, recipe_id, guest_name, content, created_at
             FROM comments
             WHERE recipe_id = ?
               AND deleted_at IS NULL
             ORDER BY created_at DESC`,
            [recipeId]
        );

        return rows;
    }

    /**
     * create(data)
     * 
     * Purpose:
     * Insert a new comment with validation
     * 
     * Input:
     * {
     *   recipe_id: int,
     *   guest_name: string (required, non-empty),
     *   content: string (required, >= 3 chars)
     * }
     * 
     * Returns:
     * { id, recipe_id, guest_name, content, created_at }
     * 
     * Throws:
     * - "Guest name is required" → empty guest_name
     * - "Content must be at least 3 characters" → text too short
     * - "Recipe not found" → FK error on recipe_id
     */
    static async create(data) {

        // ========================================
        // VALIDATION
        // ========================================

        // Validate guest_name (required, non-empty)
        if (!data.guest_name || data.guest_name.trim() === '') {
            throw new Error('Guest name is required');
        }

        // Validate content length (minimum 3 chars)
        if (!data.content || data.content.trim().length < 3) {
            throw new Error('Content must be at least 3 characters');
        }

        try {
            // ========================================
            // INSERT with parameterized query
            // ========================================
            const [result] = await pool.execute(
                `INSERT INTO comments (recipe_id, guest_name, content, created_at)
                 VALUES (?, ?, ?, NOW())`,
                [
                    data.recipe_id,
                    data.guest_name.trim(),
                    data.content.trim()
                ]
            );

            // ========================================
            // RETURN created comment
            // ========================================
            return {
                id: result.insertId,
                recipe_id: data.recipe_id,
                guest_name: data.guest_name.trim(),
                content: data.content.trim(),
                created_at: new Date()
            };

        } catch (error) {

            // ========================================
            // ERROR HANDLING
            // ========================================

            // FK constraint error: recipe_id doesn't exist
            if (error.code === 'ER_NO_REFERENCED_ROW_2') {
                throw new Error('Recipe not found');
            }

            // Re-throw any other error
            throw error;
        }
    }

    /**
     * softDelete(id)
     * 
     * Purpose:
     * Mark a comment as deleted without removing the row (soft delete)
     * 
     * Effect:
     * Sets deleted_at = NOW()
     * Comment will be excluded from all future queries via WHERE deleted_at IS NULL
     */
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
