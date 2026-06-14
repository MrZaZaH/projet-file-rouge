-- Add image_url column to recipes table.
-- Nullable: existing recipes and new submissions without image are valid.
-- HTTPS enforced at application level (express-validator).

ALTER TABLE recipes
ADD COLUMN image_url VARCHAR(500) NULL DEFAULT NULL
AFTER cost_per_portion;

-- Apply same change to test database
ALTER TABLE recettes_humaines_test.recipes
ADD COLUMN image_url VARCHAR(500) NULL DEFAULT NULL
AFTER cost_per_portion;
