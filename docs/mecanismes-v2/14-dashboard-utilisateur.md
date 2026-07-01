# #14 — Dashboard Utilisateur (Statistiques agrégées)

## 1. CE QUE ÇA FAIT (vue d'ensemble)

Le dashboard utilisateur affiche à un membre connecté ses statistiques personnelles : nombre total de recettes soumises, combien sont publiées/en attente/rejetées, le nombre de commentaires reçus sur ses recettes, et le nombre de favoris enregistrés. C'est une page privée (authentification requise) qui regroupe deux appels API : un pour le profil avec les stats, un pour la liste de ses recettes. Tout part de routes protégées par le middleware JWT, donc impossible d'accéder aux données d'un autre utilisateur.

## 2. SCHÉMA DE LA TABLE

Pas une table unique — les stats sont construites par agrégation (`COUNT`, `SUM`, `CASE WHEN`) sur les tables `recipes`, `comments`, et `favorites`.

Tables sollicitées :

```sql
-- Table recipes (03_create_tables.sql:54)
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
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Table comments (03_create_tables.sql:99)
CREATE TABLE IF NOT EXISTS comments (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    recipe_id       INT UNSIGNED NOT NULL,
    user_id         INT UNSIGNED NULL DEFAULT NULL,
    guest_name      VARCHAR(100) NULL DEFAULT NULL,
    content         TEXT NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at      DATETIME NULL DEFAULT NULL,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id)
);

-- Table favorites (07_create_favorites_table.sql:12)
CREATE TABLE IF NOT EXISTS favorites (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED NOT NULL,
    recipe_id       INT UNSIGNED NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_favorite_user_recipe (user_id, recipe_id)
);
```

## 3. LE CODE

### 3.1 — UserController.getProfile (src/controllers/UserController.js:17)

```javascript
// GET /api/v1/users/me/profile
static async getProfile(req, res, next) {
    try {
        const userId = Number(req.user.id);
        // req.user contient les infos décodées du JWT
        // Number() s'assure que c'est bien un entier, pas une string

        // 1ere requête : stats sur les recettes de l'utilisateur
        const [statsRows] = await pool.execute(
            `SELECT
                COUNT(*) AS total_recipes,
                // COUNT(*) compte TOUTES les lignes du résultat
                // = nombre total de recettes de cet utilisateur (non supprimées)

                COALESCE(SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END), 0) AS published_recipes,
                // CASE WHEN status = 'published' THEN 1 ELSE 0 END
                // → chaque ligne vaut 1 si le statut est 'published', 0 sinon
                // SUM() additionne les 1 → donne le total des publiées
                // COALESCE(..., 0) si SUM() renvoie NULL (pas de lignes), on met 0

                COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_recipes,
                COALESCE(SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END), 0) AS rejected_recipes
             FROM recipes
             WHERE user_id = ? AND deleted_at IS NULL`,
             // clause soft delete : on exclut les recettes marquées comme supprimées
            [userId]
        );
        const stats = statsRows[0];
        // Résultat : un objet avec total_recipes, published_recipes, etc.

        // 2e requête : compter les commentaires REÇUS sur les recettes de l'utilisateur
        const [commentRows] = await pool.execute(
            `SELECT COALESCE(COUNT(*), 0) AS total
             FROM comments c
             JOIN recipes r ON c.recipe_id = r.id
             // JOIN : on relie les commentaires aux recettes
             // pour ne garder que les commentaires sur les recettes de l'utilisateur
             WHERE r.user_id = ? AND r.deleted_at IS NULL AND c.deleted_at IS NULL`,
            [userId]
        );

        // 3e : compter les favoris de l'utilisateur via le modèle Favorite
        const favoriteCount = await Favorite.countByUserId(userId);
        // SELECT COUNT(*) AS count FROM favorites WHERE user_id = ?

        // Assemblage de la réponse
        const result = {
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                created_at: user.created_at,
            },
            stats: {
                total_recipes: Number(stats.total_recipes ?? 0),
                published_recipes: Number(stats.published_recipes ?? 0),
                pending_recipes: Number(stats.pending_recipes ?? 0),
                rejected_recipes: Number(stats.rejected_recipes ?? 0),
                total_comments_received: Number(commentRows[0].total ?? 0),
                favorite_count: favoriteCount,
            }
        };

        return sendSuccess(res, result);

    } catch (error) {
        next(error);
    }
}
```

