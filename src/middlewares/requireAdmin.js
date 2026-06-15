/**
 * Middleware to verify admin role
 * Requirements:
 * - User must be authenticated (JWT token valid)
 * - User role must be 'admin'
 * 
 * @throws {401} If not authenticated
 * @throws {403} If not admin
 */
const requireAdmin = (req, res, next) => {
  try {
    // Check if user is authenticated (set by jwtAuth middleware)
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    // Admin verified
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Authorization check failed',
      error: error.message
    });
  }
};

module.exports = requireAdmin;
