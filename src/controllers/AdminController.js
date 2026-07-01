/**
 * AdminController
 * Handles moderation, recipe status updates, and admin logs
 * 
 * Security:
 * - All queries use parameterized statements
 * - Admin-only endpoints protected by requireAdmin middleware
 * - All actions logged in admin_logs table
 * - User notifications created for recipe status changes
 */

const { logger } = require('../middlewares/logger');
const { pool } = require('../database/connection'); // 

class AdminController {

    /**
     * GET /admin/dashboard
     * Single endpoint returning all dashboard metrics
     * Aggregates stats, top recipes, most active categories
     */
    static async getDashboard(req, res) {
        try {
            // Total recipes by status
            const [recipeStats] = await pool.query(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
                    SUM(CASE WHEN status = 'pending'   THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = 'rejected'  THEN 1 ELSE 0 END) as rejected
                FROM recipes
                WHERE deleted_at IS NULL
            `);

            // Top 5 most viewed recipes
            const [topViewed] = await pool.query(`
                SELECT r.id, r.title, r.views, r.average_rating, u.username as author
                FROM recipes r
                LEFT JOIN users u ON r.user_id = u.id
                WHERE r.deleted_at IS NULL AND r.status = 'published'
                ORDER BY r.views DESC
                LIMIT 5
            `);

            // Top 5 best rated (minimum 3 ratings)
            const [topRated] = await pool.query(`
                SELECT r.id, r.title, r.average_rating, r.rating_count, u.username as author
                FROM recipes r
                LEFT JOIN users u ON r.user_id = u.id
                WHERE r.deleted_at IS NULL 
                  AND r.status = 'published'
                  AND r.rating_count >= 3
                ORDER BY r.average_rating DESC
                LIMIT 5
            `);

            // Most active categories
            const [topCategories] = await pool.query(`
                SELECT c.id, c.name, COUNT(r.id) as recipe_count
                FROM categories c
                LEFT JOIN recipes r ON c.id = r.category_id
                    AND r.deleted_at IS NULL
                    AND r.status = 'published'
                WHERE c.deleted_at IS NULL
                GROUP BY c.id, c.name
                ORDER BY recipe_count DESC
                LIMIT 5
            `);

            // Total users
            const [[userStats]] = await pool.query(`
                SELECT COUNT(*) as total FROM users WHERE deleted_at IS NULL
            `);

            logger.info('Admin accessed dashboard', { admin_id: req.user.id });

            res.json({
                success: true,
                data: {
                    recipes: {
                        total: recipeStats[0].total,
                        by_status: {
                            published: recipeStats[0].published,
                            pending: recipeStats[0].pending,
                            rejected: recipeStats[0].rejected
                        }
                    },
                    top_viewed: topViewed,
                    top_rated: topRated,
                    top_categories: topCategories,
                    users: {
                        total: userStats.total
                    }
                }
            });

        } catch (error) {
            logger.error('Failed to load admin dashboard', {
                admin_id: req.user?.id,
                error: error.message
            });

            res.status(500).json({
                success: false,
                message: 'Failed to load dashboard'
            });
        }
    }

    /**
     * GET /admin/recipes
     */
    static async getAllRecipes(req, res) {
        try {
            const { status, sort_by, limit = 20, offset = 0 } = req.query;

            let query = `
                SELECT 
                    r.id, 
                    r.title, 
                    r.status, 
                    r.cost_per_portion,
                    r.prep_time,
                    r.average_rating,
                    r.rating_count,
                    u.username as author,
                    r.created_at,
                    r.updated_at
                FROM recipes r
                LEFT JOIN users u ON r.user_id = u.id
                WHERE r.deleted_at IS NULL
            `;

            const params = [];

            if (status && ['pending', 'published', 'rejected'].includes(status)) {
                query += ` AND r.status = ?`;
                params.push(status);
            }

            const allowedSort = ['created_at', 'average_rating', 'rating_count'];
            const sortBy = allowedSort.includes(sort_by) ? sort_by : 'created_at';
            query += ` ORDER BY r.${sortBy} DESC`;

            query += ` LIMIT ? OFFSET ?`;
            params.push(parseInt(limit), parseInt(offset));

            const [recipes] = await pool.query(query, params);

            logger.info(`Admin retrieved recipes`, {
                admin_id: req.user.id,
                status: status || 'all',
                count: recipes.length
            });

            res.json({
                success: true,
                count: recipes.length,
                data: recipes
            });

        } catch (error) {
            logger.error('Failed to retrieve recipes for admin', {
                admin_id: req.user.id,
                error: error.message
            });

            res.status(500).json({
                success: false,
                message: 'Failed to retrieve recipes',
                error: error.message
            });
        }
    }

    /**
     * PATCH /admin/recipes/:id/status
     */
    static async updateRecipeStatus(req, res) {
        try {
            const { id } = req.params;
            const { status, rejection_reason } = req.body;

            if (!['published', 'rejected'].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid status'
                });
            }

            const [recipe] = await pool.query(
                'SELECT id, user_id, title, status FROM recipes WHERE id = ? AND deleted_at IS NULL',
                [id]
            );

            if (!recipe.length) {
                return res.status(404).json({
                    success: false,
                    message: 'Recipe not found'
                });
            }

            const previousStatus = recipe[0].status;

            await pool.query(
                'UPDATE recipes SET status = ?, updated_at = NOW() WHERE id = ?',
                [status, id]
            );

            const notificationType = status === 'published'
                ? 'recipe_approved'
                : 'recipe_rejected';

            const message = status === 'published'
                ? `Votre recette "${recipe[0].title}" a été publiée ! 🎉`
                : `Votre recette "${recipe[0].title}" n'a pas été retenue.${rejection_reason ? ' Raison : ' + rejection_reason : ''}`;

            await pool.query(
                `INSERT INTO user_notifications (user_id, type, message, recipe_id, created_at)
                 VALUES (?, ?, ?, ?, NOW())`,
                [recipe[0].user_id, notificationType, message, id]
            );

            await pool.query(
                `INSERT INTO admin_logs (admin_id, action, recipe_id, target_type, target_id, created_at)
                 VALUES (?, ?, ?, ?, ?, NOW())`,
                [req.user.id, `recipe_${status}`, id, 'recipe', id]
            );

            res.json({
                success: true,
                message: `Recipe ${status}`,
                data: { recipe_id: id }
            });

        } catch (error) {
            logger.error('Failed to update recipe status', {
                error: error.message
            });

            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * DELETE /admin/recipes/:id
     */
    static async deleteRecipe(req, res) {
        try {
            const { id } = req.params;
            const { reason } = req.body || {};

            const [recipe] = await pool.query(
                'SELECT id, user_id, title FROM recipes WHERE id = ? AND deleted_at IS NULL',
                [id]
            );

            if (!recipe.length) {
                return res.status(404).json({
                    success: false,
                    message: 'Recipe not found'
                });
            }

            await pool.query(
                'UPDATE recipes SET deleted_at = NOW(), updated_at = NOW() WHERE id = ?',
                [id]
            );

            const message = `Votre recette "${recipe[0].title}" a été supprimée.${reason ? ' Raison : ' + reason : ''}`;

            await pool.query(
                `INSERT INTO user_notifications (user_id, type, message, recipe_id, created_at)
                 VALUES (?, ?, ?, ?, NOW())`,
                [recipe[0].user_id, 'recipe_deleted', message, id]
            );

            await pool.query(
                `INSERT INTO admin_logs (admin_id, action, recipe_id, target_type, target_id, created_at)
                 VALUES (?, ?, ?, ?, ?, NOW())`,
                [req.user.id, 'recipe_deleted', id, 'recipe', id]
            );

            res.json({
                success: true,
                message: 'Recipe deleted'
            });

        } catch (error) {
            logger.error('Failed to delete recipe', {
                error: error.message
            });

            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * GET /admin/logs
     */
    static async getLogs(req, res) {
        try {
            const { limit = 50, offset = 0, action } = req.query;

            let query = `
                SELECT 
                    al.id,
                    al.admin_id,
                    u.username as admin_name,
                    al.action,
                    al.recipe_id,
                    al.target_type,
                    al.target_id,
                    al.created_at
                FROM admin_logs al
                LEFT JOIN users u ON al.admin_id = u.id
                WHERE 1=1
            `;

            const params = [];

            if (action) {
                query += ` AND al.action = ?`;
                params.push(action);
            }

            query += ` ORDER BY al.created_at DESC LIMIT ? OFFSET ?`;
            params.push(parseInt(limit), parseInt(offset));

            const [logs] = await pool.query(query, params);

            res.json({
                success: true,
                count: logs.length,
                data: logs
            });

        } catch (error) {
            logger.error('Failed to retrieve admin logs', {
                error: error.message
            });

            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // ✅ Tes ajouts existants conservés

    static async getStats(req, res) {
        try {
            const [[recipesCount]] = await pool.query(
                'SELECT COUNT(*) as total FROM recipes WHERE deleted_at IS NULL'
            );

            const [[usersCount]] = await pool.query(
                'SELECT COUNT(*) as total FROM users'
            );

            const [[pendingRecipes]] = await pool.query(
                "SELECT COUNT(*) as total FROM recipes WHERE status = 'pending' AND deleted_at IS NULL"
            );

            res.json({
                success: true,
                data: {
                    recipes: recipesCount.total,
                    users: usersCount.total,
                    pendingRecipes: pendingRecipes.total
                }
            });

        } catch (error) {
            logger.error('Failed to retrieve stats', {
                error: error.message
            });

            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    static async getTopRecipes(req, res) {
        try {
            const { limit = 10 } = req.query;

            const [recipes] = await pool.query(
                `SELECT id, title, average_rating, rating_count
                 FROM recipes
                 WHERE deleted_at IS NULL
                 ORDER BY average_rating DESC
                 LIMIT ?`,
                [parseInt(limit)]
            );

            res.json({
                success: true,
                count: recipes.length,
                data: recipes
            });

        } catch (error) {
            logger.error('Failed to get top recipes', {
                error: error.message
            });

            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    static async exportCSV(req, res) {
        try {
            const [recipes] = await pool.query(
                `SELECT id, title, status, created_at
                 FROM recipes
                 WHERE status = 'published' AND deleted_at IS NULL`
            );

            let csv = 'id,title,status,created_at\n';

            recipes.forEach(r => {
                csv += `${r.id},"${r.title}",${r.status},${r.created_at}\n`;
            });

            res.header('Content-Type', 'text/csv');
            res.attachment('recipes.csv');
            res.send(csv);

        } catch (error) {
            logger.error('Failed to export CSV', {
                error: error.message
            });

            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
}

module.exports = AdminController;
