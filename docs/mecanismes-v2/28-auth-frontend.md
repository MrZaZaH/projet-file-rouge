# 28 — Gestion de l'Authentification Frontend (auth.js)

## 1. CE QUE ÇA FAIT (vue d'ensemble)

Le module `auth.js` gère toute la partie frontend de l'authentification :

- **Stocker/récupérer/supprimer le token JWT** dans `localStorage` avec les clés `ovni_token`, `ovni_user`, `ovni_pseudo`, `ovni_email`
- **Appeler l'API** pour se connecter (`loginUser`), s'inscrire (`registerUser`), ou vérifier son token (`fetchCurrentUser`)
- **Mettre à jour l'interface** selon l'état de connexion (`updateAuthUI`)
- **Protéger des pages** en redirigeant vers login si pas connecté (`requireAuth`)
- **Se déconnecter** (`logout`) en vidant le `localStorage` et en redirigeant vers l'accueil

Il n'y a pas de table dédiée à ce mécanisme car tout est géré côté client — le backend stocke les utilisateurs en BDD et génère les JWT, le frontend se contente de garder le token précieusement.

---

## 2. SCHÉMA DE LA TABLE

Pas de table. Le mécanisme repose entièrement sur le `localStorage` du navigateur et l'API back-end.

---

## 3. LE CODE

### 3.1 — Gestion du token (`frontend/public/js/auth.js:16`)

```js
function getToken() {
    return localStorage.getItem('ovni_token');
}

function setToken(token) {
    localStorage.setItem('ovni_token', token);
}

function removeToken() {
    localStorage.removeItem('ovni_token');
    localStorage.removeItem('ovni_user');
    localStorage.removeItem('ovni_pseudo');
    localStorage.removeItem('ovni_email');
}
```

Trois fonctions simples qui encapsulent l'accès au `localStorage`. L'intérêt de les avoir dans des fonctions plutôt que d'appeler `localStorage.getItem()` directement partout : si un jour on change le nom de la clé ou le mode de stockage (sessionStorage, cookie), on modifie un seul endroit.

`removeToken()` vide tout ce qui est lié à l'utilisateur, pas seulement le token. C'est la fonction appelée par `logout()`.

### 3.2 — État utilisateur (`frontend/public/js/auth.js:33`)

```js
function isAuthenticated() {
    return !!getToken();
}

function getCurrentUser() {
    try {
        const raw = localStorage.getItem('ovni_user');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function saveUser(user) {
    localStorage.setItem('ovni_user', JSON.stringify(user));
    if (user.username) localStorage.setItem('ovni_pseudo', user.username);
    if (user.email) localStorage.setItem('ovni_email', user.email);
}
```

`isAuthenticated()` utilise `!!` (double négation) pour convertir la valeur en booléen : si `getToken()` retourne une string, `!!` donne `true` ; si `null`, donne `false`.

`getCurrentUser()` lit l'objet utilisateur stocké en JSON dans `localStorage`. Le `try/catch` est important : si quelqu'un trafique la valeur dans les devtools, `JSON.parse()` peut planter — au lieu de casser la page, on retourne `null`.

`saveUser()` stocke l'utilisateur complet en JSON ET extrait `username` et `email` dans des clés séparées pour un accès rapide (évite de parser le JSON à chaque fois qu'on a besoin juste du pseudo).

### 3.3 — Appels API auth (`frontend/public/js/auth.js:54`)

```js
async function loginUser(email, password) {
    const res = await fetch(AUTH_API + '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error?.message || 'Échec de connexion');
    }
    setToken(data.data.token);
    saveUser(data.data.user);
    return data.data.user;
}
```

`loginUser()` envoie les identifiants au serveur. Si la réponse est OK (statut 2xx), on stocke le token et l'utilisateur, puis on retourne l'utilisateur. Si erreur (401 par exemple), on lance une exception avec le message d'erreur du serveur. L'appelant (dans `app.js`) catch cette erreur et l'affiche dans une `alert()`.

`registerUser()` fonctionne exactement de la même manière mais avec `username` en plus.

### 3.4 — Vérification du token côté client (`frontend/public/js/auth.js:84`)

```js
async function fetchCurrentUser() {
    const token = getToken();
    if (!token) return null;
    try {
        const res = await fetch(AUTH_API + '/me', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) {
            removeToken();
            return null;
        }
        const data = await res.json();
        saveUser(data.data.user);
        return data.data.user;
    } catch {
        removeToken();
        return null;
    }
}
```

