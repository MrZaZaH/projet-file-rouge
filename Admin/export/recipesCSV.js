/**
 * GET /admin/export/recipes
 * Export published recipes as CSV file
 *
 * Security:
 * - Admin only (enforced by router middleware)
 * - Only published, non-deleted recipes exported
 * - Sensitive fields (user email, password_hash) excluded
 *
 * Response:
 * - Content-Type: text/csv
 * - Content-Disposition: attachment (triggers browser download)
 */
static async exportCSV(req, res) {
    try {
        const { Parser } = require('json2csv');

        const [recipes] = await pool.query(`
            SELECT
                r.id,
                r.title,
                r.cost_per_portion,
                r.prep_time,
                r.average_rating,
                r.rating_count,
                r.status,
                u.username AS author,
                c.name AS category,
                r.created_at
            FROM recipes r
            LEFT JOIN users u ON r.user_id = u.id
            LEFT JOIN categories c ON r.category_id = c.id
            WHERE r.deleted_at IS NULL
              AND r.status = 'published'
            ORDER BY r.created_at DESC
        `);

        if (recipes.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No published recipes to export'
            });
        }

        // Define CSV columns explicitly — controls order and excludes unwanted fields
        const fields = [
            { label: 'ID', value: 'id' },
            { label: 'Title', value: 'title' },
            { label: 'Author', value: 'author' },
            { label: 'Category', value: 'category' },
            { label: 'Cost per portion (€)', value: 'cost_per_portion' },
            { label: 'Prep time (min)', value: 'prep_time' },
            { label: 'Average rating', value: 'average_rating' },
            { label: 'Rating count', value: 'rating_count' },
            { label: 'Status', value: 'status' },
            { label: 'Created at', value: 'created_at' }
        ];

        const parser = new Parser({ fields });
        const csv = parser.parse(recipes);

        // Log before sending — if send() throws, we still have the log
        logger.info('Admin exported recipes CSV', {
            admin_id: req.user.id,
            recipe_count: recipes.length
        });

        // Set headers to trigger file download in browser
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="recipes_export_${Date.now()}.csv"`
        );

        res.send(csv);

    } catch (error) {
        logger.error('Failed to export recipes CSV', {
            admin_id: req.user.id,
            error: error.message
        });
        res.status(500).json({
            success: false,
            message: 'Failed to export recipes'
        });
    }
}
