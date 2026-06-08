// src/middlewares/security.js
// Security middlewares applied globally to all routes.(URL)
//
// Helmet: sets HTTP security headers automatically.
// CORS: controls which origins can call our API.
// 
// Security principle applied: deny by default, whitelist explicitly.

'use strict';

const helmet = require('helmet');
const cors = require('cors');

// Helmet configures ~15 HTTP headers that protect against common attacks:
// - X-Frame-Options: prevents clickjacking
// - X-Content-Type-Options: prevents MIME sniffing
// - Strict-Transport-Security: forces HTTPS (production)
// - Content-Security-Policy: restricts resource origins
// Using defaults is fine for an API. Customize only if you have specific needs.
const helmetMiddleware = helmet();

// CORS – Cross-Origin Resource Sharing
// Without this, browsers block requests from your frontend to your API
// if they run on different origins (different port = different origin).
//
// WARNING: cors({ origin: '*' }) allows ANY site to call your API.
// Never do that for an authenticated API.
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:5500'];

const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (curl, Postman, server-to-server)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS policy: origin ${origin} is not allowed`));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    // exposedHeaders: credentials in cookies would need credentials: true
};

const corsMiddleware = cors(corsOptions);

module.exports = { helmetMiddleware, corsMiddleware };
