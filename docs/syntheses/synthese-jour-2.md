__Synthèse – Conception du schéma de base de données (MCD → MPD)__

__Ce qu'on a fait__

- Analysé les User Stories pour identifier les entités nécessaires au MVP.
- Conçu le MCD avec les relations (1:N, N:N) entre toutes les entités.
- Produit le MPD avec conventions strictes (snake_case, clés étrangères explicites, champs d'audit).
- Rédigé DATABASE_DESIGN.md en anglais avec les choix techniques et mesures de sécurité.

__Problèmes rencontrés__

__Auth_logs__

- __Contexte__ : Table proposée pour tracer les connexions/déconnexions.
- __Options__ : La garder MVP / la reporter.
- __Décision__ : Reportée en post-MVP. Trop de travail pour la valeur apportée maintenant.

__Gamification (badges/points)__

- __Contexte__ : Central dans le brief, mais lourd à implémenter proprement.
- __Options__ : Implémenter complet / garder trace minimale / supprimer.
- __Décision__ : Champ points INT UNSIGNED DEFAULT 0 conservé dans users. Tables badges et user_badges documentées dans DATABASE_DESIGN.md (section "Planned – not implemented in MVP") mais __non créées__.

__target_type / target_id dans admin_logs__

- __Contexte__ : Permettre de loguer n'importe quel type d'action admin (sur recette, user, commentaire...).
- __Options__ : Une colonne par type de cible / système polymorphique.
- __Décision__ : Système polymorphique retenu — plus flexible, une seule table de logs.

__Cardinalité User → Comments__

- __Contexte__ : Confusion sur la direction de la flèche (0 ou 1 du côté user ?).
- __Décision__ : Un user peut avoir 0 commentaire (0,N). Un commentaire appartient à 1 user ou à un pseudo anonyme.

__Décisions techniques prises__

- snake_case partout, sans exception.
- deleted_at sur toutes les tables concernées (soft delete).
- points INT UNSIGNED DEFAULT 0 dans users — migration future évitée.
- admin_logs conservé dans le MVP.
- Zéro concaténation SQL autorisée — requêtes paramétrées obligatoires partout.
- Comments accessibles sans compte (pseudo obligatoire, pas d'user_id requis).

__Ce qui a été écarté__

- __ingredient_count__ : Supprimé définitivement. Champ, filtres, API, tests, documentation. Ne jamais réintroduire.
- __Tables badges et user_badges__ : Non créées en MVP. Documentées uniquement.
- __auth_logs__ : Non créée en MVP. Reportée post-MVP.
- __Export CSV__ : Hors MVP.
- __Collection Postman__ : Hors MVP.
- __schema.org__ : Hors MVP.
- __styleguide.html__ : Hors MVP.
- __RNCP_SELF_ASSESSMENT.md__ : En dernier, si temps disponible.

