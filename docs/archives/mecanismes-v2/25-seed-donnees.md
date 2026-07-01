# 25 — Seed de Base de Données

## 1. CE QUE ÇA FAIT (vue d'ensemble)

Le script `04_seed_data.sql` insère un jeu de données de test complet : 5 utilisateurs, 4 catégories, 8 recettes, 30 commentaires, 29 notations. Il est exécutable sur la base de dev ET la base de test via mysql directement. Les mots de passe sont pré-hashés (bcrypt cost 12) et les moyennes sont pré-calculées dans `average_rating`.

## 2. SCHÉMA DE LA TABLE

Tables seedées (dans l'ordre d'insertion) : `categories`, `users`, `recipes`, `comments`, `ratings`.

## 3. LE CODE

### 3.1 — Catégories (`database/scripts/04_seed_data.sql:39-44`)

```sql
INSERT INTO categories (id, name, slug) VALUES
(1, 'Rapide',       'rapide'),
(2, 'Petit budget', 'petit-budget'),
(3, 'Élaborée',     'elaboree'),
(4, 'Autre',        'autre');
```

4 catégories : Rapide (Salarié crevé), Petit budget (Étudiant fauché), Élaborée (Parent épuisé), Autre (au cas où).

### 3.2 — Users (`database/scripts/04_seed_data.sql:50-55`)

```sql
INSERT INTO users (id, username, email, password_hash, role) VALUES
(1, 'mickael_b',    'mickael@example.com', '$2b$12$/ZEJDq.vnEg2SF3VFOQ1reiosU4wPRaD59soyl/H8KdWsWf965YK.', 'user'),
(2, 'sofia_r',      'sofia@example.com',   '$2b$12$/ZEJDq.vnEg2SF3VFOQ1reiosU4wPRaD59soyl/H8KdWsWf965YK.', 'user'),
(3, 'jerome_k',     'jerome@example.com',  '$2b$12$/ZEJDq.vnEg2SF3VFOQ1reiosU4wPRaD59soyl/H8KdWsWf965YK.', 'user'),
(4, 'anonyme_test', 'anon@example.com',    '$2b$12$/ZEJDq.vnEg2SF3VFOQ1reiosU4wPRaD59soyl/H8KdWsWf965YK.', 'user'),
(5, 'admin_ovni',   'admin@example.com',   '$2b$12$w89hz/RaFW14c5wMgfiuH.M1q36gagS8DJuA6mX9j5zEdY7mx6Xoa', 'admin');
```

- 4 users + 1 admin. Les 4 users partagent le même hash (même mot de passe `User1234!`).
- Le hash admin (`Admin123!`) est différent.
- Les hashs sont générés AVEC bcrypt cost factor 12 (volontairement lent — simule la prod).

### 3.3 — Recettes (`database/scripts/04_seed_data.sql:69-138`)

```sql
INSERT INTO recipes (
    id, user_id, category_id, title, anecdote,
    ingredients, steps, prep_time, cost_per_portion, status,
    average_rating, rating_count
) VALUES
-- A — prep_time < 15, cost < 3.00, published (catégorie Rapide)
(1, 1, 1,
 'Raisin au miel',
 'Un soir de fridge-raid total...',
 '["raisin", "miel"]',
 '["Verser du miel dans un bol.", "Tremper les raisins dans le miel.", "Manger immédiatement."]',
 2, 0.80, 'published', 4.25, 4),
 -- ... (8 recettes au total)
```

Les recettes couvrent TOUS les cas de filtrage :
- **A, B** : prep_time < 15 ET cost < 3.00 → apparaissent dans les deux filtres.
- **C, D** : prep_time < 15 MAIS cost > 3.00 → exclues du filtre budget.
- **E, F** : prep_time > 15 MAIS cost < 3.00 → exclues du filtre vitesse.
- **G** : status = 'pending' → invisible aux routes publiques (test modération).
- **H** : status = 'rejected' → invisible aux routes publiques (test pipeline rejet).

`ingredients` et `steps` sont stockés au format JSON (chaîne dans le SQL, parsée par MariaDB). `average_rating` et `rating_count` sont pré-calculés (dénormalisation).

### 3.4 — Commentaires (`database/scripts/04_seed_data.sql:149-195`)

```sql
INSERT INTO comments (id, recipe_id, user_id, guest_name, content) VALUES
(1,  1, 1,    NULL,          'Testé ce matin avec du raisin muscat...'),
(2,  1, NULL, 'Marie-Laure', 'Sympa mais bon... c''est juste du raisin...'),
```

30 commentaires répartis sur les 8 recettes. Certains ont `user_id` (utilisateurs connectés), d'autres ont `guest_name` (commentaires invités — `user_id` NULL). Les commentaires invités simulent le cas où un utilisateur non connecté commente sans token.

### 3.5 — Ratings (`database/scripts/04_seed_data.sql:213-260`)

```sql
INSERT INTO ratings (recipe_id, user_id, score) VALUES
(1, 1, 5),  (1, 2, 3),  (1, 3, 4),  (1, 4, 5),
-- ...
(6, 1, 5),  (6, 2, 4),  (6, 3, 5),  (6, 4, 3),  (6, 5, 4);
```

