// src/middlewares/errorHandler.js
//
// Centralized error handler – catches all errors passed via next(error).
//
// Responsibilities:
//   - Log errors internally (with stack)
//   - Never expose sensitive data to client
//   - Return standardized API response format
//
// Notes:
//   - Uses sendError() helper for consistency
//   - Stack trace only included in development

'use strict';

const { logger } = require('./logger'); // Custom logger for internal error tracking
const { sendError } = require('../utils/apiResponse'); // Standard API error response helper

// Express recognizes this as an error middleware because it has 4 parameters
// DO NOT remove 'next' even if unused
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {

    // Determine HTTP status code (fallback to 500 if not provided)
    const statusCode = err.statusCode || err.status || 500;

    // Log full error details internally (including stack trace)
    logger.error(`${req.method} ${req.originalUrl} – ${err.message}`, {
        statusCode,
        stack: err.stack,
        body: req.body, // WARNING: sanitize sensitive data in production (passwords, tokens)
    });

    // Decide what message to expose to the client
    // Never leak internal details for 500 errors
    const message =
        statusCode === 500
            ? 'An internal server error occurred'
            : err.message;

    // Use standardized response format
    const response = sendError(res, message, statusCode);

    // In development mode, attach stack trace for debugging
    if (process.env.NODE_ENV === 'development' && err.stack) {
        response.stack = err.stack; // This won't override response body, just adds info
    }

    return response; // Ensure response is returned to stop execution
}

module.exports = { errorHandler };
