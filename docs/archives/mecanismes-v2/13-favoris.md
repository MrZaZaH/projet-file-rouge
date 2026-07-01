# 13 — Favoris (Toggle Bookmark)

## 1. CE QUE ÇA FAIT (vue d'ensemble)

Un utilisateur connecté peut ajouter ou retirer une recette de ses favoris avec un seul bouton. C'est un **toggle** : si la recette est déjà en favori, on la supprime ; sinon, on l'ajoute. Pas de route "ajouter" et "supprimer" séparées — une seule route POST qui fait SELECT → DELETE ou INSERT selon l'état actuel. La réponse retourne `{ favorited: true/false }` pour que le frontend mette à jour l'icône sans recharger la page.

## 2. SCHÉMA DE LA TABLE

```sql
CREATE TABLE IF NOT EXISTS favorites (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED NOT NULL,
    recipe_id       INT UNSIGNED NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_favorite_user_recipe UNIQUE (user_id, recipe_id),
    -- Un utilisateur ne peut pas ajouter deux fois la même recette

    CONSTRAINT fk_favorites_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    -- CASCADE : si l'utilisateur supprime son compte, ses favoris disparaissent

    CONSTRAINT fk_favorites_recipe
        FOREIGN KEY (recipe_id) REFERENCES recipes(id)
        ON DELETE CASCADE ON UPDATE CASCADE
    -- CASCADE : si la recette est supprimée (hard delete = pas notre cas),
    -- les favoris correspondants sont nettoyés automatiquement
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_favorites_user_id ON favorites(user_id);
CREATE INDEX idx_favorites_recipe_id ON favorites(recipe_id);
```

(Source: `database/scripts/07_create_favorites_table.sql`)

## 3. LE CODE

### 3.1 — Favorite.toggle() (`src/models/Favorite.js:8`)

```javascript
static async toggle(userId, recipeId) {
    try {
        // Étape 1 : VÉRIFIER si le favori existe déjà
        const [existing] = await pool.execute(
            'SELECT id FROM favorites WHERE user_id = ? AND recipe_id = ?',
            [userId, recipeId]
        );

        if (existing.length > 0) {
            // Étape 2A : IL EXISTE → on le supprime (toggle OFF)
            await pool.execute(
                'DELETE FROM favorites WHERE user_id = ? AND recipe_id = ?',
                [userId, recipeId]
            );
            return { favorited: false };
            // L'utilisateur a "dé-favorisé" la recette
        }

        // Étape 2B : IL N'EXISTE PAS → on le crée (toggle ON)
        await pool.execute(
            'INSERT INTO favorites (user_id, recipe_id) VALUES (?, ?)',
            [userId, recipeId]
        );
        return { favorited: true };
        // L'utilisateur a "favorisé" la recette

    } catch (error) {
        logger.error(`Favorite.toggle(${userId}, ${recipeId}) failed: ${error.message}`);
        throw error;
    }
}
```

### 3.2 — Favorite.isFavorited() (`src/models/Favorite.js:77`)

```javascript
// Vérifie si une recette est en favori pour un utilisateur donné
// Utilisé par RecipeController.getRecipeById() pour renseigner le champ
// is_favorited dans la réponse de détail
static async isFavorited(userId, recipeId) {
    try {
        const [rows] = await pool.execute(
            'SELECT id FROM favorites WHERE user_id = ? AND recipe_id = ?',
            [userId, recipeId]
        );
        return rows.length > 0;
        // true si un favori existe, false sinon
    } catch (error) {
        logger.error(`Favorite.isFavorited(${userId}, ${recipeId}) failed: ${error.message}`);
        throw error;
    }
}
```

### 3.3 — Favorite.findByUserId() (`src/models/Favorite.js:35`)

```javascript
// Récupère tous les favoris d'un utilisateur (avec les données des recettes)
static async findByUserId(userId) {
    try {
        const query = `
            SELECT
                r.id,
                r.title,
                r.prep_time,
                r.cost_per_portion,
                r.average_rating,
                r.rating_count,
                r.image_url,
                u.username AS author,
                f.created_at AS favorited_at
            FROM favorites f
            JOIN recipes r ON f.recipe_id = r.id
            JOIN users u ON r.user_id = u.id
            WHERE f.user_id = ?
              AND r.deleted_at IS NULL
              AND r.status = 'published'
            ORDER BY f.created_at DESC
        `;
        // JOIN recipes : on récupère les infos des recettes favorisées
        // JOIN users : on récupère le nom de l'auteur
        // WHERE r.deleted_at IS NULL : pas de recettes soft-deleted
        // WHERE r.status = 'published' : pas de recettes en attente/rejetées

        const [rows] = await pool.execute(query, [userId]);

        return rows.map(row => ({
            id: row.id,
            title: row.title,
            prep_time: row.prep_time,
            cost_per_portion: parseFloat(row.cost_per_portion),
            average_rating: parseFloat(row.average_rating),
            rating_count: row.rating_count,
            image_url: row.image_url,
            author: row.author,
            favorited_at: row.favorited_at,
        }));

    } catch (error) {
        logger.error(`Favorite.findByUserId(${userId}) failed: ${error.message}`);
        throw error;
    }
}
```

