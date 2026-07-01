# 12 — Commentaires (Invités + Utilisateurs)

## 1. CE QUE ÇA FAIT (vue d'ensemble)

Les commentaires sont ouverts à tout le monde, sans obligation de compte. Un utilisateur connecté poste avec son user_id ; un invité doit fournir un guest_name. La validation est conditionnelle : si l'utilisateur est connecté, guest_name n'est pas requis et est ignoré. Les commentaires utilisent le soft delete. Les routes sont montées avec `mergeParams: true` pour accéder au recipeId du parent.

## 2. SCHÉMA DE LA TABLE

```sql
CREATE TABLE IF NOT EXISTS comments (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    recipe_id       INT UNSIGNED NOT NULL,
    user_id         INT UNSIGNED NULL DEFAULT NULL,
    -- NULL = commentaire invité (pas de compte requis)
    guest_name      VARCHAR(100) NULL DEFAULT NULL,
    -- Rempli uniquement si user_id IS NULL
    content         TEXT NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at      DATETIME NULL DEFAULT NULL,

    CONSTRAINT fk_comments_recipe
        FOREIGN KEY (recipe_id) REFERENCES recipes(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,

    CONSTRAINT fk_comments_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
    -- SET NULL : si l'utilisateur supprime son compte,
    -- ses commentaires restent mais perdent le lien user_id
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

(Source: `database/scripts/03_create_tables.sql:99-120`)

## 3. LE CODE

### 3.1 — Comment.create() (`src/models/Comment.js:30`)

```javascript
static async create(data) {
    // Validation : contenu minimum 3 caractères
    if (data.content && data.content.trim().length < 3) {
        throw new Error('Content must be at least 3 characters');
    }
    if (!data.content || data.content.trim() === '') {
        throw new Error('Content is required');
    }

    // Validation conditionnelle :
    // SI pas de user_id → guest_name OBLIGATOIRE
    if (!data.user_id && (!data.guest_name || data.guest_name.trim() === '')) {
        throw new Error('A name is required to comment as a guest');
    }

    const isGuest = !data.user_id;

    try {
        const [result] = await pool.execute(
            `INSERT INTO comments (recipe_id, user_id, guest_name, content, created_at)
             VALUES (?, ?, ?, ?, NOW())`,
            [
                data.recipe_id,
                data.user_id || null,
                // Si invité → envoie le guest_name ; si connecté → NULL
                isGuest ? data.guest_name.trim() : null,
                data.content.trim()
            ]
        );

        // Le pseudo affiché dépend du type d'utilisateur
        const pseudo = isGuest
            ? data.guest_name.trim()         // Invité : son nom
            : (data.username || 'Utilisateur'); // Connecté : son username

        return {
            id: result.insertId,
            recipe_id: data.recipe_id,
            pseudo: pseudo,
            content: data.content.trim(),
            created_at: new Date()
        };

    } catch (error) {
        // FK violation : recipe_id n'existe pas
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            throw new Error('Recipe not found');
        }
        throw error;
    }
}
```

### 3.2 — Comment.findByRecipeId() (`src/models/Comment.js:7`)

```javascript
static async findByRecipeId(recipeId) {
    const [rows] = await pool.execute(
        `SELECT c.id, c.recipe_id, c.user_id, c.guest_name, c.content, c.created_at,
                u.username AS user_pseudo
         FROM comments c
         LEFT JOIN users u ON c.user_id = u.id
         WHERE c.recipe_id = ?
           AND c.deleted_at IS NULL
         ORDER BY c.created_at DESC`,
        [recipeId]
    );

    // Mapping : chaque commentaire a un pseudo, qu'il soit connecté ou invité
    return rows.map(function(row) {
        return {
            id: row.id,
            recipe_id: row.recipe_id,
            pseudo: row.user_pseudo || row.guest_name || 'Anonyme',
            // Ordre de priorité : 1) username du user connecté
            //                      2) guest_name de l'invité
            //                      3) 'Anonyme' si les deux sont vides (ne devrait pas arriver)
            content: row.content,
            created_at: row.created_at
        };
    });
}
```

### 3.3 — CommentController (`src/controllers/CommentController.js`)

```javascript
// GET les commentaires d'une recette
async function getCommentsByRecipe(req, res, next) {
    try {
        const recipeId = Number(req.params.recipeId);
        const recipe = await Recipe.findById(recipeId);
        if (!recipe || recipe.status !== 'published') {
            return sendError(res, 'Recipe not found.', 404);
        }
        const comments = await Comment.findByRecipeId(recipeId);
        return sendSuccess(res, comments);
    } catch (err) {
        next(err);
    }
}

