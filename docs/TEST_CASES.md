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
