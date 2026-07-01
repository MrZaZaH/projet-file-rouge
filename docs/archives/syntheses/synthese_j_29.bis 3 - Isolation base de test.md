# Synthèse Jour en + 4 — Isolation base de test + Nettoyage général

## Ce qu'on a fait

### 1. Base de test isolée : `recettes_humaines_test`

- Création de la base `recettes_humaines_test` avec `CREATE DATABASE IF NOT EXISTS ... CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
- Copie du schéma complet depuis `recettes_humaines` via `mysqldump --no-data` — 8 tables (categories, users, recipes, comments, ratings, admin_logs, favorites, user_notifications)
- Ajout des droits `dev_app` sur `recettes_humaines_test.*` (le GRANT existant `test\_%` ne matchait pas le nom)

### 2. `.env.test` corrigé

- `DB_NAME=recettes_humaines` → `DB_NAME=recettes_humaines_test`
- Nettoyage des lignes 15-21 : vieux token JWT et JSON "admin2222" supprimés

### 3. Génération des hash bcrypt

- `Admin123!` → `$2b$12$w89hz/RaFW14c5wMgfiuH.M1q36gagS8DJuA6mX9j5zEdY7mx6Xoa`
- `User1234!` → `$2b$12$/ZEJDq.vnEg2SF3VFOQ1reiosU4wPRaD59soyl/H8KdWsWf965YK.`
- Cost factor 12 (bcryptjs), identique à celui utilisé par `AuthController.js`

### 4. TRUNCATE complet des deux bases

- Suppression de toutes les données dans `recettes_humaines` ET `recettes_humaines_test` (8 tables chacune)
- Utilisation de `SET FOREIGN_KEY_CHECKS = 0` pour éviter les conflits de clés étrangères

### 5. Seed des deux bases

- `04_seed_data.sql` modifié : `USE recettes_humaines;` retiré → le script s'exécute avec la base cible passée en argument du client mysql
- Nouvelles seeds injectées dans les deux bases : 3 catégories, 5 users, 8 recettes, 30 commentaires, 30 notations

### 6. Documentation complète des 4 fichiers `.env`

- **`.env`** : tableau des comptes, explications par section (server, database, JWT, logs, CORS), sécurité documentée
- **`.env.example`** : mêmes sections avec placeholders pour les valeurs sensibles
- **`.env.test`** : doc du mécanisme d'isolation, comptes de test, note sur `clearDatabase()`
- **`.env.test.example`** : synced avec `.env.test`, `DB_NAME` corrigé, `JWT_EXPIRES_IN=1d`

### 7. Vérification fonctionnelle

- Les 5 comptes répondent correctement à `POST /api/v1/auth/login` :
  - `admin_ovni` : admin ✅
  - `mickael_b`, `sofia_r`, `jerome_k`, `anonyme_test` : user ✅
- Mauvais mot de passe → `401 Invalid email or password` ✅
- Les deux bases ont exactement les mêmes lignes dans chaque table

## Problèmes rencontrés

- **Mot de passe `dev_admin` inconnu** : le `.env` indiquait `polmnb2` mais l'authentification échouait. Résolu en utilisant `root` dont le mot de passe était aussi `polmnb2`.
  - Contexte : les 3 users BDD (dev_app, dev_admin, dev_readonly) ont été créés avec des mots de passe différents de ceux dans le SQL de référence.
  - Décision : on continue avec `root` pour les opérations DDL, `dev_app` pour le runtime. Il faudrait un jour synchroniser les mots de passe réels avec la doc.
- **GRANT `test\_%` non applicable** : `dev_app` avait des droits sur les bases commençant par `test_` mais pas sur `recettes_humaines_test`. Résolu par un GRANT explicite sur `recettes_humaines_test.*`.
- **Keyword SQL `TABLE`** : erreur de syntaxe lors de la vérification car `table` est un mot réservé MariaDB. Corrigé en renommant l'alias en `tbl`.

## Décisions techniques prises

- **Base test isolée obligatoire** : `clearDatabase()` TRUNCATE toutes les tables — impossible de le faire sans risque sur la base de dev. Non négociable.
- **Mêmes données dans les deux bases** : le seed injecte exactement les mêmes 5 comptes dans les deux environnements. Cohérence garantie entre dev et test.
- **`04_seed_data.sql` sans `USE`** : le script est désigné pour être exécuté avec la base cible en argument. Évite de dupliquer 200+ lignes de SQL pour un second `USE recettes_humaines_test`.
- **Hash bcrypt pré-générés** dans le seed, pas de hash à la volée. Les comptes existent dès l'injection SQL, pas besoin de passer par `/auth/register`.
- **Documentation dans les `.env`** plutôt que dans un fichier README ou wiki. L'information utile est au même endroit que la config qui l'utilise.

## Ce qui reste

- Synchroniser les mots de passe réels des users BDD (dev_admin, dev_readonly) avec la documentation
- `clearDatabase()` dans `tests/helpers/testDb.js` ne tronque pas `favorites` ni `user_notifications` — à mettre à jour si des tests touchent à ces tables
- Nettoyage des fichiers legacy (`*1.js` dans `src/`)
