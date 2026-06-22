/**
 * Recipe Model
 *
 * Purpose:
 * --------
 * Encapsulates all database operations related to recipes.
 * Provides CRUD methods + filtering + soft delete functionality.
 *
 * Key responsibilities:
 * 1. Create recipes with validation (user_id, category_id, required fields)
 * 2. Retrieve recipes (by ID, all, filtered) with proper relationships
 * 3. Update recipes (title, anecdote, ingredients, steps, cost, status)
 * 4. Soft delete recipes (mark deleted_at, don't remove rows)
 * 5. Parse JSON fields (ingredients, steps) for frontend consumption
 * 6. Validate budget/time constraints
 *
 * Data handling notes:
 * - ingredients & steps are stored as JSON in database, parsed on retrieval
 * - ingredients & steps accept BOTH string and array input on create:
 *     string "a,b,c"          → normalized to array ["a","b","c"] before insert
 *     string "1.\n2."         → normalized to array ["1.","2."]   before insert
 *     array  ["a","b"]        → kept as-is
 *   This makes the model robust regardless of caller format (form, API, test).
 * - anecdote is plain text (recipe story)
 * - cost_per_portion is decimal(5,2), must be parsed as float
 * - cost_per_portion >= 0 is valid (free recipe is allowed)
 * - Soft delete: set deleted_at timestamp, don't remove row
 * - All queries use parameterized statements (prevent SQL injection)
 *
 * Column mapping note:
 * - users table has column "username" (NOT "pseudo")
 * - The returned object exposes BOTH recipe.username (flat, for API/tests)
 *   AND recipe.user.username (nested, for structured consumers)
 *
 * Filter aliases:
 * - findAllWithFilters() accepts both max_cost AND max_cost_per_portion
 *   so callers don't need to remember the exact key name
 *
 * Security:
 * - All queries parameterized with ? placeholders
 * - Input validation at model level (type, range, length)
 * - FK constraints enforced by database
 * - Error messages don't leak sensitive DB info
 */

'use strict';

// pool: shared MariaDB connection pool (mysql2/promise)
// All queries go through this pool — never create ad-hoc connections
const { pool } = require('../database/connection');

// logger: winston instance — logs errors and warnings without crashing the app
const { logger } = require('../middlewares/logger');

// Filter constants — centralized magic numbers and sort strategies
const { FILTERS, SORT } = require('../constants/filters');


class Recipe {

    // ============================================================
    //  CREATE
    // ============================================================

