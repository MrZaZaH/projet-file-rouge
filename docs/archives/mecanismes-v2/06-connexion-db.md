# #6 — Connexion Base de Données (Connection Pool)

## 1. CE QUE ÇA FAIT (vue d'ensemble)

Le système de connexion à la base de données crée un **pool de connexions MariaDB** au démarrage du serveur. Un pool est un ensemble de connexions SQL pré-ouvertes, réutilisables, qui évite d'ouvrir et fermer une connexion à chaque requête (ce qui serait lent). Le pool est créé une seule fois, importé par tous les modèles de données, et testé au démarrage pour vérifier que la base répond. En fin de tests, il est fermé proprement pour éviter que Jest ne reste bloqué indéfiniment.

## 2. SCHÉMA DE LA TABLE

Pas de table SQL spécifique — ce mécanisme configure la **connexion** à la base de données, pas une table en particulier. Mais les données de configuration sont stockées dans les variables d'environnement (`.env`) :

```
# .env.example — jamais de vrais mots de passe dans le code !
DB_HOST=localhost    # Hôte MariaDB (localhost en dev)
DB_PORT=3306         # Port par défaut de MariaDB/MySQL
DB_NAME=recettes_humaines   # Nom de la base de données
DB_USER=dev_app      # Utilisateur avec privilèges limités (SELECT, INSERT, UPDATE, DELETE)
DB_PASSWORD=ton_mot_de_passe_dev_app
```

Le script SQL de création de la base et des utilisateurs se trouve dans `database/scripts/` :

```sql
-- Base de données
CREATE DATABASE recettes_humaines
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

-- Utilisateur applicatif (principe de moindre privilège)
CREATE USER 'dev_app'@'localhost'
    IDENTIFIED BY 'ton_mot_de_passe_dev_app';

GRANT SELECT, INSERT, UPDATE, DELETE ON recettes_humaines.* TO 'dev_app'@'localhost';

-- Utilisateur admin pour les migrations
CREATE USER 'dev_admin'@'localhost'
    IDENTIFIED BY 'ton_mot_de_passe_dev_admin';

GRANT ALL PRIVILEGES ON recettes_humaines.* TO 'dev_admin'@'localhost';
```

**Principe de moindre privilège :** L'application (`dev_app`) n'a que les droits dont elle a besoin : lire, insérer, modifier, supprimer des données. Elle ne peut PAS créer ou modifier des tables (DDL). Les migrations sont faites avec `dev_admin`.

## 3. LE CODE

### 3.1 — `src/config/database.js` (chemin: `src/config/database.js:1-35`)

```javascript
// src/config/database.js
// Database configuration – reads from environment variables.
// Never hardcode credentials here.

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    // Pool settings
    // A pool is a set of pre-opened connections reused across requests.
    // Without a pool, every request opens and closes a connection → slow and wasteful.
    waitForConnections: true,  // Queue requests when all connections are busy
    connectionLimit: 10,       // Max simultaneous connections
    queueLimit: 0,             // 0 = unlimited queue

    // We use snake_case in DB and snake_case in JS to avoid confusion.
    namedPlaceholders: true,   // Allows :paramName syntax instead of ?
};

// Validate required fields at startup – fail fast
const requiredFields = ['user', 'password', 'database'];
for (const field of requiredFields) {
    if (!dbConfig[field]) {
        throw new Error(`Database config error: DB_${field.toUpperCase()} is not defined`);
    }
}

module.exports = dbConfig;
```

**Lignes 6-10 :** Les credentials sont lus depuis les variables d'environnement. Jamais de mots de passe en dur. `process.env.DB_USER` est défini dans le fichier `.env` (chargé par `dotenv` dans `app.js`).

**Lignes 16-18 :** Les options du pool :
- `waitForConnections: true` — si les 10 connexions sont occupées, la nouvelle requête attend qu'une se libère au lieu d'échouer immédiatement
- `connectionLimit: 10` — maximum 10 connexions simultanées. Au-delà, les requêtes attendent dans une file. Pourquoi 10 ? Parce que MariaDB a une limite par défaut de ~151 connexions et que l'application n'a que quelques utilisateurs simultanés
- `queueLimit: 0` — file d'attente illimitée. Les requêtes attendent leur tour plutôt que d'échouer

