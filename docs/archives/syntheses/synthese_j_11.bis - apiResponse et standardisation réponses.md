# Synthèse Jour 11 bis

__Documentation Jour 11 bis__

__Modifications apportées__

__1. src/utils/apiResponse.js — créé__

__Apport__ Avant : chaque contrôleur renvoyait son propre format. Le frontend aurait dû gérer \{ data \}, \{ message \}, 204 vide, selon l'endpoint.

Après : un contrat unique. Toute réponse de l'API a la même forme. Le frontend écrit un handler générique, une seule fois.

\{ success: true,  data: \[...\], message: null \}

\{ success: false, data: null,  message: "...", errors: \[...\] \}

Les 4 contrôleurs mis à jour : RecipeController, AuthController, CommentController, RatingController.

__2. express-rate-limit dans security.js__

__Apport__ Sans ça, /api/v1/auth/login acceptait un nombre illimité de tentatives. N'importe quel script pouvait tester des milliers de mots de passe par minute.

Deux limiteurs distincts :

- globalLimiter : 100 req / 15 min / IP sur toutes les routes
- authLimiter : 10 req / 15 min / IP sur /api/v1/auth uniquement

Au-delà : réponse 429 Too Many Requests au format apiResponse standard.

__3. database/scripts/05_add_image_url.sql__

__Apport__ La colonne était absente. Le frontend Jour 21 aurait été bloqué sur les cartes recettes — aucune image possible.

Colonne ajoutée : VARCHAR(500) NULL DEFAULT NULL sur les deux bases (recettes_humaines et recettes_humaines_test).

Nullable par choix : les recettes existantes et les nouvelles soumissions sans image restent valides. Le frontend gère une image par défaut si null.

Validation ajoutée dans recipeRoutes.js : champ optionnel, HTTPS obligatoire, 500 caractères max.

__Synthèse__

__Ce qu'on a fait__

Jours 1 à 11 : backend complet.

- BDD MariaDB avec 6 tables, soft delete, status, relations propres
- Stack Express opérationnel : modèles, contrôleurs, routes, middlewares
- Authentification JWT \+ bcrypt
- Helmet \+ CORS configurés
- Validation express-validator sur toutes les routes
- Scripts de test manuels couvrant les scénarios principaux
- Documentation : API.md, DATABASE_DESIGN.md, TEST_CASES.md

Jour 11 bis : consolidation architecture.

- Contrat de réponse API standardisé
- Protection brute force sur les routes d'authentification
- Colonne image_url ajoutée avant que le frontend en ait besoin

__Problèmes rencontrés__

__Contexte__ Revue critique post-Jour 11 a révélé des incohérences de format entre contrôleurs et deux manques fonctionnels non couverts par le planning initial.

__Options__

- Continuer sans corriger → frontend cassé dès Jour 25, dette technique certaine
- Réécrire les Jours 7 à 11 → perte de temps, risque de régression
- Jour 11 bis ciblé → correction chirurgicale, planning préservé

__Décision__ Jour 11 bis. Trois points uniquement, deux heures de travail. Le reste de la liste initiale de 7 points était soit déjà présent, soit hors scope, soit prévu au bon endroit dans le planning.

__Décisions techniques prises__

__Décision__

__Raison__

apiResponse.js centralisé

Contrat unique frontend/backend, testabilité

204 remplacé par 200 sur DELETE

Le frontend peut lire le message de confirmation

authLimiter séparé du globalLimiter

Les routes auth méritent une protection plus stricte

image_url nullable

Ne bloque pas les soumissions sans image

HTTPS forcé sur image_url

Pas de contenu mixte HTTP/HTTPS

Pas de système de migrations

Hors stack, scripts numérotés suffisants pour le MVP

__Ce qui a été écarté__

__Élément__

__Raison__

Système de migrations versionnées

Hors stack défini, complexité injustifiée pour 50 recettes

Pagination

Jour 16 logiquement, 50 recettes initiales ne justifient pas maintenant

Tests Jest

Prévu Jour 12, volontairement manuels d'abord

__État du projet__

✅ Jour 1  — Environnement et structure

✅ Jour 2  — Conception BDD

✅ Jour 3  — BDD MariaDB \+ utilisateurs

✅ Jour 4  — Création des tables

✅ Jour 5  — Données de test

