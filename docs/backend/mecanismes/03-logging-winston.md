# #3 — Logging Centralisé (Winston)

## 1. CE QUE ÇA FAIT (vue d'ensemble)

Le système de logging enregistre tout ce qui se passe dans l'application dans des fichiers texte horodatés. Winston est une bibliothèque de logging pour Node.js qui permet d'écrire les logs dans plusieurs destinations (fichier, console, etc.) simultanément avec des niveaux de gravité différents. Le middleware HTTP loggue automatiquement chaque requête entrante avec sa méthode, son URL, son code de statut et son temps d'exécution.

## 2. SCHÉMA DE LA TABLE

Pas de table SQL — les logs sont écrits dans des fichiers sur le disque, pas dans la base de données. C'est un choix délibéré : les logs ne doivent jamais ralentir une requête BDD.

Deux fichiers de log sont créés à la racine du projet (dossier `logs/`) :
- `logs/error.log` — uniquement les erreurs (purge automatique à 5 Mo, 5 fichiers max)
- `logs/combined.log` — tous les logs (purge automatique à 10 Mo, 5 fichiers max)

## 3. LE CODE

### 3.1 — `src/middlewares/logger.js` (chemin: `src/middlewares/logger.js:1-83`)

```javascript
// src/middlewares/logger.js
// Fichier unique qui centralise la configuration Winston.
// Exporte deux choses :
//   - logger     : l'instance Winston utilisée dans TOUT le projet
//   - httpLogger : middleware Express qui log chaque requête

'use strict';

const winston = require('winston');
const path = require('path');
```

**Ligne 14 :** Winston est la bibliothèque de logging. Pourquoi Winston plutôt que `console.log()` ? Parce que `console.log` n'a pas de niveaux (tu ne peux pas filtrer les messages par importance), n'écrit pas automatiquement dans des fichiers, et ne formate pas les messages de façon structurée.

```javascript
// Custom format: timestamp + level + message + optional metadata
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }), // Include stack trace for Error objects
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        // meta contains any extra fields passed to the logger
        const metaStr = Object.keys(meta).length
            ? ` ${JSON.stringify(meta)}`
            : '';
        return `${timestamp} [${level.toUpperCase()}] ${stack || message}${metaStr}`;
    })
);
```

**Lignes 18-26 :** C'est le **format** des messages de log. Chaque ligne de log ressemblera à :
```
2026-07-01 14:30:22 [INFO] Server running at http://localhost:3000
```
- `timestamp()` ajoute la date/heure automatiquement
- `errors({ stack: true })` : si on loggue une erreur, Winston extrait automatiquement la stack trace
- `printf()` : fonction personnalisée qui assemble le message final

**Pourquoi `stack || message` ?** Quand on loggue une erreur avec `logger.error(err)`, Winston met le message dans `err.message` et la stack trace dans `err.stack`. Si on a une stack trace, on l'affiche (plus utile). Sinon, on affiche le message simple.

```javascript
const logger = winston.createLogger({
    // In production, don't pollute logs with debug noise
    level: process.env.NODE_ENV === 'production' ? 'http' : 'debug',

    format: logFormat,

    transports: [
        // Always write errors to a dedicated file – never lose an error log
        new winston.transports.File({
            filename: path.join('logs', 'error.log'),
            level: 'error',
            maxsize: 5 * 1024 * 1024, // 5MB – rotate before logs eat your disk
            maxFiles: 5,
        }),

        // Combined log for everything at or above the configured level
        new winston.transports.File({
            filename: path.join('logs', 'combined.log'),
            maxsize: 10 * 1024 * 1024,
            maxFiles: 5,
        }),
    ],
});
```

**Ligne 30 :** `level` détermine le seuil minimum de log. Les niveaux du plus grave au moins grave : `error` → `warn` → `info` → `http` → `debug`. En production, on ignore les messages debug (trop verbeux). `http` est le niveau juste au-dessus de `debug`.

**Lignes 34-49 :** Les **transports** sont les destinations des logs. Chaque transport peut avoir son propre niveau :
- `error.log` : niveau `error` uniquement — on ne mélange pas les erreurs avec le bruit ambiant
- `combined.log` : tous les niveaux à partir du seuil configuré

