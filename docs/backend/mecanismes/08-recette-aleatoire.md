# 08 — Recette Aléatoire ("Surprends-moi")

## 1. CE QUE ÇA FAIT (vue d'ensemble)

Le bouton "Surprends-moi" sur la homepage appelle une route API qui retourne une recette publiée au hasard. Côté serveur, MariaDB trie les lignes avec `ORDER BY RAND()` et en prend une seule avec `LIMIT 1`. Côté frontend, la fonction `surpriseMe()` fait un fetch vers `/api/v1/recipes/random` et redirige l'utilisateur vers la page détail de la recette reçue.

## 2. SCHÉMA DE LA TABLE

Même table que les recettes (voir #07). La seule différence est la clause `WHERE r.status = 'published' AND r.deleted_at IS NULL` pour garantir qu'on ne sert que du contenu visible.

## 3. LE CODE

### 3.1 — Recipe.findRandom() (`src/models/Recipe.js:811`)

```javascript
static async findRandom() {
    try {
        const query = `
            SELECT
                r.*,
                u.username  AS user_pseudo,
                u.email     AS user_email,
                c.name      AS category_name
            FROM recipes r
            LEFT JOIN users      u ON r.user_id      = u.id
            LEFT JOIN categories c ON r.category_id  = c.id
            WHERE r.status = 'published' AND r.deleted_at IS NULL
            ORDER BY RAND()
            LIMIT 1
        `;

        const [rows] = await pool.query(query);

        if (rows.length === 0) {
            return null;  // Aucune recette publiée → le controller renverra 404
        }

        const row = rows[0];

        // Parsing JSON (ingredients, steps) avec fallback
        let ingredients = [];
        let steps = [];
        try {
            ingredients = row.ingredients ? JSON.parse(row.ingredients) : [];
            steps = row.steps ? JSON.parse(row.steps) : [];
        } catch (parseError) {
            logger.warn(`Failed to parse JSON fields for random recipe: ${parseError.message}`);
        }

        return {
            id: row.id,
            user_id: row.user_id,
            category_id: row.category_id,
            title: row.title,
            anecdote: row.anecdote,
            ingredients,
            steps,
            prep_time: row.prep_time,
            cost_per_portion: parseFloat(row.cost_per_portion),
            status: row.status,
            average_rating: parseFloat(row.average_rating),
            rating_count: row.rating_count,
            image_url: row.image_url,
            created_at: row.created_at,
            updated_at: row.updated_at,
            username: row.user_pseudo,
            user: {
                username: row.user_pseudo,
                email: row.user_email,
            },
            category: {
                name: row.category_name,
            },
        };

    } catch (error) {
        logger.error(`Recipe.findRandom() failed: ${error.message}`);
        throw error;
    }
}
```

### 3.2 — RecipeController.getRandomRecipe() (`src/controllers/RecipeController.js:55`)

```javascript
async function getRandomRecipe(req, res, next) {
    try {
        const recipe = await Recipe.findRandom();

        if (!recipe) {
            return sendError(res, 'No published recipe found.', 404);
        }

        return sendSuccess(res, recipe);

    } catch (err) {
        next(err);
    }
}
```

### 3.3 — Route Express (`src/routes/recipeRoutes.js:69`)

```javascript
// L'ordre est CRUCIAL : /random DOIT être déclaré AVANT /:id
router.get('/random', RecipeController.getRandomRecipe);
router.get('/:id', attachUser, RecipeController.getRecipeById);
//   ↑      ↑
//   Si /random était APRÈS /:id, Express interpréterait "random" comme un id
//   et appellerait getRecipeById avec req.params.id = "random"
```

### 3.4 — Frontend surpriseMe() (`frontend/public/js/app.js:81`)

```javascript
async function surpriseMe() {
    try {
        const response = await fetch('/api/v1/recipes/random');
        if (response.ok) {
            const result = await response.json();      // { success: true, data: {...} }
            const recipe = result.data || result;       // extraction de l'objet recette
            window.location.href = 'recipe.html?id=' + recipe.id;
            // Redirige vers la page détail avec l'id reçu
        }
    } catch (error) {
        console.error('Surprise failed:', error);
    }
}

// Attaché au bouton dans initShared()
const surpriseBtn = document.getElementById('surprise-btn');
if (surpriseBtn) {
    surpriseBtn.addEventListener('click', surpriseMe);
}
```

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

```
1. Utilisateur clique "Surprends-moi" sur la homepage
2. surpriseMe() → fetch GET /api/v1/recipes/random
3. Express cherche une route qui matche :
   - /random est déclaré AVANT /:id → ça match !
4. Aucun middleware auth (route publique)
5. getRandomRecipe() est appelé
6. Recipe.findRandom() exécute la requête SQL :
   ORDER BY RAND() LIMIT 1
   → MariaDB assigne un nombre aléatoire à chaque ligne, trie, prend la première
7. Si aucune recette publiée → 404
8. Sinon → retourne l'objet recette complet (avec JOIN users + categories)
9. Frontend reçoit la réponse → extrait recipe.id
10. window.location.href = 'recipe.html?id=' + recipe.id
11. La page détail se charge avec ce id → fetch GET /api/v1/recipes/:id
```

## 5. ANALOGIE

C'est comme un **tiroir à fiches de recettes dans une cuisine communautaire**. Tu fermes les yeux, tu plonges la main, tu attrapes une fiche au hasard. Peu importe laquelle — l'aventure culinaire commence. `ORDER BY RAND() LIMIT 1`, c'est MariaDB qui fait "un, deux, trois, soleil" et attrape la première fiche qui reste immobile.

## 6. PIÈGES CLASSIQUES

### Piège #1 : Ordre des routes Express

**MAUVAIS** — `/random` après `/:id` :
```javascript
router.get('/:id', ...);     // "/random" match ici : req.params.id = "random"
router.get('/random', ...);  // JAMAIS ATTEINT
```

**BON** — `/random` avant `/:id` :
```javascript
router.get('/random', ...);  // Express matche d'abord les routes spécifiques
router.get('/:id', ...);     // Puis les routes paramétrées
```

### Piège #2 : Performance de ORDER BY RAND()

`ORDER BY RAND()` est lent sur les grandes tables (MariaDB doit assigner un nombre aléatoire à CHAQUE ligne, puis trier). Pour un MVP avec quelques centaines de recettes, c'est parfaitement acceptable. Pour 100 000+ recettes, il faudrait une approche différente (voir Option A).

## 7. ET SI ON FAISAIT AUTREMENT ?

### Option A : RAND() avec une sous-requête optimisée
- **Comment ça marche** : `SELECT * FROM recipes WHERE id >= (SELECT FLOOR(MAX(id) * RAND()) FROM recipes) LIMIT 1`
- **Avantage** : beaucoup plus rapide sur les grandes tables (pas de tri complet).
- **Inconvénient** : ne fonctionne pas si les id ont des trous (soft delete = trous), peut donner une distribution inégale.
- **Notre cas** : `ORDER BY RAND() LIMIT 1` est simple, lisible, et suffisant pour notre volume.

### Option B : Récupérer le nombre total et en choisir un côté serveur
- **Comment ça marche** : `SELECT COUNT(*)` → générer un offset aléatoire → `SELECT ... LIMIT 1 OFFSET ?`.
- **Avantage** : pas de tri.
- **Inconvénient** : deux requêtes au lieu d'une, complexité inutile.
- **Notre cas** : `ORDER BY RAND()` est plus simple et idiomatique.

## 8. CHECKLIST POUR LE JURY

- [ ] La route `/api/v1/recipes/random` est déclarée AVANT `/api/v1/recipes/:id` dans `recipeRoutes.js:69-71`
- [ ] `findRandom()` filtre exclusivement les recettes `published` ET non supprimées (`deleted_at IS NULL`)
- [ ] La requête SQL utilise `ORDER BY RAND() LIMIT 1`
- [ ] Si aucune recette trouvée, la fonction retourne `null` et le controller renvoie 404
- [ ] Le frontend `surpriseMe()` redirige vers `recipe.html?id=` avec l'id reçu
- [ ] Le bouton "Surprends-moi" a l'id `surprise-btn` dans le HTML et un event listener click
- [ ] Pas de fallback statique côté frontend — on dépend entièrement de l'API
