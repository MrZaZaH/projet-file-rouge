# Administration : modération + statistiques

## Contexte

Les recettes soumises par les utilisateurs doivent être modérées avant publication. L'admin doit aussi avoir une vue d'ensemble de l'activité du site.

---

## Pourquoi `authenticate` + `requireAdmin` en chaîne ?

### Ce qui est fait

```javascript
// src/routes/adminRoutes.js
router.put('/recipes/:id/approve', authenticate, requireAdmin, AdminController.approveRecipe);
```

`authenticate` vérifie le token → set `req.user`. `requireAdmin` vérifie `req.user.role === 'admin'`.

Deux middlewares séparés plutôt qu'un seul `requireAdmin` qui ferait les deux. **Raison :** réutilisabilité. `authenticate` sert aussi pour les routes utilisateur standard.

**Risque de l'inverse (un seul middleware admin qui vérifie token + rôle) :** on duplique la logique de vérification de token dans un middleware "admin uniquement". Si le mécanisme JWT change (ex: signature), il faut le modifier à deux endroits.

### En version 2

- Interface admin complète avec CRUD sur tous les modèles (utilisateurs, commentaires, catégories)
- Logs d'activité admin (qui a fait quoi)
- Permissions granulaires (moderator, editor) plutôt que binaire admin/user

---

## Pourquoi une route admin dédiée ?

### Ce qui est fait

Toutes les routes admin sont sous `/api/v1/admin/` (`app.js:67`).

**Pourquoi pas dans les routes normales avec un flag admin ?** Séparation nette : un utilisateur normal ne peut pas ACCIDENTELLEMENT appeler une route admin. L'URL est différente, le middleware est différent, la logique est différente.

### En version 2

- Dashboard admin avec métriques en temps réel
- Graphiques d'évolution (inscriptions, recettes, commentaires par mois)
- Exporter les données en CSV (déjà partiellement implémenté dans `Admin/export/`)

---

## Statistiques du dashboard

### Ce qui est fait

`src/controllers/AdminController.js:37-53` :

```sql
-- Recettes totales publiées
SELECT COUNT(*) FROM recipes WHERE status = 'published' AND deleted_at IS NULL

-- Top 5 mieux notées (minimum 3 ratings)
SELECT r.title, r.average_rating, r.rating_count, u.username as author
FROM recipes r
JOIN users u ON r.user_id = u.id
WHERE r.status = 'published' AND r.deleted_at IS NULL
  AND r.rating_count >= 3
ORDER BY r.average_rating DESC
LIMIT 5
```

**Pourquoi `rating_count >= 3` ?** Une recette avec une seule note 5/5 ne devrait pas être "top". Le minimum 3 votes évite le biais du vote unique (ex: l'auteur qui note sa propre recette avant modération).

### En version 2

- Statistiques par période (7 jours, 30 jours, personnalisé)
- Alerter l'admin si une recette signalée reçoit X commentaires négatifs
- Export PDF des stats (pour le rapport d'activité)
