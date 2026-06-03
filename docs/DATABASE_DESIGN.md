# Database Design – Ovni Culinaire

## Overview
[2-3 phrases en anglais qui décrivent le projet et pourquoi ces choix de conception]

## Tables (MVP)

### users
id                INT UNSIGNED    NOT NULL AUTO_INCREMENT PRIMARY KEY
username          VARCHAR(50)     NOT NULL UNIQUE
email             VARCHAR(255)    NOT NULL UNIQUE
password_hash     VARCHAR(255)    NOT NULL
role              ENUM('user','admin') NOT NULL DEFAULT 'user'
points            INT UNSIGNED    NOT NULL DEFAULT 0
created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
updated_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
deleted_at        DATETIME        NULL


### categories
id                INT UNSIGNED    NOT NULL AUTO_INCREMENT PRIMARY KEY
name              VARCHAR(100)    NOT NULL UNIQUE
slug              VARCHAR(100)    NOT NULL UNIQUE
created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP

### recipes
id                INT UNSIGNED    NOT NULL AUTO_INCREMENT PRIMARY KEY
user_id           INT UNSIGNED    NOT NULL
category_id       INT UNSIGNED    NOT NULL
title             VARCHAR(255)    NOT NULL
slug              VARCHAR(255)    NOT NULL UNIQUE
ingredients       TEXT            NOT NULL
steps             TEXT            NOT NULL
anecdote          TEXT            NOT NULL
prep_time         SMALLINT UNSIGNED NOT NULL
cost_per_serving  DECIMAL(5,2)    NOT NULL
average_rating    DECIMAL(3,2)    NOT NULL DEFAULT 0.00
views             INT UNSIGNED    NOT NULL DEFAULT 0
status            ENUM('pending','published','rejected') NOT NULL DEFAULT 'pending'
created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
updated_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
deleted_at        DATETIME        NULL

FK: user_id → users(id)
FK: category_id → categories(id)

### comments
id                INT UNSIGNED    NOT NULL AUTO_INCREMENT PRIMARY KEY
recipe_id         INT UNSIGNED    NOT NULL
user_id           INT UNSIGNED    NULL
guest_username    VARCHAR(50)     NULL
content           TEXT            NOT NULL
created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
deleted_at        DATETIME        NULL

FK: recipe_id → recipes(id)
FK: user_id → users(id)   -- nullable

### ratings
id                INT UNSIGNED    NOT NULL AUTO_INCREMENT PRIMARY KEY
user_id           INT UNSIGNED    NOT NULL
recipe_id         INT UNSIGNED    NOT NULL
score             TINYINT UNSIGNED NOT NULL
created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP

FK: user_id → users(id)
FK: recipe_id → recipes(id)
UNIQUE KEY unique_rating (user_id, recipe_id)

### admin_logs
id                INT UNSIGNED    NOT NULL AUTO_INCREMENT PRIMARY KEY
admin_id          INT UNSIGNED    NOT NULL
action            VARCHAR(100)    NOT NULL
target_type       VARCHAR(50)     NOT NULL
target_id         INT UNSIGNED    NOT NULL
note              TEXT            NULL
created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP

FK: admin_id → users(id)

## Relationships
- users (1) → recipes (N) : one user can publish many recipes
- categories (1) → recipes (N) : one category can contain many recipes
- users (1) → comments (N) : one user can post many comments (nullable: guests allowed)
- recipes (1) → comments (N) : one recipe can have many comments
- users (1) → ratings (N) : one user can rate many recipes
- recipes (1) → ratings (N) : one recipe can receive many ratings
- users (1) → admin_logs (N) : one admin can perform many logged actions

## Security Considerations
- `password_hash` : passwords are never stored in plain text. bcryptjs is used 
  to hash passwords before insertion. The column name makes this explicit.

- `UNIQUE` on `username` and `email` : prevents duplicate accounts and 
  enumeration attacks based on duplicate errors.

- `UNIQUE KEY unique_rating (user_id, recipe_id)` : enforced at database level,
  not just application level. Even if the app code fails, the DB refuses 
  duplicate votes.

- `role ENUM('user','admin')` : restricts possible values at DB level. 
  A bug in the app cannot insert an unknown role.

- `deleted_at` (soft delete) on `users`, `recipes`, `comments` : data is never 
  physically deleted. This preserves referential integrity and allows recovery.
  A deleted user's recipes remain readable. A deleted recipe's comments remain 
  in the DB for audit purposes.

- `user_id NULL` on `comments` : allows guest comments (US-13) without 
  compromising FK integrity. If null, `guest_username` must be provided — 
  this constraint is enforced at application level via express-validator.

- `admin_logs` has no `deleted_at` : audit logs are immutable by design.

## Indexes
- `recipes.user_id` : frequent JOIN with users table
- `recipes.category_id` : frequent filter by category
- `recipes.status` : recipes are almost always filtered by status='published'
- `recipes.prep_time` : filter < 15 min (US-01)
- `recipes.cost_per_serving` : filter by budget (US-03)
- `recipes.average_rating` : sort by popularity
- `recipes.views` : sort by most viewed (admin dashboard US-15)
- `comments.recipe_id` : frequent JOIN to load comments per recipe
- `ratings.recipe_id` : needed to recalculate average_rating efficiently
- `admin_logs.admin_id` : filter logs by admin

## Planned – not implemented in MVP
### badges
id                INT UNSIGNED    NOT NULL AUTO_INCREMENT PRIMARY KEY
name              VARCHAR(100)    NOT NULL UNIQUE
description       TEXT            NULL
min_points        INT UNSIGNED    NOT NULL DEFAULT 0
created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP

### user_badges
id                INT UNSIGNED    NOT NULL AUTO_INCREMENT PRIMARY KEY
user_id           INT UNSIGNED    NOT NULL
badge_id          INT UNSIGNED    NOT NULL
awarded_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP

### auth_logs
Tracks login attempts for security auditing. Not implemented in MVP.

id                INT UNSIGNED    NOT NULL AUTO_INCREMENT PRIMARY KEY
user_id           INT UNSIGNED    NULL
ip_address        VARCHAR(45)     NOT NULL
event_type        ENUM('login_success','login_failure','logout') NOT NULL
created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP

FK: user_id → users(id)  -- nullable: failed attempts may not resolve to a user
