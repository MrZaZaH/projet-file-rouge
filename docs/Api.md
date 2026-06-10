# API Reference – Ovni Culinaire

## Base URL

`/api/v1`

All responses are JSON.  
Protected routes require a Bearer token:
Authorization: Bearer <token>

---

## Error Format

```json
{
  "success": false,
  "error": {
    "message": "Human-readable message",
    "code": "ERROR_CODE"
  }
}
Validation Error (422)
{
  "errors": [
    { "msg": "Title is required.", "path": "title", "location": "body" }
  ]
}

Health
GET /health
Check server and database status.Not versioned — outside /api/v1.

Auth required: ❌

Response 200
{
  "success": true,
  "status": "ok",
  "timestamp": "2025-01-15T10:00:00.000Z",
  "database": "connected",
  "environment": "development"
}
Response 503
Database unreachable.

Authentication
POST /api/v1/auth/register
Create a new user.

Auth required: ❌

Request body
Copier le tableau


Field
Type
Rules



username
string
2–50 characters


email
string
Valid email


password
string
Min 8 chars, 1 uppercase, 1 digit


Response 201
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

422: Validation failed  
409: Email already in use


POST /api/v1/auth/login

Auth required: ❌

Request body
Copier le tableau


Field
Type
Rules



email
string
Valid email


password
string
Required


Response 200
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

401: Invalid credentials  
422: Validation failed


GET /api/v1/auth/me

Auth required: ✅

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

401: Missing or invalid token


Recipes
GET /api/v1/recipes

Auth required: ❌

Query parameters
Copier le tableau


Parameter
Type
Description



category_id
integer
Filter by category


max_time
integer
Max prep time


max_cost
float
Max cost per portion


sort
string
recent, rating, popular


Response 200
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

GET /api/v1/recipes/random

Auth required: ❌

⚠️ Must be declared before /:id in router.

200: Recipe object  
404: No recipes


GET /api/v1/recipes/:id

Auth required: ❌

Response 200
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

404: Not found


POST /api/v1/recipes

Auth required: ✅

Request body
Copier le tableau


Field
Type
Rules



title
string
max 255


anecdote
string
min 20


category_id
integer
required


ingredients
string[]
non-empty


steps
string[]
non-empty


prep_time
integer
min 1


cost_per_portion
float
min 0.01



201: Created  
422: Validation failed  
401: Unauthorized


PUT /api/v1/recipes/:id

Auth required: ✅ (owner or admin)

200: Updated  

403: Forbidden  

404: Not found  

422: Validation failed



DELETE /api/v1/recipes/:id

Auth required: ✅

{ "success": true, "message": "Recipe deleted." }

Comments
Base route: /api/v1/recipes/:recipeId/comments
POST comment behavior
Copier le tableau


Situation
Token
guest_name



Logged user
Yes
Ignored


Guest
No
Required


Request body
Copier le tableau


Field
Type
Rules



content
string
max 1000


guest_name
string
required if guest



Ratings
POST /api/v1/recipes/:recipeId/ratings

Auth required: ✅

Copier le tableau


Field
Type
Rules



score
integer
1–5


Response
{
  "success": true,
  "data": {
    "score": 4,
    "average_rating": 4.2
  }
}

200/201: Success  
401: Unauthorized  
422: Validation failed  
404: Not found


---
