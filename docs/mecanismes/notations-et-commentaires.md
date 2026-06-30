# Mécanisme : Notation et Commentaires

## Architecture générale

Deux entités complètement indépendantes en BDD, deux routes API distinctes, mais un seul formulaire frontend pour l'UX.

```
BDD : ratings  ── indépendant ── comments
       │                            │
       ▼                            ▼
API : POST /ratings (auth)    POST /comments (auth optionnelle)
       │                            │
       └───────── UI ───────────────┘
                Formulaire unique
```

---

## 1. Tables BDD

### `ratings`

```sql
id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY
recipe_id   INT UNSIGNED NOT NULL
user_id     INT UNSIGNED NOT NULL
score       TINYINT UNSIGNED NOT NULL  -- CHECK (score BETWEEN 1 AND 5)
created_at  DATETIME
updated_at  DATETIME

UNIQUE KEY uq_rating_user_recipe (user_id, recipe_id)
```

- **Contrainte UNIQUE** : garantit qu'un utilisateur ne peut noter une recette qu'une seule fois. C'est le verrou physique en base.
- **CHECK score** : double sécurité avec la validation express-validator côté applicatif.

### `comments`

```sql
id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY
recipe_id   INT UNSIGNED NOT NULL
user_id     INT UNSIGNED NULL          -- NULL pour les invités
guest_name  VARCHAR(50) NULL           -- NULL pour les connectés
content     TEXT NOT NULL
created_at  DATETIME
updated_at  DATETIME
deleted_at  DATETIME NULL              -- soft delete
```

- `user_id` nullable → les invités peuvent commenter sans compte.
- `guest_name` nullable → ignoré si `user_id` est renseigné.
- `deleted_at` pour le soft delete (les commentaires ne sont jamais vraiment supprimés).

### `recipes` (colonnes dénormalisées)

```sql
average_rating  DECIMAL(3,2) DEFAULT 0.00   -- moyenne pré-calculée
rating_count    SMALLINT UNSIGNED DEFAULT 0  -- nombre de votes
```

- **Pourquoi dénormaliser ?** Éviter un `AVG(score) FROM ratings WHERE recipe_id = ?` coûteux à chaque affichage de page.
- **Inconvénient** : la moyenne doit être mise à jour manuellement à chaque nouveau vote → `Recipe.updateRating()` (`src/models/Recipe.js:786`).

---

## 2. Routes API

### POST `/api/v1/recipes/:recipeId/ratings`

| Détail | Valeur |
|---|---|
| Auth | Obligatoire (`authenticate` middleware) |
| Body | `{ score: 1-5 }` |
| Validation | `score` requis, entier entre 1 et 5 |

**Fichiers :**
- Route : `src/routes/ratingRoutes.js`
- Controller : `src/controllers/RatingController.js`
- Model : `src/models/Rating.js`

**Comportement :**
1. Vérifie que la recette existe et est publiée
2. Vérifie que l'utilisateur ne note pas sa propre recette → 403
3. Appelle `Rating.rate()` qui :
   - Vérifie si l'utilisateur a déjà noté (`findByUserAndRecipe`)
   - Si oui → UPDATE (sans recalcul de moyenne, sans gamification)
   - Si non → INSERT + `Recipe.updateRating()` + gamification si score ≥ 4

### POST `/api/v1/recipes/:recipeId/comments`

| Détail | Valeur |
|---|---|
| Auth | Optionnelle (`attachUser` middleware) |
| Body | `{ content, guest_name? }` |
| Validation | `content` requis, `guest_name` requis si pas de token |

**Fichiers :**
- Route : `src/routes/commentRoutes.js`
- Controller : `src/controllers/CommentController.js`
- Model : `src/models/comment.js`

**Comportement :**
1. Vérifie que la recette existe et est publiée
2. Si `req.user` présent → utilise `user_id`, ignore `guest_name`
3. Si `req.user` absent → utilise `guest_name`, laisse `user_id` NULL
4. Insère le commentaire en BDD

---

## 3. Flux frontend (detail.js)

### Formulaire unique, deux appels API

Dans `frontend/public/js/detail.js:164-227`, `handleCommentSubmit()` :

1. **Récupère les données du formulaire** (lignes 166-172)
   ```javascript
   var formData = new FormData(form);
   var data = Object.fromEntries(formData.entries());
   var pseudo = data.pseudo && data.pseudo.trim();
   var comment = data.comment && data.comment.trim();
   var rating = data.rating;
   ```

2. **Valide** : pseudo requis si invité, commentaire ≥ 3 caractères (lignes 174-181)

3. **Soumet la note** (si conditions remplies, lignes 191-200)
   ```javascript
   if (isAuthed && rating) {  // ← NOTATION OPTIONNELLE
       var score = parseInt(rating, 10);
       if (score >= 1 && score <= 5) {
           await submitRating(recipeId, score);
       }
   }
   ```
   - `isAuthed && rating` : seulement si connecté **et** a cliqué sur une étoile
   - Si pas coché → `rating` est `undefined` → la condition est fausse → pas d'appel API
   - Le `catch` silencieux (`console.warn`) évite de bloquer le commentaire si la note échoue

4. **Soumet le commentaire** (lignes 202-205)
   ```javascript
   await submitComment(recipeId, {
       comment: data.comment,
       pseudo: pseudo || data.pseudo
   });
   ```

5. **Reset et re-render** (lignes 207-215) : vide le formulaire, recharge la recette, met à jour l'affichage de la moyenne et des commentaires

### Fonctions utilitaires

- `submitRating(recipeId, score)` : `frontend/public/js/detail.js:49-63`
  - `POST /api/v1/recipes/${recipeId}/ratings` avec Bearer token
  - Body : `{ score }`

