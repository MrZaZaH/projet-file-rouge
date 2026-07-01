# 33 — Dashboard et Favoris Frontend

## 1. CE QUE ÇA FAIT (vue d'ensemble)

Deux pages privées (authentification requise) :

**Dashboard** (`dashboard.js`) : page personnelle qui affiche :
- Les informations du profil (username, email, date d'inscription)
- Des statistiques (total recettes, publiées, en attente, rejetées, commentaires reçus, favoris)
- La liste des recettes de l'utilisateur avec leur statut et leur note
- Un bouton "Panneau d'administration" si l'utilisateur est admin

**Favoris** (`favorites.js`) : page qui liste toutes les recettes sauvegardées par l'utilisateur avec :
- Le titre, le temps, le coût, la note
- La date de sauvegarde et l'auteur
- Un lien vers la page de détail de chaque recette

---

## 2. SCHÉMA DE LA TABLE

Pas de table dédiée côté frontend. Les données viennent des API :

- `GET /api/v1/users/me/profile` → profil + stats agrégées
- `GET /api/v1/users/me/recipes` → recettes de l'utilisateur
- `GET /api/v1/favorites` → recettes favorites de l'utilisateur

---

## 3. LE CODE

### 3.1 — fetchProfile / fetchMyRecipes / fetchFavorites

```js
// dashboard.js:11
async function fetchProfile() {
    return apiRequest('/users/me/profile');
}

async function fetchMyRecipes() {
    return apiRequest('/users/me/recipes');
}

// favorites.js:6
async function fetchFavorites() {
    return apiRequest('/favorites');
}
```

Trois appels via `apiRequest()`. Tous nécessitent que l'utilisateur soit connecté — le middleware `authenticate` côté serveur renvoie 401 si le token est invalide ou manquant.

`apiRequest()` injecte automatiquement le token JWT, parse la réponse, et retourne `data.data`.

### 3.2 — formatDate (`frontend/public/js/dashboard.js:20`, `favorites.js:10`)

```js
function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}
```

Convertit une date ISO du serveur (ex: `"2025-12-25T14:30:00.000Z"`) en format français lisible (ex: "25 décembre 2025").

- `toLocaleDateString('fr-FR', ...)` utilise les conventions françaises pour le formatage
- Les options `year`, `month`, `day` contrôlent le niveau de détail
- `month: 'long'` donne le mois en toutes lettres (décembre, pas déc.)
- Si `dateStr` est null/undefined, retourne `'—'` (tiret) plutôt que de planter

### 3.3 — getStatusLabel / getStatusClass (`frontend/public/js/dashboard.js:29`)

```js
function getStatusLabel(status) {
    switch (status) {
        case 'published': return 'Publiée';
        case 'pending': return 'En attente';
        case 'rejected': return 'Non retenue';
        default: return status;
    }
}

function getStatusClass(status) {
    switch (status) {
        case 'published': return 'status-published';
        case 'pending': return 'status-pending';
        case 'rejected': return 'status-rejected';
        default: return '';
    }
}
```

Deux fonctions qui traduisent le statut technique (anglais, depuis la BDD) en français lisible et en classe CSS pour le styling.

Le `switch` est plus lisible qu'une série de `if/else if` pour ce genre de mapping fixe. Le `default` retourne le statut brut si un nouveau statut apparaît (évite de casser l'affichage).

### 3.4 — renderProfile (`frontend/public/js/dashboard.js:47`)

```js
function renderProfile(data) {
    document.getElementById('profile-username').textContent = data.user.username;
    document.getElementById('profile-email').textContent = data.user.email;
    document.getElementById('profile-created').textContent = formatDate(data.user.created_at);
    document.getElementById('dashboard-subtitle').textContent =
        'Bienvenue ' + data.user.username + ' — voici votre activité sur Ovni Culinaire';

    var adminBtn = document.getElementById('admin-btn');
    if (adminBtn) {
        adminBtn.style.display = data.user.role === 'admin' ? '' : 'none';
    }
}
```

Remplit les éléments du profil. Le bouton admin est caché (`display: none`) si l'utilisateur n'a pas le rôle `admin`. C'est la seule vérification de rôle frontend — la véritable protection est côté serveur (les routes admin retournent 403 si pas admin).

### 3.5 — renderStats (`frontend/public/js/dashboard.js:69`)

