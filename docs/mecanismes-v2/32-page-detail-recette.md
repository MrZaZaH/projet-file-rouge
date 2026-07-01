# 32 — Page de Détail Recette (Frontend)

## 1. CE QUE ÇA FAIT (vue d'ensemble)

La page de détail affiche une recette complète avec :

- **Infos** : titre, catégorie, temps, coût, auteur, note moyenne
- **Ingrédients et étapes** : listes générées dynamiquement depuis le JSON stocké en base
- **Anecdote** : l'histoire personnelle de l'auteur
- **Commentaires** : liste des avis laissés par les visiteurs, avec formulaire d'ajout (authentifié ou invité)
- **Notation** : l'utilisateur connecté peut noter la recette (1-5 étoiles) en même temps qu'il commente
- **Favoris** : bouton pour sauvegarder/retirer la recette des favoris
- **Partage** : via Web Share API (natif mobile) ou copie de lien
- **Anti-XSS** : `escapeHTML()` pour tout contenu généré dynamiquement

---

## 2. SCHÉMA DE LA TABLE

Tables sollicitées par la page :

- `recipes` : données principales de la recette
- `comments` : commentaires associés (avec `user_id` ou `guest_name` pour les invités)
- `ratings` : notes attribuées par les utilisateurs
- `favorites` : lien utilisateur ↔ recette pour les favoris

---

## 3. LE CODE

### 3.1 — fetchRecipe (`frontend/public/js/detail.js:7`)

```js
async function fetchRecipe(id) {
    try {
        var headers = {};
        var token = getToken();
        if (token) {
            headers['Authorization'] = 'Bearer ' + token;
        }
        const response = await fetch('/api/v1/recipes/' + id, { headers: headers });
        if (!response.ok) return null;
        const result = await response.json();
        return result.data || null;
    } catch (error) {
        console.error('Failed to fetch recipe:', error);
        return null;
    }
}
```

Récupère une recette par son ID. Si l'utilisateur est connecté, le token est passé dans les headers (utile pour savoir si l'utilisateur a déjà favori/marqué la recette). Si la requête échoue (404, 500, ou réseau), retourne `null` — l'appelant gère l'affichage de l'erreur.

Le `try/catch` attrape les erreurs réseau (pas de connexion, timeout) et les erreurs de parsing JSON.

### 3.2 — renderRecipe (`frontend/public/js/detail.js:77`)

```js
function renderRecipe(data) {
    document.title = data.title + ' – Ovni Culinaire';

    document.getElementById('recipe-category').textContent = (data.category && data.category.name) || 'Autre';
    document.getElementById('recipe-title').textContent = data.title;
    document.getElementById('recipe-time').textContent = formatTime(data.prep_time);
    document.getElementById('recipe-cost').textContent = formatCost(data.cost_per_portion);
    document.getElementById('recipe-author').textContent = data.username || 'Anonyme';

    var ingredientsList = document.getElementById('ingredients-list');
    ingredientsList.innerHTML = '';
    var ingredients = parseJSON(data.ingredients);
    ingredients.forEach(function(item) {
        var li = document.createElement('li');
        li.textContent = item;
        ingredientsList.appendChild(li);
    });

    // Même pattern pour steps
    // ...

    var storyEl = document.getElementById('recipe-story');
    if (data.anecdote) {
        storyEl.textContent = data.anecdote;
    } else {
        storyEl.parentElement.style.display = 'none';
    }

    renderRatingDisplay(data.average_rating, data.rating_count || 0);
    currentComments = data.comments || [];
    renderComments(currentComments);
}
```

Remplit les éléments HTML avec les données de la recette. Points importants :

- `document.title` change le titre de l'onglet
- `textContent` utilisé partout → pas de risque XSS (contrairement à `innerHTML`)
- `parseJSON(data.ingredients)` convertit le JSON string (stocké en base) en tableau JS
- Les ingrédients et étapes sont créés avec `createElement('li')` + `textContent` — pas de `innerHTML` pour la liste
- Si pas d'anecdote, toute la section est cachée via `parentElement.style.display`

### 3.3 — parseJSON (`frontend/public/js/detail.js:67`)

```js
function parseJSON(data) {
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') {
        try { return JSON.parse(data); } catch { return []; }
    }
    return [];
}
```

Fonction utilitaire qui gère deux cas :

1. Si `data` est déjà un tableau (déjà parsé par le serveur), le retourner tel quel
2. Si `data` est une string, la parser avec `JSON.parse()`
3. Si ni l'un ni l'autre, retourner un tableau vide

