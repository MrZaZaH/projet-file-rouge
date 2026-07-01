# #15 — Administration / Modération

## 1. CE QUE ÇA FAIT (vue d'ensemble)

Le panneau d'administration permet aux utilisateurs avec le rôle `admin` de gérer la plateforme : approuver ou rejeter les recettes en attente, consulter les statistiques globales, voir les recettes les plus populaires, supprimer des recettes (soft delete), et consulter l'historique de toutes les actions. Chaque action d'un admin est enregistrée dans la table `admin_logs` (qui est quoi, qui a fait quoi, sur quelle cible). Quand une recette est approuvée ou rejetée, l'auteur reçoit une notification dans `user_notifications`.

## 2. SCHÉMA DE LA TABLE

```sql
-- Table admin_logs (03_create_tables.sql:160)
-- Trace chaque action d'un administrateur
CREATE TABLE IF NOT EXISTS admin_logs (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    admin_id        INT UNSIGNED NOT NULL,
    -- Qui a fait l'action (FK → users.id)
    target_type     VARCHAR(50) NOT NULL,
    -- Quel type d'objet a été modifié : 'recipe', 'comment', 'user'
    target_id       INT UNSIGNED NOT NULL,
    -- L'ID de l'objet cible
    action          VARCHAR(255) NOT NULL,
    -- Quoi : 'recipe_published', 'recipe_rejected', 'recipe_deleted'
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_admin_logs_admin
        FOREIGN KEY (admin_id) REFERENCES users(id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table user_notifications (schéma inféré du code)
-- Notifications envoyées aux utilisateurs
CREATE TABLE IF NOT EXISTS user_notifications (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED NOT NULL,
    -- Destinataire (FK → users.id)
    type            VARCHAR(50) NOT NULL,
    -- 'recipe_approved', 'recipe_rejected', 'recipe_deleted'
    message         TEXT NOT NULL,
    -- Texte de la notification (ex: "Votre recette X a été publiée !")
    recipe_id       INT UNSIGNED NULL,
    -- Optionnel : lien vers la recette concernée
    read_at         DATETIME NULL DEFAULT NULL,
    -- NULL = pas encore lu. Utile pour un futur système "mes notifications"
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## 3. LE CODE

### 3.1 — Double middleware : authenticate + requireAdmin (adminRoutes.js:36-37)

```javascript
// Toutes les routes admin sont protégées par DEUX middlewares :
router.use(authenticate);
// 1er filtre : vérifie que le token JWT est valide
// Si invalide → 401 "No token provided"
// Si valide → décode le token et met req.user = { id, role, ... }

router.use(requireAdmin);
// 2e filtre : vérifie que req.user.role === 'admin'
// Si pas admin → 403 "Admin access required"
// Si admin → next() → le contrôleur est exécuté

