# Backend Technical Report - Ovni Culinaire

## Executive Summary

This report documents the backend development for the Ovni Culinaire project, a culinary recipe sharing platform. The backend was built over 12 initial days using Node.js, Express.js, MariaDB, and various security and testing libraries, then extended with additional features through Day 28.

---

## 1. Architecture Overview

### 1.1 Technology Stack

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Runtime | Node.js | Latest LTS | Server execution |
| Framework | Express.js | ^4.18.x | REST API framework |
| Database | MariaDB | Latest | Relational data storage |
| Authentication | JWT (jsonwebtoken) | ^9.x | Stateless authentication |
| Security | Helmet | ^7.x | HTTP security headers |
| Logging | Winston | ^3.x | Application logging |
| Validation | express-validator | ^6.x | Input validation |
| Testing | Jest + Supertest | Latest | Unit & integration tests |

### 1.2 Architecture Pattern

The backend follows a **MVC (Model-View-Controller)** architecture with clear separation of concerns:

```
src/
├── config/           # Configuration files
├── controllers/      # Business logic (Auth, Recipe, Comment, Rating, User)
├── database/         # Database connection and queries
├── middlewares/      # Security (JWT auth, error handling, logging, rate limiting)
├── models/           # Data models (User, Recipe, Comment, Rating, Category)
├── routes/           # API route definitions (auth, recipe, comment, rating, user)
├── utils/            # Utility functions (API responses)
├── tests/            # Jest test suites
└── app.js            # Main application entry point
```

### 1.3 Database Schema

The database consists of 5 main tables:
- **users**: User accounts with username, email, password hash, role, created_at
- **recipes**: Recipe data with title, ingredients (JSON), steps (JSON), anecdote, prep_time, cost_per_portion, status, average_rating (denormalized), rating_count, user_id, category_id
- **comments**: User comments linked to recipes — supports dual mode: authenticated (user_id) or guest (guest_name)
- **ratings**: 1-5 star ratings for recipes — upsert via `INSERT ... ON DUPLICATE KEY UPDATE`
- **categories**: Recipe categories (Rapide, Petit budget, Élaborée, etc.)

All main tables (users, recipes, comments, categories) implement **soft delete** via a `deleted_at DATETIME NULL` column. Every public query filters with `WHERE deleted_at IS NULL`.

---

## 2. Security Measures

### 2.1 Authentication & Authorization

- **JWT (JSON Web Tokens)**: Stateless authentication for protected endpoints
- **Token expiration**: Tokens expire after 24 hours
- **Password hashing**: bcrypt with salt rounds for secure password storage
- **Role-based access**: Admin routes protected separately from user routes

### 2.2 Helmet Implementation

```javascript
const helmet = require('helmet');
app.use(helmet());
```

Helmet provides the following security headers:
- X-Content-Type-Options: nosniff
- X-Frame-Options: SAMEORIGIN
- X-XSS-Protection: 1; mode=block
- Strict-Transport-Security header
- Content-Security-Policy

### 2.3 Input Validation

All user inputs are validated using express-validator:
- Email format validation
- Password strength requirements (min 6 characters)
- String length limits
- SQL injection prevention via parameterized queries

### 2.4 Error Handling

- Custom error handler middleware
- Structured JSON error responses
- Non-technical error messages for client exposure
- Detailed logging for debugging (without exposing sensitive data)

### 2.5 Rate Limiting

Two tiers of rate limiting using `express-rate-limit`:
- **Global** : 100 requests per 15 minutes for all `/api/v1/` routes
- **Auth (stricter)** : 10 requests per 15 minutes on `/api/v1/auth/` login and register endpoints — brute force protection

### 2.6 Logging

Winston logger implementation with:
- **combined.log**: All logs (info, warn, error)
- **error.log**: Error-level logs only
- Timestamps and severity levels
- Separate log files for different environments

---

## 3. Challenges Encountered and Resolutions

### 3.1 Challenge: Database Connection Issues

**Problem**: Initial connection failures between Express and MariaDB due to configuration mismatches.

**Resolution**:
- Created proper database connection module in `src/database/connection.js`
- Implemented connection pooling for better performance
- Added proper error handling for connection failures

### 3.2 Challenge: JWT Token Management

**Problem**: Tokens were not being properly validated on protected routes.

**Resolution**:
- Created JWT authentication middleware in `src/middlewares/jwtAuth.js`
- Implemented token verification with secret key from environment variables
- Added proper error handling for expired/invalid tokens

