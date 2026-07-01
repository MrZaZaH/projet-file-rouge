# Filtres dynamiques des recettes

## Contexte

La homepage affiche des recettes avec 3 personnages BD (Salarié crevé, Étudiant fauché, Parent épuisé). Il faut aussi pouvoir filtrer par catégorie, temps, budget, note, et paginer les résultats.

---

## Pourquoi une construction dynamique de la requête ?

### Le problème

Une requête SQL fixe ne peut pas couvrir toutes les combinaisons de filtres. Il faudrait soit :
- Faire une requête avec tous les WHERE possibles (certains inutiles)
- Avoir une requête différente par combinaison de filtres

### Ce qui est fait

`src/models/Recipe.js:449-549` — construction de la clause WHERE par concaténation conditionnelle :

```javascript
let query = `SELECT r.* FROM recipes r WHERE r.deleted_at IS NULL`;
const params = [];

if (filters.category_id) {
    query += ' AND r.category_id = ?';
    params.push(filters.category_id);
}
if (filters.max_prep_time) {
    query += ' AND r.prep_time <= ?';
    params.push(filters.max_prep_time);
}
// ... etc
```

**Risque de l'inverse (tous les WHERE d'un coup) :** si `category_id` est null, le filtre est inactif mais `WHERE r.category_id = NULL` (avec `=`, pas `IS NULL`) retourne zéro résultats sans erreur. Le débogage est infect.

### Risque sécurité de la concaténation

On concatène la **structure** de la requête (clauses WHERE), jamais les **valeurs**. Les valeurs sont bindées via `params.push(...)` et le `?` du placeholder. C'est la seule manière SQL-injection-safe de faire du SQL dynamique.

### En version 2

- Utiliser une requête préparée avec COALESCE pour les filtres optionnels (ex: `AND (r.category_id = COALESCE(?, r.category_id))`)
- Ajouter un filtre full-text search (MVP écarté)
- Index composite sur `(status, deleted_at, created_at)` pour optimiser les requêtes fréquentes

---

## Pourquoi un tri adaptatif selon le filtre ?

### Le problème

Quand un utilisateur filtre par temps de préparation, il veut les recettes les plus rapides en premier. Quand il filtre par note, il veut les mieux notées. Un seul ordre de tri ne convient pas à tous.

### Ce qui est fait

`src/models/Recipe.js:527-537` — priorité first-match :

```javascript
if (filters.max_prep_time) {
    sortClause = SORT.BY_TIME;        // prep_time ASC — salarié crevé
} else if (maxCost !== undefined) {
    sortClause = SORT.BY_COST;        // cost_per_portion ASC — étudiant fauché
} else if (filters.min_rating) {
    sortClause = SORT.BY_RATING;      // average_rating DESC — parent épuisé
} else {
    sortClause = SORT.BY_DATE;        // created_at DESC — homepage
}
```

**Risque de l'inverse (tri unique) :** un étudiant fauché qui filtre par budget voit des recettes à 2€ mais triées par date, pas par prix. Il doit scroller pour trouver la moins chère.

### Limitation connue

Si un utilisateur active deux filtres (ex: temps ≤ 15min ET note ≥ 4), le tri priorise le temps. La note passe au second plan. Solution idéale : un score pondéré, mais overkill pour le MVP.

### En version 2

- Permettre à l'utilisateur de choisir son ordre de tri dans l'UI
- Ajouter un score de pertinence pondéré : `ORDER BY (prep_time_score * 0.7 + rating_score * 0.3) DESC`

---

## Pourquoi les constantes de filtres dans un fichier séparé ?

### Ce qui est fait

`src/constants/filters.js` centralise TOUS les magic numbers :

```javascript
const FILTERS = {
    QUICK_PREP_MAX: 15,     // minutes
    BUDGET_LOW_MAX: 3,      // euros
    BUDGET_MID_MAX: 5,
    DEFAULT_LIMIT: 50,
    MAX_LIMIT: 100,
};

const SORT = {
    BY_DATE: 'created_at DESC',
    BY_TIME: 'prep_time ASC',
    BY_COST: 'cost_per_portion ASC',
    BY_RATING: 'average_rating DESC',
};
```

**Risque de l'inverse (hardcodés dans le modèle) :** changer 15 minutes en 20 minutes force à chercher dans tout le fichier Recipe.js. Un jour on en oublie un et les seuils sont inconsistants.

### En version 2

- Rendre les seuils configurables via variables d'environnement (ex: `QUICK_PREP_MAX=20`)
- Ajouter des tests qui vérifient que les constantes sont cohérentes avec les specs
