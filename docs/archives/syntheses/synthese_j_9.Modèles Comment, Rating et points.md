# Synthèse Jour 9 — Modèles Comment, Rating et points

__Synthèse – Jour 9 : Modèles Comment, Rating et points__

__Ce qu'on a fait__

- Créé src/models/Comment.js : création (user connecté \+ invité), lecture par recette, soft delete.
- Créé src/models/Rating.js : vote, mise à jour, calcul de note moyenne, attribution de points (\+5 à l'auteur si score ≥ 4, uniquement sur un nouveau vote).
- Modifié src/models/User.js : ajout findById pour lire les points.
- Créé test-scripts/test-comment-rating.js : 24 assertions, idempotent (teardown automatique).
- Créé test-scripts/test-full-chain.js : 12 assertions couvrant la chaîne complète recipe → comment → rating → points, idempotent (testé plusieurs runs).
- Mis à jour TEST_CASES.md : TC-28 à TC-36 documentés.
- Mis à jour BONNES_PRATIQUES.md : injections SQL, pool de connexions, triggers vs logique applicative, soft delete, idempotence, dotenv, commits conventionnels.

__Problèmes rencontrés__

__Pollution de la base par les runs successifs__

- __Contexte__ : Les premiers runs inséraient des votes sans nettoyer. Au deuxième run, l'état attendu n'existait plus.
- __Options envisagées__ : Reset manuel avant chaque run / teardown automatique dans le test.
- __Décision__ : Teardown dans .finally() — s'exécute même si le test crashe en plein milieu.

__dotenv non chargé dans les scripts standalone__

- __Contexte__ : test-full-chain.js lancé directement avec node — app.js n'est jamais exécuté, donc process.env était vide.
- __Options envisagées__ : Passer les variables en CLI / ajouter require('dotenv').config() dans le script.
- __Décision__ : require('dotenv').config() en première ligne de tout script standalone. Documenté dans VEILLE.md.

__Décisions techniques prises__

- Les tests d'intégration doivent être idempotents : teardown systématique.
- Points attribués uniquement sur nouveau vote (pas sur mise à jour) — décision métier définitive.
- User.findById expose les points : nécessaire pour les assertions, utilisable par la suite pour le dashboard.
- require('dotenv').config() obligatoire en première ligne de tout script lancé directement avec node.

__Ce qui a été écarté__

- __Triggers SQL__ pour le calcul de note moyenne → logique applicative retenue (plus lisible, plus testable, plus facile à déboguer).
- __Tables badges/user_badges__ → documentées dans DATABASE_DESIGN.md, non créées (décision MVP existante).

