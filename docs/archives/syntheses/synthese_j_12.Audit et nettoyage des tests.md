# Synthèse Jour 12 — Audit et nettoyage de la suite de tests

## Synthèse – Audit et nettoyage de la suite de tests

### Ce qu'on a fait

1. **Audit complet** de tous les fichiers de test (9 fichiers Jest + 4 scripts manuels + helper)
2. **Suppression de `test-scripts/`** (4 fichiers, ~25 KB) — scripts manuels redondants avec la suite Jest
3. **Suppression de `tests/integration/recipes.test.js`** — doublon pur de `tests/unit/recipeModel.test.js` (mêmes méthodes testées, même pattern DB réelle)
4. **Réécriture de `tests/integration/comments.test.js`** — création des données inline via les modèles au lieu de dépendre de `TestDatabase.createFixtures()`
5. **Simplification de `tests/helpers/testDb.js`** : passage de 393 à ~35 lignes — suppression de la classe `TestDatabase` et de `createFixtures()`, export de deux fonctions simples
6. **Nettoyage des imports morts** dans `tests/unit/userModel.test.js` (`seedUser`, `seedCategory` n'existaient pas)
7. **Plan d'optimisation validé** pour les 3 tests d'intégration lents (admin, ratings, auth) — objectif ~57s → ~15s

### Problèmes rencontrés

#### 1. Duplication unit / integration sur les modèles

- **Contexte** : `tests/unit/recipeModel.test.js` (596 lignes) et `tests/integration/recipes.test.js` (270 lignes) testaient les mêmes 5 méthodes de `Recipe` (`create`, `findById`, `findAllWithFilters`, `update`, `softDelete`), toutes deux contre la vraie base de données.
- **Options envisagées** :
  - Garder les deux (redondance assumée) — avantage : zéro risque, inconvénient : temps d'exécution doublé
  - Garder l'intégration, supprimer l'unit — plus cohérent avec le nommage, mais perte des tests `findRandom`
  - **Garder l'unit, supprimer l'intégration** — décision retenue
- **Décision retenue** : supprimer `integration/recipes.test.js`. Le fichier unit est plus complet (couvre `findRandom`), et les tests integration doivent tester le HTTP, pas dupliquer les tests de modèles.

#### 2. Helper sur-ingénié (`testDb.js`)

- **Contexte** : 393 lignes avec documentation exhaustive (250 lignes de JSDoc) pour 3 fonctions simples. `createFixtures()` n'était utilisé que par 2 fichiers, dont un supprimé.
- **Options envisagées** :
  - Garder tel quel (commentaires utiles pour un junior)
  - Supprimer les commentaires mais garder la structure
  - **Tout simplifier** — décision retenue
- **Décision retenue** : réécrire en ~35 lignes, garder les JSDoc essentiels mais sans encyclopédie. `createFixtures()` supprimée car plus aucun consommateur après la réécriture de `comments.test.js`.

#### 3. Performances dégradées par bcrypt

- **Contexte** : 57s pour 122 tests. L'analyse a montré que ~27s étaient gaspillées en appels `bcrypt.hash()` dans les `beforeEach` des tests d'intégration via `POST /api/v1/auth/register`.
- **Options envisagées** :
  - Baisser le salt rounds de bcrypt pour les tests (solution fragile)
  - Mock de bcrypt (injecte une dépendance de test)
  - **Remplacer les appels register API par des inserts SQL + JWT directs** — décision retenue
  - Mutualiser les fixtures avec `beforeAll` au lieu de `beforeEach` (compliqué car les tests modifient l'état)
- **Décision retenue** (non exécutée, planifiée) : `admin.test.js` et `ratings.test.js` en SQL direct + JWT bypass. `auth.test.js` : fusion de tests + `beforeAll`.
- **Gain estimé** : 57s → ~15s.

### Décisions techniques prises

1. **Un seul jeu de tests par modèle** — pas de doublon unit + integration sur les mêmes méthodes. Les tests unit testent la logique métier, les tests integration testent le circuit HTTP complet.
2. **Les tests d'intégration ne doivent pas appeler l'API d'auth pour créer des utilisateurs** — le coût bcrypt est injustifié quand on teste autre chose que l'auth. Insert SQL direct + JWT bypass est la norme.
3. **`tests/helpers/testDb.js` est un simple export de fonctions** — pas de classe, pas de fixtures préfabriquées. Chaque fichier de test crée ses propres données, ce qui évite les dépendances cachées.
4. **Les scripts manuels (`test-scripts/`) sont à supprimer** — la suite Jest automatique les rend obsolètes. Si un script de debug ponctuel est nécessaire, il est créé ad-hoc et jeté.
5. **Les commentaires dans les tests sont conservés** — ils servent de support pédagogique pour le niveau Bac+2.

### Ce qui a été écarté et pourquoi

1. **Mock de bcrypt** — écarté car cela complexifie la configuration Jest et s'éloigne du principe de test sur environnement réel. À la place, on ne passe tout simplement pas par bcrypt quand on n'a pas besoin de tester l'auth (insert SQL direct).
2. **Couverture des contrôleurs via des tests dédiés** — écarté car les tests integration (via supertest) couvrent déjà le circuit complet request → middleware → controller → model → DB. Ajouter des tests controllers isolés serait une duplication.
3. **Migration vers une vraie base de test séparée (`recettes_humaines_test`)** — écarté car `.env.test` pointe vers `recettes_humaines`. C'est un problème d'infrastructure existant, pas un problème de test. À corriger si le temps le permet mais hors scope de cette session.
4. **Suppression des commentaires JSDoc dans les tests** — demandé par l'utilisateur de les garder. Ils alourdissent les fichiers mais servent de support pédagogique.