# 43 — Schéma de Base de Données Complet (DDL)

## 1. CE QUE ÇA FAIT (vue d'ensemble)

Le DDL (Data Definition Language) est l'ensemble des instructions SQL qui définissent la structure de la base de données. Le projet OVNI Culinaire utilise 7 tables principales, réparties dans plusieurs fichiers SQL exécutés séquentiellement. Chaque table a des contraintes précises (clés étrangères, index, CHECK, UNIQUE, ENUM) qui garantissent l'intégrité des données au niveau base — pas seulement au niveau application.

Les scripts sont exécutés dans l'ordre : `01_create_database.sql` → `02_create_users.sql` → `03_create_tables.sql` → `05_add_image_url.sql` → `06_indexes.sql` → `07_create_favorites_table.sql`.

## 2. SCHÉMA DE LA TABLE

### Vue d'ensemble des 7 tables

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐
│  categories │    │    users     │    │   recipes    │
├─────────────┤    ├──────────────┤    ├──────────────┤
│ id          │    │ id           │    │ id           │
│ name        │    │ username     │◄───│ user_id      │
│ slug (UQ)   │    │ email (UQ)   │    │ category_id  │◄──┐
│ created_at  │    │ password_hash│    │ title        │   │
│ deleted_at  │    │ role (ENUM)  │    │ anecdote     │   │
└─────────────┘    │ points       │    │ ingredients  │   │
                   │ created_at   │    │ steps (JSON) │   │
                   │ updated_at   │    │ prep_time    │   │
                   │ deleted_at   │    │ cost_per_dec │   │
                   └──────┬───────┘    │ image_url    │   │
                          │            │ status (ENUM)│   │
                          │            │ avg_rating   │   │
                          │            │ rating_count │   │
                          │            │ created_at   │   │
                          │            │ updated_at   │   │
                          │            │ deleted_at   │   │
                          │            └──────┬───────┘   │
                          │                   │           │
                          │    ┌──────────────┘           │
                          │    │    ┌─────────────────────┘
                          ▼    ▼    ▼
                    ┌──────────────────────┐
                    │       comments       │
                    ├──────────────────────┤
                    │ id                   │
                    │ recipe_id            │
                    │ user_id (NULLABLE)   │
                    │ guest_name (NULLABLE)│
                    │ content              │
                    │ created_at           │
                    │ deleted_at           │
                    └──────────────────────┘

                    ┌──────────────────────┐
                    │       ratings        │
                    ├──────────────────────┤
                    │ id                   │
                    │ recipe_id            │
                    │ user_id              │
                    │ score (1-5, CHECK)   │
                    │ created_at           │
                    │ updated_at           │
                    │ UQ(user_id,recipe_id)│
                    └──────────────────────┘

                    ┌──────────────────────┐
                    │     admin_logs       │
                    ├──────────────────────┤
                    │ id                   │
                    │ admin_id             │
                    │ target_type          │
                    │ target_id            │
                    │ action               │
                    │ created_at           │
                    └──────────────────────┘

                    ┌──────────────────────────┐
                    │    user_notifications    │
                    ├──────────────────────────┤
                    │ id                       │
                    │ user_id                  │
                    │ message                  │
                    │ read_at (NULLABLE)       │
                    │ created_at               │
                    └──────────────────────────┘

                    ┌──────────────────────┐
                    │      favorites       │
                    ├──────────────────────┤
                    │ id                   │
                    │ user_id              │
                    │ recipe_id            │
                    │ created_at           │
                    │ UQ(user_id,recipe_id)│
                    └──────────────────────┘
