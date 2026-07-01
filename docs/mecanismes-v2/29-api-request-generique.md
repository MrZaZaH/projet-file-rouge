# 29 — Appel API Générique (apiRequest)

## 1. CE QUE ÇA FAIT (vue d'ensemble)

`apiRequest()` est une fonction utilitaire qui encapsule tous les appels `fetch()` vers l'API back-end. Elle :

- Ajoute automatiquement le header `Content-Type: application/json`
- Injecte le token JWT dans le header `Authorization: Bearer <token>` si l'utilisateur est connecté
- Convertit automatiquement le body en JSON
- Parse la réponse JSON
- Lance une erreur si la réponse HTTP n'est pas OK (statut >= 400)
- Retourne `data.data` (le contenu utile) ou `data` si `data` n'existe pas

C'est une **couche d'abstraction** : au lieu d'écrire `fetch()` + headers + JSON.parse + gestion d'erreur à chaque appel, on appelle juste `apiRequest('/users/me/profile')`.

---

## 2. SCHÉMA DE LA TABLE

Pas de table.

---

## 3. LE CODE

### 3.1 — apiRequest (`frontend/public/js/auth.js:106`)

```js
async function apiRequest(endpoint, options) {
    options = options || {};
    const token = getToken();
    const headers = { 'Content-Type': 'application/json' };

    if (options.headers) {
        Object.assign(headers, options.headers);
    }

    if (token) {
        headers['Authorization'] = 'Bearer ' + token;
    }

    const res = await fetch('/api/v1' + endpoint, {
        method: options.method || 'GET',
        headers: headers,
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.error?.message || 'Erreur serveur');
    }

    return data.data || data;
}
```

**Décomposition ligne par ligne :**

```js
options = options || {};
```
Si `options` n'est pas fourni (`undefined`), on le remplace par un objet vide. Évite les `Cannot read property 'method' of undefined`.

```js
const token = getToken();
```
On va chercher le token JWT dans le localStorage. S'il n'existe pas, `token` sera `null` ou `undefined`.

```js
const headers = { 'Content-Type': 'application/json' };
```
Header par défaut : on dit au serveur qu'on envoie et qu'on attend du JSON.

```js
if (options.headers) {
    Object.assign(headers, options.headers);
}
```
Si l'appelant a fourni des headers supplémentaires (par exemple pour uploader un fichier avec un Content-Type différent), on les fusionne avec les headers par défaut. `Object.assign()` copie les propriétés de `options.headers` dans `headers`.

```js
if (token) {
    headers['Authorization'] = 'Bearer ' + token;
}
```
Si on a un token, on l'ajoute dans le header d'autorisation. Le format `Bearer <token>` est le standard JWT. Le préfixe "Bearer" signifie "porteur du token" — c'est une convention HTTP.

```js
const res = await fetch('/api/v1' + endpoint, {
    method: options.method || 'GET',
    headers: headers,
    body: options.body ? JSON.stringify(options.body) : undefined
});
```
On construit l'URL en préfixant `/api/v1` automatiquement. L'appelant n'a besoin de fournir que la fin du chemin (ex: `/auth/login`). Le body, s'il existe, est converti en JSON.

```js
const data = await res.json();
```
On parse la réponse JSON. Si le serveur renvoie du JSON invalide, `res.json()` lance une erreur.

