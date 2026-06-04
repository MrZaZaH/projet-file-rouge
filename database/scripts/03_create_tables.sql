-- 03_create_tables.sql
-- Full DDL for the recettes_humaines database.
-- Run as dev_admin user after 01 and 02 scripts.
-- Naming conventions: snake_case, explicit foreign keys, audit fields on all tables.
-- Soft delete: deleted_at IS NULL = active record.

USE recettes_humaines;

-- ============================================================
-- TABLE: categories
-- Stores recipe categories (e.g. "Pâtes", "Soupe", "Dessert").
-- Independent table, no foreign keys.
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    -- slug: URL-friendly version of name (e.g. "plats-rapides").
    -- UNIQUE ensures no two categories share the same URL.
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at      DATETIME NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLE: users
-- Stores registered user accounts.
-- password_hash: bcrypt output, never plain text.
-- role: 'user' | 'admin' — checked by requireAdmin middleware.
-- points: kept for future gamification (not active in MVP).
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username        VARCHAR(50) NOT NULL UNIQUE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    -- bcrypt output is always 60 chars, but 255 gives room if algo changes.
    role            ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    points          INT UNSIGNED NOT NULL DEFAULT 0,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at      DATETIME NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLE: recipes
-- Core table of the project.
-- anecdote: mandatory — it's the soul of the concept.
-- status: controls visibility pipeline.
-- average_rating: denormalized for performance (avoids AVG() on every load).
-- cost_per_portion and prep_time: used for budget/speed filters.
-- ============================================================
CREATE TABLE IF NOT EXISTS recipes (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id             INT UNSIGNED NOT NULL,
    category_id         INT UNSIGNED NOT NULL,
    title               VARCHAR(255) NOT NULL,
    anecdote            TEXT NOT NULL,
    -- TEXT instead of VARCHAR: anecdotes can be long, no arbitrary 255 limit.
    ingredients         JSON NOT NULL,
    -- JSON column: stores array of {name, quantity, unit}.
    -- Flexible structure without needing a separate ingredients table for MVP.
    steps               JSON NOT NULL,
    -- JSON column: stores ordered array of step strings.
    prep_time           SMALLINT UNSIGNED NOT NULL,
    -- prep_time in minutes. SMALLINT = max 65535 min, sufficient.
    cost_per_portion    DECIMAL(5,2) UNSIGNED NOT NULL,
    -- DECIMAL for monetary values, never FLOAT (floating point rounding errors).
    -- 5 digits total, 2 after decimal: max value = 999.99€
    status              ENUM('pending', 'published', 'rejected') NOT NULL DEFAULT 'pending',
    average_rating      DECIMAL(3,2) UNSIGNED NOT NULL DEFAULT 0.00,
    -- Denormalized: updated each time a rating is inserted/updated.
    -- Avoids expensive AVG() join on every recipe list load.
    rating_count        SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    -- Needed to recalculate average_rating correctly on each new rating.
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at          DATETIME NULL DEFAULT NULL,

    CONSTRAINT fk_recipes_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    -- RESTRICT: cannot delete a user who has recipes. Intentional.
    -- Force admin to handle recipes first — no accidental orphans.

    CONSTRAINT fk_recipes_category
        FOREIGN KEY (category_id) REFERENCES categories(id)
        ON DELETE RESTRICT ON UPDATE CASCADE

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLE: comments
-- US-13: comments without an account (guest_name used instead).
-- user_id is nullable: NULL = guest comment, value = logged-in user.
-- ============================================================
CREATE TABLE IF NOT EXISTS comments (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    recipe_id       INT UNSIGNED NOT NULL,
    user_id         INT UNSIGNED NULL DEFAULT NULL,
    -- NULL = guest comment (no account required per US-13)
    guest_name      VARCHAR(100) NULL DEFAULT NULL,
    -- Required when user_id IS NULL. Enforced at application level.
    content         TEXT NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at      DATETIME NULL DEFAULT NULL,

    CONSTRAINT fk_comments_recipe
        FOREIGN KEY (recipe_id) REFERENCES recipes(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,

    CONSTRAINT fk_comments_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
    -- SET NULL: if a user is soft-deleted, their comments remain visible
    -- but lose the user_id link. guest_name can serve as display fallback.

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLE: ratings
-- One rating per user per recipe — enforced by UNIQUE constraint.
-- score: 1 to 5 only — enforced by CHECK constraint.
-- ============================================================
CREATE TABLE IF NOT EXISTS ratings (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    recipe_id       INT UNSIGNED NOT NULL,
    user_id         INT UNSIGNED NOT NULL,
    score           TINYINT UNSIGNED NOT NULL,
    -- TINYINT = 0-255, sufficient for a 1-5 scale.
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT chk_rating_score CHECK (score BETWEEN 1 AND 5),
    -- Database-level enforcement: application validation is not enough alone.

    CONSTRAINT uq_rating_user_recipe UNIQUE (user_id, recipe_id),
    -- One rating per user per recipe. Attempt to rate twice = SQL error.

    CONSTRAINT fk_ratings_recipe
        FOREIGN KEY (recipe_id) REFERENCES recipes(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,

    CONSTRAINT fk_ratings_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE RESTRICT ON UPDATE CASCADE

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLE: admin_logs
-- Audit trail for all admin actions (moderation, deletions).
-- action: free-text description of what was done.
-- target_type / target_id: polymorphic reference (recipe, user, comment).
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_logs (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    admin_id        INT UNSIGNED NOT NULL,
    target_type     VARCHAR(50) NOT NULL,
    -- e.g. 'recipe', 'comment', 'user'
    target_id       INT UNSIGNED NOT NULL,
    action          VARCHAR(255) NOT NULL,
    -- e.g. 'recipe_rejected', 'comment_deleted', 'user_banned'
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_admin_logs_admin
        FOREIGN KEY (admin_id) REFERENCES users(id)
        ON DELETE RESTRICT ON UPDATE CASCADE

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- INDEXES
-- Created separately for clarity.
-- Only on columns actually used in WHERE clauses or JOINs.
-- Over-indexing slows down INSERT/UPDATE — don't index everything.
-- ============================================================

-- recipes: most common filters per user stories
CREATE INDEX idx_recipes_status       ON recipes(status);
CREATE INDEX idx_recipes_prep_time    ON recipes(prep_time);
CREATE INDEX idx_recipes_cost         ON recipes(cost_per_portion);
CREATE INDEX idx_recipes_user_id      ON recipes(user_id);
CREATE INDEX idx_recipes_category_id  ON recipes(category_id);
CREATE INDEX idx_recipes_deleted_at   ON recipes(deleted_at);

-- comments: always fetched by recipe
CREATE INDEX idx_comments_recipe_id   ON comments(recipe_id);

-- ratings: fetched by recipe for average calculation
CREATE INDEX idx_ratings_recipe_id    ON ratings(recipe_id);

-- users: login lookup
CREATE INDEX idx_users_email          ON users(email);
