# Winston Logger

## Contexte

Une application a besoin de logger les requêtes HTTP et les erreurs internes. `console.log()` ne suffit pas : pas de niveaux, pas de format structuré, pas de transport fichier.

---

## Pourquoi Winston et pas `console.log` ?

### Ce que `console.log` ne permet pas

| Besoin | console.log | Winston |
|---|---|---|
| Niveaux (info/warn/error) | Non — tout est stdout | Oui — filtrable |
| Format structuré (JSON) | Non — texte brut | Oui |
| Transport fichier | Non — noyé dans stdout | Oui — fichier dédié |
| Timestamp automatique | À faire à la main | Intégré |
| Rotation de logs | Non | Oui (via winston-daily-rotate-file) |

**Risque de l'inverse (`console.log`) :** en production, les logs sont du texte brut noyé dans stdout. Un outil comme Datadog ou ELK peut parser du JSON structuré mais pas du texte libre.

### Ce qui est fait

`src/middlewares/logger.js` :

```javascript
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    ],
});
```

Deux transports :
- **Console** : tous les niveaux — pour Docker/Heroku qui capturent stdout
- **File (error.log)** : seulement les erreurs — pour debug rétrospectif

### Http logger (Morgan-like)

```javascript
const httpLogger = morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } });
```

On utilise Morgan pour le format HTTP standard, mais on redirige sa sortie vers Winston plutôt que stdout. Unification de tous les logs dans le même système.

### En version 2

- Ajouter un transport daily rotate : un fichier par jour, compression des vieux fichiers
- Logger les performances des requêtes SQL (temps d'exécution)
- Ajouter un ID de requête unique (corrélation entre logs HTTP et logs applicatifs)
- Logger les erreurs avec le body de la requête (attention à ne pas logger les mots de passe)