- `submitComment(recipeId, formData)` : `frontend/public/js/detail.js:24-47`
  - `POST /api/v1/recipes/${recipeId}/comments`
  - Body : `{ content, guest_name? }` selon que l'utilisateur est connecté ou non
  - Token optionnel (selon connexion)

---

## 4. Gestion des doublons (3 niveaux de protection)

### Niveau 1 — Base de données

```sql
UNIQUE KEY uq_rating_user_recipe (user_id, recipe_id)
```

Empêche physiquement deux lignes pour le même couple (user, recipe). Si le niveau applicatif rate un doublon (race condition), la DB rejette l'insertion → `ER_DUP_ENTRY`.

### Niveau 2 — Application

`src/models/Rating.js:66` :
```javascript
const existing = await Rating.findByUserAndRecipe(userId, recipeId);
if (existing) {
    // UPDATE path
}
// Sinon → INSERT path
```

### Niveau 3 — Controller (race condition)

`src/controllers/RatingController.js:48-51` :
```javascript
if (err.code === 'ER_DUP_ENTRY') {
    return sendError(res, 'Rating conflict. Please retry.', 409);
}
```

Deux requêtes simultanées du même utilisateur peuvent passer findByUserAndRecipe en même temps → les deux tentent un INSERT → la contrainte UNIQUE bloque la seconde → le controller renvoie 409 au lieu d'un crash.

---

## 5. Mise à jour de la moyenne dénormalisée

`src/models/Recipe.js:786-798` :

```javascript
static async updateRating(id, newScore) {
    const [result] = await pool.execute(
        `UPDATE recipes
         SET average_rating = ROUND(
                 (average_rating * rating_count + ?) / (rating_count + 1),
             2),
             rating_count   = rating_count + 1
         WHERE id = ?
           AND deleted_at IS NULL`,
        [newScore, id]
    );
    return result.affectedRows > 0;
}
```

**Formule :**
```
new_average = ROUND((old_average × old_count + newScore) / (old_count + 1), 2)
```

- Fonctionne UNIQUEMENT pour un INSERT (premier vote). En cas d'UPDATE (révision de note), le calcul serait inexact car on ne "retire" pas l'ancien score.
- **Décision** : on n'autorise pas la modification de note (une fois noté, c'est définitif). Une révision impacterait la moyenne ET le farming de points.
- **Race condition** : la formule lit `average_rating` et `rating_count` puis écrit la nouvelle valeur dans une seule opération atomique. Si deux INSERT simultanés appellent `updateRating` en même temps avec la même valeur initiale, un des deux incréments sera perdu. Solution (post-MVP) : utiliser `SELECT ... FOR UPDATE` ou une transaction.

---

## 6. Gamification

`src/models/Rating.js:106-117` :

```javascript
let pointsAwarded = false;
if (score >= 4) {
    const recipe = await Recipe.findById(recipeId);
    if (recipe) {
        await User.addPoints(recipe.user_id, 5);
        pointsAwarded = true;
    }
}
```

- **Déclencheur** : premier vote (INSERT) avec score ≥ 4
- **Bénéficiaire** : l'auteur de la recette, pas le votant
- **Points** : +5
- **Pourquoi** : on récompense le contenu de qualité, pas l'acte de voter
- **Pourquoi pas sur UPDATE** : un utilisateur pourrait farmer des points en changeant son score en boucle
- **Limitation** : pas d'atomicité transactionnelle → si le serveur crash entre l'INSERT et `User.addPoints`, les points sont perdus. Solution (post-MVP) : wrapper dans une transaction SQL.

---

## 7. Sécurité

| Mesure | Où | Détail |
|---|---|---|
| Requêtes paramétrées | Tous les models | Zéro concaténation SQL |
| Validation score | `ratingRoutes.js:15-18` | `isInt({ min: 1, max: 5 })` |
| Validation contenu | `commentRoutes.js:41-53` | `content` ≤ 1000 chars, `guest_name` ≤ 50 |
| Auth sur ratings | `ratingRoutes.js:28` | Middleware `authenticate` → 401 si pas de token |
| Auth optionnelle sur comments | `commentRoutes.js:65` | Middleware `attachUser` → continue sans token |
| Auto-rating interdit | `RatingController.js:29-31` | 403 si `recipe.user_id === userId` |
| Doublon en base | Table ratings | `UNIQUE KEY uq_rating_user_recipe` |
| CHECK en base | Table ratings | `score BETWEEN 1 AND 5` |

---

## 8. Relations clés (ce qu'il faut retenir pour le jury)

1. **Deux entités indépendantes** : `ratings` et `comments` sont des tables séparées, sans clé étrangère entre elles.
2. **Deux routes API distinctes** :
   - `/ratings` → auth obligatoire (besoin d'un `user_id` stable pour la contrainte UNIQUE)
   - `/comments` → auth optionnelle (les invités peuvent commenter)
3. **Un seul formulaire frontend** : l'UI les regroupe pour l'expérience utilisateur, mais les soumet en deux appels séquencés.
4. **La note n'est pas un champ du commentaire** : un commentaire n'a pas de note, une note n'a pas de commentaire.
5. **La note est optionnelle** : un utilisateur connecté peut commenter sans noter (condition `isAuthed && rating` en ligne 191).
6. **Pas de notation pour les invités** : sans `user_id` stable, impossible d'appliquer la contrainte UNIQUE → pas de rating possible.
7. **Dénormalisation assumée** : `average_rating` et `rating_count` sur `recipes` évitent des calculs coûteux mais imposent une mise à jour manuelle à chaque vote.
8. **Gamification** : +5 points à l'auteur si score ≥ 4, uniquement sur le premier vote (pas de farming).
