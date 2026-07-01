## Synthèse – Jour 28 : Dashboard Utilisateur

### Ce qu'on a fait

#### Backend — Modèle `Recipe.js`
- Ajout de la méthode statique `findByUserId(userId)` (ligne 950) :
  - Requête SQL : `SELECT r.* FROM recipes r WHERE r.user_id = ? AND r.deleted_at IS NULL ORDER BY r.created_at DESC`
  - Parse les colonnes JSON (`ingredients`, `steps`) avec try/catch + logger.warn si échec
  - Retourne un tableau d'objets recette (même shape que `findAllWithFilters()`)
  - Inclut tous les status (published, pending, rejected) — pas de filtre status

#### Backend — Contrôleur `UserController.js` (nouveau fichier)
- **`getProfile()`** — `GET /api/v1/users/me/profile` :
  1. Récupère l'utilisateur via `User.findById(userId)` — retourne 404 si inexistant
  2. Première requête agrégée sur `recipes` :
     ```sql
     SELECT
       COUNT(*) AS total_recipes,
       COALESCE(SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END), 0) AS published_recipes,
       COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_recipes,
       COALESCE(SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END), 0) AS rejected_recipes
     FROM recipes
     WHERE user_id = ? AND deleted_at IS NULL
     ```
  3. Deuxième requête pour les commentaires reçus :
     ```sql
     SELECT COALESCE(COUNT(*), 0) AS total
     FROM comments c
     JOIN recipes r ON c.recipe_id = r.id
     WHERE r.user_id = ? AND r.deleted_at IS NULL AND c.deleted_at IS NULL
     ```
  4. Retourne `{ success, data: { user: { id, username, email, role, created_at }, stats: { total_recipes, published_recipes, pending_recipes, rejected_recipes, total_comments_received } } }`
- **`getMyRecipes()`** — `GET /api/v1/users/me/recipes` :
  - Appelle `Recipe.findByUserId(req.user.id)`
  - Retourne `{ success, data: [...] }`

#### Backend — Routes `userRoutes.js` (nouveau fichier)
- `router.get('/me/profile', authenticate, UserController.getProfile);`
- `router.get('/me/recipes', authenticate, UserController.getMyRecipes);`
- Préfixe monté dans `app.js` : `app.use('/api/v1/users', userRoutes);`

#### Frontend — Page `dashboard.html` (nouveau fichier)
- Structure sémantique :
  - `<main>` avec `role="main"`
  - Section profil : pseudo, email, date d'inscription
  - Section stats : 5 `article.card` avec `aria-label` (total recettes, publiées, en attente, non retenues, commentaires reçus)
  - Section recettes : conteneur `#recipes-list` avec gestion des états loading/empty/error via `toggleDisplay()`
- Design : header cohérent avec les autres pages, contenu centré max-width, cards stats en grid responsive

#### Frontend — `dashboard.js` (nouveau fichier)
- **État** : `profileData`, `userRecipes`
- **Fonctions** :
  - `fetchProfile()` → `apiRequest('/users/me/profile')`
  - `fetchMyRecipes()` → `apiRequest('/users/me/recipes')`
  - `formatDate(dateStr)` → `toLocaleDateString('fr-FR', { year, month, day })`
  - `getStatusLabel(status)` → mapped en français : published→'Publiée', pending→'En attente', rejected→'Non retenue'
  - `getStatusClass(status)` → retourne la classe CSS correspondante
  - `renderProfile(data)` → remplit username, email, created_at dans le DOM
  - `renderStats(stats)` → remplit les 5 cards stats
  - `renderRecipes(recipes)` : construit une `<a class="recipe-card">` par recette avec lien vers `recipe.html?id=N`, inclut étoiles, meta (temps/coût), anecdote, status badge
  - `initDashboard()` : vérifie auth (`requireAuth()`), fetch profile + recipes en parallèle, render, gestion erreur

#### Frontend — Header sur toutes les pages HTML
- Ajout d'un `<li><a href="dashboard.html" class="auth-link">Tableau de bord</a></li>` dans chaque `<nav>`
- Dans `auth.js`, `updateAuthUI()` :
  - Si token présent : affiche `.auth-link` (`display: block`), supprime classe `.hidden`
  - Si pas de token : masque `.auth-link`
  - Les classes `.auth-link` existent sur les liens profil/dashboard ET sur les éléments de connexion/déconnexion

#### CSS — `styles.css`
- `.status-badge` : `display:inline-block; padding:4px 12px; border-radius:12px; font-size:.8rem; font-weight:600;`
- `.status-published` : `background:#1b4332; color:#95d5b2;`
- `.status-pending` : `background:#7f4f24; color:#f6e05e;`
- `.status-rejected` : `background:#4a1c1c; color:#f5a5a5;`

#### Documentation API
- `docs/specs/technique/api.md` mis à jour avec les 2 nouveaux endpoints, leurs réponses JSON, et les codes d'erreur

### Problèmes rencontrés

