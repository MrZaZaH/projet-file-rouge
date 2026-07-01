# 09 — Système de Notation (Ratings)

## 1. CE QUE ÇA FAIT (vue d'ensemble)

Les utilisateurs connectés peuvent noter une recette de 1 à 5. Une seule note par utilisateur par recette (contrainte UNIQUE en base). Si l'utilisateur re-note, la note est mise à jour (UPDATE), pas dupliquée. Un utilisateur NE PEUT PAS noter sa propre recette. La notation déclenche la mise à jour de la moyenne dénormalisée sur la recette et l'attribution de points de gamification si la note est ≥ 4.

## 2. SCHÉMA DE LA TABLE

```sql
CREATE TABLE IF NOT EXISTS ratings (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    recipe_id       INT UNSIGNED NOT NULL,
    user_id         INT UNSIGNED NOT NULL,
    score           TINYINT UNSIGNED NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT chk_rating_score CHECK (score BETWEEN 1 AND 5),
    -- Vérification au niveau base : même si le code plante, on ne peut pas stocker 0 ou 6

    CONSTRAINT uq_rating_user_recipe UNIQUE (user_id, recipe_id),
    -- Verrou : un seul vote par utilisateur par recette

    CONSTRAINT fk_ratings_recipe
        FOREIGN KEY (recipe_id) REFERENCES recipes(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,

    CONSTRAINT fk_ratings_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE RESTRICT ON UPDATE CASCADE

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

(Source: `database/scripts/03_create_tables.sql:128-151`)

## 3. LE CODE

### 3.1 — Rating.rate() (`src/models/Rating.js:61`)

```javascript
static async rate({ userId, recipeId, score }) {
    // Import différé pour éviter la dépendance circulaire
    // Recipe importe connection.js, Rating importe Recipe — les deux ont besoin de pool
    const Recipe = require('./Recipe');
    const User = require('./User');

    // Étape 1 : l'utilisateur a-t-il déjà noté cette recette ?
    const existing = await Rating.findByUserAndRecipe(userId, recipeId);

    if (existing) {
        // === PATH UPDATE ===
        // L'utilisateur change sa note → on met à jour le score
        // ATTENTION : on ne recalcule PAS la moyenne ici (MVP simplification)
        // La moyenne dérive légèrement sur les updates — acceptable pour l'instant
        await pool.execute(
            `UPDATE ratings
             SET score = ?
             WHERE user_id = ? AND recipe_id = ?`,
            [score, userId, recipeId]
        );

        return {
            rating: { userId, recipeId, score },
            isNew: false,        // C'est une mise à jour, pas une création
            pointsAwarded: false  // Pas de points sur UPDATE (anti-farming)
        };
    }

    // === PATH INSERT ===
    // Première note de l'utilisateur pour cette recette
    // Si la contrainte UNIQUE (uq_rating_user_recipe) saute ici,
    // c'est qu'il y a eu une race condition — le controller catch ER_DUP_ENTRY
    await pool.execute(
        `INSERT INTO ratings (recipe_id, user_id, score)
         VALUES (?, ?, ?)`,
        [recipeId, userId, score]
    );

    // Étape 2 : mettre à jour la moyenne dénormalisée sur recipes
    await Recipe.updateRating(recipeId, score);

    // Étape 3 : gamification — +5 points à l'auteur si note >= 4
    let pointsAwarded = false;
    if (score >= 4) {
        const recipe = await Recipe.findById(recipeId);
        if (recipe) {
            await User.addPoints(recipe.user_id, 5);
            pointsAwarded = true;
        }
    }

    return {
        rating: { userId, recipeId, score },
        isNew: true,
        pointsAwarded
    };
}
```

### 3.2 — RatingController.rateRecipe() (`src/controllers/RatingController.js:15`)

```javascript
async function rateRecipe(req, res, next) {
    try {
        const recipeId = Number(req.params.recipeId);
        const userId = req.user.id;       // Authentifié obligatoire (route protégée)
        const score = Number(req.body.score);

        // Étape 1 : la recette existe et est publiée ?
        const recipe = await Recipe.findById(recipeId);
        if (!recipe || recipe.status !== 'published') {
            return sendError(res, 'Recipe not found.', 404);
        }

        // Étape 2 : auto-rating interdit
        if (recipe.user_id === userId) {
            return sendError(res, 'You cannot rate your own recipe.', 403);
        }

        // Étape 3 : création ou mise à jour de la note
        const result = await Rating.rate({ userId, recipeId, score });

        return sendSuccess(
            res,
            {
                rating: result.rating,
                isNew: result.isNew,
                pointsAwarded: result.pointsAwarded
            },
            result.isNew ? 'Rating created' : 'Rating updated',
            result.isNew ? 201 : 200
        );

    } catch (err) {
        // Race condition : deux requêtes simultanées pour la même note
        // La contrainte UNIQUE a empêché la double insertion
        if (err.code === 'ER_DUP_ENTRY') {
            return sendError(res, 'Rating conflict. Please retry.', 409);
        }
        next(err);
    }
}
```

### 3.3 — Routes (`src/routes/ratingRoutes.js`)

```javascript
const router = express.Router({ mergeParams: true });
// mergeParams: true est OBLIGATOIRE
// Sans ça, req.params.recipeId serait undefined car recipeId vient du parent
// (la route est montée sur /api/v1/recipes/:recipeId/ratings dans app.js)