```

### Description détaillée de chaque table

**categories** (database/scripts/03_create_tables.sql:14-22) — Table indépendante, sans FK. Stocke les catégories de recettes (Pâtes, Soupe, Dessert, etc.). Le slug est URL-friendly avec contrainte UNIQUE.

**users** (03_create_tables.sql:32-43) — Comptes utilisateurs. `password_hash` contient le hash bcrypt (60 caractères, mais VARCHAR(255) pour évolutivité). `role` est un ENUM('user', 'admin') avec défaut 'user'. `points` gardé pour gamification future.

**recipes** (03_create_tables.sql:54-91) — Table centrale. Clés étrangères vers `users` et `categories` avec `ON DELETE RESTRICT` (ne pas supprimer un utilisateur ou une catégorie qui a des recettes). `ingredients` et `steps` sont des colonnes JSON. `average_rating` est dénormalisé (mis à jour à chaque nouvelle note). `status` est ENUM('pending', 'published', 'rejected').

**comments** (03_create_tables.sql:99-120) — `user_id` NULLABLE pour permettre les commentaires sans compte (guest). `guest_name` renseigné quand user_id est NULL. FK vers `users` avec `ON DELETE SET NULL` : si l'utilisateur supprime son compte, ses commentaires restent mais sans lien.

**ratings** (03_create_tables.sql:128-151) — Contrainte `CHECK (score BETWEEN 1 AND 5)` au niveau BDD. Contrainte `UNIQUE (user_id, recipe_id)` : un seul vote par utilisateur par recette.

**admin_logs** (03_create_tables.sql:160-174) — Table d'audit. `target_type`/`target_id` forment une référence polymorphe (peut pointer vers recipe, comment, user).

**user_notifications** — Table créée dans le cadre de la modération. `read_at` NULLABLE permet de savoir si la notification a été lue. Indexée sur `(user_id, read_at)`.

**favorites** (database/scripts/07_create_favorites_table.sql:12-24) — Relation many-to-many entre users et recipes. `ON DELETE CASCADE` : si l'utilisateur ou la recette est supprimé(e), les favoris sont automatiquement nettoyés.

### Contraintes FK récapitulatives

| FK | De | Vers | Comportement | Raison |
|---|---|---|---|---|
| fk_recipes_user | recipes.user_id | users.id | RESTRICT | Ne pas perdre les recettes d'un user |
| fk_recipes_category | recipes.category_id | categories.id | RESTRICT | Ne pas supprimer une catégorie utilisée |
| fk_comments_recipe | comments.recipe_id | recipes.id | RESTRICT | Cohérence des commentaires |
| fk_comments_user | comments.user_id | users.id | SET NULL | Conserver les commentaires orphelins |
| fk_ratings_recipe | ratings.recipe_id | recipes.id | RESTRICT | Cohérence des notes |
| fk_ratings_user | ratings.user_id | users.id | RESTRICT | Cohérence des notes |
| fk_admin_logs_admin | admin_logs.admin_id | users.id | RESTRICT | Trace d'audit non modifiable |
| fk_favorites_user | favorites.user_id | users.id | CASCADE | Nettoie les favoris à la suppression |
| fk_favorites_recipe | favorites.recipe_id | recipes.id | CASCADE | Nettoie les favoris à la suppression |

Pourquoi 3 comportements différents ?
- **RESTRICT** : données critiques qu'on ne veut pas perdre silencieusement (recettes, notes, logs d'audit).
- **SET NULL** : données qu'on veut garder visibles même si le compte parent disparaît (commentaires d'un user supprimé).
- **CASCADE** : données de relation pure, sans valeur propre (favoris) — si l'user ou la recette n'existe plus, le favori n'a pas de sens.

### ENUMs

- `users.role` : `'user' | 'admin'` — sert au middleware requireAdmin
- `recipes.status` : `'pending' | 'published' | 'rejected'` — pipeline de modération

### CHECK

- `ratings.score BETWEEN 1 AND 5` — garantit que la note est valide même si le frontend envoie n'importe quoi

### Colonnes JSON

- `recipes.ingredients` : tableau d'objets `{name, quantity, unit}`
- `recipes.steps` : tableau ordonné de chaînes (les étapes de la recette)

Avantage du JSON : pas besoin de tables séparées ingredients/steps avec jointures complexes. Inconvénient : on ne peut pas interroger individuellement (ex: "toutes les recettes qui utilisent du poulet") sans fonctions JSON spécifiques.

## 3. LE CODE

### 3.1 — 03_create_tables.sql (database/scripts/03_create_tables.sql:1-199)

### 3.2 — 05_add_image_url.sql (database/scripts/05_add_image_url.sql:1-12)

Ajoute `image_url VARCHAR(500)` NULL après `cost_per_portion`. Les recettes sans image sont valides.

### 3.3 — 06_indexes.sql (database/scripts/06_indexes.sql:1-127)

Crée les index de performance. Ajoute la colonne `views` sur recipes.

### 3.4 — 07_create_favorites_table.sql (database/scripts/07_create_favorites_table.sql:1-27)

Crée la table favorites avec CASCADE sur les deux FK.

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

1. **01_create_database.sql** crée la base `recettes_humaines` et l'utilisateur `dev_admin` avec son mot de passe.
2. **02_create_users.sql** crée les utilisateurs applicatifs (`app_user` pour le backend, `app_admin` pour les scripts d'administration) avec des privilèges minimaux.
3. **03_create_tables.sql** crée les 7 tables (categories, users, recipes, comments, ratings, admin_logs, user_notifications) avec toutes leurs contraintes FK, ENUM, CHECK, UNIQUE et les index de base.
4. **05_add_image_url.sql** modifie la table recipes pour ajouter la colonne `image_url` (besoin apparu après la création initiale).
5. **06_indexes.sql** ajoute la colonne `views` et des index composites optimisés pour les requêtes réelles (filtre status+deleted_at, filtre category+deleted_at, etc.).
6. **07_create_favorites_table.sql** crée la table favorites (besoin apparu après l'analyse du besoin de bookmarks utilisateur).

Quand le backend démarre (ou lors d'un déploiement), ces scripts sont exécutés une seule fois pour initialiser ou migrer la base. Si un script est déjà passé, `IF NOT EXISTS` empêche les erreurs.

## 5. ANALOGIE

Le DDL, c'est le plan d'architecte d'un immeuble. Chaque table est une pièce avec sa fonction spécifique :
- `categories` : le hall d'entrée avec les panneaux directionnels
- `users` : le registre des habitants
- `recipes` : les appartements (pièce principale)
- `comments` : les carnets de visite laissés par les invités
- `ratings` : le livre d'or avec notes sur 5
- `admin_logs` : le registre de sécurité (qui est entré, qui a fait quoi)
- `favorites` : les favoris des habitants (appartements marqués d'un cœur)

Les contraintes FK sont les règles de l'immeuble : "tu ne peux pas supprimer un appartement si la cuisine est encore en train de cuisiner" (RESTRICT), "si un habitant part, ses commentaires restent affichés mais sans son nom" (SET NULL), "si un appartement est détruit, les marque-pages dessus sont automatiques retirés" (CASCADE).

## 6. PIÈGES CLASSIQUES

### Piège #1 : Perte de données avec DELETE CASCADE

La table `favorites` utilise `ON DELETE CASCADE`. C'est intentionnel, mais si on ajoute CASCADE sur une mauvaise table (ex: recipes → comments), supprimer une recette supprime tous ses commentaires sans avertissement. Toujours réfléchir : "est-ce que cette donnée a une valeur en dehors de son parent ?"

### Piège #2 : JSON sans validation structurelle

MariaDB stocke le JSON mais ne valide pas sa structure. Rien n'empêche d'insérer `{"nimporte": "quoi"}` dans `ingredients` au lieu d'un tableau. La validation doit être faite dans le code (express-validator côté API), ce qui crée une fragilité : si la validation change, les anciennes données JSON peuvent devenir invalides.

### Piège #3 : Dépendance d'ordre des scripts

Les scripts SQL doivent être exécutés dans un ordre strict (numérotation : 01, 02, 03...). Si on exécute `05_add_image_url.sql` avant `03_create_tables.sql`, la colonne `cost_per_portion` n'existe pas encore et l'ALTER TABLE échoue. Le déploiement automatisé doit respecter cet ordre.

### Piège #4 : Index manquant sur deleted_at

Beaucoup de requêtes filtrent avec `WHERE deleted_at IS NULL`. Sans index sur `deleted_at`, MariaDB doit scanner toutes les lignes pour trouver les actives. Les index composites (`status, deleted_at`) dans 06_indexes.sql résolvent ce problème mais doivent être pensés requête par requête.

## 7. ET SI ON FAISAIT AUTREMENT ?

**Tables normalisées pour ingredients et steps** : On pourrait avoir `recipe_ingredients` et `recipe_steps` comme tables séparées avec FK. Plus rigide mais interrogeable (SELECT * FROM ingredients WHERE name = 'poulet'). Le choix JSON a été fait pour le MVP car plus simple et plus flexible — le schéma des ingrédients varie énormément entre les recettes.

**NoSQL** : Une base NoSQL (MongoDB) serait plus naturelle pour stocker des documents recettes avec leurs ingrédients embarqués. Mais le projet impose MariaDB (relationnel, ACID, contraintes FK). Le JSON dans MariaDB est un compromis : structure relationnelle avec flexibilité document.

**Soft delete avec deleted_at** : Alternative : table d'archives séparée (ex: `deleted_recipes`). Le soft delete est plus simple mais toutes les requêtes doivent penser à filtrer `deleted_at IS NULL`. Un oubli et les données supprimées réapparaissent.

## 8. CHECKLIST POUR LE JURY

- [ ] Connaître les 7 tables et leur rôle
- [ ] Expliquer la différence entre RESTRICT, SET NULL et CASCADE
- [ ] Comprendre pourquoi `favorites` utilise CASCADE et pas `comments`
- [ ] Justifier le choix JSON pour ingredients/steps plutôt que des tables séparées
- [ ] Expliquer ce qu'est une colonne dénormalisée (average_rating) et pourquoi on l'utilise
- [ ] Comprendre qu'un CHECK et UNIQUE sont des contraintes BDD, pas applicatives
- [ ] Expliquer le rôle des index composites (ex: idx_recipes_status_deleted)
- [ ] Connaître l'ordre d'exécution des scripts SQL
- [ ] Expliquer pourquoi `user_id` dans comments est NULLABLE (guest comments)