✅ Jour 6  — Express \+ connexion MariaDB

✅ Jour 7  — Modèles Category \+ User

✅ Jour 8  — Modèle Recipe

✅ Jour 9  — Modèles Comment \+ Rating

✅ Jour 10 — Contrôleurs \+ routes

✅ Jour 11 — Authentification JWT

✅ Jour 11 bis — Consolidation architecture

🔄 Jour 12 — Tests Jest \+ supertest \+ admin_logs \+ rate limit \+ statuts

__Jour 11 bis – Documentation des modifications__

__Ce qui a été fait__

__1. src/utils/apiResponse.js — créé__

__Apport__ : contrat unique entre le backend et le frontend. Avant, chaque contrôleur répondait dans un format différent. Maintenant tout le monde reçoit \{ success, data, message \}. Le frontend peut écrire un handler générique sans cas particuliers.

__2. Quatre contrôleurs mis à jour \+ errorHandler.js__

__Apport__ : cohérence totale des réponses HTTP. Plus aucun res.json() libre. Les erreurs passent toutes par sendError, les succès par sendSuccess. L'errorHandler utilise maintenant le même format, donc même les erreurs non catchées ont la même structure.

__3. Rate limiting dans security.js \+ app.js__

__Apport__ : deux niveaux de protection.

- globalLimiter : 100 req/15min par IP sur toutes les routes — bloque le scraping et l'abus basique
- authLimiter : 10 req/15min sur /api/v1/auth — bloque le brute force sur le login

Sans ça, un attaquant pouvait tester des milliers de mots de passe par minute. Maintenant il est bloqué après 10 tentatives.

__4. database/scripts/05_add_image_url.sql — exécuté__

__Apport__ : la table recipes a maintenant une colonne image_url VARCHAR(500) NULL. Le frontend peut afficher des images sur les cartes recettes. Sans cette colonne, le Jour 21 était bloqué.

__Sur recettes_humaines_test__ : la base est quasi vide, la commande a échoué parce que la structure n'y est pas. Ce n'est pas un problème — cette base sera reconstruite proprement au Jour 12 avec les scripts dans l'ordre avant les tests Jest. Elle n'est pas utilisée actuellement.

__Synthèse__

__Ce qu'on a fait__

Jour 11 bis de consolidation architecture backend. Trois corrections ciblées sur des lacunes réelles identifiées après revue critique post-Jour 11.

__Problèmes rencontrés__

__recettes_humaines_test vide__

- Contexte : la base existe dans MariaDB mais n'a pas les tables — les scripts 01 à 05 n'ont jamais été exécutés dessus
- Options : reconstruire maintenant, ou attendre Jour 12
- Décision : attendre Jour 12. Les tests Jest nécessitent une base de test propre de toute façon. On l'initialisera avec tous les scripts dans l'ordre à ce moment-là. Ce n'est pas un bloquant aujourd'hui

__Décisions techniques prises__

__Décision__

__Raison__

sendSuccess retourne 200 au lieu de 204 sur delete

Le frontend peut lire le message de confirmation

image_url nullable

Les recettes existantes et les nouvelles soumissions sans image restent valides

Deux niveaux de rate limit

Auth plus strict que le reste — proportionnel au risque

Pas de système de migrations

Hors stack, hors planning — les scripts numérotés remplissent le même rôle

__Ce qui a été écarté__

__Point__

__Raison__

Migrations versionnées

Hors stack défini, complexité non justifiée pour le MVP

Pagination

50 recettes initiales — pas un bloquant, prévu logiquement avant le frontend

Tests Jest

Jour 12 — les tests manuels ont rempli leur rôle pédagogique

__État du projet__

✅ BDD complète (6 tables \+ image_url)

✅ Modèles CRUD sécurisés

✅ Routes \+ contrôleurs \+ validation

✅ Authentification JWT \+ bcrypt

✅ Réponses API standardisées

✅ Sécurité : Helmet \+ CORS \+ Rate limiting

🔄 recettes_humaines_test — à reconstruire Jour 12

❌ Tests Jest/Supertest — Jour 12

❌ AdminController — Jour 13

❌ Frontend — Jour 19\+

__Prochaine étape__ : Jour 12 — Jest, Supertest, reconstruction de la base de test, rapport backend.

