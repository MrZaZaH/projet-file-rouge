# #19 — Pagination et Tri Conditionnel

## 1. CE QUE ÇA FAIT (vue d'ensemble)

Quand la page d'accueil affiche les recettes, on ne peut pas toutes les renvoyer d'un coup (imaginons 10 000 recettes). La pagination découpe les résultats en "pages" : on envoie 50 recettes à la fois (par défaut) avec un `LIMIT 50 OFFSET 0` pour la première page, `LIMIT 50 OFFSET 50` pour la deuxième, etc. Le tri conditionnel adapte l'ordre d'affichage selon le filtre actif : quand l'utilisateur filtre par temps de préparation, les recettes les plus rapides arrivent en premier ; quand il filtre par budget, les moins chères arrivent en premier. C'est une logique "first match wins" : un seul critère de tri à la fois, pas de score pondéré complexe.

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
    DEFAULT_LIMIT: 50,    // rows par page (page par défaut)
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

### 3.1 — Pagination avec plafond (src/models/Recipe.js:548)

```javascript
// Dans findAllWithFilters()
// limit : nombre de résultats par page
// offset : combien de résultats on saute (pour la pagination)

const rawLimit = parseInt(filters.limit, 10);
const limit = (!isNaN(rawLimit) && rawLimit > 0)
    ? Math.min(rawLimit, FILTERS.MAX_LIMIT)   // cap à 100 max
    : FILTERS.DEFAULT_LIMIT;                  // défaut 50

const offset = parseInt(filters.offset, 10) || 0;

// Math.min() fait office de filet de sécurité :
// si le client demande limit=10000, on le réduit à 100
// Pourquoi ? Empêcher un appel malveillant ou une erreur
// de surcharger la BDD avec 10 000 lignes d'un coup

query += ' LIMIT ? OFFSET ?';
params.push(limit, offset);
// Les valeurs sont injectées via paramètres, pas concaténées
```

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

### 3.3 — Requête complète avec pagination et tri (src/models/Recipe.js:449)

```javascript
static async findAllWithFilters(filters = {}) {
    try {
        // Base query : toujours exclure les soft-deleted
        let query = `
            SELECT r.*
            FROM recipes r
            WHERE r.deleted_at IS NULL
        `;
        const params = [];

        // Construction dynamique du WHERE
        if (filters.category_id) {
            query += ' AND r.category_id = ?';
            params.push(filters.category_id);
        }

        if (filters.max_prep_time) {
            query += ' AND r.prep_time <= ?';
            params.push(filters.max_prep_time);
        }

        const maxCost = filters.max_cost !== undefined
            ? filters.max_cost
            : filters.max_cost_per_portion;

        if (maxCost !== undefined) {
            query += ' AND r.cost_per_portion <= ?';
            params.push(maxCost);
        }

        if (filters.min_rating) {
            query += ' AND r.average_rating >= ?';
            params.push(filters.min_rating);
        }

        // Tri conditionnel (voir section 3.2)
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
        query += ` ORDER BY r.${sortClause}`;

        // Pagination avec cap
        const rawLimit = parseInt(filters.limit, 10);
        const limit = (!isNaN(rawLimit) && rawLimit > 0)
            ? Math.min(rawLimit, FILTERS.MAX_LIMIT)
            : FILTERS.DEFAULT_LIMIT;

        const offset = parseInt(filters.offset, 10) || 0;

        query += ' LIMIT ? OFFSET ?';
        params.push(limit, offset);

        // Exécution
        const [rows] = await pool.query(query, params);

        // Parsing des résultats (JSON fields, decimal, etc.)
        const recipes = rows.map((row) => {
            // ... parsing des ingrédients et étapes
            return {
                id: row.id,
                title: row.title,
                prep_time: row.prep_time,
                cost_per_portion: parseFloat(row.cost_per_portion),
                average_rating: parseFloat(row.average_rating),
                // ...
            };
        });

        return recipes;

    } catch (error) {
        logger.error(`Recipe.findAllWithFilters() failed: ${error.message}`);
        throw error;
    }
}
```

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

