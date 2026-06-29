// src/middlewares/jwtAuth.js
//
// JWT verification middleware.
// Attaches the decoded token payload to req.user if valid.
// Routes that require authentication must use this middleware.

'use strict';

const jwt = require('jsonwebtoken');

// Verifies the JWT in the Authorization header.
// Expected format: "Authorization: Bearer <token>"
// If valid → sets req.user and calls next()
// If invalid or missing → returns 401 immediately
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: {
                message: 'No token provided',
                code: 'MISSING_TOKEN'
            }
        });
    }

    // Extract the token part after "Bearer "
    const token = authHeader.substring(7);

    try {
        // verify() throws if the token is expired, malformed, or signed with wrong key
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Attach decoded payload to req — available in all subsequent middleware and controllers
        req.user = decoded;
        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            error: {
                message: 'Invalid or expired token',
                code: 'INVALID_TOKEN'
            }
        });
    }
};

// requireAdmin — to be used AFTER authenticate
// authenticate sets req.user, this checks the role
const requireAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({
            success: false,
            error: {
                message: 'Admin access required',
                code: 'FORBIDDEN'
            }
        });
    }
    next();
};

// attachUser — optional authentication.
// If a valid token is present in the Authorization header, attaches the decoded
// user to req.user. If the token is missing or invalid, continues without blocking.
const attachUser = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
    }

    const token = authHeader.substring(7);

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
    } catch {
        // Token invalid or expired — silently continue as guest
    }

    next();
};

module.exports = { authenticate, requireAdmin, attachUser };