Cette fonction est appelée au chargement de la page pour vérifier que le token stocké est encore valide. Si le serveur répond 401 (token expiré ou invalide), on nettoie le `localStorage` (removeToken) pour ne pas laisser traîner un token mort. Pareil si la requête échoue pour une raison réseau.

Note : cette fonction existe dans le code mais n'est pas appelée automatiquement au démarrage sur toutes les pages (seulement sur certaines comme le dashboard). L'UI se base surtout sur la présence du token dans `localStorage` pour décider si l'utilisateur est connecté.

### 3.5 — Mise à jour de l'UI (`frontend/public/js/auth.js:141`)

```js
function updateAuthUI() {
    var userLabel = document.getElementById('user-label');
    var userBtn = document.getElementById('user-btn');
    var mobileUserBtn = document.getElementById('mobile-user-btn');
    var user = getCurrentUser();
    var authed = isAuthenticated();

    if (userLabel) {
        userLabel.textContent = authed ? (user && user.username || 'Mon compte') : 'Se connecter';
    }
    if (userBtn) {
        userBtn.onclick = authed ? goToDashboard : openLoginModal;
        userBtn.setAttribute('aria-label', authed ? 'Mon compte (' + (user && user.username || '') + ')' : 'Se connecter');
    }
    if (mobileUserBtn) {
        mobileUserBtn.textContent = authed ? 'Mon compte' : 'Se connecter';
        mobileUserBtn.onclick = authed ? goToDashboard : openLoginModal;
    }

    var dashLinks = document.querySelectorAll('.auth-link');
    dashLinks.forEach(function(link) {
        link.style.display = authed ? '' : 'none';
    });
}
```

Cette fonction modifie le DOM pour refléter l'état de connexion. Elle change :

- Le texte du bouton utilisateur ("Se connecter" → "Mon compte")
- Le `onclick` (ouvrir la modale → aller au dashboard)
- Les liens qui nécessitent d'être connecté (`.auth-link`) sont cachés si non connecté
- Les `aria-label` pour l'accessibilité

### 3.6 — Route protection (`frontend/public/js/auth.js:173`)

```js
function requireAuth(redirectTo) {
    if (!isAuthenticated()) {
        window.location.href = redirectTo || 'login.html';
        return false;
    }
    return true;
}
```

Fonction appelée en haut des pages protégées (dashboard, favoris, soumission, modération). Si pas de token, redirection immédiate vers la page de login avec le paramètre `redirect` pour revenir après connexion.

### 3.7 — Logout (`frontend/public/js/auth.js:134`)

```js
function logout() {
    removeToken();
    window.location.href = '/';
}
```

Vide le `localStorage` et renvoie à l'accueil. Pas d'appel API — le serveur n'a pas besoin d'être prévenu (le JWT expire tout seul dans 24h). Si on voulait invalider le token côté serveur, il faudrait une blacklist (Redis ou table BDD), ce qui dépasse le cadre du MVP.

---

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

**Scénario : un utilisateur se connecte**

```
1. L'utilisateur clique "Se connecter"
2. openLoginModal() → modale visible, overlay, body overflow hidden
3. Il remplit email + password, clique "Connexion"
4. Le submit handler (dans app.js:172) appelle loginUser(email, password)
5. loginUser() :
   a. FETCH POST /api/v1/auth/login avec { email, password }
   b. Le serveur vérifie les identifiants, génère un JWT, le renvoie
   c. setToken(token) → localStorage.setItem('ovni_token', token)
   d. saveUser(user) → localStorage.setItem('ovni_user', JSON.stringify(user))
6. updateUserUI() est appelé → les boutons passent en "Mon compte"
7. closeLoginModal() → modale cachée, body scrollable
8. if (window.afterLogin) window.afterLogin() → hook optionnel

**Scénario : un utilisateur non connecté accède au dashboard**
1. dashboard.html se charge
2. initDashboard() appelle requireAuth()
3. requireAuth() → isAuthenticated() → pas de token → window.location.href = 'login.html?redirect=dashboard.html'
4. Après connexion, le paramètre redirect est utilisé (via le hook afterLogin ou localStorage)
```

---

## 5. ANALOGIE

Le `localStorage`, c'est comme le **tiroir de ton bureau** :

