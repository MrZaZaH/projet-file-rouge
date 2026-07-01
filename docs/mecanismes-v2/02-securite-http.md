# #2 — Sécurité HTTP (Helmet / CORS / Rate Limiting)

## 1. CE QUE ÇA FAIT (vue d'ensemble)

Ce fichier est le **garde du corps** de l'API. Il empêche les attaques les plus courantes sur le web : quelqu'un qui mettrait ton site dans une iframe pour te voler des clics (clickjacking), un autre site qui pomperait ton API en faisant des fetch() depuis son domaine (CORS), ou un attaquant qui inonderait ton serveur de requêtes pour le faire tomber (DDoS). Helmet ajoute une quinzaine de headers HTTP de sécurité automatiquement, CORS contrôle quels domaines ont le droit d'appeler ton API, et le rate limiting limite le nombre de requêtes par IP.

## 2. SCHÉMA DE LA TABLE

Pas de table SQL — la sécurité HTTP est gérée entièrement au niveau middleware Express, avant même que la requête touche aux routes ou à la base de données.

## 3. LE CODE

### 3.1 — `src/middlewares/security.js` (chemin: `src/middlewares/security.js:1-102`)

```javascript
// src/middlewares/security.js
// Fichier unique qui centralise les 3 middlewares de sécurité.
// Avantage : un seul require() dans app.js au lieu de 3 importations éparpillées.

'use strict';

const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
```

**Ligne 13-15 :** On importe 3 packages NPM. Chacun fait un job spécifique :
- `helmet` : ajoute des headers HTTP de sécurité (X-Frame-Options, CSP, etc.)
- `cors` : middleware qui gère les en-têtes CORS (Cross-Origin Resource Sharing)
- `express-rate-limit` : compteur de requêtes par IP avec réponse 429 automatique

```javascript
// ─── Helmet ───────────────────────────────────────────────────────────────────
// Key protections:
//   X-Frame-Options        → prevents clickjacking
//   X-Content-Type-Options → prevents MIME sniffing
//   Strict-Transport-Security → forces HTTPS in production
//   Content-Security-Policy   → restricts resource origins
const helmetMiddleware = helmet();
```

**Ligne 24 :** `helmet()` appelé SANS paramètres = configuration par défaut. Ça suffit pour un projet de ce niveau. Helmet définit ~15 headers de sécurité. Si tu veux voir la liste complète : regarde la doc officielle d'helmet.

**Pourquoi pas de config ?** Les valeurs par défaut d'helmet sont déjà bonnes pour 95% des projets. Ajouter une config personnalisée trop tôt, c'est risquer de casser quelque chose ou d'oublier un header important.

```javascript
// ─── CORS ────────────────────────────────────────────────────────────────────
// Rule: deny by default, whitelist explicitly.
// Never use origin: '*' on an authenticated API — it allows any site to
// make credentialed requests on behalf of your users.

const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')        // Variable d'env → tableau
    : ['http://localhost:3000', 'http://localhost:5500']; // Fallback dev safe

const corsOptions = {
    origin: (origin, callback) => {
        // No origin = curl, Postman, server-to-server — allow.
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);  // OK, tu peux passer
        } else {
            callback(new Error(`CORS policy: origin ${origin} is not allowed`));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};

const corsMiddleware = cors(corsOptions);
```

**Ligne 33-35 :** Les origines autorisées viennent de la variable d'environnement `ALLOWED_ORIGINS`, définie dans `.env` comme une chaîne CSV.

**Ligne 38-44 :** La fonction `origin` est une **callback function** exécutée par le middleware CORS pour chaque requête. Si l'origine est dans la liste blanche, on appelle `callback(null, true)` pour autoriser. Sinon, on renvoie une erreur.

**Pourquoi le `!origin` (ligne 40) ?** Certains outils (curl, Postman, requêtes serveur-à-serveur) n'envoient pas le header `Origin`. Bloquer ces requêtes serait une erreur : seules les requêtes depuis un **navigateur** ont un origin.

**Pourquoi jamais `origin: '*'` ?** `*` signifie "n'importe quel site peut faire des requêtes vers ton API avec les credentials (cookies, Authorization header)". C'est une faille de sécurité monumentale.

