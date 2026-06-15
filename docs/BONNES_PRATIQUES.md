# Bonnes pratiques — Ovni Culinaire

Projet : Ovni Culinaire  
Mis à jour au fil du projet.

---

## Base de données & SQL

### Injections SQL
Toujours utiliser des requêtes paramétrées (`?` avec `mysql2`).  
Ne jamais concaténer des valeurs utilisateur dans une requête SQL.  

**Exemple dangereux :**  
`"SELECT * FROM users WHERE email = '" + email + "'"`  

**Exemple correct :**  
`conn.query('SELECT * FROM users WHERE email = ?', [email])`

### Pool de connexions
Un pool = un parking de connexions MariaDB pré-ouvertes.  
L'application emprunte une connexion, l'utilise, la restitue.  
Évite d'ouvrir/fermer une connexion à chaque requête (coûteux).  

Toujours appeler `conn.release()` dans un bloc `finally` pour éviter les fuites.

### Principe du moindre privilège
Créer des utilisateurs MariaDB distincts avec des droits limités :
- `dev_app` : SELECT, INSERT, UPDATE, DELETE uniquement sur les tables de l'app.
- `dev_admin` : droits élargis pour les migrations, jamais utilisé par l'app en production.
- `dev_readonly` : lecture seule, pour audits ou debugging.

Ne jamais connecter l'application avec un compte `root`.

### Soft delete
Ne jamais supprimer physiquement une ligne en production.  
Ajouter un champ `deleted_at DATETIME NULL` sur les tables concernées.  

Toutes les requêtes publiques filtrent avec :
`WHERE deleted_at IS NULL`

Permet de restaurer des données supprimées par erreur.

### snake_case pour la base de données
Toutes les colonnes et tables en `snake_case` :  
`created_at`, `recipe_id`, `cost_per_portion`

Le camelCase reste pour les variables JavaScript côté Node.js.

---

## Authentification & JWT

### JWT (JSON Web Tokens)
Token signé avec un secret côté serveur.  
Contient des données encodées (pas chiffrées) — ne jamais y mettre de données sensibles.  

Toujours vérifier la signature à chaque requête protégée.  

Définir une expiration courte :  
`expiresIn: '24h'` maximum pour le MVP.

---

## Sécurité Express (headers, CORS, rate limiting)

### Helmet
Middleware Express qui positionne des headers HTTP de sécurité automatiquement.  
Protège contre des attaques connues (clickjacking, sniffing MIME, etc.).  

À activer en tout premier dans `app.js`.

### CORS

### Rate limiting

---

## Validation des entrées

---

## Mots de passe & bcrypt

### Hashage des mots de passe
Ne jamais stocker un mot de passe en clair.  

Utiliser `bcryptjs` avec un salt rounds ≥ 10.  

Le hash est à sens unique : impossible de retrouver le mot de passe original.

---

## Front-end & XSS

---

## Architecture & organisation

### Séparation des préoccupations (modèles)
Chaque fichier modèle ne gère qu'une entité.  

Les requêtes SQL restent dans les modèles, jamais dans les contrôleurs ou les routes.  

Les contrôleurs appellent les modèles, ils ne construisent pas de SQL.

### Logique applicative vs triggers SQL

**Trigger SQL :** logique exécutée automatiquement côté base de données.  
- Garantie d'exécution même hors application.  
- Invisible dans le code Node.js, difficile à tester et à déboguer.  

**Logique applicative :** logique dans les modèles Node.js.  
- Lisible, testable, maintenable.  
- Ne s'exécute pas si la BDD est modifiée directement en SQL.  

**Décision retenue pour le MVP :** logique applicative.  
Raison : seule l'application modifie les données en production.  

Un trigger pourrait être ajouté post-MVP comme filet de sécurité.

---

## Tests

### Idempotence des scripts de test
Un script de test idempotent peut être lancé plusieurs fois sans modifier l'état de la base.  

Stratégie : collecter les IDs créés pendant le test, les supprimer dans un bloc `finally`.  

Le bloc `finally` s'exécute même si le test plante en cours de route.

---

## Environnement & configuration

### Variables d'environnement
Les credentials (DB, JWT secret, etc.) ne doivent jamais être dans le code source.  

Utiliser `.env` + `.env.example` (sans valeurs réelles).  

`.env` doit être dans `.gitignore` — vérifier avant chaque commit.

### dotenv et ordre de chargement
`require('dotenv').config()` doit être appelé avant tout module qui lit `process.env`.  

Dans un script lancé directement avec `node`, `app.js` n'est pas exécuté.  

Toujours ajouter `require('dotenv').config()` en première ligne des scripts standalone.

---

## Git & versioning

### Commits conventionnels
Format : `type: description courte`  

Types utilisés :  
`feat`, `fix`, `docs`, `chore`, `test`, `refactor`  

Exemple :  
`feat: add Rating model with points attribution`  

Pourquoi : historique lisible, facilite les revues de code et les changelogs.
## Performance – MariaDB Indexes (Jour 14)

### Pourquoi indexer

Sans index, MariaDB fait un full table scan : il lit chaque ligne pour trouver
les correspondances. Sur 10 000 recettes, une requête `WHERE status = 'published'`
lit 10 000 lignes. Avec un index sur `status`, il lit uniquement les lignes
correspondantes via une structure B-tree.

### Index composite vs index simple

`CREATE INDEX ON recipes (status, deleted_at)` couvre `WHERE status = ? AND deleted_at IS NULL`
en un seul accès. Deux index séparés obligent l'optimiseur à fusionner des résultats
en mémoire (index merge) — moins efficace.

L'ordre des colonnes dans un index composite suit la règle du "leftmost prefix" :
l'index `(A, B)` est utilisé pour `WHERE A = ?`, `WHERE A = ? AND B = ?`,
mais PAS pour `WHERE B = ?` seul.

### Colonnes non indexées délibérément

- `ingredients`, `steps` : stockées en JSON, pas filtrées directement
- `anecdote` : texte long, pas filtré
- `password_hash` : jamais dans un WHERE

### Commande de vérification

```sql
EXPLAIN SELECT * FROM recipes WHERE status = 'published' AND deleted_at IS NULL;
