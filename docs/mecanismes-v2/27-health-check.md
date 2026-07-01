# 27 — Health Check

## 1. CE QUE ÇA FAIT (vue d'ensemble)

La route `GET /health` (hors prefix `/api/v1`) est un endpoint qui vérifie que l'application et la base de données sont opérationnelles. Elle exécute `SELECT 1` sur la base, retourne 200 si tout va bien, 503 si la base est injoignable. Utilisée par les systèmes de monitoring (Docker, Kubernetes, services cloud) pour décider si le conteneur/service est healthy.

## 2. SCHÉMA DE LA TABLE

Pas de table — vérification avec `SELECT 1` (requête sans table).

## 3. LE CODE

### 3.1 — Route dans app.js (`app.js:46-62`)

```javascript
app.get('/health', async (req, res, next) => {
    try {
        const { pool } = require('./src/database/connection');
        await pool.query('SELECT 1');
        res.status(200).json({
            success: true,
            status: 'ok',
            timestamp: new Date().toISOString(),
            database: 'connected',
            environment: process.env.NODE_ENV || 'development',
        });
    } catch (error) {
        error.statusCode = 503;
        error.message = 'Database unavailable';
        next(error);
    }
});
```

### 3.2 — testConnection dans server.js (`server.js:15-18`) et connection.js (`src/database/connection.js:24-40`)

```javascript
// server.js
async function startServer() {
    await testConnection();  // Vérifie la DB AVANT de démarrer le serveur HTTP
    const server = app.listen(PORT, HOST, () => { ... });
}

// connection.js
async function testConnection() {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.query('SELECT 1');
        console.info('[DB] Connection pool established successfully');
    } catch (error) {
        console.error('[DB] Failed to connect to database:', error.message);
        process.exit(1);  // Arrête le processus — pas de serveur sans DB
    } finally {
        if (connection) connection.release();
    }
}
```

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

**Au démarrage (server.js) :**
1. `testConnection()` est appelée.
2. Une connexion est acquise depuis le pool.
3. `SELECT 1` est exécuté — si ça réussit, la base répond.
4. Si échec → `process.exit(1)` arrête le processus immédiatement.
5. Si succès → `app.listen()` démarre le serveur HTTP.

**Pendant le fonctionnement (GET /health) :**
1. Un système externe (Docker, Load Balancer, cron) envoie `GET /health`.
2. Le handler récupère le pool (require lazy pour éviter circular deps).
3. `await pool.query('SELECT 1')` vérifie que la connexion fonctionne.
4. Si succès → 200 avec JSON : `{ success: true, status: 'ok', database: 'connected', timestamp: '...', environment: 'development' }`.
5. Si échec → l'erreur est passée à `next(error)` avec un statusCode 503, et l'errorHandler retourne un message propre.

## 5. ANALOGIE

C'est la lumière témoin sur un automate. Tu appuies sur un bouton (GET /health), la lumière s'allume en vert (200) ou en rouge (503). Si elle est rouge, tu sais que la machine a un problème et tu ne mets pas de pièces dedans (tu ne rediriges pas de trafic vers ce serveur).

## 6. PIÈGES CLASSIQUES

### Piège #1 : Mettre /health SOUS le préfixe /api/v1

```javascript
// MAUVAIS — /health est protégé par le rate limiting et l'auth
app.use('/api/v1', /* ... */);
app.get('/api/v1/health', ...);
// Les systèmes de monitoring se cognent du rate limiting
```

```javascript
// BON — /health est en dehors de tout préfixe
app.get('/health', ...);
app.use('/api/v1', /* ... */);
```

### Piège #2 : Utiliser `testConnection()` au lieu de `pool.query()` dans le handler

```javascript
// MAUVAIS — testConnection acquiert une connexion et la relâche
// Si le pool est plein, testConnection peut timeout inutilement
```

```javascript
// BON — pool.query() utilise une connexion du pool automatiquement
await pool.query('SELECT 1');
```

### Piège #3 : Réponse sans timestamp ISO

```javascript
// MAUVAIS — pas de traçabilité temporelle
res.json({ status: 'ok' });
```

```javascript
// BON — timestamp ISO standard
res.json({ status: 'ok', timestamp: new Date().toISOString() });
```

### Piège #4 : Health check sans distinction DB OK / DB KO

Toujours retourner 200 même si la DB est down est dangereux : le load balancer continue d'envoyer du trafic vers une application qui ne peut pas répondre correctement.

### Piège #5 : Lazy require dans le handler (`require('./src/database/connection')`)

Ce pattern EST intentionnel ici. Pourquoi ? Parce que `app.js` est importé dans les tests (Supertest), et `connection.js` se connecte à la DB dès l'import. En mettant le require dans le handler, la connexion DB n'est établie QUE si /health est appelé, ce qui évite de forcer la connexion dans les tests. Cependant, `server.js` appelle `testConnection()` qui fait le require, donc en production la connexion est bien faite au démarrage.

## 7. ET SI ON FAISAIT AUTREMENT ?

### Option A : Endpoint /health séparé dans un contrôleur dédié

Créer un `HealthController.js` pour isoler la logique. Avantage : testable unitairement. Inconvénient : pour une route aussi simple, l'indirection n'apporte pas grand-chose. Le choix inline dans `app.js` est un compromis pragmatique.

### Option B : Ajouter des vérifications supplémentaires (Redis, stockage)

Si l'application utilisait Redis ou un système de fichiers, on pourrait vérifier chaque dépendance. Ex: vérifier que le dossier `uploads/` est accessible en écriture. Pour le MVP, la DB est la seule dépendance critique.

### Option C : Format de réponse standardisé (health check RFC)

Il existe une RFC pour les health checks ([Health Check Response Format](https://datatracker.ietf.org/doc/draft-inadarei-api-health-check/)), mais c'est overkill pour un MVP. Le format JSON simple fait le travail.

## 8. CHECKLIST POUR LE JURY

- [ ] Route `GET /health` déclarée HORS du préfixe `/api/v1`.
- [ ] Vérifie la connexion DB avec `SELECT 1` via `pool.query()`.
- [ ] Retourne 200 avec `{ success, status, timestamp, database, environment }`.
- [ ] Retourne 503 si la DB est indisponible (passe par errorHandler).
- [ ] `testConnection()` dans `server.js` vérifie la DB avant de démarrer le serveur.
- [ ] Pas de rate limiting sur /health (déclaré avant `globalLimiter` ou en dehors).
- [ ] Timestamp au format ISO 8601 (`new Date().toISOString()`).
- [ ] Le health check ne nécessite pas d'authentification.
- [ ] Le `require('./src/database/connection')` est lazy dans le handler (évite connexion prématurée dans les tests).
