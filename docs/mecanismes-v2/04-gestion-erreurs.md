# #4 — Gestion d'Erreurs Centralisée

## 1. CE QUE ÇA FAIT (vue d'ensemble)

Quand une erreur se produit dans une route (base de données inaccessible, validation échouée, ressource introuvable), Express attrape cette erreur et la passe à un middleware spécial qui a **4 paramètres**. Ce middleware unique loggue l'erreur en interne (avec la stack trace pour le développeur), détermine s'il faut cacher les détails sensibles (pour les erreurs 500), et renvoie une réponse JSON formatée de façon standardisée. Sans ce système, chaque contrôleur devrait gérer ses erreurs une par une, ce qui ferait du code dupliqué et des réponses inconsistantes.

## 2. SCHÉMA DE LA TABLE

Pas de table SQL — la gestion d'erreurs est un middleware Express, pas une entité persistée en base de données.

## 3. LE CODE

### 3.1 — `src/middlewares/errorHandler.js` (chemin: `src/middlewares/errorHandler.js:1-52`)

```javascript
// src/middlewares/errorHandler.js
//
// Centralized error handler – catches all errors passed via next(error).
//
// Responsibilities:
//   - Log errors internally (with stack)
//   - Never expose sensitive data to client
//   - Return standardized API response format
//
// Notes:
//   - Uses sendError() helper for consistency
//   - Stack trace only included in development

'use strict';

const { logger } = require('./logger');
const { sendError } = require('../utils/apiResponse');
```

**Ligne 16 :** Le logger Winston — on loggue l'erreur pour nous (développeurs), pas pour le client.

