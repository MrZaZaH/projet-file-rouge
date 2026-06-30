# Favoris

## Contexte

Un utilisateur connecté peut marquer une recette comme favorite et retrouver ses favoris sur une page dédiée.

---

## Pourquoi une table de liaison séparée ?

### Ce qui est fait

Table `favorites` avec `user_id` et `recipe_id` — relation many-to-many.

### Option écartée : colonne `is_favorited` dans `recipes`

Une colonne booléenne ne permet pas de savoir QUI a mis en favori. Un seul utilisateur pourrait "posséder" le favori. Avec une table dédiée :

```sql
-- Combien de fois cette recette a été mise en favori ?
SELECT COUNT(*) FROM favorites WHERE recipe_id = ?

-- Tous les favoris de l'utilisateur 42
SELECT r.* FROM recipes r
JOIN favorites f ON r.id = f.recipe_id
WHERE f.user_id = 42 AND r.deleted_at IS NULL
```

**Risque de l'inverse (colonne `is_favorited`) :** impossible de gérer plusieurs utilisateurs. On devrait stocker un tableau d'user_ids dans une colonne JSON — cauchemar en requêtes, pas de contrainte d'intégrité.

### Ce que la table `favorites` permet de faire

- Vérifier si une recette est déjà favorite (`Favorite.isFavorited(userId, recipeId)` dans `src/controllers/RecipeController.js:87-88`)
- Lister tous les favoris d'un utilisateur (page dédiée)
- Compter les favoris (futur : "X personnes ont mis en favori")
- Contrainte UNIQUE `(user_id, recipe_id)` : pas de doublon (like les ratings)

### En version 2

- Ajouter un compteur dénormalisé `favorite_count` sur `recipes` (like `rating_count`)
- Notifications : "Votre recette a été ajoutée aux favoris de X"
- Collections de favoris (catégoriser ses favoris)
