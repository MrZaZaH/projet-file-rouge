// src/models/Recipe.js
//
// Data access layer for the recipes table.
// All queries use parameterized statements — no string concatenation with user input.
// JSON columns (ingredients, steps) are serialized on write, parsed on read.
// average_rating and rating_count are denormalized fields updated via updateRating().
// Soft delete is handled via deleted_at — no hard DELETE used anywhere.

'use strict';

const { pool } = require('../database/connection');

class Recipe {

    // ─── Private helper ────────────────────────────────────────────────────────

    // Parses JSON columns after a SELECT.
    // MariaDB returns JSON columns as strings — we want real JS arrays.
    // Called internally before returning any recipe object.
    static _parseJsonFields(recipe) {
        if (!recipe) return null;
        return {
            ...recipe,
            ingredients: typeof recipe.ingredients === 'string'
                ? JSON.parse(recipe.ingredients)
                : recipe.ingredients,
            steps: typeof recipe.steps === 'string'
                ? JSON.parse(recipe.steps)
                : recipe.steps,
        };
        // Why check typeof? When running tests, data might already be parsed.
        // This makes the helper safe to call multiple times without crashing.
    }

    // ─── Read methods ──────────────────────────────────────────────────────────

    // Retrieve a single recipe by id, with author username and category name.
    // Returns null if not found, soft-deleted, or not published.
    // Used for the public recipe detail page.
    static async findById(id) {
        const [rows] = await pool.execute(
            `SELECT
                r.id,
                r.title,
                r.anecdote,
                r.ingredients,
                r.steps,
                r.prep_time,
                r.cost_per_portion,
                r.status,
                r.average_rating,
                r.rating_count,
                r.created_at,
                r.updated_at,
                r.user_id,
                u.username    AS author_username,
                r.category_id,
                c.name        AS category_name,
                c.slug        AS category_slug
             FROM recipes r
             JOIN users      u ON r.user_id      = u.id
             JOIN categories c ON r.category_id  = c.id
             WHERE r.id = ?
               AND r.deleted_at IS NULL`,
            [id]
            // No status filter here — admins also use findById.
            // Status filtering is applied at controller level if needed.
        );
        return Recipe._parseJsonFields(rows[0] || null);
    }

    // Retrieve all recipes with optional filters.
    // Supports: status, category_id, max_prep_time, max_cost, search (title).
    // All filters are optional and combinable.
    // Used by the public listing and admin panel.
    static async findAllWithFilters(filters = {}) {
        const conditions = ['r.deleted_at IS NULL'];
        const values = [];
        // We build conditions as an array, then join with AND.
        // This avoids the classic "WHERE 1=1" hack while staying readable.

        if (filters.status) {
            conditions.push('r.status = ?');
            values.push(filters.status);
        }
        // Default public view: pass { status: 'published' } from the controller.
        // Admin view: omit status to see everything, or pass a specific status.

        if (filters.category_id) {
            conditions.push('r.category_id = ?');
            values.push(filters.category_id);
        }

        if (filters.max_prep_time) {
            conditions.push('r.prep_time <= ?');
            values.push(filters.max_prep_time);
            // US-01 / US-07: "Prêt en moins de 15 minutes" → pass max_prep_time: 15
        }

        if (filters.max_cost) {
            conditions.push('r.cost_per_portion <= ?');
            values.push(filters.max_cost);
            // US-03: budget filter → pass max_cost: 3 or max_cost: 5
        }

        if (filters.search) {
            conditions.push('r.title LIKE ?');
            values.push(`%${filters.search}%`);
            // LIKE with % on both sides = contains search.
            // Not a full-text search — sufficient for MVP.
            // The value is passed as a parameter, not concatenated → safe.
        }

        const whereClause = conditions.join(' AND ');

        const [rows] = await pool.execute(
            `SELECT
                r.id,
                r.title,
                r.anecdote,
                r.prep_time,
                r.cost_per_portion,
                r.status,
                r.average_rating,
                r.rating_count,
                r.created_at,
                r.user_id,
                u.username    AS author_username,
                r.category_id,
                c.name        AS category_name,
                c.slug        AS category_slug
             FROM recipes r
             JOIN users      u ON r.user_id     = u.id
             JOIN categories c ON r.category_id = c.id
             WHERE ${whereClause}
             ORDER BY r.created_at DESC`,
            values
            // No ingredients/steps in the list view — heavy JSON, useless for cards.
            // Detail page uses findById() which does include them.
        );

        return rows.map(Recipe._parseJsonFields);
        // Map applies _parseJsonFields to every row.
        // If rows is empty, map returns [] — not null, not an error.
    }

