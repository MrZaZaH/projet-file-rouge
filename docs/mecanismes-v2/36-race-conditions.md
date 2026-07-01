# 36 — Gestion des Race Conditions (ER_DUP_ENTRY)

## 1. CE QUE ÇA FAIT (vue d'ensemble)

Empêche un même utilisateur de créer deux notes pour la même recette, même si ses deux requêtes arrivent exactement au même moment. Le mécanisme combine une contrainte UNIQUE en base de données et une gestion d'erreur dans le contrôleur.

## 2. SCHÉMA DE LA TABLE

```sql
CREATE TABLE IF NOT EXISTS ratings (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    recipe_id       INT UNSIGNED NOT NULL,
    user_id         INT UNSIGNED NOT NULL,
    score           TINYINT UNSIGNED NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT uq_rating_user_recipe UNIQUE (user_id, recipe_id),
    -- Une ligne par couple (utilisateur, recette)
    -- Impossible d'insérer deux fois la même combinaison

    CONSTRAINT fk_ratings_recipe
        FOREIGN KEY (recipe_id) REFERENCES recipes(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,

    CONSTRAINT fk_ratings_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

La contrainte `uq_rating_user_recipe` est la clé du système : c'est elle qui garantit l'unicité au niveau base de données. Peu importe ce que fait le code applicatif, MariaDB ne laissera jamais passer deux lignes avec le même `(user_id, recipe_id)`.

## 3. LE CODE

### 3.1 — RatingController.js (`src/controllers/RatingController.js:47-53`)

```javascript
} catch (err) {
    // Handle race condition (duplicate rating)
    if (err.code === 'ER_DUP_ENTRY') {
        return sendError(res, 'Rating conflict. Please retry.', 409);
    }
    next(err);
}
```

### 3.2 — Rating.js (`src/models/Rating.js:66-101`)

```javascript
const existing = await Rating.findByUserAndRecipe(userId, recipeId);

if (existing) {
    // UPDATE path — existing rating found, update score
    ...
}

// INSERT path — no existing rating found
await pool.execute(
    `INSERT INTO ratings (recipe_id, user_id, score)
     VALUES (?, ?, ?)`,
    [recipeId, userId, score]
);
```

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

1. `Rating.rate()` commence par appeler `findByUserAndRecipe()` pour voir si une note existe déjà.
2. Si aucune note n'existe → chemin INSERT.
3. Mais entre l'appel à `findByUserAndRecipe()` et l'INSERT, **une autre requête peut passer**.
4. Scénario race condition :
   - Requête A : `findByUserAndRecipe(1, 5)` → retourne `null`
   - Requête B : `findByUserAndRecipe(1, 5)` → retourne `null`
   - Requête A : `INSERT INTO ratings (1, 5, 4)` → OK
   - Requête B : `INSERT INTO ratings (1, 5, 5)` → **ER_DUP_ENTRY** (violation de la contrainte UNIQUE)
5. MariaDB lève une erreur avec le code `ER_DUP_ENTRY`.
6. Le `catch` dans `rateRecipe()` attrape cette erreur spécifique.
7. Il répond avec un statut **409 Conflict** et un message invitant à réessayer.

## 5. ANALOGIE

C'est comme deux personnes qui essaient de s'asseoir sur la même chaise en même temps. Toutes les deux voient la chaise libre (`findByUserAndRecipe` retourne null), toutes les deux s'assoient (INSERT). La deuxième se prend un "c'est déjà pris" de la chaise elle-même (ER_DUP_ENTRY), pas de la première personne.

## 6. PIÈGES CLASSIQUES

### Piège #1 : Utiliser uniquement un check applicatif

Faire `SELECT` puis `INSERT` sans contrainte UNIQUE en base. Si deux requêtes passent entre le SELECT et l'INSERT, les deux INSERT réussissent → doublon dans la base. La contrainte UNIQUE est le filet de sécurité, pas le check applicatif.

### Piège #2 : Transaction manquante

Le `findByUserAndRecipe` et l'INSERT ne sont pas dans une transaction SQL. En production, il faudrait un `BEGIN TRANSACTION` + `COMMIT` pour bloquer les lectures concurrentes. Le MVP assume que ER_DUP_ENTRY est suffisant car la fenêtre de race condition est très petite.

### Piège #3 : Attraper toutes les erreurs MySQL

Ne pas filtrer `err.code === 'ER_DUP_ENTRY'` et renvoyer 409 pour toutes les erreurs. Une erreur de connexion à la base deviendrait aussi un 409, ce qui est trompeur.

## 7. ET SI ON FAISAIT AUTREMENT ?

**Option A** : `INSERT ... ON DUPLICATE KEY UPDATE`. Une seule requête qui dit "insère, et si la contrainte UNIQUE est violée, mets à jour". Solution plus robuste, élimine complètement la race condition. Pas choisie pour le MVP car la logique métier diffère entre INSERT et UPDATE (points de gamification, notification, etc.).

**Option B** : Transaction SQL avec `SELECT ... FOR UPDATE` qui verrouille la ligne pour les autres transactions. Garantit que deux requêtes ne peuvent pas lire simultanément. Plus complexe, nécessite la gestion manuelle des verrous.

**Option C** : File d'attente (queue) pour les opérations de notation. Toutes les requêtes passent par une queue qui les traite une par une. Solution lourde, pas justifiée pour un MVP.

## 8. CHECKLIST POUR LE JURY

- [ ] Contrainte `uq_rating_user_recipe` déclarée dans le DDL
- [ ] `findByUserAndRecipe()` vérifie l'existence avant INSERT
- [ ] Le `catch` dans `rateRecipe()` filtre `err.code === 'ER_DUP_ENTRY'`
- [ ] La réponse est un 409 Conflict, pas un 500
- [ ] Message utilisateur : "Rating conflict. Please retry."
- [ ] Les autres erreurs sont passées à `next(err)` (error handler global)
- [ ] Pas de transaction SQL — limite MVP documentée
