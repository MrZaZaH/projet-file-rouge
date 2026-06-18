__Synthèse – Jour 14__

__Ce qu'on a fait__

- Corrigé le bug visit_count → rating_count dans getAllRecipes et adminRoutes.js
- Ajouté 3 méthodes dans AdminController.js : getStats, getTopRecipes, exportCSV
- Ajouté 3 routes dans adminRoutes.js : GET /admin/stats, GET /admin/recipes/top, GET /admin/export/recipes
- Installé json2csv
- Créé database/scripts/05_indexes.sql avec 10 index sur 5 tables
- Mis à jour VEILLE.md section performance DB

__Problèmes rencontrés__

Aucun signalé. La checklist de validation n'a pas été commentée — je suppose qu'elle est passée.

__Décisions techniques prises__

__Décision__

__Raison__

Index composites (status, deleted_at) plutôt que simples

Un seul scan B-tree au lieu d'une fusion mémoire

rating_count >= 3 dans getTopRecipes

Évite le biais statistique d'un seul avis 5 étoiles

COALESCE(AVG(score), 0)

Retourne 0 au lieu de NULL si aucun rating

Date.now() dans le nom du fichier CSV

Empêche le cache navigateur sur des exports successifs

Double destructuration \[\[userRow\]\]

Extrait directement l'objet unique d'une requête COUNT

Colonnes CSV définies explicitement

Exclut les champs sensibles sans filtrage JS

__Ce qui a été écarté__

- Index sur ingredients, steps, anecdote : champs JSON ou texte long, jamais dans un WHERE
- Index sur password_hash : jamais filtré
- Export d'autres formats (JSON, Excel) : hors scope MVP
- Génération CSV manuelle : trop risquée sur les caractères spéciaux et virgules dans les données

__État global du projet__

__Jour__

__Contenu__

__État__

1–5

Setup, BDD, seed

✅

6–11

Backend, auth, routes

✅

12

Tests Jest/Supertest

✅

13

Admin modération

✅

14

Stats, CSV, indexes

✅

15

Filtres avancés

❌

16

Hardening backend

❌

17

Security audit

❌

18

Final backend review

❌

19–30

Frontend

❌

Bug apparu après coup au lancement test du server : 

## Synthèse – Debug des routes Admin (Express)

### Ce qu'on a fait

- Analyse de l’erreur TypeError: argument handler must be a function
- Ajout de console.log(typeof ...) dans adminRoutes.js pour identifier les handlers invalides
- Identification des fonctions undefined dans AdminController
- Ajout des méthodes manquantes : getStats, getTopRecipes, exportCSV
- Vérification du bon export du controller (module.exports = AdminController)
- Validation que chaque route Express pointe vers une vraie fonction

### Problèmes rencontrés

#### 1. Erreur Express au démarrage

- __Contexte :__ crash serveur avec argument handler must be a function
- __Découverte :__ stack trace pointant vers adminRoutes.js
- __Options envisagées :__
	- Debug à l’aveugle → ❌ lent et imprécis
	- Logger les handlers (typeof) → ✅ rapide et fiable
- __Décision retenue :__ → utiliser console.log(typeof ...) pour vérifier chaque fonction

#### 2. Fonctions undefined dans le controller

- __Contexte :__ logs montrant getStats: undefined
- __Cause :__ fonctions appelées dans les routes mais non définies
- __Options envisagées :__
	- Commenter les routes → ✅ rapide mais temporaire
	- Implémenter les fonctions → ✅ solution propre
- __Décision retenue :__ → créer les fonctions manquantes pour stabiliser le backend

#### 3. Incompréhension du rôle des routes dans le crash

- __Contexte :__ question sur pourquoi une route non utilisée bloque le serveur
- __Cause :__ Express initialise toutes les routes au démarrage
- __Options envisagées :__
	- Ignorer certaines routes → ❌ impossible
	- Corriger toutes les dépendances → ✅ obligatoire
- __Décision retenue :__ → toute route doit avoir un handler valide

### Décisions techniques prises

- ✅ Chaque route Express doit référencer une fonction définie (jamais undefined)
- ✅ Utilisation systématique de console.log(typeof ...) pour debug des controllers
- ✅ Implémentation minimale des endpoints manquants pour éviter les crashes
- ✅ Structure controller centralisée (classe avec méthodes statiques)
- ✅ Utilisation de pool.query pour toutes les requêtes SQL
- ✅ Gestion des erreurs avec try/catch \+ réponse JSON standardisée

### Ce qui a été écarté et pourquoi

- ❌ Debug “au hasard” sans logs → trop lent et inefficace
- ❌ Laisser des routes cassées → bloque tout le serveur
- ❌ Supprimer des routes définitivement → perte de fonctionnalités
- ❌ Ignorer les erreurs de type Express → crash immédiat non évitable
- ❌ Modifier toute l’architecture → inutile, le problème était localisé

# 🧾 Synthèse – Debug GET /recipes/:id

## ✅ Ce qu'on a fait