```js
function renderStats(stats) {
    document.getElementById('stat-total').textContent = stats.total_recipes;
    document.getElementById('stat-published').textContent = stats.published_recipes;
    document.getElementById('stat-pending').textContent = stats.pending_recipes;
    document.getElementById('stat-rejected').textContent = stats.rejected_recipes;
    document.getElementById('stat-comments').textContent = stats.total_comments_received;
    var favEl = document.getElementById('stat-favorites');
    if (favEl) favEl.textContent = stats.favorite_count || 0;
}
```

Injecte les 6 valeurs statistiques dans les éléments correspondants. `textContent` est utilisé — pas de risque XSS. La vérification `if (favEl)` permet de gérer le cas où l'élément `#stat-favorites` n'existe pas dans le HTML (graceful degradation).

### 3.6 — renderRecipes (`frontend/public/js/dashboard.js:79`)

```js
function renderRecipes(recipes) {
    var loadingEl = document.getElementById('recipes-loading');
    var emptyEl = document.getElementById('recipes-empty');
    var listEl = document.getElementById('recipes-list');

    toggleDisplay(loadingEl, false);

    if (!recipes || recipes.length === 0) {
        toggleDisplay(emptyEl, true);
        listEl.innerHTML = '';
        return;
    }

    toggleDisplay(emptyEl, false);
    listEl.innerHTML = '';

    recipes.forEach(function(recipe) {
        var card = document.createElement('a');
        card.href = 'recipe.html?id=' + recipe.id;
        card.className = 'recipe-card';
        card.setAttribute('aria-label', recipe.title + ' – ' + getStatusLabel(recipe.status));

        var stars = '\u2605'.repeat(Math.round(recipe.average_rating || 0)) +
                    '\u2606'.repeat(5 - Math.round(recipe.average_rating || 0));

        card.innerHTML =
            '<div style="display:flex;justify-content:space-between;...">' +
                // ... meta (time, cost), title, rating
                '<span class="status-badge ' + getStatusClass(recipe.status) + '">' +
                    getStatusLabel(recipe.status) +
                '</span>' +
            '</div>';

        if (recipe.anecdote) {
            var p = document.createElement('p');
            p.className = 'recipe-card-anecdote';
            p.textContent = '\u201C' + recipe.anecdote + '\u201D';
            card.appendChild(p);
        }

        listEl.appendChild(card);
    });
}
```

Points importants :

- Chaque recette est une **balise `<a>`** (lien cliquable) avec `href` pointant vers `recipe.html?id=...`
- Les étoiles sont générées avec `\u2605` (★) et `\u2606` (☆) répétés
- Le **badge de statut** est généré avec `getStatusLabel()` et `getStatusClass()`
- Si la recette a une anecdote, elle est affichée entre guillemets dans un `<p>` en `textContent`

Le `innerHTML` est utilisé pour la structure interne de la card. Les titres de recettes sont insérés directement (`recipe.title`) — c'est une potentielle faille XSS si le titre contient du HTML. Heureusement, le titre est créé par l'utilisateur lui-même (donc auto-XSS uniquement), mais idéalement il faudrait `escapeHTML()`.

### 3.7 — renderFavorites (`frontend/public/js/favorites.js:19`)

```js
function renderFavorites(recipes) {
    var loadingEl = document.getElementById('favorites-loading');
    var emptyEl = document.getElementById('favorites-empty');
    var gridEl = document.getElementById('favorites-grid');

    toggleDisplay(loadingEl, false);

    if (!recipes || recipes.length === 0) {
        toggleDisplay(emptyEl, true);
        gridEl.innerHTML = '';
        return;
    }

    toggleDisplay(emptyEl, false);
    gridEl.innerHTML = '';

    recipes.forEach(function(recipe) {
        var card = document.createElement('a');
        card.href = 'recipe.html?id=' + recipe.id;
        card.className = 'recipe-card';
        card.setAttribute('aria-label', recipe.title);

        // ... étoiles, meta ...

        card.innerHTML = '...' +
            '<p class="text-muted" style="font-size:0.8rem;margin-top:0.5rem;">' +
                'Sauvegardé le ' + formatDate(recipe.favorited_at) +
                ' &mdash; par ' + recipe.author +
            '</p>';

        gridEl.appendChild(card);
    });
}
```

Similaire à `renderRecipes()` du dashboard mais avec quelques différences :

