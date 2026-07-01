# 31 — Panneau de Modération Admin (Frontend)

## 1. CE QUE ÇA FAIT (vue d'ensemble)

Le panneau de modération est une page réservée aux administrateurs. Elle permet de :

- **Afficher les statistiques** : nombre total de recettes, en attente, publiées, utilisateurs
- **Lister les recettes en attente** avec titre, auteur, date, coût, temps
- **Publier ou rejeter** une recette en attente (avec option de motif de rejet)
- **Voir le top viewed et top rated** des recettes
- **Consulter les logs de modération** (qui a fait quoi, quand)
- **Exporter les recettes en CSV** via une fenêtre dédiée
- **Anti-XSS** avec `escapeHtml()` et `escapeAttr()` pour tout contenu injecté dans le DOM

---

## 2. SCHÉMA DE LA TABLE

Pas de table dédiée. Les données viennent de :

- `recipes` (statistiques, recettes en attente, top viewed/rated)
- `users` (statistiques utilisateurs)
- `moderation_logs` (logs d'action des admins)

---

## 3. LE CODE

### 3.1 — fetchDashboard, fetchPendingRecipes, fetchLogs (`frontend/public/js/moderation-panel.js:9`)

```js
async function fetchDashboard() {
    return apiRequest('/admin/dashboard');
}

async function fetchPendingRecipes() {
    return apiRequest('/admin/recipes?status=pending&sort_by=created_at&limit=50');
}

async function fetchLogs() {
    return apiRequest('/admin/logs?limit=50');
}
```

Trois appels API via `apiRequest()` qui injecte automatiquement le token JWT de l'admin. Si l'utilisateur n'est pas admin, le serveur retourne 403 et `apiRequest()` lance une erreur.

- `/admin/dashboard` → stats globales + top viewed + top rated
- `/admin/recipes` filtré par `status=pending` → recettes en attente de modération, limit 50
- `/admin/logs` → historique des actions de modération, limit 50

### 3.2 — renderStats et renderTopContent (`frontend/public/js/moderation-panel.js:23`)

```js
function renderStats(data) {
    var r = data.recipes;
    document.getElementById('stat-total').textContent = r.total;
    document.getElementById('stat-pending').textContent = r.by_status.pending;
    document.getElementById('stat-published').textContent = r.by_status.published;
    document.getElementById('stat-users').textContent = data.users.total;
    document.getElementById('stat-avg-rating').textContent = '—';
}
```

Simple injection de texte dans des spans. `textContent` plutôt que `innerHTML` → pas de risque XSS.

### 3.3 — renderPendingTable (`frontend/public/js/moderation-panel.js:85`)

```js
function renderPendingTable(recipes) {
    var loadingEl = document.getElementById('moderation-loading');
    var emptyEl = document.getElementById('moderation-empty');
    var wrapperEl = document.getElementById('moderation-table-wrapper');
    var tbody = document.getElementById('moderation-tbody');

    toggleDisplay(loadingEl, false);

    if (!recipes || recipes.length === 0) {
        toggleDisplay(emptyEl, true);
        toggleDisplay(wrapperEl, false);
        return;
    }

    toggleDisplay(emptyEl, false);
    toggleDisplay(wrapperEl, true);
    tbody.innerHTML = '';
    pendingRecipes = recipes;

    recipes.forEach(function(r) {
        var tr = document.createElement('tr');
        tr.id = 'pending-row-' + r.id;
        // ... lignes avec escapeHtml et escapeAttr ...
        tr.innerHTML = '...';
        tbody.appendChild(tr);
    });

    // Wire action buttons
    tbody.querySelectorAll('[data-action]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var action = btn.getAttribute('data-action');
            var id = btn.getAttribute('data-id');
            if (action === 'publish') publishRecipe(id, btn);
            else if (action === 'reject') rejectRecipe(id, btn);
        });
    });
}
```

La fonction :

1. Cache le loader (`toggleDisplay(loadingEl, false)`)
2. Si aucune recette en attente → affiche le message "vide"
3. Sinon → vide le tbody, itère sur les recettes, crée des `<tr>` avec `innerHTML`
4. Utilise `escapeHtml()` et `escapeAttr()` pour protéger contre le XSS
5. Attache les event listeners sur les boutons "Publier" et "Rejeter"

Les boutons utilisent `data-action` et `data-id` pour identifier l'action et la recette cible. Les attributs `aria-label` incluent le titre de la recette (via `escapeAttr`) pour l'accessibilité.

### 3.4 — publishRecipe / rejectRecipe (`frontend/public/js/moderation-panel.js:151`)

```js
async function publishRecipe(id, btn) {
    if (!confirm('Publier cette recette ?')) return;

    btn.disabled = true;
    btn.textContent = 'Publication...';

    try {
        await apiRequest('/admin/recipes/' + id + '/status', {
            method: 'PATCH',
            body: { status: 'published' }
        });

        announceFeedback('Recette publiée');
        removePendingRow(id);
    } catch (error) {
        alert(error.message || 'Erreur lors de la publication');
        btn.disabled = false;
        btn.textContent = 'Publier';
    }
}

async function rejectRecipe(id, btn) {
    var reason = prompt('Motif du rejet (optionnel) :');
    if (reason === null) return;

    btn.disabled = true;
    btn.textContent = 'Rejet...';

    try {
        var body = { status: 'rejected' };
        if (reason && reason.trim()) {
            body.rejection_reason = reason.trim();
        }

        await apiRequest('/admin/recipes/' + id + '/status', {
            method: 'PATCH',
            body: body
        });

        announceFeedback('Recette rejetée');
        removePendingRow(id);
    } catch (error) {
        alert(error.message || 'Erreur lors du rejet');
        btn.disabled = false;
        btn.textContent = 'Rejeter';
    }
}
```

Les deux fonctions suivent le même pattern :

1. **Confirmation** : `confirm()` pour publication (oui/non), `prompt()` pour rejet (avec motif optionnel)
2. **Loading state** : bouton désactivé + texte changeant (indique que l'action est en cours)
3. **Appel API** : `PATCH /admin/recipes/:id/status` avec le nouveau statut
4. **Succès** : message de feedback + retrait de la ligne du tableau
5. **Erreur** : `alert()` + restauration du bouton (disabled: false, texte original)

`prompt()` retourne `null` si l'utilisateur clique "Annuler" → on sort de la fonction. Si l'utilisateur clique "OK" sans rien écrire, `reason` est une string vide → pas de `rejection_reason` dans le body.

### 3.5 — removePendingRow (`frontend/public/js/moderation-panel.js:199`)

```js
function removePendingRow(id) {
    var row = document.getElementById('pending-row-' + id);
    if (row) {
        row.style.background = 'var(--success)';
        row.style.opacity = '0.4';
        row.style.transition = 'opacity 0.3s';
        setTimeout(function() {
            row.remove();
            var tbody = document.getElementById('moderation-tbody');
            if (tbody && tbody.children.length === 0) {
                toggleDisplay(document.getElementById('moderation-table-wrapper'), false);
                toggleDisplay(document.getElementById('moderation-empty'), true);
            }
            var pendingEl = document.getElementById('stat-pending');
            if (pendingEl) {
                var current = parseInt(pendingEl.textContent, 10);
                if (current > 0) pendingEl.textContent = current - 1;
            }
        }, 400);
    }
}
```

Animation simple :

1. Change le fond en vert (via la variable CSS `--success`)
2. Réduit l'opacité à 40% avec une transition CSS de 0.3s
3. Après 400ms (le temps que l'animation se termine), supprime la ligne du DOM
4. Si le tableau devient vide, affiche le message "Aucune recette en attente"
5. Décrémente le compteur "En attente" dans les stats

### 3.6 — escapeHtml et escapeAttr (`frontend/public/js/moderation-panel.js:276`)

```js
function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
```

**`escapeHtml()`** : crée un élément DOM, lui assigne le texte via `textContent` (qui interprète tout comme du texte, pas du HTML), puis récupère le `innerHTML`. Résultat : tous les caractères HTML spéciaux (`<`, `>`, `&`, `"`) sont convertis en entités HTML (`&lt;`, `&gt;`, `&amp;`, `&quot;`).

Exemple : `escapeHtml('<script>alert("xss")</script>')` → `&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;`

**`escapeAttr()`** : remplace les guillemets droits et simples par leurs entités HTML. Utilisé dans `escapeAttr(r.title)` dans `aria-label` et `data-id` pour éviter qu'un titre contenant des guillemets ne casse l'attribut HTML.

### 3.7 — setupExport (`frontend/public/js/moderation-panel.js:266`)

```js
function setupExport() {
    var btn = document.getElementById('export-csv-btn');
    if (!btn) return;
    btn.addEventListener('click', function() {
        window.open('/api/v1/admin/export/recipes', '_blank');
    });
}
```

Au clic, ouvre une nouvelle fenêtre/onglet vers l'URL d'export CSV. Le token JWT n'est pas envoyé automatiquement dans une `window.open()` — le serveur doit gérer l'authentification via une autre méthode (cookie de session ou paramètre d'URL). C'est une limitation de cette approche.

---

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

```
1. L'admin arrive sur moderation-panel.html
2. initModerationPanel() est appelé
3. requireAuth() vérifie le token → redirige vers login si pas connecté
4. getCurrentUser() vérifie le rôle → si pas admin, affiche "unauthorized-state"
5. 3 appels API parallèles :
   a. fetchDashboard() → GET /api/v1/admin/dashboard
   b. fetchPendingRecipes() → GET /api/v1/admin/recipes?status=pending&limit=50
   c. fetchLogs() → GET /api/v1/admin/logs?limit=50
6. Rendu :
   a. renderStats() → les 4 chiffres des stats
   b. renderTopContent() → top viewed + top rated
   c. renderPendingTable() → tableau des recettes en attente
   d. renderLogs() → tableau des logs
   e. setupExport() → attache le listener sur le bouton CSV
7. L'admin clique "Publier" sur une recette :
   a. confirm() → "Publier cette recette ?"
   b. Désactivation du bouton + "Publication..."
   c. PATCH /admin/recipes/:id/status { status: 'published' }
   d. removePendingRow() → animation + suppression
   e. "Recette publiée" dans le feedback
8. L'admin clique "Rejeter" :
   a. prompt() → "Motif du rejet (optionnel)"
   b. Si annulé → rien ne se passe
   c. PATCH avec { status: 'rejected', rejection_reason: '...' }
   d. removePendingRow()
```

---

## 5. ANALOGIE

Le panneau de modération, c'est comme le **standard d'un journal communautaire** :

- Le rédacteur en chef (l'admin) arrive au travail
- Il regarde le tableau de bord : combien d'articles soumis aujourd'hui, combien publiés, combien de lecteurs
- Il a une pile de "courrier des lecteurs" (recettes en attente) sur son bureau
- Chaque lettre a un titre, un auteur, une date
- Il peut :
  - **Publier** : tampon "APPROUVÉ" et la lettre part à l'impression
  - **Rejeter** : tampon "REFUSÉ" avec une petite note explicative
- Quand une lettre est traitée, elle disparaît de la pile
- Il a aussi un registre (logs) qui dit qui a traité quoi et quand
- Et un bouton pour exporter tout le catalogue au format CSV

Les fonctions `escapeHtml` et `escapeAttr`, c'est comme porter des **gants de protection** : on ne touche jamais le contenu à mains nues parce qu'on ne sait pas ce que les lecteurs ont mis dans leurs lettres.

---

## 6. PIÈGES CLASSIQUES

### Piège #1 : Injection XSS via le titre de la recette

```js
// MAUVAIS : innerHTML avec insertion directe
tr.innerHTML = '<td>' + r.title + '</td>';
// Si r.title = "<script>alert('xss')</script>" → le script s'exécute

// BON : via escapeHtml()
tr.innerHTML = '<td>' + escapeHtml(r.title) + '</td>';
// r.title devient "&lt;script&gt;alert('xss')&lt;/script&gt;" → texte inoffensif
```

### Piège #2 : Injection XSS via `aria-label` ou `data-id`

```js
// MAUVAIS
btn.setAttribute('data-id', r.title); // Si titre a des guillemets, ça casse l'attribut

// BON
btn.setAttribute('data-id', escapeAttr(r.id)); // escapeAttr pour les attributs
```

### Piège #3 : L'export CSV ne gère pas l'authentification

`window.open('/api/v1/admin/export/recipes')` ouvre une nouvelle fenêtre. Cette fenêtre n'a pas le token JWT dans ses headers (puisque c'est une navigation, pas un fetch). Si le backend attend un token Bearer, l'export échoue avec 401.

**Solution possible** : utiliser un cookie de session pour l'export, ou passer le token en paramètre d'URL (moins sécurisé mais fonctionnel pour un MVP).

### Piège #4 : Oublier de vérifier le rôle admin côté serveur

La vérification `user.role !== 'admin'` est faite côté client. Mais un utilisateur malveillant pourrait modifier le JS dans les devtools et accéder à la page. La véritable protection est côté serveur : le middleware doit vérifier que l'utilisateur a le rôle admin avant d'exécuter les routes d'administration.

---

## 7. ET SI ON FAISAIT AUTREMENT ?

### Option A : WebSockets pour les mises à jour en temps réel

- **Comment ça marche** : Au lieu de recharger la page, les nouvelles recettes en attente apparaissent automatiquement via une connexion WebSocket.
- **Avantage** : L'admin voit les nouvelles soumissions sans recharger.
- **Inconvénient** : Complexité supplémentaire (gestion de connexion, reconnection, etc.).
- **Notre cas** : Pas justifié pour un MVP. L'admin peut recharger la page manuellement.

### Option B : Confirmation par toast (au lieu de `confirm()`)

- **Comment ça marche** : Une notification temporaire qui disparaît toute seule.
- **Avantage** : UX plus moderne, pas de popup bloquante.
- **Inconvénient** : Plus de code (création/suppression d'éléments DOM).
- **Notre cas** : `confirm()` est plus simple. Le toast (`announceFeedback`) existe déjà pour les messages de succès/erreur.

---

## 8. CHECKLIST POUR LE JURY

- [ ] `requireAuth()` protège l'accès à la page (redirection vers login si pas connecté)
- [ ] Le rôle admin est vérifié côté client (`user.role !== 'admin'`)
- [ ] Tous les contenus utilisateur sont échappés via `escapeHtml()` ou `escapeAttr()` avant insertion dans le DOM
- [ ] L'état des boutons change pendant les appels API (disabled + texte)
- [ ] `confirm()` avant publication, `prompt()` optionnel avant rejet
- [ ] `removePendingRow()` anime la suppression et met à jour les stats
- [ ] Les logs affichent admin, action, cible, date de manière lisible
- [ ] Le bouton d'export CSV ouvre une nouvelle fenêtre vers `/api/v1/admin/export/recipes`
- [ ] Les messages d'erreur sont affichés via `alert()` ou dans `#moderation-feedback`
- [ ] Les tableaux vides affichent un message approprié (via `toggleDisplay`)
