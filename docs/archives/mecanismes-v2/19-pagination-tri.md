# #19 — Pagination et Tri Conditionnel

## 1. CE QUE ÇA FAIT (vue d'ensemble)

Quand la page d'accueil affiche les recettes, on ne peut pas toutes les renvoyer d'un coup (imaginons 300 recettes). La pagination découpe les résultats en "pages" : on envoie 12 recettes à la fois (par défaut) avec un `LIMIT 12 OFFSET 0` pour la première page, `LIMIT 12 OFFSET 12` pour la deuxième, etc. Pour que le frontend sache combien de pages existent, on exécute **deux** requêtes SQL : un `SELECT COUNT(*)` avec les mêmes filtres pour connaître le total, puis le `SELECT` paginé pour les données. La réponse inclut un objet `pagination` avec `total`, `page`, `limit`, `totalPages`, `hasMore`. Le tri conditionnel adapte l'ordre d'affichage selon le filtre actif : quand l'utilisateur filtre par temps de préparation, les recettes les plus rapides arrivent en premier ; quand il filtre par budget, les moins chères arrivent en premier.

Côté frontend, une `<nav class="pagination">` affiche des boutons de page (précédent/suivant + numéros avec ellipses). Le changement de page déclenche un nouvel appel API avec `limit` et `offset` mis à jour. Changer de personnage réinitialise la page à 1.

## 2. SCHÉMA DE LA TABLE

```sql
-- La pagination utilise LIMIT et OFFSET sur recipes
-- Les index suivants optimisent les tris (06_indexes.sql)

CREATE INDEX idx_recipes_prep_time ON recipes (prep_time)
-- Optimise ORDER BY prep_time ASC (tri par rapidité)

CREATE INDEX idx_recipes_cost ON recipes (cost_per_portion)
-- Optimise ORDER BY cost_per_portion ASC (tri par économie)

CREATE INDEX idx_recipes_rating ON recipes (average_rating DESC)
-- Optimise ORDER BY average_rating DESC (tri par note)

CREATE INDEX idx_recipes_created_at ON recipes (created_at DESC)
-- Optimise ORDER BY created_at DESC (tri par date)
```

Les constantes de filtrage sont centralisées :

```javascript
// src/constants/filters.js:24
const FILTERS = {
    QUICK_PREP_MAX: 15,   // minutes — US-01 : "Prêt en moins de 15 minutes"
    BUDGET_LOW_MAX: 3,    // euros  — US-03 : moins de 3€ par portion
    BUDGET_MID_MAX: 5,    // euros  — US-03 : moins de 5€ par portion
    DEFAULT_LIMIT: 12,    // rows par page — grille responsive 3-4 colonnes × 3-4 lignes
    MAX_LIMIT: 100,       // cap dur — empêche un client de demander 10 000 lignes
};

// Stratégies de tri (src/constants/filters.js:33)
const SORT = {
    BY_DATE: 'created_at DESC',           // défaut : plus récent d'abord
    BY_TIME: 'prep_time ASC',             // temps de prep : plus rapide d'abord
    BY_COST: 'cost_per_portion ASC',      // coût : moins cher d'abord
    BY_RATING: 'average_rating DESC',     // note : mieux noté d'abord
};
```

## 3. LE CODE

### 3.1 — Pagination avec plafond + COUNT (src/models/Recipe.js:449)

```javascript
// Dans findAllWithFilters()
// On construit d'abord les conditions WHERE (partagées entre COUNT et SELECT)
// Puis on exécute deux requêtes :
//   1. COUNT(*) pour connaître le total de résultats
//   2. SELECT avec LIMIT/OFFSET pour les données de la page

// Construction du WHERE : chaque bloc n'ajoute une condition que si le
// filtre correspondant est présent
let whereClause = 'WHERE r.deleted_at IS NULL';
const params = [];

if (filters.category_id) {
    whereClause += ' AND r.category_id = ?';
    params.push(filters.category_id);
}
// ... idem pour max_prep_time, max_cost, min_rating, status

// ============================================
// 1. REQUÊTE DE COMPTAGE
// ============================================
// Mêmes WHERE, mêmes paramètres, mais sans ORDER BY/LIMIT/OFFSET
// Cela donne le nombre TOTAL de recettes correspondant aux filtres
const countQuery = `SELECT COUNT(*) as total FROM recipes r ${whereClause}`;
const [[{ total }]] = await pool.query(countQuery, params);

// ============================================
// 2. Calcul du LIMIT/OFFSET avec cap
// ============================================
const rawLimit = parseInt(filters.limit, 10);
const limit = (!isNaN(rawLimit) && rawLimit > 0)
    ? Math.min(rawLimit, FILTERS.MAX_LIMIT)   // cap à 100 max
    : FILTERS.DEFAULT_LIMIT;                  // défaut 12

const offset = parseInt(filters.offset, 10) || 0;

// ============================================
// 3. REQUÊTE DE DONNÉES
// ============================================
// On réinjecte les mêmes WHERE, on ajoute ORDER BY + LIMIT/OFFSET
const dataQuery = `
    SELECT r.*
    FROM recipes r
    ${whereClause}
    ORDER BY r.${sortClause}
    LIMIT ? OFFSET ?