- Affiche `favorited_at` (date de sauvegarde) et l'auteur original de la recette
- Pas de badge de statut (les favoris sont généralement des recettes publiées)
- Utilise `gridEl` au lieu de `listEl`

### 3.8 — initDashboard et initFavorites

```js
// dashboard.js:132
async function initDashboard() {
    if (!requireAuth('login.html?redirect=dashboard.html')) return;

    toggleDisplay(document.getElementById('loading-state'), true);
    toggleDisplay(document.getElementById('error-state'), false);
    toggleDisplay(document.getElementById('dashboard-content'), false);

    try {
        var profileResult = await fetchProfile();
        var recipesResult = await fetchMyRecipes();

        profileData = profileResult;
        userRecipes = recipesResult;

        renderProfile(profileResult);
        renderStats(profileResult.stats);
        renderRecipes(recipesResult);

        toggleDisplay(document.getElementById('loading-state'), false);
        toggleDisplay(document.getElementById('dashboard-content'), true);
    } catch (error) {
        toggleDisplay(document.getElementById('loading-state'), false);
        toggleDisplay(document.getElementById('error-state'), true);
        document.getElementById('error-message').textContent =
            error.message || 'Impossible de charger vos données.';
    }
}

// favorites.js:62
async function initFavorites() {
    if (!requireAuth('login.html?redirect=favorites.html')) return;

    toggleDisplay(document.getElementById('loading-state'), true);
    toggleDisplay(document.getElementById('error-state'), false);
    toggleDisplay(document.getElementById('favorites-content'), false);

    try {
        favorites = await fetchFavorites();

        var subtitle = document.getElementById('favorites-subtitle');
        if (subtitle) {
            subtitle.textContent = favorites.length + ' recette' +
                (favorites.length > 1 ? 's' : '') + ' sauvegardée' +
                (favorites.length > 1 ? 's' : '');
        }

        renderFavorites(favorites);

        toggleDisplay(document.getElementById('loading-state'), false);
        toggleDisplay(document.getElementById('favorites-content'), true);
    } catch (error) {
        toggleDisplay(document.getElementById('loading-state'), false);
        toggleDisplay(document.getElementById('error-state'), true);
        document.getElementById('error-message').textContent =
            error.message || 'Impossible de charger vos favoris.';
    }
}
```

Même pattern pour les deux pages :

1. **Protection** : `requireAuth()` → redirige vers login si pas connecté
2. **Loading** : affiche le loader, cache le contenu et l'erreur
3. **Appel API** : un ou deux appels selon la page
4. **Rendu** : fonctions de rendu spécifiques
5. **Succès** : cache le loader, affiche le contenu
6. **Erreur** : cache le loader, affiche le message d'erreur

Les deux fonctions sont auto-exécutées en bas de leur fichier respectif (`initDashboard()` et `initFavorites()`).

---

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

**Dashboard :**
```
1. dashboard.html se charge
2. initDashboard() est appelé
3. requireAuth() → pas de token ? → redirection vers login.html?redirect=dashboard.html
4. Loading state affiché
5. fetchProfile() → GET /api/v1/users/me/profile
   → serveur : vérifie token, agrège les stats, retourne { user, stats }
6. fetchMyRecipes() → GET /api/v1/users/me/recipes
   → serveur : retourne toutes les recettes de l'utilisateur
7. renderProfile() → username, email, date, bouton admin
8. renderStats() → 6 nombres dans les cartes
9. renderRecipes() → génère les <a> cartes avec titre, étoiles, badge statut
10. Loading caché, contenu affiché
```

**Favoris :**
```
1. favorites.html se charge
2. initFavorites() est appelé
3. requireAuth() → redirection si pas connecté
4. fetchFavorites() → GET /api/v1/favorites
   → serveur : retourne les recettes favorites de l'utilisateur
5. Sous-titre : "X recette(s) sauvegardée(s)"
6. renderFavorites() → génère les <a> cartes
7. L'utilisateur clique sur une carte → recipe.html?id=42
```

---

## 5. ANALOGIE

**Dashboard** : c'est ton **compte personnel à la bibliothèque** :

- Ton nom et ta date d'inscription sont sur la carte de membre (profil)
- Le bibliothécaire compte combien de livres tu as empruntés (total_recipes)
- Combien sont rendus (published), en cours (pending), perdus (rejected)
- Combien de commentaires les autres lecteurs ont laissés sur tes livres
- Ta liste de souhaits (favoris)
- Si tu es membre du comité de lecture (admin), tu vois un bouton pour accéder au bureau

