# Décisions MVP — OVNI Culinaire

> Référencé depuis `AGENTS.md`. À respecter avant toute action.

## Gamification
Retirée du MVP. Champ `points` conservé dans users. Tables badges et user_badges documentées mais pas créées en BDD.

## Export CSV
Conservé dans le MVP. Endpoint fonctionnel avec middleware auth + admin. Déclenché via bouton dans le panneau de modération (`/admin/export/recipes`).

## `ingredient_count`
**SUPPRIMÉ DÉFINITIVEMENT**. Ne pas mentionner ni réintroduire sous aucune forme.

## Collection Postman, schema.org, styleguide.html
Retirés du MVP.

## admin_logs
Conservé.

## user_notifications
Conservé.

## Sécurité
Helmet + rate limiting + JWT + requêtes paramétrées (obligatoire).

## Soft delete
`deleted_at` sur toutes les tables concernées.

---

## Fonctionnalités repoussées en V2

Ces fonctionnalités sont **identifiées, codées partiellement (back-end prêt), mais pas exposées dans l'UI du MVP** par choix de périmètre :

| Fonctionnalité | Code back | Justification |
|----------------|-----------|---------------|
| Modification d'une recette par l'auteur | Route + contrôleur prêts | Pas d'UI "éditer" dans le MVP. Gestion de contenu utile mais pas bloquante pour la présentation. |
| Suppression d'une recette par l'auteur | Route + contrôleur prêts | Idem. Pas de bouton supprimer dans le dashboard utilisateur. |
| Suppression d'un commentaire | Route + contrôleur prêts | Modération manuelle considérée suffisante pour le MVP. |
| Modification du profil utilisateur | Méthodes `User.update()` et `User.updatePassword()` prêtes | Pas de page "paramètres du compte". L'authentification de base suffit. |
| Gestion des catégories | Modèle `Category` complet (CRUD) | Pas de page d'administration des catégories. Les recettes sont filtrées par personnage, pas par catégorie. |
| Consultation des notes d'une recette | Méthode `Rating.findByRecipeId()` prête | La note moyenne affichée suffit dans le MVP. Le détail des notes individuelles est un enrichissement. |
| Stats administrateur avancées | Endpoints `/admin/stats` et `/admin/recipes/top` | Les données essentielles sont dans le dashboard unique `/admin/dashboard`. |
| Vérification explicite du token | Fonction `fetchCurrentUser()` dans `auth.js` | Le token est vérifié à chaque appel API (middleware `authenticate`). Une vérification dédiée serait redondante. |
| Rafraîchissement automatique du token | Non implémenté | Pas de mécanisme de refresh token. Le JWT a une durée de vie de 24h, suffisante pour une session utilisateur standard. |
