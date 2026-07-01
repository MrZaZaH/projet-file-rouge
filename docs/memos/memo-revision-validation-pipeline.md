## Middleware pipeline Express

### En bref

Express exécute les middlewares dans l'ordre où ils sont déclarés dans la route. Chaque middleware peut soit passer au suivant via `next()`, soit interrompre la chaîne en renvoyant une réponse (ex: `res.status(422).json(...)`). Si la validation échoue, le contrôleur n'est jamais atteint, donc toute normalisation faite dans le modèle devient du code mort (dead code) pour ce chemin d'exécution.

### Exemple concret

```js
// Route : l'ordre décide de qui s'exécute
router.post(
  '/',
  authenticate,              // 1. Vérifie le token JWT
  recipeBodyRules(),         // 2. Définit les règles de validation
  validate,                  // 3. Exécute la validation → 422 si échec
  recipeController.create    // 4. Jamais atteint si validate a répondu 422
);

// validate retourne une réponse sans next() en cas d'erreur :
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, error: 'Validation failed', errors: errors.array() });
    // next() n'est PAS appelé → le controller ne tourne jamais
  }
  next();
};

// Dans le modèle : cette normalisation est dead-code si la route valide avant
static async create(data) {
  if (typeof data.ingredients === 'string') {
    data.ingredients = data.ingredients.split(','); // jamais exécuté si validation passée
  }
}
```

### À retenir

- L'ordre des middlewares dans la route est l'ordre d'exécution
- `res.status(...).json(...)` sans `next()` stoppe la chaîne
- Si validate passe, les données sont déjà valides → normalisation dans le model = redondante
- Diagramme : authenticate → rules → validate (422 si fail) → controller → model
- La normalisation dans le model n'est utile que si la route n'a pas de middleware validate

## JSON.stringify + isArray

### En bref

`JSON.stringify(["a","b"])` produit la chaîne `'["a","b"]'`. Si cette chaîne est envoyée au serveur dans un champ censé être un tableau, `express-validator` avec `isArray()` va la rejeter car c'est une string, pas un array. Le modèle peut gérer une chaîne séparée par des virgules (`"a,b"`) mais pas du JSON stringifié. La solution est d'envoyer un vrai tableau JavaScript depuis le frontend, sans passer par `JSON.stringify`.

### Exemple concret

```js
// ❌ Frontend buggé
fetch('/api/v1/recipes', {
  method: 'POST',
  body: JSON.stringify({
    ingredients: JSON.stringify(['farine', 'œufs']),  // → '["farine","œufs"]' (string)
    steps: JSON.stringify(['mélanger', 'cuire'])       // → '["mélanger","cuire"]' (string)
  })
});
// → validate : isArray() reçoit une string → 422

// ✅ Frontend corrigé
fetch('/api/v1/recipes', {
  method: 'POST',
  body: JSON.stringify({
    ingredients: ['farine', 'œufs'],  // → tableau natif, JSON.stringify gère
    steps: ['mélanger', 'cuire']      // → tableau natif
  })
});
// → validate : isArray() reçoit un vrai array → OK
```

### À retenir

- `JSON.stringify(tableau)` → string, pas array. `JSON.stringify({x: tableau})` → garde le type array
- `isArray()` de express-validator rejette les strings, même si elles ressemblent à du JSON
- `"a,b"` (séparé par virgules) et `'["a","b"]'` (JSON stringifié) sont deux formats différents
- La normalisation dans le model prévoit le split par virgule mais pas le JSON.parse
- Solution : ne pas appeler JSON.stringify sur les champs tableau dans le frontend
