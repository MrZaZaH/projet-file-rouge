## Logs serveur — où et comment les consulter

### En bref

Le projet utilise **Winston** pour écrire les logs. Deux fichiers sont créés dans le dossier `logs/` à la racine du projet :

| Fichier | Contenu | Utilité |
|---|---|---|
| `logs/combined.log` | Toutes les requêtes HTTP + infos + warnings + erreurs | Voir ce qui se passe sur le serveur |
| `logs/error.log` | Uniquement les erreurs graves | Debug rapide sans filtrer |

### Comment lire les logs

Les logs sont horodatés et classés par niveau :

```
2026-06-29 07:23:08 [HTTP] GET /api/v1/recipes {"status":200,"duration":"15ms","ip":"::1"}
2026-06-29 07:23:08 [HTTP] GET /api/v1/recipes/random {"status":200,"duration":"5ms","ip":"::1"}
2026-06-29 07:23:08 [HTTP] GET /css/styles.css {"status":304,"duration":"2ms","ip":"::1"}
```

Chaque ligne te dit :
- **Quand** : timestamp précis
- **Quoi** : méthode HTTP + URL
- **Résultat** : code status (200 = OK, 304 = cache, 404 = pas trouvé, 429 = rate limit, 500 = erreur serveur)
- **Durée** : temps de réponse en ms
- **IP** : d'où vient la requête

### Commandes utiles

```bash
# Voir les 20 dernières lignes (les plus récentes)
tail -20 logs/combined.log

# Voir en temps réel les nouvelles requêtes
tail -f logs/combined.log

# Chercher une erreur spécifique
grep "500" logs/combined.log

# Voir uniquement les appels API recettes
grep "/api/v1/recipes" logs/combined.log

# Voir les tentatives d'auth
grep "/api/v1/auth" logs/combined.log

# Voir les rate limits (429)
grep "429" logs/combined.log
```

**Sur Windows (Git Bash)** : les mêmes commandes marchent. Si `tail` n'est pas disponible, utilise `cat` ou ouvre le fichier dans VS Code.

### Ce qu'on peut diagnostiquer avec les logs

| Problème | Ce qu'on voit dans les logs |
|---|---|
| L'API répond-elle ? | Ligne `GET /api/v1/recipes` avec `200` |
| Rate limit atteint ? | Ligne avec `status:429` |
| Erreur 500 ? | Ligne avec `status:500` + stack trace |
| La page est-elle servie ? | Ligne `GET /index.html` avec `200` |
| Le JS est-il chargé ? | Ligne `GET /js/app.js` avec `200` ou `304` |
| Erreur BDD ? | Ligne `[ERROR]` avec le message d'erreur SQL |

### Piège : ce que les logs serveur ne montrent PAS

- **Erreurs JavaScript côté navigateur** (CSP, syntax errors, ReferenceError) → console navigateur (F12)
- **Problèmes de cache navigateur** (304 alors que le fichier a changé) → navigation privée ou Ctrl+F5
- **Erreurs CORS** → console navigateur (onglet Console ou Network)
- **Bloquages CSP** → console navigateur (onglet Console)

**Règle d'or :** si curl fonctionne mais que le navigateur ne fait rien → c'est un problème **navigateur**. Ouvre la console. Si curl ne fonctionne pas → c'est un problème **serveur**. Regarde les logs.