`;

const [rows] = await pool.query(dataQuery, [...params, limit, offset]);

// Parsing et mapping des résultats...
return { recipes, total, limit };
// On retourne un OBJET (pas un tableau) contenant :
// - recipes : les recettes de la page courante
// - total   : le nombre TOTAL de résultats (utilisé par le frontend)
// - limit   : le LIMIT réellement appliqué (utile pour le calcul de page)
```

Pourquoi deux requêtes au lieu d'une ? Parce que `SELECT COUNT(*)` et `SELECT ... LIMIT/OFFSET` sont deux choses différentes : l'une donne le total, l'autre donne une page. MariaDB ne peut pas retourner les deux dans une seule requête. Le coût est négligeable car le `COUNT(*)` utilise les index (pas de scan de données).

### 3.2 — Tri conditionnel (src/models/Recipe.js:527)

```javascript
// La logique : premier filtre trouvé → tri correspondant
// C'est un système à priorité unique, pas une addition de critères

let sortClause;

if (filters.max_prep_time) {
    // Si l'utilisateur filtre par temps de préparation
    // → trier par temps de préparation croissant (le plus rapide en premier)
    sortClause = SORT.BY_TIME;      // 'prep_time ASC'

} else if (maxCost !== undefined) {
    // Si l'utilisateur filtre par coût
    // → trier par coût croissant (le moins cher en premier)
    sortClause = SORT.BY_COST;      // 'cost_per_portion ASC'

} else if (filters.min_rating) {
    // Si l'utilisateur filtre par note minimale
    // → trier par note décroissante (le mieux noté en premier)
    sortClause = SORT.BY_RATING;    // 'average_rating DESC'

} else {
    // Aucun filtre actif
    // → trier par date de création décroissante (le plus récent en premier)
    sortClause = SORT.BY_DATE;      // 'created_at DESC'
}

query += ` ORDER BY r.${sortClause}`;
// Note : sortClause vient de nos constantes (pas de l'utilisateur)
// Donc pas de risque d'injection SQL ici
```

### 3.3 — Requête complète avec COUNT + pagination (src/models/Recipe.js:449)

```javascript
static async findAllWithFilters(filters = {}) {
    try {
        // === CONSTRUCTION DES CONDITIONS WHERE ===
        // Partagées entre la requête de comptage et la requête de données
        let whereClause = 'WHERE r.deleted_at IS NULL';
        const params = [];

        if (filters.category_id) {
            whereClause += ' AND r.category_id = ?';
            params.push(filters.category_id);
        }
        if (filters.max_prep_time) {
            whereClause += ' AND r.prep_time <= ?';
            params.push(filters.max_prep_time);
        }
        const maxCost = filters.max_cost !== undefined
            ? filters.max_cost
            : filters.max_cost_per_portion;
        if (maxCost !== undefined) {
            whereClause += ' AND r.cost_per_portion <= ?';
            params.push(maxCost);
        }
        if (filters.min_rating) {
            whereClause += ' AND r.average_rating >= ?';
            params.push(filters.min_rating);
        }
        if (filters.status) {
            whereClause += ' AND r.status = ?';
            params.push(filters.status);
        }

        // === REQUÊTE DE COMPTAGE ===
        // Mêmes WHERE, mêmes paramètres → total exact
        const countQuery = `SELECT COUNT(*) as total FROM recipes r ${whereClause}`;
        const [[{ total }]] = await pool.query(countQuery, params);

        // === TRI CONDITIONNEL ===
        let sortClause;
        if (filters.max_prep_time) {
            sortClause = SORT.BY_TIME;
        } else if (maxCost !== undefined) {
            sortClause = SORT.BY_COST;
        } else if (filters.min_rating) {
            sortClause = SORT.BY_RATING;
        } else {
            sortClause = SORT.BY_DATE;
        }

        // === PAGINATION AVEC CAP ===
        const rawLimit = parseInt(filters.limit, 10);
        const limit = (!isNaN(rawLimit) && rawLimit > 0)
            ? Math.min(rawLimit, FILTERS.MAX_LIMIT)
            : FILTERS.DEFAULT_LIMIT;   // 12 par défaut

        const offset = parseInt(filters.offset, 10) || 0;

        // === REQUÊTE DE DONNÉES ===
        const dataQuery = `
            SELECT r.*
            FROM recipes r
            ${whereClause}
            ORDER BY r.${sortClause}
            LIMIT ? OFFSET ?
        `;
        const [rows] = await pool.query(dataQuery, [...params, limit, offset]);

        // === MAPPING ===
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
                prep_time: row.prep_time,
                cost_per_portion: parseFloat(row.cost_per_portion),
                average_rating: parseFloat(row.average_rating),
                rating_count: row.rating_count,
                // ... autres champs
            };
        });

        return { recipes, total, limit };
        // recipes = tableau des recettes de la page courante
        // total   = nombre TOTAL de résultats (pour calculer les pages)
        // limit   = valeur réellement appliquée (après cap)

    } catch (error) {
        logger.error(`Recipe.findAllWithFilters() failed: ${error.message}`);
        throw error;
    }
}
```