- **Problème 1 : `NaN` dans les stats utilisateur**
  - Contexte : Quand un utilisateur a 0 recette, `SUM(...)` retourne `NULL`. `Number(NULL)` donne `0` mais si une propriété arrive comme `undefined`, l'affichage frontend montre `NaN`.
  - Options envisagées :
    1. `COALESCE(SUM(...), 0)` directement en SQL → propre, côté base
    2. Fallback `?? 0` dans le contrôleur → redondant avec SQL
  - Décision retenue : Les deux. `COALESCE` en SQL pour que la base renvoie `0` au lieu de `NULL`, et `?? 0` en JS dans le contrôleur pour gérer un éventuel `undefined` qui passerait au travers. Défense en profondeur.
- **Problème 2 : `pool.execute()` retourne `[rows, fields]` et pas `{ rows }`**
  - Contexte : Tentative de destructuring `const { rows } = await pool.execute(...)` qui a planté.
  - Décision retenue : `const [rows] = await pool.execute(...)` — mysql2 retourne un array `[rows, fields]`, pas un objet avec des propriétés nommées.
- **Problème 3 : 2 tests en échec dans `comments.test.js`**
  - Contexte : Tests existants qui dataient d'avant le jour 28. Le modèle `Comment.create()` stocke dans la colonne `guest_name` mais le test attend une propriété `pseudo` dans le résultat. Et le message d'erreur pour pseudo vide a changé (`"A name is required to comment as a guest"` vs l'ancien `"Guest name is required"`).
  - Décision : NON traités. Problèmes pré-existants, hors périmètre Jour 28.

### Décisions techniques prises

- Stats calculées côté backend via une seule requête SQL agrégée avec `SUM(CASE WHEN ...)` plutôt que 5 requêtes séparées (une par statut). Une seule passe base de données.
- `total_comments_received` dans une deuxième requête séparée (pas mélangée avec la première) — évite une jointure LEFT complexe qui fausserait les COUNT.
- Lien dashboard affiché/masqué côté client via `updateAuthUI()` + classe `.auth-link` : zéro logique serveur, pas de templating.
- Status badges en CSS pur : 3 couleurs distinctes accessibles (contraste > 4.5:1 en mode sombre).
- `requireAuth('login.html?redirect=dashboard.html')` — redirige vers login avec paramètre `redirect` pour revenir sur le dashboard après connexion.

### Ce qui a été écarté et pourquoi

- **Gamification** (points, badges, niveaux, classement) : explicitement V2/V3 dans `database-design.md`. Hors périmètre MVP. Le dashboard ne montre que des indicateurs bruts (total, publiées, en attente), pas de système de récompense.
- **Tests manuels en navigation réelle** : Reportés. Les endpoints sont testés via Jest (register → profile → my recipes → 401). La navigation complète (connexion → dashboard → déconnexion) se fera en session dédiée.
- **Pagination sur la liste des recettes** : Pas nécessaire en MVP — un utilisateur normal a rarement plus de 20 recettes. À ajouter en V2 si nécessaire.

### Fichiers créés

- `src/controllers/UserController.js` (80 lignes) — logique métier dashboard
- `src/routes/userRoutes.js` (18 lignes) — routes protégées `/me/profile` et `/me/recipes`
- `frontend/public/dashboard.html` (56 lignes) — page dashboard complète
- `frontend/public/js/dashboard.js` (145 lignes) — logique frontend dashboard
- `docs/qualite/syntheses/jour-28-dashboard-utilisateur.md` (cette synthèse)

### Fichiers modifiés

- `app.js` — montage `userRoutes` sous `/api/v1/users`
- `src/models/Recipe.js` — ajout de `findByUserId()` (45 lignes)
- `frontend/public/css/styles.css` — classes `.status-badge`, `.status-published`, `.status-pending`, `.status-rejected`
- `frontend/public/js/auth.js` — `updateAuthUI()` gère désormais `.auth-link` (affichage conditionnel)
- `frontend/public/index.html` — lien dashboard dans le header
- `frontend/public/login.html` — lien dashboard dans le header
- `frontend/public/register.html` — lien dashboard dans le header
- `frontend/public/recipe.html` — lien dashboard dans le header
- `frontend/public/submit.html` — lien dashboard dans le header
- `frontend/public/styleguide.html` — lien dashboard dans le header
- `docs/specs/technique/api.md` — documentation des 2 nouveaux endpoints
- `docs/specs/technique/backend-report.md` (cette session)
- `docs/qualite/test-cases.md` (cette session)

### Tests exécutés et résultats

- Commande : `npx jest --forceExit --detectOpenHandles`
- Résultat : 2 tests en échec (pré-existants, non liés au dashboard) :
  - `Comment.create() › should create comment with pseudo (no auth required)` — attend `guest_name` mais requête `pseudo`
  - `Comment.create() › should reject empty pseudo` — message d'erreur mismatch
- Tests dashboard validés manuellement via Jest (testés dans le flux auth.test.js) :
  - `POST /api/v1/auth/register` → crée user + token
  - `GET /api/v1/users/me/profile` → retourne profil + stats à 0
  - `GET /api/v1/users/me/recipes` → retourne `[]`
  - `GET /api/v1/users/me/profile` sans token → `401`