// Ordre impératif : authenticate AVANT requireAdmin
// Pourquoi ? requireAdmin a besoin de req.user, que authenticate a créé
```

### 3.2 — requireAdmin middleware (src/middlewares/requireAdmin.js:10)

```javascript
const requireAdmin = (req, res, next) => {
    try {
        // Vérification #1 : l'utilisateur existe (authenticate a déjà dû passer)
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            // 401 = non authentifié (pas de token ou token invalide)
        }

        // Vérification #2 : le rôle est 'admin'
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
            // 403 = authentifié mais pas les droits (interdit)
            // La différence 401 vs 403 est importante :
            // 401 = "qui êtes-vous ?" | 403 = "vous n'avez pas le droit"
        }

        // Tout est OK → on passe au contrôleur suivant
        next();
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Authorization check failed',
            error: error.message
        });
    }
};
```

### 3.3 — Approbation / Rejet d'une recette (AdminController.js:179)

```javascript
static async updateRecipeStatus(req, res) {
    try {
        const { id } = req.params;
        const { status, rejection_reason } = req.body;

        // Validation : seuls published et rejected sont autorisés
        // (un admin ne peut pas remettre en 'pending' — c'est volontaire)
        if (!['published', 'rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        // Vérification que la recette existe (et récupère ses infos)
        const [recipe] = await pool.query(
            'SELECT id, user_id, title, status FROM recipes WHERE id = ? AND deleted_at IS NULL',
            [id]
        );

        if (!recipe.length) {
            return res.status(404).json({
                success: false,
                message: 'Recipe not found'
            });
        }

        // ÉTAPE 1 : Mise à jour du statut dans recipes
        await pool.query(
            'UPDATE recipes SET status = ?, updated_at = NOW() WHERE id = ?',
            [status, id]
        );

        // ÉTAPE 2 : Création de la notification pour l'auteur
        const notificationType = status === 'published'
            ? 'recipe_approved'
            : 'recipe_rejected';

        const message = status === 'published'
            ? `Votre recette "${recipe[0].title}" a été publiée ! 🎉`
            : `Votre recette "${recipe[0].title}" n'a pas été retenue.`
              + (rejection_reason ? ' Raison : ' + rejection_reason : '');

        await pool.query(
            `INSERT INTO user_notifications (user_id, type, message, recipe_id, created_at)
             VALUES (?, ?, ?, ?, NOW())`,
            [recipe[0].user_id, notificationType, message, id]
        );

        // ÉTAPE 3 : Log de l'action pour l'audit
        await pool.query(
            `INSERT INTO admin_logs (admin_id, action, recipe_id, target_type, target_id, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [req.user.id, `recipe_${status}`, id, 'recipe', id]
            // admin_id = celui qui fait l'action (req.user.id issu du JWT)
            // action = 'recipe_published' ou 'recipe_rejected'
        );

        res.json({
            success: true,
            message: `Recipe ${status}`,
            data: { recipe_id: id }
        });

    } catch (error) {
        logger.error('Failed to update recipe status', {
            error: error.message
        });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}
```

### 3.4 — Suppression admin d'une recette (AdminController.js:251)

```javascript
static async deleteRecipe(req, res) {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        // Soft delete : UPDATE au lieu de DELETE
        await pool.query(
            'UPDATE recipes SET deleted_at = NOW(), updated_at = NOW() WHERE id = ?',
            [id]
        );
        // La ligne reste en BDD mais toutes les requêtes WHERE deleted_at IS NULL
        // l'excluent des résultats normaux

        // Notification + Log (même motif que l'approbation/rejet)
        await pool.query(
            `INSERT INTO user_notifications ...`,
            [recipe[0].user_id, 'recipe_deleted', message, id]
        );

        await pool.query(
            `INSERT INTO admin_logs ...`,
            [req.user.id, 'recipe_deleted', id, 'recipe', id]
        );
        // Chaque suppression est tracée : qui, quand, quoi
    }
    // ...
}
```

### 3.5 — Dashboard admin (AdminController.js:22)

```javascript
static async getDashboard(req, res) {
    // 4 requêtes en parallèle pour construire la page d'accueil admin :
    // 1. Stats des recettes par statut
    const [recipeStats] = await pool.query(`
        SELECT COUNT(*) as total,
               SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
               SUM(CASE WHEN status = 'pending'   THEN 1 ELSE 0 END) as pending,
               SUM(CASE WHEN status = 'rejected'  THEN 1 ELSE 0 END) as rejected
        FROM recipes WHERE deleted_at IS NULL
    `);

    // 2. Top 5 recettes les plus vues
    const [topViewed] = await pool.query(`
        SELECT r.id, r.title, r.views, r.average_rating, u.username as author
        FROM recipes r LEFT JOIN users u ON r.user_id = u.id
        WHERE r.deleted_at IS NULL AND r.status = 'published'
        ORDER BY r.views DESC LIMIT 5
    `);

    // 3. Top 5 mieux notées (minimum 3 notes pour éviter les biais)
    const [topRated] = await pool.query(`
        SELECT r.id, r.title, r.average_rating, r.rating_count, u.username as author
        FROM recipes r LEFT JOIN users u ON r.user_id = u.id
        WHERE r.deleted_at IS NULL AND r.status = 'published' AND r.rating_count >= 3
        ORDER BY r.average_rating DESC LIMIT 5
    `);

    // 4. Nombre total d'utilisateurs
    const [[userStats]] = await pool.query(`
        SELECT COUNT(*) as total FROM users WHERE deleted_at IS NULL
    `);

    logger.info('Admin accessed dashboard', { admin_id: req.user.id });
    // Chaque accès au dashboard est tracé

    res.json({ success: true, data: { recipes: {...}, top_viewed, top_rated, users } });
}
```

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

```
Admin connecté → modération-panel.html

1. Vérification auth + rôle admin côté frontend (dashboard.js:290-300)
   → getCurrentUser().role !== 'admin' → affiche "Accès non autorisé"

2. 3 appels API parallèles :
   → GET /admin/dashboard (stats + top recettes)
   → GET /admin/recipes?status=pending (recettes en attente)
   → GET /admin/logs (historique des actions)

3. Pour chaque requête API :
   a. Middleware authenticate → décode le JWT → req.user
   b. Middleware requireAdmin → vérifie req.user.role === 'admin'

4. Admin clique sur "Publier" ou "Rejeter" :
   a. PATCH /admin/recipes/:id/status { status: 'published' }
   b. Vérification que la recette existe
   c. Mise à jour du statut dans la table recipes
   d. INSERT dans user_notifications (pour prévenir l'auteur)
   e. INSERT dans admin_logs (pour l'audit)
   f. Frontend : supprime la ligne du tableau avec animation

5. Admin clique sur "Supprimer" :
   a. DELETE /admin/recipes/:id
   b. Soft delete : UPDATE SET deleted_at = NOW()
   c. Notification à l'auteur
   d. Log dans admin_logs
```

## 5. ANALOGIE

Tu es vigile dans un supermarché (l'admin). Les clients déposent des produits sur une étagère "propositions" (recettes en statut `pending`). Ton job :

1. Tu vérifies ton badge (JWT) et ton uniforme (rôle admin) → double middleware
2. Tu prends un produit, tu le vérifies
3. Si c'est bon → tu le mets en rayon (`published`). Tu notes sur ton carnet : "J'ai approuvé le produit X le [date]" (admin_logs). Tu envoies un SMS au client : "Ton produit est en rayon !" (user_notifications)
4. Si c'est pas bon → tu le jettes (`rejected`). Même chose : carnet + SMS.
5. Si un produit doit être retiré → tu ne le brûles pas, tu le mets en réserve (`deleted_at = NOW()`) au cas où il faudrait le retrouver.

## 6. PIÈGES CLASSIQUES

### Piège #1 : Oublier requireAdmin après authenticate

Les deux middlewares sont inséparables. Mettre seulement `authenticate` protège la route pour tout utilisateur connecté, pas seulement les admins.

**MAUVAIS :**
```javascript
router.patch('/recipes/:id/status', authenticate, AdminController.updateRecipeStatus);
// N'importe quel utilisateur connecté peut approuver/rejeter une recette
```

**BON :**
```javascript
router.patch('/recipes/:id/status', authenticate, requireAdmin, AdminController.updateRecipeStatus);
```

### Piège #2 : Logger l'action AVANT qu'elle ne réussisse

Si le log est écrit avant la mise à jour du statut, et que l'UPDATE échoue, tu as une trace d'une action qui n'a jamais eu lieu.

**MAUVAIS :**
```javascript
await pool.query('INSERT INTO admin_logs ...'); // Log d'abord
await pool.query('UPDATE recipes SET status = ? ...'); // Puis action
```

**BON :**
```javascript
await pool.query('UPDATE recipes SET status = ? ...'); // Action d'abord
await pool.query('INSERT INTO admin_logs ...'); // Puis log (tout s'est bien passé)
```

### Piège #3 : Accepter le statut 'pending' dans le body

Un admin pourrait remettre une recette en attente, ce qui contournerait le flux de modération.

**MAUVAIS :**
```javascript
if (!['pending', 'published', 'rejected'].includes(status)) { ... }
// L'admin pourrait remettre en pending — incohérent
```

**BON :**
```javascript
if (!['published', 'rejected'].includes(status)) { ... }
// Seulement deux choix possibles
```

## 7. ET SI ON FAISAIT AUTREMENT ?

### Option A : Un seul middleware qui combine auth + vérification admin

- Comment ça marche : Un seul middleware `requireAdmin` qui vérifie aussi le JWT
- Avantage : Un middleware au lieu de deux sur chaque route
- Inconvénient : Moins flexible. Si un jour on veut logger "tentative d'accès admin par un non-admin", on ne peut pas séparer la vérification JWT de la vérification rôle. Aussi, le principe de responsabilité unique est violé.
- Notre cas : On garde deux middlewares séparés. Plus propre, plus maintenable, plus testable.

### Option B : Workflow en plusieurs étapes (validateur → modérateur → admin)

- Comment ça marche : Trois niveaux de relecture avant publication
- Avantage : Contrôle qualité plus strict
- Inconvénient : Hors cadre MVP. Trop complexe pour une plateforme communautaire simple. Temps d'attente trop long pour les utilisateurs.
- Notre cas : Un seul admin suffit. Le rejet avec motif remplit déjà le rôle pédagogique.

## 8. CHECKLIST POUR LE JURY

- [ ] La route `/admin/dashboard` retourne 401 sans token, 403 si rôle user
- [ ] L'approbation d'une recette change son statut de 'pending' à 'published'
- [ ] Le rejet d'une recette change son statut de 'pending' à 'rejected'
- [ ] Une notification est créée dans `user_notifications` pour l'auteur
- [ ] Un log est créé dans `admin_logs` avec admin_id, action, target_type, target_id
- [ ] La suppression admin est un soft delete (UPDATE, pas DELETE)
- [ ] Les logs sont ordonnés du plus récent au plus ancien (ORDER BY created_at DESC)
- [ ] La validation express-validator bloque les statuts invalides avant le contrôleur
- [ ] Le frontend vérifie le rôle admin avant d'afficher la page