```javascript
// ─── Rate limiting ────────────────────────────────────────────────────────────
// express-rate-limit tracks requests per IP address.
// When the limit is reached, it returns 429 Too Many Requests automatically.
// standardHeaders: true  → sends RateLimit-* headers so clients know their quota
// legacyHeaders: false   → disables the older X-RateLimit-* headers (redundant)

const noopMiddleware = (_req, _res, next) => next();

const GLOBAL_MAX = parseInt(process.env.RATE_LIMIT_MAX, 10)
    || (process.env.NODE_ENV === 'development' ? 500 : 100);

const globalLimiter = process.env.NODE_ENV === 'test'
    ? noopMiddleware
    : rateLimit({
        windowMs: 15 * 60 * 1000,   // 15 minutes
        max: GLOBAL_MAX,             // Nombre max de requêtes dans cette fenêtre
        standardHeaders: true,       // Envoie RateLimit-Remaining, RateLimit-Reset, etc.
        legacyHeaders: false,        // Pas besoin des vieux headers X-RateLimit-*
        message: {
            success: false,
            error: {
                message: 'Too many requests, please try again later.',
                code: 'RATE_LIMIT_EXCEEDED',
            },
        },
    });
```

**Ligne 60 :** `noopMiddleware` — un middleware qui ne fait rien. Utile pour désactiver le rate limiting pendant les tests sans faire de condition compliquée.

**Ligne 62 :** Le `||` (OU logique) permet un fallback : si `process.env.RATE_LIMIT_MAX` n'est pas défini ou n'est pas un nombre valide, on utilise la valeur par défaut.

**Ligne 64-78 :** En mode test, on utilise `noopMiddleware` car le rate limiting ralentirait les tests et provoquerait des faux échecs.

```javascript
// Auth: 10 requests per 15 minutes.
// Applied only to /api/v1/auth — limits brute force on login and register.
const authLimiter = process.env.NODE_ENV === 'test'
    ? noopMiddleware
    : rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 10,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            success: false,
            error: {
                message: 'Too many authentication attempts, please try again later.',
                code: 'AUTH_RATE_LIMIT_EXCEEDED',
            },
        },
    });

// ─── Single export ────────────────────────────────────────────────────────────
module.exports = { helmetMiddleware, corsMiddleware, globalLimiter, authLimiter };
```

**Ligne 80-98 :** `authLimiter` est **10 fois plus restrictif** (10 requêtes au lieu de 100/500). C'est normal : personne n'a besoin de tenter de se connecter plus de 10 fois en 15 minutes. Si ça arrive, c'est soit un bot, soit un brute force.

**Ligne 102 :** Un seul `module.exports` à la fin du fichier — convention du projet pour faciliter la lecture.

### 3.2 — `app.js` (lignes 15-35 et 80-81)

```javascript
// Import unique — un seul require() pour les 4 middlewares
const {
    helmetMiddleware,
    corsMiddleware,
    globalLimiter,
    authLimiter
} = require('./src/middlewares/security');

// ─── Application dans l'ordre ─────────────────────────────────────────────────
app.use(helmetMiddleware);  // Ligne 28 : headers de sécurité en premier
app.use(corsMiddleware);    // Ligne 29 : CORS en deuxième
app.use(globalLimiter);     // Ligne 33 : rate limiting global

// ...

// Ligne 81 : authLimiter UNIQUEMENT sur les routes d'auth
app.use('/api/v1/auth', authLimiter, authRoutes);
```

**L'ordre est important :** Helmet doit être le tout premier middleware pour que tous les headers de sécurité soient envoyés avant toute autre logique. CORS vient juste après. Le rate limiting global s'applique à toutes les routes. Le rate limiting d'auth est appliqué en complément (plus restrictif) sur les seules routes `/api/v1/auth`.

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

```
Requête HTTP entrante (ex: POST /api/v1/auth/login)
│
├─ 1. Helmet vérifie/ajoute les headers de sécurité à la réponse
│    (X-Frame-Options, X-Content-Type-Options, etc.)
│
├─ 2. CORS vérifie le header Origin
│    │
│    ├─ Origin absent (curl/Postman)     → OK, on laisse passer
│    ├─ Origin dans la liste blanche      → OK, on laisse passer
│    └─ Origin non autorisé               → Erreur 403, requête bloquée
│
├─ 3. Rate limiter GLOBAL vérifie le compteur pour cette IP
│    │
│    ├─ Moins de 100 requêtes en 15 min  → OK, compteur +1
│    └─ Plus de 100 requêtes             → 429 Too Many Requests
│
├─ 4. Route matcher : /api/v1/auth/* → authLimiter s'applique
│    │
│    ├─ Moins de 10 requêtes en 15 min  → OK, compteur +1
│    └─ Plus de 10 requêtes             → 429 Too Many Requests (code AUTH_RATE_LIMIT_EXCEEDED)
│
├─ 5. Logger HTTP enregistre la requête (mécanisme #3)
│
├─ 6. Body parser lit le corps JSON
│
└─ 7. Contrôleur auth exécute la logique métier
```