**Ligne 24 :** `namedPlaceholders: true` — permet d'écrire `WHERE email = :email` au lieu de `WHERE email = ?`. Plus lisible quand une requête a plusieurs paramètres.

**Lignes 28-33 :** Validation au démarrage. Si une variable d'environnement obligatoire est absente, l'application plante immédiatement avec un message clair. **Fail fast** : mieux vaut planter tout de suite que d'échouer mystérieusement 3 heures plus tard avec "Cannot read property of undefined".

### 3.2 — `src/database/connection.js` (chemin: `src/database/connection.js:1-42`)

```javascript
// src/database/connection.js
// Creates and exports the MariaDB connection pool.
// All database queries go through this single pool instance.
//
// Security measures:
// - Uses connection pooling (prevents connection exhaustion)
// - Relies on parameterized queries (SQL injection prevention)
// - Credentials loaded from environment variables only

'use strict';

const mysql = require('mysql2/promise');
const dbConfig = require('../config/database');

// createPool returns a pool object, not a connection.
// mysql2/promise gives us async/await support out of the box.
const pool = mysql.createPool(dbConfig);
```

**Ligne 12 :** `mysql2/promise` — la version promise de mysql2. Elle permet d'utiliser `await` au lieu des callbacks. `const result = await pool.query('SELECT * FROM users')` au lieu de `pool.query('SELECT ...', (err, result) => { ... })`.

**Ligne 17 :** `mysql.createPool(dbConfig)` crée le pool. La différence avec `createConnection()` :
- `createConnection()` : une seule connexion, ouverte à l'appel, fermée manuellement
- `createPool()` : plusieurs connexions pré-ouvertes, gérées automatiquement, réutilisées

```javascript
/**
 * Tests the database connection by acquiring one connection from the pool.
 * Call this at server startup to catch misconfigurations immediately.
 * @returns {Promise<void>}
 */
async function testConnection() {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.query('SELECT 1');
        console.info('[DB] Connection pool established successfully');
    } catch (error) {
        console.error('[DB] Failed to connect to database:', error.message);
        // Hard exit – there is no point running without a database
        process.exit(1);
    } finally {
        // ALWAYS release the connection back to the pool, even on error
        if (connection) connection.release();
    }
}

module.exports = { pool, testConnection };
```

**Ligne 24 :** `async function testConnection()` — cette fonction est appelée au démarrage du serveur (`server.js:18`). Elle vérifie que la base de données répond avant d'accepter la moindre requête HTTP.

**Ligne 27 :** `pool.getConnection()` — réserve une connexion depuis le pool. Si toutes les connexions sont occupées, elle attend.

**Ligne 28 :** `await connection.query('SELECT 1')` — la requête la plus simple possible. On ne teste pas une table spécifique, juste que MariaDB répond. C'est un **ping** SQL.

**Ligne 30 :** `console.info()` utilisé ici au lieu du logger Winston pour éviter les dépendances circulaires (cf. Piège #1).

**Ligne 34 :** `process.exit(1)` — arrêt brutal. Si la base de données ne répond pas au démarrage, il n'y a aucun intérêt à lancer le serveur. Toutes les routes planteraient de toute façon.

**Lignes 36-38 :** Le bloc `finally` est EXÉCUTÉ DANS TOUS LES CAS (succès ou erreur). Il libère la connexion avec `connection.release()`. Oublier `release()` est l'erreur la plus fréquente : les connexions ne sont jamais rendues au pool, il se vide au bout de 10 requêtes, et le serveur ne répond plus.

### 3.3 — `server.js` (lignes 9, 18)

```javascript
const { testConnection } = require('./src/database/connection');

async function startServer() {
    // Test DB connection before accepting any traffic
    await testConnection();

    const server = app.listen(PORT, HOST, () => {
        logger.info(`Server running at http://${HOST}:${PORT}`);
    });
}
```

**Ligne 18 :** `await testConnection()` — le serveur attend que la base soit prête. Pas de connexion = pas de serveur. Cette ligne bloque l'exécution : si MariaDB ne répond pas dans les 30 secondes (timeout par défaut de mysql2), la promesse est rejetée et `process.exit(1)` est appelé.

### 3.4 — `tests/helpers/testDb.js` (chemins: `tests/helpers/testDb.js:1-44`)

```javascript
async function closeDatabase() {
    try {
        await pool.end();   // Ferme TOUTES les connexions du pool
    } catch (error) {
        console.warn('⚠ Warning closing database:', error.message);
    }
}
```

**Ligne 38 :** `pool.end()` — ferme toutes les connexions du pool. Sans cet appel, Jest reste bloqué à la fin des tests car des connexions SQL sont encore ouvertes (Jest attend que tous les handles soient fermés).

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

```
AU DÉMARRAGE DU SERVEUR :
1. server.js importe app.js
   → dotenv charge .env (process.env.DB_USER, DB_PASSWORD, etc.)
   ↓
