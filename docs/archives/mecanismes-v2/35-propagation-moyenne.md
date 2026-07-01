# 35 — Propagation de la Moyenne Dénormalisée

## 1. CE QUE ÇA FAIT (vue d'ensemble)

Quand un utilisateur note une recette pour la première fois, le champ `average_rating` de la table `recipes` est recalculé automatiquement. Pas besoin de faire un `AVG()` avec JOIN à chaque affichage — la moyenne est stockée directement sur la ligne de la recette.

Le recalcule se fait en SQL pur, en une seule requête atomique.

## 2. SCHÉMA DE LA TABLE

```sql
-- Colonnes concernées dans recipes :
average_rating  DECIMAL(3,2) UNSIGNED NOT NULL DEFAULT 0.00,
rating_count    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
```

`average_rating` est un champ dénormalisé : il répète une information qui pourrait être calculée à partir de la table `ratings`. C'est un choix volontaire pour éviter un `AVG(score) GROUP BY recipe_id` à chaque chargement de page.

## 3. LE CODE

### 3.1 — Recipe.js (`src/models/Recipe.js:786-798`)

```javascript
static async updateRating(id, newScore) {
    const [result] = await pool.execute(
        `UPDATE recipes
         SET average_rating = ROUND(
                 (average_rating * rating_count + ?) / (rating_count + 1),
             2),
             rating_count   = rating_count + 1
         WHERE id = ?
           AND deleted_at IS NULL`,
        [newScore, id]
    );
    return result.affectedRows > 0;
}
```

### 3.2 — Rating.js (`src/models/Rating.js:103-104`)

```javascript
// Update the denormalized average on the recipe.
await Recipe.updateRating(recipeId, score);
```

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

1. `Rating.rate()` fait un `INSERT INTO ratings` avec la nouvelle note.
2. Juste après l'INSERT, il appelle `Recipe.updateRating(recipeId, score)`.
3. `updateRating()` exécute une UPDATE SQL qui :
   - Prend l'ancienne moyenne (`average_rating`) multipliée par l'ancien compteur (`rating_count`).
   - Ajoute la nouvelle note (`newScore`).
   - Divise par le nouveau compteur (`rating_count + 1`).
   - Arrondit à 2 décimales avec `ROUND(..., 2)`.
   - Incrémente `rating_count` de 1.
4. Tout ça se fait dans la **même requête SQL** — pas de lecture puis écriture en JavaScript.

## 5. ANALOGIE

Imagine un carnet de notes. Chaque fois qu'un élève rend une copie, tu ne veux pas recalculer la moyenne de toute la classe depuis zéro. Tu prends la moyenne actuelle, tu multiplies par le nombre de copies, tu ajoutes la nouvelle note, tu redivises. C'est exactement ce que fait cette requête SQL.

## 6. PIÈGES CLASSIQUES

### Piège #1 : Recalcul en JavaScript au lieu de SQL

Si tu fais `SELECT average_rating, rating_count` → calcul en JS → `UPDATE recipes SET average_rating = ?`, deux requêtes simultanées peuvent lire la même ancienne valeur. La dernière écriture écrase la première. En SQL atomique, les deux UPDATE s'exécutent séquentiellement.

### Piège #2 : Pas de recalcul sur UPDATE de note

Si un utilisateur **modifie** sa note (UPDATE au lieu d'INSERT), `updateRating()` n'est PAS appelé. La moyenne dérive légèrement. C'est un choix assumé pour le MVP — un vrai recalcule nécessiterait une formule qui soustrait l'ancienne note avant d'ajouter la nouvelle.

### Piège #3 : Oublier `ROUND()`

Sans `ROUND(..., 2)`, le `DECIMAL(3,2)` va tronquer ou arrondir automatiquement selon le moteur SQL, ce qui peut donner des résultats inattendus. L'arrondi explicite garantit la cohérence.

## 7. ET SI ON FAISAIT AUTREMENT ?

**Option A** : Calculer `AVG(score)` à la volée dans chaque requête. Pas de colonnes dénormalisées. Plus simple à maintenir, mais plus lent sur les listes de recettes (JOIN + GROUP BY + AVG).

**Option B** : Utiliser un TRIGGER MariaDB qui recalcule automatiquement la moyenne à chaque INSERT/UPDATE/DELETE sur `ratings`. Fonctionne au niveau base de données, pas besoin de code applicatif. Mais les triggers sont difficiles à debugger et à versionner.

**Option C** : Recalcul complet à chaque UPDATE de note (soustraire l'ancienne, ajouter la nouvelle). C'est ce qu'il faudrait faire en prod, mais c'est plus de code pour un cas rare.

## 8. CHECKLIST POUR LE JURY

- [ ] `updateRating()` est appelé juste après l'INSERT dans `Rating.rate()`
- [ ] La formule mathématique est correcte : `(avg * count + newScore) / (count + 1)`
- [ ] `ROUND(..., 2)` garantit la précision du `DECIMAL(3,2)`
- [ ] `rating_count` est incrémenté en même temps que le recalcule
- [ ] Tout se fait dans une seule requête SQL atomique
- [ ] `updateRating()` n'est PAS appelé sur UPDATE de note (limite MVP documentée)
- [ ] La clause `WHERE deleted_at IS NULL` empêche de toucher une recette supprimée