### 3.4 — FavoriteController.toggle() (`src/controllers/FavoriteController.js:9`)

```javascript
static async toggle(req, res, next) {
    try {
        const userId = Number(req.user.id);
        const recipeId = Number(req.params.recipeId);

        // Validation : l'ID doit être un nombre valide
        if (!recipeId || recipeId < 1) {
            return sendError(res, 'Invalid recipe ID', 400);
        }

        // Vérification : la recette doit exister
        const recipe = await Recipe.findById(recipeId);
        if (!recipe) {
            return sendError(res, 'Recipe not found', 404);
        }

        // Toggle : SELECT → DELETE ou INSERT
        const result = await Favorite.toggle(userId, recipeId);

        return sendSuccess(res, {
            favorited: result.favorited,
            recipe_id: recipeId,
        });

    } catch (error) {
        next(error);
    }
}

// Récupère la liste des favoris de l'utilisateur connecté
static async getMyFavorites(req, res, next) {
    try {
        const userId = Number(req.user.id);
        const favorites = await Favorite.findByUserId(userId);
        return sendSuccess(res, favorites);
    } catch (error) {
        next(error);
    }
}
```

### 3.5 — Routes (`src/routes/favoriteRoutes.js`)

```javascript
const { Router } = require('express');
const { authenticate } = require('../middlewares/jwtAuth');
const FavoriteController = require('../controllers/FavoriteController');

const router = Router();

// GET /api/v1/favorites — liste des favoris de l'utilisateur connecté
router.get('/', authenticate, FavoriteController.getMyFavorites);
// POST /api/v1/favorites/:recipeId — toggle favori
router.post('/:recipeId', authenticate, FavoriteController.toggle);

module.exports = router;
```

### 3.6 — is_favorited dans le détail recette (`src/controllers/RecipeController.js:86`)

```javascript
// Dans getRecipeById() :
// Si l'utilisateur est connecté, on attache le statut is_favorited
if (req.user) {
    recipe.is_favorited = await Favorite.isFavorited(req.user.id, recipe.id);
}
// Le frontend reçoit : { ..., is_favorited: true/false }
// pour pré-afficher le bouton "Sauvegardée" ou "Sauvegarder"
```

### 3.7 — Frontend toggleFavorite() (`frontend/public/js/detail.js:255`)

```javascript
async function toggleFavorite() {
    // Si pas connecté → ouvre la modale de connexion
    if (!isAuthenticated()) {
        openLoginModal();
        return;
    }

    var btn = document.getElementById('btn-save');
    var originalText = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = '...';

    try {
        // Appel POST /api/v1/favorites/:recipeId
        var result = await apiRequest('/favorites/' + recipe.id, { method: 'POST' });
        // apiRequest est défini dans auth.js — il gère le token automatiquement

        // Met à jour l'état local avec la réponse
        recipe.is_favorited = result.favorited;
        updateSaveButton();

    } catch (err) {
        alert(err.message || 'Erreur lors de la sauvegarde.');
    } finally {
        btn.disabled = false;
    }
}

function updateSaveButton() {
    var btn = document.getElementById('btn-save');
    if (!btn) return;
    if (recipe.is_favorited) {
        btn.innerHTML = '<svg>...</svg> Sauvegardée';
        btn.classList.add('is-saved');
    } else {
        btn.innerHTML = '<svg>...</svg> Sauvegarder';
        btn.classList.remove('is-saved');
    }
}

// Dans initEventListeners() :
document.getElementById('btn-save').addEventListener('click', toggleFavorite);
```

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

**Premier clic (ajouter) :**
```
1. Utilisateur connecté clique "Sauvegarder"
2. toggleFavorite() → POST /api/v1/favorites/42
3. authenticate → vérifie JWT → req.user = { id: 7 }
4. FavoriteController.toggle() :
   a. Recipe.findById(42) → recette existe ✓
   b. Favorite.toggle(7, 42) :
      - SELECT id FROM favorites WHERE user_id = 7 AND recipe_id = 42 → []
      - Aucun résultat → INSERT INTO favorites (user_id, recipe_id) VALUES (7, 42)
      - Retourne { favorited: true }
5. Réponse : { success: true, data: { favorited: true, recipe_id: 42 } }
6. updateSaveButton() → icône remplie + texte "Sauvegardée"
```