### 3.3 Challenge: Comment System Without Authentication

**Problem**: US-13 requires comments without account but with pseudo mandatory.

**Resolution**:
- Created separate POST endpoint for comments (no JWT required)
- Added required pseudo field validation
- Comments are publicly readable but require pseudo for posting

### 3.4 Challenge: Image URL Handling

**Problem**: Recipe images were missing in initial seed data.

**Resolution**:
- Added `05_add_image_url.sql` migration script
- Populated image URLs using placeholder service for demo purposes

### 3.5 Challenge: Idempotency in Ratings

**Problem**: Users could submit multiple ratings for the same recipe.

**Resolution**:
- Implemented upsert logic (INSERT ... ON DUPLICATE KEY UPDATE)
- Users can update their rating by re-submitting
- Only one rating per user per recipe allowed

### 3.6 Challenge: NULL Handling in Aggregate Stats (User Dashboard)

**Problem**: When a user has 0 recipes, `SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END)` returns `NULL` instead of `0`. `Number(NULL)` in JavaScript evaluates to `0`, but if a property arrives as `undefined` from the destructured row, the frontend displays `NaN`.

**Resolution**:
- `COALESCE(SUM(...), 0)` in SQL to guarantee `0` at the database level
- `?? 0` fallback in the controller as a safety net for any `undefined` that slips through
- Defense in depth — SQL guarantees + JS fallback

### 3.7 Challenge: mysql2 Result Shape

**Problem**: `pool.execute()` returns `[rows, fields]` as an array, not `{ rows, fields }` as an object. Attempting `const { rows } = await pool.execute(...)` silently fails.

**Resolution**:
- Use `const [rows] = await pool.execute(...)` — array destructuring, position 0 is the row data

---

## 4. Testing Implementation

### 4.1 Test Strategy

We implemented a comprehensive testing strategy with three levels:

1. **Unit Tests**: Testing individual model methods
2. **Integration Tests**: Testing API endpoints with Supertest
3. **Test Coverage**: Goal of 80%+ coverage

### 4.2 Test Structure

```
tests/
├── helpers/
│   └── testDb.js          # Test database setup
├── integration/
│   ├── auth.test.js       # Authentication tests (includes user dashboard flows)
│   ├── comments.test.js   # Comment endpoint tests
│   └── recipes.test.js    # Recipe endpoint tests
└── unit/
    ├── recipeModel.test.js
    └── userModel.test.js
```

### 4.3 Test Results Summary

| Category | Tests | Status |
|----------|-------|--------|
| Auth Controller | 15+ | Passing |
| Recipe Controller | 20+ | Passing |
| Comment Controller | 10+ | Passing (2 known failures — pre-existing) |
| Rating Controller | 10+ | Passing |
| Model Validation | 15+ | Passing |
| User Dashboard | 4 | Passing (profile, recipes, auth, 401) |

### 4.4 Key Test Scenarios

- User registration and login
- JWT token validation
- Recipe CRUD operations
- Comment creation and retrieval
- Rating submission and calculation
- Admin-only routes protection
- Input validation enforcement
- Error handling verification
- **User dashboard** : profile with stats, my recipes listing, 401 without token

### 4.5 Known Test Failures

Two pre-existing failures in `comments.test.js` (not related to current features):
1. `should create comment with pseudo (no auth required)` — test expects property `pseudo` but model returns `guest_name`
2. `should reject empty pseudo` — test expects message `"Guest name is required"` but model now returns `"A name is required to comment as a guest"`

These failures pre-date the user dashboard feature and need a separate cleanup session.

---

## 5. User Stories Implementation

### 5.1 US-01 to US-06: Core Features

| US | Feature | Implementation |
|----|---------|----------------|
| US-01 | Quick recipe access | `/api/recipes/featured` endpoint, prep time displayed |
| US-02 | Recipe stories | Story/anecdote field in Recipe model |
| US-03 | Budget filtering | `cost` field with filter query params |
| US-04 | ~~Minimal ingredients~~ | ~~Supprimée~~ |
| US-05 | Community trust | Comments visible, author pseudo displayed |
| US-06 | Frictionless navigation | Clean API, no blocking elements |

### 5.2 US-07 to US-10: Navigation & Contribution

