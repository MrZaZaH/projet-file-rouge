/**
 * @file apiResponse.js
 * @description Standardized HTTP response helpers.
 * All controllers must use these instead of res.json() directly.
 * This guarantees a consistent contract for the frontend.
 */

'use strict';

/**
 * Send a success response.
 */
const sendSuccess = (res, data, message = null, statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        data,
        message,
    });
};

/**
 * Convert HTTP status code to readable error code
 */
const statusCodeToCode = (status) => {
    const codes = {
        400: 'BAD_REQUEST',
        401: 'UNAUTHORIZED',
        403: 'FORBIDDEN',
        404: 'NOT_FOUND',
        409: 'CONFLICT',
        422: 'VALIDATION_ERROR',
        500: 'INTERNAL_ERROR'
    };
    return codes[status] || 'ERROR';
};

/**
 * Send an error response.
 */
const sendError = (res, message, statusCode = 500, details = null) => {
    const response = {
        success: false,
        error: {
            message,
            code: statusCodeToCode(statusCode)
        }
    };

    if (details) {
        response.error.details = details;
    }

    return res.status(statusCode).json(response);
};

module.exports = { sendSuccess, sendError };
