// src/controllers/AuthController.js
//
// Handles user authentication: registration and login.
// 
// Security responsibilities of this controller:
//   - Input validation is handled by express-validator middleware (see auth routes)
//   - Passwords are hashed with bcryptjs before storage (never stored plain)
//   - JWT tokens are signed with HS256 and expire after 24h
//   - Error messages are intentionally vague on login failure (no user enumeration)

'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');

// How many bcrypt rounds to use for hashing.
// 12 = good balance between security and performance (~300ms on average hardware).
// Lower = faster but easier to brute-force. Higher = slower for everyone.
const BCRYPT_ROUNDS = 12;

class AuthController {

    // POST /api/v1/auth/register
    static async register(req, res, next) {
        try {
            // Check validation results from express-validator middleware
            // If there are errors, return them all at once — don't make the user guess
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: {
                        message: 'Validation failed',
                        code: 'VALIDATION_ERROR',
                        details: errors.array()
                    }
                });
            }

            const { username, email, password } = req.body;

            // Check if email is already taken
            // We check email, not username, because email is the login identifier
            const existingUser = await User.findByEmail(email);
            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    error: {
                        message: 'Email already in use',
                        code: 'EMAIL_TAKEN'
                    }
                });
            }

            // Hash the password before storing
            // bcrypt.hash() is async — it won't block the event loop
            const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

            // Create user — model returns the new user without password_hash
            const newUser = await User.create({ username, email, password_hash });

            // Sign a JWT — payload contains only what's needed to identify the user
            // Nothing sensitive. The frontend will use this token for authenticated requests.
            const token = jwt.sign(
                {
                    id: newUser.id,
                    role: newUser.role,
                    username: newUser.username
                },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            return res.status(201).json({
                success: true,
                data: {
                    user: newUser,
                    token
                }
            });

        } catch (error) {
            // Pass to global error handler — never expose raw errors to the client
            next(error);
        }
    }

    // POST /api/v1/auth/login
    static async login(req, res, next) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: {
                        message: 'Validation failed',
                        code: 'VALIDATION_ERROR',
                        details: errors.array()
                    }
                });
            }

            const { email, password } = req.body;

            // Fetch user WITH password_hash — this is the only place we do this
            const user = await User.findByEmailWithPassword(email);

            // IMPORTANT: same error message whether email doesn't exist OR password is wrong.
            // Why? "User enumeration" attack: if you say "email not found", 
            // an attacker can scan emails to find which ones have accounts.
            // Vague message = attacker learns nothing useful.
            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: {
                        message: 'Invalid email or password',
                        code: 'INVALID_CREDENTIALS'
                    }
                });
            }

            // Compare submitted password against stored hash
            // bcrypt.compare() is timing-safe — it won't short-circuit early
            const passwordMatch = await bcrypt.compare(password, user.password_hash);
            if (!passwordMatch) {
                return res.status(401).json({
                    success: false,
                    error: {
                        message: 'Invalid email or password',
                        code: 'INVALID_CREDENTIALS'
                    }
                });
            }

            // Password is correct — sign a token
            const token = jwt.sign(
                {
                    id: user.id,
                    role: user.role,
                    username: user.username
                },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            // Return user data WITHOUT password_hash
            // Destructure to remove the field before sending
            const { password_hash, ...safeUser } = user;

            return res.status(200).json({
                success: true,
                data: {
                    user: safeUser,
                    token
                }
            });

        } catch (error) {
            next(error);
        }
    }

    // GET /api/v1/auth/me
    // Returns the currently authenticated user's data
    // Requires the auth middleware to run first (token verification)
    static async getMe(req, res, next) {
        try {
            // req.user is set by the auth middleware after token verification
            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: { message: 'User not found', code: 'USER_NOT_FOUND' }
                });
            }

            return res.status(200).json({
                success: true,
                data: { user }
            });

        } catch (error) {
            next(error);
        }
    }
}

module.exports = AuthController;