### 3.4 — Envoi de la réponse paginée (src/controllers/RecipeController.js:22)

```javascript
// GET /api/v1/recipes — avec filtres + pagination
async function getAllRecipes(req, res, next) {
    try {
        const isAdmin = req.user?.role === 'admin';

        const filters = {
            status: isAdmin ? req.query.status : 'published',
            category_id: req.query.category_id ? Number(req.query.category_id) : null,
            max_prep_time: req.query.max_prep_time ? Number(req.query.max_prep_time) : null,
            max_cost: req.query.max_cost ? Number(req.query.max_cost) : null,
            min_rating: req.query.min_rating ? Number(req.query.min_rating) : null,
            limit: req.query.limit ? Number(req.query.limit) : null,
            offset: req.query.offset ? Number(req.query.offset) : null,
        };

        const cleanFilters = Object.fromEntries(
            Object.entries(filters).filter(([, v]) => v !== null)
        );

        const { recipes, total, limit } = await Recipe.findAllWithFilters(cleanFilters);

        // Calcul des métadonnées de pagination
        const offset = parseInt(req.query.offset, 10) || 0;
        const page = Math.floor(offset / limit) + 1;
        const totalPages = Math.ceil(total / limit);
        const hasMore = offset + limit < total;

        // sendPaginated ajoute l'objet pagination à la réponse
        return sendPaginated(res, recipes, { total, page, limit, totalPages, hasMore });

    } catch (err) {
        next(err);
    }
}
```

Le helper `sendPaginated` dans `src/utils/apiResponse.js` :

```javascript
const sendPaginated = (res, data, pagination, statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        data,          // tableau des recettes de la page
        pagination     // métadonnées
    });
};
```

Format de réponse :

```json
{
    "success": true,
    "data": [ { "id": 1, "title": "..." }, ... ],
    "pagination": {
        "total": 237,       // nombre TOTAL de recettes correspondant aux filtres
        "page": 1,          // page courante (calculée depuis offset/limit)
        "limit": 12,        // éléments par page
        "totalPages": 20,   // nombre total de pages
        "hasMore": true     // y a-t-il une page suivante ?
    }
}
```

### 3.5 — Frontend : construction de l'URL paginée (frontend/public/js/home.js)

```javascript
// ====== STATE ======
let currentPersona = null;
let currentPage = 1;
let totalPages = 0;
let totalRecipes = 0;
const RECIPES_PER_PAGE = 12;   // Doit correspondre à FILTERS.DEFAULT_LIMIT

// Construction de l'URL avec offset calculé depuis la page
function buildApiUrl(persona, page) {
    const base = '/api/v1/recipes';
    const params = new URLSearchParams();
    params.set('limit', RECIPES_PER_PAGE);
    params.set('offset', (page - 1) * RECIPES_PER_PAGE);

    if (persona) {
        const filter = getPersonaFilter(persona);
        if (filter) {
            Object.keys(filter).forEach(function(key) {
                params.set(key, filter[key]);
            });
        }
    }

    return base + '?' + params.toString();
}
```

