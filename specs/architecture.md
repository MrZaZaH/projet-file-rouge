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
├── Admin/                             # Admin frontend pages (HTML/CSS/JS)
│   ├── export/
│   │   └── recipesCSV.js              # CSV export utility
│   ├── recipes/
│   │   └── top.js                     # Top recipes admin page
│   └── stats.js                       # Admin dashboard stats
├── database/
│   └── scripts/
│       ├── 01_create_database.sql     # DB creation (recettes_humaines + test)
│       ├── 02_create_users.sql        # 3 MariaDB users with least privilege
│       ├── 03_create_tables.sql       # DDL: categories, users, recipes, comments, ratings, admin_logs
│       ├── 04_seed_data.sql           # Seed: 3 categories, 5 users, 8 recipes, 30 comments, 28 ratings
│       ├── 05_add_image_url.sql       # Migration: add image_url column to recipes
│       └── 06_indexes.sql            # Performance indexes, views counter column
├── docs/                              # Documentation
│   ├── accessibility.md
│   ├── mvp-decisions.md
│   ├── memos/
│   │   ├── memo-pour-concept-flou.md
│   │   └── memo-session.md
│   ├── prompts/
│   │   ├── commande-memo-revision-session.md
│   │   ├── commande-synthese.md
│   │   ├── prompt-instruction-ia.md
│   │   ├── prompt-instruction-ia-2.md
│   │   └── prompt-instruction-ia-3-reformuler.md
│   ├── qualite/
│   │   ├── bonnes-pratiques.md
│   │   └── test-cases.md
│   ├── recettes/
│   │   ├── recettes.md
│   │   └── selection-des-8-recettes-tests.md
│   └── syntheses/                     # Session syntheses (jour 2 — 23)
├── frontend/                          # Frontend app (vanilla HTML/CSS/JS)
│   ├── docs/
│   │   ├── architecture-frontend.md
│   │   └── frontend-report.md
│   └── public/
│       ├── assets/
│       ├── css/
│       │   ├── styles.css
│       │   └── variables.css
│       ├── js/
│       │   └── app.js
│       ├── demo.html
│       ├── index.html
│       ├── recipe.html
│       ├── styleguide.html
│       └── submit.html
├── logs/                              # Winston log files (gitignored, auto-rotated)
│   ├── combined.log
│   └── error.log
├── specs/
│   ├── architecture.md
│   ├── gestion-projet/
│   │   ├── persona-user-stories.md
│   │   └── planning-travail-detaille.md
│   └── technique/
│       ├── api.md
│       ├── backend-report.md
│       ├── brief.md
│       ├── database-design.md
│       └── structure.md
├── src/
│   ├── config/
│   │   └── database.js                # DB connection config from env vars, validates required fields
│   ├── constants/
│   │   └── filters.js                 # Filter thresholds (prep time, budget) & sort strategies
│   ├── controllers/
│   │   ├── AdminController.js         # Dashboard, moderation, stats, logs, CSV export
│   │   ├── AuthController.js          # register, login, getMe
│   │   ├── CommentController.js       # List, create (guest or auth), delete (author/admin)
│   │   ├── RatingController.js        # Create/update rating (auth only, self-rating blocked)
│   │   ├── RecipeController.js        # CRUD, filtered listing, random recipe, view counter
│   │   ├── AdminController1.js        # Legacy / backup
│   │   ├── AuthController1.js         # Legacy / backup
│   │   ├── CommentController1.js      # Legacy / backup
│   │   ├── RatingController1.js       # Legacy / backup
│   │   └── RecipeController1.js       # Legacy / backup
│   ├── database/
│   │   └── connection.js              # mysql2/promise pool, testConnection() on startup
│   ├── middlewares/
│   │   ├── errorHandler.js            # 4-param error middleware, standardised JSON errors
│   │   ├── jwtAuth.js                 # authenticate (JWT verify), requireAdmin (role guard)
│   │   ├── logger.js                  # Winston (file rotation + console), HTTP request logger
│   │   ├── requireAdmin.js            # Standalone admin check (403 if not admin)
│   │   ├── security.js                # helmet headers, CORS whitelist, rate limiters (global + auth)
│   │   ├── errorHandler1.js           # Legacy / backup
│   │   └── jwtAuth2.js                # Legacy / backup
│   ├── models/
│   │   ├── Category.js                # CRUD, slug auto-generation, softDelete
│   │   ├── comment.js                 # findByRecipeId (with author info), create, softDelete
│   │   ├── Rating.js                  # rate() with upsert, average recalculation, points system
│   │   ├── Recipe.js                  # CRUD, findAllWithFilters (dynamic WHERE + smart ORDER BY)
│   │   ├── User.js                    # CRUD, findByEmail, addPoints, softDelete, findAll (admin)
│   │   ├── comment1.js                # Legacy / backup
│   │   └── Recipe1.js                 # Legacy / backup
│   ├── routes/
│   │   ├── adminRoutes.js             # All protected (authenticate + requireAdmin on every route)
│   │   ├── authRoutes.js              # POST /register, POST /login, GET /me (protected)
│   │   ├── commentRoutes.js           # GET /, POST / (guest|auth), DELETE /:id (protected)
│   │   ├── ratingRoutes.js            # POST / (protected, score 1-5)
│   │   └── recipeRoutes.js            # GET /, /random, /:id — POST/PUT/DELETE (protected)
│   └── utils/
│       └── apiResponse.js             # sendSuccess / sendError — enforces standard JSON contract
├── tests/
│   ├── setup.js                       # Loads .env.test globally
│   ├── helpers/
│   │   └── testDb.js                  # Test utilities: clearDatabase, createFixtures, closeDatabase
│   ├── integration/
│   │   ├── admin.test.js              # Admin dashboard, moderation, stats
│   │   ├── auth.test.js               # Registration & login flows
│   │   ├── comments.test.js           # Comment creation, listing, deletion
│   │   └── ratings.test.js            # Rating creation, update, self-rating block
│   └── unit/
│       ├── categoryModel.test.js      # Category model behavior
│       ├── ratingModel.test.js        # Rating model behavior
│       ├── recipeModel.test.js        # Recipe model behavior
│       └── userModel.test.js          # User model behavior
├── .env                               # Local environment variables (gitignored)
├── .env.example                       # Environment variable template
├── .env.test                          # Test environment variables (gitignored)
├── .env.test.example                  # Test env variable template
├── .gitignore
├── AGENTS.md                          # AI assistant instructions
├── app.js                             # Express app: middleware chain, route mounting, 404 handler
├── jest.config.js                     # Jest config: node env, 10s timeout, 70% coverage threshold
├── package.json
├── package-lock.json
├── README.md
└── server.js                          # Entry point: DB connection check, graceful shutdown
```

---

## Author

trezaz — training project, 2026
