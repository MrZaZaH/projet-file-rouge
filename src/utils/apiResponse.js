/**
 * @file apiResponse.js
 * @description Standardized HTTP response helpers.
 * All controllers must use these instead of res.json() directly.
 * This guarantees a consistent contract for the frontend.
 */

'use strict';

/**
 * Send a success response.
 * @param {object} res - Express response object
 * @param {any} data - Data payload
 * @param {string|null} message - Optional message
 * @param {number} statusCode - Default 200
 */
const sendSuccess = (res, data, message = null, statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        data,
        message,
    });
};

/**
 * Send an error response.
 * @param {object} res - Express response object
 * @param {string} message - Error description
 * @param {number} statusCode - Default 400
 * @param {array|null} errors - Validation errors array if any
 */
const sendError = (res, message, statusCode = 400, errors = null) => {
    return res.status(statusCode).json({
        success: false,
        data: null,
        message,
        errors,
    });
};

module.exports = { sendSuccess, sendError };
