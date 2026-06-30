# Surprends-moi (recette aléatoire)

## Contexte

Bouton "Surprends-moi" sur la homepage — tire une recette au hasard parmi les publiées.

---

## Pourquoi `ORDER BY RAND() LIMIT 1` ?

### Ce qui est fait

```sql
SELECT * FROM recipes
WHERE status = 'published' AND deleted_at IS NULL
ORDER BY RAND()
LIMIT 1
```

C'est la solution la plus simple à implémenter et à comprendre. Elle fonctionne sans état, sans cache, sans logique spécifique.

### Alternatives écartées

| Alternative | Problème |
|---|---|
| `RAND() * (SELECT MAX(id))` | Produit des trous si des recettes sont supprimées (soft delete=False, mais id gaps existent) |
| Compter le nombre total + choisir un offset au hasard | Deux requêtes au lieu d'une, race condition si une recette est ajoutée entre-temps |
| Cache prédéfini (ex: top 10 random refresh par heure) | Complexité inutile pour un MVP — on n'a pas des millions de recettes |

**Risque de l'inverse (`MAX(id)` + random) :** si les IDs sont 1, 5, 10 (trous après soft delete), on tombe sur des IDs inexistants ~30% du temps. Il faut boucler jusqu'à trouver une recette valide.

### Problème : performance sur gros volume

`ORDER BY RAND()` est notoirement lent sur les grandes tables. MySQL doit assigner un nombre aléatoire à chaque ligne, puis trier le tout.

**Pour l'instant c'est acceptable :** le projet est un MVP, on a des dizaines voire centaines de recettes, pas des millions. Le temps d'exécution reste sous les 10ms.

### En version 2

- Technique du "random via id gaps" : `WHERE id >= FLOOR(RAND() * (SELECT MAX(id) FROM recipes)) ORDER BY id LIMIT 1` — une seule requête, pas de tri coûteux
- Si pas de résultat (trou après le random), fallback : `ORDER BY RAND() LIMIT 1`
- Mettre en cache un lot de 10 IDs aléatoires, renouvelé toutes les heures

---

## Pourquoi ce nom de route ?

### Ce qui est fait

`GET /api/v1/recipes/random` dans `src/controllers/RecipeController.js:55-68`

**Pourquoi pas `/api/v1/recipes/random` plutôt que `/api/v1/surprise-me` ?** Cohérence REST : toutes les ressources sont sous `/api/v1/recipes/`. Un endpoint `random` est un cas particulier de récupération de recette, pas une ressource à part.

### En version 2

- Ajouter des critères au random : `?category_id=3` → recette aléatoire dans une catégorie
- Exclure les recettes déjà vues par l'utilisateur (tracking en localStorage)
