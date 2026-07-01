# #5 — Réponses API Standardisées

## 1. CE QUE ÇA FAIT (vue d'ensemble)

Toutes les réponses de l'API suivent le même squelette JSON : `{ success, data, message }` pour les succès, `{ success, error: { message, code } }` pour les erreurs. Deux petites fonctions helper (`sendSuccess` et `sendError`) garantissent que ce contrat est respecté partout, sans que chaque contrôleur ait à réécrire le format. Le frontend peut ainsi traiter les réponses de façon prévisible : il vérifie `success` pour savoir si ça a marché, lit `data` pour les résultats, ou `error` pour les messages d'erreur.

## 2. SCHÉMA DE LA TABLE

Pas de table SQL — les réponses API sont un format de données, pas une structure persistée.

## 3. LE CODE

### 3.1 — `src/utils/apiResponse.js` (chemin: `src/utils/apiResponse.js:1-56`)

```javascript
/**
 * @file apiResponse.js
 * @description Standardized HTTP response helpers.
 * All controllers must use these instead of res.json() directly.
 * This guarantees a consistent contract for the frontend.
 */

'use strict';

/**
 * Send a success response.
 */
const sendSuccess = (res, data, message = null, statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        data,
        message,
    });
};
```

**Ligne 13 :** La fonction `sendSuccess` prend 4 paramètres :
- `res` : l'objet réponse Express (obligatoire — c'est lui qui envoie la réponse HTTP)
- `data` : les données à renvoyer (objet, tableau, ou null)
- `message` : un message optionnel (par défaut `null`)
- `statusCode` : le code HTTP (par défaut 200)

**Lignes 14-19 :** Le format de réponse est :
```json
{
  "success": true,
  "data": { ... },
  "message": null
}
```

**Pourquoi trois champs seulement ?** Chaque champ a un rôle précis :
- `success: true` → le frontend peut faire un `if (!response.success)` pour détecter une erreur
- `data` → les données utiles (utilisateur, recette, liste...)
- `message` → un message informatif optionnel (ex: "Compte créé avec succès")

Pas de champs inutiles. Pas de bruit. Le frontend sait exactement quoi chercher.

```javascript
/**
 * Convert HTTP status code to readable error code
 */
const statusCodeToCode = (status) => {
    const codes = {
        400: 'BAD_REQUEST',
        401: 'UNAUTHORIZED',
        403: 'FORBIDDEN',
        404: 'NOT_FOUND',
        409: 'CONFLICT',
        422: 'VALIDATION_ERROR',
        500: 'INTERNAL_ERROR'
    };
    return codes[status] || 'ERROR';
};
```

**Lignes 24-35 :** Cette fonction convertit un code HTTP numérique en un code lisible et stable. `401` devient `UNAUTHORIZED`, `404` devient `NOT_FOUND`, etc.

**Pourquoi ne pas utiliser directement le message d'erreur comme code ?** Le code lisible permet au frontend de faire des switch/case sans dépendre d'un message qui pourrait changer (traduction, reformulation). `error.code === 'NOT_FOUND'` est plus fiable que `error.message.includes('not found')`.

**Pourquoi `'ERROR'` comme fallback ?** Si on reçoit un code HTTP non prévu (ex: 418 "I'm a teapot"), on utilise un code générique plutôt que de planter. L'API reste robuste même face à l'imprévu.

```javascript
/**
 * Send an error response.
 */
const sendError = (res, message, statusCode = 500, details = null) => {
    const response = {
        success: false,
        error: {
            message,
            code: statusCodeToCode(statusCode)
        }
    };

    if (details) {
        response.error.details = details;
    }

    return res.status(statusCode).json(response);
};

module.exports = { sendSuccess, sendError };
```

