# Réponses JSON standardisées

## Contexte

Le frontend (vanilla JS) appelle l'API et doit interpréter la réponse. Si chaque route renvoie un format différent, le code frontend devient illisible (vérifier `response.data` ici, `response.result` ailleurs).

---

## Pourquoi un format unique ?

### Option écartée : chaque contrôleur décide

**Ce qui arriverait :**
- `res.json({ recipe: {...} })` sur une route
- `res.json({ data: {...} })` sur une autre
- `res.status(200).json(result.rows[0])` sans wrapper

Le frontend devrait deviner le format route par route — source infinie de bugs.

### Ce qui est fait

Deux helpers dans `src/utils/apiResponse.js` :

```javascript
// Succès
sendSuccess(res, data, message = null, statusCode = 200)
// → { success: true, data, message }

// Erreur
sendError(res, message, statusCode = 500, details = null)
// → { success: false, error: { message, code } }
```

**Risque de l'inverse (pas de helper) :** chaque nouveau contrôleur réinvente le format. Oubli de `success` dans une réponse → le frontend plante sans savoir pourquoi.

### Code error mapping

`src/utils/apiResponse.js:24-35` :

```javascript
const statusCodeToCode = (status) => {
    const codes = {
        400: 'BAD_REQUEST',
        401: 'UNAUTHORIZED',
        403: 'FORBIDDEN',
        404: 'NOT_FOUND',
        409: 'CONFLICT',
        422: 'VALIDATION_ERROR',
        500: 'INTERNAL_ERROR'
    };
    return codes[status] || 'ERROR';
};
```

Avantage : le frontend peut switch sur `error.code` plutôt que de parser le code HTTP :

```javascript
if (result.error.code === 'VALIDATION_ERROR') {
    // Afficher les erreurs de validation
}
```

### En version 2

- Ajouter un champ `meta` pour la pagination : `{ success, data, meta: { total, page, limit } }`
- Normaliser les erreurs de validation avec le détail des champs : `{ field: 'email', message: 'Invalid format' }`
- Versionner le format de réponse (via header `Accept-Version`)