- Tu ranges ton badge d'accès (le token JWT) dedans
- Quand tu arrives le matin, tu ouvres le tiroir, tu prends le badge
- Tu le montres au vigile à chaque porte (chaque requête API)
- Si tu veux déconnecter, tu jettes le badge à la poubelle (removeToken)
- Le problème : si quelqu'un entre dans ton bureau, il peut ouvrir le tiroir et prendre le badge (vulnérabilité XSS)

Pourquoi ne pas garder le badge dans un coffre-fort (cookie httpOnly) ? Parce que c'est plus complexe à mettre en place et que pour un MVP, le tiroir fait l'affaire.

---

## 6. PIÈGES CLASSIQUES

### Piège #1 : `localStorage` accessible en XSS

Si un attaquant injecte du JavaScript dans la page (via un commentaire, un champ non échappé), il peut exécuter `localStorage.getItem('ovni_token')` et voler le token.

**Solution partielle** : échapper toutes les entrées (les fonctions `escapeHtml`/`escapeHTML` dans le frontend). **Solution complète** : utiliser des cookies `httpOnly` (inaccessibles en JS).

### Piège #2 : Oublier de vérifier les dépendances

`auth.js` doit être chargé AVANT les autres scripts qui utilisent ses fonctions. Dans le HTML :
```html
<script src="js/auth.js"></script>        <!-- en premier -->
<script src="js/app.js"></script>         <!-- en deuxième -->
<script src="js/dashboard.js"></script>    <!-- après -->
```
Si l'ordre est inversé, `requireAuth()` ou `apiRequest()` n'existent pas quand les autres scripts s'exécutent → erreur `undefined is not a function`.

### Piège #3 : Le token expiré mais toujours présent dans localStorage

Si le token a expiré (24h), `isAuthenticated()` retourne `true` (le token est présent) mais toutes les requêtes API protégées retourneront 401. L'utilisateur voit une page "chargée" mais les données ne s'affichent pas.

**Notre approche** : les appels API (via `apiRequest`) attrapent les 401 et peuvent nettoyer le token. Mais si aucune requête n'est faite, l'UI montre "Mon compte" alors que le token est mort. C'est un défaut accepté pour le MVP.

---

## 7. ET SI ON FAISAIT AUTREMENT ?

### Option A : Cookies httpOnly (au lieu de localStorage)

- **Comment ça marche** : Le serveur envoie le token dans un cookie avec le flag `httpOnly` (pas accessible en JS). Le navigateur l'envoie automatiquement à chaque requête.
- **Avantage** : Impossible pour un script XSS de voler le token. Plus sécurisé.
- **Inconvénient** : Plus complexe (gestion des cookies côté serveur, CSRF protection). Le frontend ne peut pas savoir si l'utilisateur est connecté sans faire une requête API.
- **Notre cas** : Pas justifié pour un MVP. Le localStorage est plus simple et plus pédagogique.

### Option B : sessionStorage (au lieu de localStorage)

- **Comment ça marche** : Même API que localStorage, mais les données sont effacées quand on ferme l'onglet.
- **Avantage** : Plus sécurisé (pas de token persistant après fermeture du navigateur).
- **Inconvénient** : L'utilisateur doit se reconnecter à chaque fois qu'il ferme l'onglet. Mauvaise UX.
- **Notre cas** : On veut que l'utilisateur reste connecté entre les sessions (typique d'un réseau social/communautaire).

---

## 8. CHECKLIST POUR LE JURY

- [ ] `getToken()` / `setToken()` / `removeToken()` encapsulent l'accès au `localStorage`
- [ ] `isAuthenticated()` retourne un booléen — pas une string ou null
- [ ] `getCurrentUser()` utilise `try/catch` autour de `JSON.parse()` — sécurisé contre les données corrompues
- [ ] `loginUser()` et `registerUser()` stockent le token APRÈS confirmation du serveur — pas de stockage aveugle
- [ ] `updateAuthUI()` modifie le texte, le onclick, les aria-label, et les `.auth-link`
- [ ] `requireAuth()` redirige vers login avec un paramètre `redirect` si pas connecté
- [ ] `logout()` vide le localStorage ET redirige — pas de demi-mesure
- [ ] L'ordre de chargement des scripts est correct : `auth.js` avant les autres
- [ ] Le `window.afterLogin` hook permet aux pages (comme submit.js) de réagir après connexion