Utile parce que selon l'endpoint ou la version, `ingredients` peut arriver déjà parsé (par le `res.json()` du fetch) ou encore en string (si le serveur le renvoie brut).

### 3.4 — renderComments (`frontend/public/js/detail.js:129`)

```js
function renderComments(comments) {
    var list = document.getElementById('reviews-list');
    var noReviews = document.getElementById('no-reviews');

    list.innerHTML = '';

    if (!comments || comments.length === 0) {
        noReviews.style.display = 'block';
        return;
    }

    noReviews.style.display = 'none';

    comments.forEach(function(c) {
        var li = document.createElement('li');
        li.className = 'review-item';
        var date = c.created_at ? new Date(c.created_at).toLocaleDateString('fr-FR') : '';
        li.innerHTML =
            '<div class="review-item-meta">' +
                '<span class="review-author">' + escapeHTML(c.pseudo || 'Anonyme') + '</span>' +
                '<span class="review-date">' + date + '</span>' +
            '</div>' +
            '<p>' + escapeHTML(c.content || '') + '</p>';
        list.appendChild(li);
    });
}
```

Ici, `innerHTML` est utilisé (pas `textContent`), mais **avec `escapeHTML()`** autour de chaque valeur utilisateur. C'est le pattern correct :

- `escapeHTML(c.pseudo)` → le pseudo de l'auteur, même s'il contient `<script>`, est transformé en texte
- `escapeHTML(c.content)` → le contenu du commentaire, pareil

`escapeHTML()` utilise le DOM pour échapper : `document.createTextNode(str)` transforme tout en texte, puis `.innerHTML` récupère la version HTML-échappée.

### 3.5 — submitRating et submitComment (`frontend/public/js/detail.js:24`)

```js
async function submitComment(recipeId, formData) {
    var body = { content: formData.comment };
    var headers = { 'Content-Type': 'application/json' };
    var token = getToken();
    if (token) {
        headers['Authorization'] = 'Bearer ' + token;
    } else {
        body.guest_name = formData.pseudo;
    }

    var response = await fetch('/api/v1/recipes/' + recipeId + '/comments', {
        method: 'POST', headers: headers, body: JSON.stringify(body)
    });
    // ...
}

async function submitRating(recipeId, score) {
    var response = await fetch('/api/v1/recipes/' + recipeId + '/ratings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + getToken()
        },
        body: JSON.stringify({ score: score })
    });
    // ...
}
```

**Commentaires** : supporte à la fois les utilisateurs connectés (token JWT) et les invités (pseudo libre envoyé dans `guest_name`). Si le token existe, le commentaire est associé à l'utilisateur. Sinon, le pseudo est stocké directement.

**Notation** : nécessite un utilisateur connecté (le token est obligatoire). Impossible pour un invité de noter — c'est une décision de conception pour éviter les notes anonymes abusives.

### 3.6 — handleCommentSubmit (`frontend/public/js/detail.js:164`)

```js
function handleCommentSubmit(e) {
    e.preventDefault();
    var form = document.getElementById('review-form');
    var formData = new FormData(form);
    var data = Object.fromEntries(formData.entries());

    // Validation
    // ...

    var submitter = (function(recipeId, data, isAuthed) {
        return async function() {
            try {
                if (isAuthed && rating) {
                    // Envoie la note d'abord
                    await submitRating(recipeId, score);
                }
                // Puis le commentaire
                await submitComment(recipeId, { comment: data.comment, pseudo: pseudo });
                form.reset();
                // Re-fetch la recette pour avoir les données à jour
                recipe = await fetchRecipe(recipeId);
                renderRatingDisplay(recipe.average_rating, recipe.rating_count || 0);
                renderComments(recipe.comments || []);
            } catch (err) {
                alert(err.message || 'Erreur lors de l\'envoi.');
            }
        };
    })(recipe.id, data, isAuthenticated());

    submitter();
}
```

Pattern intéressant : **IIFE (Immediately Invoked Function Expression)** à l'intérieur du handler. La fonction externe capture `recipeId`, `data`, et `isAuthed` dans une closure, et retourne une fonction async qui est immédiatement exécutée.

Si l'utilisateur est connecté ET a sélectionné une note, la note est envoyée en premier (avant le commentaire). Si la note échoue (par exemple, l'utilisateur essaie de noter sa propre recette), on logge l'erreur mais on continue (le commentaire est envoyé quand même).