    /**
     * create(data)
     *
     * Purpose:
     * --------
     * Inserts a new recipe into the database with full validation.
     * Normalizes ingredients and steps so both string and array inputs work.
     *
     * Parameters:
     * {
     *   user_id: number,           ← Must exist in users table (FK)
     *   category_id: number,       ← Must exist in categories table (FK)
     *   title: string,             ← Required, max 255 chars
     *   anecdote: string,          ← Required, the story behind the recipe
     *   ingredients: string|array, ← String "a,b" or array ["a","b"] — both accepted
     *   steps: string|array,       ← String "1.\n2." or array ["1.","2."] — both accepted
     *   prep_time: number,         ← Minutes, must be >= 0
     *   cost_per_portion: number,  ← Euros, must be >= 0 (0 = free recipe)
     *   image_url?: string,        ← Optional
     *   status?: string,           ← Optional, defaults to 'pending'
     * }
     *
     * Normalization logic:
     * - If ingredients is already an array   → use as-is
     * - If ingredients is a non-empty string → split on "," → trim each item
     * - Otherwise                            → throw error
     * Same logic applies to steps, but split on "\n" instead of ","
     *
     * Throws:
     * - "Title is required"               (empty or missing title)
     * - "Anecdote is required"            (empty or missing anecdote)
     * - "Ingredients are required and non-empty"
     * - "Steps are required and non-empty"
     * - "Cost per portion must be >= 0"   (NaN or negative cost)
     * - "Prep time must be non-negative number"
     * - "User ID and Category ID required"
     * - "User or Category not found"      (FK violation from DB)
     * - "Invalid data: constraint violation"
     *
     * Returns:
     * Full recipe object from findById() — see findById() return shape.
     */
    static async create(data) {
        try {

            // ====================================================
            // VALIDATION PHASE
            // ====================================================

            // title must be present and non-empty after trimming whitespace
            if (!data.title || data.title.trim() === '') {
                throw new Error('Title is required');
            }

            // anecdote is mandatory — it IS the recipe's identity on this platform
            if (!data.anecdote || data.anecdote.trim() === '') {
                throw new Error('Anecdote is required');
            }

            // user_id and category_id must be provided before FK check
            // (early exit avoids a useless DB round-trip)
            if (!data.user_id || !data.category_id) {
                throw new Error('User ID and Category ID required');
            }

            // ====================================================
            // NORMALIZE ingredients
            // ====================================================
            // Why normalize here instead of forcing array at call site?
            // Because HTML forms send strings, tests may send strings,
            // and the API may receive either format. The model is the
            // single source of truth — it should handle both gracefully.

            let ingredients;

            if (Array.isArray(data.ingredients)) {
                // Caller passed an array — use directly
                ingredients = data.ingredients;
            } else if (typeof data.ingredients === 'string' && data.ingredients.trim() !== '') {
                // Caller passed a comma-separated string — split and clean
                // "pâtes, tomate , parmesan" → ["pâtes", "tomate", "parmesan"]
                ingredients = data.ingredients
                    .split(',')                           // split on comma
                    .map(s => s.trim())                   // remove surrounding spaces
                    .filter(s => s.length > 0);           // remove empty strings
            } else {
                // null, undefined, empty string, wrong type — reject
                ingredients = [];
            }

            // After normalization, the array must contain at least one item
            if (ingredients.length === 0) {
                throw new Error('Ingredients are required and non-empty');
            }

            // ====================================================
            // NORMALIZE steps
            // ====================================================
            // Steps are newline-separated when passed as a string
            // "1. Cuire\n2. Servir" → ["1. Cuire", "2. Servir"]

            let steps;

            if (Array.isArray(data.steps)) {
                // Caller passed an array — use directly
                steps = data.steps;
            } else if (typeof data.steps === 'string' && data.steps.trim() !== '') {
                // Caller passed a newline-separated string — split and clean
                steps = data.steps
                    .split('\n')                          // split on newline
                    .map(s => s.trim())                   // remove surrounding spaces
                    .filter(s => s.length > 0);           // remove empty lines
            } else {
                steps = [];
            }

            // After normalization, the array must contain at least one item
            if (steps.length === 0) {
                throw new Error('Steps are required and non-empty');
            }

            // ====================================================
            // VALIDATE cost_per_portion
            // ====================================================
            // parseFloat() converts "3.00", 3, 3.0 → 3
            // isNaN() catches non-numeric strings, null, undefined
            // cost < 0 → rejected (negative price makes no sense)
            // cost === 0 → allowed (free recipe is a valid concept)

            const cost = parseFloat(data.cost_per_portion);
            if (isNaN(cost) || cost < 0) {
                throw new Error('Cost per portion must be >= 0');
            }

            // ====================================================
            // VALIDATE prep_time
            // ====================================================
            // parseInt(..., 10) — radix 10 prevents octal parsing bugs
            // prep_time = 0 is valid (e.g. "no prep needed")

            const prepTime = parseInt(data.prep_time, 10);
            if (isNaN(prepTime) || prepTime < 0) {
                throw new Error('Prep time must be non-negative number');
            }

            // ====================================================
            // DATABASE INSERT
            // ====================================================
            // All values passed as parameterized placeholders (?)
            // mysql2 escapes each value — no SQL injection possible

            const query = `
                INSERT INTO recipes (
                    user_id, category_id, title, anecdote,
                    ingredients, steps,
                    prep_time, cost_per_portion,
                    status, average_rating, rating_count,
                    created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            `;

            const [result] = await pool.query(query, [
                data.user_id,                       // [1] FK → users.id
                data.category_id,                   // [2] FK → categories.id
                data.title.trim(),                  // [3] trimmed title
                data.anecdote.trim(),               // [4] trimmed anecdote
                JSON.stringify(ingredients),        // [5] array → JSON string for storage
                JSON.stringify(steps),              // [6] array → JSON string for storage
                prepTime,                           // [7] validated integer
                cost,                               // [8] validated float
                data.status || 'pending',           // [9] default status = pending (awaits moderation)
                0,                                  // [10] initial average_rating = 0
                0,                                  // [11] initial rating_count = 0
            ]);

            // insertId: auto-increment ID assigned by MariaDB for this row
            const recipeId = result.insertId;

            // Fetch the full recipe through findById() to:
            // 1. Return consistent shape (same as all other read operations)
            // 2. Parse JSON fields back to arrays automatically
            // 3. Include user and category data via JOIN
            return this.findById(recipeId);

        } catch (error) {
            // Log with full message for debugging
            logger.error(`Recipe.create() failed: ${error.message}`);

            // FK violation: user_id or category_id does not exist in their table
            // MariaDB error message contains "FOREIGN KEY" — we translate it
            // to a safe message that doesn't expose table/column names
            if (error.message.includes('FOREIGN KEY')) {
                throw new Error('User or Category not found');
            }

            // Other constraint violations (unique, check, etc.)
            if (error.message.includes('CONSTRAINT')) {
                throw new Error('Invalid data: constraint violation');
            }

            // Re-throw all other errors (validation errors, connection errors)
            throw error;
        }
    }