**Favoris** : c'est ton **carnet de recettes découpées dans les magazines** :

- Chaque page a le titre de la recette, le temps, le coût
- Tu as noté la date où tu l'as découpée (favorited_at)
- Le nom de la personne qui a partagé la recette (author)
- Tu peux feuilleter le carnet et cliquer sur une recette pour voir les détails

---

## 6. PIÈGES CLASSIQUES

### Piège #1 : Pas de protection sur la route des favoris

Si `GET /api/v1/favorites` ne vérifie pas que `user_id` correspond à l'utilisateur connecté (via le token JWT) mais utilise un paramètre d'URL, un utilisateur pourrait voir les favoris d'un autre.

**Notre implémentation** : `fetchFavorites()` appelle `/api/v1/favorites` sans ID dans l'URL — le serveur déduit l'ID du token JWT. Impossible de voir les favoris d'un autre.

### Piège #2 : Injection XSS via le titre dans les cartes `innerHTML`

Dans `renderRecipes()` et `renderFavorites()`, `recipe.title` est inséré directement dans `innerHTML` sans `escapeHTML()`. Si un utilisateur crée une recette avec un titre comme `<script>alert(1)</script>`, le script s'exécute dans le dashboard de tous les utilisateurs (pas seulement le propriétaire, via les favoris ou la page publique).

**Solution** : utiliser `escapeHTML(recipe.title)` partout où un titre est injecté dans `innerHTML`.

### Piège #3 : Le statut "pending" affiché comme "pending" au lieu de "En attente"

Si `getStatusLabel()` reçoit un statut qu'elle ne connaît pas (ex: `'draft'`), le `default` du `switch` retourne la valeur brute. L'UX serait moche ("draft" au lieu de "Brouillon") mais au moins la page ne plante pas.

### Piège #4 : `favorited_at` peut être undefined si la jointure SQL rate

Dans `renderFavorites()`, si `recipe.favorited_at` est undefined, `formatDate(undefined)` retourne `'—'` (grâce à la vérification `if (!dateStr)`). L'affichage est correct.

---

## 7. ET SI ON FAISAIT AUTREMENT ?

### Option A : Un seul endpoint pour le dashboard

- **Comment ça marche** : Un seul `GET /api/v1/users/me/dashboard` qui retourne profil + stats + recettes en un appel.
- **Avantage** : Un seul fetch au lieu de deux, pas de problème de synchronisation.
- **Inconvénient** : Plus de travail côté serveur pour un bénéfice minime.
- **Notre cas** : Deux appels séparés — plus modulaire, chaque endpoint a une responsabilité unique.

### Option B : Pagination pour la liste des recettes

- **Comment ça marche** : Si l'utilisateur a 100 recettes, on charge 20 par page avec des boutons "Suivant/Précédent".
- **Avantage** : Pas de page monstrueuse pour les gros utilisateurs.
- **Inconvénient** : Complexité supplémentaire (gestion de la pagination côté frontend).
- **Notre cas** : Pas justifié pour un MVP (peu d'utilisateurs, peu de recettes par utilisateur).

---

## 8. CHECKLIST POUR LE JURY

- [ ] Les deux pages sont protégées par `requireAuth()` → redirection vers login si pas connecté
- [ ] `fetchProfile()` et `fetchMyRecipes()` utilisent `apiRequest()` avec token automatique
- [ ] `fetchFavorites()` appelle `/api/v1/favorites` (pas d'ID dans l'URL → sécurité par token)
- [ ] `renderProfile()` affiche le bouton admin seulement si `role === 'admin'`
- [ ] `renderStats()` utilise `textContent` et vérifie l'existence des éléments DOM
- [ ] `renderRecipes()` et `renderFavorites()` génèrent des `<a>` cliquables vers `recipe.html?id=`
- [ ] Les statuts sont traduits en français via `getStatusLabel()`
- [ ] Les dates sont formatées en français via `formatDate()`
- [ ] Si aucune recette → affichage du message vide (pas de liste cassée)
- [ ] Si erreur API → affichage du message d'erreur (pas de page blanche)
- [ ] Le loader est visible pendant le chargement, caché après
- [ ] `renderFavorites()` affiche la date de sauvegarde et l'auteur