### 3.2 — UserController.getMyRecipes (src/controllers/UserController.js:74)

```javascript
// GET /api/v1/users/me/recipes
static async getMyRecipes(req, res, next) {
    try {
        const recipes = await Recipe.findByUserId(req.user.id);
        // Délègue au modèle Recipe.findByUserId()
        // SELECT r.* FROM recipes r
        // WHERE r.user_id = ? AND r.deleted_at IS NULL
        // ORDER BY r.created_at DESC
        // Retourne toutes les recettes de l'utilisateur (publiées, en attente, rejetées)
        return sendSuccess(res, recipes);
    } catch (error) {
        next(error);
    }
}
```

### 3.3 — Routes (src/routes/userRoutes.js:15)

```javascript
const router = Router();

// Les deux routes utilisent le middleware authenticate
// Si le token est invalide → 401 avant même d'atteindre le contrôleur
router.get('/me/profile', authenticate, UserController.getProfile);
router.get('/me/recipes', authenticate, UserController.getMyRecipes);

module.exports = router;
```

### 3.4 — Frontend dashboard.js (frontend/public/js/dashboard.js:132)

```javascript
async function initDashboard() {
    // Vérifie que l'utilisateur est connecté, sinon redirige vers login
    if (!requireAuth('login.html?redirect=dashboard.html')) return;

    try {
        // Les deux appels API sont indépendants → pourraient être parallélisés
        // (mais on les fait séquentiellement ici, plus simple pour le MVP)
        var profileResult = await fetchProfile();
        var recipesResult = await fetchMyRecipes();

        profileData = profileResult;
        userRecipes = recipesResult;

        renderProfile(profileResult);
        // Affiche le nom, email, date d'inscription
        renderStats(profileResult.stats);
        // Affiche les 6 chiffres dans les cartes stats
        renderRecipes(recipesResult);
        // Génère la liste des recettes avec leur statut

    } catch (error) {
        // Affiche un message d'erreur si un des deux appels échoue
        document.getElementById('error-message').textContent =
            error.message || 'Impossible de charger vos données.';
    }
}
```

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

```
Utilisateur connecté → dashboard.html

1. initDashboard() est appelé
2. requireAuth() vérifie le token JWT dans localStorage
   → si absent → redirection vers login.html

3. fetchProfile() → GET /api/v1/users/me/profile
   → Headers: Authorization: Bearer <token>
   → Middleware authenticate vérifie la signature JWT
   → Contrôleur UserController.getProfile()

4. À l'intérieur de getProfile() :
   a. User.findById(userId) → SELECT avec WHERE id = ? AND deleted_at IS NULL
   b. Requête d'agrégation sur recipes avec COUNT + SUM + CASE WHEN
   c. Requête avec JOIN comments ↔ recipes pour les commentaires reçus
   d. Favorite.countByUserId(userId) → SELECT COUNT(*) FROM favorites

5. fetchMyRecipes() → GET /api/v1/users/me/recipes
   → Recipe.findByUserId() → SELECT avec WHERE user_id = ? AND deleted_at IS NULL

6. Frontend :
   a. renderProfile() → remplit le header avec username, email, date
   b. renderStats() → injecte les 6 chiffres dans les <span> du HTML
   c. renderRecipes() → génère les cartes avec statut, étoiles, anecdote

7. Si admin → bouton "Panneau d'administration" visible
```

## 5. ANALOGIE

Tu vas à la banque retirer ton relevé de compte. Le guichetier :

