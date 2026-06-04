-- Creates the main application database and the test database.
-- The test database is used exclusively for automated tests (Jest + Supertest) to avoid polluting development data. and manual tests.
-- Both databases use UTF8mb4 (the real UTF-8) encoding to support special characters (French accents, emojis).

CREATE DATABASE IF NOT EXISTS recettes_humaines
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS recettes_humaines_test
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;