### 3.6 — Frontend : rendu de la barre de pagination

```javascript
function renderPagination() {
    // Pas de pagination si une seule page ou aucune recette
    if (totalPages <= 1) {
        paginationEl.style.display = 'none';
        return;
    }

    paginationEl.style.display = 'flex';
    paginationPrev.disabled = currentPage <= 1;
    paginationNext.disabled = currentPage >= totalPages;
    paginationInfo.textContent = 'Page ' + currentPage + ' / ' + totalPages;

    // Génération des boutons de page avec ellipses
    paginationPages.innerHTML = '';
    var start = Math.max(1, currentPage - 2);
    var end = Math.min(totalPages, currentPage + 2);

    // Premier bouton + ellipses si nécessaire
    if (start > 1) {
        var first = document.createElement('button');
        first.textContent = '1';
        first.addEventListener('click', function() { goToPage(1); });
        paginationPages.appendChild(first);
        if (start > 2) {
            var dots = document.createElement('span');
            dots.textContent = '…';
            dots.className = 'page-info';
            paginationPages.appendChild(dots);
        }
    }

    // Boutons de la plage visible (5 pages max autour de la page courante)
    for (var i = start; i <= end; i++) {
        var btn = document.createElement('button');
        btn.textContent = i;
        if (i === currentPage) btn.className = 'active';
        btn.addEventListener('click', (function(p) {
            return function() { goToPage(p); };
        })(i));
        paginationPages.appendChild(btn);
    }

    // Dernier bouton + ellipses si nécessaire
    if (end < totalPages) {
        if (end < totalPages - 1) {
            var dots2 = document.createElement('span');
            dots2.textContent = '…';
            dots2.className = 'page-info';
            paginationPages.appendChild(dots2);
        }
        var last = document.createElement('button');
        last.textContent = totalPages;
        last.addEventListener('click', function() { goToPage(totalPages); });
        paginationPages.appendChild(last);
    }
}
```

### 3.7 — Route : validation des paramètres de pagination

```javascript
// src/routes/recipeRoutes.js
router.get(
    '/',
    [
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limit must be between 1 and 100'),
        query('offset')
            .optional()
            .isInt({ min: 0 })
            .withMessage('Offset must be a positive integer'),
        query('category_id')
            .optional()
            .isInt({ min: 1 }),
        query('max_prep_time')
            .optional()
            .isInt({ min: 1 }),
        query('max_cost')
            .optional()
            .isFloat({ min: 0 }),
        query('min_rating')
            .optional()
            .isFloat({ min: 0, max: 5 }),
    ],
    validate,
    RecipeController.getAllRecipes
);
```

### 3.8 — Admin : pagination sur les logs et recettes (src/controllers/AdminController.js)

Même pattern que les recettes publiques : séparation COUNT + SELECT, retour avec `sendPaginated` :

```javascript
// AdminController.getAllRecipes()
const countQuery = `SELECT COUNT(*) as total FROM recipes r ${whereClause}`;
const [[{ total }]] = await pool.query(countQuery, params);

// ... data query avec LIMIT/OFFSET ...

const page = Math.floor(parsedOffset / parsedLimit) + 1;
const totalPages = Math.ceil(total / parsedLimit);
const hasMore = parsedOffset + parsedLimit < total;

return sendPaginated(res, recipes, { total, page, limit: parsedLimit, totalPages, hasMore });
```

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

```
Requête sans filtre (homepage), page 1 :

GET /api/v1/recipes
→ filters = {} (vide)
→ 1. COUNT(*) WHERE deleted_at IS NULL → total = 237
→ 2. ORDER BY created_at DESC LIMIT 12 OFFSET 0
→ Réponse : { data: [...12 recettes...], pagination: { total: 237, page: 1, limit: 12, totalPages: 20, hasMore: true } }

Requête sans filtre, page 3 :

GET /api/v1/recipes?limit=12&offset=24
→ offset = 24, soit page 3 (24 / 12 + 1)
→ 1. COUNT(*) → total = 237
→ 2. ORDER BY created_at DESC LIMIT 12 OFFSET 24
→ Réponse : pagination: { page: 3, totalPages: 20, hasMore: true }

Requête avec filtre "rapide" (Salarié crevé) :

GET /api/v1/recipes?max_prep_time=15&limit=12&offset=0
→ WHERE deleted_at IS NULL AND prep_time <= 15
→ ORDER BY prep_time ASC
→ 1. COUNT(*) → total = 42 (seulement 42 recettes ≤ 15 min)
→ 2. LIMIT 12 OFFSET 0
→ Réponse : data: [...12 recettes...], pagination: { total: 42, page: 1, limit: 12, totalPages: 4, hasMore: true }

Changement de personnage :
→ currentPage = 1 (reset)
→ Nouvel appel API avec les nouveaux filtres ET limit=12&offset=0

Navigation vers une page :
→ currentPage = 5
→ offset = (5 - 1) * 12 = 48
→ Nouvel appel API avec limit=12&offset=48

Affichage du compteur :
→ "237 recettes trouvées" (utilise pagination.total, PAS data.length)
```

