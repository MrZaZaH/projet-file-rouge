# API Reference – Ovni Culinaire

Base URL: `/api/v1`

All responses are JSON. Protected routes require a Bearer token in the
`Authorization` header: `Authorization: Bearer <token>`

## Error format:
```json
{
  "success": false,
  "error": {
    "message": "Human-readable message",
    "code": "ERROR_CODE"
  }
}
```
## Validation error format (422):
```json
{
  "errors": [
    { "msg": "Title is required.", "path": "title", "location": "body" }
  ]
}
```
### Health
`GET /health`
Check server and database status. Not versioned — lives outside /api/v1.
Auth required: No
Response 200:
```json
{
  "success": true,
  "status": "ok",
  "timestamp": "2025-01-15T10:00:00.000Z",
  "database": "connected",
  "environment": "development"
}
```
Response 503: Database unreachable.

### Authentication
`POST /api/v1/auth/register`
Create a new user account.
Auth required: No

Request body:
| Field | Type | Rules |
|-------|------|-------|
| `username` | string | 2–50 characters |
| `email` | string | Valid email format |
| `password` | string | Min 8 chars, at least one uppercase letter, at least one digit |

Response 201:
```json
{
  "success": true,
  "data": {
    "token": "<jwt>",
    "user": {
      "id": 1,
      "username": "mickael",
      "email": "mickael@example.com",
      "role": "user"
    }
  }
}
```
Response 422: Validation failed.
Response 409: Email already in use.

`POST /api/v1/auth/login`
Authenticate and receive a JWT.
Auth required: No

Request body:
| Field | Type | Rules |
|-------|------|-------|
| `email` | string | Valid email format |
| `password` | string | Required |

Response 200:
```json
{
  "success": true,
  "data": {
    "token": "<jwt>",
    "user": {
      "id": 1,
      "username": "mickael",
      "email": "mickael@example.com",
      "role": "user"
    }
  }
}
```
Response 401: Invalid credentials.
Response 422: Validation failed.

`GET /api/v1/auth/me`
Return the authenticated user's profile.
Auth required: Yes
Response 200:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "mickael",
    "email": "mickael@example.com",
    "role": "user",
    "created_at": "2025-01-15T10:00:00.000Z"
  }
}
```
Response 401: Missing or invalid token.

### Recipes
`GET /api/v1/recipes`
List all published recipes. Supports filtering via query parameters.
Auth required: No

Query parameters:
| Parameter | Type | Description |
|-----------|------|-------------|
| `category_id` | integer | Filter by category |
| `max_time` | integer | Max prep time in minutes |
| `max_cost` | float | Max cost per portion in euros |
| `sort` | string | `recent` (default), `rating`, `popular` |
Response 200:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Poire chocolat micro-ondes",
      "prep_time": 5,
      "cost_per_portion": 0.80,
      "average_rating": 4.2,
      "category_id": 3,
      "author": "mickael"
    }
  ]
}
```
`GET /api/v1/recipes/random`
Return one random published recipe.
Auth required: No

⚠️ This route is declared before /:id in the router. If it were after,
Express would interpret the string "random" as a recipe ID and return 404.

Response 200: Single recipe object (same shape as list item above).Response 404: No recipes in database.

`GET /api/v1/recipes/:id`
Return full details for one recipe, including author info and comments.
Auth required: No
Path parameter: id — integer, recipe ID.
Response 200:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Poire chocolat micro-ondes",
    "anecdote": "Saved a date with half a chocolate bar and one lonely pear.",
    "ingredients": ["1 pear", "50g dark chocolate"],
    "steps": ["Melt chocolate.", "Pour over pear.", "Look confident."],
    "prep_time": 5,
    "cost_per_portion": 0.80,
    "average_rating": 4.2,
    "category_id": 3,
    "author": {
      "id": 1,
      "username": "mickael"
    },
    "comments": []
  }
}
```
Response 404: Recipe not found or soft-deleted.

`POST /api/v1/recipes`
Create a new recipe.
Auth required: Yes

Request body:
| Field | Type | Rules |
|-------|------|-------|
| `title` | string | Required, max 255 chars |
| `anecdote` | string | Required, min 20 chars — the soul of the project |
| `category_id` | integer | Required, positive integer |
| `ingredients` | string[] | Non-empty array, each item non-empty string |
| `steps` | string[] | Non-empty array, each item non-empty string |
| `prep_time` | integer | Required, min 1 (minutes) |
| `cost_per_portion` | float | Required, min 0.01 (euros) |
Response 201: Created recipe object.
Response 422: Validation failed.
Response 401: Not authenticated.

`PUT /api/v1/recipes/:id`
Update an existing recipe.
Auth required: Yes — must be the recipe owner or an admin.
Path parameter: id — integer, recipe ID.

Request body: 
| Field | Type | Rules |
|-------|------|-------|
| `title` | string | Required, max 255 chars |
| `anecdote` | string | Required, min 20 chars — the soul of the project |
| `category_id` | integer | Required, positive integer |
| `ingredients` | string[] | Non-empty array, each item non-empty string |
| `steps` | string[] | Non-empty array, each item non-empty string |
| `prep_time` | integer | Required, min 1 (minutes) |
| `cost_per_portion` | float | Required, min 0.01 (euros) |
Response 200: Updated recipe object.
Response 403: Not the owner.
Response 404: Recipe not found.
Response 422: Validation failed.

`DELETE /api/v1/recipes/:id`
Soft-delete a recipe (sets deleted_at, does not remove the row).
Auth required: Yes — must be the recipe owner or an admin.
Path parameter: id — integer, recipe ID.
Response 200:
{ "success": true, "message": "Recipe deleted." }
Response 403: Not the owner.
Response 404: Recipe not found.

### Comments
All comment routes are nested under a recipe: `/api/v1/recipes/:recipeId/comments`
`GET /api/v1/recipes/:recipeId/comments`
List all comments for a recipe.
Auth required: No
Response 200:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "content": "Made this at 2am, no regrets.",
      "guest_name": null,
      "user": { "id": 2, "username": "sandra" },
      "created_at": "2025-01-15T10:00:00.000Z"
    }
  ]
}
```
`POST /api/v1/recipes/:recipeId/comments`
Add a comment. Works for both authenticated users and guests.

Auth required: No — but behavior differs:
| Situation | Token | `guest_name` |
|-----------|-------|-------------|
| Logged-in user | Required in header | Ignored |
| Guest | Absent or omitted | Required in body |




Request body:
| Field | Type | Rules |
|-------|------|-------|
| `content` | string | Required, max 1000 chars |
| `guest_name` | string | Required only if not authenticated, max 50 chars |
Response 201: Created comment object.
Response 422: Validation failed.
Response 404: Recipe not found.

`DELETE /api/v1/recipes/:recipeId/comments/:id`
Delete a comment (soft-delete).
Auth required: Yes — must be the comment owner or an admin.
Response 200:
{ "success": true, "message": "Comment deleted." }
Response 403: Not the owner.
Response 404: Comment not found.

### Ratings
All rating routes are nested under a recipe: `/api/v1/recipes/:recipeId/ratings`
`POST /api/v1/recipes/:recipeId/ratings`
Rate a recipe. One rating per user per recipe — updates the existing rating if
the user has already rated.
Auth required: Yes

Request body:
| Field | Type | Rules |
|-------|------|-------|
| `score` | integer | Required, 1–5 |
Response 200 or 201: 
```json
{
  "success": true,
  "data": {
    "score": 4,
    "average_rating": 4.2
  }
}
```
Response 401: Not authenticated.
Response 422: Validation failed.
Response 404: Recipe not found.

---
