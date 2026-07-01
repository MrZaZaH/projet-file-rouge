# Colonnes JSON (ingredients, steps)

## Contexte

Une recette a une liste d'ingrédients et des étapes de préparation. Ce sont des données structurées mais qui n'ont pas de vie propre (pas de CRUD individuel).

---

## Pourquoi du JSON et pas des tables séparées ?

### Options écartées

| Option | Problème |
|---|---|
| Table `ingredients` avec FK `recipe_id` | Un ingrédient n'existe pas en dehors de sa recette. Pas de réutilisation. Nécessite JOIN + transaction pour écrire. |
| Texte brut (une string avec des retours à la ligne) | Pas de structure exploitable. Impossible de compter le nombre d'ingrédients ou d'afficher joliment. |
| Colonne JSON | Une seule colonne, un seul read/write, pas de JOIN. |

**Risque de l'inverse (table `ingredients`) :** pour afficher une recette, il faut :
1. `SELECT * FROM recipes WHERE id = ?`
2. `SELECT * FROM ingredients WHERE recipe_id = ? ORDER BY position`
3. Bonus : `SELECT * FROM steps WHERE recipe_id = ? ORDER BY position`

Soit 3 requêtes au lieu d'une. Avec JSON : tout est dans la même colonne, parsé en JS.

### Ce qui est fait

```sql
CREATE TABLE recipes (
    ...
    ingredients JSON,  -- ["200g farine", "3 oeufs", ...]
    steps JSON         -- ["Préchauffer le four", "Mélanger les oeufs", ...]
);
```

### Normalisation à l'écriture

`src/models/Recipe.js` — le modèle accepte string OU array en entrée :

```javascript
// string "a,b,c" → normalisé en ["a","b","c"]
// string "1.\n2." → normalisé en ["1.","2."]  
// array ["a","b"] → gardé tel quel
```

**Pourquoi ?** Le formulaire HTML envoie des strings. Les tests envoient des arrays. Le modèle s'adapte aux deux sans que l'appelant ait à se soucier du format.

### En version 2

- Valider la structure du JSON avec JSON Schema (ex: ingredients doit être un array de strings, chaque string ≤ 200 chars)
- Extraire des métadonnées : nombre d'ingrédients, nombre d'étapes (pour l'affichage dans les cartes)
- Si le nombre d'ingrédients devient critique, migrer vers une table normalisée (mais on n'y est pas)
