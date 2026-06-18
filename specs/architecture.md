# Projet File Rouge — Community Recipe Platform

A community-driven recipe platform focused on authentic, everyday cooking.
No chef recipes, no perfect photos — just real dishes from real people,
with the story behind each one.

---

## Tech Stack

**Backend**
- Node.js (LTS)
- Express 5
- MariaDB + mysql2/promise
- JWT (jsonwebtoken) + bcryptjs
- helmet, cors, express-rate-limit
- express-validator
- winston (logging)
- jest + supertest (testing)

**Frontend**
- HTML5 (semantic)
- CSS3 vanilla (mobile-first, Flexbox, Grid)
- JavaScript vanilla — no frameworks, no external libraries

**Tools**
- Git/GitHub
- DBeaver

---

## Architecture Overview

**Pattern**: MVC-like organisation
- `models/` — Data access layer. SQL queries with named placeholders exclusively (zero concatenation).
- `controllers/` — Request handlers. HTTP logic, validation orchestration, response formatting.
- `routes/` — URL-to-controller mapping, input validation rules (express-validator) defined inline.
- `middlewares/` — Cross-cutting concerns: authentication, authorization, security headers, rate limiting, logging, error handling.

**API conventions**
- Prefix: `/api/v1/`
- Standardised JSON response contract via `src/utils/apiResponse.js`:
  - Success: `{ success: true, data, message? }`
  - Error: `{ success: false, error: { message, code } }`

**Authentication flow**
- JWT-based, Bearer token in `Authorization` header
- Token expiry: configurable via `JWT_EXPIRES_IN` env var
- Two middleware levels:
  - `authenticate` — requires valid token, returns 401 if missing/invalid
  - `attachUser` — optional: sets `req.user` if valid token present, does not block guests (used for guest comments)
- Rate limiting: 100 requests/15min (global), 10 requests/15min (auth routes)

**Database security**
- Three MariaDB users with least privilege:
  - `dev_app` — SELECT, INSERT, UPDATE, DELETE (runtime)
  - `dev_admin` — ALL privileges (migrations, schema changes)
  - `dev_readonly` — SELECT only (read-only access)
- All queries use named placeholders (parameterised) — no string concatenation
- Soft delete: `deleted_at IS NULL` filtering on categories, users, recipes, comments
- `average_rating` denormalised on recipes table (updated on each rating)

---

## Project Structure

```
projet-file-rouge/
├── database/
│   └── scripts/
│       ├── 01_create_database.sql   # DB creation (recettes_humaines + test)
│       ├── 02_create_users.sql      # 3 MariaDB users with least privilege
│       ├── 03_create_tables.sql     # DDL: categories, users, recipes, comments, ratings, admin_logs
│       ├── 04_seed_data.sql         # Seed: 3 categories, 5 users, 8 recipes, 30 comments, 28 ratings
│       ├── 05_add_image_url.sql     # Migration: add image_url column to recipes
│       └── 06_indexes.sql          # Performance indexes, views counter column
├── docs/                           # Documentation (briefs, specs, planning, quality, memos, syntheses)
├── logs/                           # Winston log files (error.log, combined.log), auto-rotated
├── src/
│   ├── config/
│   │   └── database.js             # DB connection config from env vars, validates required fields
│   ├── constants/
│   │   └── filters.js              # Filter thresholds (prep time, budget) & sort strategies
│   ├── controllers/
│   │   ├── AuthController.js       # register, login, getMe
│   │   ├── RecipeController.js     # CRUD, filtered listing, random recipe, view counter
│   │   ├── CommentController.js    # List, create (guest or auth), delete (author/admin)
│   │   ├── RatingController.js     # Create/update rating (auth only, self-rating blocked)
│   │   └── AdminController.js      # Dashboard, moderation, stats, logs, CSV export
│   ├── database/
│   │   └── connection.js           # mysql2/promise pool, testConnection() on startup
│   ├── middlewares/
│   │   ├── security.js             # helmet headers, CORS whitelist, rate limiters (global + auth)
│   │   ├── jwtAuth.js              # authenticate (JWT verify), requireAdmin (role guard)
│   │   ├── requireAdmin.js         # Standalone admin check (403 if not admin)
│   │   ├── logger.js               # Winston (file rotation + console), HTTP request logger
│   │   └── errorHandler.js         # 4-param error middleware, standardised JSON errors
│   ├── models/
│   │   ├── User.js                 # CRUD, findByEmail, addPoints, softDelete, findAll (admin)
│   │   ├── Recipe.js               # CRUD, findAllWithFilters (dynamic WHERE + smart ORDER BY)
│   │   ├── Category.js             # CRUD, slug auto-generation, softDelete
│   │   ├── comment.js              # findByRecipeId (with author info), create, softDelete
│   │   └── Rating.js               # rate() with upsert, average recalculation, points system
│   ├── routes/
│   │   ├── authRoutes.js           # POST /register, POST /login, GET /me (protected)
│   │   ├── recipeRoutes.js         # GET /, /random, /:id — POST/PUT/DELETE (protected)
│   │   ├── commentRoutes.js        # GET /, POST / (guest|auth), DELETE /:id (protected)
│   │   ├── ratingRoutes.js         # POST / (protected, score 1-5)
│   │   └── adminRoutes.js          # All protected (authenticate + requireAdmin on every route)
│   └── utils/
│       └── apiResponse.js          # sendSuccess / sendError — enforces standard JSON contract
├── tests/
│   ├── setup.js                    # Loads .env.test globally
│   ├── helpers/
│   │   └── testDb.js              # Test utilities: clearDatabase, createFixtures, closeDatabase
│   ├── integration/
│   │   ├── auth.test.js           # Registration & login flows
│   │   ├── recipes.test.js        # Recipe CRUD + filter queries
│   │   └── comments.test.js       # Comment creation, listing, deletion
│   └── unit/
│       ├── userModel.test.js      # User model behavior
│       └── recipeModel.test.js    # Recipe model behavior
├── Admin/                         # Admin frontend (HTML/CSS/JS pages)
├── test-scripts/                  # Manual test scripts (for development)
├── app.js                         # Express app: middleware chain, route mounting, 404 handler
├── server.js                      # Entry point: DB connection check, graceful shutdown
├── jest.config.js                 # Jest config: node env, 10s timeout, 70% coverage threshold
├── .env.example                   # Environment variable template
└── package.json
```

---

## Author

trezaz — training project, 2025