// POST créer un commentaire
async function createComment(req, res, next) {
    try {
        const recipeId = Number(req.params.recipeId);
        const recipe = await Recipe.findById(recipeId);
        if (!recipe || recipe.status !== 'published') {
            return sendError(res, 'Recipe not found.', 404);
        }

        // Logique connecté vs invité :
        const userId = req.user?.id || null;
        const guestName = userId ? null : req.body.guest_name;
        // Si connecté → userId, guestName = null
        // Si invité → userId = null, guestName = body.guest_name

        const comment = await Comment.create({
            recipe_id: recipeId,
            user_id: userId,
            guest_name: guestName,
            username: req.user?.username || null,
            content: req.body.content,
        });

        return sendSuccess(res, comment, 'Comment created', 201);
    } catch (err) {
        next(err);
    }
}

// DELETE (soft delete) — admin ou auteur seulement
async function deleteComment(req, res, next) {
    try {
        const commentId = Number(req.params.id);
        const recipeId = Number(req.params.recipeId);

        const comments = await Comment.findByRecipeId(recipeId);
        const comment = comments.find(c => c.id === commentId);
        if (!comment) {
            return sendError(res, 'Comment not found.', 404);
        }

        const isAdmin = req.user.role === 'admin';
        const isAuthor = comment.user_id === req.user.id;
        if (!isAdmin && !isAuthor) {
            return sendError(res, 'Forbidden.', 403);
        }

        await Comment.softDelete(commentId);
        return sendSuccess(res, null, 'Comment deleted');
    } catch (err) {
        next(err);
    }
}
```

### 3.4 — Routes avec mergeParams (`src/routes/commentRoutes.js`)

```javascript
const router = express.Router({ mergeParams: true });
// mergeParams: true est obligatoire pour accéder à req.params.recipeId
// Sans ça, recipeId est "perdu" car il vient du route parent dans app.js

// ─── attachUser : version "soft" de authenticate ─────────────────
// Ne BLOQUE PAS la requête si le token est absent.
// Utile pour que les invités puissent poster sans token.
const jwt = require('jsonwebtoken');

function attachUser(req, _res, next) {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
        try {
            const token = header.slice(7);
            req.user = jwt.verify(token, process.env.JWT_SECRET);
        } catch {
            // Token invalide → on continue comme invité, on bloque pas
            req.user = undefined;
        }
    }
    next();
}

// ─── Validation conditionnelle ────────────────────────────────────
const commentRules = [
    body('content')
        .trim()
        .notEmpty().withMessage('Content is required.')
        .isLength({ max: 1000 }).withMessage('Content must be under 1000 characters.'),

    body('guest_name')
        .if((_, { req }) => !req.user)
        // .if() = validation conditionnelle d'express-validator
        // SI l'utilisateur n'est PAS connecté → guest_name devient obligatoire
        // SI l'utilisateur EST connecté → on ignore complètement guest_name
        .trim()
        .notEmpty().withMessage('A name is required to comment as a guest.')
        .isLength({ max: 50 }).withMessage('Name must be under 50 characters.'),
];

// ─── Routes ───────────────────────────────────────────────────────
router.get('/', CommentController.getCommentsByRecipe);
router.post('/', attachUser, commentRules, validate, CommentController.createComment);
//  ^^^^^^^^^^ attachUser au lieu de authenticate — les invités sont autorisés

router.delete('/:id', authenticate, CommentController.deleteComment);
//  ^^^^^^^^^^ authenticate est requis — seuls les connectés peuvent supprimer
```

### 3.5 — Montage dans app.js (`app.js:84`)

```javascript
app.use('/api/v1/recipes/:recipeId/comments', commentRoutes);
// Le :recipeId du chemin parent est transmis aux routes filles via mergeParams
```

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

**Scénario invité (pas de compte) :**
```
1. Invité remplit le formulaire : pseudo="Marcel", commentaire="Super recette !"
2. POST /api/v1/recipes/42/comments avec body: { guest_name: "Marcel", content: "Super recette !" }
3. attachUser : pas de token → req.user = undefined
4. express-validator : req.user absent → guest_name validé (non vide, ≤ 50 chars)
5. createComment : userId = null, guestName = "Marcel"
6. INSERT INTO comments (recipe_id, user_id, guest_name, content) VALUES (42, NULL, "Marcel", "Super recette !")
7. Retourne { pseudo: "Marcel", content: "Super recette !" }
```

**Scénario utilisateur connecté :**
```
1. Utilisateur connecté (token valide) commente
2. POST /api/v1/recipes/42/comments avec body: { content: "Excellent !" }
   (guest_name absent du body — pas besoin)
