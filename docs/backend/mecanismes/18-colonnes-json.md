# #18 — Colonnes JSON (Ingredients, Steps)

## 1. CE QUE ÇA FAIT (vue d'ensemble)

Les ingrédients et les étapes d'une recette sont stockés dans des colonnes JSON dans MariaDB. Au lieu de créer des tables séparées `recipe_ingredients` et `recipe_steps` reliées par des clés étrangères, on stocke un tableau JavaScript directement sérialisé en JSON : `["pâtes", "tomates", "basilic"]`. À la lecture, on parse ce JSON pour retrouver un tableau JavaScript. Le modèle Recipe contient une normalisation string→array (split par virgule ou saut de ligne), mais avec la validation express-validator (`isArray()`) en amont, cette normalisation est du dead code — la validation garantit que seuls des tableaux arrivent au modèle.

## 2. SCHÉMA DE LA TABLE

```sql
-- Table recipes (03_create_tables.sql:54)
CREATE TABLE IF NOT EXISTS recipes (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id             INT UNSIGNED NOT NULL,
    category_id         INT UNSIGNED NOT NULL,
    title               VARCHAR(255) NOT NULL,
    anecdote            TEXT NOT NULL,
    ingredients         JSON NOT NULL,
    -- JSON column : stocke un tableau de strings ["pâtes", "tomates", "basilic"]
    -- Pas de table séparée, pas de jointure pour récupérer la liste
    -- Exemple réel : '["200g pâtes","2 tomates","basilic frais","huile d'olive"]'
    steps               JSON NOT NULL,
    -- JSON column : stocke un tableau de strings ["Étape 1", "Étape 2"]
    -- Exemple réel : '["Faire cuire les pâtes","Préparer la sauce","Mélanger"]'
    prep_time           SMALLINT UNSIGNED NOT NULL,
    cost_per_portion    DECIMAL(5,2) UNSIGNED NOT NULL,
    status              ENUM('pending', 'published', 'rejected') NOT NULL DEFAULT 'pending',
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at          DATETIME NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pourquoi JSON et pas VARCHAR ?
-- JSON permet à MariaDB de valider que le contenu est bien du JSON valide.
-- On pourrait aussi faire des opérations JSON en SQL (JSON_EXTRACT, etc.),
-- mais on parse côté JS pour rester simple.
```

## 3. LE CODE

> **Note 2026** : Cette normalisation string→array est désormais du **dead code**. Le middleware de validation (`body('ingredients').isArray({ min: 1 })`) bloque toute requête où `ingredients` n'est pas un tableau avant qu'elle n'atteigne le contrôleur. Seul le cas `Array.isArray()` est donc exécuté en pratique.

### 3.1 — Normalisation des ingrédients (src/models/Recipe.js:138)

```javascript
// Dans Recipe.create()
let ingredients;

if (Array.isArray(data.ingredients)) {
    // Cas 1 : le formulaire a déjà envoyé un tableau
    // → on l'utilise tel quel
    ingredients = data.ingredients;

} else if (typeof data.ingredients === 'string' && data.ingredients.trim() !== '') {
    // Cas 2 : le formulaire a envoyé une chaîne "pâtes, tomate, basilic"
    // → on la découpe sur les virgules, on nettoie les espaces
    // "pâtes, tomate , parmesan" → ["pâtes", "tomate", "parmesan"]
    ingredients = data.ingredients
        .split(',')                           // on coupe à chaque virgule
        .map(s => s.trim())                   // on enlève les espaces autour
        .filter(s => s.length > 0);           // on vire les chaînes vides

} else {
    // Cas 3 : null, undefined, ou vide → on rejette
    ingredients = [];
}

if (ingredients.length === 0) {
    throw new Error('Ingredients are required and non-empty');
    // Bloque avant d'arriver à la BDD
}
```

> **Note 2026** : Même dead code que pour ingredients — la validation assure un tableau avant l'arrivée ici.

### 3.2 — Normalisation des étapes (src/models/Recipe.js:166)

```javascript
let steps;

if (Array.isArray(data.steps)) {
    // Tableau JavaScript → utilisation directe
    steps = data.steps;
} else if (typeof data.steps === 'string' && data.steps.trim() !== '') {
    // String "1. Cuire les pâtes\n2. Égoutter\n3. Servir"
    // → découpage sur \n (saut de ligne)
    steps = data.steps
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0);
} else {
    steps = [];
}

if (steps.length === 0) {
    throw new Error('Steps are required and non-empty');
}
```

### 3.3 — Insertion dans la BDD (src/models/Recipe.js:216)

