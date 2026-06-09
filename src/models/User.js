// src/models/User.js
//
// Data access layer for the users table.
// IMPORTANT: passwords are NEVER stored in plain text.
// Hashing is handled at the controller/service level (bcryptjs).
// This model only stores and retrieves the already-hashed password.
// The model never returns the password_hash field in public-facing methods.

'use strict';

const { pool } = require('../database/connection');

class User {

    // ─── Internal helper ───────────────────────────────────────────────────────
    // Used only for authentication — returns password_hash
    // Never use this method to send data to the client
    static async findByEmailWithPassword(email) {
        const [rows] = await pool.execute(
            `SELECT id, username, email, password_hash, role, points, created_at
             FROM users 
             WHERE email = ? AND deleted_at IS NULL`,
            [email]
        );
        return rows[0] || null;
    }

    // ─── Public methods ────────────────────────────────────────────────────────

    // Find a user by email — returns user WITHOUT password_hash
    // Used to check if an email already exists during registration
    static async findByEmail(email) {
        const [rows] = await pool.execute(
            `SELECT id, username, email, role, points, created_at
             FROM users 
             WHERE email = ? AND deleted_at IS NULL`,
            [email]
        );
        return rows[0] || null;
    }

    // Find a user by primary key — no password returned
    // bio and avatar_url are not in the schema (post-MVP fields)
    static async findById(id) {
        const [rows] = await pool.execute(
            `SELECT id, username, email, role, points, created_at
             FROM users
             WHERE id = ? AND deleted_at IS NULL`,
            [id]
        );
        return rows[0] || null;
    }

    // Create a new user
    // Expects password_hash (already hashed by bcryptjs before calling this)
    // Returns the created user without password_hash
    static async create({ username, email, password_hash, role = 'user' }) {
        const [result] = await pool.execute(
            `INSERT INTO users (username, email, password_hash, role)
             VALUES (?, ?, ?, ?)`,
            [username, email, password_hash, role]
            // role defaults to 'user' — only explicitly set to 'admin' via direct DB access
            // Never trust a role value coming from user input
        );
        return User.findById(result.insertId);
    }

    // Update user profile fields (not password — that's a separate operation)
    // Only username is updatable for now — bio and avatar_url not in MVP schema
    static async update(id, { username }) {
        await pool.execute(
            `UPDATE users
             SET username = ?, updated_at = NOW()
             WHERE id = ? AND deleted_at IS NULL`,
            [username, id]
        );
        return User.findById(id);
    }

    // Update password — receives already-hashed password
    static async updatePassword(id, newPasswordHash) {
        const [result] = await pool.execute(
            `UPDATE users
             SET password_hash = ?, updated_at = NOW()
             WHERE id = ? AND deleted_at IS NULL`,
            [newPasswordHash, id]
        );
        return result.affectedRows > 0;
    }

    // Add points to a user (gamification field — kept for post-MVP)
    static async addPoints(id, points) {
        const [result] = await pool.execute(
            `UPDATE users
             SET points = points + ?, updated_at = NOW()
             WHERE id = ? AND deleted_at IS NULL`,
            [points, id]
            // points + ? is done in SQL, not in JS
            // Why? Avoids race conditions: if two requests hit simultaneously,
            // SQL handles the increment atomically. JS would read stale data.
        );
        return result.affectedRows > 0;
    }

    // Soft delete
    static async delete(id) {
        const [result] = await pool.execute(
            'UPDATE users SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL',
            [id]
        );
        return result.affectedRows > 0;
    }

    // Admin only — list all users (including soft-deleted if needed)
    static async findAll({ includeDeleted = false } = {}) {
        const query = includeDeleted
            ? 'SELECT id, username, email, role, points, created_at, deleted_at FROM users ORDER BY created_at DESC'
            : 'SELECT id, username, email, role, points, created_at FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC';

        const [rows] = await pool.execute(query);
        return rows;
    }
}

module.exports = User;
