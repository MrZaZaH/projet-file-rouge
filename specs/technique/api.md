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
Auth required: No (but if a valid Bearer token is present, `is_favorited` is returned)
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
    "is_favorited": true,
    "author": {
      "id": 1,
      "username": "mickael"
    },
    "comments": []
  }
}
```
Response 404: Recipe not found or soft-deleted.

Note: `is_favorited` is only present when the request includes a valid Bearer token. Guests see `is_favorited: false` implicitly.

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
## Admin Endpoints

### 1. Get All Recipes (for moderation)

**Endpoint:** `GET /api/admin/recipes`

**Authentication:** Required (Admin role)

**Query Parameters:**
- `status` (optional): `pending`, `published`, `rejected`
- `limit` (optional): Default 10, Max 100
- `offset` (optional): Default 0

**Request:**
```http
GET /api/admin/recipes?status=pending&limit=20&offset=0
Authorization: Bearer <admin_jwt_token>
Response (200 OK):
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": 1,
      "title": "Œufs en Sauce Urgente",
      "status": "pending",
      "cost_per_portion": "2.50",
      "prep_time": 15,
      "average_rating": "4.00",
      "rating_count": 1,
      "author": "testuser",
      "created_at": "2026-06-15T03:56:26.000Z",
      "updated_at": "2026-06-15T03:56:26.000Z"
    }
  ]
}
Error Responses:

401 Unauthorized: Missing or invalid JWT token
403 Forbidden: User is not admin
400 Bad Request: Invalid query parameters


2. Update Recipe Status
Endpoint: PATCH /api/admin/recipes/:id/status
Authentication: Required (Admin role)
URL Parameters:

id (required): Recipe ID (integer)

Request Body:
{
  "status": "published"
}
Valid Status Values:

published — recipe becomes visible to all users
rejected — recipe rejected, user notified, stays hidden

Request:
PATCH /api/admin/recipes/1/status
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json

{
  "status": "published"
}
Response (200 OK):
{
  "success": true,
  "message": "Recipe published successfully",
  "data": {
    "recipe_id": "1",
    "previous_status": "pending",
    "new_status": "published"
  }
}
Error Responses:

401 Unauthorized: Missing or invalid JWT token
403 Forbidden: User is not admin
404 Not Found: Recipe does not exist
400 Bad Request: Invalid status or validation error{
  "success": false,
  "errors": [
    {
      "field": "status",
      "message": "Status must be 'published' or 'rejected'"
    }
  ]
}



3. Delete Recipe (Soft Delete)
Endpoint: DELETE /api/admin/recipes/:id
Authentication: Required (Admin role)
URL Parameters:

id (required): Recipe ID (integer)

Request Body:
{
  "reason": "Inappropriate content"
}
Reason: Description of why the recipe was deleted (max 255 characters)
Request:
DELETE /api/admin/recipes/2
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json

{
  "reason": "Contenu dupliqué avec recette #1"
}
Response (200 OK):
{
  "success": true,
  "message": "Recipe deleted successfully",
  "data": {
    "recipe_id": 2,
    "deleted_at": "2026-06-15T14:32:45.000Z",
    "reason": "Contenu dupliqué avec recette #1"
  }
}
Error Responses:

401 Unauthorized: Missing or invalid JWT token
403 Forbidden: User is not admin
404 Not Found: Recipe does not exist
400 Bad Request: Missing reason or validation error{
  "success": false,
  "errors": [
    {
      "field": "reason",
      "message": "Reason is required and must be max 255 characters"
    }
  ]
}



4. Get Admin Logs
Endpoint: GET /api/admin/logs
Authentication: Required (Admin role)
Query Parameters:

target_type (optional): recipe, user, comment
action (optional): approve, reject, delete, restore
limit (optional): Default 50, Max 500
offset (optional): Default 0

Request:
GET /api/admin/logs?action=delete&limit=20
Authorization: Bearer <admin_jwt_token>
Response (200 OK):
{
  "success": true,
  "count": 15,
  "data": [
    {
      "id": 5,
      "admin_id": 3,
      "target_type": "recipe",
      "target_id": 2,
      "action": "delete",
      "recipe_id": 2,
      "created_at": "2026-06-15T14:32:45.000Z"
    }
  ]
}
Error Responses:

401 Unauthorized: Missing or invalid JWT token
403 Forbidden: User is not admin
400 Bad Request: Invalid query parameters


Security Notes
All admin endpoints require:

Valid JWT token in Authorization: Bearer <token> header
Admin role (users.role = 'admin')
Input validation via express-validator
Rate limiting via helmet (5 requests per minute per IP)

All actions are logged in admin_logs table with:

Admin user ID
Target type and ID
Action performed
Timestamp
Deletion reason (if applicable)

Rejected or deleted recipes trigger user_notifications entry to inform the author.

---

## User Dashboard Endpoints

### `GET /api/v1/users/me/profile`
Return the authenticated user's profile with aggregate statistics.
Auth required: Yes

Response 200:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "username": "mickael",
      "email": "mickael@example.com",
      "role": "user",
      "created_at": "2025-01-15T10:00:00.000Z"
    },
    "stats": {
      "total_recipes": 3,
      "published_recipes": 2,
      "pending_recipes": 1,
      "rejected_recipes": 0,
      "total_comments_received": 12,
      "favorite_count": 5
    }
  }
}
```
Response 401: Missing or invalid token.

### `GET /api/v1/users/me/recipes`
Return all non-deleted recipes for the authenticated user, ordered by most recent first.
Includes all statuses (published, pending, rejected).
Auth required: Yes

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
      "status": "published",
      "created_at": "2025-01-15T10:00:00.000Z"
    }
  ]
}
```
Response 401: Missing or invalid token.

### Favorites

#### `GET /api/v1/favorites`
Return all recipes saved by the authenticated user.
Auth required: Yes

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
      "author": "mickael",
      "favorited_at": "2025-01-20T10:00:00.000Z"
    }
  ]
}
```
Response 401: Missing or invalid token.

#### `POST /api/v1/favorites/:recipeId`
Toggle a recipe as favorite for the authenticated user.
If the recipe is already favorited → removes it (unfavorite).
If not favorited → adds it.

Auth required: Yes

Response 200 (added):
```json
{
  "success": true,
  "data": {
    "favorited": true,
    "recipe_id": 1
  }
}
```
Response 200 (removed):
```json
{
  "success": true,
  "data": {
    "favorited": false,
    "recipe_id": 1
  }
}
```
Response 401: Not authenticated.
Response 404: Recipe not found.
