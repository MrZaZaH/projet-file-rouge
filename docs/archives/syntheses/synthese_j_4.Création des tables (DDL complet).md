# Synthèse Jour 4 — Création des tables (DDL complet)

__Synthèse – Jour 4 : Création des tables (DDL complet)__

__Ce qu'on a fait__

- Écrit et exécuté 03_create_tables.sql → 6 tables créées : categories, users, recipes, comments, ratings, admin_logs
- Créé les index sur les colonnes utilisées dans les filtres et jointures
- Complété les tests de permissions du Jour 3 (maintenant que les tables existent)
- Mis à jour DATABASE_DESIGN.md avec les décisions de schéma et la section "Planned – not implemented in MVP"

__Problèmes rencontrés__

__Tests de permissions du Jour 3 impossibles sans tables__

- Contexte : au Jour 3, les tests ont retourné ERROR 1146 Table doesn't exist au lieu de ERROR 1142 Permission denied
- Options envisagées : créer des tables temporaires pour tester / attendre le Jour 4
- Décision retenue : attendre — les tests ont été complétés au Jour 4 après création des vraies tables. Résultat conforme aux attentes.

__Décisions techniques prises__

Copier le tableau

__Décision__

__Justification__

ingredients et steps en colonnes JSON

Pas de table dédiée dans le MVP — aucune US ne nécessite de recherche par ingrédient individuel. Migration possible post-MVP.

average_rating dénormalisé dans recipes

Évite un AVG() en jointure à chaque chargement de liste. Mis à jour à chaque insertion/modification de note.

soft delete sur toutes les tables user-facing

deleted_at IS NULL = actif. Jamais de suppression physique en production.

ON DELETE RESTRICT sur recipes → users

Un utilisateur avec des recettes ne peut pas être supprimé sans traiter ses recettes d'abord. Pas d'orphelins silencieux.

ON DELETE SET NULL sur comments → users

Les commentaires survivent à la suppression d'un compte. Affichés en anonyme ou avec guest_name.

UNIQUE (user_id, recipe_id) sur ratings

Une seule note par utilisateur par recette — enforced au niveau base, pas seulement applicatif.

CHECK (score BETWEEN 1 AND 5) sur ratings

Contrainte au niveau moteur. La validation applicative seule ne suffit pas.

DECIMAL(5,2) pour cost_per_portion

Jamais FLOAT pour des valeurs monétaires — erreurs d'arrondi en virgule flottante.

__Ce qui a été écarté__

- __Table dédiée pour les ingrédients__ : hors scope MVP, aucune US ne le requiert.
- __Tables badges et user_badges__ : exclues du MVP, documentées dans DATABASE_DESIGN.md section "Planned – not implemented in MVP".
- __Index sur toutes les colonnes__ : trop d'index ralentit les INSERT/UPDATE. Seules les colonnes effectivement utilisées en WHERE ou JOIN sont indexées.