| US | Feature | Implementation |
|----|---------|----------------|
| US-07 | Filter discovery | Query params: time, budget, ingredients, category |
| US-08 | Homepage orientation | `/api/recipes/featured` with top recipes |
| US-09 | Simplified signup | POST `/api/auth/register` - immediate activation |
| US-10 | Recipe submission | POST `/api/recipes` with JWT auth |

### 5.3 US-DASHBOARD: User Dashboard (Post-MVP Feature)

| Feature | Implementation |
|---------|----------------|
| Profile view | `GET /api/v1/users/me/profile` — returns user info + aggregate recipe stats |
| Recipe history | `GET /api/v1/users/me/recipes` — returns all user recipes with statuses |
| Auth protection | Both endpoints require valid JWT; return 401 if missing/invalid |
| Stats aggregation | Single SQL query with `SUM(CASE WHEN ...)` per status + separate comment count query |

### 5.4 US-11 to US-15: Gamification & Admin (Pre-MVP, documented for reference)

| US | Feature | Implementation |
|----|---------|----------------|
| US-11 | Points system | Points field in User model, earned on recipe publish |
| US-12 | Contributor rewards | Badge system in User model |
| US-13 | Comments without account | Public POST `/api/comments` with pseudo required |
| US-14 | Recipe moderation | Admin endpoints for delete/hide recipes |
| US-15 | Admin dashboard | `/api/admin/stats` endpoint with analytics |

---

## 6. API Endpoints Summary

All endpoints are prefixed with `/api/v1/`.

### 6.1 Authentication (Public)
- `POST /api/v1/auth/register` — User registration
- `POST /api/v1/auth/login` — User login, returns JWT

### 6.2 Recipes (Public/Protected)
- `GET /api/v1/recipes` — List all recipes with filters
- `GET /api/v1/recipes/random` — Random recipe ("Surprends-moi" feature)
- `GET /api/v1/recipes/:id` — Get single recipe with comments
- `POST /api/v1/recipes` — Create recipe (JWT required)
- `PUT /api/v1/recipes/:id` — Update recipe (JWT required, author only)
- `DELETE /api/v1/recipes/:id` — Soft delete recipe (JWT required, author only)

### 6.3 Comments (Public/Protected)
- `GET /api/v1/recipes/:recipeId/comments` — Get comments for a recipe
- `POST /api/v1/recipes/:recipeId/comments` — Add comment (dual mode: JWT optional; pseudo required for guests)

### 6.4 Ratings (Protected)
- `GET /api/v1/recipes/:recipeId/ratings` — Get ratings for a recipe
- `POST /api/v1/recipes/:recipeId/ratings` — Add/update rating (JWT required, upsert)

### 6.5 User Dashboard (JWT Required)
- `GET /api/v1/users/me/profile` — User info + aggregate stats (total/published/pending/rejected recipes + comments received)
- `GET /api/v1/users/me/recipes` — All user recipes with statuses, ordered by most recent

### 6.6 Admin (JWT Required + Admin Role)
- `GET /api/v1/admin/users` — List all users
- `GET /api/v1/admin/recipes` — List all recipes
- `GET /api/v1/admin/stats` — Dashboard statistics

---

## 7. Key Technical Decisions

### 7.1 Why Express.js?
- Lightweight and flexible
- Large ecosystem of middleware
- Easy to scale and maintain
- Well-suited for REST APIs

### 7.2 Why MariaDB?
- Compatible with MySQL syntax
- Open source with good performance
- Strong support for relational data
- Easy integration with Node.js

### 7.3 Why JWT?
- Stateless authentication
- No server-side session storage needed
- Easily scalable
- Standard industry practice

### 7.4 Why Winston?
- Unified logging interface
- Multiple transport options
- Easy log rotation
- Production-ready

---

## 8. Conclusion

The Ovni Culinaire backend is fully functional and covers all core features: authentication, recipe CRUD, comments (auth + guest), ratings, admin moderation, and user dashboard. The architecture provides a solid foundation for future enhancements including:

- Advanced gamification features (badges, points, levels — V2/V3)
- Image upload and storage
- Enhanced search and filtering
- Pagination for large datasets

All critical security measures are in place (Helmet CSP, JWT, rate limiting, express-validator, parameterized queries), and the testing infrastructure supports ongoing development.

---

*Initial report: Day 12 of the Ovni Culinaire project.*
*Last updated: Day 29 — Admin moderation panel (moderation-panel.html, moderation-panel.js, auth.js admin link injection, admin-utils unit tests)*
*Project Status: All core features complete ✅ — Day 30: Final review*