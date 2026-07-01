# 24 — Tests Automatisés (Jest + Supertest)

## 1. CE QUE ÇA FAIT (vue d'ensemble)

Les tests Jest valident le comportement de l'API sans démarrer le serveur HTTP (Supertest simule les requêtes). Chaque test part d'une base de données propre (`beforeEach` → `clearDatabase()`), ce qui garantit l'isolation totale entre les tests. Les mots de passe utilisent un hash bcrypt pré-calculé pour éviter de ralentir les tests.

## 2. SCHÉMA DE LA TABLE

Pas de table — c'est du code de test (framework Jest).

## 3. LE CODE

### 3.1 — jest.config.js (`jest.config.js:14-55`)

```javascript
module.exports = {
    testEnvironment: 'node',
    testTimeout: 10000,
    setupFiles: ['<rootDir>/tests/setup.js'],
    testMatch: ['<rootDir>/tests/**/*.test.js'],
    collectCoverage: true,
    collectCoverageFrom: ['src/**/*.js', '!src/database/connection.js', '!src/config/**'],
    coverageThreshold: {
        global: { branches: 60, functions: 70, lines: 70, statements: 70 },
    },
    transform: {},
    verbose: true,
    clearMocks: true,
};
```

- `testEnvironment: 'node'` : pas besoin de DOM (pas de frontend testé ici).
- `testTimeout: 10000` : 10 secondes max par test (les opérations DB peuvent être lentes).
- `setupFiles: ['tests/setup.js']` : exécute le setup avant TOUS les tests.
- `collectCoverageFrom` : exclude `connection.js` car le pool DB est difficile à mocker proprement.
- `coverageThreshold` : pas de régression en dessous de 60-70%.
- `clearMocks: true` : reset automatique des mocks entre les tests.
- `transform: {}` : pas de transpilation (on utilise du Node.js vanilla).

### 3.2 — setup.js (`tests/setup.js:1-12`)

```javascript
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.test') });
```

Charge les variables d'environnement de test AVANT toute exécution. Sans cette ligne, les tests utiliseraient la base de prod (!!). Le fichier `.env.test` pointe vers `recettes_humaines_test`.

### 3.3 — testDb.js (`tests/helpers/testDb.js:19-28`)

```javascript
async function clearDatabase() {
    await pool.execute('SET FOREIGN_KEY_CHECKS = 0');
    await pool.execute('TRUNCATE TABLE admin_logs');
    await pool.execute('TRUNCATE TABLE comments');
    await pool.execute('TRUNCATE TABLE ratings');
    await pool.execute('TRUNCATE TABLE recipes');
    await pool.execute('TRUNCATE TABLE users');
    await pool.execute('TRUNCATE TABLE categories');
    await pool.execute('SET FOREIGN_KEY_CHECKS = 1');
}
```

`TRUNCATE` est plus rapide que `DELETE` ET reset les auto_increment. Avant de truncater, on désactive les contraintes de clés étrangères (`FOREIGN_KEY_CHECKS = 0`), sinon MariaDB ordonnerait les TRUNCATE selon les dépendances. L'ordre alphabétique ici n'est pas respecté — c'est le `SET FOREIGN_KEY_CHECKS = 0` qui permet de tronquer dans n'importe quel ordre.

### 3.4 — recipeModel.test.js (`tests/unit/recipeModel.test.js:30-40`)

```javascript
beforeEach(async () => {
    await clearDatabase();
    testUser = await User.create({
        username: 'recipe_tester',
        email: 'recipe_tester@example.com',
        password_hash: '$2b$10$E9g2k6R4F9n2K3m5L9p0Z.7W8Q5J3H1D6G4C2N9S8V5R7T4K2E9',
    });
    testCategory = await Category.create({ name: 'Plats Rapides' });
});
```

`clearDatabase()` avant CHAQUE test garantit l'isolation. Le hash est pré-calculé (pas d'appel à bcrypt dans les tests) — bcrypt est volontairement lent (cost factor) et 30 tests X 2-3 hashs = ralenti considérablement l'exécution. Avec un hash fixe, on gagne des secondes.

### 3.5 — auth.test.js (`tests/integration/auth.test.js:33-46`)

```javascript
test('should register a new user, return 201, and provide a JWT token', async () => {
    const res = await request(app)
        .post('/api/v1/auth/register')
        .send(validUser);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(validUser.email);
    expect(res.body.data.user.password_hash).toBeUndefined();
    expect(res.body.data.token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
});
```

`request(app)` utilise l'application Express sans démarrer le serveur HTTP (Supertest crée un serveur interne). On teste :
- Le status HTTP (201).
- La structure de la réponse (success, data).
- Que le mot de passe NE remonte PAS dans la réponse (`toBeUndefined()`).
- Que le token JWT a le bon format (3 parties séparées par des points).

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

