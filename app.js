// app.js
// Express application setup.
// Middlewares are applied in order – order matters.
// 
// Chain:
//   Security headers → CORS → Request logging → Body parsing → Routes → Error handling
//
// The error handler MUST be last. Always.

'use strict';

require('dotenv').config();

const express = require('express');
const { helmetMiddleware, corsMiddleware } = require('./src/middlewares/security');
const { httpLogger } = require('./src/middlewares/logger');
const { errorHandler } = require('./src/middlewares/errorHandler');

const app = express();

// ─── Security ────────────────────────────────────────────────────────────────
app.use(helmetMiddleware);
app.use(corsMiddleware);

// ─── Request logging ─────────────────────────────────────────────────────────
app.use(httpLogger);

// ─── Body parsing ────────────────────────────────────────────────────────────
// Parse JSON request bodies – required for POST/PUT endpoints
// limit: '10kb' prevents payload-based DoS attacks (someone sending 100MB of JSON)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// ─── Routes ──────────────────────────────────────────────────────────────────

// Health check – verifies the server AND the database are alive
// Used by monitoring tools, deployment pipelines, and your own sanity
app.get('/health', async (req, res, next) => {
    try {
        const { pool } = require('./src/database/connection');

        // Test DB with a minimal query
        await pool.query('SELECT 1');

        res.status(200).json({
            success: true,
            status: 'ok',
            timestamp: new Date().toISOString(),
            database: 'connected',
            environment: process.env.NODE_ENV || 'development',
        });
    } catch (error) {
        // Pass to error handler – don't expose raw DB error to client
        error.statusCode = 503;
        error.message = 'Database unavailable';
        next(error);
    }
});

const authRoutes = require('./src/routes/authRoutes.js');
const recipeRoutes = require('./src/routes/recipeRoutes.js');
const commentRoutes = require('./src/routes/commentRoutes.js');
const ratingRoutes = require('./src/routes/ratingRoutes.js');

// API routes here
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/recipes', recipeRoutes);
app.use('/api/v1/recipes/:recipeId/comments', commentRoutes);
app.use('/api/v1/recipes/:recipeId/ratings', ratingRoutes);


// 404 handler – catches requests that matched no route
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
// Must be AFTER all routes. Express knows it's an error handler because of the 4 params.
app.use(errorHandler);

module.exports = app;