2. server.js importe testConnection depuis connection.js
   ↓
3. connection.js exécute mysql.createPool(dbConfig)
   → Le pool est créé mais aucune connexion n'est ouverte immédiatement
   → Les connexions sont créées à la demande (lazy)
   ↓
4. server.js appelle await testConnection()
   ↓
5. testConnection demande une connexion : pool.getConnection()
   → MariaDB ouvre une connexion (TCP + handshake + auth)
   ↓
6. testConnection envoie SELECT 1
   ↓
7. La base répond "1" → connexion valide
   ↓
8. connection.release() → la connexion retourne au pool (disponible pour les requêtes)
   ↓
9. Le serveur démarre : app.listen(PORT)
   ↓
PENDANT UNE REQUÊTE (ex: GET /api/v1/recipes) :
10. req → routes → recipeController.getAll()
    ↓
11. Contrôleur appelle : await pool.query('SELECT * FROM recipes WHERE deleted_at IS NULL')
    ↓
12. mysql2/promise prend une connexion du pool (ou en crée une si besoin)
    ↓
13. La requête SQL est exécutée (paramétrée — injection impossible)
    ↓
14. Les résultats sont retournés
    ↓
15. La connexion est automatiquement libérée → retourne au pool
    ↓
16. Réponse JSON envoyée au client
    ↓
EN FIN DE TESTS :
17. afterAll → closeDatabase()
    ↓
18. pool.end() ferme toutes les connexions
    ↓