29 notations. Distribution des notes : 5, 4, 3, parfois 2. Pas de 1 (les users seedés sont bienveillants). Les invités (guest_name) ne peuvent pas noter car `ratings` nécessite un `user_id` (contrainte FOREIGN KEY). Les moyennes sont vérifiables :
- Recette A : (5+3+4+5) / 4 = 4.25 ✓
- Recette D : (5+4+2) / 3 = 3.67 ✓

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

1. Un administrateur exécute : `mysql -u dev_admin -p recettes_humaines < database/scripts/04_seed_data.sql`.
2. INSERT dans l'ordre : categories → users → recipes → comments → ratings.
3. Chaque INSERT respecte les contraintes FK (un commentaire référence un recipe_id qui existe).
4. Les hashs bcrypt sont insérés bruts (MariaDB ne connaît pas bcrypt — c'est le code Node.js qui comparera).
5. Les colonnes JSON (ingredients, steps) sont insérées comme des chaînes JSON valides.
6. `average_rating` est pré-rempli — le code Node.js mettra à jour cette colonne lors des nouveaux ratings.
7. Résultat : une base remplie avec des données cohérentes et testables.

## 5. ANALOGIE

C'est un décor de théâtre installé avant la répétition. Les acteurs (tests, développeurs) ont besoin d'un plateau crédible pour jouer leurs scènes. Les accessoires (catégories), les personnages (users), les scènes (recettes), les dialogues (commentaires) et les applaudissements (ratings) sont tous en place pour que la pièce puisse être répétée (testée) sans attendre.

## 6. PIÈGES CLASSIQUES

### Piège #1 : Insérer dans le mauvais ordre (violation FK)

```sql
-- MAUVAIS — recipe 1 n'existe pas encore
INSERT INTO comments (recipe_id, content) VALUES (1, 'Super !');
INSERT INTO recipes ...;
```

```sql
-- BON — respecter l'ordre des dépendances
INSERT INTO recipes ...;
INSERT INTO comments (recipe_id, content) VALUES (1, 'Super !');
```

### Piège #2 : Oublier les guillemets JSON

```sql
-- MAUVAIS — MariaDB voit un tableau SQL, pas du JSON
INSERT INTO recipes (ingredients) VALUES (["farine", "oeufs"]);
-- MariaDB interprète ["farine"] comme du SQL array, pas du JSON
```

```sql
-- BON — chaîne JSON valide
INSERT INTO recipes (ingredients) VALUES ('["farine", "oeufs"]');
```

### Piège #3 : Utiliser DELETE au lieu de TRUNCATE pour reset

Le seed est conçu pour être exécuté UNE FOIS. Si on veut reset, il faut TRUNCATE les tables dans le bon ordre (comments → ratings → recipes → users → categories) ou désactiver les FK checks. Le script assume que les tables sont vides au moment de l'exécution.

### Piège #4 : Même hash pour plusieurs users

C'est OK ici car en production chaque user a son propre hash. En seed, partager le mot de passe `User1234!` simplifie les tests manuels. Le hash étant identique pour les mêmes mots de passe, c'est cohérent.

## 7. ET SI ON FAISAIT AUTREMENT ?

### Option A : Seed via un script Node.js (au lieu de SQL pur)

Un script JS permettrait d'utiliser bcrypt directement pour générer les hashs, et de randomiser certaines données (commentaires, notes). Mais ça nécessite que Node.js soit installé et configuré — le SQL pur s'exécute avec juste le client mysql, plus portable.

### Option B : ORM avec seeders (Sequelize, Knex)

Les ORMs ont des systèmes de seed intégrés (ex: `knex seed:run`). Le projet n'utilise pas d'ORM (choix délibéré), donc le SQL pur est la solution la plus cohérente.

### Option C : Données générées aléatoirement (Faker)

Utiliser `faker.js` pour générer 100 recettes aléatoires avec des noms, anecdotes, ingrédients. Plus réaliste pour le volume MAIS moins prévisible pour les tests. Les IDs spécifiques et les moyennes exactes sont nécessaires pour les tests Jest.

## 8. CHECKLIST POUR LE JURY

- [ ] 5 users seedés dont 1 admin avec le bon rôle.
- [ ] 4 catégories : Rapide, Petit budget, Élaborée, Autre.
- [ ] 8 recettes couvrant tous les cas de filtrage (temps, budget, statut).
- [ ] 30 commentaires mélangeant utilisateurs connectés et invités (user_id NULL/guest_name).
- [ ] 29 notations avec distribution variée (5, 4, 3, 2 — pas de 1).
- [ ] `average_rating` et `rating_count` sont pré-calculés et corrects.
- [ ] Les hashs bcrypt sont pré-générés (cost 12, prêts pour la prod).
- [ ] Les colonnes JSON (ingredients, steps) sont des chaînes JSON valides.
- [ ] Le script est exécutable sur les DEUX bases (dev + test) avec la même commande.
- [ ] Aucune instruction `USE` dans le script (la base est passée en argument).
