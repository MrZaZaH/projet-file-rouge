'use strict';

const { pool } = require('../database/connection');

class Comment {

    static async findByRecipeId(recipeId) {
        const [rows] = await pool.execute(
            `SELECT c.id, c.recipe_id, c.user_id, c.guest_name, c.content, c.created_at,
                    u.username AS user_pseudo
             FROM comments c
             LEFT JOIN users u ON c.user_id = u.id
             WHERE c.recipe_id = ?
               AND c.deleted_at IS NULL
             ORDER BY c.created_at DESC`,
            [recipeId]
        );

        return rows.map(function(row) {
            return {
                id: row.id,
                recipe_id: row.recipe_id,
                pseudo: row.user_pseudo || row.guest_name || 'Anonyme',
                content: row.content,
                created_at: row.created_at
            };
        });
    }

    static async create(data) {

        if (data.content && data.content.trim().length < 3) {
            throw new Error('Content must be at least 3 characters');
        }
        if (!data.content || data.content.trim() === '') {
            throw new Error('Content is required');
        }

        if (!data.user_id && (!data.guest_name || data.guest_name.trim() === '')) {
            throw new Error('A name is required to comment as a guest');
        }

        const isGuest = !data.user_id;

        try {
            const [result] = await pool.execute(
                `INSERT INTO comments (recipe_id, user_id, guest_name, content, created_at)
                 VALUES (?, ?, ?, ?, NOW())`,
                [
                    data.recipe_id,
                    data.user_id || null,
                    isGuest ? data.guest_name.trim() : null,
                    data.content.trim()
                ]
            );

            const pseudo = isGuest
                ? data.guest_name.trim()
                : (data.username || 'Utilisateur');

            return {
                id: result.insertId,
                recipe_id: data.recipe_id,
                pseudo: pseudo,
                content: data.content.trim(),
                created_at: new Date()
            };

        } catch (error) {
            if (error.code === 'ER_NO_REFERENCED_ROW_2') {
                throw new Error('Recipe not found');
            }
            throw error;
        }
    }

    static async softDelete(id) {
        await pool.execute(
            `UPDATE comments
             SET deleted_at = NOW()
             WHERE id = ?`,
            [id]
        );
    }
}

module.exports = Comment;
