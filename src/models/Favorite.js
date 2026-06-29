'use strict';

const { pool } = require('../database/connection');
const { logger } = require('../middlewares/logger');

class Favorite {

    static async toggle(userId, recipeId) {
        try {
            const [existing] = await pool.execute(
                'SELECT id FROM favorites WHERE user_id = ? AND recipe_id = ?',
                [userId, recipeId]
            );

            if (existing.length > 0) {
                await pool.execute(
                    'DELETE FROM favorites WHERE user_id = ? AND recipe_id = ?',
                    [userId, recipeId]
                );
                return { favorited: false };
            }

            await pool.execute(
                'INSERT INTO favorites (user_id, recipe_id) VALUES (?, ?)',
                [userId, recipeId]
            );
            return { favorited: true };

        } catch (error) {
            logger.error(`Favorite.toggle(${userId}, ${recipeId}) failed: ${error.message}`);
            throw error;
        }
    }

    static async findByUserId(userId) {
        try {
            const query = `
                SELECT
                    r.id,
                    r.title,
                    r.prep_time,
                    r.cost_per_portion,
                    r.average_rating,
                    r.rating_count,
                    r.image_url,
                    u.username AS author,
                    f.created_at AS favorited_at
                FROM favorites f
                JOIN recipes r ON f.recipe_id = r.id
                JOIN users u ON r.user_id = u.id
                WHERE f.user_id = ?
                  AND r.deleted_at IS NULL
                  AND r.status = 'published'
                ORDER BY f.created_at DESC
            `;

            const [rows] = await pool.execute(query, [userId]);

            return rows.map(row => ({
                id: row.id,
                title: row.title,
                prep_time: row.prep_time,
                cost_per_portion: parseFloat(row.cost_per_portion),
                average_rating: parseFloat(row.average_rating),
                rating_count: row.rating_count,
                image_url: row.image_url,
                author: row.author,
                favorited_at: row.favorited_at,
            }));

        } catch (error) {
            logger.error(`Favorite.findByUserId(${userId}) failed: ${error.message}`);
            throw error;
        }
    }

    static async isFavorited(userId, recipeId) {
        try {
            const [rows] = await pool.execute(
                'SELECT id FROM favorites WHERE user_id = ? AND recipe_id = ?',
                [userId, recipeId]
            );
            return rows.length > 0;
        } catch (error) {
            logger.error(`Favorite.isFavorited(${userId}, ${recipeId}) failed: ${error.message}`);
            throw error;
        }
    }

    static async countByUserId(userId) {
        try {
            const [rows] = await pool.execute(
                'SELECT COUNT(*) AS count FROM favorites WHERE user_id = ?',
                [userId]
            );
            return Number(rows[0].count);
        } catch (error) {
            logger.error(`Favorite.countByUserId(${userId}) failed: ${error.message}`);
            throw error;
        }
    }
}

module.exports = Favorite;