```javascript
// Après normalisation, on a :
// ingredients = ["pâtes", "tomates", "basilic"]
// steps = ["Faire cuire", "Préparer la sauce", "Mélanger"]

const query = `
    INSERT INTO recipes (
        user_id, category_id, title, anecdote,
        ingredients, steps,
        prep_time, cost_per_portion,
        status, average_rating, rating_count,
        created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
`;

const [result] = await pool.query(query, [
    data.user_id,
    data.category_id,
    data.title.trim(),
    data.anecdote.trim(),
    JSON.stringify(ingredients),    // ["pâtes","tomates","basilic"]
    // JSON.stringify() transforme le tableau JS en string JSON
    // ["pâtes", "tomates"] → '["pâtes","tomates"]'
    // MariaDB stocke cette string dans la colonne JSON
    JSON.stringify(steps),          // ["Faire cuire","Préparer","Mélanger"]
    prepTime,
    cost,
    data.status || 'pending',
    0,
    0,
]);
```

### 3.4 — Lecture et parsing JSON (src/models/Recipe.js:342)

```javascript
// Dans Recipe.findById() — après SELECT
const row = rows[0];

let ingredients = [];
let steps = [];

try {
    // row.ingredients est une string JSON : '["pâtes","tomates"]'
    // JSON.parse() la transforme en tableau JavaScript : ["pâtes", "tomates"]
    ingredients = row.ingredients ? JSON.parse(row.ingredients) : [];
    steps = row.steps ? JSON.parse(row.steps) : [];
} catch (parseError) {
    // Si le JSON est corrompu (cas rare), on ne crashe pas la page
    // On log l'erreur et on retourne des tableaux vides
    logger.warn(`Failed to parse JSON fields for recipe ${id}: ${parseError.message}`);
}

// Résultat final :
// ingredients = ["pâtes", "tomates", "basilic"]
// steps = ["Faire cuire les pâtes", "Préparer la sauce", "Mélanger"]

return {
    id: row.id,
    title: row.title,
    ingredients,  // ← array JS, pas une string
    steps,        // ← array JS, pas une string
    // Le frontend reçoit un tableau JSON dans la réponse API
    // JSON.parse() du frontend donne un vrai tableau JavaScript
};
```

### 3.5 — Même pattern dans findAllWithFilters (src/models/Recipe.js:570)

```javascript
const recipes = rows.map((row) => {
    let ingredients = [];
    let steps = [];
    try {
        ingredients = row.ingredients ? JSON.parse(row.ingredients) : [];
        steps = row.steps ? JSON.parse(row.steps) : [];
    } catch (parseError) {
        logger.warn(`Failed to parse JSON for recipe ${row.id}: ${parseError.message}`);
    }

    return {
        id: row.id,
        title: row.title,
        ingredients,
        steps,
        // ...
    };
});
```

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

```
Création d'une recette (create) :

1. Formulaire HTML envoie :
   - ingredients: "200g pâtes, 2 tomates, basilic" (string avec virgules)
   - steps: "1. Faire bouillir l'eau\n2. Cuire les pâtes\n3. Égoutter" (string avec \n)

2. Recipe.create() normalise :
   - ingredients.split(',') → ["200g pâtes", "2 tomates", "basilic"]
   - steps.split('\n') → ["1. Faire bouillir l'eau", "2. Cuire les pâtes", "3. Égoutter"]

3. JSON.stringify() serialize en JSON :
   - ingredients → '["200g pâtes","2 tomates","basilic"]'
   - steps → '["1. Faire bouillir l\'eau","2. Cuire les pâtes","3. Égoutter"]'

4. INSERT dans MariaDB :
   - Colonne ingredients : '["200g pâtes","2 tomates","basilic"]'
   - Colonne steps : '["1. Faire bouillir l\'eau","2. Cuire les pâtes","3. Égoutter"]'

Consultation d'une recette (findById) :

5. SELECT récupère les strings JSON depuis MariaDB
6. JSON.parse() transforme en tableaux JavaScript
7. Express.json() serialize la réponse pour le frontend
8. Frontend reçoit des tableaux JSON et les affiche avec .forEach() ou .map()
```

## 5. ANALOGIE

Tu écris une liste de courses sur un Post-it.

**Option table séparée** : Tu as une feuille Excel avec une ligne par ingrédient. Chaque ligne a un numéro de recette, un numéro d'ordre, un nom, une quantité. Pour retrouver les ingrédients d'une recette, tu fais une recherche dans Excel. C'est puissant mais lourd.

**Option JSON** (notre choix) : Tu écris directement sur la fiche recette : "Ingrédients : pâtes, tomates, basilic". Tout est sur la même fiche, tu n'as pas besoin de chercher ailleurs. C'est moins flexible (tu ne peux pas facilement demander "quelles recettes utilisent des tomates ?") mais beaucoup plus simple.

Pour un MVP d'apprentissage où la feature "recherche par ingrédient" n'existe pas, le Post-it (JSON) est largement suffisant. On ajoutera la table dédiée si un jour on a besoin de chercher par ingrédient.

## 6. PIÈGES CLASSIQUES

### Piège #1 : Oublier JSON.stringify() avant INSERT

Si tu passes un tableau JavaScript directement dans la requête SQL sans le stringifier, mysql2 va tenter de le convertir en string via `toString()` ce qui donne `"pâtes,tomates,basilic"` — un VARCHAR, pas du JSON valide.

**MAUVAIS :**
```javascript
ingredients: data.ingredients  // le tableau JS est passé tel quel
```

**BON :**
```javascript
ingredients: JSON.stringify(ingredients)  // stringifié en JSON
```

### Piège #2 : Oublier JSON.parse() après SELECT

Sans parse, le frontend reçoit une chaîne de caractères au lieu d'un tableau. Impossible de faire `ingredients.forEach()` ou `ingredients.length`.

**MAUVAIS :**
```javascript
ingredients: row.ingredients  // '["pâtes","tomates"]' → string, pas array
```

**BON :**
```javascript
ingredients: JSON.parse(row.ingredients)  // ["pâtes", "tomates"] → array
```

### Piège #3 : Supposer que le JSON est toujours valide

Si une donnée corrompue arrive dans la BDD (via un bug ou une manipulation directe), `JSON.parse()` lance une erreur qui crashe la page.

**MAUVAIS :**
```javascript
ingredients: JSON.parse(row.ingredients)
```

**BON :**
```javascript
try {
    ingredients = row.ingredients ? JSON.parse(row.ingredients) : [];
} catch (parseError) {
    logger.warn(`Parse failed: ${parseError.message}`);
    ingredients = [];  // fallback silencieux
}
```

### Piège #4 : Envoyer une string JSON (JSON.stringify) au lieu d'un tableau natif

Si le frontend fait `JSON.stringify(["pâtes", "tomates"])`, il envoie `'["pâtes","tomates"]'` (une string). express-validator `isArray()` rejette cette string en 422. Les tableaux doivent être envoyés **natif** — c'est le modèle backend qui les stringifie avec `JSON.stringify()` avant INSERT dans MariaDB.

### Piège #5 : La normalisation ne rattrape pas les strings JSON

Le code de normalisation dans `create()` gère le cas `"pâtes, tomates"` (split par virgule) mais PAS `'["pâtes","tomates"]'` (JSON stringifié). Un `JSON.parse()` serait nécessaire. Mais avec la validation middleware, ce cas n'arrive de toute façon jamais jusqu'au modèle.

## 7. ET SI ON FAISAIT AUTREMENT ?

### Option A : Tables de liaison (normalisation relationnelle)

- Comment ça marche : Un table `recipe_ingredients` avec `(recipe_id, ingredient_name, quantity, unit, sort_order)` et `recipe_steps` avec `(recipe_id, step_description, step_order)`
- Avantage : Requêtes possibles comme "trouver toutes les recettes qui utilisent des tomates". Données propres et normalisées (3e forme normale). Pas de parsing nécessaire.
- Inconvénient : Beaucoup plus de code (CRUD sur deux tables supplémentaires, jointures partout, gestion de l'ordre). Complexité pour une fonctionnalité qu'on n'exploite pas.
- Notre cas : On garde JSON. La recherche par ingrédient n'est pas dans le MVP. Si elle devient nécessaire plus tard, on migrera vers une table dédiée (c'est l'avantage d'avoir un modèle — on change le modèle, le reste suit).

### Option B : Colonnes VARCHAR avec séparateur

- Comment ça marche : Stocker "pâtes, tomates, basilic" dans un VARCHAR(255) et splitter au moment de l'affichage
- Avantage : Zéro JSON, zéro parse, le plus simple possible
- Inconvénient : Pas de validation de format par la BDD. Risque qu'un utilisateur mette "pâtes; tomates" avec un point-virgule et que le split rate. Impossible de stocker des ingrédients avec des virgules dans le nom. Pas extensible (si on veut ajouter quantité, unité).
- Notre cas : Le JSON offre la validation et l'extensibilité sans la complexité des tables de liaison.

## 8. CHECKLIST POUR LE JURY

- [ ] Les colonnes `ingredients` et `steps` sont de type JSON dans la base
- [ ] À l'insertion, les tableaux sont stringifiés avec `JSON.stringify()`
- [ ] À la lecture, les strings JSON sont parsées avec `JSON.parse()`
- [ ] La normalisation string→array dans le modèle est du **dead code** — la validation middleware (`isArray`) garantit que seuls des tableaux arrivent jusqu'au modèle
- [ ] Le parsing est protégé par try/catch (fallback sur tableau vide)
- [ ] L'UPDATE gère aussi la sérialisation JSON pour les champs modifiés
- [ ] La réponse API retourne des tableaux, pas des strings
- [ ] Le frontend reçoit des tableaux et peut itérer dessus avec `.forEach()` ou `.map()`