    // ============================================================
    //  FIND BY ID
    // ============================================================

    /**
     * findById(id)
     *
     * Purpose:
     * --------
     * Retrieves a single recipe by primary key, with author and category data.
     * Excludes soft-deleted recipes (WHERE deleted_at IS NULL).
     *
     * JOIN strategy:
     * - LEFT JOIN users      → get author's username and email
     * - LEFT JOIN categories → get category name and description
     * LEFT JOIN (not INNER JOIN) because we don't want to lose the recipe
     * if the user account was somehow removed (defensive query).
     *
     * Column alias note:
     * - users.username is aliased as user_pseudo in the SQL query
     * - In the returned object, it is exposed as BOTH:
     *     recipe.username        (flat property — expected by tests and REST API)
     *     recipe.user.username   (nested object — for structured consumers)
     * This dual exposure avoids breaking either consumer type.
     *
     * Parameters:
     * - id: number — recipe primary key
     *
     * Returns: full recipe object (see shape in JSDoc above create())
     * Returns null if recipe not found or soft-deleted
     *
     * Throws: database errors (connection, query syntax)
     */
    static async findById(id) {
        try {

            // SELECT r.* gets all recipe columns
            // u.username aliased as user_pseudo (users table has "username", not "pseudo")
            // c.name / c.description aliased with category_ prefix to avoid name collisions
            // LIMIT 1: we expect exactly one row — stop scanning after first match
            const query = `
                SELECT
                    r.*,
                    u.username  AS user_pseudo,
                    u.email     AS user_email,
                    c.name      AS category_name
                FROM recipes r
                LEFT JOIN users      u ON r.user_id      = u.id
                LEFT JOIN categories c ON r.category_id  = c.id
                WHERE r.id = ? AND r.deleted_at IS NULL
                LIMIT 1
            `;

            // Parameterized: id is passed separately, never concatenated into SQL
            const [rows] = await pool.query(query, [id]);

            // No rows returned → recipe doesn't exist or is soft-deleted
            if (rows.length === 0) {
                return null;
            }

            const row = rows[0];

            // ====================================================
            // PARSE JSON FIELDS
            // ====================================================
            // ingredients and steps are stored as JSON strings in MariaDB
            // JSON.parse() converts them back to JavaScript arrays
            // We wrap in try/catch: if the stored JSON is malformed,
            // we return empty arrays instead of crashing the whole request

            let ingredients = [];
            let steps = [];

            try {
                ingredients = row.ingredients ? JSON.parse(row.ingredients) : [];
                steps = row.steps ? JSON.parse(row.steps) : [];
            } catch (parseError) {
                // Log the warning but don't crash — return empty arrays as fallback
                logger.warn(`Failed to parse JSON fields for recipe ${id}: ${parseError.message}`);
            }

            // ====================================================
            // PARSE NUMERIC FIELDS
            // ====================================================
            // MariaDB DECIMAL columns come back as strings in mysql2
            // parseFloat() converts "2.50" → 2.5 (proper JS number)

            const costPerPortion = parseFloat(row.cost_per_portion);
            const averageRating = parseFloat(row.average_rating);

            // ====================================================
            // RETURN FORMATTED OBJECT
            // ====================================================

            return {
                // --- Core recipe fields ---
                id: row.id,
                user_id: row.user_id,
                category_id: row.category_id,
                title: row.title,
                anecdote: row.anecdote,
                ingredients,                          // parsed array (not raw JSON string)
                steps,                                // parsed array (not raw JSON string)
                prep_time: row.prep_time,
                cost_per_portion: costPerPortion,     // parsed float
                status: row.status,
                average_rating: averageRating,      // parsed float
                rating_count: row.rating_count,
                image_url: row.image_url,

                // --- Timestamps ---
                created_at: row.created_at,
                updated_at: row.updated_at,
                deleted_at: row.deleted_at,

                // --- Flat author field ---
                // Exposed directly on the recipe object so tests can do:
                //   expect(recipe.username).toBeDefined()
                // and API consumers can read it without digging into a nested object
                username: row.user_pseudo,

                // --- Nested relationship objects ---
                // For consumers that prefer structured data
                user: {
                    username: row.user_pseudo,    // users.username (not pseudo)
                    email: row.user_email,
                },
                category: {
                    name: row.category_name,
                },
            };

        } catch (error) {
            logger.error(`Recipe.findById(${id}) failed: ${error.message}`);
            throw error;
        }
    }

