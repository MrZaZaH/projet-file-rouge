# 23 — Compteur de Vues (Views)

## 1. CE QUE ÇA FAIT (vue d'ensemble)

Quand un utilisateur consulte le détail d'une recette, le compteur de vues est incrémenté de manière asynchrone ("fire and forget") : la réponse est renvoyée immédiatement sans attendre la fin de l'UPDATE SQL. Si l'incrémentation échoue (DB down, timeout), la requête principale n'est pas impactée — l'erreur est juste loguée.

## 2. SCHÉMA DE LA TABLE

Colonne `views` dans la table `recipes` :

| Colonne | Type | Défaut | Description |
|---------|------|--------|-------------|
| views | INT UNSIGNED | 0 | Nombre de consultations de la recette |

Index défini dans `database/scripts/06_indexes.sql:24` :
```sql
ALTER TABLE recipes ADD COLUMN views INT UNSIGNED DEFAULT 0;
CREATE INDEX idx_recipes_views ON recipes (views);
```

L'index permet de trier efficacement les recettes par popularité (admin dashboard) sans full-scan de la table.

## 3. LE CODE

### 3.1 — RecipeController.js (`src/controllers/RecipeController.js:90-97`)

```javascript
// Increment view counter — fire and forget, don't block the response
const id = req.params.id;
pool.query(
    'UPDATE recipes SET views = views + 1 WHERE id = ?',
    [id]
).catch(err =>
    logger.warn(`Failed to increment views for recipe ${id}: ${err.message}`)
);
```

Points clés :
- `pool.query()` est appelé SANS `await` — la promesse est lancée mais la fonction continue immédiatement.
- `.catch()` attrape l'erreur silencieusement si la DB est injoignable. Sans ce `.catch()`, une erreur non rattrapée de promesse déclencherait `unhandledRejection` → crash du serveur (voir server.js:46-49).
- La requête utilise `views = views + 1` — atomique. Même si deux utilisateurs consultent en même temps, la DB gère le lock au niveau de la ligne.
- `logger.warn()` (pas `logger.error()`) car une vue manquée n'est pas critique pour l'utilisateur.

### 3.2 — index (06_indexes.sql)

```sql
-- Add views counter to recipes table
ALTER TABLE recipes ADD COLUMN views INT UNSIGNED DEFAULT 0;

-- Index on views for admin dashboard sorting
CREATE INDEX idx_recipes_views ON recipes (views);
```

`INT UNSIGNED` : pas de vues négatives. `DEFAULT 0` : les recettes existantes sans vues commencent à 0.

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

1. GET `/api/v1/recipes/5` arrive.
2. `Recipe.findById(5)` est exécuté avec `await` — la réponse attend ce résultat.
3. La recette est trouvée, la fonction continue.
4. `pool.query('UPDATE recipes SET views = views + 1 WHERE id = ?', [5])` est lancé SANS await.
5. `sendSuccess(res, recipe)` est appelé immédiatement — l'utilisateur reçoit la réponse.
6. En parallèle, MariaDB exécute l'UPDATE.
7. Si l'UPDATE réussit : rien ne se passe (promesse résolue, personne n'attend).
8. Si l'UPDATE échoue : `.catch()` logue un warning, la réponse a déjà été envoyée.

## 5. ANALOGIE

C'est comme un compteur de clics manuel à l'entrée d'une salle de concert. Le billet est contrôlé (findById), puis le clic est fait (UPDATE views). Si le compteur se coince, le spectateur entre quand même — personne ne le force à attendre que le compteur soit réparé.

## 6. PIÈGES CLASSIQUES

### Piège #1 : Utiliser `await` sur la vue

```javascript
// MAUVAIS — l'utilisateur attend la fin de l'UPDATE
await pool.query('UPDATE recipes SET views = views + 1 WHERE id = ?', [id]);
return sendSuccess(res, recipe);
// Si la DB est lente, la réponse est retardée
```

```javascript
// BON — fire and forget
pool.query('UPDATE recipes SET views = views + 1 WHERE id = ?', [id])
    .catch(err => logger.warn(...));
return sendSuccess(res, recipe);
```

### Piège #2 : Aucun `.catch()` → crash serveur

```javascript
// MAUVAIS — promesse non rattrapée, unhandledRejection
pool.query('UPDATE recipes SET views = views + 1 WHERE id = ?', [id]);
// Si la query échoue, le processus reçoit unhandledRejection → process.exit(1)
```

```javascript
// BON — .catch() protège le processus
pool.query('UPDATE recipes SET views = views + 1 WHERE id = ?', [id])
    .catch(err => logger.warn(`Failed: ${err.message}`));
```

### Piège #3 : Compter une vue à chaque rechargement de page

Le code actuel incrémente les vues à chaque appel à `getRecipeById`. En production, on voudrait filtrer les bots, les doublons par session, et les utilisateurs qui rafraîchissent 10 fois. C'est un choix délibéré pour le MVP — simple, pas de cache, pas de déduplication.

### Piège #4 : Pas d'index sur views

Sans l'index `idx_recipes_views`, trier par `ORDER BY views DESC` ferait un full-scan de la table `recipes`, lent sur des milliers de recettes.

## 7. ET SI ON FAISAIT AUTREMENT ?

### Option A : Cache Redis pour les vues

Au lieu d'écrire en DB à chaque vue, on incrémente un compteur Redis en mémoire. Un job cron persist les valeurs en MariaDB toutes les 5 minutes. Plus performant mais ajoute Redis à la stack et complexifie l'architecture. Pas justifié pour un MVP.

### Option B : Middleware dédié

Créer un middleware `viewCounter` qui intercepte la route `/:id` et incrémente les vues avant/après le contrôleur. Plus propre (séparation des responsabilités) mais ajoute de l'indirection. Le choix de le mettre dans le contrôleur est un compromis lisibilité/simplicité.

### Option C : Ne PAS compter les vues

Beaucoup d'applications n'ont pas de compteur de vues. Si la feature n'est pas nécessaire pour le MVP, on peut la supprimer complètement. Mais elle est utile pour le tableau de bord admin (mécanisme demandé dans le brief).

## 8. CHECKLIST POUR LE JURY

- [ ] `pool.query()` est appelé sans `await` (fire-and-forget).
- [ ] Un `.catch()` est présent pour gérer l'échec sans crash.
- [ ] La réponse est envoyée avant que l'UPDATE soit terminé.
- [ ] L'erreur de vue est loguée en `warn` (pas `error` — non critique).
- [ ] La colonne `views` existe et a la valeur par défaut 0.
- [ ] L'index `idx_recipes_views` existe pour les tris admin.
- [ ] Pas de blocage possible de la requête principale à cause d'un problème de vue.