    // Retrieve one random published recipe.
    // Used by the "Surprends-moi" button (US-01).
    static async findRandom() {
        const [rows] = await pool.execute(
            `SELECT
                r.id,
                r.title,
                r.anecdote,
                r.prep_time,
                r.cost_per_portion,
                r.average_rating,
                r.user_id,
                u.username   AS author_username,
                r.category_id,
                c.name       AS category_name
             FROM recipes r
             JOIN users      u ON r.user_id     = u.id
             JOIN categories c ON r.category_id = c.id
             WHERE r.status = 'published'
               AND r.deleted_at IS NULL
             ORDER BY RAND()
             LIMIT 1`
            // RAND() is fine for MVP at this data volume.
            // At scale (100k+ rows) it becomes slow — not our problem today.
        );
        return rows[0] || null;
        // No JSON fields in this query, no parse needed.
    }

    // ─── Write methods ─────────────────────────────────────────────────────────

    // Create a new recipe.
    // Expects an object with all required fields.
    // Returns the created recipe via findById (includes author and category names).
    static async create({ user_id, category_id, title, anecdote, ingredients, steps, prep_time, cost_per_portion }) {
        const [result] = await pool.execute(
            `INSERT INTO recipes
                (user_id, category_id, title, anecdote, ingredients, steps, prep_time, cost_per_portion)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                user_id,
                category_id,
                title,
                anecdote,
                JSON.stringify(ingredients),
                JSON.stringify(steps),
                prep_time,
                cost_per_portion
                // JSON.stringify converts JS arrays to JSON strings for storage.
                // status defaults to 'pending' per the column definition — no need to pass it.
            ]
        );
        return Recipe.findById(result.insertId);
    }

    // Update editable recipe fields.
    // Only the author (or admin, checked at controller level) should call this.
    // Returns the updated recipe.
    static async update(id, { category_id, title, anecdote, ingredients, steps, prep_time, cost_per_portion }) {
        await pool.execute(
            `UPDATE recipes
             SET category_id      = ?,
                 title            = ?,
                 anecdote         = ?,
                 ingredients      = ?,
                 steps            = ?,
                 prep_time        = ?,
                 cost_per_portion = ?
             WHERE id = ?
               AND deleted_at IS NULL`,
            [
                category_id,
                title,
                anecdote,
                JSON.stringify(ingredients),
                JSON.stringify(steps),
                prep_time,
                cost_per_portion,
                id
            ]
            // updated_at is handled automatically by MariaDB (ON UPDATE CURRENT_TIMESTAMP).
            // No need to set it manually.
        );
        return Recipe.findById(id);
    }

    // Update recipe status (admin moderation: published / rejected).
    // Called by AdminController — not exposed to regular users.
    static async updateStatus(id, status) {
        const [result] = await pool.execute(
            `UPDATE recipes
             SET status = ?
             WHERE id = ?
               AND deleted_at IS NULL`,
            [status, id]
        );
        return result.affectedRows > 0;
    }

    // Update denormalized rating fields after a new rating is inserted.
    // Called by Rating.js — never called directly from a controller.
    // Formula: new_avg = ((current_avg * current_count) + new_score) / (current_count + 1)
    static async updateRating(id, newScore) {
        const [result] = await pool.execute(
            `UPDATE recipes
             SET average_rating = ROUND(
                     (average_rating * rating_count + ?) / (rating_count + 1),
                 2),
                 rating_count   = rating_count + 1
             WHERE id = ?
               AND deleted_at IS NULL`,
            [newScore, id]
            // The entire calculation happens in SQL — atomic, no race condition.
            // ROUND(..., 2) keeps average_rating at 2 decimal places (matches DECIMAL(3,2)).
            // If we did this in JS: read → calculate → write = 3 separate operations.
            // Two simultaneous ratings would both read the same old value → wrong average.
        );
        return result.affectedRows > 0;
    }

    // Soft delete a recipe.
    // Does not check ownership — that check belongs in the controller.
    static async delete(id) {
        const [result] = await pool.execute(
            `UPDATE recipes
             SET deleted_at = NOW()
             WHERE id = ?
               AND deleted_at IS NULL`,
            [id]
        );
        return result.affectedRows > 0;
    }
}

module.exports = Recipe;
