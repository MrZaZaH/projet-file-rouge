# Synthèse Jour 12 — Optimisation des tests d'intégration

## Synthèse — Optimisation des tests d'intégration (suppression bcrypt des beforeEach)

### Ce qu'on a fait

- Réécriture du `beforeEach` de `tests/integration/admin.test.js` : remplacement de 3 appels `POST /api/v1/auth/register` + 1 `POST /api/v1/auth/login` + 1 `POST /api/v1/recipes` par des `INSERT INTO` SQL directs et `jwt.sign()` pour les tokens
- Réécriture du `beforeEach` de `tests/integration/ratings.test.js` : idem, 2 registrations + 1 création de recette remplacés par du SQL direct
- Refactoring de `tests/integration/auth.test.js` :
  - Fusion des deux tests "register 201" et "JWT token" en un seul test cumulé
  - Déplacement du `beforeEach` racine dans le `describe('register')` uniquement
  - Passage du `beforeEach` du `describe('login')` en `beforeAll` avec `clearDatabase()` intégré
- Vérification : `npm test` → 121/121 tests passent, temps total ~20s (contre ~57s avant)

### Problèmes rencontrés

#### 1. Lock wait timeout avec l'exécution parallèle

- **Contexte** : En lançant les 3 fichiers modifiés sans `--runInBand`, les TRUNCATE TABLE de `clearDatabase()` se télescopaient entre workers Jest parallèles, causant des `Lock wait timeout exceeded`
- **Options envisagées** :
  1. Accepter `--runInBand` comme prérequis (solution retenue)
  2. Remplacer TRUNCATE par DELETE + reset auto_increment (plus lent, plus bavard)
  3. Utiliser des bases de données séparées par worker (complexe, hors-scope)
- **Décision retenue** : `--runInBand` dans la commande de test. Le goulot d'étranglement est la base de données unique partagée par tous les tests — c'est un fait connu. Le temps total avec `--runInBand` (20s) reste très inférieur au temps initial avec parallélisme (57s).

#### 2. Foreign key constraint sur l'INSERT de recette

- **Contexte** : En passant du POST /api/v1/recipes (qui passait par l'app Express) à un INSERT SQL direct, les contraintes FK (`fk_recipes_user`, `fk_recipes_category`) exigeaient que l'utilisateur et la catégorie existent déjà au moment de l'INSERT. Avec le parallélisme, l'ordre des opérations n'était pas garanti.
- **Décision retenue** : Résolu par `--runInBand`. Dans un contexte séquentiel, le `beforeEach` garantit l'ordre : catégorie → users → recette.

#### 3. Ordre d'exécution des hooks Jest

- **Contexte** : En passant le `beforeEach` du login en `beforeAll`, le hook `beforeEach` parent (qui appelle `clearDatabase()`) s'exécutait après le `beforeAll` enfant, effaçant les données avant même le premier test.
- **Solution** : Déplacer le `beforeEach(clearDatabase)` racine dans le `describe('register')` uniquement, et intégrer `clearDatabase()` dans le `beforeAll` du login. Les tests login ne modifient pas la BDD (lecture seule), aucune isolation nécessaire entre eux.

### Décisions techniques prises

- **Hash bcrypt pré-calculé** : Utilisation d'une constante `TEST_HASH` (`$2b$10$E9g2k6R4F9n2K3m5L9p0Z...`) partagée entre tous les fichiers de test, identique à celle utilisée dans les tests unitaires. Pas de `bcrypt.hashSync()` au démarrage, pas de hash dans chaque `beforeEach`.
- **`jwt.sign()` direct** : Les tokens JWT sont générés par `jwt.sign({ id, role, username }, process.env.JWT_SECRET, { expiresIn: '24h' })` au lieu de passer par le endpoint `/auth/login`. Le payload doit correspondre exactement à ce que produit `AuthController.login()` pour que le middleware `jwtAuth.authenticate()` le valide.
- **JSON.stringify pour ingredients/steps** : Les INSERT SQL directs utilisent `JSON.stringify()` pour les colonnes JSON, comme le fait `Recipe.create()`.
- **`--runInBand` obligatoire** : Tous les tests partagent la même base de données — le parallélisme n'est pas possible avec TRUNCATE dans `clearDatabase()`.

### Ce qui a été écarté et pourquoi

- **Éliminer complètement bcrypt des tests auth** : Impossible. Les tests de login ("valid credentials", "wrong password") testent explicitement `bcrypt.compare()`. On ne peut pas contourner le hash pour ces tests sans perdre la couverture métier.
- **Tests unitaires modifiés** : Les fichiers `tests/unit/*` et `tests/helpers/testDb.js` sont exclus du périmètre comme spécifié.
- **Migration vers des bases séparées par worker** : Trop complexe pour le gain marginal. L'infrastructure de test (`.env.test`, pool unique) n'est pas conçue pour ça.
