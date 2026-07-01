# 30 — Formulaire de Soumission Recette

## 1. CE QUE ÇA FAIT (vue d'ensemble)

La page de soumission permet à un utilisateur connecté de poster une nouvelle recette. Le formulaire :

- Vérifie que l'utilisateur est connecté avant de montrer le formulaire (`checkLoginState`)
- Convertit les champs `ingredients` et `steps` (textarea → tableau JSON via `parseListInput`)
- Remplit des anecdotes pré-définies via des boutons "preset"
- Envoie la recette à `POST /api/v1/recipes` avec le token JWT
- Affiche un message de succès après soumission
- Redirige vers login si non connecté (avec `redirect` pour revenir après connexion)
- Fournit un hook `window.afterLogin` pour réagir à une connexion sans recharger la page

---

## 2. SCHÉMA DE LA TABLE

**Fichier :** `database/scripts/03_create_tables.sql:54`

```sql
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
    author_pseudo       VARCHAR(100) DEFAULT NULL,
    average_rating      DECIMAL(3,2) UNSIGNED NOT NULL DEFAULT 0.00,
    rating_count        SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at          DATETIME NULL DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (category_id) REFERENCES categories(id)
);
```

Ce qui nous intéresse pour la soumission :

- `title`, `anecdote`, `ingredients` (JSON), `steps` (JSON), `prep_time`, `cost_per_portion`, `category_id` → remplis par le formulaire
- `user_id` → déduit du token JWT côté serveur (pas envoyé depuis le formulaire)
- `author_pseudo` → stocké côté client (pour les invités ou fallback)
- `status` → par défaut `'pending'` (en attente de modération)

---

## 3. LE CODE

### 3.1 — parseListInput (`frontend/public/js/submit.js:37`)

```js
function parseListInput(text) {
    return text.split('\n')
        .map(function(line) { return line.trim(); })
        .filter(function(line) { return line.length > 0; });
}
```

Prend une textarea (une ligne par ingrédient/étape) et la convertit en tableau :

```
"Farine\nŒufs\n  Lait  \n" → ["Farine", "Œufs", "Lait"]
```

