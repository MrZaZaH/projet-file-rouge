# 21 — Validation des Entrées (express-validator)

## 1. CE QUE ÇA FAIT (vue d'ensemble)

Avant que les données arrivent au contrôleur, express-validator vérifie chaque champ de la requête (body, params, query). Si un champ est invalide (trop court, absent, mauvais format), la requête est bloquée en 422 Unprocessable Entity avec un tableau d'erreurs détaillées. Le contrôleur ne reçoit JAMAIS des données invalides.

## 2. SCHÉMA DE LA TABLE

Pas de table — c'est du code applicatif, pas une donnée persistée.

## 3. LE CODE

### 3.1 — authRoutes.js (`src/routes/authRoutes.js:17-34`)

```javascript
const registerValidation = [
    body('username')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Username must be between 2 and 50 characters'),
    body('email')
        .trim()
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email required'),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters')
        .matches(/[A-Z]/)
        .withMessage('Password must contain at least one uppercase letter')
        .matches(/[0-9]/)
        .withMessage('Password must contain at least one number')
];
```

Chaque `body('field')` crée une chaîne de validations. `.trim()` enlève les espaces avant/après. `.isLength({ min, max })` contrôle la taille. `.matches(/regex/)` impose un pattern (ex: au moins une majuscule). `.normalizeEmail()` convertit l'email en lowercase standard. `.withMessage()` personnalise le message d'erreur.

### 3.2 — recipeRoutes.js (`src/routes/recipeRoutes.js:19-63`)

```javascript
function validate(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }
    next();
}

const recipeBodyRules = [
    body('title').trim().notEmpty().withMessage('Title is required.')
        .isLength({ max: 255 }).withMessage('Title must be 255 characters or fewer.'),
    body('ingredients').isArray({ min: 1 }).withMessage('ingredients must be a non-empty array.'),
    body('ingredients.*').trim().notEmpty().withMessage('Each ingredient must be a non-empty string.'),
    body('steps').isArray({ min: 1 }).withMessage('steps must be a non-empty array.'),
    body('steps.*').trim().notEmpty().withMessage('Each step must be a non-empty string.'),
    body('cost_per_portion').isFloat({ min: 0.01 }).withMessage('cost_per_portion must be a positive number.'),
];
```

Trois choses importantes ici :
- `ingredients.*` et `steps.*` valident CHAQUE élément du tableau — le wildcard `*` parcourt tous les index.
- Les deux champs JSON doivent être des tableaux (`isArray`) — toute string (y compris du JSON stringifié) est rejetée en 422.
- `validate()` est une fonction middleware séparée qui appelle `validationResult(req)` et renvoie 422 si des erreurs existent. La chaîne complète sur une route POST devient : `authenticate → recipeBodyRules → validate → RecipeController.createRecipe`.

### 3.3 — commentRoutes.js (`src/routes/commentRoutes.js:40-61`)

```javascript
const commentRules = [
    body('content').trim().notEmpty().withMessage('Content is required.')
        .isLength({ max: 1000 }).withMessage('Content must be under 1000 characters.'),
    body('guest_name')
        .if((_, { req }) => !req.user)
        .trim().notEmpty().withMessage('A name is required to comment as a guest.')
        .isLength({ max: 50 }).withMessage('Name must be under 50 characters.'),
];
```

`.if()` rend la validation conditionnelle : `guest_name` n'est validé QUE si `req.user` est undefined (utilisateur non connecté). Si l'utilisateur a un token valide, on ignore `guest_name` complètement. Évite de forcer un nom pour les membres connectés.

### 3.4 — ratingRoutes.js (`src/routes/ratingRoutes.js:14-18`)

```javascript
const ratingRules = [
    body('score')
        .notEmpty().withMessage('Score is required.')
        .isInt({ min: 1, max: 5 }).withMessage('Score must be an integer between 1 and 5.'),
];
```

Validation simple mais stricte : `score` doit être un entier entre 1 et 5. Pas de notes flottantes (pas de 3.5). Pas de 0 ni de 6.

### 3.5 — adminRoutes.js (`src/routes/adminRoutes.js:43-66`)

```javascript
router.get('/recipes', [
    query('status').optional().isIn(['pending', 'published', 'rejected'])
        .withMessage('Invalid status. Must be pending, published, or rejected'),
    query('sort_by').optional().isIn(['created_at', 'average_rating', 'rating_count'])
        .withMessage('Invalid sort field'),
    query('limit').optional().isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 })
        .withMessage('Offset must be 0 or positive')
], handleValidationErrors, AdminController.getAllRecipes);
```

