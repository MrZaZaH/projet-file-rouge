# 07 — CRUD Recettes avec Filtres Dynamiques

## 1. CE QUE ÇA FAIT (vue d'ensemble)

Ce mécanisme gère la création, lecture, mise à jour et suppression (soft delete) des recettes. Le cœur du métier : `findAllWithFilters()` construit une requête SQL **dynamiquement** en fonction des filtres passés (catégorie, temps max, coût max, note minimum). Les ingrédients et étapes sont stockés en JSON dans MariaDB, normalisés automatiquement par le modèle. La pagination est intégrée avec un limit par défaut de 50 et un cap à 100.

## 2. SCHÉMA DE LA TABLE

```sql
CREATE TABLE IF NOT EXISTS recipes (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id             INT UNSIGNED NOT NULL,
    category_id         INT UNSIGNED NOT NULL,
    title               VARCHAR(255) NOT NULL,
    anecdote            TEXT NOT NULL,
    ingredients         JSON NOT NULL,
    steps               JSON NOT NULL,
    prep_time           SMALLINT UNSIGNED NOT NULL,
    cost_per_portion    DECIMAL(5,2) UNSIGNED NOT NULL,
    status              ENUM('pending', 'published', 'rejected') NOT NULL DEFAULT 'pending',
    average_rating      DECIMAL(3,2) UNSIGNED NOT NULL DEFAULT 0.00,
    rating_count        SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at          DATETIME NULL DEFAULT NULL,

    CONSTRAINT fk_recipes_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,

    CONSTRAINT fk_recipes_category
        FOREIGN KEY (category_id) REFERENCES categories(id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

(Source: `database/scripts/03_create_tables.sql:54-91`)

## 3. LE CODE

### 3.1 — Recipe.create() (`src/models/Recipe.js:107`)

```javascript
static async create(data) {
    try {
        // === VALIDATION ===
        // Chaque champ est vérifié individuellement avant tout appel DB
        if (!data.title || data.title.trim() === '') {
            throw new Error('Title is required');
        }
        if (!data.anecdote || data.anecdote.trim() === '') {
            throw new Error('Anecdote is required');
        }
        if (!data.user_id || !data.category_id) {
            throw new Error('User ID and Category ID required');
        }

        // Normalisation ingredients : accepte string OU array
        // "pâtes, tomate, parmesan" → ["pâtes", "tomate", "parmesan"]
        let ingredients;
        if (Array.isArray(data.ingredients)) {
            ingredients = data.ingredients;
        } else if (typeof data.ingredients === 'string' && data.ingredients.trim() !== '') {
            ingredients = data.ingredients
                .split(',')
                .map(s => s.trim())
                .filter(s => s.length > 0);
        } else {
            ingredients = [];
        }
        if (ingredients.length === 0) {
            throw new Error('Ingredients are required and non-empty');
        }

        // Normalisation steps : split sur \n au lieu de ,
        let steps;
        if (Array.isArray(data.steps)) {
            steps = data.steps;
        } else if (typeof data.steps === 'string' && data.steps.trim() !== '') {
            steps = data.steps
                .split('\n')
                .map(s => s.trim())
                .filter(s => s.length > 0);
        } else {
            steps = [];
        }
        if (steps.length === 0) {
            throw new Error('Steps are required and non-empty');
        }

        // Validation coût et temps
        const cost = parseFloat(data.cost_per_portion);
        if (isNaN(cost) || cost < 0) {
            throw new Error('Cost per portion must be >= 0');
        }
        const prepTime = parseInt(data.prep_time, 10);
        if (isNaN(prepTime) || prepTime < 0) {
            throw new Error('Prep time must be non-negative number');
        }

        // === INSERT SQL ===
        // Tous les paramètres avec ? — zéro concaténation, zéro injection SQL
        const query = `
            INSERT INTO recipes (
                user_id, category_id, title, anecdote,
                ingredients, steps,
                prep_time, cost_per_portion,
                status, average_rating, rating_count,
                created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `;

        const [result] = await pool.query(query, [
            data.user_id,
            data.category_id,
            data.title.trim(),
            data.anecdote.trim(),
            JSON.stringify(ingredients),  // tableau JS → string JSON pour MariaDB
            JSON.stringify(steps),
            prepTime,
            cost,
            data.status || 'pending',     // défaut : en attente de modération
            0,                            // average_rating initial
            0,                            // rating_count initial
        ]);

        // On retourne la recette complète (avec JOINs) via findById()
        return this.findById(result.insertId);

    } catch (error) {
        logger.error(`Recipe.create() failed: ${error.message}`);
        if (error.message.includes('FOREIGN KEY')) {
            throw new Error('User or Category not found');
        }
        if (error.message.includes('CONSTRAINT')) {
            throw new Error('Invalid data: constraint violation');
        }
        throw error;
    }
}
```

### 3.2 — Recipe.findAllWithFilters() (`src/models/Recipe.js:449`)

```javascript
static async findAllWithFilters(filters = {}) {
    try {
        // Requête de base : seulement les recettes non-supprimées
        let query = `
            SELECT r.*
            FROM recipes r
            WHERE r.deleted_at IS NULL
        `;
        const params = [];

        // === AJOUT DYNAMIQUE DES CLAUSES WHERE ===
        // Chaque bloc n'est ajouté QUE si le filtre correspondant est présent

        if (filters.category_id) {
            query += ' AND r.category_id = ?';
            params.push(filters.category_id);
        }

        if (filters.max_prep_time) {
            query += ' AND r.prep_time <= ?';
            params.push(filters.max_prep_time);
        }

        // max_cost ET max_cost_per_portion sont acceptés (alias)
        const maxCost = filters.max_cost !== undefined
            ? filters.max_cost
            : filters.max_cost_per_portion;

        if (maxCost !== undefined) {
            query += ' AND r.cost_per_portion <= ?';
            params.push(maxCost);
        }

        if (filters.min_rating) {
            query += ' AND r.average_rating >= ?';
            params.push(filters.min_rating);
        }

        if (filters.status) {
            query += ' AND r.status = ?';
            params.push(filters.status);
        }

        // === TRI CONDITIONNEL ===
        // Le tri change selon le filtre actif (premier match gagne)
        let sortClause;
        if (filters.max_prep_time) {
            sortClause = SORT.BY_TIME;      // prep_time ASC → plus rapide d'abord
        } else if (maxCost !== undefined) {
            sortClause = SORT.BY_COST;      // cost_per_portion ASC → moins cher d'abord
        } else if (filters.min_rating) {
            sortClause = SORT.BY_RATING;    // average_rating DESC → mieux noté d'abord
        } else {
            sortClause = SORT.BY_DATE;      // created_at DESC → plus récent d'abord
        }
        query += ` ORDER BY r.${sortClause}`;

        // === PAGINATION ===
        const rawLimit = parseInt(filters.limit, 10);
        const limit = (!isNaN(rawLimit) && rawLimit > 0)
            ? Math.min(rawLimit, FILTERS.MAX_LIMIT)   // cap à 100 max
            : FILTERS.DEFAULT_LIMIT;                  // défaut 50

        const offset = parseInt(filters.offset, 10) || 0;

        query += ' LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const [rows] = await pool.query(query, params);

        // === MAPPING ===
        // Chaque ligne JSON est parsée (ingredients, steps) et convertie
        return rows.map((row) => {
            let ingredients = [];
            let steps = [];
            try {
                ingredients = row.ingredients ? JSON.parse(row.ingredients) : [];
                steps = row.steps ? JSON.parse(row.steps) : [];
            } catch (parseError) {
                logger.warn(`Failed to parse JSON for recipe ${row.id}: ${parseError.message}`);
            }
            return {
                id: row.id,
                title: row.title,
                ingredients,
                steps,
                prep_time: row.prep_time,
                cost_per_portion: parseFloat(row.cost_per_portion),
                average_rating: parseFloat(row.average_rating),
                rating_count: row.rating_count,
                // ... autres champs
            };
        });
    } catch (error) {
        logger.error(`Recipe.findAllWithFilters() failed: ${error.message}`);
        throw error;
    }
}
```

### 3.3 — Recipe.update() (`src/models/Recipe.js:657`)

```javascript
static async update(id, data) {
    try {
        // Validation partielle (seulement si le champ est fourni)
        if (data.cost_per_portion !== undefined) {
            const cost = parseFloat(data.cost_per_portion);
            if (isNaN(cost) || cost < 0) {
                throw new Error('Cost per portion must be >= 0');
            }
        }
        if (data.prep_time !== undefined) {
            const prepTime = parseInt(data.prep_time, 10);
            if (isNaN(prepTime) || prepTime < 0) {
                throw new Error('Prep time must be non-negative number');
            }
        }

        // Construction dynamique du SET
        let query = 'UPDATE recipes SET ';
        const params = [];
        const fieldsToUpdate = [];

        if (data.title !== undefined) {
            fieldsToUpdate.push('title = ?');
            params.push(data.title.trim());
        }
        if (data.ingredients !== undefined) {
            fieldsToUpdate.push('ingredients = ?');
            params.push(JSON.stringify(data.ingredients));
        }
        if (data.steps !== undefined) {
            fieldsToUpdate.push('steps = ?');
            params.push(JSON.stringify(data.steps));
        }
        // ... même pattern pour anecdote, prep_time, cost_per_portion, status

        if (fieldsToUpdate.length === 0) {
            return this.findById(id);  // Rien à mettre à jour
        }

        fieldsToUpdate.push('updated_at = NOW()');
        query += fieldsToUpdate.join(', ');
        query += ' WHERE id = ? AND deleted_at IS NULL';
        params.push(id);

        const [result] = await pool.query(query, params);
        if (result.affectedRows === 0) return null;

        return this.findById(id);  // Retourne l'état complet après update
    } catch (error) {
        logger.error(`Recipe.update(${id}) failed: ${error.message}`);
        throw error;
    }
}
```

### 3.4 — Recipe.softDelete() (`src/models/Recipe.js:908`)

```javascript
static async softDelete(id) {
    const query = `
        UPDATE recipes
        SET    deleted_at = NOW(),
               updated_at = NOW()
        WHERE  id = ? AND deleted_at IS NULL
    `;
    const [result] = await pool.query(query, [id]);
    return result.affectedRows > 0;
    // affectedRows === 0 → déjà supprimé ou inexistant
}
```

### 3.5 — RecipeController.deleteRecipe (`src/controllers/RecipeController.js:182`)

```javascript
// DELETE /api/v1/recipes/:id
// Autorisation : admin OU auteur de la recette
async function deleteRecipe(req, res, next) {
    try {
        const recipe = await Recipe.findById(req.params.id);

        if (!recipe) {
            return sendError(res, 'Recipe not found.', 404);
        }

        const isAdmin = req.user.role === 'admin';
        const isAuthor = recipe.user_id === req.user.id;

        if (!isAdmin && !isAuthor) {
            return sendError(res, 'Forbidden.', 403);
        }

        await Recipe.softDelete(req.params.id);

        // Si admin, notifie l'auteur et log
        if (isAdmin) {
            const message = \`Votre recette "\${recipe.title}" a été supprimée par un administrateur.\`;
            await pool.query(
                'INSERT INTO user_notifications (user_id, type, message, recipe_id, created_at)
                 VALUES (?, ?, ?, ?, NOW())',
                [recipe.user_id, 'recipe_deleted', message, Number(req.params.id)]
            );
            await pool.query(
                'INSERT INTO admin_logs (admin_id, action, recipe_id, target_type, target_id, created_at)
                 VALUES (?, ?, ?, ?, ?, NOW())',
                [req.user.id, 'recipe_deleted', Number(req.params.id), 'recipe', Number(req.params.id)]
            );
        }

        return sendSuccess(res, null, 'Recipe deleted.', 200);
    } catch (err) {
        next(err);
    }
}
```

L'auteur peut supprimer ses propres recettes sans notification. L'admin déclenche une notification utilisateur et une trace dans `admin_logs`.

### 3.6 — AdminController.deleteRecipe (`src/controllers/AdminController.js:251`)

```javascript
// DELETE /api/v1/admin/recipes/:id — admin seulement
static async deleteRecipe(req, res) {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const [recipe] = await pool.query(
            'SELECT id, user_id, title FROM recipes WHERE id = ? AND deleted_at IS NULL',
            [id]
        );

        if (!recipe.length) {
            return res.status(404).json({
                success: false, message: 'Recipe not found'
            });
        }

        await pool.query(
            'UPDATE recipes SET deleted_at = NOW(), updated_at = NOW() WHERE id = ?',
            [id]
        );

        const message = \`Votre recette "\${recipe[0].title}" a été supprimée.\${reason ? ' Raison : ' + reason : ''}\`;

        await pool.query(
            'INSERT INTO user_notifications (user_id, type, message, recipe_id, created_at)
             VALUES (?, ?, ?, ?, NOW())',
            [recipe[0].user_id, 'recipe_deleted', message, id]
        );

        await pool.query(
            'INSERT INTO admin_logs (admin_id, action, recipe_id, target_type, target_id, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())',
            [req.user.id, 'recipe_deleted', id, 'recipe', id]
        );

        res.json({ success: true, message: 'Recipe deleted' });
    } catch (error) {
        logger.error('Failed to delete recipe', { error: error.message });
        res.status(500).json({ success: false, message: error.message });
    }
}
```

Utilise des requêtes brutes (`pool.query`) plutôt que le modèle `Recipe.softDelete()`. Accepte un `reason` optionnel dans le body. La notification inclut la raison si fournie.

### 3.7 — RecipeController.getAllRecipes (`src/controllers/RecipeController.js`)

```javascript
// GET /api/v1/recipes — avec filtres
async function getAllRecipes(req, res, next) {
    try {
        const isAdmin = req.user?.role === 'admin';
        const filters = {
            status: isAdmin ? req.query.status : 'published',
            category_id: req.query.category_id ? Number(req.query.category_id) : null,
            max_prep_time: req.query.max_prep_time ? Number(req.query.max_prep_time) : null,
            max_cost: req.query.max_cost ? Number(req.query.max_cost) : null,
            min_rating: req.query.min_rating ? Number(req.query.min_rating) : null,
            limit: req.query.limit ? Number(req.query.limit) : null,
            offset: req.query.offset ? Number(req.query.offset) : null,
        };
        const cleanFilters = Object.fromEntries(
            Object.entries(filters).filter(([, v]) => v !== null)
        );
        const recipes = await Recipe.findAllWithFilters(cleanFilters);
        return sendSuccess(res, recipes);
    } catch (err) {
        next(err);
    }
}
```

### 3.8 — Constantes de filtres (`src/constants/filters.js`)

```javascript
const FILTERS = {
    QUICK_PREP_MAX: 15,   // minutes — US-01 : prêt en moins de 15 min
    BUDGET_LOW_MAX: 3,    // euros  — US-03 : moins de 3€
    BUDGET_MID_MAX: 5,    // euros  — US-03 : moins de 5€
    DEFAULT_LIMIT: 50,    // lignes par page
    MAX_LIMIT: 100,       // hard cap anti-abuse
};

const SORT = {
    BY_DATE: 'created_at DESC',
    BY_TIME: 'prep_time ASC',
    BY_COST: 'cost_per_portion ASC',
    BY_RATING: 'average_rating DESC',
};
```

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

**Création d'une recette :**
```
Frontend (formulaire) → POST /api/v1/recipes + JWT
    → express-validator valide le body (title, anecdote, ingredients[], steps[], etc.)
    → authenticate vérifie le token → req.user.id
    → RecipeController.createRecipe()
        → Recipe.create({ user_id, category_id, title, anecdote, ... })
            → Validation : chaque champ obligatoire, types, intervalles
            → Normalisation : ingredients split(","), steps split("\n")
            → INSERT INTO recipes (...) VALUES (?, ?, ...)
            → Recipe.findById(insertId) avec LEFT JOIN users et categories
            → Retourne l'objet complet avec JSON parsés
    → sendSuccess(res, recipe, 'Recipe submitted for review.', 201)
```

**Liste avec filtres :**
```
GET /api/v1/recipes?max_prep_time=15&category_id=2
    → RecipeController.getAllRecipes()
    → filters = { max_prep_time: 15, category_id: 2, status: 'published' }
    → Recipe.findAllWithFilters(filters)
        → WHERE r.deleted_at IS NULL
            AND r.prep_time <= 15
            AND r.category_id = 2
            AND r.status = 'published'
        → ORDER BY r.prep_time ASC  (car max_prep_time est présent)
        → LIMIT 50 OFFSET 0
    → Retourne tableau de recettes
```

**Soft delete par l'auteur :**
```
DELETE /api/v1/recipes/:id + JWT (auteur)
    → authenticate vérifie le token → req.user
    → RecipeController.deleteRecipe()
        → Recipe.findById(id) → vérifie que la recette existe
        → Vérifie isAdmin || isAuthor (sinon 403)
        → Recipe.softDelete(id) → UPDATE deleted_at = NOW()
    → sendSuccess(res, null, 'Recipe deleted.', 200)
```

**Soft delete par l'admin (route publique) :**
```
DELETE /api/v1/recipes/:id + JWT (admin)
    → Même route, même contrôleur
    → isAdmin = true → passe la vérification d'autorisation
    → Recipe.softDelete(id)
    → INSERT INTO user_notifications (prévient l'auteur)
    → INSERT INTO admin_logs (trace l'action d'audit)
    → sendSuccess(res, null, 'Recipe deleted.', 200)
```

**Soft delete par l'admin (route admin dédiée) :**
```
DELETE /api/v1/admin/recipes/:id + JWT (admin)
    → authenticate + requireAdmin (double vérification)
    → AdminController.deleteRecipe()
    → SELECT vérifie que la recette existe
    → UPDATE recipes SET deleted_at = NOW()
    → INSERT INTO user_notifications (message avec raison optionnelle)
    → INSERT INTO admin_logs (trace l'action)
    → res.json({ success: true, message: 'Recipe deleted' })
```

## 5. ANALOGIE

C'est comme un **classeur de fiches de cuisine** dans une cuisine communautaire. Chaque fiche a un titre, une histoire (anecdote), une liste d'ingrédients, des étapes. Le classeur est organisé : tu peux filtrer par catégorie (entrée/plat/dessert), par temps de préparation (≤15 min), par budget (≤5€). La normalisation des ingrédients, c'est comme réécrire «  oignons,  ail,  tomates » avec une écriture propre avant de la ranger — peu importe comment le contributeur a écrit, ça finit bien formaté.

## 6. PIÈGES CLASSIQUES

### Piège #1 : Concaténer les valeurs dans la requête SQL

**MAUVAIS** — injection SQL garantie :
```javascript
const query = `SELECT * FROM recipes WHERE title = '${data.title}'`;
// Si data.title = "'; DROP TABLE recipes; --" → c'est fini
```

**BON** — paramètres positionnels avec `?` :
```javascript
const query = `SELECT * FROM recipes WHERE title = ?`;
const [rows] = await pool.query(query, [data.title]);
```

### Piège #2 : Ne pas gérer le format des ingrédients

**MAUVAIS** — forcer un format unique, le frontend plante si l'utilisateur envoie une string :
```javascript
ingredients: data.ingredients.join(',')  // explode si ingredients est déjà une string
```

**BON** — normaliser dans le modèle, accepter string ET array :
```javascript
if (Array.isArray(data.ingredients)) { /* garder tel quel */ }
else if (typeof data.ingredients === 'string') { /* split */ }
```

## 7. ET SI ON FAISAIT AUTREMENT ?

### Option A : Stocker ingrédients et étapes dans des tables séparées
- **Comment ça marche** : tables `recipe_ingredients` (avec quantité, unité) et `recipe_steps` (avec numéro d'ordre).
- **Avantage** : requêtable — on peut chercher "toutes les recettes avec des pâtes".
- **Inconvénient** : complexité ++ (jointures, ORM-like), surdimensionné pour un MVP.
- **Notre cas** : le JSON suffit. On n'a pas besoin de requêter par ingrédient pour l'instant.

### Option B : Pagination par cursor (keyset pagination)
- **Comment ça marche** : au lieu de `LIMIT ? OFFSET ?`, on passe `WHERE id > ? LIMIT ?`.
- **Avantage** : performant sur les grandes tables (pas de scan des lignes "sautées").
- **Inconvénient** : plus complexe côté frontend, impossible si le tri change dynamiquement.
- **Notre cas** : offset convient pour notre volume (< 10k recettes).

## 8. CHECKLIST POUR LE JURY

- [ ] La table `recipes` a tous les champs : title, anecdote, ingredients JSON, steps JSON, status, average_rating, rating_count, deleted_at, created_at, updated_at
- [ ] `ingredients` et `steps` sont stockés en JSON et parsés au retour par `JSON.parse()`
- [ ] `findAllWithFilters()` construit le WHERE dynamiquement sans concaténer les valeurs utilisateur
- [ ] Le tri change selon le filtre actif (prep_time ASC, cost ASC, rating DESC, created_at DESC)
- [ ] `max_cost` et `max_cost_per_portion` sont deux alias acceptés pour la même colonne
- [ ] La pagination a un cap à 100 (`FILTERS.MAX_LIMIT`) — un client ne peut pas demander 10 000 lignes
- [ ] La normalisation des ingrédients accepte string (split sur ",") ET array — testé et robuste
- [ ] `softDelete()` ne supprime pas la ligne, met `deleted_at = NOW()` — l'UPDATE a `WHERE deleted_at IS NULL` pour l'idempotence
- [ ] `update()` construit le SET dynamiquement et retourne `findById()` pour un objet complet
- [ ] Les requêtes utilisent exclusivement des placeholders `?` — zéro concaténation SQL
- [ ] `RecipeController.deleteRecipe()` vérifie que l'utilisateur est admin OU auteur (403 sinon)
- [ ] Quand un admin supprime via la route publique, une `user_notifications` et un `admin_logs` sont créés
- [ ] `AdminController.deleteRecipe()` a la même protection (authenticate + requireAdmin sur la route)
- [ ] La route admin accepte un `reason` optionnel (max 255 chars, validé par express-validator)
