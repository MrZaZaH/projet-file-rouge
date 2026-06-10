# TEST_CASES.md

## Manual Test Cases – Ovni Culinaire
**Database:** recettes_humaines  
**Seed script:** 04_seed_data.sql  
**Last updated:** 2025

---

## TC-01 – Filter by prep_time ≤ 15 minutes
**Goal:** Only recipes with prep_time <= 15 should appear (US-01)  
**Query:**
```sql
SELECT id, title, prep_time FROM recipes 
WHERE prep_time <= 15 AND status = 'published' AND deleted_at IS NULL;
```
Expected: ids 1, 2, 3, 4 (prep_time: 2, 5, 5, 5)
Not expected: ids 5 (25min), 6 (35min)Note: id 7 is pending, id 8 is rejected — must not appear regardless of prep_time

## TC-02 – Filter by cost_per_portion ≤ 3.00€
Goal: Budget filter for broke students (US-03)
Query:
```sql
SELECT id, title, cost_per_portion FROM recipes 
WHERE cost_per_portion <= 3.00 AND status = 'published' AND deleted_at IS NULL;
```
Expected: ids 1 (0.80€), 2 (1.50€), 5 (1.80€), 6 (2.60€)
Not expected: ids 3 (5.50€), 4 (4.20€)

## TC-03 – Only published recipes visible to public
Goal: pending and rejected recipes must not appear in public listing
Query:
```sql
SELECT id, title, status FROM recipes 
WHERE status = 'published' AND deleted_at IS NULL;
```
Expected: ids 1, 2, 3, 4, 5, 6 only
Not expected: id 7 (pending), id 8 (rejected)

## TC-04 – Soft delete check
Goal: Deleted recipes must never appear, regardless of statusSetup:
UPDATE recipes SET deleted_at = NOW() WHERE id = 1;
Query:
```sql
SELECT id, title FROM recipes WHERE deleted_at IS NULL AND status = 'published';
```
Expected: id 1 absent from resultsCleanup:
UPDATE recipes SET deleted_at = NULL WHERE id = 1;

## TC-05 – Average rating integrity
Goal: average_rating reflects actual ratings in the ratings table
Query:
```sql
SELECT 
    r.id,
    r.title,
    r.average_rating AS stored,
    ROUND(AVG(rt.score), 2) AS calculated,
    COUNT(rt.id) AS total_votes
FROM recipes r
LEFT JOIN ratings rt ON rt.recipe_id = r.id
GROUP BY r.id, r.title, r.average_rating;
```
Expected: stored = calculated for all rowsWhy it matters: average_rating is denormalized — if update logic is wrong, stored value drifts from reality

## TC-06 – One rating per user per recipe (UNIQUE constraint)
Goal: A user cannot rate the same recipe twiceSetup: user_id=1 already rated recipe_id=1 in seed data
Query:
```sql
INSERT INTO ratings (user_id, recipe_id, score) VALUES (1, 1, 5);
```
Expected: ERROR 1062 – Duplicate entry (UNIQUE constraint on user_id + recipe_id)Not expected: silent insert or overwrite

## TC-07 – Score constraint (1 to 5 only)
Goal: CHECK constraint rejects invalid scores
Query:
```sql
INSERT INTO ratings (user_id, recipe_id, score) VALUES (2, 3, 6);
```
Expected: ERROR 4025 – CONSTRAINT score failedAlso test: score = 0 → same error expected

## TC-08 – Comment without user account (US-13)
Goal: A comment can exist with a pseudo but no user_id
Query:
```sql
INSERT INTO comments (recipe_id, user_id, author_pseudo, content)
VALUES (2, NULL, 'PassantAnonyme', 'Super facile, je confirme.');
```
Expected: INSERT OK — user_id is nullable, author_pseudo is mandatoryThen verify:
```sql
SELECT id, recipe_id, user_id, author_pseudo, content 
FROM comments WHERE author_pseudo = 'PassantAnonyme';
```
## TC-09 – Admin log written on recipe moderation
Goal: Every admin action must be traceable (US-14)
Query:
```sql
INSERT INTO admin_logs (admin_user_id, action, target_type, target_id, details)
VALUES (3, 'recipe_rejected', 'recipe', 8, 'Does not match site spirit');

SELECT * FROM admin_logs WHERE target_id = 8;
```
Expected: Row present with correct admin_user_id, action, target_type, target_id