## 5. ANALOGIE

Tu es à la bibliothèque et tu cherches des livres.

**Sans filtre** : Tu prends les 12 nouveaux livres arrivés cette semaine (ORDER BY created_at DESC, LIMIT 12). Les plus récents sont devant.

**Avec comptage** : Avant de prendre les livres, tu demandes au bibliothécaire "combien de nouveaux livres cette semaine ?" (COUNT). Il te répond "237". Maintenant tu sais qu'il y a 20 pages de 12 livres.

**Filtre "rapide"** : Tu veux des livres courts (≤ 100 pages). Le bibliothécaire les trie du plus court au plus long (ORDER BY prep_time ASC). Il te dit "j'ai 42 livres courts" (COUNT). Tu prends les 12 premiers.

**Pagination** : Tu vois les pages en bas : « ← Précédent  1  2  3  ...  20  Suivant → ». Tu cliques sur 3, offset devient 24, tu reçois les 12 livres suivants. Le bibliothécaire ne te re-compte pas les livres à chaque fois — mais nous on le fait quand même parce que le total peut changer si quelqu'un ajoute/supprime un livre entre-temps.

**Cap** : Même si tu demandes "donne-moi 10 000 livres d'un coup", le bibliothécaire te limite à 100 (Math.min). Pourquoi ? Parce que porter 10 000 livres te casserait le dos — et ça saturerait le réseau.

## 6. PIÈGES CLASSIQUES

### Piège #1 : Pas de plafond sur le LIMIT

Si tu ne limites pas le `LIMIT`, un client peut demander `LIMIT 9999999` et faire ramer la BDD.

**MAUVAIS :**
```javascript
const limit = parseInt(filters.limit, 10) || 50;
// Un client malveillant peut mettre limit=999999
```

**BON :**
```javascript
const limit = (!isNaN(rawLimit) && rawLimit > 0)
    ? Math.min(rawLimit, FILTERS.MAX_LIMIT)  // cap à 100
    : FILTERS.DEFAULT_LIMIT;                  // défaut 12
```

### Piège #2 : Injection SQL via ORDER BY

Si tu acceptes le nom de colonne depuis l'utilisateur sans le valider, il peut injecter du SQL.

**MAUVAIS :**
```javascript
query += ` ORDER BY r.${filters.sort_by}`;
// L'utilisateur peut mettre "id; DROP TABLE recipes"
```

**BON :**
```javascript
query += ` ORDER BY r.${sortClause}`;
// sortClause vient de SORT.BY_xxx, pas de l'utilisateur
// Liste blanche (whitelist) dans les constantes
```

### Piège #3 : Retourner `data.length` comme total (BUG CRITIQUE)

**MAUVAIS :**
```javascript
res.json({ success: true, count: recipes.length, data: recipes });
// count = 12 (le nombre de RECETTES DE LA PAGE, PAS le total)
// Le frontend ne peut pas calculer le nombre de pages
```

**BON :**
```javascript
// On exécute un COUNT(*) séparé AVANT la requête de données
// La réponse contient le vrai total
```

### Piège #4 : Oublier le reset de page au changement de filtre

Si l'utilisateur est page 5, filtre "Salarié crevé", et que ce filtre ne retourne que 2 pages, la page 5 n'existe plus. Le frontend doit réinitialiser `currentPage = 1` à chaque changement de filtre.

### Piège #5 : OFFSET sans LIMIT

Si tu mets un OFFSET sans LIMIT, MariaDB parcourt toutes les lignes jusqu'à l'offset, ce qui est lent. Le OFFSET n'a de sens qu'avec un LIMIT.

### Piège #6 : OFFSET qui grandit devient lent