- `split('\n')` découpe le texte à chaque saut de ligne
- `map(trim)` enlève les espaces au début et à la fin de chaque ligne
- `filter(Boolean)` enlève les lignes vides (si l'utilisateur a laissé des lignes vides)

Le résultat est envoyé tel quel (tableau natif) car la colonne `ingredients` et `steps` sont de type JSON en base — c'est le modèle backend qui sérialise en JSON via `JSON.stringify()` avant insertion.

### 3.2 — checkLoginState (`frontend/public/js/submit.js:15`)

```js
function checkLoginState() {
    var authed = typeof isAuthenticated === 'function' && isAuthenticated();
    if (authed) {
        loginRequired.style.display = 'none';
        submitFormContainer.style.display = 'block';
    } else {
        loginRequired.style.display = 'block';
        submitFormContainer.style.display = 'none';
    }
}
```

Au chargement de la page, on vérifie si l'utilisateur est connecté. Si oui, on montre le formulaire. Si non, on montre le message "Connectez-vous pour soumettre une recette".

La vérification `typeof isAuthenticated === 'function'` est une sécurité : si `auth.js` n'a pas été chargé (ordre des scripts incorrect), `isAuthenticated` est `undefined`, et au lieu de planter avec `undefined is not a function`, on entre dans le `else` (formulaire caché).

### 3.3 — afterLogin hook (`frontend/public/js/submit.js:26`)

```js
window.afterLogin = function() {
    checkLoginState();
};
```

Ce hook est appelé par `app.js` après une connexion réussie via la modale. Sans recharger la page, ça permet :

1. L'utilisateur est sur `submit.html`, pas connecté
2. Il clique sur un bouton → la modale de connexion s'ouvre
3. Il se connecte → `closeLoginModal()` puis `window.afterLogin()` est appelé
4. `checkLoginState()` est ré-exécutée → le formulaire apparaît sans rechargement

C'est une forme simple de SPA (single page application) sans framework : on attache une fonction à `window` pour qu'un script (`app.js`) appelle une fonction définie dans un autre script (`submit.js`).

### 3.4 — Boutons d'anecdote preset (`frontend/public/js/submit.js:44`)

```js
document.querySelectorAll('.btn-anecdote-preset').forEach(function(btn) {
    btn.addEventListener('click', function() {
        var target = document.getElementById(this.dataset.target);
        if (target) {
            target.value = this.dataset.text;
        }
    });
});
```

Des boutons avec des attributs `data-target` (l'ID du textarea) et `data-text` (le texte à insérer). Au clic, on remplit le textarea avec une anecdote pré-écrite. Exemple HTML :

```html
<button class="btn-anecdote-preset" data-target="anecdote" data-text="Ce jour-là, le frigo était vide...">
    Frigo vide
</button>
```

Ça utilise `dataset` qui est l'API standard pour accéder aux attributs `data-*` en JS.

### 3.5 — Submit handler (`frontend/public/js/submit.js:53`)

```js
recipeForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    if (!(typeof isAuthenticated === 'function' && isAuthenticated())) {
        window.location.href = '/login.html?redirect=submit.html';
        return;
    }

    var formData = new FormData(recipeForm);
    var data = Object.fromEntries(formData.entries());

    if (!data.title || !data.ingredients || !data.steps || !data.anecdote || !data.category || !data.cost || !data.prep_time) {
        alert('Veuillez remplir tous les champs obligatoires.');
        return;
    }

    var payload = {
        title: data.title,
        ingredients: parseListInput(data.ingredients),
        steps: parseListInput(data.steps),
        anecdote: data.anecdote,
        category_id: parseInt(data.category, 10),
        cost_per_portion: parseFloat(data.cost),
        prep_time: parseInt(data.prep_time, 10)
    };

    try {
        var response = await fetch('/api/v1/recipes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + (typeof getToken === 'function' ? getToken() : localStorage.getItem('ovni_token') || '')
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            submitFormContainer.style.display = 'none';
            submitSuccess.style.display = 'block';
            recipeForm.reset();
        } else {
            var errData = await response.json().catch(function() { return {}; });
            alert(errData.error && errData.error.message || 'Erreur lors de l\'envoi.');
        }
    } catch (error) {
        console.error('Submit failed:', error);
        alert('Erreur lors de l\'envoi. Veuillez réessayer.');
    }
});
```

**Points clés :**

1. `e.preventDefault()` → empêche le rechargement de la page (comportement par défaut du submit)
2. `FormData` récupère tous les champs du formulaire automatiquement, avec leurs `name` HTML
3. `Object.fromEntries()` convertit le FormData en objet JS simple
4. Validation basique champs obligatoires (attention : pas de validation côté backend — c'est le serveur qui fait la validation finale)
5. Le `payload` est construit avec les bons types : `parseFloat` pour le coût, `parseInt` pour le temps, `category_id` en entier. Les tableaux `ingredients` et `steps` sont envoyés natifs — c'est le modèle backend qui les sérialise en JSON.
6. Le token JWT est injecté directement dans le header (pas via `apiRequest` — c'est un choix de conception : submit.js ne dépend pas de `apiRequest` pour ce cas)
7. En cas d'erreur serveur, on essaie de parser le JSON d'erreur, avec un fallback si le body n'est pas du JSON valide

---

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

```
1. L'utilisateur arrive sur submit.html
2. checkLoginState() est appelé
3. a) Connecté → formulaire visible, loginRequired caché
   b) Pas connecté → "Veuillez vous connecter" visible, formulaire caché
4. L'utilisateur remplit le formulaire :
   - Titre, catégorie, coût, temps de préparation
   - Ingrédients (un par ligne dans textarea)
   - Étapes (un par ligne dans textarea)
   - Anecdote (manuellement ou via bouton preset)
5. Clic sur "Soumettre"
6. e.preventDefault() → pas de rechargement
7. Vérification auth (bis) → si déconnecté entre temps, redirection
8. Validation des champs obligatoires
9. Construction du payload :
   - parseListInput() transforme les textareas en tableaux
   - parseFloat/parseInt sur les nombres
   - category_id: parseInt() convertit la valeur du select en entier
10. Envoi POST /api/v1/recipes avec le token JWT
11. Succès → formulaire caché, message de succès affiché
12. Échec → alert() avec le message d'erreur
```

---

## 5. ANALOGIE

La soumission de recette, c'est comme **poster une lettre dans une boîte aux lettres communautaire** :

1. Il faut d'abord être membre du club (connecté) pour avoir le droit de poster
2. Tu écris ta recette sur un papier (le formulaire)
3. Tu listes les ingrédients les uns en dessous des autres (textarea → parseListInput)
4. Tu décris les étapes dans l'ordre (une ligne par étape)
5. Tu ajoutes une petite histoire personnelle (l'anecdote)
6. Tu glisses la lettre dans l'enveloppe et tu la postes (POST /api/v1/recipes)
7. Le facteur (le serveur) la dépose dans la boîte "en attente" (status: pending)
8. Le modérateur (admin) lira la lettre et décidera de la publier ou non

Les boutons preset d'anecdote, ce sont comme des **cartes postales pré-écrites** : au lieu d'inventer à chaque fois, tu pioches une carte qui correspond à ton humeur.

---

## 6. PIÈGES CLASSIQUES

### Piège #1 : Confiance aveugle dans les données du formulaire

Le formulaire envoie `category` (qui est probablement l'ID de catégorie ou le nom). Mais la validation finale est côté serveur. Si le frontend envoie une catégorie inexistante, le serveur doit rejeter la requête.

**Notre frontend** : vérifie juste que le champ n'est pas vide. C'est le backend qui valide l'existence de la catégorie.

### Piège #2 : Stringifier les champs JSON côté frontend

```js
// MAUVAIS : on envoie une string JSON, pas un tableau JS
ingredients: JSON.stringify(parseListInput(data.ingredients))  // → '["Farine","Œufs"]' (string)
// express-validator isArray() reçoit une string → rejette en 422

// BON : on envoie un tableau natif — le backend stringifie avant INSERT
ingredients: parseListInput(data.ingredients)  // → ["Farine", "Œufs"] (tableau JS)
```

### Piège #3 : Le token peut expirer entre l'affichage du formulaire et la soumission

`checkLoginState()` est appelé au chargement, mais si le token expire pendant que l'utilisateur écrit sa recette, la soumission échouera avec une erreur 401. La vérification avant soumission (`if (!isAuthenticated())`) ne détecte pas l'expiration — seulement l'absence.

### Piège #4 : Pas de protection contre la soumission multiple

Si l'utilisateur clique plusieurs fois sur "Soumettre" rapidement, plusieurs requêtes sont envoyées. Il n'y a pas de `disabled` sur le bouton submit pendant l'envoi.

---

## 7. ET SI ON FAISAIT AUTREMENT ?

### Option A : Éditeur d'ingrédients pas à pas (au lieu de textarea)

- **Comment ça marche** : Chaque ingrédient a son propre champ input avec un bouton "Ajouter" et une liste dynamique.
- **Avantage** : UX plus moderne, validation individuelle, possibilité d'ajouter des quantités séparément.
- **Inconvénient** : Plus de code JS, plus de gestion d'état (ajout/suppression d'éléments).
- **Notre cas** : La textarea est plus simple et plus rapide à implémenter. Pour un MVP, ça suffit.

### Option B : Soumission via apiRequest (au lieu de fetch direct)

- **Comment ça marche** : Utiliser `apiRequest()` qui gère déjà le token et les headers.
- **Avantage** : Moins de code, cohérence avec le reste de l'app.
- **Inconvénient** : Moins de contrôle sur le payload exact. Le fetch direct est volontaire pour maîtriser ce qui part au serveur.
- **Notre cas** : Le fetch direct reste le choix actuel car la soumission a des contraintes spécifiques.

---

## 8. CHECKLIST POUR LE JURY

- [ ] `parseListInput()` transforme correctement une textarea multiligne en tableau
- [ ] Les ingrédients et étapes sont envoyés sous forme de **tableaux JS natifs** (pas de string JSON — c'est le backend qui stringifie)
- [ ] Le token JWT est inclus dans le header `Authorization` de la requête
- [ ] Le formulaire est caché si l'utilisateur n'est pas connecté
- [ ] `window.afterLogin` est défini pour réafficher le formulaire après connexion sans rechargement
- [ ] Les champs obligatoires sont validés côté client avant envoi
- [ ] Les nombres (`cost`, `prep_time`) sont convertis avec `parseFloat`/`parseInt`
- [ ] Le formulaire est réinitialisé après soumission réussie (`recipeForm.reset()`)
- [ ] Si le JSON d'erreur est invalide, un message générique est affiché (`.catch(function() { return {}; })`)
- [ ] Le `e.preventDefault()` empêche le rechargement de la page