    // ============================================================
    //  FIND ALL WITH FILTERS
    // ============================================================

    /**
     * findAllWithFilters(filters = {})
     *
     * Purpose:
     * --------
     * Returns an array of recipes matching the given filters.
     * Always excludes soft-deleted recipes.
     * All filters are optional — calling with {} returns all active recipes.
     *
     * Supported filters:
     * {
     *   category_id: number,          ← exact match on category
     *   max_prep_time: number,        ← prep_time <= value
     *   max_cost: number,             ← cost_per_portion <= value  (short alias)
     *   max_cost_per_portion: number, ← same filter, long name (both accepted)
     *   min_rating: number,           ← average_rating >= value
     *   status: string,               ← exact match on status
     *   limit: number,                ← pagination page size (default 50)
     *   offset: number,               ← pagination offset (default 0)
     * }
     *
     * Filter alias note:
     * max_cost and max_cost_per_portion do the exact same thing.
     * max_cost takes priority if both are provided.
     * This prevents test failures when callers use the short name.
     *
     * Dynamic query construction:
     * We build the WHERE clause by appending conditions only when the filter
     * is present. This avoids sending unnecessary conditions to the DB.
     * Parameters are collected in an array in the same order as the ? placeholders.
     *
     * Returns: array of recipe objects (same shape as findById minus user/category joins)
     * Returns [] if no recipes match.
     * Throws: database errors.
     */
    static async findAllWithFilters(filters = {}) {
        try {

            // ====================================================
            // BASE QUERY
            // ====================================================
            // Start with all non-deleted recipes
            // We build the rest of the WHERE clause dynamically below

            let query = `
                SELECT r.*
                FROM recipes r
                WHERE r.deleted_at IS NULL
            `;

            // params array: values injected in the same order as ? placeholders
            const params = [];

            // ====================================================
            // DYNAMIC WHERE CLAUSES
            // ====================================================

            // Filter by category (exact match)
            if (filters.category_id) {
                query += ' AND r.category_id = ?';
                params.push(filters.category_id);
            }

            // Filter by maximum prep time
            // Supports US-01: "Prêt en moins de 15 minutes"
            if (filters.max_prep_time) {
                query += ' AND r.prep_time <= ?';
                params.push(filters.max_prep_time);
            }

            // Filter by maximum cost per portion
            // Accepts both "max_cost" (short, used in tests) and
            // "max_cost_per_portion" (long, used in API docs)
            // max_cost takes priority when both are provided
            const maxCost = filters.max_cost !== undefined
                ? filters.max_cost
                : filters.max_cost_per_portion;

            if (maxCost !== undefined) {
                query += ' AND r.cost_per_portion <= ?';
                params.push(maxCost);
            }

            // Filter by minimum average rating
            if (filters.min_rating) {
                query += ' AND r.average_rating >= ?';
                params.push(filters.min_rating);
            }

            // Filter by moderation status (pending / published / rejected)
            if (filters.status) {
                query += ' AND r.status = ?';
                params.push(filters.status);
            }

            // ====================================================
            // ORDER & PAGINATION
            // // ====================================================
            // CONDITIONAL ORDER BY
            // ====================================================
            // Sort strategy depends on which filter is active.
            // Goal: surface the most relevant results first for each persona.
            //
            // Priority order (first match wins):
            // 1. max_prep_time active → fastest recipes first (persona: salarié crevé)
            // 2. max_cost active      → cheapest recipes first (persona: étudiant fauché)
            // 3. min_rating active    → best rated first (persona: parent épuisé)
            // 4. default              → newest first (homepage, no filter)
            //
            // Why first-match-wins?
            // A user filtering by prep time cares about speed above all else.
            // Mixing sort criteria would require a weighted ranking — out of scope for MVP.

            let sortClause;

            if (filters.max_prep_time) {
                sortClause = SORT.BY_TIME;      // prep_time ASC — fastest first
            } else if (maxCost !== undefined) {
                sortClause = SORT.BY_COST;      // cost_per_portion ASC — cheapest first
            } else if (filters.min_rating) {
                sortClause = SORT.BY_RATING;    // average_rating DESC — best rated first
            } else {
                sortClause = SORT.BY_DATE;      // created_at DESC — newest first (default)
            }

            query += ` ORDER BY r.${sortClause}`;

            // ====================================================
            // PAGINATION
            // ====================================================
            // limit: number of rows per page — capped at MAX_LIMIT to prevent abuse
            // offset: number of rows to skip — for page navigation
            // Both are injected as parameters (never interpolated) — SQL injection safe

            const rawLimit = parseInt(filters.limit, 10);
            const limit = (!isNaN(rawLimit) && rawLimit > 0)
                ? Math.min(rawLimit, FILTERS.MAX_LIMIT)   // cap at 100
                : FILTERS.DEFAULT_LIMIT;                  // default 50

            const offset = parseInt(filters.offset, 10) || 0;

            query += ' LIMIT ? OFFSET ?';
            params.push(limit, offset);


            // ====================================================
            // EXECUTE
            // ====================================================

            const [rows] = await pool.query(query, params);

            // ====================================================
            // MAP ROWS TO OBJECTS
            // ====================================================
            // Same parsing logic as findById() but applied to each row

            const recipes = rows.map((row) => {

                // Parse JSON fields stored as strings
                let ingredients = [];
                let steps = [];
                try {
                    ingredients = row.ingredients ? JSON.parse(row.ingredients) : [];
                    steps = row.steps ? JSON.parse(row.steps) : [];
                } catch (parseError) {
                    logger.warn(`Failed to parse JSON for recipe ${row.id}: ${parseError.message}`);
                }

                // Parse DECIMAL columns to JS floats
                const costPerPortion = parseFloat(row.cost_per_portion);
                const averageRating = parseFloat(row.average_rating);

                return {
                    id: row.id,
                    user_id: row.user_id,
                    category_id: row.category_id,
                    title: row.title,
                    anecdote: row.anecdote,
                    ingredients,                          // parsed array
                    steps,                                // parsed array
                    prep_time: row.prep_time,
                    cost_per_portion: costPerPortion,     // parsed float
                    status: row.status,
                    average_rating: averageRating,      // parsed float
                    rating_count: row.rating_count,
                    image_url: row.image_url,
                    created_at: row.created_at,
                    updated_at: row.updated_at,
                    deleted_at: row.deleted_at,
                };
            });

            return recipes;

        } catch (error) {
            logger.error(`Recipe.findAllWithFilters() failed: ${error.message}`);
            throw error;
        }
    }