## TC-10 – Combined filter (speed + budget)
Goal: Intersection of prep_time ≤ 15 AND cost ≤ 3.00€ (US-01 + US-03)
Query:
```sql
SELECT id, title, prep_time, cost_per_portion FROM recipes
WHERE prep_time <= 15 
  AND cost_per_portion <= 3.00 
  AND status = 'published' 
  AND deleted_at IS NULL;
```
Expected: ids 1 (2min, 0.80€), 2 (5min, 1.50€)Not expected: id 3 (5min but 5.50€), id 4 (5min but 4.20€)

---
# TEST_Category, User, Recipe

## TC-11 — Category model: create()
**Method:** `Category.create()`  
**Input:** `{ name: 'Test Category <timestamp>' }`  
**Expected:** Returns object with `id`, `name`, `slug` generated from name  
**Result:** ✅ Passed  

## TC-12 — Category model: findAll()
**Method:** `Category.findAll()`  
**Expected:** Returns array, does not include soft-deleted rows  
**Result:** ✅ Passed  

## TC-13 — Category model: update()
**Method:** `Category.update(id, { name: 'Updated <timestamp>' })`  
**Expected:** Returns updated object with new slug  
**Result:** ✅ Passed  

## TC-14 — Category model: delete() (soft)
**Method:** `Category.delete(id)`  
**Expected:** Sets `deleted_at`, row no longer appears in `findAll()`  
**Result:** ✅ Passed  

## TC-15 — User model: create()
**Method:** `User.create()`  
**Input:** `{ username, email, password_hash }`  
**Expected:** Returns user object, password never exposed  
**Result:** ✅ Passed  

## TC-16 — User model: findByEmail()
**Method:** `User.findByEmail(email)`  
**Expected:** Returns correct user or `null` if not found  
**Result:** ✅ Passed  

## TC-17 — Recipe model: create()
**Method:** `Recipe.create(data)`  
**Expected:** Returns object with `id`, `status = pending`, ingredients/steps as arrays  
**Result:** ✅ Passed  

## TC-18 — Recipe model: findAllWithFilters() — no filters
**Method:** `Recipe.findAllWithFilters({})`  
**Expected:** Returns all non-deleted recipes  
**Result:** ✅ Passed  

## TC-19 — Recipe model: findAllWithFilters({ max_prep_time })
**Method:** `Recipe.findAllWithFilters({ max_prep_time: 10 })`  
**Expected:** Only returns recipes with prep_time ≤ 10  
**Result:** ✅ Passed  

## TC-20 — Recipe model: findAllWithFilters({ max_cost })
**Method:** `Recipe.findAllWithFilters({ max_cost: 1 })`  
**Expected:** Only returns recipes with cost_per_serving ≤ 1.00  
**Result:** ✅ Passed  

## TC-21 — Recipe model: findAllWithFilters({ search })
**Method:** `Recipe.findAllWithFilters({ search: 'Test Recipe' })`  
**Expected:** Returns recipes matching title or description  
**Result:** ✅ Passed  

## TC-22 — Recipe model: findAllWithFilters({ status })
**Method:** `Recipe.findAllWithFilters({ status: 'pending' })`  
**Expected:** Returns only pending recipes  
**Result:** ✅ Passed  

## TC-23 — Recipe model: update()
**Method:** `Recipe.update(id, { title: 'Updated <timestamp>' })`  
**Expected:** Returns updated recipe with new title  
**Result:** ✅ Passed  

## TC-24 — Recipe model: updateStatus()
**Method:** `Recipe.updateStatus(id, 'published')`  
**Expected:** Returns `true`, status changes in DB  
**Result:** ✅ Passed  

## TC-25 — Recipe model: updateRating()
**Method:** `Recipe.updateRating(id, 4)`  
**Expected:** `average_rating = 4.00`, `rating_count = 1`  
**Result:** ✅ Passed  

## TC-26 — Recipe model: findRandom()
**Method:** `Recipe.findRandom()`  
**Expected:** Returns one published recipe object  
**Result:** ✅ Passed  

