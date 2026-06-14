// app.js
// Express application setup.
//
// Middleware chain (order is mandatory):
//   Security headers → CORS → Rate limiting → Request logging → Body parsing → Routes → Error handling

'use strict';

require('dotenv').config();

const express = require('express');

// Single import — one path, one source of truth
const {
    helmetMiddleware,
    corsMiddleware,
    globalLimiter,
    authLimiter
} = require('./src/middlewares/security');

const { httpLogger } = require('./src/middlewares/logger');
const { errorHandler } = require('./src/middlewares/errorHandler');

const app = express();

// ─── Security headers ────────────────────────────────────────────────────────
app.use(helmetMiddleware);
app.use(corsMiddleware);

// ─── Rate limiting ───────────────────────────────────────────────────────────
// globalLimiter applies to every route — baseline protection against floods
app.use(globalLimiter);

// ─── Request logging ─────────────────────────────────────────────────────────
app.use(httpLogger);

// ─── Body parsing ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.get('/health', async (req, res, next) => {
    try {
        const { pool } = require('./src/database/connection');
        await pool.query('SELECT 1');
        res.status(200).json({
            success: true,
            status: 'ok',
            timestamp: new Date().toISOString(),
            database: 'connected',
            environment: process.env.NODE_ENV || 'development',
        });
    } catch (error) {
        error.statusCode = 503;
        error.message = 'Database unavailable';
        next(error);
    }
});

const authRoutes = require('./src/routes/authRoutes');
const recipeRoutes = require('./src/routes/recipeRoutes');
const commentRoutes = require('./src/routes/commentRoutes');
const ratingRoutes = require('./src/routes/ratingRoutes');

// authLimiter is stricter than globalLimiter — brute force protection on login/register
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/recipes', recipeRoutes);
app.use('/api/v1/recipes/:recipeId/comments', commentRoutes);
app.use('/api/v1/recipes/:recipeId/ratings', ratingRoutes);

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: {
            message: `Route ${req.method} ${req.originalUrl} not found`,
            code: 'NOT_FOUND',
        },
    });
});

// ─── Error handling ──────────────────────────────────────────────────────────
// Must be last. The 4-parameter signature is how Express identifies error handlers.
app.use(errorHandler);

module.exports = app;
// Nothing after this line. module.exports terminates the effective file.