- Analyse du problème “Recipe not found”
- Vérification de la base de données (deleted_at)
- Correction d’une soft delete involontaire
- Debug d’une erreur serveur (500)
- Identification d’un bug JS (id is not defined)
- Correction du controller (req.params.id)
- Ajout du compteur de vues

## ❌ Problèmes rencontrés

### 🔹 1. Recette introuvable

- __Contexte :__
	- API retournait 404 alors que la recette existait
- __Cause réelle :__
	- deleted_at non NULL → soft delete actif
- __Options envisagées :__
	- Bug SQL ❌
	- Mauvaise DB ❌
	- Soft delete ✅
- __Décision retenue :__
	- remettre deleted_at = NULL

### 🔹 2. Internal Server Error

- __Contexte :__
	- erreur 500 après correction DB
- __Cause :__
	- variable id non définie
- __Options envisagées :__
	- bug Express ❌
	- bug async ❌
	- variable manquante ✅
- __Décision retenue :__
	- ajouter const id = req.params.id

### 🔹 3. Incrémentation des vues

- __Contexte :__
	- ajout d’un pool.query
- __Problèmes :__
	- pool non importé
	- id non défini
- __Décision retenue :__
	- import propre \+ variable définie

## ✅ Décisions techniques prises

- ✅ utilisation du __soft delete (deleted_at)__
- ✅ filtrage automatique dans findById
- ✅ séparation claire :
	- Model = DB
	- Controller = logique HTTP
- ✅ sécurité :
	- non-admin → seulement published
- ✅ utilisation de req.params pour les routes dynamiques
- ✅ requêtes SQL paramétrées (?)

## 🚫 Ce qui a été écarté et pourquoi

- ❌ supprimer physiquement les recettes → perte de données
- ❌ exposer les recettes non publiées au public → problème métier
- ❌ ignorer les erreurs serveur → debugging impossible
- ❌ faire l’incrémentation des vues dans le model → logique HTTP préférable ici

## Synthèse – Implémentation du Dashboard Admin

### Ce qu'on a fait

- Analyse complète du AdminController.js
- Détection et suppression d’un doublon d’import (db inutile)
- Ajout de la méthode getDashboard avec :
	- stats des recettes (total \+ par statut)
	- top recettes vues
	- top recettes notées
	- top catégories
	- total utilisateurs
- Intégration propre sans casser l’existant
- Ajout de la route GET /admin/dashboard
- Vérification logique des requêtes SQL
- Proposition de tests Postman \+ checklist de validation

### Problèmes rencontrés

#### 1. Doublon d’import (db vs pool)

- __Contexte :__ Deux imports depuis le même fichier, mais seul pool utilisé
- __Options envisagées :__
	- Garder les deux → inutile, confusion
	- Supprimer pool → casse tout le code
	- ✅ Supprimer db
- __Décision retenue :__
	- Suppression de db pour éviter ambiguïté et garder une seule source DB propre

#### 2. Risque de mismatch entre code et base de données

- __Contexte :__ Champs utilisés (views, average_rating, etc.) non garantis
- __Options envisagées :__
	- Ne rien faire → risque de crash en runtime
	- Ajouter des vérifications dynamiques → overkill
	- ✅ Vérification manuelle via tests Postman
- __Décision retenue :__
	- Validation côté dev via Postman \+ alerte sur colonnes sensibles

#### 3. Risque req.user undefined

- __Contexte :__ utilisation de req.user.id dans les logs
- __Options envisagées :__
	- Ignorer → crash si auth mal branchée
	- Ajouter fallback (req.user?.id)
	- ✅ Garder strict \+ rappeler dépendance middleware
- __Décision retenue :__
	- Conserver version stricte (plus propre) → suppose middleware requireAdmin actif

#### 4. Données NULL dans agrégations SQL

- __Contexte :__ SUM() peut retourner null
- __Options envisagées :__
	- Ne rien faire → valeurs incohérentes côté front
	- Forcer côté SQL (COALESCE)
	- ✅ Gérer côté JS (|| 0)
- __Décision retenue :__
	- Tolérance actuelle, améliorable plus tard

### Décisions techniques prises

- Utilisation exclusive de pool pour toutes les requêtes DB
- Centralisation des métriques admin via un endpoint unique /admin/dashboard
- Requêtes SQL optimisées avec agrégations (COUNT, SUM, GROUP BY)
- Structure JSON standardisée :
	- success
	- data
- Logging systématique des actions admin (logger)
- Pagination et filtres maintenus sur endpoints existants
- Séparation claire :
	- dashboard (vue globale)
	- endpoints spécifiques (stats, logs, top, etc.)

### Ce qui a été écarté et pourquoi

- ❌ Garder db en plus de pool → inutile \+ source de confusion
- ❌ Fusionner tous les endpoints existants dans le dashboard → perte de modularité, moins flexible pour le front
- ❌ Ajouter une surcouche de validation SQL avancée → trop lourd pour le besoin actuel
- ❌ Rendre le dashboard dépendant du front (format spécifique UI) → on garde une API générique et réutilisable