const ratingRules = [
    body('score')
        .notEmpty().withMessage('Score is required.')
        .isInt({ min: 1, max: 5 }).withMessage('Score must be an integer between 1 and 5.'),
];

router.post('/', authenticate, ratingRules, validate, RatingController.rateRecipe);
// authenticate → utilisateur doit être connecté pour noter
```

### 3.4 — Montage dans app.js (`app.js:85`)

```javascript
app.use('/api/v1/recipes/:recipeId/ratings', ratingRoutes);
// Le :recipeId du chemin parent est accessible via mergeParams
```

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

```
1. Utilisateur connecté envoie POST /api/v1/recipes/42/ratings avec { score: 4 }
2. Express match la route → mergeParams expose req.params.recipeId = "42"
3. authenticate vérifie le JWT → req.user = { id: 7, role: "user" }
4. express-validator vérifie score : entier entre 1 et 5
5. RatingController.rateRecipe() :
   a. Recipe.findById(42) → recette existe ? status = 'published' ?
   b. recipe.user_id !== 7 ? (pas d'auto-rating ✓)
6. Rating.rate({ userId: 7, recipeId: 42, score: 4 }) :
   a. Rating.findByUserAndRecipe(7, 42) → déjà noté avant ?
   b. Si OUI → UPDATE ratings SET score = 4 WHERE user_id = 7 AND recipe_id = 42
      → retourne { isNew: false, pointsAwarded: false }
   c. Si NON → INSERT INTO ratings (recipe_id, user_id, score) VALUES (42, 7, 4)
      → Recipe.updateRating(42, 4) → recalcule la moyenne
      → score >= 4 ? User.addPoints(recipe.user_id, 5)
      → retourne { isNew: true, pointsAwarded: true }
7. Réponse JSON : { success: true, data: { rating: {...}, isNew: true, pointsAwarded: true } }
```

## 5. ANALOGIE

C'est comme un **cahier de notation dans un concours de cuisine amateur**. Chaque juge (utilisateur connecté) peut attribuer une note de 1 à 5 étoiles à un plat. Si le même juge goûte une seconde fois et change d'avis, il peut modifier sa note — la précédente est effacée. Un juge ne peut pas noter son propre plat (conflit d'intérêts). La note est stockée sur une feuille dédiée (table ratings) avec la mention "UNIQUE : un juge, un plat, une note".

## 6. PIÈGES CLASSIQUES

### Piège #1 : Permettre l'auto-notation

**MAUVAIS** — pas de vérification :
```javascript
const result = await Rating.rate({ userId, recipeId, score });
// L'utilisateur peut noter sa propre recette → triche
```

**BON** — bloquer au niveau controller :
```javascript
if (recipe.user_id === userId) {
    return sendError(res, 'You cannot rate your own recipe.', 403);
}
```

### Piège #2 : Ignorer la race condition sur l'INSERT

**MAUVAIS** — pas de gestion d'erreur :
```javascript
await pool.execute(
    'INSERT INTO ratings (recipe_id, user_id, score) VALUES (?, ?, ?)',
    [recipeId, userId, score]
);
// Si deux requêtes arrivent en même temps → ER_DUP_ENTRY → 500
```

**BON** — `catch` spécifique avec code 409 (Conflict) :
```javascript
catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
        return sendError(res, 'Rating conflict. Please retry.', 409);
    }
    next(err);
}
```

## 7. ET SI ON FAISAIT AUTREMENT ?

### Option A : Remplacer UNIQUE par une vérification applicative
- **Comment ça marche** : SELECT avant chaque INSERT, pas de contrainte UNIQUE.
- **Avantage** : message d'erreur plus clair.
- **Inconvénient** : race condition toujours possible (SELECT + INSERT = deux opérations), pas de filet de sécurité.
- **Notre cas** : la contrainte UNIQUE est le vrai garde-fou. La vérification applicative (findByUserAndRecipe) + le catch ER_DUP_ENTRY = double protection.

### Option B : UPSERT (INSERT ON DUPLICATE KEY UPDATE)
- **Comment ça marche** : `INSERT INTO ratings (...) VALUES (...) ON DUPLICATE KEY UPDATE score = VALUES(score)`
- **Avantage** : une seule requête au lieu de SELECT + INSERT/UPDATE.
- **Inconvénient** : plus difficile à lire, et on perd la distinction "nouvelle note" vs "mise à jour" (important pour la gamification).
- **Notre cas** : le SELECT explicite permet de savoir si c'est nouveau (points à attribuer) ou update.

## 8. CHECKLIST POUR LE JURY

- [ ] Table `ratings` avec CHECK (score BETWEEN 1 AND 5) et UNIQUE (user_id, recipe_id)
- [ ] La notation nécessite un utilisateur authentifié (`authenticate` middleware)
- [ ] Auto-rating interdit au niveau controller : `recipe.user_id !== userId` → 403
- [ ] `Rating.rate()` check d'abord si une note existe (`findByUserAndRecipe`) → UPDATE ou INSERT
- [ ] Race condition gérée : `catch (err.code === 'ER_DUP_ENTRY')` → 409 Conflict
- [ ] Les routes utilisent `mergeParams: true` pour accéder au `recipeId` du parent
- [ ] Score validé par express-validator : `isInt({ min: 1, max: 5 })`
