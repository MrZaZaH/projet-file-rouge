/**
 * GET /admin/stats
 * Global platform statistics for admin dashboard
 *
 * Returns:
 * - recipes: total count, breakdown by status
 * - users: total registered users
 * - comments: total non-deleted comments
 * - ratings: total ratings, global average
 * - top_categories: top 5 categories by recipe count (published only)
 */
static async getStats(req, res) {
    try {
        // --- Recipe counts by status ---
        // GROUP BY status returns one row per status value
        // We reduce it to a single object for easier consumption
        const [recipeRows] = await pool.query(`
            SELECT status, COUNT(*) AS count
            FROM recipes
            WHERE deleted_at IS NULL
            GROUP BY status
        `);

        // Build { pending: N, published: N, rejected: N }
        const recipeStats = { pending: 0, published: 0, rejected: 0 };
        recipeRows.forEach(row => {
            recipeStats[row.status] = parseInt(row.count, 10);
        });
        const totalRecipes = Object.values(recipeStats).reduce((a, b) => a + b, 0);

        // --- User count ---
        const [[userRow]] = await pool.query(`
            SELECT COUNT(*) AS count
            FROM users
            WHERE deleted_at IS NULL
        `);

        // --- Comment count ---
        const [[commentRow]] = await pool.query(`
            SELECT COUNT(*) AS count
            FROM comments
            WHERE deleted_at IS NULL
        `);

        // --- Ratings : total + global average ---
        // AVG() returns NULL if no rows → COALESCE converts to 0
        const [[ratingRow]] = await pool.query(`
            SELECT 
                COUNT(*) AS count,
                COALESCE(AVG(score), 0) AS average
            FROM ratings
        `);

        // --- Top 5 categories by published recipe count ---
        const [topCategories] = await pool.query(`
            SELECT 
                c.name,
                COUNT(r.id) AS recipe_count
            FROM categories c
            LEFT JOIN recipes r 
                ON r.category_id = c.id 
                AND r.deleted_at IS NULL 
                AND r.status = 'published'
            WHERE c.deleted_at IS NULL
            GROUP BY c.id, c.name
            ORDER BY recipe_count DESC
            LIMIT 5
        `);

        logger.info('Admin retrieved platform stats', {
            admin_id: req.user.id
        });

        res.json({
            success: true,
            data: {
                recipes: {
                    total: totalRecipes,
                    by_status: recipeStats
                },
                users: {
                    total: parseInt(userRow.count, 10)
                },
                comments: {
                    total: parseInt(commentRow.count, 10)
                },
                ratings: {
                    total: parseInt(ratingRow.count, 10),
                    average: parseFloat(parseFloat(ratingRow.average).toFixed(2))
                },
                top_categories: topCategories.map(row => ({
                    name: row.name,
                    recipe_count: parseInt(row.recipe_count, 10)
                }))
            }
        });

    } catch (error) {
        logger.error('Failed to retrieve admin stats', {
            admin_id: req.user.id,
            error: error.message
        });
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve stats'
        });
    }
}
