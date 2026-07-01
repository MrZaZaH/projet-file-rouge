# 10 — Moyenne Dénormalisée (average_rating)

## 1. CE QUE ÇA FAIT (vue d'ensemble)

Plutôt que de calculer la moyenne des notes à chaque affichage avec `AVG()` et une jointure sur la table `ratings`, on stocke `average_rating` et `rating_count` directement sur la table `recipes`. À chaque nouvelle note, on met à jour ces deux colonnes avec une formule atomique en SQL. C'est ce qu'on appelle une **dénormalisation** : on accepte de la redondance de données en échange de performances, parce qu'on lit beaucoup plus souvent les recettes (afficher une liste) qu'on ne les note.

## 2. SCHÉMA DE LA TABLE

```sql
-- Colonnes dénormalisées sur la table recipes
average_rating      DECIMAL(3,2) UNSIGNED NOT NULL DEFAULT 0.00,
rating_count        SMALLINT UNSIGNED NOT NULL DEFAULT 0,
```

(Source: `database/scripts/03_create_tables.sql:72-76`)

- `DECIMAL(3,2)` = 3 chiffres au total, 2 après la virgule → valeurs possibles : 0.00 à 9.99 (le CHECK 1-5 des ratings garantit qu'on ne dépasse pas 5.00)
- `SMALLINT UNSIGNED` = 0 à 65535 — largement suffisant pour le nombre de votes par recette

## 3. LE CODE

### 3.1 — Recipe.updateRating() (`src/models/Recipe.js:786`)

```javascript
static async updateRating(id, newScore) {
    // Cette méthode est appelée PAR Rating.rate() APRÈS un INSERT réussi
    // Formule de mise à jour atomique :
    //   nouvelle_moyenne = (ancienne_moyenne * ancien_nombre + nouveau_score)
    //                       / (ancien_nombre + 1)
    //
    // Exemple : une recette avait 4.00 avec 5 votes, on ajoute un score de 5
    //   new_average = (4.00 * 5 + 5) / (5 + 1) = (20 + 5) / 6 = 25 / 6 = 4.1667
    //   → ROUND(..., 2) donne 4.17
    //
    // ROUND(..., 2) arrondit à 2 décimales pour éviter les flottards interminables

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

    // Retourne true si la recette a été trouvée et mise à jour
    return result.affectedRows > 0;
}
```

### 3.2 — Appel depuis Rating.rate() (`src/models/Rating.js:104`)

```javascript
// Dans le path INSERT (première note)
await pool.execute(
    `INSERT INTO ratings (recipe_id, user_id, score)
     VALUES (?, ?, ?)`,
    [recipeId, userId, score]
);

// Après INSERT → mise à jour de la moyenne dénormalisée
await Recipe.updateRating(recipeId, score);

// Note : updateRating() n'est PAS appelé sur les UPDATE de note
// La moyenne dérive légèrement — c'est un compromis MVP accepté
```

### 3.3 — Lecture de la moyenne (dans findById et findAllWithFilters)

```javascript
// Dans le mapping des résultats (findById:353, findAllWithFilters:585)
const averageRating = parseFloat(row.average_rating);
// Les colonnes DECIMAL sont retournées par mysql2 comme des strings
// parseFloat() les convertit en nombre JS pour l'API JSON

// Dans l'objet retourné :
return {
    // ...
    average_rating: averageRating,
    rating_count: row.rating_count,
    // ...
};
```

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

```
1. Un utilisateur note une recette 4/5
2. INSERT INTO ratings (recipe_id, user_id, score) VALUES (42, 7, 4)
3. Recipe.updateRating(42, 4) exécute :
   UPDATE recipes SET
     average_rating = ROUND((average_rating * rating_count + 4) / (rating_count + 1), 2),
     rating_count = rating_count + 1
   WHERE id = 42

   Si average_rating = 3.50, rating_count = 3 :
   new_average = ROUND((3.50 * 3 + 4) / (3 + 1), 2)
              = ROUND((10.50 + 4) / 4, 2)
              = ROUND(14.50 / 4, 2)
              = ROUND(3.625, 2)
              = 3.63
   rating_count = 3 + 1 = 4

4. La prochaine fois qu'on charge la recette :
   SELECT average_rating, rating_count FROM recipes WHERE id = 42
   → average_rating = 3.63, rating_count = 4
   → Pas de jointure, pas de AVG(), pas de calcul — la valeur est déjà prête
```

## 5. ANALOGIE

C'est comme un **tableau de scores dans un tournoi de cuisine** où tu tiens le score à la craie sur un tableau à côté de chaque plat. Quand un nouveau juge donne une note, tu recalcules la moyenne directement sur le tableau — tu n'as pas besoin de refaire tous les calculs depuis le début à chaque fois. Le tableau (la table recipes) a déjà le total à jour, pas besoin d'additionner tous les votes individuels à chaque consultation.

## 6. PIÈGES CLASSIQUES

### Piège #1 : Utiliser FLOAT pour stocker une moyenne

**MAUVAIS** — erreurs d'arrondi :
```sql
average_rating FLOAT NOT NULL DEFAULT 0
-- 0.1 + 0.2 = 0.30000000000000004 en binaire → la moyenne dérive
```

**BON** — DECIMAL pour les valeurs exactes :
```sql
average_rating DECIMAL(3,2) UNSIGNED NOT NULL DEFAULT 0.00
-- 0.1 + 0.2 = 0.30 exactement
```

### Piège #2 : Recalculer depuis zéro à chaque update

**MAUVAIS** — lourd et lent :
```javascript
const [avgResult] = await pool.query(
    'SELECT AVG(score) AS avg FROM ratings WHERE recipe_id = ?', [id]
);
await pool.query(
    'UPDATE recipes SET average_rating = ? WHERE id = ?',
    [avgResult[0].avg, id]
);
// Requiert un scan complet de la table ratings à chaque note
```

**BON** — mise à jour atomique incrémentale :
```javascript
`UPDATE recipes
 SET average_rating = ROUND((average_rating * rating_count + ?) / (rating_count + 1), 2),
     rating_count = rating_count + 1
 WHERE id = ?`
// Pas de SELECT, pas de JOIN, pas de scan
```

## 7. ET SI ON FAISAIT AUTREMENT ?

### Option A : Recalculer avec AVG() à chaque lecture
- **Comment ça marche** : pas de colonne average_rating — on fait `SELECT AVG(score) FROM ratings WHERE recipe_id = ?` à chaque affichage.
- **Avantage** : zero redondance, toujours exact.
- **Inconvénient** : requête supplémentaire + jointure à chaque chargement de page, lent avec beaucoup de votes.
- **Notre cas** : la dénormalisation est justifiée car les lectures (affichages de liste) sont bien plus fréquentes que les écritures (notes).

### Option B : Calcul dans le code applicatif (JavaScript)
- **Comment ça marche** : charger tous les scores, les additionner en JS, diviser.
- **Avantage** : décharge la base.
- **Inconvénient** : doit charger TOUS les scores en mémoire — ridiculement lent.
- **Notre cas** : le SQL atomique est plus efficace (MariaDB fait le calcul directement sur les données).

## 8. CHECKLIST POUR LE JURY

- [ ] `average_rating` et `rating_count` existent sur la table `recipes` (dénormalisation)
- [ ] `average_rating` est `DECIMAL(3,2)` — pas de FLOAT, pas d'erreur d'arrondi
- [ ] `Recipe.updateRating()` utilise une formule atomique en SQL : `(avg * count + newScore) / (count + 1)`
- [ ] `ROUND(..., 2)` évite les décimales interminables
- [ ] `updateRating()` n'est appelé QUE sur les nouveaux INSERT, pas sur les UPDATE
- [ ] À la lecture, `parseFloat()` convertit le DECIMAL string en nombre JS
- [ ] Aucune jointure avec `ratings` n'est faite pour récupérer la moyenne — elle est directement sur `recipes`
