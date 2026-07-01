# Soft Delete

## Contexte

Quand on supprime une recette, un commentaire ou un utilisateur, la donnée ne doit pas être perdue définitivement — besoin de traçabilité et de réversibilité.

---

## Pourquoi `deleted_at` plutôt que `DELETE` ?

### Ce qui est fait

```sql
-- Au lieu de :
DELETE FROM recipes WHERE id = ?

-- On fait :
UPDATE recipes SET deleted_at = NOW() WHERE id = ?
```

Toutes les requêtes de sélection excluent les lignes supprimées :

```sql
WHERE deleted_at IS NULL
```

### Options écartées

| Option | Problème |
|---|---|
| `DELETE` physique | Impossible de restaurer, pas de traçabilité |
| Colonne `is_deleted` booléenne | On perd la date de suppression. Impossible de dire "combien de temps après création la recette a été supprimée" |
| Table `deleted_recipes` miroir | Duplication du schéma, complexité en lecture |

### Ce que `deleted_at` permet qu'un booléen ne permet pas

- **Date précise** : savoir quand la suppression a eu lieu
- **Audit** : "cette recette a été supprimée il y a 3 mois"
- **Purger les vieilles suppressions** : `WHERE deleted_at < NOW() - INTERVAL 1 YEAR`
- **Restaurer** : `UPDATE recipes SET deleted_at = NULL WHERE id = ?`

**Risque de l'inverse (`is_deleted` booléen) :** on sait qu'une recette est supprimée, mais pas quand. Impossible de faire un script de purge automatique sans colonne date.

### Contrainte UNIQUE avec soft delete

Attention : `UNIQUE KEY uq_recipe_title (title)` échoue si deux recettes supprimées ont le même titre. Solution : inclure `deleted_at` dans l'UNIQUE ou accepter que les titres ne soient pas globalement uniques.

### En version 2

- Ajouter `deleted_by` (user_id de la personne qui a supprimé)
- Corbeille : interface admin pour restaurer
- Script de purge automatique : `DELETE FROM recipes WHERE deleted_at < NOW() - INTERVAL 30 DAYS`