1. Vérifie ta carte d'identité (authentification)
2. Regarde dans ton dossier personnel (table users)
3. Compte combien de chèques tu as émis (COUNT sur recipes)
4. Sépare ceux qui sont encaissés, en attente, rejetés (CASE WHEN)
5. Compte combien de virements tu as reçus (commentaires reçus)
6. Regarde ta liste de virements programmés (favoris)

Tout ça, c'est la même personne qui regarde dans ses propres dossiers. Elle ne peut pas voir les comptes des autres — comme le middleware authenticate empêche un utilisateur d'accéder au dashboard d'un autre.

## 6. PIÈGES CLASSIQUES

### Piège #1 : Pas de vérification que l'utilisateur est bien le propriétaire

Si tu écris `SELECT ... FROM recipes WHERE user_id = ?` avec `req.params.id` au lieu de `req.user.id`, un utilisateur malveillant peut modifier l'ID dans l'URL et voir les stats d'un autre.

**MAUVAIS :**
```javascript
const userId = req.params.id; // L'utilisateur peut mettre n'importe quel ID
```

**BON :**
```javascript
const userId = Number(req.user.id); // Toujours depuis le JWT, jamais depuis l'URL
```

### Piège #2 : Oublier le soft delete dans les agrégations

Si tu ne mets pas `AND deleted_at IS NULL`, les stats incluent des recettes "supprimées" que l'utilisateur ne voit plus ailleurs. Les chiffres deviennent incohérents entre le dashboard et la liste.

**MAUVAIS :**
```sql
SELECT COUNT(*) FROM recipes WHERE user_id = ?
```

**BON :**
```sql
SELECT COUNT(*) FROM recipes WHERE user_id = ? AND deleted_at IS NULL
```

### Piège #3 : Ne pas gérer le cas où l'utilisateur n'a aucune donnée

Si un utilisateur n'a jamais posté de recette, `SUM(CASE WHEN ...)` renvoie NULL (pas 0). Sans `COALESCE(..., 0)`, le frontend reçoit `null` et affiche "NaN" ou plante.

**MAUVAIS :**
```javascript
published_recipes: stats.published_recipes // null → NaN dans le frontend
```

**BON :**
```javascript
published_recipes: Number(stats.published_recipes ?? 0) // null → 0
```

## 7. ET SI ON FAISAIT AUTREMENT ?

### Option A : Une seule grosse requête SQL avec sous-requêtes

- Comment ça marche : Tout en une seule requête avec des subqueries dans le SELECT
- Avantage : Un seul appel à la BDD au lieu de 3
- Inconvénient : Requête complexe, difficile à lire et débugger
- Notre cas : On préfère 3 requêtes simples et lisibles. Un développeur Bac+2 doit pouvoir comprendre et modifier chaque bloc sans risquer de casser les autres.

### Option B : Calculer les stats côté frontend à partir de la liste des recettes

- Comment ça marche : Récupérer toutes les recettes, puis compter les statuts avec `filter()` en JS
- Avantage : Moins de travail pour le serveur (délégation au navigateur)
- Inconvénient : Si l'utilisateur a 1000 recettes, on envoie tout au navigateur juste pour 3 chiffres. Gaspillage de bande passante et ralentissement sur mobile.
- Notre cas : On calcule en SQL (l'agrégation est ce que la BDD fait le mieux). On envoie 6 nombres au lieu de potentiellement des centaines de lignes.

## 8. CHECKLIST POUR LE JURY

- [ ] La route `/me/profile` retourne bien 401 si aucun token n'est fourni
- [ ] La route `/me/profile` retourne les stats sous forme de nombres (pas de chaînes)
- [ ] Les recettes soft-deletées ne sont pas comptées dans les stats
- [ ] Le calcul des commentaires reçus utilise un JOIN et vérifie `deleted_at IS NULL` sur les deux tables
- [ ] `total_recipes` = `published_recipes` + `pending_recipes` + `rejected_recipes`
- [ ] Le bouton admin n'apparaît que si `role === 'admin'`
- [ ] Le frontend affiche un message d'erreur si un des deux appels API échoue
- [ ] La redirection vers login fonctionne si l'utilisateur n'est pas connecté
