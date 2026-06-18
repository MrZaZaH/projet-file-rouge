# Décisions MVP — OVNI Culinaire

> Référencé depuis `AGENTS.md`. À respecter avant toute action.

## Gamification
Retirée du MVP. Champ `points` conservé dans users. Tables badges et user_badges documentées mais pas créées en BDD.

## Export CSV
Retiré du MVP. Le contrôleur existe mais pas de route exposée.

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
