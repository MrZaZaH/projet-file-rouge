# Health Check

## Contexte

Un endpoint qui vérifie que l'application est vivante et que la base de données répond.

---

## Pourquoi un endpoint dédié ?

### Ce qui est fait

`app.js:46-62` :

```javascript
app.get('/health', async (req, res, next) => {
    await pool.query('SELECT 1');
    res.status(200).json({
        success: true,
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'connected',
        environment: process.env.NODE_ENV || 'development',
    });
});
```

**Risque de l'inverse (pas de health check) :** un load balancer ou un orchestrateur (Kubernetes, Docker) ne peut pas savoir si l'app est prête. Si la DB est down, le serveur HTTP répond encore 200 sur n'importe quelle route, mais toutes les requêtes échouent. Le health check vérifie explicitement la DB et renvoie 503 si elle est indisponible.

### À quoi ça sert

- **Monitoring** : uptime robot, Pingdom, etc. peuvent vérifier le statut
- **Déploiement** : l'orchestrateur attend le 200 pour router le trafic vers la nouvelle instance
- **Debug** : un humain peut taper `/health` pour savoir si le problème vient de l'app ou de la DB

### En version 2

- Ajouter la vérification des dépendances : Redis (si implémenté), disk space
- Temps de réponse de la DB (slow query detection)
- Uptime du serveur (process.uptime())
