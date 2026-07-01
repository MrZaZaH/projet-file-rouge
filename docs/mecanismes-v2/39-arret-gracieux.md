# 39 — Arrêt Gracieux (Graceful Shutdown)

## 1. CE QUE ÇA FAIT (vue d'ensemble)

Quand le serveur Node.js reçoit un signal d'arrêt (Ctrl+C, SIGTERM), il ne s'arrête pas brutalement. Il ferme d'abord les connexions HTTP en cours, attend que les requêtes actives se terminent, puis s'arrête proprement. Si les connexions ne se ferment pas dans les 10 secondes, il force l'arrêt.

Un gestionnaire global attrape aussi les promesses non gérées (`unhandledRejection`) pour éviter que l'application ne reste dans un état instable.

## 2. SCHÉMA DE LA TABLE

Pas de table — c'est du code serveur pur.

## 3. LE CODE

### 3.1 — server.js (`server.js:28-49`)

```javascript
const shutdown = (signal) => {
    logger.info(`${signal} received – shutting down gracefully`);
    server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });

    // Force shutdown after 10 seconds if connections don't close
    setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Catch unhandled promise rejections – log them before crashing
process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Promise Rejection:', { reason });
    process.exit(1);
});
```

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

1. Le serveur reçoit un signal d'arrêt : `SIGTERM` (arrêt système, kill, Docker) ou `SIGINT` (Ctrl+C dans le terminal).
2. La fonction `shutdown(signal)` est appelée :
   - Elle log le signal reçu dans la console.
   - Elle appelle `server.close()` qui **arrête d'accepter les nouvelles connexions**.
   - `server.close()` prend un callback qui s'exécute quand **toutes les connexions en cours sont terminées**.
3. Dans le callback de `server.close()` :
   - Log "HTTP server closed".
   - `process.exit(0)` — arrêt propre, code 0 = succès.
4. Parallèlement, un `setTimeout` de 10 secondes est lancé :
   - Si `server.close()` n'a pas fini dans les 10s (connexions bloquées, requêtes lentes).
   - Log "Forced shutdown after timeout".
   - `process.exit(1)` — arrêt forcé, code 1 = erreur.
5. Le gestionnaire `unhandledRejection` :
   - Attrape les promesses rejetées sans `.catch()`.
   - Log l'erreur pour debug.
   - Arrête le processus avec `process.exit(1)`.

## 5. ANALOGIE

C'est la procédure d'évacuation d'un immeuble. Quand l'alarme sonne (SIGTERM) :
- Tu arrêtes d'accepter de nouvelles personnes à l'entrée (`server.close()`).
- Tu attends que tout le monde sorte des bureaux (connexions HTTP en cours).
- Si après 10 minutes il reste des gens, tu évacues de force (setTimeout).
- Tu éteins les lumières en partant (`process.exit(0)`).

Si quelqu'un tombe dans les escaliers (`unhandledRejection`), tu t'arrêtes immédiatement pour éviter que ça empire.

## 6. PIÈGES CLASSIQUES

### Piège #1 : Oublier `server.close()`

Sans `server.close()`, le `process.exit()` coupe brutalement toutes les connexions. Les clients reçoivent une erreur de connexion au lieu d'une réponse propre. Les données en transit peuvent être perdues.

### Piège #2 : Pas de timeout de force

Certaines connexions peuvent ne jamais se fermer (clients zombies, requêtes bloquées). Sans timeout, le serveur reste bloqué indéfiniment. Le délai de 10 secondes garantit que le processus finit par s'arrêter.

### Piège #3 : `process.exit(1)` vs `process.exit(0)`

`exit(1)` dans le timeout signale au système d'exploitation que l'arrêt a échoué. `exit(0)` dans le callback signifie "arrêt réussi". Les orchestrateurs comme Docker utilisent ces codes pour décider de redémarrer ou non le conteneur.

### Piège #4 : Ne pas catcher `unhandledRejection`

Sans ce handler, une promesse rejetée non gérée ne fait rien... jusqu'à ce que le garbage collector la ramasse. Mais dans Node.js 15+, une `unhandledRejection` non gérée **termine le processus** avec un code d'erreur. Autant le faire proprement avec un log.

## 7. ET SI ON FAISAIT AUTREMENT ?

**Option A** : Package externe `http-terminator`. Gère le graceful shutdown avec plus de finesse : timeout configurable, drainage des connexions keep-alive, arrêt des workers. Pas nécessaire pour un MVP.

**Option B** : Utiliser `pm2` comme process manager. PM2 gère le graceful shutdown automatiquement en envoyant SIGINT aux processus enfants. Solution plus complète pour la production, mais le code reste utile comme filet de sécurité.

**Option C** : Ne rien faire et laisser `process.exit` implicite. Déconseillé car les connexions HTTP sont coupées brutalement, ce qui peut causer des erreurs 502 derrière un reverse proxy (Nginx).

## 8. CHECKLIST POUR LE JURY

- [ ] `process.on('SIGTERM', ...)` et `process.on('SIGINT', ...)` enregistrés dans `server.js`
- [ ] `server.close()` arrête d'accepter les nouvelles requêtes
- [ ] Callback de `server.close()` appelle `process.exit(0)`
- [ ] `setTimeout` de 10 secondes force `process.exit(1)` si le close bloque
- [ ] `process.on('unhandledRejection', ...)` log et arrête le processus
- [ ] Messages de log clairs pour chaque étape du shutdown
- [ ] Code d'exit : 0 (succès) dans le callback, 1 (erreur) dans le timeout