    // ============================================================
    //  UPDATE
    // ============================================================

    /**
     * update(id, data)
     *
     * Purpose:
     * --------
     * Partially updates a recipe. Only provided fields are updated.
     * Automatically sets updated_at to current timestamp.
     * Excluded soft-deleted recipes from update scope.
     *
     * Parameters:
     * - id: number — recipe primary key
     * - data: partial recipe object — any combination of:
     *   {
     *     title?: string,
     *     anecdote?: string,
     *     ingredients?: array,
     *     steps?: array,
     *     prep_time?: number,
     *     cost_per_portion?: number,
     *     status?: string,
     *   }
     *
     * Validation (only for provided fields):
     * - cost_per_portion: must be >= 0 if provided
     * - prep_time: must be >= 0 if provided
     *
     * Dynamic UPDATE:
     * We only SET the fields that were actually passed.
     * This prevents overwriting unchanged fields with null/undefined.
     *
     * Throws:
     * - "Cost per portion must be >= 0"      (negative cost)
     * - "Prep time must be non-negative number"
     * - Database errors
     *
     * Returns:
     * - Updated recipe from findById() — full object
     * - null if recipe not found or already soft-deleted
     */
    static async update(id, data) {
        try {

            // ====================================================
            // VALIDATION (only for fields that were provided)
            // ====================================================

            if (data.cost_per_portion !== undefined) {
                const cost = parseFloat(data.cost_per_portion);
                // cost < 0 → invalid. cost === 0 → allowed (free recipe)
                // Message matches exactly what the test expects
                if (isNaN(cost) || cost < 0) {
                    throw new Error('Cost per portion must be >= 0');
                }
            }

            if (data.prep_time !== undefined) {
                const prepTime = parseInt(data.prep_time, 10);
                if (isNaN(prepTime) || prepTime < 0) {
                    throw new Error('Prep time must be non-negative number');
                }
            }

            // ====================================================
            // BUILD DYNAMIC UPDATE QUERY
            // ====================================================
            // We collect field assignments in fieldsToUpdate[]
            // and their values in params[]
            // Both arrays grow in sync — order matters for ? binding

            let query = 'UPDATE recipes SET ';
            const params = [];
            const fieldsToUpdate = [];

            // Only add a field to the SET clause if it was explicitly provided
            // undefined check (not null check) — null is a valid value for some fields

            if (data.title !== undefined) {
                fieldsToUpdate.push('title = ?');
                params.push(data.title.trim());           // trim to prevent leading/trailing spaces in DB
            }

            if (data.anecdote !== undefined) {
                fieldsToUpdate.push('anecdote = ?');
                params.push(data.anecdote.trim());
            }

            if (data.ingredients !== undefined) {
                fieldsToUpdate.push('ingredients = ?');
                params.push(JSON.stringify(data.ingredients));  // serialize array to JSON string
            }

            if (data.steps !== undefined) {
                fieldsToUpdate.push('steps = ?');
                params.push(JSON.stringify(data.steps));        // serialize array to JSON string
            }

            if (data.prep_time !== undefined) {
                fieldsToUpdate.push('prep_time = ?');
                params.push(parseInt(data.prep_time, 10));
            }

            if (data.cost_per_portion !== undefined) {
                fieldsToUpdate.push('cost_per_portion = ?');
                params.push(parseFloat(data.cost_per_portion));
            }

            if (data.status !== undefined) {
                fieldsToUpdate.push('status = ?');
                params.push(data.status);
            }

            // If caller passed an empty object, nothing to update
            // Return current state instead of running a no-op UPDATE
            if (fieldsToUpdate.length === 0) {
                return this.findById(id);
            }

            // Always refresh updated_at when any field changes
            // This is appended last (after all data fields)
            fieldsToUpdate.push('updated_at = NOW()');

            // Join all field assignments: "title = ?, cost_per_portion = ?, updated_at = NOW()"
            query += fieldsToUpdate.join(', ');

            // WHERE clause: only update THIS recipe, and only if not soft-deleted
            // id is appended last to params — matches the final ? in the query
            query += ' WHERE id = ? AND deleted_at IS NULL';
            params.push(id);

            // ====================================================
            // EXECUTE UPDATE
            // ====================================================

            const [result] = await pool.query(query, params);

            // affectedRows === 0 → recipe not found OR already soft-deleted
            if (result.affectedRows === 0) {
                return null;
            }

            // Return the updated recipe via findById() for consistent shape
            return this.findById(id);

        } catch (error) {
            logger.error(`Recipe.update(${id}) failed: ${error.message}`);
            throw error;
        }
    }

