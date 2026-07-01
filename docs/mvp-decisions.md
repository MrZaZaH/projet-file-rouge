# Décisions MVP — OVNI Culinaire

> Référencé depuis `AGENTS.md`. À respecter avant toute action.
> **Statut : MVP terminé** — toutes les fonctionnalités validées ci-dessous sont implémentées et testées.

## IN — Fonctionnalités incluses dans le MVP

| Fonctionnalité | Statut |
|----------------|--------|
| Authentification JWT (register, login, getMe) | ✅ Implémenté |
| CRUD recettes (création, modification, suppression) | ✅ Implémenté (routes protégées par rôle) |
| Filtres par personnages (3 personas) | ✅ Implémenté (home.js) |
| Pagination (12 recettes/page) | ✅ Implémenté |
| Recette aléatoire ("Surprends-moi") | ✅ Implémenté |
| Commentaires (avec ou sans compte) | ✅ Implémenté (guest_name + JWT) |
| Notation (1-5 étoiles, upsert) | ✅ Implémenté |
| Favoris (bookmarks, toggle) | ✅ Implémenté |
| Dashboard utilisateur (stats + mes recettes) | ✅ Implémenté |
| Panneau de modération admin | ✅ Implémenté |
| Export CSV des recettes | ✅ Implémenté |
| Logs d'administration | ✅ Implémenté |
| Notifications utilisateur (rejet/suppression) | ✅ Implémenté |
| Points de gamification (sur note >= 4) | ✅ Implémenté |
| Helmet + rate limiting + JWT + requêtes paramétrées | ✅ Implémenté |
| Soft delete (deleted_at) | ✅ Implémenté |
| SEO technique (meta, Open Graph, lang="fr") | ✅ Implémenté |
| Accessibilité (15 règles RGAA) | ✅ Implémenté |
| Tests automatisés (110 Jest + 20 standalone) | ✅ Implémenté |

## OUT — Retirés du MVP (ne pas réintroduire sans décision)

- **Gamification avancée** (badges, niveaux) — tables `badges`/`user_badges` non créées. Champ `points` conservé.
- **`ingredient_count`** — supprimé définitivement.
- **Collection Postman, schema.org** — retirés.
- **styleguide.html** — conservé comme doc interne, pas comme page publique.

## Fonctionnalités repoussées en V2

| Fonctionnalité | Code back | Justification |
|----------------|-----------|---------------|
| Modification d'une recette par l'auteur | Route + contrôleur prêts | Pas d'UI "éditer" dans le MVP. |
| Suppression d'une recette par l'auteur | Route + contrôleur prêts | Dashboard utilisateur permet la suppression. |
| Suppression d'un commentaire | Route + contrôleur prêts | Modération manuelle suffisante. |
| Modification du profil utilisateur | `User.update()` et `User.updatePassword()` prêtes | Pas de page paramètres. |
| Gestion des catégories | Modèle `Category` complet (CRUD) | Pas de page d'admin catégories. |
| Consultation des notes d'une recette | `Rating.findByRecipeId()` prête | Note moyenne suffit. |
| Vérification explicite du token | `fetchCurrentUser()` dans `auth.js` | Token vérifié à chaque appel API. |
| Rafraîchissement automatique du token | Non implémenté | JWT 24h suffisant pour le MVP. |
