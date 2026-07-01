# 41 — Fichiers Legacy (Code Mort)

## 1. CE QUE ÇA FAIT (vue d'ensemble)

Quatre fichiers suffixés par `1.js` traînent dans le projet : `AuthController1.js`, `RecipeController1.js`, `CommentController1.js`, `Recipe1.js`. Ce sont les **versions originales** des contrôleurs et du modèle Recipe, remplacées par des versions modernes mais **jamais supprimées**.

Elles ne sont importées **nulle part** dans les routes actives — ce sont des archives, du code mort qui ne s'exécute plus.

## 2. SCHÉMA DE LA TABLE

Pas de table — ce sont des fichiers JavaScript legacy.

Fichiers concernés :
- `src/controllers/AuthController1.js`
- `src/controllers/RecipeController1.js`
- `src/controllers/CommentController1.js`
- `src/models/Recipe1.js`

## 3. LE CODE

### 3.1 — AuthController1.js vs AuthController.js actuel

**Ancien pattern** (`AuthController1.js:76-82`) :
```javascript
return res.status(201).json({
    success: true,
    data: {
        user: newUser,
        token
    }
});
```

**Nouveau pattern** (AuthController.js actuel) — utilise `sendSuccess()` / `sendError()` :
```javascript
return sendSuccess(res, { user: newUser, token }, 'Registration successful', 201);
```

Différences clés :
- `AuthController1` vérifie `validationResult(req)` manuellement dans chaque méthode.
- La version actuelle utilise le middleware express-validator qui centralise la validation.
- `AuthController1` est une classe (`class AuthController { ... }`), l'actuelle exporte des fonctions individuelles.

### 3.2 — RecipeController1.js vs RecipeController.js actuel

**`delete` au lieu de `softDelete`** (`RecipeController1.js:165`) :
```javascript
await Recipe.delete(req.params.id);
res.status(204).send();
```

Version actuelle :
```javascript
await Recipe.softDelete(req.params.id);
return sendSuccess(res, null, 'Recipe deleted');
```

Différences clés :
- `RecipeController1` appelle `Recipe.delete()` (hard delete possible, pas de soft delete garanti).
- L'actuel appelle `Recipe.softDelete()` — cohérent avec la politique de soft delete du projet.
- `RecipeController1` répond avec `res.json({ data: recipe })` sans wrapper `sendSuccess`.
- Pas de `sendError()` — les erreurs sont renvoyées avec `res.status(XXX).json({ message })` directement.

### 3.3 — CommentController1.js vs CommentController.js actuel

**Mêmes différences** (`CommentController1.js:94`) :
```javascript
await Comment.delete(commentId);
return res.status(204).send();
```

**Pas d'`apiResponse`** — les réponses sont brutes :
```javascript
return res.status(200).json({ data: comments });
```

Différences clés :
- `Comment.delete()` au lieu de `Comment.softDelete()`.
- Réponses sans wrapper standardisé.
- Pas de gestion de `sendSuccess`/`sendError`.

### 3.4 — Recipe1.js (`src/models/Recipe1.js:269-278`)

**`delete()` au lieu de `softDelete()`** :
```javascript
static async delete(id) {
    const [result] = await pool.execute(
        `UPDATE recipes
         SET deleted_at = NOW()
         WHERE id = ?
           AND deleted_at IS NULL`,
        [id]
    );
    return result.affectedRows > 0;
}
```

Le code est quasi identique à `softDelete()` actuel, mais le nom `delete` est ambigu — il pourrait suggérer une suppression physique (`DELETE FROM`).

Autres différences :
- `Recipe1.js` utilise `pool.execute()` partout, l'actuel utilise aussi `pool.query()`.
- `Recipe1.js` n'a pas de logger systematique (try/catch sans `logger.error()`).
- `Recipe1.js` n'a pas les helpers `_parseJsonFields` — le parsing est fait manuellement.
- `Recipe1.js` n'a pas de constantes `FILTERS`, `SORT` — les valeurs sont en dur.

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

1. Le projet a été développé en plusieurs itérations.
2. Version 1 : les fichiers `*1.js` ont été créés avec un certain style (classes, pas d'`apiResponse`, méthode `delete()`).
3. Refactoring : les fichiers ont été réécrits avec de meilleures pratiques (fonctions exportées, `sendSuccess/sendError`, `softDelete()`).
4. Les nouveaux fichiers ont été renommés sans le suffixe `1` (ex: `AuthController.js`).
5. Les routes ont été mises à jour pour importer les nouvelles versions.
6. **Personne n'a supprimé les anciens fichiers.**
7. Les fichiers `*1.js` existent toujours mais ne sont importés par **aucun** fichier de route.
8. Ils ne sont jamais exécutés — ce sont des archives.

## 5. ANALOGIE

C'est le tiroir du bureau où tu ranges l'ancien téléphone quand tu en achètes un nouveau. Il marche encore, il est dans le tiroir, mais tu ne t'en sers plus. Si quelqu'un ouvre le tiroir, il peut le voir, mais il ne va pas t'appeler avec. Un jour il faudra le jeter (ou pas, sait-on jamais).

## 6. PIÈGES CLASSIQUES

### Piège #1 : Maintenir les deux versions

Si quelqu'un modifie `Recipe.js` en pensant que `Recipe1.js` est toujours utilisé, les deux fichiers divergent. Plus tard, un développeur (ou le jury) lit `Recipe1.js` et voit du code différent de ce qui est réellement exécuté — confusion garantie.

### Piège #2 : Import involontaire

Si un import de `Recipe1.js` traîne dans un fichier de route ou de test, le code legacy s'exécute sans que personne le sache. Toujours vérifier avec `grep -r "require.*Recipe1" src/` que le fichier n'est plus importé.

### Piège #3 : Fausse sécurité

Un développeur novice pourrait croire que `Recipe1.js` fait partie du projet et l'utiliser comme référence pour ajouter une fonctionnalité, sans se rendre compte que le modèle actuel a évolué.

## 7. ET SI ON FAISAIT AUTREMENT ?

**Option A** : Supprimer les fichiers. C'est propre, pas de confusion possible. On peut toujours les retrouver dans l'historique Git si besoin. C'est ce qu'il faut faire en prod.

**Option B** : Les déplacer dans un dossier `archive/`. Clairement séparés du code actif, mais toujours consultables sans fouiller Git. Bon compromis pour un projet pédagogique.

**Option C** : Les laisser avec un commentaire explicite en haut. Moins propre, mais au moins le message prévient le lecteur que le fichier n'est plus utilisé.

## 8. CHECKLIST POUR LE JURY

- [ ] Les 4 fichiers legacy sont identifiés : `AuthController1.js`, `RecipeController1.js`, `CommentController1.js`, `Recipe1.js`
- [ ] Aucun import de ces fichiers dans les routes actives (vérifiable avec `grep`)
- [ ] Les versions actuelles utilisent `softDelete()` pas `delete()`
- [ ] Les versions actuelles utilisent `sendSuccess()` / `sendError()` depuis `apiResponse`
- [ ] Les versions actuelles exportent des fonctions (pas des classes) pour `RecipeController` et `CommentController`
- [ ] `AuthController` actuel utilise le middleware express-validator (pas `validationResult` manuel)
- [ ] Les fichiers legacy sont soit supprimés, soit archivés, soit clairement marqués comme inactifs
