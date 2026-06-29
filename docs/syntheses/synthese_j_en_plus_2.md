# Synthèse Jour en + 2 — Feature Favoris

## Ce qu'on a fait

### Analyse préliminaire

- Audit complet du projet pour évaluer la pertinence d'une feature "favoris"
- Constat : bouton "Sauvegarder" déjà présent dans `recipe.html` mais non fonctionnel (simple `alert()`)
- Pas dans les specs, pas dans le MVP, pas dans les user stories
- Verdict : techniquement simple, mais hors scope specs — décision d'implémenter quand même avec mise à jour des specs

### Specs mises à jour (source de vérité)

- **`specs/technique/api.md`** : endpoints `GET /api/v1/favorites` et `POST /api/v1/favorites/:recipeId` documentés + `is_favorited` sur le détail recette + `favorite_count` dans le profil
- **`specs/technique/database-design.md`** : table `favorites` (user_id, recipe_id, UNIQUE, CASCADE), relationships, indexes
- **`specs/gestion-projet/persona-user-stories.md`** : US-16 — Sauvegarder une recette pour plus tard
- **`specs/technique/structure.md`** : nouveaux fichiers listés

### Base de données

- **`database/scripts/07_create_favorites_table.sql`** : nouvelle table `favorites` avec CASCADE DELETE, contrainte UNIQUE (user_id, recipe_id), 2 indexes

### Backend

- **`src/models/Favorite.js`** : `toggle()`, `findByUserId()`, `isFavorited()`, `countByUserId()`
- **`src/controllers/FavoriteController.js`** : `toggle` (POST), `getMyFavorites` (GET)
- **`src/routes/favoriteRoutes.js`** : monté sur `/api/v1/favorites`
- **`src/middlewares/jwtAuth.js`** : ajout de `attachUser` — middleware optionnel pour avoir `req.user` sans bloquer les invités
- **`src/controllers/RecipeController.js`** : `is_favorited` attaché à la réponse de `getRecipeById` si utilisateur authentifié
- **`src/controllers/UserController.js`** : `favorite_count` ajouté aux stats du profil

### Frontend

- **Header** : icône cœur (SVG) ajoutée dans `.header-nav` et `.mobile-nav` sur les 7 pages HTML, cachée par défaut (`auth-link`), révélée par `updateAuthUI()`
- **`favorites.html`** : nouvelle page avec grille de recettes sauvegardées, loading/error/empty/content states
- **`favorites.js`** : fetch + render avec carte recette reprenant le pattern du dashboard
- **`detail.js`** : bouton "Sauvegarder" câblé à l'API → `POST /api/v1/favorites/:recipeId` avec feedback visuel (état rempli/vide, classe `.is-saved`)
- **`dashboard.html`** / **`dashboard.js`** : carte "Favoris" ajoutée aux stats
- **`styles.css`** : `.fav-link` (icône cœur header), `.is-saved` (bouton actif)

### Tests

- Les 119 tests existants passent toujours. Les 2 échecs sont préexistants dans `admin-utils.test.js` (suite vide). Coverage en baisse à cause du nouveau code non testé.

## Problèmes rencontrés

- **Ordre de montage des routes** : `favoriteRoutes.js` nécessite d'être importé ET monté dans `app.js`. Rien de cassé mais attention à la position dans le middleware chain.
- **`attachUser` manquant** : le détail recette ne pouvait pas retourner `is_favorited` sans un middleware optionnel. Création de `attachUser` dans `jwtAuth.js` — contrairement à `authenticate`, il ne bloque pas si le token est absent.
- **04_seed_data.sql modifié** : modification préexistante (INSERT IGNORE), pas touchée par cette session.

## Décisions techniques prises

- **Table dédiée `favorites`** plutôt que colonne JSON dans `users` — permet des requêtes SQL simples, des indexes, et des relations FK propres avec CASCADE DELETE.
- **Toggle (POST unique)** plutôt que POST/DELETE séparés — plus simple côté frontend, un seul point d'appel.
- **`ON DELETE CASCADE`** sur les deux FK — si une recette ou un utilisateur est supprimé, ses favoris sont nettoyés automatiquement, pas d'orphelins.
- **Structure de route `/api/v1/favorites`** plutôt que `/users/me/favorites` ou `/recipes/:id/favorite` — cohérent REST, collection de ressource propre.
- **Pas de compteur dans le header** : l'icône cœur est un lien direct, pas un badge avec un nombre — évite un appel API supplémentaire sur chaque page.
- **Pas de bouton "Favoris" dans le hero/filtres** : les filtres personae restent les seuls contrôles de la homepage (per specs).

## Ce qui reste

- Tests unitaires pour `Favorite.js` et `FavoriteController.js` — couverture actuelle 10%, idéalement >70%
- Nettoyage des fichiers legacy `*1.js` dans `src/`
- `.env.test` toujours pointé sur `recettes_humaines` (dev) au lieu de `recettes_humaines_test`