3. attachUser : token valide → req.user = { id: 7, username: "ChefLucas" }
4. express-validator : req.user présent → guest_name ignoré (pas de validation)
5. createComment : userId = 7, guestName = null
6. INSERT INTO comments (recipe_id, user_id, guest_name, content) VALUES (42, 7, NULL, "Excellent !")
7. Retourne { pseudo: "ChefLucas", content: "Excellent !" }
```

## 5. ANALOGIE

C'est comme un **livre d'or dans une auberge**. N'importe qui peut écrire un mot — pas besoin d'être membre. Si tu es un habitué (connecté), on sait qui tu es et on écrit ton nom automatiquement. Si tu es de passage (invité), tu écris ton pseudo toi-même. On peut effacer un commentaire (soft delete) si l'auteur le demande ou si le propriétaire (admin) le juge inapproprié — mais on ne le brûle pas vraiment, on met juste un "x" dessus au crayon.

## 6. PIÈGES CLASSIQUES

### Piège #1 : Oublier mergeParams: true

**MAUVAIS** — `req.params.recipeId` est undefined :
```javascript
const router = express.Router();  // pas de mergeParams
// req.params = { } — le recipeId est perdu !
```

**BON** — activer mergeParams :
```javascript
const router = express.Router({ mergeParams: true });
// req.params = { recipeId: "42" } — récupéré du parent
```

### Piège #2 : Bloquer les invités avec authenticate

**MAUVAIS** — les invités ne peuvent pas commenter :
```javascript
router.post('/', authenticate, commentRules, validate, CommentController.createComment);
// authenticate renvoie 401 si pas de token → les invités sont exclus
```

**BON** — utiliser attachUser à la place :
```javascript
router.post('/', attachUser, commentRules, validate, CommentController.createComment);
// attachUser ne bloque jamais — il met juste req.user si token valide
```

## 7. ET SI ON FAISAIT AUTREMENT ?

### Option A : Forcer la création de compte pour commenter
- **Comment ça marche** : `authenticate` sur le POST commentaire.
- **Avantage** : modération plus simple (tous les commentaires sont liés à un compte), pas de spam.
- **Inconvénient** : barrière à l'entrée — moins d'interactions.
- **Notre cas** : l'ouverture aux invités (US-13) est une décision produit délibérée pour maximiser l'engagement.

### Option B : Guest_name sur la table comments avec CHECK NOT NULL si user_id IS NULL
- **Comment ça marche** : contrainte SQL `CHECK ((user_id IS NOT NULL) OR (guest_name IS NOT NULL))`.
- **Avantage** : garantie base de données.
- **Inconvénient** : requiert MariaDB 10.2+ (c'est le cas), mais complique les migrations.
- **Notre cas** : la validation applicative est suffisante pour l'instant.

## 8. CHECKLIST POUR LE JURY

- [ ] Table `comments` avec `user_id` nullable et `guest_name` nullable
- [ ] `mergeParams: true` activée sur le router pour récupérer `recipeId` du parent
- [ ] `attachUser` utilisé sur POST (ne bloque pas les invités) ; `authenticate` sur DELETE (interdit aux invités)
- [ ] Validation conditionnelle avec `.if()` d'express-validator : `guest_name` requis seulement si !req.user
- [ ] `Comment.create()` valide : contenu ≥ 3 caractères, et guest_name requis si pas de user_id
- [ ] `Comment.findByRecipeId()` utilise `LEFT JOIN users` et affiche `user_pseudo || guest_name || 'Anonyme'`
- [ ] Soft delete : `UPDATE comments SET deleted_at = NOW() WHERE id = ?`
- [ ] Seuls l'auteur (user_id match) ou un admin peuvent supprimer un commentaire
