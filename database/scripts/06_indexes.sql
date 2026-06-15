-- 05_indexes.sql
-- Performance indexes for Ovni Culinaire
-- 
-- Purpose:
-- Optimize queries used by filters, admin stats, and homepage.
-- Each index is justified by a specific query pattern.
--
-- Convention:
-- idx_{table}_{column(s)}
--
-- Run on both recettes_humaines and recettes_humaines_test
-- =============================================================

USE recettes_humaines;

-- -------------------------------------------------------------
-- TABLE: recipes
-- -------------------------------------------------------------

-- Filter by status (admin moderation list, findAllWithFilters)
-- Query: WHERE status = 'published' AND deleted_at IS NULL
-- Composite: status + deleted_at covers both conditions in one scan
CREATE INDEX IF NOT EXISTS idx_recipes_status_deleted
    ON recipes (status, deleted_at);

-- Filter by category (US-07 category filter)
-- Query: WHERE category_id = ? AND deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_recipes_category_deleted
    ON recipes (category_id, deleted_at);

-- Filter by prep_time (US-01 "ready in 15 min")
-- Query: WHERE prep_time <= 15 AND deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_recipes_prep_time
    ON recipes (prep_time);

-- Filter by cost (US-03 budget filter)
-- Query: WHERE cost_per_portion <= ? AND deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_recipes_cost
    ON recipes (cost_per_portion);

-- Sort by rating (admin top recipes, homepage)
-- Query: ORDER BY average_rating DESC
CREATE INDEX IF NOT EXISTS idx_recipes_rating
    ON recipes (average_rating DESC);

-- Homepage: top recipes of the month (ORDER BY created_at DESC)
CREATE INDEX IF NOT EXISTS idx_recipes_created_at
    ON recipes (created_at DESC);

-- -------------------------------------------------------------
-- TABLE: comments
-- -------------------------------------------------------------

-- Fetch comments for a recipe page
-- Query: WHERE recipe_id = ? AND deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_comments_recipe_deleted
    ON comments (recipe_id, deleted_at);

-- -------------------------------------------------------------
-- TABLE: ratings
-- -------------------------------------------------------------

-- Check if user already rated a recipe (unique constraint helper)
-- Query: WHERE recipe_id = ? AND user_id = ?
CREATE INDEX IF NOT EXISTS idx_ratings_recipe_user
    ON ratings (recipe_id, user_id);

-- -------------------------------------------------------------
-- TABLE: user_notifications
-- -------------------------------------------------------------

-- Fetch unread notifications for a user
-- Query: WHERE user_id = ? AND read_at IS NULL
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
    ON user_notifications (user_id, read_at);

-- -------------------------------------------------------------
-- TABLE: admin_logs
-- -------------------------------------------------------------

-- Fetch logs filtered by action type
-- Query: WHERE action = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_admin_logs_action
    ON admin_logs (action);

-- =============================================================
-- Replicate on test database
-- =============================================================

USE recettes_humaines_test;

CREATE INDEX IF NOT EXISTS idx_recipes_status_deleted
    ON recipes (status, deleted_at);

CREATE INDEX IF NOT EXISTS idx_recipes_category_deleted
    ON recipes (category_id, deleted_at);

CREATE INDEX IF NOT EXISTS idx_recipes_prep_time
    ON recipes (prep_time);

CREATE INDEX IF NOT EXISTS idx_recipes_cost
    ON recipes (cost_per_portion);

CREATE INDEX IF NOT EXISTS idx_recipes_rating
    ON recipes (average_rating DESC);

CREATE INDEX IF NOT EXISTS idx_recipes_created_at
    ON recipes (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comments_recipe_deleted
    ON comments (recipe_id, deleted_at);

CREATE INDEX IF NOT EXISTS idx_ratings_recipe_user
    ON ratings (recipe_id, user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read
    ON user_notifications (user_id, read_at);

CREATE INDEX IF NOT EXISTS idx_admin_logs_action
    ON admin_logs (action);