Après succès, on **re-fetch** la recette pour récupérer les données à jour (nouveau commentaire, nouvelle moyenne). C'est plus simple que de manipuler le tableau `currentComments` manuellement.

### 3.7 — toggleFavorite (`frontend/public/js/detail.js:255`)

```js
async function toggleFavorite() {
    if (!isAuthenticated()) {
        openLoginModal();
        return;
    }

    var btn = document.getElementById('btn-save');
    btn.disabled = true;
    btn.textContent = '...';

    try {
        var result = await apiRequest('/favorites/' + recipe.id, { method: 'POST' });
        recipe.is_favorited = result.favorited;
        updateSaveButton();
    } catch (err) {
        alert(err.message || 'Erreur lors de la sauvegarde.');
    } finally {
        btn.disabled = false;
    }
}
```

Si l'utilisateur n'est pas connecté, ouvre la modale de connexion (au lieu de rediriger). Sinon, envoie une requête POST à `/api/v1/favorites/:id` qui agit comme un toggle : si la recette est déjà en favori, elle est retirée ; sinon, elle est ajoutée.

Le résultat contient `result.favorited` (booléen) qui indique le nouvel état. `updateSaveButton()` met à jour le texte et la classe CSS du bouton.

### 3.8 — shareRecipe (`frontend/public/js/detail.js:231`)

```js
function shareRecipe() {
    if (navigator.share) {
        navigator.share({
            title: recipe.title,
            text: 'Découvrez cette recette: ' + recipe.title,
            url: window.location.href
        }).catch(function(err) {
            if (err.name !== 'AbortError') copyLink();
        });
    } else {
        copyLink();
    }
}

function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(function() {
        alert('Lien copié dans le presse-papier!');
    }).catch(function() {
        prompt('Copiez ce lien:', window.location.href);
    });
}
```

**Web Share API** (`navigator.share`) : API native des navigateurs mobiles (et Chrome desktop depuis 2022). Ouvre le menu de partage du système (messages, WhatsApp, email, etc.).

Si l'API n'est pas disponible (`navigator.share` est `undefined`), on tombe dans `copyLink()` qui copie l'URL dans le presse-papier via `navigator.clipboard.writeText()`. Si même ça échoue (ancien navigateur, contexte non sécurisé), on utilise `prompt()` qui affiche une boîte de dialogue avec le lien pré-sélectionné — l'utilisateur n'a plus qu'à copier manuellement.

`AbortError` : si l'utilisateur ferme le menu de partage sans choisir de destination, `navigator.share()` lance une `AbortError` — on ignore cette erreur (`if (err.name !== 'AbortError')`).

### 3.9 — escapeHTML (`frontend/public/js/detail.js:156`)

```js
function escapeHTML(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}
```

Version alternative de celle dans `moderation-panel.js` : ici on utilise `appendChild` avec `createTextNode` au lieu de `textContent`. Résultat identique mais avec une étape supplémentaire : création d'un nœud texte, attachement au div, puis lecture du innerHTML.

---

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

```
1. L'utilisateur arrive sur recipe.html?id=42
2. init() est appelé
3. getUrlParam('id') → "42"
4. Si pas d'id → affichage erreur "Paramètre manquant"
5. fetchRecipe(42) :
   a. GET /api/v1/recipes/42 (avec token si connecté)
   b. Si recette inexistante → affichage erreur "Recette introuvable"
6. renderRecipe(data) :
   a. Titre de l'onglet, catégorie, titre, temps, coût, auteur
   b. parseJSON(ingredients) → boucle forEach → <li> pour chaque ingrédient
   c. parseJSON(steps) → boucle forEach → <li> pour chaque étape
   d. Anecdote si présente
   e. Étoiles de notation + nombre d'avis
   f. Liste des commentaires
7. updateSaveButton() → état du bouton favori (sauvegardé ou non)
8. initEventListeners() :
   a. Clic "Sauvegarder" → toggleFavorite
   b. Clic "Laisser un avis" → afficher formulaire
   c. Clic "Partager" → shareRecipe
   d. Submit formulaire → handleCommentSubmit
9. L'utilisateur peut :
   - Noter (étoiles) et commenter en une seule soumission
   - Sauvegarder/retirer des favoris
   - Partager via l'API native ou copier le lien
```

---

## 5. ANALOGIE

La page de détail, c'est comme une **fiche de recette dans un album de famille** :