**Ligne 40 :** `sendError` prend 4 paramètres :
- `res` : l'objet réponse Express
- `message` : le message d'erreur (ex: "Invalid email or password")
- `statusCode` : le code HTTP (par défaut 500)
- `details` : des détails supplémentaires optionnels (ex: les erreurs de validation d'express-validator)

**Lignes 41-47 :** Format de réponse :
```json
{
  "success": false,
  "error": {
    "message": "Invalid email or password",
    "code": "UNAUTHORIZED"
  }
}
```

**Ligne 49-51 :** Le paramètre `details` permet d'ajouter des informations structurées supplémentaires sans casser le format standard. Exemple avec les erreurs de validation :
```json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": [
      { "field": "email", "message": "Email is required" },
      { "field": "password", "message": "Password must be at least 8 characters" }
    ]
  }
}
```

### 3.2 — Exemple d'utilisation dans un contrôleur réel

```javascript
// Dans src/controllers/authController.js (extrait réel du pattern)
const { sendSuccess, sendError } = require('../utils/apiResponse');

// Succès : inscription
const user = await UserModel.create({ username, email, password_hash });
sendSuccess(res, { user: { id: user.id, username, email } }, 'Account created successfully', 201);

// Erreur : email déjà pris
sendError(res, 'Email already in use', 409);

// Erreur : validation
const errors = validationResult(req);
if (!errors.isEmpty()) {
    return sendError(res, 'Validation failed', 422, errors.array());
}
```

**Pourquoi `return sendError()` ?** Pour empêcher la suite du code de s'exécuter. Sans `return`, le contrôleur continuerait après l'envoi de l'erreur — ce qui provoquerait une deuxième tentative d'envoi de réponse (crash Express). En revanche, `sendSuccess` est généralement utilisé sans `return` car il est en fin de fonction.

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

```
Pour un SUCCÈS (ex: création d'une recette) :
↓
Contrôleur appelle sendSuccess(res, newRecipe, 'Recipe created', 201)
↓
sendSuccess construit l'objet :
  { success: true, data: { id: 42, title: "Pâtes carbonara", ... }, message: "Recipe created" }
↓
res.status(201).json(response) envoie la réponse HTTP
↓
Frontend reçoit :
  {
    "success": true,
    "data": { "id": 42, "title": "Pâtes carbonara" },
    "message": "Recipe created"
  }
↓
Frontend vérifie response.success === true → affiche successToast + redirige

Pour une ERREUR (ex: recette non trouvée) :
↓
Contrôleur appelle sendError(res, 'Recipe not found', 404)
↓
sendError convertit 404 → 'NOT_FOUND' via statusCodeToCode()
↓
sendError construit l'objet :
  { success: false, error: { message: "Recipe not found", code: "NOT_FOUND" } }
↓
res.status(404).json(response) envoie la réponse HTTP
↓
Frontend reçoit :
  {
    "success": false,
    "error": { "message": "Recipe not found", "code": "NOT_FOUND" }
  }
↓
Frontend vérifie response.success === false → affiche errorToast
```

## 5. ANALOGIE

Imagine un **restaurant** :

- Le **menu** (le format de réponse) est standardisé : chaque plat est présenté de la même façon (succès : entrée-plat-dessert, erreur : assiette renversée).
- `sendSuccess` c'est le **chef** qui prépare l'assiette : il sait que l'entrée doit être dans une assiette creuse, le plat dans une assiette plate, le dessert dans une coupelle. C'est toujours la même mise en place.
- `sendError` c'est le **serveur** qui revient avec l'assiette renversée : il dit "désolé" (message) et "c'était le plat n°4" (code). Le client sait immédiatement que ça a raté sans avoir à deviner.
- `statusCodeToCode` c'est le **code des plats** : le plat n°404 a toujours un code "NOT_FOUND" sur l'addition, même si le nom du plat change.

Sans ce système, chaque contrôleur enverrait ses réponses dans un format différent, comme si chaque serveur inventait sa propre façon de présenter l'addition. Le client (frontend) ne saurait jamais où chercher l'information.

## 6. PIÈGES CLASSIQUES

### Piège #1 : Utiliser `res.json()` directement au lieu de `sendSuccess`/`sendError`

**Le problème :** Le développeur écrit `res.status(200).json({ ok: true, user: data })`. Le frontend attend `response.success`, pas `response.ok`. Inconsistance garantie.

**MAUVAIS code :**
```javascript
// Dans un contrôleur — format différent à chaque fois
res.status(200).json({ ok: true, result: user });           // Route A
res.status(404).json({ found: false, reason: 'Not found' });// Route B
// Le frontend ne peut pas standardiser son traitement
```

**BON code :**
```javascript
sendSuccess(res, { user });       // Route A — toujours pareil
sendError(res, 'Not found', 404); // Route B — toujours pareil
```

### Piège #2 : Passer le mauvais type pour `data`

**Le problème :** `sendSuccess(res, null)` est valide, mais `sendSuccess(res, "une chaîne")` aussi. Le frontend s'attend à ce que `data` soit un objet ou un tableau, pas une string.

**BON code :**
```javascript
// Toujours un objet ou un tableau dans data
sendSuccess(res, { user: userData });
sendSuccess(res, { recipes: recipeList });
sendSuccess(res, { token: jwtToken });
// Ou null si pas de données
sendSuccess(res, null, 'Deleted successfully');
```

### Piège #3 : Ne pas mettre `return` devant `sendError`

**Le problème :** Sans `return`, la fonction continue après l'envoi de l'erreur et peut tenter un deuxième `res.json()`, ce qui déclenche une exception Express "Cannot set headers after they are sent".

**MAUVAIS code :**
```javascript
if (!user) {
    sendError(res, 'User not found', 404);  // ← Envoie la réponse
    // La fonction CONTINUE de s'exécuter !
    // Peut tenter un autre res.json() → crash
}
doSomethingElse(); // ← S'exécute même après l'erreur
```

**BON code :**
```javascript
if (!user) {
    return sendError(res, 'User not found', 404);  // ← STOP !
}
doSomethingElse(); // ← Ne s'exécute que si user existe
```

## 7. ET SI ON FAISAIT AUTREMENT ?

### Option A : Classe de réponse personnalisée

- **Comment ça marche :** Créer une classe `ApiResponse` avec des méthodes chaînables : `new ApiResponse(res).success(data).message('ok').send()`.
- **Avantage :** Plus flexible, peut ajouter des métadonnées (pagination, version API) facilement.
- **Inconvénient :** Trop abstrait pour un projet Bac+2. Les simples fonctions sont plus faciles à lire et déboguer.
- **Notre cas :** Les fonctions pures (approche actuelle) sont le bon niveau de complexité.

### Option B : Un seul helper `respond()` avec option `success`

- **Comment ça marche :** Une seule fonction `respond(res, { success: true, data, message })` qui gère les deux cas.
- **Avantage :** Moins de code. Le développeur choisit le format.
- **Inconvénient :** Le développeur peut oublier de mettre `success: true`, ou mettre `success: 'yes'` (string au lieu de booléen). Deux fonctions séparées rendent le contrat plus clair.
- **Notre cas :** Deux fonctions séparées (approche actuelle) est plus explicite et sécurisé.

## 8. CHECKLIST POUR LE JURY

- [ ] `sendSuccess` retourne toujours `{ success: true, data, message }` (`apiResponse.js:14-19`)
- [ ] `sendError` retourne toujours `{ success: false, error: { message, code } }` (`apiResponse.js:41-54`)
- [ ] Le code lisible (`NOT_FOUND`, `UNAUTHORIZED`, etc.) est dérivé du code HTTP via `statusCodeToCode()` (`apiResponse.js:24-35`)
- [ ] Le paramètre optionnel `details` permet d'ajouter des infos structurées sans casser le format (`apiResponse.js:49-51`)
- [ ] Aucun `res.json()` direct n'est utilisé dans les contrôleurs — tout passe par les helpers
- [ ] `sendError` est systématiquement préfixé par `return` pour éviter les doubles réponses
