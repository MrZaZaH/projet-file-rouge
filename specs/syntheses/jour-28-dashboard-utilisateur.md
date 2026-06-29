## Synthèse – Jour 28 : Dashboard Utilisateur

### Ce qu'on a fait

- **Backend** : Ajout de `Recipe.findByUserId()` dans `src/models/Recipe.js` — retourne toutes les recettes non-supprimées d'un utilisateur, triées par date récente.
- **Backend** : Création de `src/controllers/UserController.js` avec deux méthodes :
  - `getProfile()` : retourne infos utilisateur + stats agrégées (total, publiées, en attente, non retenues, commentaires reçus)
  - `getMyRecipes()` : retourne la liste des recettes de l'utilisateur connecté
- **Backend** : Création de `src/routes/userRoutes.js` avec deux endpoints protégés :
  - `GET /api/v1/users/me/profile`
  - `GET /api/v1/users/me/recipes`
- **Backend** : Montage des routes dans `app.js` sous le préfixe `/api/v1/users`
- **Frontend** : Création de `frontend/public/dashboard.html` — page complète avec :
  - Section profil (pseudo, email, date d'inscription)
  - Cartes de stats (5 indicateurs)
  - Liste des recettes avec status badges
  - États loading et erreur
- **Frontend** : Création de `frontend/public/js/dashboard.js` — logique de fetch, render, et gestion des états
- **Frontend** : Mise à jour du header sur toutes les pages HTML — lien "Tableau de bord" affiché/masqué via `updateAuthUI()` (classe `.auth-link`)
- **CSS** : Ajout des classes `.status-badge`, `.status-published`, `.status-pending`, `.status-rejected` dans `styles.css`
- **Documentation** : Mise à jour de `specs/technique/api.md` avec les deux nouveaux endpoints

### Problèmes rencontrés

- **Problème 1 : `NaN` dans les stats utilisateur**
  - Contexte : Quand un utilisateur a 0 recette, `SUM(...)` retourne `NULL`, et `Number(NULL)` donne `0`, mais certaines props pouvaient être `undefined` ou `null`, causant l'affichage de `NaN` dans le frontend.
  - Options envisagées :
    1. `COALESCE(SUM(...), 0)` directement en SQL → propre, côté base
    2. Fallback `?? 0` dans le contrôleur → redondant avec SQL
  - Décision retenue : Les deux — `COALESCE` en SQL pour propreté + `?? 0` dans le contrôleur en filet de sécurité. Le cerveau humain est une pipe, la défense en coûte rien.
- **Problème 2 : `pool.execute()` retourne `[rows, fields]` et pas `{ rows }`**
  - Contexte : Tentative de destructuring `const { rows } = await pool.execute(...)` qui a planté.
  - Décision retenue : `const [rows] = await pool.execute(...)` — mysql2 retourne un array, pas un objet.
- **Problème 3 : 2 tests en échec dans `comments.test.js`**
  - Contexte : Tests existants pré-nouveauté — le modèle `Comment.create()` utilise `guest_name` en colonne mais le test attend `pseudo`. Et le message d'erreur a changé.
  - Décision : NON traités. Problème pré-existant hors périmètre Jour 28.

### Décisions techniques prises

- Stats calculées côté backend via requête SQL agrégée (une seule passe avec `SUM(CASE WHEN ...)`) plutôt que 5 requêtes séparées
- Lien dashboard affiché/masqué côté client via `updateAuthUI()` + classe `.auth-link` (zéro logique serveur)
- Status badges en CSS pur — 3 couleurs (vert = publiée, orange = en attente, gris = non retenue)
- Les stats `total_comments_received` sont calculées via une deuxième requête (jointure comments → recipes), pas mélangées dans la première

### Ce qui a été écarté et pourquoi

- **Gamification** (points, badges, niveaux, classement) : explicitement V2/V3 dans `database-design.md`. Hors périmètre MVP. Le dashboard ne montre que des données brutes, pas de système de récompense.
- **Tests manuels en navigation réelle** : Reportés. Le code est prêt, les endpoints passent en test Jest. La navigation réelle se fera en session dédiée.
- **Pagination sur la liste des recettes** : Pas nécessaire en MVP — un utilisateur normal a rarement plus de 20 recettes. À ajouter si nécessaire en V2.

### Fichiers créés

- `src/controllers/UserController.js`
- `src/routes/userRoutes.js`
- `frontend/public/dashboard.html`
- `frontend/public/js/dashboard.js`

### Fichiers modifiés

- `app.js` — montage des routes user
- `src/models/Recipe.js` — ajout de `findByUserId()`
- `frontend/public/css/styles.css` — status badges
- `frontend/public/js/auth.js` — toggle dashboard link
- `frontend/public/index.html`
- `frontend/public/login.html`
- `frontend/public/register.html`
- `frontend/public/recipe.html`
- `frontend/public/submit.html`
- `frontend/public/styleguide.html`
- `specs/technique/api.md` — nouveaux endpoints documentés