**Lignes 39-40 et 46-47 :** `maxsize` et `maxFiles` = **rotation automatique**. Quand `error.log` dépasse 5 Mo, Winston le renomme en `error.log.1` et crée un nouveau fichier vierge. Il garde 5 fichiers d'historique maximum (ça évite de saturer le disque dur).

```javascript
// In development, also log to console with colors for readability
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            logFormat
        ),
    }));
}
```

**Lignes 53-60 :** En développement, on ajoute un transport **console** avec des couleurs. Les messages apparaissent directement dans le terminal. `colorize()` colore les niveaux (rouge pour error, jaune pour warn, vert pour info, etc.). En production, on écrit uniquement dans les fichiers pour ne pas polluer les logs du processus (`journald`, `systemd`, etc.).

```javascript
/**
 * Express middleware – logs every incoming HTTP request.
 */
function httpLogger(req, res, next) {
    const start = Date.now();

    // Hook into the response 'finish' event to capture the status code
    // We can't log status immediately – the route hasn't run yet
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.http(`${req.method} ${req.originalUrl}`, {
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
        });
    });

    next();
}

module.exports = { logger, httpLogger };
```

**Ligne 67 :** On enregistre le timestamp de début de requête.

**Ligne 71 :** On attache un écouteur sur l'événement `finish` de la réponse. On ne peut pas logguer le code de statut immédiatement car la route n'a pas encore été exécutée. L'événement `finish` est déclenché quand la réponse a été envoyée au client.

**Ligne 73-77 :** On loggue la méthode HTTP, l'URL, le code de statut, la durée et l'IP. Ces infos sont cruciales pour le débogage : "la route X a mis 5 secondes à répondre avec un 500".

**Pourquoi `logger.http()` et pas `logger.info()` ?** Winston définit 6 niveaux : `error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly`. `http` est un niveau dédié aux logs de requêtes HTTP. Ça permet de filtrer les logs : en développement tu veux tout voir, en production tu veux peut-être masquer les logs HTTP pour ne garder que les infos importantes.

### 3.2 — `server.js` (lignes 20-49)

```javascript
const { logger } = require('./src/middlewares/logger');

// Ligne 21 : Log au démarrage
logger.info(`Server running at http://${HOST}:${PORT}`);

// Ligne 46-49 : Interception des promesses non gérées
process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Promise Rejection:', { reason });
    process.exit(1);
});

// Ligne 28-30 : Log lors de l'arrêt du serveur
const shutdown = (signal) => {
    logger.info(`${signal} received – shutting down gracefully`);
    // ...
};
```

Le logger est utilisé à plusieurs endroits dans le projet. Chaque module importe `logger` et l'utilise avec le niveau approprié.

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

```
1. L'application démarre → server.js appelle logger.info()
   ↓
   Winston écrit dans combined.log ET dans la console (si dev) :
   "2026-07-01 14:30:22 [INFO] Server running at http://localhost:3000"
   ↓
2. Une requête HTTP arrive → le middleware httpLogger s'exécute
   ↓
   Date.now() enregistre l'heure de début
   ↓
3. La requête traverse les autres middlewares (routes, contrôleurs, models...)
   ↓
   D'autres parties du code peuvent logger : logger.warn(), logger.error(), etc.
   ↓
4. La réponse est envoyée au client
   ↓
   L'événement 'finish' se déclenche sur res
   ↓
5. Winston écrit dans combined.log ET dans la console (si dev) :
   "2026-07-01 14:30:25 [HTTP] POST /api/v1/auth/login {"status":201,"duration":"312ms","ip":"::1"}"
   ↓
6. Si le fichier combined.log dépasse 10 Mo :
   → renamed to combined.log.1, nouveau fichier créé
   → si plus de 5 fichiers d'archive, le plus vieux est supprimé
