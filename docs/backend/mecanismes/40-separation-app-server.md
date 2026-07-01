# 40 — Séparation app.js / server.js (Testabilité)

## 1. CE QUE ÇA FAIT (vue d'ensemble)

L'application Express est séparée en deux fichiers :
- **app.js** : configure l'application (middleware, routes, sécurité). Exporte `app` sans démarrer de serveur.
- **server.js** : importe `app`, teste la connexion à la base de données, puis lance `app.listen()`.

Cette séparation permet aux tests d'importer `app.js` et d'utiliser **Supertest** sans avoir besoin d'un vrai serveur HTTP qui écoute sur un port.

## 2. SCHÉMA DE LA TABLE

Pas de table — c'est une architecture de code.

## 3. LE CODE

### 3.1 — app.js (`app.js:1-103`)

```javascript
// app.js
// Express application setup.
// Middleware chain (order is mandatory):
//   Security headers → CORS → Rate limiting → Request logging → Body parsing → Routes → Error handling

'use strict';

require('dotenv').config();
const path = require('path');
const express = require('express');
// ... imports de middlewares ...

const app = express();

// ─── Security headers ──────────────────────────────────────────
app.use(helmetMiddleware);
app.use(corsMiddleware);

// ─── Rate limiting ─────────────────────────────────────────────
app.use(globalLimiter);

// ─── Request logging ───────────────────────────────────────────
app.use(httpLogger);

// ─── Body parsing ──────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// ─── Static files ──────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'frontend', 'public')));

// ─── Routes ────────────────────────────────────────────────────
app.get('/health', async (req, res, next) => { ... });
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/auth', authLimiter, authRoutes);
// ... autres routes ...

// ─── 404 + Error handling ──────────────────────────────────────
app.use((req, res) => { ... });
app.use(errorHandler);

module.exports = app;
```

### 3.2 — server.js (`server.js:1-52`)

```javascript
// server.js
// Entry point – starts the HTTP server.
// Kept separate from app.js so app.js can be imported in tests
// without actually starting a server (supertest handles that).

'use strict';

const app = require('./app');
const { testConnection } = require('./src/database/connection');
const { logger } = require('./src/middlewares/logger');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || 'localhost';

async function startServer() {
    await testConnection();

    const server = app.listen(PORT, HOST, () => {
        logger.info(`Server running at http://${HOST}:${PORT}`);
    });

    // Graceful shutdown, SIGTERM, SIGINT, unhandledRejection...
}

startServer();
```

### 3.3 — Test d'intégration (`tests/integration/ratings.test.js:10-12`)

```javascript
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
```

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

**Démarrage normal (production) :**
1. `node server.js` est exécuté.
2. `server.js` importe `app.js` (qui configure toute l'application Express).
3. `testConnection()` est appelé — si la DB ne répond pas, le processus s'arrête avec `process.exit(1)`.
4. `app.listen(PORT)` démarre le serveur HTTP.

**Test (Supertest) :**
1. Le fichier de test fait `const app = require('../../app')`.
2. Il passe `app` à `request(app)` de Supertest.
3. Supertest crée un serveur HTTP **virtuel** — il ne binde pas de port réel.
4. Les requêtes de test sont routées directement dans l'application Express, sans passer par le réseau.
5. Supertest ne démarre pas `server.js` — donc `testConnection()` n'est pas appelé.

## 5. ANALOGIE

C'est la différence entre une voiture et un simulateur de conduite :
- **app.js** : le moteur, le volant, les pédales, l'électronique. Tout ce qui fait que la voiture fonctionne.
- **server.js** : la clé de contact, le démarreur, le panneau "allumé/éteint".
- Supertest : un simulateur de conduite qui branche directement le volant et les pédales à un écran, sans avoir besoin de démarrer le vrai moteur.

Les tests ne veulent pas démarrer la vraie voiture — ils veulent juste vérifier que le circuit électrique fonctionne.

## 6. PIÈGES CLASSIQUES

### Piège #1 : Mettre `app.listen()` dans app.js

Si `app.listen()` est dans `app.js`, chaque fois qu'un test importe `app`, un serveur HTTP se lance sur un port. Les ports se retrouvent vite épuisés et les tests se marchent dessus.

### Piège #2 : Tester avec `server.js` importé

Importer `server.js` dans les tests déclenche `testConnection()` qui tente de se connecter à la vraie base de données et peut même faire `process.exit(1)` si la DB est down. Les tests doivent pouvoir tourner sans DB.

### Piège #3 : `module.exports = app` oublié

Si `module.exports` n'est pas défini dans `app.js`, `server.js` reçoit `undefined` et `app.listen()` plante avec "Cannot read property 'listen' of undefined". Pareil pour les tests.

## 7. ET SI ON FAISAIT AUTREMENT ?

**Option A** : Tout dans un seul fichier avec un flag `if (require.main === module)`. On pourrait avoir `app.listen()` conditionnel : seulement si le fichier est exécuté directement, pas s'il est importé par un test. Mais c'est moins clair que deux fichiers séparés.

**Option B** : Utiliser `beforeAll()` et `afterAll()` pour démarrer/arrêter le serveur dans les tests. Nécessite de gérer manuellement les ports et les timeouts. Plus de code de test pour zéro bénéfice.

**Option C** : Framework de test qui mocke la couche HTTP. Sans Supertest, il faudrait envoyer de vraies requêtes HTTP à un vrai serveur. Beaucoup plus lent, beaucoup plus fragile.

## 8. CHECKLIST POUR LE JURY

- [ ] `app.js` n'a PAS d'appel à `app.listen()` et pas de `testConnection()`
- [ ] `app.js` exporte `app` via `module.exports = app`
- [ ] `server.js` importe `app` via `require('./app')`
- [ ] `server.js` appelle `testConnection()` avant `app.listen()`
- [ ] Les tests importent `app.js` directement (pas `server.js`)
- [ ] Les tests utilisent `request(app)` de Supertest sans `app.listen()`
- [ ] `testConnection()` avec `process.exit(1)` si la DB est injoignable
- [ ] Le graceful shutdown est dans `server.js` (pas dans `app.js`)
