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

const db = require('../database/connection');
const { logger } = require('../middlewares/logger');

const { pool } = require('../database/connection');


class AdminController {
    /**
     * GET /admin/recipes
     * Retrieve all recipes (including pending ones)
     * For admin dashboard moderation
     * 
     * Query params:
     * - status: 'pending' | 'published' | 'rejected'
     * - sort_by: 'created_at' | 'rating_average' | 'visit_count'
     * - limit: 1-100 (default 20)
     * - offset: >= 0 (default 0)
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

            // Filter by status if provided
            if (status && ['pending', 'published', 'rejected'].includes(status)) {
                query += ` AND r.status = ?`;
                params.push(status);
            }

            // Sort options
            const allowedSort = ['created_at', 'average_rating', 'visit_count'];
            const sortBy = allowedSort.includes(sort_by) ? sort_by : 'created_at';
            query += ` ORDER BY r.${sortBy} DESC`;

            // Pagination
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
            console.error('🔥 ERREUR BACKEND:', error);
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
     * Update recipe status (pending → published or rejected)
     * 
     * Body:
     * - status: 'published' | 'rejected' (required)
     * - rejection_reason: string (optional, max 255 chars)
     * 
     * Workflow:
     * 1. Validate recipe exists and is not deleted
     * 2. Update status
     * 3. Create user notification
     * 4. Log action in admin_logs
     */
    static async updateRecipeStatus(req, res) {
        try {
            const { id } = req.params;
            const { status, rejection_reason } = req.body;

            // Validate status
            if (!['published', 'rejected'].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid status. Must be "published" or "rejected"'
                });
            }

            // Get recipe
            const [recipe] = await pool.query(
                'SELECT id, user_id, title, status FROM recipes WHERE id = ? AND deleted_at IS NULL',
                [id]
            );

            if (!recipe || recipe.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Recipe not found'
                });
            }

            const previousStatus = recipe[0].status;

            // Update recipe status
            await pool.query(
                'UPDATE recipes SET status = ?, updated_at = NOW() WHERE id = ?',
                [status, id]
            );

            // Create notification for user
            const notificationType = status === 'published'
                ? 'recipe_approved'
                : 'recipe_rejected';

            const message = status === 'published'
                ? `Votre recette "${recipe[0].title}" a été publiée ! 🎉`
                : `Votre recette "${recipe[0].title}" n'a pas pu être retenue.${rejection_reason ? ' Raison : ' + rejection_reason : ''}`;

            await pool.query(
                `INSERT INTO user_notifications 
         (user_id, type, message, recipe_id, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
                [recipe[0].user_id, notificationType, message, id]
            );

            // Log admin action
            await pool.query(
                `INSERT INTO admin_logs 
     (admin_id, action, recipe_id, target_type, target_id, created_at)
     VALUES (?, ?, ?, ?, ?, NOW())`,
                [
                    req.user.id,
                    `recipe_${status}`,
                    id,
                    'recipe',
                    id
                ]
            );


            logger.info(`Admin updated recipe status`, {
                admin_id: req.user.id,
                recipe_id: id,
                previous_status: previousStatus,
                new_status: status
            });

            res.json({
                success: true,
                message: `Recipe ${status} successfully`,
                data: {
                    recipe_id: id,
                    previous_status: previousStatus,
                    new_status: status
                }
            });
        } catch (error) {
            logger.error('Failed to update recipe status', {
                admin_id: req.user.id,
                recipe_id: req.params.id,
                error: error.message
            });
            res.status(500).json({
                success: false,
                message: 'Failed to update recipe status',
                error: error.message
            });
        }
    }

    /**
     * DELETE /admin/recipes/:id
     * Soft delete a recipe (set deleted_at)
     * 
     * Body:
     * - reason: string (optional, max 255 chars)
     * 
     * Workflow:
     * 1. Verify recipe exists
     * 2. Soft delete (set deleted_at)
     * 3. Notify user
     * 4. Log action
     */
    static async deleteRecipe(req, res) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            // Get recipe
            const [recipe] = await pool.query(
                'SELECT id, user_id, title FROM recipes WHERE id = ? AND deleted_at IS NULL',
                [id]
            );

            if (!recipe || recipe.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Recipe not found'
                });
            }

            // Soft delete
            await pool.query(
                'UPDATE recipes SET deleted_at = NOW(), updated_at = NOW() WHERE id = ?',
                [id]
            );

            // Notify user
            const message = `Votre recette "${recipe[0].title}" a été supprimée.${reason ? ' Raison : ' + reason : ''}`;

            await pool.query(
                `INSERT INTO user_notifications 
         (user_id, type, message, recipe_id, created_at)
     VALUES (?, ?, ?, ?, NOW())`,
                [recipe[0].user_id, 'recipe_deleted', message, id]
            );

            // Log action
            await pool.query(
                `INSERT INTO admin_logs 
         (admin_id, action, recipe_id, target_type, target_id, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
                [req.user.id, 'recipe_deleted', id, 'recipe', id]
            );

            logger.info(`Admin deleted recipe`, {
                admin_id: req.user.id,
                recipe_id: id,
                reason: reason || 'not specified'
            });

            res.json({
                success: true,
                message: 'Recipe deleted successfully'
            });
        } catch (error) {
            logger.error('Failed to delete recipe', {
                admin_id: req.user.id,
                recipe_id: req.params.id,
                error: error.message
            });
            res.status(500).json({
                success: false,
                message: 'Failed to delete recipe',
                error: error.message
            });
        }
    }

    /**
     * GET /admin/logs
     * Retrieve admin action logs
     * 
     * Query params:
     * - limit: 1-100 (default 50)
     * - offset: >= 0 (default 0)
     * - action: filter by action type (optional)
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

            // Filter by action if provided
            if (action) {
                query += ` AND al.action = ?`;
                params.push(action);
            }

            query += ` ORDER BY al.created_at DESC LIMIT ? OFFSET ?`;
            params.push(parseInt(limit), parseInt(offset));

            const [logs] = await pool.query(query, params);

            logger.info(`Admin retrieved logs`, {
                admin_id: req.user.id,
                count: logs.length
            });

            res.json({
                success: true,
                count: logs.length,
                data: logs
            });
        } catch (error) {
            logger.error('Failed to retrieve admin logs', {
                admin_id: req.user.id,
                error: error.message
            });
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve logs',
                error: error.message
            });
        }
    }
}

module.exports = AdminController;
