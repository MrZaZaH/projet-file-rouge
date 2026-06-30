# Tests : Jest + Supertest

## Contexte

Il faut vérifier que les règles métier sont respectées (doublons, validation, auto-rating interdit) et que l'API répond correctement.

---

## Pourquoi Jest ?

### Alternatives écartées

| Option | Problème |
|---|---|
| Mocha + Chai | Plus de boilerplate, choix du assert, du mock, du reporter. Jest a tout intégré. |
| Ava | Rapide, mais moins d'écosystème et moins utilisé en formation. |
| Tape | Trop minimaliste — pas de mocking, pas de coverage. |

**Jest** est le standard actuel, documenté largement, utilisé en formation. Avec Supertest pour les tests d'intégration HTTP.

---

## Pourquoi des tests d'intégration plutôt qu'unitaires ?

### Ce qui est fait

Les deux existent :
- **Tests unitaires** : `tests/unit/ratingModel.test.js` — teste `Rating.rate()` isolément
- **Tests d'intégration** : `tests/integration/ratings.test.js` — teste la route HTTP complète avec DB réelle

**Pourquoi ne pas se contenter d'unitaires ?** Les règles métier (doublon, auto-rating, score 1-5) sont implémentées à plusieurs niveaux : validation dans la route, logique dans le controller, contrainte en DB. Un test unitaire ne vérifie pas que la route renvoie le bon code HTTP ou que la validation express-validator fonctionne.

### Ce qu'on teste concrètement

`tests/integration/ratings.test.js` :

```javascript
test('should create a rating', async () => { ... })
test('should update existing rating and return 200', async () => { ... })
test('should reject rating own recipe with 403', async () => { ... })
test('should reject score below 1 with 422', async () => { ... })
test('should reject score above 5 with 422', async () => { ... })
test('should reject missing score with 422', async () => { ... })
test('should reject duplicate rating with 409', async () => { ... })
test('should reject non-existent recipe with 404', async () => { ... })
```

Chaque règle métier a son test. Si une règle est cassée, le test nommé le dit immédiatement.

---

## Pourquoi une DB dédiée pour les tests ?

### Ce qui est fait

`tests/helpers/testDb.js` — avant chaque test, on vide les tables concernées :

```javascript
await pool.execute('TRUNCATE TABLE ratings');
await pool.execute('TRUNCATE TABLE recipes');
// etc.
```

**Risque de l'inverse (DB de dev partagée) :** les tests modifient la DB de dev. Données de test mélangées aux vraies données. Seeds à réinitialiser manuellement. Tests non reproductibles.

**Pourquoi pas une DB in-memory (SQLite) ?** On utilise MariaDB avec mysql2. SQLite a des différences subtiles (pas de `ROW_NUMBER()`, types différents). Un test qui passe sur SQLite peut échouer en prod. On teste sur la même DB que la production.

### En version 2

- Tests de charge (k6 ou artillery) sur les endpoints critiques
- Tests de sécurité : injection SQL, XSS, brute-force
- CI pipeline : les tests s'exécutent automatiquement sur chaque PR
- Coverage minimum obligatoire (ex: 80% sur les modèles)
