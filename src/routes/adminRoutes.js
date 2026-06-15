/**
 * Admin Routes
 * All routes protected by jwtAuth + requireAdmin middleware
 * 
 * Security:
 * - input validation with express-validator
 * - parameterized queries in controller
 * - all actions logged in admin_logs
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const AdminController = require('../controllers/AdminController');
const { authenticate } = require('../middlewares/jwtAuth');
const requireAdmin = require('../middlewares/requireAdmin');

const router = express.Router();

/**
 * Middleware to check validation errors
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    next();
};

// ============================================
// APPLY PROTECTION TO ALL ROUTES
// ============================================
router.use(authenticate);
router.use(requireAdmin);

// ============================================
// GET /admin/recipes
// Retrieve all recipes with status filtering
// ============================================
router.get(
    '/recipes',
    [
        query('status')
            .optional()
            .isIn(['pending', 'published', 'rejected'])
            .withMessage('Invalid status. Must be pending, published, or rejected'),
        query('sort_by')
            .optional()
            .isIn(['created_at', 'average_rating', 'rating_count'])
            .withMessage('Invalid sort field'),
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limit must be between 1 and 100'),
        query('offset')
            .optional()
            .isInt({ min: 0 })
            .withMessage('Offset must be 0 or positive')
    ],
    handleValidationErrors,
    AdminController.getAllRecipes
);

// ============================================
// PATCH /admin/recipes/:id/status
// Update recipe status (approve/reject)
// ============================================
router.patch(
    '/recipes/:id/status',
    [
        param('id')
            .isInt()
            .withMessage('Recipe ID must be an integer'),
        body('status')
            .isIn(['published', 'rejected'])
            .withMessage('Status must be "published" or "rejected"'),
        body('rejection_reason')
            .optional()
            .isString()
            .trim()
            .isLength({ max: 255 })
            .withMessage('Rejection reason must be max 255 characters')
    ],
    handleValidationErrors,
    AdminController.updateRecipeStatus
);

// ============================================
// DELETE /admin/recipes/:id
// Soft delete a recipe
// ============================================
router.delete(
    '/recipes/:id',
    [
        param('id')
            .isInt()
            .withMessage('Recipe ID must be an integer'),
        body('reason')
            .optional()
            .isString()
            .trim()
            .isLength({ max: 255 })
            .withMessage('Reason must be max 255 characters')
    ],
    handleValidationErrors,
    AdminController.deleteRecipe
);

// ============================================
// GET /admin/logs
// Retrieve admin action logs
// ============================================
router.get(
    '/logs',
    [
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limit must be between 1 and 100'),
        query('offset')
            .optional()
            .isInt({ min: 0 })
            .withMessage('Offset must be 0 or positive'),
        query('action')
            .optional()
            .isString()
            .trim()
    ],
    handleValidationErrors,
    AdminController.getLogs
);

// ============================================
// GET /admin/stats
// Global platform statistics
// ============================================
router.get(
    '/stats',
    AdminController.getStats
);

// ============================================
// GET /admin/recipes/top
// Top recipes by rating
// ============================================
router.get(
    '/recipes/top',
    [
        query('limit')
            .optional()
            .isInt({ min: 1, max: 50 })
            .withMessage('Limit must be between 1 and 50')
    ],
    handleValidationErrors,
    AdminController.getTopRecipes
);

// ============================================
// GET /admin/export/recipes
// Export published recipes as CSV
// ============================================
router.get(
    '/export/recipes',
    AdminController.exportCSV
);



module.exports = router;
