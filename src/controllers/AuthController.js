// src / controllers / AuthController1.js

'use strict';

const bcrypt = require('bcryptjs'); // Library to hash passwords securely
const jwt = require('jsonwebtoken'); // Library to generate JWT tokens
const { validationResult } = require('express-validator'); // Handles request validation results
const User = require('../models/User'); // User model for DB access
const { sendSuccess, sendError } = require('../utils/apiResponse'); // Standard API response helpers

const BCRYPT_ROUNDS = 12; // Number of hashing rounds for bcrypt (security vs performance)

class AuthController {

    // POST /api/v1/auth/register
    static async register(req, res, next) {
        try {
            // Extract validation errors from middleware
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                // Return all validation errors at once
                return sendError(res, 'Validation failed', 422);
            }

            const { username, email, password } = req.body; // Extract user input

            // Check if email already exists in DB
            const existingUser = await User.findByEmail(email);
            if (existingUser) {
                return sendError(res, 'Email already in use', 409);
            }

            // Hash the password before storing
            const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

            // Create user in DB (without exposing password)
            const newUser = await User.create({ username, email, password_hash });

            // Generate JWT token for authentication
            const token = jwt.sign(
                {
                    id: newUser.id,
                    role: newUser.role,
                    username: newUser.username
                },
                process.env.JWT_SECRET,
                { expiresIn: '24h' } // Token validity
            );

            // Return user + token
            return sendSuccess(res, { user: newUser, token }, 'User registered', 201);

        } catch (error) {
            next(error); // Forward error to global handler
        }
    }

    // POST /api/v1/auth/login
    static async login(req, res, next) {
        try {
            // Validate request
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return sendError(res, 'Validation failed', 422);
            }

            const { email, password } = req.body;

            // Fetch user including password hash
            const user = await User.findByEmailWithPassword(email);

            // Prevent user enumeration by using same message
            if (!user) {
                return sendError(res, 'Invalid email or password', 401);
            }

            // Compare password with stored hash
            const passwordMatch = await bcrypt.compare(password, user.password_hash);
            if (!passwordMatch) {
                return sendError(res, 'Invalid email or password', 401);
            }

            // Generate JWT token
            const token = jwt.sign(
                {
                    id: user.id,
                    role: user.role,
                    username: user.username
                },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            // Remove sensitive data before sending response
            const { password_hash, ...safeUser } = user;

            return sendSuccess(res, { user: safeUser, token }, 'Login successful');

        } catch (error) {
            next(error);
        }
    }

    // GET /api/v1/auth/me
    static async getMe(req, res, next) {
        try {
            // Fetch current user from DB using ID from token
            const user = await User.findById(req.user.id);

            // If user not found, return error
            if (!user) {
                return sendError(res, 'User not found', 404);
            }

            // Return current user data
            return sendSuccess(res, { user });

        } catch (error) {
            next(error);
        }
    }
}

module.exports = AuthController;