## TC-27 — Recipe model: delete() (soft)
**Method:** `Recipe.delete(id)`  
**Expected:** Returns `true`, `findById()` returns `null` after deletion  
**Result:** ✅ Passed  
---
# TC — Comment & Rating models (Day 9)

## TC-28 — Comment.findByRecipeId()
**Method:** `Comment.findByRecipeId(recipeId)`  
**Expected:** Returns array with `content` and `created_at` fields  
**Result:** ✅ Passed

## TC-29 — Comment.create() — logged-in user
**Method:** `Comment.create({ recipe_id, user_id, content })`  
**Expected:** Returns created comment, `user_id` correct, `guest_name` null, `username` joined  
**Result:** ✅ Passed

## TC-30 — Comment.create() — guest
**Method:** `Comment.create({ recipe_id, author_pseudo, content })`  
**Expected:** `user_id` is null, `author_pseudo` present  
**Result:** ✅ Passed

## TC-31 — Comment.delete() soft delete
**Method:** `Comment.delete(id)`  
**Expected:** `deleted_at` set, comment no longer appears in `findByRecipeId()`  
**Result:** ✅ Passed

## TC-32 — Rating.rate() — new rating
**Method:** `Rating.rate({ user_id, recipe_id, score: 5 })`  
**Expected:** `isNew: true`, points awarded to author  
**Result:** ✅ Passed

## TC-33 — Rating.rate() — update existing rating
**Method:** `Rating.rate()` called twice on same user+recipe  
**Expected:** `isNew: false`, no duplicate points awarded  
**Result:** ✅ Passed

## TC-34 — Rating.rate() — score < 4 gives no points
**Method:** `Rating.rate({ score: 3 })`  
**Expected:** `pointsAwarded: 0`  
**Result:** ✅ Passed

## TC-35 — Rating.getByUserAndRecipe()
**Method:** `Rating.getByUserAndRecipe(userId, recipeId)`  
**Expected:** Returns existing rating or `null`  
**Result:** ✅ Passed

---
# TC — Full chain integration (Day 9)

## TC-36 — Full chain: recipe → comment → rating → points
**Script:** `test-scripts/test-full-chain.js`  
**Steps:**
1. `Recipe.create()` → status `pending`
2. `Recipe.updateStatus()` → `published`
3. `Comment.create()` → linked to recipe + user
4. `Rating.rate()` score 5 → `isNew: true`, author +5 points
5. `Recipe.findById()` → `average_rating = 5.00`, `rating_count = 1`

**Expected:** 12/12 passed, teardown restores seed state  
**Result:** ✅ Passed — idempotent (tested multiple runs)

---
# TC — Routes & Controllers (Day 10)

## TC-37 — GET /api/v1/recipes — populated database
**Method:** `GET /api/v1/recipes`
**Condition:** Database contains seeded recipes
**Expected:** `200` + non-empty JSON array
**Result:** ✅ Passed

## TC-38 — GET /api/v1/recipes — empty database
**Method:** `GET /api/v1/recipes`
**Condition:** No recipes in database
**Expected:** `200` + empty array `[]`
**Result:** ✅ Passed

## TC-39 — GET /api/v1/recipes/:id — existing ID
**Method:** `GET /api/v1/recipes/:id`
**Condition:** Valid existing recipe ID
**Expected:** `200` + full recipe object
**Result:** ✅ Passed

## TC-40 — GET /api/v1/recipes/:id — non-existing ID
**Method:** `GET /api/v1/recipes/:id`
**Condition:** ID does not exist in database
**Expected:** `404` + JSON error message
**Result:** ✅ Passed

## TC-41 — GET /api/v1/recipes/:id — non-numeric ID
**Method:** `GET /api/v1/recipes/:id`
**Condition:** ID = `abc`
**Expected:** `400`
**Result:** ✅ Passed

## TC-42 — POST /api/v1/recipes — no token, empty body
**Method:** `POST /api/v1/recipes`
**Condition:** No Authorization header, no body
**Expected:** `401`
**Result:** ✅ Passed