- Le titre en haut, comme le nom du plat écrit en belle lettre
- Les infos (temps, coût, catégorie) comme les petites étiquettes sur le côté
- La liste des ingrédients, comme la liste de course au dos de l'enveloppe
- Les étapes numérotées, comme les instructions qu'on se passe entre cousins
- L'anecdote en bas, c'est l'histoire griffonnée dans la marge : "Ce jour-là, le frigo était vide mais les voisins étaient là..."
- Les commentaires en dessous, c'est le livre d'or : "Excellent ! J'ai remplacé les lardons par du tofu..."
- Le bouton favori, c'est le petit signet pour retrouver la page plus tard
- Le bouton partager, c'est la photocopie qu'on glisse à sa sœur

`escapeHTML()`, c'est comme vérifier qu'il n'y a pas de punaise dans la lettre avant de l'afficher au tableau d'affichage.

---

## 6. PIÈGES CLASSIQUES

### Piège #1 : XSS via les commentaires

```js
// MAUVAIS : innerHTML sans échappement
li.innerHTML = '<p>' + c.content + '</p>';
// Si content = "<img src=x onerror=alert(1)>" → exécution JS

// BON : escapeHTML
li.innerHTML = '<p>' + escapeHTML(c.content) + '</p>';
// <img src=x onerror=alert(1)> devient texte inoffensif
```

### Piège #2 : Notation non autorisée (sa propre recette)

Le frontend envoie la note même si la recette appartient à l'utilisateur connecté. Le serveur doit bloquer ça avec une erreur appropriée. Le frontend catch l'erreur mais continue quand même (`console.warn('Rating failed (may be own recipe)')`).

### Piège #3 : Le re-fetch après commentaire écrase les modifications locales

Après avoir commenté, `fetchRecipe()` est rappelée pour récupérer les données à jour. Si entre-temps l'utilisateur avait modifié localement quelque chose (ex: ouvert un autre onglet), les données sont remplacées. C'est un choix acceptable.

### Piège #4 : Web Share API non supportée

`navigator.share()` n'est disponible que sur HTTPS et dans certains navigateurs (Safari mobile, Chrome mobile). Sur desktop HTTP, `navigator.share` est `undefined` → fallback sur `copyLink()` qui fonctionne partout. Mais `navigator.clipboard` nécessite aussi HTTPS ou `localhost`.

---

## 7. ET SI ON FAISAIT AUTREMENT ?

### Option A : Utiliser `apiRequest` pour toutes les requêtes

- **Comment ça marche** : Remplacer les `fetch()` individuels par `apiRequest()`.
- **Avantage** : Cohérence, moins de duplication, token injecté automatiquement.
- **Inconvénient** : `apiRequest()` retourne `data.data` ou lance une erreur — il faudrait adapter les handlers.
- **Notre cas** : La moitié des appels utilisent `apiRequest` (toggleFavorite), l'autre moitié du `fetch` direct. C'est un défaut de cohérence.

### Option B : Remplacer `innerHTML` échappé par `createElement` + `textContent`

- **Comment ça marche** : Créer chaque nœud DOM à la main au lieu de construire une string HTML.
- **Avantage** : Impossible d'oublier `escapeHTML` — pas de risque XSS.
- **Inconvénient** : Plus verbeux, surtout pour des structures imbriquées.
- **Notre cas** : Le pattern `createElement('li')` + `textContent` est utilisé pour les ingrédients/étapes. Pour les commentaires, `innerHTML` + `escapeHTML` est un compromis acceptable.

---

## 8. CHECKLIST POUR LE JURY

- [ ] `fetchRecipe()` retourne `null` si la recette n'existe pas (et pas une erreur non catchée)
- [ ] `renderRecipe()` utilise `textContent` pour les valeurs textuelles et `escapeHTML()` pour les `innerHTML`
- [ ] `parseJSON()` gère les cas où les données sont déjà parsées ou encore en string
- [ ] Les ingrédients et étapes sont affichés avec `createElement` + `textContent` (pas de XSS)
- [ ] `renderComments()` échappe `c.pseudo` et `c.content` via `escapeHTML()`
- [ ] Le formulaire de commentaire supporte les utilisateurs connectés ET les invités
- [ ] La notation nécessite d'être connecté (token JWT obligatoire)
- [ ] Le re-fetch après commentaire met à jour l'affichage (moyenne + commentaires)
- [ ] `toggleFavorite()` ouvre la modale de login si pas connecté (pas une redirection)
- [ ] `shareRecipe()` utilise `navigator.share` si disponible, sinon `copyLink()`, sinon `prompt()`
- [ ] L'ID de la recette est extrait de l'URL via `getUrlParam('id')`
