-- 02_create_users.sql
-- Creates three MariaDB users following the principle of least privilege.
-- IMPORTANT: Replace placeholder passwords before running.
-- Never commit real passwords to version control.
-- These credentials must be stored in the .env file only.

-- ------------------------------------------------------------
-- USER 1: dev_app
-- Role: Used exclusively by the Node.js application at runtime.
-- Permissions: SELECT, INSERT, UPDATE, DELETE only.
-- Cannot modify the database structure (no DROP, ALTER, CREATE).
-- This limits damage in case of SQL injection or app compromise.
-- ------------------------------------------------------------
CREATE USER IF NOT EXISTS 'dev_app'@'localhost' IDENTIFIED BY 'REPLACE_WITH_STRONG_PASSWORD';

GRANT SELECT, INSERT, UPDATE, DELETE
    ON recettes_humaines.*
    TO 'dev_app'@'localhost';

GRANT SELECT, INSERT, UPDATE, DELETE
    ON recettes_humaines_test.*
    TO 'dev_app'@'localhost';

-- ------------------------------------------------------------
-- USER 2: dev_admin
-- Role: Used for migrations, schema changes, seeding.
-- Permissions: Full access on both databases.
-- Should never be used by the running application.
-- ------------------------------------------------------------
CREATE USER IF NOT EXISTS 'dev_admin'@'localhost' IDENTIFIED BY 'REPLACE_WITH_STRONG_PASSWORD';

GRANT ALL PRIVILEGES
    ON recettes_humaines.*
    TO 'dev_admin'@'localhost';

GRANT ALL PRIVILEGES
    ON recettes_humaines_test.*
    TO 'dev_admin'@'localhost';

-- ------------------------------------------------------------
-- USER 3: dev_readonly
-- Role: Simulates an audit or reporting context.
-- Permissions: SELECT only. Cannot write anything.
-- Useful for debugging and for future analytics/reporting needs.
-- ------------------------------------------------------------
CREATE USER IF NOT EXISTS 'dev_readonly'@'localhost' IDENTIFIED BY 'REPLACE_WITH_STRONG_PASSWORD';

GRANT SELECT
    ON recettes_humaines.*
    TO 'dev_readonly'@'localhost';

GRANT SELECT
    ON recettes_humaines_test.*
    TO 'dev_readonly'@'localhost';

-- Apply all privilege changes immediately
FLUSH PRIVILEGES;