    // ============================================================
    //  UPDATE RATING (denormalized average)
    // ============================================================

    /**
     * updateRating(id, newScore)
     *
     * Purpose:
     * --------
     * Recalculates the denormalized average_rating and increments rating_count
     * after a new rating is inserted. The calculation happens atomically in SQL
     * to prevent race conditions between simultaneous ratings.
     *
     * Formula:
     *   new_average = ROUND((old_average * old_count + newScore) / (old_count + 1), 2)
     *
     * Called by Rating.rate() after a successful INSERT.
     * Only called on first rating (INSERT), not on update.
     */
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
        );
        return result.affectedRows > 0;
    }

    // ============================================================
    //  FIND RANDOM
    // ============================================================

    /**
     * findRandom()
     *
     * Returns a single random published recipe (not soft-deleted).
     * Uses RAND() ordering — MariaDB picks a random row.
     * LIMIT 1 ensures we only get one.
     */
    static async findRandom() {
        try {
            const query = `
                SELECT
                    r.*,
                    u.username  AS user_pseudo,
                    u.email     AS user_email,
                    c.name      AS category_name
                FROM recipes r
                LEFT JOIN users      u ON r.user_id      = u.id
                LEFT JOIN categories c ON r.category_id  = c.id
                WHERE r.status = 'published' AND r.deleted_at IS NULL
                ORDER BY RAND()
                LIMIT 1
            `;

            const [rows] = await pool.query(query);

            if (rows.length === 0) {
                return null;
            }

            const row = rows[0];

            let ingredients = [];
            let steps = [];
            try {
                ingredients = row.ingredients ? JSON.parse(row.ingredients) : [];
                steps = row.steps ? JSON.parse(row.steps) : [];
            } catch (parseError) {
                logger.warn(`Failed to parse JSON fields for random recipe: ${parseError.message}`);
            }

            return {
                id: row.id,
                user_id: row.user_id,
                category_id: row.category_id,
                title: row.title,
                anecdote: row.anecdote,
                ingredients,
                steps,
                prep_time: row.prep_time,
                cost_per_portion: parseFloat(row.cost_per_portion),
                status: row.status,
                average_rating: parseFloat(row.average_rating),
                rating_count: row.rating_count,
                image_url: row.image_url,
                created_at: row.created_at,
                updated_at: row.updated_at,
                username: row.user_pseudo,
                user: {
                    username: row.user_pseudo,
                    email: row.user_email,
                },
                category: {
                    name: row.category_name,
                },
            };

        } catch (error) {
            logger.error(`Recipe.findRandom() failed: ${error.message}`);
            throw error;
        }
    }

    // ============================================================
    //  SOFT DELETE
    // ============================================================

    /**
     * softDelete(id)
     *
     * Purpose:
     * --------
     * Marks a recipe as deleted by setting deleted_at timestamp.
     * Does NOT remove the row from the database.
     *
     * Why soft delete?
     * - Preserves data for audit trails
     * - Allows admin recovery if needed
     * - Maintains referential integrity (comments/ratings still reference this recipe)
     * - Consistent with the deleted_at pattern used on all main tables
     *
     * After soft delete:
     * - findById()          → returns null (WHERE deleted_at IS NULL filters it out)
     * - findAllWithFilters() → recipe excluded from all results
     * - DB row              → still exists, deleted_at is set to current timestamp
     *
     * Parameters:
     * - id: number — recipe primary key
     *
     * Returns:
     * - true  if the row was updated (recipe existed and was not already deleted)
     * - false if recipe not found or already soft-deleted (affectedRows === 0)
     *
     * Throws: database errors
     */
    static async softDelete(id) {
        try {

            // Set deleted_at and updated_at simultaneously
            // WHERE deleted_at IS NULL: prevents double-deleting (idempotency)
            const query = `
                UPDATE recipes
                SET    deleted_at = NOW(),
                       updated_at = NOW()
                WHERE  id = ? AND deleted_at IS NULL
            `;

            // Parameterized: id injected safely
            const [result] = await pool.query(query, [id]);

            // affectedRows > 0 → the row was found and updated
            // affectedRows === 0 → recipe didn't exist or was already deleted
            return result.affectedRows > 0;

        } catch (error) {
            logger.error(`Recipe.softDelete(${id}) failed: ${error.message}`);
            throw error;
        }
    }
}

// Export the class — consumed by RecipeController and test files
module.exports = Recipe;