19. Jest peut se terminer proprement
```

## 5. ANALOGIE

Un **pool de connexions** c'est comme une **flotte de taxis** :

- Sans pool : à chaque fois que quelqu'un a besoin d'un taxi, on construit une voiture à la main (lent et coûteux) et on la détruit après la course. C'est `createConnection()` à chaque requête.
- Avec pool : on a 10 taxis prêts en permanence dans un parking (le pool), moteur allumé. Quand un client (une requête HTTP) arrive, un taxi part immédiatement sans délai de construction.
- `connectionLimit: 10` : le parking a 10 places de taxi. Si 10 taxis sont déjà partis, le 11e client attend qu'un taxi revienne.
- `waitForConnections: true` : les clients font la queue au lieu d'être renvoyés chez eux.
- `connection.release()` : le taxi retourne au parking après la course. Sans ça, la flotte se réduit à 0 et plus personne ne peut se déplacer.
- `pool.end()` : on met toute la flotte à la casse (fermeture propre). Sans ça, les taxis restent garés indéfiniment (handles ouverts → Jest bloqué).

La configuration `database.js` c'est le **plan du parking** (nombre de places, adresse, identifiant du chef de flotte). Les variables d'environnement (.env) c'est le **carnet d'adresses** du chef de flotte : personne ne connaît le mot de passe du parking par cœur.

## 6. PIÈGES CLASSIQUES

### Piège #1 : Dépendance circulaire entre logger et connection

**Le problème :** Si `connection.js` importe le logger Winston pour logguer les erreurs de connexion, et que `logger.js` fait une requête SQL au démarrage (par exemple pour écrire dans une table de logs), on a une boucle infinie : connection → logger → connection → logger → crash.

**Solution dans le projet :** `connection.js` utilise `console.info` et `console.error` au lieu du logger Winston (ligne 30 et 32). Le logger Winston n'importe pas `connection.js`, donc pas de boucle.

### Piège #2 : Oublier `connection.release()` dans le `finally`

**Le problème :** Si une erreur survient DANS le `try`, la connexion n'est jamais libérée. Le pool perd une connexion jusqu'à épuisement.

**MAUVAIS code :**
```javascript
async function testConnection() {
    const connection = await pool.getConnection();
    await connection.query('SELECT 1');
    connection.release();  // Si SELECT 1 échoue, on ne passe JAMAIS ici
}
```

**BON code (celui du projet) :**
```javascript
async function testConnection() {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.query('SELECT 1');
    } finally {
        // QUOI QU'IL ARRIVE, on libère la connexion
        if (connection) connection.release();
    }
}
```

### Piège #3 : Hardcoder les credentials dans database.js

**Le problème :** Si les mots de passe sont écrits en dur, ils fuient dans Git (même si tu supprimes le fichier, ils restent dans l'historique). Un attaquant qui accède au repo récupère l'accès à la base de données.

**MAUVAIS code :**
```javascript
const dbConfig = {
    user: 'dev_app',
    password: 'azerty123',  // ← En dur !
};
```

**BON code (celui du projet) :**
```javascript
const dbConfig = {
    user: process.env.DB_USER,  // ← Depuis .env uniquement
    password: process.env.DB_PASSWORD,
};
```

### Piège #4 : Ne pas fermer le pool dans les tests

**Le problème :** Sans `pool.end()` dans `afterAll()`, Jest attend que tous les handles réseau soient fermés. Comme les connexions MariaDB restent ouvertes, Jest timeout au bout de 5 secondes et force l'arrêt.

**Solution :** Chaque fichier de test appelle `closeDatabase()` dans `afterAll()`.

## 7. ET SI ON FAISAIT AUTREMENT ?

### Option A : Connexion unique (sans pool)

- **Comment ça marche :** `mysql.createConnection()` crée UNE SEULE connexion réutilisée pour toutes les requêtes.
- **Avantage :** Plus simple à comprendre. Pas de gestion de pool.
- **Inconvénient :** Une seule requête à la fois. Si deux utilisateurs chargent la page en même temps, le second attend que la première soit finie. Très mauvaises performances.
- **Notre cas :** Le pool est indispensable dès qu'il y a plus d'un utilisateur simultané.

### Option B : ORM (Sequelize, TypeORM)

- **Comment ça marche :** Au lieu d'écrire du SQL brut, on utilise un ORM qui abstrait la base de données avec des modèles JavaScript : `User.findByPk(id)` au lieu de `SELECT * FROM users WHERE id = ?`.
- **Avantage :** Moins de SQL à écrire, migrations automatiques, changement de base de données facilité.
- **Inconvénient :** Cache la complexité SQL — un débutant n'apprend pas à écrire des requêtes. Performances parfois moins bonnes. Lourdeur.
- **Notre cas :** Le SQL brut via mysql2/promise est le choix pédagogique correct pour Bac+2. Comprendre le SQL est un bloc de compétence DWM.

## 8. CHECKLIST POUR LE JURY

- [ ] Les credentials sont chargés depuis les variables d'environnement, jamais en dur (`database.js:6-10`)
- [ ] Les champs obligatoires (user, password, database) sont validés au démarrage (`database.js:28-33`)
- [ ] Le pool est créé avec `mysql.createPool()` et non `createConnection()` (`connection.js:17`)
- [ ] `testConnection()` est appelée dans `startServer()` AVANT `app.listen()` (`server.js:18`)
- [ ] La connexion de test est libérée dans un bloc `finally` avec `connection.release()` (`connection.js:36-38`)
- [ ] En cas d'échec de connexion, `process.exit(1)` est appelé — pas de serveur sans base (`connection.js:34`)
- [ ] Les fichiers de test ferment le pool dans `afterAll()` via `closeDatabase()` → `pool.end()` (`testDb.js:36-42`)
- [ ] La configuration utilise `namedPlaceholders: true` pour des requêtes plus lisibles (`database.js:24`)