## TC-43 — POST /api/v1/recipes — valid token, empty body
**Method:** `POST /api/v1/recipes`
**Condition:** Valid JWT, body `{}`
**Expected:** `422` + validation errors list
**Result:** ✅ Passed

## TC-44 — POST /api/v1/recipes — valid token, valid body
**Method:** `POST /api/v1/recipes`
**Condition:** Valid JWT, all required fields provided
**Expected:** `201` + created recipe object
**Result:** ✅ Passed

## TC-45 — POST /api/v1/recipes — negative preparation_time
**Method:** `POST /api/v1/recipes`
**Condition:** Valid JWT, `preparation_time: -5`
**Expected:** `422`
**Result:** ✅ Passed

## TC-46 — POST /api/v1/recipes — zero cost_per_serving
**Method:** `POST /api/v1/recipes`
**Condition:** Valid JWT, `cost_per_serving: 0`
**Expected:** `422`
**Result:** ✅ Passed

## TC-47 — PUT /api/v1/recipes/:id — valid token, own recipe
**Method:** `PUT /api/v1/recipes/:id`
**Condition:** Valid JWT, user is the recipe author
**Expected:** `200` + updated recipe object
**Result:** ✅ Passed

## TC-48 — PUT /api/v1/recipes/:id — valid token, not the author
**Method:** `PUT /api/v1/recipes/:id`
**Condition:** Valid JWT, user is NOT the recipe author
**Expected:** `403`
**Result:** ✅ Passed

## TC-49 — DELETE /api/v1/recipes/:id — valid token, own recipe
**Method:** `DELETE /api/v1/recipes/:id`
**Condition:** Valid JWT, user is the recipe author
**Expected:** `200` + soft delete confirmed (`deleted_at` set)
**Result:** ✅ Passed

## TC-50 — DELETE /api/v1/recipes/:id — no token
**Method:** `DELETE /api/v1/recipes/:id`
**Condition:** No Authorization header
**Expected:** `401`
**Result:** ✅ Passed

---
# TC — Comments (Day 10)

## TC-51 — GET /api/v1/recipes/:id/comments — existing recipe
**Method:** `GET /api/v1/recipes/:id/comments`
**Condition:** Recipe exists and has comments
**Expected:** `200` + comments array
**Result:** ✅ Passed

## TC-52 — POST /api/v1/recipes/:id/comments — guest with pseudo
**Method:** `POST /api/v1/recipes/:id/comments`
**Condition:** No account, pseudo provided
**Expected:** `201` + created comment
**Result:** ✅ Passed

## TC-53 — POST /api/v1/recipes/:id/comments — no pseudo
**Method:** `POST /api/v1/recipes/:id/comments`
**Condition:** No pseudo field in body
**Expected:** `422`
**Result:** ✅ Passed

## TC-54 — POST /api/v1/recipes/:id/comments — empty pseudo
**Method:** `POST /api/v1/recipes/:id/comments`
**Condition:** `pseudo: ""`
**Expected:** `422`
**Result:** ✅ Passed

## TC-55 — DELETE /api/v1/recipes/:recipeId/comments/:id — no admin token
**Method:** `DELETE /api/v1/recipes/:recipeId/comments/:id`
**Condition:** Request made without admin role
**Expected:** `403`
**Result:** ✅ Passed

---
# TC — Ratings via API (Day 10)

## TC-56 — POST /api/v1/recipes/:recipeId/ratings — valid score
**Method:** `POST /api/v1/recipes/:recipeId/ratings`
**Condition:** Valid JWT, `score: 3`
**Expected:** `200` + recalculated average rating
**Result:** ✅ Passed

## TC-57 — POST /api/v1/recipes/:recipeId/ratings — score out of range
**Method:** `POST /api/v1/recipes/:recipeId/ratings`
**Condition:** Valid JWT, `score: 6`
**Expected:** `422`
**Result:** ✅ Passed

## TC-58 — POST /api/v1/recipes/:recipeId/ratings — score zero
**Method:** `POST /api/v1/recipes/:recipeId/ratings`
**Condition:** Valid JWT, `score: 0`
**Expected:** `422`
**Result:** ✅ Passed

## TC-59 — POST /api/v1/recipes/:recipeId/ratings — no token
**Method:** `POST /api/v1/recipes/:recipeId/ratings`
**Condition:** No Authorization header
**Expected:** `401`
**Result:** ✅ Passed

