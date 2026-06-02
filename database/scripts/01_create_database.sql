-- Creates the main application database and the test database.
-- The test database is used exclusively for automated tests and manual QA.
-- Both databases use UTF-8 encoding to support special characters (French accents, emojis).

CREATE DATABASE IF NOT EXISTS recettes_humaines
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS recettes_humaines_test
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;