**Pourquoi deux rate limiters ?** Le limiter global protège contre les attaques DDoS générales (inonder tout le site de requêtes). Le limiter auth protège spécifiquement contre le brute force sur les mots de passe. Un attaquant qui envoie 100 requesses normales puis 10 tentatives de login passera les deux limites.

## 5. ANALOGIE

Imagine un **club privé** (ton API) :
- **Helmet** c'est les **vitres blindées et la porte renforcée** à l'entrée — ça rend le bâtiment solide
- **CORS** c'est le **videur** à la porte qui vérifie ta carte d'identité (origin) et refuse les gens qui viennent d'un autre quartier (domaine non autorisé)
- **Rate limiter global** c'est la **jauge de sécurité** — max 100 personnes à l'intérieur, après c'est interdit
- **Rate limiter auth** c'est **3 essais max pour le code PIN au vestiaire** — si tu te trompes 10 fois, tu dégages

## 6. PIÈGES CLASSIQUES

### Piège #1 : `origin: '*'` en production

**Le problème :** `*` permet à n'importe quel site web de faire des requêtes avec credentials. Un site pirate peut faire `fetch('https://ton-api.com/api/v1/users', { credentials: 'include' })` depuis le navigateur de ta victime.

**MAUVAIS code :**
```javascript
const corsOptions = {
    origin: '*',  // 👹 N'IMPORTE QUI peut appeler l'API
};
```

**BON code (celui du projet) :**
```javascript
const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS policy: origin ${origin} is not allowed`));
        }
    },
};
```

### Piège #2 : Oublier de désactiver le rate limiting dans les tests

**Le problème :** Les tests Jest envoient des requêtes en rafale. Avec le rate limiting actif, les tests échouent avec des 429 aléatoires alors que le code est bon.

**MAUVAIS code :**
```javascript
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    // Pas de condition NODE_ENV — les tests échoueront
});
```

**BON code (celui du projet) :**
```javascript
const noopMiddleware = (_req, _res, next) => next();

const globalLimiter = process.env.NODE_ENV === 'test'
    ? noopMiddleware
    : rateLimit({ /* ... */ });
```

### Piège #3 : Mauvais ordre des middlewares

**Le problème :** Si le body parser (`express.json()`) est placé avant Helmet, une requête malveillante peut exploiter une faille de parsing AVANT que les headers de sécurité soient appliqués.

**Ordre correct :** Helmet → CORS → Rate limiting → Logging → Body parsing → Routes → Error handler (tel qu'implémenté dans app.js)

## 7. ET SI ON FAISAIT AUTREMENT ?

### Option A : Utiliser un reverse proxy (nginx, Caddy)

- **Comment ça marche :** Nginx reçoit les requêtes en premier, applique les headers de sécurité, le CORS et le rate limiting AVANT que ça n'arrive à Express.
- **Avantage :** Soulage le serveur Node.js, plus performant (nginx gère mieux la concurrence que Node), et bloque les attaquants avant même qu'ils touchent à l'application.
- **Inconvénient :** Un service supplémentaire à configurer et maintenir. Le rate limiting est moins flexible (basé sur IP réelle, pas sur des critères applicatifs).
- **Notre cas :** En développement, c'est overkill. En production, on pourrait l'ajouter mais ce n'est pas dans le scope du diplôme Bac+2.

### Option B : Rate limiting avec Redis au lieu de mémoire

- **Comment ça marche :** Au lieu de stocker les compteurs dans la RAM du processus Node, on utilise Redis en mémoire partagée.
- **Avantage :** Le compteur survit au redémarrage du serveur. Plusieurs instances Node peuvent partager le même compteur (utile si tu scales horizontalement).
- **Inconvénient :** Redis est un service supplémentaire à déployer, maintenir, sécuriser. Ajoute de la complexité.
- **Notre cas :** Inutile. L'application tourne sur un seul serveur, et le rate limiting en mémoire est suffisant.

## 8. CHECKLIST POUR LE JURY

- [ ] Helmet est appliqué en premier dans la chaîne de middlewares (`app.js:28`)
- [ ] CORS utilise une whitelist explicite, pas `origin: '*'` (`security.js:33-48`)
- [ ] Le rate limiting est désactivé en mode test via `noopMiddleware` (`security.js:64-65`)
- [ ] `authLimiter` (10 req/15min) est plus restrictif que `globalLimiter` (100 req/15min) — logique brute force vs DDoS
- [ ] Les réponses 429 utilisent le format standardisé `{ success, error: { message, code } }` (`security.js:71-77`)
- [ ] La variable `ALLOWED_ORIGINS` est configurable via `.env` — pas de valeurs en dur