## TC-60 — POST /api/v1/recipes/:recipeId/ratings — duplicate vote
**Method:** `POST /api/v1/recipes/:recipeId/ratings`
**Condition:** Same user votes twice on same recipe
**Expected:** `200` + rating updated, no duplicate points awarded
**Result:** ✅ Passed

---
# TC — Error Handler (Day 10)

## TC-61 — Unknown route
**Method:** `GET /api/v1/nope`
**Condition:** Route does not exist
**Expected:** `404` + JSON `{ "error": "Not found" }`
**Result:** ✅ Passed

## TC-62 — Internal server error format
**Method:** Any route triggering a 500
**Condition:** Simulated server error
**Expected:** `500` + JSON error object, no stack trace exposed
**Result:** ✅ Passed

---
# TC — Authentication (Day 11)

## TC-63 — POST /api/v1/auth/register — valid body
**Method:** `POST /api/v1/auth/register`
**Condition:** All required fields provided, email not already used
**Expected:** `201` + JWT token
**Result:** ✅ Passed

## TC-64 — POST /api/v1/auth/register — duplicate email
**Method:** `POST /api/v1/auth/register`
**Condition:** Email already exists in database
**Expected:** `409`
**Result:** ✅ Passed

## TC-65 — POST /api/v1/auth/register — invalid email
**Method:** `POST /api/v1/auth/register`
**Condition:** `email: "notanemail"`
**Expected:** `422`
**Result:** ✅ Passed

## TC-66 — POST /api/v1/auth/register — password too short
**Method:** `POST /api/v1/auth/register`
**Condition:** `password: "abc"`  (less than 8 characters)
**Expected:** `422`
**Result:** ✅ Passed

## TC-67 — POST /api/v1/auth/login — valid credentials
**Method:** `POST /api/v1/auth/login`
**Condition:** Correct email + password
**Expected:** `200` + JWT token
**Result:** ✅ Passed

## TC-68 — POST /api/v1/auth/login — wrong password
**Method:** `POST /api/v1/auth/login`
**Condition:** Correct email, wrong password
**Expected:** `401`
**Result:** ✅ Passed

## TC-69 — POST /api/v1/auth/login — unknown email
**Method:** `POST /api/v1/auth/login`
**Condition:** Email does not exist in database
**Expected:** `401`
**Result:** ✅ Passed

## TC-70 — GET /api/v1/auth/me — valid token
**Method:** `GET /api/v1/auth/me`
**Condition:** Valid JWT in Authorization header
**Expected:** `200` + user object without password field
**Result:** ✅ Passed

## TC-71 — GET /api/v1/auth/me — expired token
**Method:** `GET /api/v1/auth/me`
**Condition:** JWT is expired
**Expected:** `401`
**Result:** ✅ Passed

## TC-72 — GET /api/v1/auth/me — tampered token
**Method:** `GET /api/v1/auth/me`
**Condition:** JWT signature manually altered
**Expected:** `401`
**Result:** ✅ Passed

---
# TC — Security (Day 11)

## TC-73 — SQL injection attempt on login
**Method:** `POST /api/v1/auth/login`
**Condition:** `email: "' OR 1=1 -- or test@test.com"`, any password
**Expected:** Request rejected — authentication never succeeds
**Result:** ✅ Passed  — server returns 400 Bad Request and 401 Unautorized for "test@test.com" due to input validation

## TC-74 — XSS attempt in comment body
**Method:** `POST /api/v1/recipes/:id/comments`
**Condition:** `content: "<script>alert(1)</script>"`
**Expected:** Content stored without modification; XSS mitigation handled during client-side rendering
**Result:** ✅ Passed

## TC-75 — Unauthorized recipe modification
**Method:** `PUT /api/v1/recipes/:id`
**Condition:** Valid JWT but user is not the recipe author
**Expected:** `403`
**Result:** ✅ Passed

## TC-76 — Admin route access without admin role
**Method:** `GET /api/v1/admin/recipes`
**Condition:** Valid JWT with `role: "user"`
**Expected:** `403`
**Result:** ✅ Passed