/**
 * GET /admin/recipes/top
 * Top 10 published recipes by average rating
 * Minimum 3 ratings required to qualify (avoids bias from single ratings)
 *
 * Query params:
 * - limit: 1-50 (default 10)
 */
static async getTopRecipes(req, res) {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);

        // HAVING filters AFTER GROUP BY / aggregation
        // We use it here to enforce the minimum rating_count threshold
        // rating_count >= 3 prevents a recipe with one 5-star from topping the list
        const [recipes] = await pool.query(`
            SELECT 
                r.id,
                r.title,
                r.average_rating,
                r.rating_count,
                r.cost_per_portion,
                r.prep_time,
                r.status,
                u.username AS author,
                c.name AS category,
                r.created_at
            FROM recipes r
            LEFT JOIN users u ON r.user_id = u.id
            LEFT JOIN categories c ON r.category_id = c.id
            WHERE r.deleted_at IS NULL
              AND r.status = 'published'
              AND r.rating_count >= 3
            ORDER BY r.average_rating DESC, r.rating_count DESC
            LIMIT ?
        `, [limit]);

        logger.info('Admin retrieved top recipes', {
            admin_id: req.user.id,
            count: recipes.length
        });

        res.json({
            success: true,
            count: recipes.length,
            data: recipes.map(r => ({
                ...r,
                average_rating: parseFloat(r.average_rating),
                cost_per_portion: parseFloat(r.cost_per_portion)
            }))
        });

    } catch (error) {
        logger.error('Failed to retrieve top recipes', {
            admin_id: req.user.id,
            error: error.message
        });
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve top recipes'
        });
    }
}