```js
if (!res.ok) {
    throw new Error(data.error?.message || 'Erreur serveur');
}
```
Si le statut HTTP est >= 400, on lance une erreur avec le message du serveur (ou un message générique si le message n'existe pas). L'appelant peut catcher cette erreur avec `try/catch`.

```js
return data.data || data;
```
La norme de l'API est de retourner `{ success: true, data: { ... } }`. Donc `data.data` est le contenu utile. Mais si pour une raison quelconque `data.data` n'existe pas (ancien endpoint, réponse différente), on retourne `data` en fallback.

---

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

**Appel : `await apiRequest('/users/me/profile')`**

```
1. options = {} (pas fourni)
2. token = 'eyJhbGciOiJIUzI1NiIs...' (récupéré du localStorage)
3. headers = { 'Content-Type': 'application/json' }
4. Token existe → headers['Authorization'] = 'Bearer eyJhbGci...'
5. fetch('http://localhost:3000/api/v1/users/me/profile', {
     method: 'GET',
     headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ...' },
     body: undefined
   })
6. Réponse : { success: true, data: { user: { id: 1, username: 'Jean' }, stats: {...} } }
7. res.ok = true (status 200)
8. Retourne data.data = { user: {...}, stats: {...} }
```

**Appel avec erreur : `await apiRequest('/admin/recipes/' + id + '/status', { method: 'PATCH', body: { status: 'published' } })`**

```
1. options = { method: 'PATCH', body: { status: 'published' } }
2. headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ...' }
3. fetch('.../admin/recipes/42/status', {
     method: 'PATCH',
     headers: { ... },
     body: JSON.stringify({ status: 'published' })
   })
4. Réponse : { success: false, error: { message: 'Unauthorized: admin only' } }
5. res.ok = false (status 403)
6. throw new Error('Unauthorized: admin only')
7. L'appelant dans le catch affiche l'erreur
```

---

## 5. ANALOGIE

`apiRequest`, c'est comme un **facteur dévoué** :

- Tu lui donnes une adresse (l'endpoint) et éventuellement un colis (le body)
- Il sait que toutes les lettres doivent avoir un tampon "Content-Type: JSON"
- Si tu as un badge (token JWT), il l'épingle automatiquement sur l'enveloppe
- Il va à la poste centrale (le préfixe `/api/v1` est ajouté automatiquement)
- Il attend la réponse, l'ouvre, et vérifie que c'est pas une lettre d'erreur
- Si c'est une erreur, il te prévient immédiatement
- Si c'est OK, il te donne seulement le contenu utile (pas tout l'emballage `{ success, data }`)

Sans lui, tu devrais à chaque fois :
1. Mettre le timbre (Content-Type)
2. Épingler le badge (Authorization)
3. Aller à la poste centrale (préfixe /api/v1)
4. Ouvrir la lettre (res.json())
5. Vérifier qu'il n'y a pas d'erreur
6. Enlever l'emballage (data.data)

---

## 6. PIÈGES CLASSIQUES

### Piège #1 : Oublier de catcher l'erreur

```js
// MAUVAIS : si la requête échoue, l'erreur non catchée fait planter tout le script
var profile = await apiRequest('/users/me/profile');

// BON : on catch l'erreur et on gère le cas
try {
    var profile = await apiRequest('/users/me/profile');
    renderProfile(profile);
} catch (error) {
    showError(error.message);
}
```

### Piège #2 : Modifier le Content-Type par défaut par erreur

```js
// MAUVAIS : on écrase complètement les headers
apiRequest('/upload', {
    headers: { 'Content-Type': 'multipart/form-data' }  // ← l'apiRequest ajoute déjà Content-Type: application/json par défaut, mais ici on écrase
});

// Ici Object.assign() va remplacer 'application/json' par 'multipart/form-data' dans headers
// Mais si on avait voulu GARDER le Content-Type par défaut ET ajouter un autre header :
apiRequest('/endpoint', {
    headers: { 'X-Custom': 'value' }  // ← Content-Type sera gardé, X-Custom ajouté
});
```

### Piège #3 : Le préfixe `/api/v1` en double

Si un appelant écrit :
```js
apiRequest('/api/v1/users/me/profile');
```
L'URL finale sera `/api/v1/api/v1/users/me/profile` → 404. L'appelant doit fournir le chemin sans le préfixe.

---

## 7. ET SI ON FAISAIT AUTREMENT ?

### Option A : Axios (librairie externe)

- **Comment ça marche** : Axios est une librairie Node.js/navigateur qui fait la même chose que `fetch()` mais avec une API plus riche.
- **Avantage** : Interceptors (exécuter du code avant/après chaque requête), timeout natif, annulation de requête.
- **Inconvénient** : Dépendance externe (50KB minifiée). Dans un projet de formation, utiliser `fetch()` natif montre qu'on comprend le fonctionnement sous-jacent.
- **Notre cas** : `fetch()` + notre wrapper maison suffisent. Pas d'over-engineering.

### Option B : Pas de wrapper du tout

- **Comment ça marche** : Chaque fichier fait son propre `fetch()` avec ses propres headers.
- **Avantage** : Rien à apprendre, pas d'abstraction.
- **Inconvénient** : Duplication massive de code. Si on change le préfixe API ou le format du token, il faut modifier 20 fichiers au lieu d'un.
- **Notre cas** : Le wrapper est justifié dès qu'on a plus de 2 appels API. C'est le cas ici.

---

## 8. CHECKLIST POUR LE JURY

- [ ] Les headers incluent `Content-Type: application/json` par défaut
- [ ] Le token JWT est injecté automatiquement dans `Authorization: Bearer <token>` s'il existe
- [ ] L'URL est préfixée par `/api/v1` — l'appelant ne fournit que le chemin relatif
- [ ] Le body est converti en JSON via `JSON.stringify()` si présent
- [ ] `res.json()` est appelée une seule fois (pas deux lectures du body)
- [ ] Une erreur est levée si `res.ok` est faux, avec le message du serveur si disponible
- [ ] La fonction retourne `data.data` (format standardisé) ou `data` en fallback
- [ ] Les options supplémentaires (method, body, headers) sont fusionnées correctement
- [ ] Si `options` n'est pas fourni, la fonction ne plante pas (grâce à `options = options || {}`)
