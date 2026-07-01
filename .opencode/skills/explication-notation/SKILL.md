---
name: explication-mecanisme
description: Expliquer en profondeur n'importe quel mécanisme du projet avec du vrai code. Déclenché quand l'utilisateur demande une explication détaillée.
license: MIT
compatibility: opencode
metadata:
  project: ovni-culinaire
  trigger: explique, détaille, comment ça marche, mécanisme, c'est quoi, à quoi sert, comment fonctionne
---

## What I do

Je transforme l'agent en professeur particulier qui explique les mécanismes du projet OVNI Culinaire en profondeur, avec du vrai code, des analogies concrètes, et une pédagogie adaptée à un niveau Bac+2 (novice).

Quand l'utilisateur demande une explication (ex: "explique la notation", "comment marche le soft delete", "c'est quoi le JWT"), je :
1. Détecte le mécanisme demandé en cherchant des mots-clés dans sa phrase
2. Vérifie si une fiche pré-écrite existe dans `docs/backend/mecanismes/`
   - Si oui → la lire et l'afficher
   - Si non → chercher les fichiers sources pertinents et générer l'explication à la volée
3. Adapte le niveau de détail demandé (jury/révision/simple)

## Liste des mécanismes disponibles

Les fiches pré-écrites sont dans `docs/backend/mecanismes/` :
- 01-authentification-jwt.md
- 02-securite-http.md
- 03-logging-winston.md
- 04-gestion-erreurs.md
- 05-reponses-api.md
- 06-connexion-db.md
- 07-crud-recettes.md
- 08-recette-aleatoire.md
- 09-systeme-notation.md
- 10-moyenne-denormalisee.md
- 11-gamification-points.md
- 12-commentaires.md
- 13-favoris.md
- 14-dashboard-utilisateur.md
- 15-administration-moderation.md
- 16-export-csv.md
- 17-soft-delete.md
- 18-colonnes-json.md
- 19-pagination-tri.md
- 20-filtres-personnages.md
- 21-validation-express-validator.md
- 22-middleware-chain.md
- 23-compteur-vues.md
- 24-tests-automatises.md
- 25-seed-donnees.md
- 26-utilisateurs-bdd.md
- 27-health-check.md
- 28-auth-frontend.md
- 29-api-request-generique.md
- 30-formulaire-soumission-recette.md
- 31-panneau-moderation-admin.md
- 32-page-detail-recette.md
- 33-dashboard-favoris-frontend.md
- 34-ui-ux-modale-menu.md
- 35-propagation-moyenne.md
- 36-race-conditions.md
- 37-notifications-utilisateur.md
- 38-admin-logs.md
- 39-arret-gracieux.md
- 40-separation-app-server.md
- 41-fichiers-legacy.md
- 42-generation-slug.md
- 43-schema-db-complet.md
- 44-validation-frontend.md
- 45-bouton-surprends-moi.md

## Détection du mécanisme

L'agent doit associer les mots-clés de l'utilisateur aux numéros de mécanisme :
- "jwt", "auth", "authentification", "token", "login", "register", "connexion" → #1
- "sécurité", "helmet", "cors", "rate limit", "rate limiting" → #2
- "log", "logging", "winston", "logger" → #3
- "erreur", "error handler", "gestion d'erreur" → #4
- "api response", "réponse api", "sendSuccess", "sendError" → #5
- "connexion db", "base de données", "pool", "connection", "mariadb" → #6
- etc. (extensible)

Si le mécanisme n'est pas clair, demander à l'utilisateur de préciser.

## Format d'explication

L'explication doit toujours suivre cet ordre (que ce soit une fiche pré-écrite ou générée à la volée) :

1. CE QUE ÇA FAIT (vue d'ensemble)
2. SCHÉMA DE LA TABLE (ou "Pas de table")
3. LE CODE (avec références fichier:ligne)
4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE (schéma texte)
5. ANALOGIE (concrète, vie réelle)
6. PIÈGES CLASSIQUES (mauvais code vs bon code)
7. ET SI ON FAISAIT AUTREMENT ? (alternatives)
8. CHECKLIST POUR LE JURY

## Règles pédagogiques

- Niveau novice Bac+2 : concepts simples, lisibles, pédagogiques
- Pas de patterns avancés ou d'abstractions superflues
- Analogies concrètes pour les concepts abstraits
- Expliquer les conséquences des choix (ce qui arrive si on fait autrement)
- Signaler les pièges classiques avant qu'ils n'arrivent
- Utiliser le vrai code du projet, pas des exemples inventés
- Toujours référencer les fichiers et lignes (chemin:ligne)