`LIMIT 12 OFFSET 100000` force MariaDB à parcourir 100 012 lignes avant d'en retourner 12. Pour des grosses volumétries, il faudrait du "keyset pagination" (WHERE id > last_seen_id), mais hors cadre MVP.

## 7. ET SI ON FAISAIT AUTREMENT ?

### Option A : Pagination par curseur (keyset pagination)

- Comment ça marche : Au lieu de `OFFSET`, on utilise `WHERE id > ?` avec l'ID du dernier élément de la page précédente
- Avantage : Performant quelle que soit la profondeur de page. Pas de ralentissement sur OFFSET 100000.
- Inconvénient : Plus complexe à implémenter. Impossible d'aller à une page arbitraire (page 5 sans passer par les pages 1-4). L'ordre doit être basé sur une colonne unique et indexée. Impossible avec un tri dynamique (le tri change selon le filtre).
- Notre cas : LIMIT/OFFSET est le standard pour un MVP. Simple à comprendre, simple à coder. La lenteur de OFFSET n'est un problème qu'à partir de centaines de milliers de lignes. Et notre tri dynamique change la colonne ORDER BY, ce qui rend le keyset pagination impossible.

### Option B : Tri pondéré multi-critères (score personnalisé)

- Comment ça marche : Combiner prep_time, cost, rating en un seul score calculé : `score = (1/prep_time)*0.4 + (1/cost)*0.3 + rating*0.3`
- Avantage : Un utilisateur qui filtre par temps ET budget obtient un classement pertinent pour les deux
- Inconvénient : Complexe à définir (comment pondérer ?), difficile à expliquer au jury, impossible à indexer, calculé pour chaque ligne
- Notre cas : "First match wins" = simple, prévisible, facile à justifier : "quand vous cherchez rapide, on vous montre les plus rapides d'abord. Point."

### Option C : Renvoyer toutes les pages d'un coup (pas de pagination)

- Comment ça marche : Remplacer `LIMIT/OFFSET` par une seule requête qui renvoie toutes les recettes. Le frontend gère l'affichage (scroll).
- Avantage : Simple côté backend, pas de re-fetch au changement de page.
- Inconvénient : Si 300 recettes, le navigateur télécharge 300 objets JSON + les images. Temps de chargement initial long. Pas de compteur de pages.
- Notre cas : La pagination est obligatoire. Renvoyer 12 recettes par page = requête rapide, affichage immédiat, navigation fluide.

## 8. CHECKLIST POUR LE JURY

- [ ] `DEFAULT_LIMIT` est à **12** (pas 50), `MAX_LIMIT` est à 100
- [ ] `findAllWithFilters()` exécute une requête `COUNT(*)` séparée pour connaître le total
- [ ] La méthode retourne `{ recipes, total, limit }` — pas seulement le tableau
- [ ] Le `LIMIT` est plafonné avec `Math.min(limit, MAX_LIMIT)` — pas de risque de surcharge
- [ ] Le `OFFSET` par défaut est 0
- [ ] Le contrôleur calcule `page`, `totalPages`, `hasMore` depuis `offset`, `limit`, `total`
- [ ] La réponse utilise `sendPaginated()` — pas `sendSuccess()` — pour inclure `pagination`
- [ ] Format de réponse : `{ success, data: [...], pagination: { total, page, limit, totalPages, hasMore } }`
- [ ] Le frontend lit `pagination.total` pour afficher "X recettes trouvées" (pas `data.length`)
- [ ] Le frontend reset `currentPage = 1` quand le filtre personnage change
- [ ] Le frontend génère les boutons de navigation avec ellipses si >5 pages
- [ ] Les paramètres `limit` et `offset` sont validés par `express-validator` sur la route `GET /api/v1/recipes`
- [ ] Le tri par défaut est `created_at DESC` (plus récent d'abord)
- [ ] Le filtre `max_prep_time` trie par `prep_time ASC` (plus rapide d'abord)
- [ ] Le filtre `max_cost` trie par `cost_per_portion ASC` (moins cher d'abord)
- [ ] Le filtre `min_rating` trie par `average_rating DESC` (mieux noté d'abord)
- [ ] Les valeurs de ORDER BY viennent de constantes, pas de l'utilisateur
- [ ] Les requêtes utilisent des paramètres préparés (`?`, pas de concaténation)
- [ ] Les index correspondent aux colonnes de tri utilisées
- [ ] `AdminController.getAllRecipes()` et `getLogs()` suivent le même pattern COUNT + pagination