Utilisation de `query()` au lieu de `body()` pour valider les paramètres d'URL. `.optional()` permet d'omettre ces champs sans erreur — seulement validés si présents. `param('id').isInt()` valide les paramètres de route (ex: `/recipes/abc` serait rejeté).

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

1. Requête HTTP arrive sur une route (ex: POST `/api/v1/recipes` avec un body JSON).
2. `body('title').trim().notEmpty()` s'exécute : vérifie que `title` existe et n'est pas vide après trim.
3. `body('ingredients').isArray({ min: 1 })` vérifie que `ingredients` est un tableau non vide.
4. `body('ingredients.*').trim().notEmpty()` vérifie chaque élément du tableau.
5. `validate()` appelle `validationResult(req)` — si tout est valide, `next()` passe au contrôleur.
6. Si une validation échoue, `validationResult()` contient les erreurs. `res.status(422).json({ errors: errors.array() })` est renvoyé immédiatement.
7. Le contrôleur ne reçoit JAMAIS la requête si la validation a échoué.

## 5. ANALOGIE

C'est comme un portier de boîte de nuit qui vérifie les pièces d'identité avant de laisser entrer. Si le nom est manquant, la carte est périmée ou l'âge insuffisant, le portier refuse l'entrée — le videur (le contrôleur) n'a même pas à savoir que la personne a tenté d'entrer.

## 6. PIÈGES CLASSIQUES

### Piège #1 : Oublier d'appeler `validationResult()`

```javascript
// MAUVAIS — la validation est définie mais jamais exécutée
router.post('/', recipeBodyRules, RecipeController.createRecipe);
// Le tableau recipeBodyRules est passé mais personne ne vérifie les erreurs
```

```javascript
// BON — le middleware validate() est dans la chaîne
router.post('/', authenticate, recipeBodyRules, validate, RecipeController.createRecipe);
```

### Piège #2 : Valider `body()` sur une requête GET

```javascript
// MAUVAIS — les GET n'ont pas de body
router.get('/', body('status').isIn(['published']), ...);
// Express parse rarement le body des GET, validationResult sera vide
```

```javascript
// BON — utiliser query() pour les paramètres d'URL
router.get('/', query('status').isIn(['published']), ...);
```

### Piège #3 : Oublier `.trim()` sur les chaînes

```javascript
// MAUVAIS — '  ' passe notEmpty() (des espaces blancs)
body('title').notEmpty()
```

```javascript
// BON — trim supprime les espaces avant la validation
body('title').trim().notEmpty()
```

### Piège #4 : `ingredients.*` sans vérifier que c'est d'abord un tableau

```javascript
// MAUVAIS — si ingredients est une string, ingredients.* ne fonctionne pas
body('ingredients.*').notEmpty()
```

```javascript
// BON — on vérifie le type avant le contenu
body('ingredients').isArray({ min: 1 }),
body('ingredients.*').trim().notEmpty()
```

## 7. ET SI ON FAISAIT AUTREMENT ?

### Option A : Joi

Librairie de validation externe (npm `joi`). Syntaxe plus déclarative : `Joi.string().min(2).max(50).required()`. Plus expressive mais ajoute une dépendance et un schéma séparé du route. express-validator est plus idiomatique avec Express car ce sont des middlewares.

### Option B : Validation dans le contrôleur uniquement

Certains projets valident directement dans le contrôleur avec des `if` imbriqués. Ça mélange responsabilités, rend le code illisible, et augmente le risque d'oublier un cas. express-validator force une séparation claire.

### Option C : Typage fort (TypeScript)

TypeScript ne valide pas les données runtime — il vérifie uniquement à la compilation. Une requête HTTP peut parfaitement envoyer `title: 123` et TypeScript ne l'arrêtera pas. express-validator (ou Joi) est complémentaire, pas remplaçable par du typage.

## 8. CHECKLIST POUR LE JURY

- [ ] Chaque route POST/PUT/PATCH a ses règles de validation (body).
- [ ] Chaque route GET avec filtres valide les query params (query()).
- [ ] Chaque route avec paramètre d'URL valide l'ID (param('id').isInt()).
- [ ] `validationResult()` est appelée dans un middleware de validation.
- [ ] Le statut 422 est utilisé (pas 400) pour les erreurs de validation.
- [ ] `.trim()` est appliqué sur toutes les chaînes.
- [ ] `ingredients.*` et `steps.*` sont précédés de `isArray()` chacun.
- [ ] La validation conditionnelle (`.if()`) est utilisée là où c'est logique (guest_name).
- [ ] Les mots de passe ont des contraintes regex (majuscule, chiffre, longueur).
- [ ] Aucune erreur SQL ne peut arriver à cause de données invalides (bloquées en amont).
