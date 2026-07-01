# Synthèse Jour 6 — Architecture Express, Connexion MariaDB, Sécurité de base

__Synthèse – Jour 6 : Architecture Express \+ Connexion MariaDB \+ Sécurité de base__

__Ce qu'on a fait__

- Création de l'architecture src/ complète (config, database, middlewares, utils, models, controllers, routes)
- src/config/database.js – configuration du pool mysql2 avec namedPlaceholders
- src/database/connection.js – pool exporté \+ testConnection() avec finally garantissant le release()
- src/middlewares/logger.js – Winston avec transport fichier \+ console (dev), middleware httpLogger
- src/middlewares/security.js – Helmet \+ CORS avec whitelist explicite
- src/middlewares/errorHandler.js – handler centralisé 4 paramètres, stack trace masquée en prod
- app.js – Express configuré, middlewares dans le bon ordre, route /health, 404 handler
- server.js – point d'entrée séparé, graceful shutdown SIGINT/SIGTERM, unhandledRejection
- logs/.gitkeep – dossier tracké, contenu ignoré
- mise à jour de la structure du projet dans Readme.md
- mise à jour de « scripts » dans Package.json
- Commit propre poussé sur GitHub

__Problèmes rencontrés__

__Échec de connexion MariaDB (Access denied for dev_app)__

- __Contexte__ : node server.js échouait systématiquement malgré un .env apparemment correct.
- __Options envisagées__ : mot de passe incorrect dans .env / utilisateur mal créé en base / ALTER USER non appliqué (MariaDB nécessite FLUSH PRIVILEGES selon les versions).
- __Décision retenue__ : DROP \+ CREATE USER propre avec FLUSH PRIVILEGES. Le hash visible dans SHOW GRANTS confirmait que le mot de passe en base ne correspondait pas à celui du .env. L'utilisateur avait les bons droits (SELECT, INSERT, UPDATE, DELETE sur les deux bases uniquement) – ce n'était pas un problème de permissions mais de mot de passe désynchronisé.

__Décisions techniques prises__

- app.js et server.js séparés – obligatoire pour que supertest fonctionne sans conflit de port
- namedPlaceholders: true – toutes les requêtes utilisent :param plutôt que ?
- connectionLimit: 10, queueLimit: 0 – pool conservateur, file d'attente illimitée
- Stack trace jamais exposée au client en production
- dev_app avec droits limités (pas root, pas GRANT, pas DROP)

__Ce qui a été écarté__

- Utiliser le mot de passe root dans dev_app – refusé, l'utilisateur a ses propres credentials
- nodemon – remplacé par node --watch (Node 18 LTS natif, zéro dépendance supplémentaire)

### Concrètement ça change quoi ?

Sans watch :

- node server.js
-  tu modifies ton code → rien ne se passe
-  tu dois faire Ctrl\+C puis relancer

Avec watch :

- node --watch server.js
- tu modifies ton fichier → le serveur redémarre automatiquement