```
Requête sans filtre (homepage) :

GET /api/v1/recipes
→ filters = {} (vide)
→ WHERE deleted_at IS NULL
→ ORDER BY created_at DESC  (défaut : plus récent)
→ LIMIT 50 OFFSET 0
→ Retourne les 50 recettes les plus récentes

Requête avec filtre "rapide" (Salarié crevé) :

GET /api/v1/recipes?max_prep_time=15
→ filters = { max_prep_time: 15 }
→ WHERE deleted_at IS NULL AND prep_time <= 15
→ ORDER BY prep_time ASC  (le plus rapide en premier)
→ LIMIT 50 OFFSET 0
→ Retourne les 50 recettes les plus rapides (≤15 min)

Requête page 3 avec filtre "économique" :

GET /api/v1/recipes?max_cost=5&limit=20&offset=40
→ filters = { max_cost: 5, limit: 20, offset: 40 }
→ WHERE deleted_at IS NULL AND cost_per_portion <= 5
→ ORDER BY cost_per_portion ASC (moins cher en premier)
→ LIMIT 20 OFFSET 40
→ Saute les 40 premières (pages 1 et 2), prend les 20 suivantes
```

## 5. ANALOGIE

Tu es à la bibliothèque et tu cherches des livres.

**Sans filtre** : Tu prends les 50 nouveaux livres arrivés cette semaine (ORDER BY created_at DESC, LIMIT 50). Les plus récents sont devant.

**Filtre "rapide"** : Tu veux des livres courts (≤ 100 pages). Le bibliothécaire les trie du plus court au plus long (ORDER BY prep_time ASC). Tu prends les 50 premiers.

**Pagination** : La bibliothèque a 300 livres courts. Tu prends les 50 premiers (page 1, OFFSET 0). Pour voir la suite, tu décales de 50 (page 2, OFFSET 50). Encore 50 (page 3, OFFSET 100).

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
    : FILTERS.DEFAULT_LIMIT;                  // défaut 50
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
const allowedSort = ['created_at', 'average_rating', 'rating_count'];
const sortBy = allowedSort.includes(sort_by) ? sort_by : 'created_at';
// On vérifie que la valeur est dans une liste blanche (whitelist)
// Si pas dans la liste → on utilise la valeur par défaut
```

### Piège #3 : OFFSET sans LIMIT

Si tu mets un OFFSET sans LIMIT, MariaDB parcourt toutes les lignes jusqu'à l'offset, ce qui est lent. Le OFFSET n'a de sens qu'avec un LIMIT.

### Piège #4 : OFFSET qui grandit devient lent

`LIMIT 50 OFFSET 100000` force MariaDB à parcourir 100 050 lignes avant d'en retourner 50. Pour des grosses volumétries, il faudrait du "keyset pagination" (WHERE id > last_seen_id), mais hors cadre MVP.

## 7. ET SI ON FAISAIT AUTREMENT ?

### Option A : Pagination par curseur (keyset pagination)

- Comment ça marche : Au lieu de `OFFSET`, on utilise `WHERE id > ?` avec l'ID du dernier élément de la page précédente
- Avantage : Performant quelle que soit la profondeur de page. Pas de ralentissement sur OFFSET 100000.
- Inconvénient : Plus complexe à implémenter. Impossible d'aller à une page arbitraire (page 5 sans passer par les pages 1-4). L'ordre doit être basé sur une colonne unique et indexée.
- Notre cas : LIMIT/OFFSET est le standard pour un MVP. Simple à comprendre, simple à coder. La lenteur de OFFSET n'est un problème qu'à partir de centaines de milliers de lignes.

### Option B : Tri pondéré multi-critères (score personnalisé)

- Comment ça marche : Combiner prep_time, cost, rating en un seul score calculé : `score = (1/prep_time)*0.4 + (1/cost)*0.3 + rating*0.3`
- Avantage : Un utilisateur qui filtre par temps ET budget obtient un classement pertinent pour les deux
- Inconvénient : Complexe à définir (comment pondérer ?), difficile à expliquer au jury, impossible à indexer, calculé pour chaque ligne
- Notre cas : "First match wins" = simple, prévisible, facile à justifier : "quand vous cherchez rapide, on vous montre les plus rapides d'abord. Point."

## 8. CHECKLIST POUR LE JURY

- [ ] `DEFAULT_LIMIT` est à 50, `MAX_LIMIT` est à 100
- [ ] Le `LIMIT` est plafonné avec `Math.min(limit, MAX_LIMIT)`
- [ ] Le `OFFSET` par défaut est 0
- [ ] Le tri par défaut est `created_at DESC` (plus récent d'abord)
- [ ] Le filtre `max_prep_time` trie par `prep_time ASC` (plus rapide d'abord)
- [ ] Le filtre `max_cost` trie par `cost_per_portion ASC` (moins cher d'abord)
- [ ] Le filtre `min_rating` trie par `average_rating DESC` (mieux noté d'abord)
- [ ] Les valeurs de ORDER BY viennent de constantes, pas de l'utilisateur
- [ ] La pagination utilise des paramètres préparés (?, pas de concaténation)
- [ ] Les index correspondent aux colonnes de tri utilisées