**Ligne 17 :** `sendError()` est le helper de réponse standardisé (cf. mécanisme #5). Toutes les erreurs passent par le même formateur.

```javascript
// Express recognizes this as an error middleware because it has 4 parameters
// DO NOT remove 'next' even if unused
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
```

**Ligne 22 :** La **signature à 4 paramètres** est ce qui différencie un middleware normal d'un middleware d'erreur pour Express. Les trois premiers sont l'erreur, la requête et la réponse. Le quatrième (`next`) est obligatoire même si non utilisé — Express compte le nombre de paramètres via `.length`. Si tu enlèves `next`, Express ne reconnaîtra PAS la fonction comme gestionnaire d'erreur.

```javascript
    // Determine HTTP status code (fallback to 500 if not provided)
    const statusCode = err.statusCode || err.status || 500;

    // Log full error details internally (including stack trace)
    logger.error(`${req.method} ${req.originalUrl} – ${err.message}`, {
        statusCode,
        stack: err.stack,
        body: req.body,
    });
```

**Ligne 25 :** `err.statusCode` est une convention du projet (propriété qu'on attache nous-mêmes aux erreurs dans les contrôleurs). `err.status` est la propriété standard Express. Si aucun des deux n'est défini, on utilise 500 (Internal Server Error). Cette cascade garantit qu'on a toujours un code HTTP valide.

**Lignes 28-32 :** Le log interne contient : la méthode HTTP, l'URL (pour savoir où l'erreur s'est produite), le message d'erreur, le code de statut, la stack trace (indispensable au débogage), et le corps de la requête.

**⚠️ Sécurité :** `req.body` peut contenir des mots de passe ou tokens. En production, il faudrait filtrer les champs sensibles (cf. Piège #2). Dans ce projet novice, on s'en dispense mais il faut savoir le mentionner.

```javascript
    // Decide what message to expose to the client
    // Never leak internal details for 500 errors
    const message =
        statusCode === 500
            ? 'An internal server error occurred'
            : err.message;

    // Use standardized response format
    const response = sendError(res, message, statusCode);

    // In development mode, attach stack trace for debugging
    if (process.env.NODE_ENV === 'development' && err.stack) {
        response.stack = err.stack;
    }

    return response;
}
```

**Lignes 36-39 :** **Règle absolue** : ne JAMAIS exposer les détails d'une erreur 500 au client. Un message vague comme "An internal server error occurred" suffit. Pourquoi ? Parce que le message d'erreur pourrait révéler des informations sur la structure interne (nom de table, chemin de fichier, version de bibliothèque) qu'un attaquant utiliserait. Pour les autres codes (400, 404, 422, etc.), le message d'erreur original est généralement sûr et utile.

**Lignes 45-47 :** En développement, on attache la stack trace à la réponse JSON pour faciliter le débogage. En production, elle reste dans le fichier de log mais n'est pas exposée au client.

**Ligne 49 :** `return response` garantit qu'aucun autre middleware ne s'exécute après. Le `return` est important car sans lui, Express continuerait d'exécuter les middlewares suivants.

```javascript
module.exports = { errorHandler };
```

### 3.2 — `app.js` (lignes 99-101)

```javascript
// ─── Error handling ──────────────────────────────────────────────────────────
// Must be last. The 4-parameter signature is how Express identifies error handlers.
app.use(errorHandler);
```

**Ligne 101 :** Le middleware d'erreur est le **dernier** middleware enregistré dans app.js. C'est impératif : Express exécute les middlewares dans l'ordre de déclaration. Si un autre middleware est déclaré APRÈS errorHandler, les erreurs qui surviennent dans ce middleware ne seront pas capturées.

### 3.3 — Exemple d'utilisation dans un contrôleur

Quand un contrôleur ou un modèle détecte une erreur, il crée un objet Error avec un code de statut et le passe à `next()` :

```javascript
// Dans src/controllers/authController.js (exemple)
const user = await UserModel.findByEmail(email);
if (!user) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;  // ← Convention du projet
    return next(err);       // ← Passe l'erreur à errorHandler
}
```

La chaîne est : contrôleur → `next(err)` → Express saute tous les middlewares suivants → `errorHandler` reçoit l'erreur → formatage + log + réponse.

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

```
1. Une requête arrive sur POST /api/v1/auth/login
   ↓
2. Les middlewares s'exécutent dans l'ordre (Helmet, CORS, Rate limiting, Logger...)
   ↓
3. Le body parser lit le JSON : { email: "test@test.com", password: "wrong" }
   ↓
4. authController.login() est appelé
   ↓
5. [CAS A] Succès :
   → res.status(200).json({ success: true, data: {...} })
   → Le middleware d'erreur n'est JAMAIS appelé
   ↓
   [CAS B] Erreur métier (utilisateur non trouvé) :
   → const err = new Error('Invalid email or password')
   → err.statusCode = 401
   → next(err)
   ↓
6. Express détecte que next() a reçu un argument
   → Il SAUTE tous les middlewares restants (routes, etc.)
   → Il va directement au premier middleware d'erreur (errorHandler)
   ↓
7. errorHandler analyse l'erreur :
   - statusCode = 401 (fourni par le contrôleur)
   - message = 'Invalid email or password' (pas un 500 → pas masqué)
   ↓
8. errorHandler loggue :
   "2026-07-01 [ERROR] POST /api/v1/auth/login – Invalid email or password
    {"statusCode":401,"stack":"Error: Invalid email or password\n    at..."}"
   (dans error.log ET combined.log)
   ↓
9. errorHandler appelle sendError(res, message, 401)
   ↓
10. Le client reçoit la réponse JSON :
    {
      "success": false,
      "error": {
        "message": "Invalid email or password",
        "code": "UNAUTHORIZED"
      }
    }
```

**Cas spécial 500 :**
```
5'. [CAS C] Erreur technique (base de données inaccessible) :
   → err.message = "Connection refused to database"
   → err.statusCode n'est pas défini → 500
   ↓
7'. errorHandler analyse :
   - statusCode = 500 (fallback)
   - message = 'An internal server error occurred' (masqué !)
   ↓
10'. Le client reçoit :
    {
      "success": false,
      "error": {
        "message": "An internal server error occurred",
        "code": "INTERNAL_ERROR"
      }
    }
    (Le vrai message "Connection refused..." est dans le log, pas dans la réponse)
```

## 5. ANALOGIE

Imagine un **central téléphonique d'urgence** :

- Chaque téléphone (contrôleur) peut appeler le standard. Si l'opérateur (middleware normal) ne peut pas gérer l'appel, il appuie sur un bouton rouge (next(error)).
- Le standardiste d'urgence (errorHandler) reçoit TOUS les appels problématiques.
- Il note l'incident dans son registre (logger), en notant tous les détails : qui appelait, à quelle heure, quel était le message.
- Ensuite, selon la gravité :
  - Petite urgence (400, 404) : il dit la vérité au client ("document non trouvé")
  - Catastrophe (500) : il dit "nous avons un problème technique, nous vous recontacterons" sans donner de détails
- Et il le fait TOUJOURS de la même façon, avec le même formulaire (format JSON standardisé).

Si chaque téléphone (contrôleur) devait gérer sa propre erreur, ce serait le chaos : réponses différentes, oublis, informations sensibles qui fuient.

## 6. PIÈGES CLASSIQUES

### Piège #1 : Oublier `next` dans la signature (3 paramètres au lieu de 4)

**Le problème :** Si la fonction a 3 paramètres, Express l'identifie comme un middleware normal, pas comme un gestionnaire d'erreur. L'erreur n'est jamais attrapée.

**MAUVAIS code :**
```javascript
function errorHandler(err, req, res) {  // ← Seulement 3 paramètres !
    // Express ne reconnaît PAS ça comme un error handler
    // Les erreurs ne seront jamais capturées ici
}
```

**BON code (celui du projet) :**
```javascript
function errorHandler(err, req, res, next) {  // ← 4 paramètres obligatoires
    // Express reconnaît : c'est un error handler
}
```

### Piège #2 : Exposer les détails d'erreur 500 au client

**Le problème :** Le message d'erreur technique peut contenir des chemins de fichiers, des noms de tables SQL, des versions de logiciels. Un attaquant utilise ces infos pour affiner son attaque.

**MAUVAIS code :**
```javascript
const message = err.message;  // ← Révèle tout au client
// Client reçoit : "Cannot read property 'email' of null"
// Un attaquant devine qu'il y a un champ 'email' attendu
```

**BON code (celui du projet) :**
```javascript
const message =
    statusCode === 500
        ? 'An internal server error occurred'
        : err.message;
```

### Piège #3 : Placer errorHandler AVANT les routes

**Le problème :** Les middlewares s'exécutent dans l'ordre de déclaration. Si errorHandler est déclaré avant les routes, il ne capturera QUE les erreurs des middlewares précédents, pas celles des routes.

**MAUVAIS code :**
```javascript
app.use(errorHandler);  // ← Trop tôt !
app.use('/api/v1/auth', authRoutes);
// Les erreurs dans authRoutes NE seront PAS capturées
```

**BON code (celui du projet) :**
```javascript
app.use('/api/v1/auth', authRoutes);
app.use(errorHandler);  // ← Toujours en dernier
```

## 7. ET SI ON FAISAIT AUTREMENT ?

### Option A : Gestion d'erreurs dans chaque contrôleur (try/catch partout)

- **Comment ça marche :** Chaque contrôleur attrape ses propres erreurs avec try/catch et formatte sa réponse.
- **Avantage :** Plus de contrôle sur le message renvoyé pour chaque cas spécifique.
- **Inconvénient :** Duplication massive de code, risque d'inconsistance (certains contrôleurs oublient de catcher, d'autres formatent différemment), maintenance impossible.
- **Notre cas :** L'approche centralisée (celle du projet) est la bonne. C'est le pattern standard Express.

### Option B : Classe d'erreur personnalisée `AppError`

- **Comment ça marche :** Créer une classe `AppError` qui étend `Error` et intègre automatiquement `statusCode` et `code` (le code lisible comme `NOT_FOUND`).
- **Avantage :** Plus propre que de faire `err.statusCode = 401` manuellement. La classe garantit que le code lisible est toujours cohérent avec le statut HTTP.
- **Inconvénient :** Une abstraction supplémentaire. Pour un projet Bac+2, la simplicité actuelle est suffisante.
- **Notre cas :** Bonne idée pour un projet plus avancé, mais overkill ici.

## 8. CHECKLIST POUR LE JURY

- [ ] La fonction `errorHandler` a exactement 4 paramètres `(err, req, res, next)` (`errorHandler.js:22`)
- [ ] `errorHandler` est le dernier middleware déclaré dans `app.js` (`app.js:101`)
- [ ] Les erreurs 500 masquent le message d'erreur original au client (`errorHandler.js:36-39`)
- [ ] La stack trace est incluse uniquement en mode développement (`errorHandler.js:45-47`)
- [ ] Les erreurs sont loggées via Winston avec méthode, URL, statusCode et stack (`errorHandler.js:28-32`)
- [ ] Le code de statut utilise la cascade `err.statusCode || err.status || 500` (`errorHandler.js:25`)
- [ ] La réponse utilise `sendError()` pour le format standardisé (`errorHandler.js:42`)
- [ ] Le retour `return response` empêche l'exécution des middlewares suivants (`errorHandler.js:49`)
