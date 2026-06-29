// src/middlewares/security.js
//
// Global security middlewares.
//
// Applied in app.js in this order:
//   1. helmetMiddleware  — HTTP security headers
//   2. corsMiddleware    — Cross-origin request control
//   3. globalLimiter     — Rate limiting for all routes
//   4. authLimiter       — Stricter rate limiting for auth routes only

'use strict';

const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

// ─── Helmet ───────────────────────────────────────────────────────────────────
// Sets ~15 HTTP headers automatically.
// Key protections:
//   X-Frame-Options        → prevents clickjacking
//   X-Content-Type-Options → prevents MIME sniffing
//   Strict-Transport-Security → forces HTTPS in production
//   Content-Security-Policy   → restricts resource origins
const helmetMiddleware = helmet();

// ─── CORS ────────────────────────────────────────────────────────────────────
// Controls which origins the browser allows to call this API.
// Without this, any cross-origin fetch from a browser is blocked.
//
// Rule: deny by default, whitelist explicitly.
// Never use origin: '*' on an authenticated API — it allows any site to
// make credentialed requests on behalf of your users.
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:5500'];

const corsOptions = {
    origin: (origin, callback) => {
        // No origin = curl, Postman, server-to-server — allow.
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS policy: origin ${origin} is not allowed`));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};

const corsMiddleware = cors(corsOptions);

// ─── Rate limiting ────────────────────────────────────────────────────────────
// express-rate-limit tracks requests per IP address.
// When the limit is reached, it returns 429 Too Many Requests automatically.
// standardHeaders: true  → sends RateLimit-* headers so clients know their quota
// legacyHeaders: false   → disables the older X-RateLimit-* headers (redundant)

// Global: 100 requests per 15 minutes (dev: 500 or RATE_LIMIT_MAX from env).
// Protects all routes against scraping and basic flood attacks.
const noopMiddleware = (_req, _res, next) => next();

const GLOBAL_MAX = parseInt(process.env.RATE_LIMIT_MAX, 10) || (process.env.NODE_ENV === 'development' ? 500 : 100);

const globalLimiter = process.env.NODE_ENV === 'test'
    ? noopMiddleware
    : rateLimit({
        windowMs: 15 * 60 * 1000,
        max: GLOBAL_MAX,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            success: false,
            error: {
                message: 'Too many requests, please try again later.',
                code: 'RATE_LIMIT_EXCEEDED',
            },
        },
    });

// Auth: 10 requests per 15 minutes.
// Applied only to /api/v1/auth — limits brute force on login and register.
// 10 is already generous for legitimate use: a human doesn't need to attempt
// login more than 10 times in 15 minutes.
const authLimiter = process.env.NODE_ENV === 'test'
    ? noopMiddleware
    : rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 10,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            success: false,
            error: {
                message: 'Too many authentication attempts, please try again later.',
                code: 'AUTH_RATE_LIMIT_EXCEEDED',
            },
        },
    });

// ─── Single export ────────────────────────────────────────────────────────────
// One module.exports, at the end of the file, always.
module.exports = { helmetMiddleware, corsMiddleware, globalLimiter, authLimiter };
