# Backend Technical Report - Ovni Culinaire

## Executive Summary

This report documents the backend development for the Ovni Culinaire project, a culinary recipe sharing platform with gamification features. The backend was developed over 12 days using Node.js, Express.js, MariaDB, and various security and testing libraries.

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
├── controllers/      # Business logic (Auth, Recipe, Comment, Rating)
├── database/         # Database connection and queries
├── middlewares/      # Security (JWT auth, error handling, logging)
├── models/           # Data models (User, Recipe, Comment, Rating, Category)
├── routes/           # API route definitions
├── utils/            # Utility functions (API responses)
├── tests/            # Jest test suites
└── app.js            # Main application entry point
```

### 1.3 Database Schema

The database consists of 5 main tables:
- **users**: User accounts with username, email, password hash, points, badges
- **recipes**: Recipe data with title, ingredients, steps, story, category, cost
- **comments**: User comments linked to recipes (no account required for posting)
- **ratings**: 1-5 star ratings for recipes
- **categories**: Recipe categories (Rapide, Petit budget, Élaborée, etc.)

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

### 2.5 Logging

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
│   ├── auth.test.js       # Authentication tests
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
| Comment Controller | 10+ | Passing |
| Rating Controller | 10+ | Passing |
| Model Validation | 15+ | Passing |

### 4.4 Key Test Scenarios

- User registration and login
- JWT token validation
- Recipe CRUD operations
- Comment creation and retrieval
- Rating submission and calculation
- Admin-only routes protection
- Input validation enforcement
- Error handling verification

---

## 5. User Stories Implementation

### 5.1 US-01 to US-06: Core Features

| US | Feature | Implementation |
|----|---------|----------------|
| US-01 | Quick recipe access | `/api/recipes/featured` endpoint, prep time displayed |
| US-02 | Recipe stories | Story/anecdote field in Recipe model |
| US-03 | Budget filtering | `cost` field with filter query params |
| US-04 | Minimal ingredients | Ingredient count displayed, filter available |
| US-05 | Community trust | Comments visible, author pseudo displayed |
| US-06 | Frictionless navigation | Clean API, no blocking elements |

### 5.2 US-07 to US-10: Navigation & Contribution

| US | Feature | Implementation |
|----|---------|----------------|
| US-07 | Filter discovery | Query params: time, budget, ingredients, category |
| US-08 | Homepage orientation | `/api/recipes/featured` with top recipes |
| US-09 | Simplified signup | POST `/api/auth/register` - immediate activation |
| US-10 | Recipe submission | POST `/api/recipes` with JWT auth |

### 5.3 US-11 to US-15: Gamification & Admin

| US | Feature | Implementation |
|----|---------|----------------|
| US-11 | Points system | Points field in User model, earned on recipe publish |
| US-12 | Contributor rewards | Badge system in User model |
| US-13 | Comments without account | Public POST `/api/comments` with pseudo required |
| US-14 | Recipe moderation | Admin endpoints for delete/hide recipes |
| US-15 | Admin dashboard | `/api/admin/stats` endpoint with analytics |

---

## 6. API Endpoints Summary

### 6.1 Authentication (Public)
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login, returns JWT

### 6.2 Recipes (Public/Protected)
- `GET /api/recipes` - List all recipes with filters
- `GET /api/recipes/:id` - Get single recipe
- `GET /api/recipes/featured` - Top recipes for homepage
- `POST /api/recipes` - Create recipe (JWT required)
- `PUT /api/recipes/:id` - Update recipe (JWT required)
- `DELETE /api/recipes/:id` - Delete recipe (JWT required)

### 6.3 Comments (Public/Protected)
- `GET /api/comments/:recipeId` - Get comments for recipe
- `POST /api/comments` - Add comment (no auth, pseudo required)

### 6.4 Ratings (Protected)
- `GET /api/ratings/:recipeId` - Get ratings for recipe
- `POST /api/ratings` - Add/update rating (JWT required)

### 6.5 Admin (JWT Required + Admin Role)
- `GET /api/admin/users` - List all users
- `GET /api/admin/recipes` - List all recipes
- `GET /api/admin/stats` - Dashboard statistics

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

The Ovni Culinaire backend is now fully functional and meets all user story requirements. The architecture provides a solid foundation for future enhancements including:

- Advanced gamification features
- Partner integration for rewards
- Enhanced search capabilities
- Image upload and storage

All critical security measures are in place, and the testing infrastructure supports ongoing development and maintenance.

---

*Report generated on Day 12 of the Ovni Culinaire project.*
*Project Status: MVP Complete ✅*