**Second clic (retirer) :**
```
1. Même utilisateur clique "Sauvegardée"
2. Favorite.toggle(7, 42) :
   - SELECT id FROM favorites WHERE user_id = 7 AND recipe_id = 42 → [{ id: 5 }]
   - Résultat trouvé → DELETE FROM favorites WHERE user_id = 7 AND recipe_id = 42
   - Retourne { favorited: false }
3. Réponse : { success: true, data: { favorited: false, recipe_id: 42 } }
4. updateSaveButton() → icône vide + texte "Sauvegarder"
```

## 5. ANALOGIE

C'est comme un **marque-page dans un livre de cuisine communautaire**. Tu peux bookmarker une recette d'un simple clic sur un signet. Si le signet est déjà là, tu l'enlèves. Pas de "ajouter aux favoris" et "retirer des favoris" séparés — un seul geste qui fait les deux selon l'état. Sur la page détail, le signet est pré-rempli (rempli ou vide) selon que tu l'as déjà bookmarké ou pas.

## 6. PIÈGES CLASSIQUES

### Piège #1 : Deux routes séparées (POST + DELETE) au lieu d'un toggle

**MAUVAIS** — lourdeur côté frontend :
```javascript
// Frontend doit gérer deux appels différents
if (isFavorited) {
    await fetch('/api/v1/favorites/42', { method: 'DELETE' });
} else {
    await fetch('/api/v1/favorites/42', { method: 'POST' });
}
```

**BON** — une seule route qui décide :
```javascript
// Un seul appel, c'est le modèle qui fait le SELECT → DELETE ou INSERT
const result = await apiRequest('/favorites/' + recipe.id, { method: 'POST' });
```

### Piège #2 : Oublier de vérifier que la recette existe avant d'ajouter

**MAUVAIS** — on peut favoriser une recette inexistante :
```javascript
static async toggle(userId, recipeId) {
    const [existing] = await pool.execute(
        'SELECT id FROM favorites WHERE user_id = ? AND recipe_id = ?',
        [userId, recipeId]
    );
    // Si existing = [] et recipe_id = 9999 → on crée un favori sur une recette qui n'existe pas
    // Le FK fk_favorites_recipe empêche ça, mais avec une erreur 500
}
```

**BON** — vérifier avant :
```javascript
// Dans le controller
const recipe = await Recipe.findById(recipeId);
if (!recipe) {
    return sendError(res, 'Recipe not found', 404);
}
```

## 7. ET SI ON FAISAIT AUTREMENT ?

### Option A : UPSERT avec un champ "active" (soft delete individuel)
- **Comment ça marche** : au lieu de DELETE/INSERT, on fait `INSERT ... ON DUPLICATE KEY UPDATE active = NOT active`.
- **Avantage** : conservation de l'historique (date de création originale).
- **Inconvénient** : besoin d'une colonne supplémentaire `active`, l'UPSERT est moins lisible.
- **Notre cas** : le DELETE/INSERT est simple et efficace. La table favorites est une table de relation, pas de données critiques.

### Option B : Une table avec état (favorited = true/false) et date de mise à jour
- **Comment ça marche** : `INSERT INTO favorites (...) VALUES (...) ON DUPLICATE KEY UPDATE deleted_at = IF(deleted_at IS NULL, NOW(), NULL)` — toggle via soft delete.
- **Avantage** : rangement + historique.
- **Inconvénient** : complexité inutile pour un toggle.
- **Notre cas** : DELETE/INSERT est le pattern le plus idiomatique pour un toggle.

## 8. CHECKLIST POUR LE JURY

- [ ] Table `favorites` avec contrainte UNIQUE (user_id, recipe_id) et FK CASCADE sur les deux
- [ ] `Favorite.toggle()` : SELECT → si existe DELETE, sinon INSERT — une seule méthode pour les deux actions
- [ ] `Favorite.isFavorited()` : vérifie l'existence d'un favori (booléen) — utilisé dans le détail recette
- [ ] `Favorite.findByUserId()` : liste des favoris avec JOIN recettes, filtré par `deleted_at IS NULL` et `status = 'published'`
- [ ] `RecipeController.getRecipeById()` attache `is_favorited` si l'utilisateur est connecté (ligne 86-88)
- [ ] Le controller vérifie que la recette existe avant le toggle
- [ ] Frontend : `apiRequest` (POST /favorites/:id) + `updateSaveButton()` pour le rendu immédiat
- [ ] Route protégée par `authenticate` — les invités voient la modale de connexion (detail.js:256-258)