1. `npm test` lance Jest.
2. Jest charge `jest.config.js`, puis exécute `tests/setup.js` qui charge `.env.test`.
3. Pour chaque fichier de test :
   - `beforeAll` (optionnel) : setup global (ex: création user pour les tests de login).
   - `beforeEach` : `clearDatabase()` vide toutes les tables.
   - Chaque `test()` exécute une requête via Supertest et vérifie les assertions.
   - `afterEach` (optionnel) : cleanup.
   - `afterAll` : `closeDatabase()` ferme le pool pour que Jest ne pende pas.
4. Coverage : rapport HTML + console indiquant les % de code couvert.
5. Si une assertion échoue, Jest affiche la différence attendue/réelle et continue les tests suivants.

## 5. ANALOGIE

C'est un chef qui goûte chaque plat avant de le servir. Chaque test est une dégustation :
- `clearDatabase()` = assiette propre à chaque fois.
- `request(app)` = cuillère prélevée dans l'assiette.
- `expect().toBe()` = le chef vérifie que le goût est bon.
- `TEST_HASH` = un cube de bouillon pré-préparé pour ne pas perdre de temps à faire un bouillon maison à chaque test.

## 6. PIÈGES CLASSIQUES

### Piège #1 : Tester sur la base de production

```javascript
// MAUVAIS — .env chargé, pas de .env.test
// Les tests tournent sur la vraie base de données
```

```javascript
// BON — setup.js force .env.test avant tout
require('dotenv').config({ path: path.resolve(__dirname, '../.env.test') });
```

### Piège #2 : Pas de `TRUNCATE` → tests qui s'influencent entre eux

```javascript
// MAUVAIS — le test 2 trouve les données du test 1
test('should find 1 recipe', async () => { ... });
test('should find 0 recipes', async () => { ... }); // ÉCHEC : il y en a 1
```

```javascript
// BON — beforeEach clearDatabase, chaque test est isolé
beforeEach(async () => { await clearDatabase(); });
```

### Piège #3 : Oublier `afterAll` → Jest pend indéfiniment

```javascript
// MAUVAIS — le pool DB reste ouvert, Jest ne termine jamais
```

```javascript
// BON — fermeture explicite
afterAll(async () => { await closeDatabase(); });
```

### Piège #4 : Utiliser bcrypt dans les tests (lent)

```javascript
// MAUVAIS — hash à chaque test, 5+ secondes pour 30 tests
const hash = await bcrypt.hash('password', 10);
```

```javascript
// BON — hash pré-calculé, constant
const TEST_HASH = '$2b$10$E9g2k6R4F9n2K3m5L9p0Z.7W8Q5J3H1D6G4C2N9S8V5R7T4K2E9';
```

### Piège #5 : Utiliser `app.listen()` dans les tests

Supertest crée son propre serveur éphémère. Si on appelle `app.listen()` dans les tests, on crée un port HTTP réel qu'il faut fermer manuellement, ce qui ajoute de la complexité inutile.

## 7. ET SI ON FAISAIT AUTREMENT ?

### Option A : Mocks SQL complets (sans base réelle)

Utiliser `jest.mock()` pour mocker le pool mysql2. Plus rapide (pas de DB), MAIS les tests ne détectent pas les vrais problèmes SQL (typo dans les colonnes, mauvaises jointures, erreurs MySQL spécifiques). Le choix ici est de tester contre une vraie base de test pour coller à la réalité.

### Option B : Tests E2E avec Cypress/Playwright

Pour tester le frontend + backend ensemble. Hors scope ici (bloc 2 DWM = back-end). Les tests Jest/Supertest couvrent le back, des tests E2E pourraient s'ajouter dans le bloc 1.

### Option C : `RUN_IN_BAND` explicite

Par défaut, Jest parallélise les tests par fichier. Le setup avec TRUNCATE est conçu pour du séquentiel car `clearDatabase()` peut casser des tests parallèles. `RUN_IN_BAND` (ou `--runInBand`) force le séquentiel, déjà configuré dans la config Jest.

## 8. CHECKLIST POUR LE JURY

- [ ] `jest.config.js` pointe vers `tests/` comme dossier de test.
- [ ] `setup.js` charge `.env.test` (pas `.env` de prod).
- [ ] `clearDatabase()` désactive `FOREIGN_KEY_CHECKS` avant TRUNCATE.
- [ ] Chaque test (ou chaque bloc `describe`) appelle `clearDatabase()` en `beforeEach`.
- [ ] `closeDatabase()` est appelé en `afterAll` pour éviter le hang Jest.
- [ ] Les mots de passe utilisent un `TEST_HASH` pré-calculé (pas de bcrypt dans les tests).
- [ ] `password_hash` est `toBeUndefined()` dans la réponse.
- [ ] Supertest utilise `request(app)` sans `app.listen()`.
- [ ] Les tests unitaires testent le modèle directement (sans HTTP).
- [ ] Les seuils de couverture sont configurés (60/70/70/70).
- [ ] Les tests peuvent être exécutés avec `npm test` (vérifier `package.json`).
