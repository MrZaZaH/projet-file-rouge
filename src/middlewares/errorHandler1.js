// src/middlewares/errorHandler.js
// Centralized error handler – catches all errors passed via next(error).
//
// Express identifies error-handling middleware by its 4-parameter signature.
// DO NOT remove the 'next' parameter even if unused – Express needs it.
//
// Security: never expose stack traces or internal details to clients.
// Log everything internally, return only what the user needs to know.

'use strict';

const { logger } = require('./logger');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
    // Default to 500 if no status was set on the error
    const statusCode = err.statusCode || err.status || 500;

    // Log the full error internally (with stack trace)
    logger.error(`${req.method} ${req.originalUrl} – ${err.message}`, {
        statusCode,
        stack: err.stack,
        body: req.body, // Careful: don't log passwords. Sanitize in production.
    });

    // What the client gets: minimal, never the stack trace
    const response = {
        success: false,
        error: {
            message: statusCode === 500
                ? 'An internal server error occurred'  // Never leak 500 details
                : err.message,
            code: err.code || 'INTERNAL_ERROR',
        },
    };

    // In development, add the stack trace to the response for debugging
    if (process.env.NODE_ENV === 'development' && err.stack) {
        response.error.stack = err.stack;
    }

    res.status(statusCode).json(response);
}

module.exports = { errorHandler };