```

**Logs écrits dans deux fichiers simultanément :**
- Les erreurs vont dans `error.log` ET `combined.log`
- Les autres messages vont uniquement dans `combined.log`

## 5. ANALOGIE

Une **boîte noire d'avion** (Winston) comparée à un **post-it sur le tableau** (console.log) :
- La boîte noire enregistre TOUT en continu avec des horodatages précis — si le serveur plante, tu peux remonter le temps pour comprendre ce qui s'est passé
- `console.log` c'est comme écrire sur un post-it : si la console se ferme (le terminal redémarre), les messages sont perdus à jamais
- Les transports sont comme des **enregistreurs multiples** : un micro dans le cockpit (console/term) ET une boîte noire étanche (fichier) — si l'un est détruit, l'autre survit
- La rotation des fichiers, c'est comme un **magnétophone à cassette** qui change automatiquement de cassette quand la bande est pleine

## 6. PIÈGES CLASSIQUES

### Piège #1 : Logger des données sensibles (mots de passe, tokens)

**Le problème :** Si tu loggues `req.body`, les mots de passe apparaissent en clair dans les fichiers de log. Quiconque a accès au serveur peut lire les logs et récupérer les identifiants.

**MAUVAIS code :**
```javascript
// Dans le contrôleur auth
logger.info(`User login attempt: ${JSON.stringify(req.body)}`);
// Résultat dans le log : "User login attempt: {"email":"test@test.com","password":"MonSuperMotDePasse123!"}"
```

**BON code :**
```javascript
// On log uniquement l'email, pas le mot de passe
logger.info(`Login attempt for email: ${req.body.email}`);
```

### Piège #2 : Utiliser `console.log` au lieu du logger

**Le problème :** `console.log` n'apparaît pas dans les fichiers de log (sauf si tu rediriges la sortie standard). En production, tu ne vois pas les messages. En plus, `console.log` n'a pas de niveau — tu ne peux pas filtrer.

**MAUVAIS code :**
```javascript
console.log('User registered:', userId);
// N'apparaît PAS dans logs/combined.log !
```

**BON code :**
```javascript
logger.info(`User registered: ${userId}`);
// Apparaît dans logs/combined.log et dans la console en dev
```

### Piège #3 : Logger sans vérifier la taille des fichiers

**Le problème :** Sans rotation, les fichiers de log peuvent atteindre plusieurs Go et saturer le disque dur, faisant planter le serveur.

**Solution :** `maxsize` et `maxFiles` sur les transports File, comme fait dans le projet.

## 7. ET SI ON FAISAIT AUTREMENT ?

### Option A : Morgan au lieu de Winston

- **Comment ça marche :** Morgan est un middleware Express dédié UNIQUEMENT au logging HTTP. Il fait uniquement ça, très bien, avec des formats prédéfinis (`combined`, `dev`, `tiny`).
- **Avantage :** Plus simple à configurer pour les logs HTTP, format prêt à l'emploi.
- **Inconvénient :** Morgan ne gère pas les logs applicatifs (erreurs, événements métier). Tu aurais besoin de Winston + Morgan (deux bibliothèques au lieu d'une).
- **Notre cas :** Winston seul est plus cohérent — une bibliothèque pour tout logger.

### Option B : Service externe de logging (Sentry, Logtail, Datadog)

- **Comment ça marche :** Les logs sont envoyés à un service SaaS qui les indexe, les analyse et permet de les rechercher.
- **Avantage :** Recherche puissante, alertes automatiques, historique illimité. Pas de fichiers à gérer.
- **Inconvénient :** Payant, dépend d'un service externe, complexe à configurer. Hors-scope pour un projet Bac+2.
- **Notre cas :** Le logging fichier est largement suffisant pour ce niveau de projet.

## 8. CHECKLIST POUR LE JURY

- [ ] Deux transports sont configurés : fichier `error.log` (niveau error uniquement) et fichier `combined.log` (tous niveaux) (`logger.js:34-49`)
- [ ] La rotation des fichiers est activée via `maxsize` et `maxFiles` (`logger.js:39-40`, `46-47`)
- [ ] La console avec couleurs est activée uniquement en développement, pas en production (`logger.js:53-60`)
- [ ] Le niveau de log minimum est `http` en production, `debug` en développement (`logger.js:30`)
- [ ] Le middleware `httpLogger` loggue chaque requête avec méthode, URL, statut, durée et IP (`logger.js:66-81`)
- [ ] Les erreurs non gérées (unhandledRejection) sont capturées et loggées (`server.js:46-49`)
- [ ] Le démarrage et l'arrêt du serveur sont loggés (`server.js:21`, `server.js:29`)
