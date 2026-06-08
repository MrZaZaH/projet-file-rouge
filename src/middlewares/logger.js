// src/middlewares/logger.js
// Centralized logging using Winston.
// Two transports: console (development) and file (all environments).
// 
// Log levels used in this project:
//   error  – unhandled exceptions, DB failures, security events
//   warn   – suspicious activity, deprecated usage
//   info   – server start, successful auth, admin actions
//   http   – incoming requests (method, url, status, response time)
//   debug  – detailed info useful during development only

'use strict';

const winston = require('winston');
const path = require('path');

// Custom format: timestamp + level + message + optional metadata
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }), // Include stack trace for Error objects
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        // meta contains any extra fields passed to the logger
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} [${level.toUpperCase()}] ${stack || message}${metaStr}`;
    })
);

const logger = winston.createLogger({
    // In production, don't pollute logs with debug noise
    level: process.env.NODE_ENV === 'production' ? 'http' : 'debug',

    format: logFormat,

    transports: [
        // Always write errors to a dedicated file – never lose an error log
        new winston.transports.File({
            filename: path.join('logs', 'error.log'),
            level: 'error',
            maxsize: 5 * 1024 * 1024, // 5MB – rotate before logs eat your disk
            maxFiles: 5,
        }),

        // Combined log for everything at or above the configured level
        new winston.transports.File({
            filename: path.join('logs', 'combined.log'),
            maxsize: 10 * 1024 * 1024,
            maxFiles: 5,
        }),
    ],
});

// In development, also log to console with colors for readability
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            logFormat
        ),
    }));
}

/**
 * Express middleware – logs every incoming HTTP request.
 * Attach this early in the middleware chain, before routes.
 */
function httpLogger(req, res, next) {
    const start = Date.now();

    // Hook into the response 'finish' event to capture the status code
    // We can't log status immediately – the route hasn't run yet
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.http(`${req.method} ${req.originalUrl}`, {
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
        });
    });

    next();
}

module.exports = { logger, httpLogger };
