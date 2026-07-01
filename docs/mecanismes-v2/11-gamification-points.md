# 11 — Gamification (Points)

## 1. CE QUE ÇA FAIT (vue d'ensemble)

Quand un utilisateur reçoit une note ≥ 4 sur sa recette, l'auteur gagne 5 points. Les points sont stockés sur la table `users` (colonne `points`). L'incrémentation est faite atomiquement en SQL pour éviter les race conditions (deux notes simultanées = les deux comptent). Les points ne sont attribués que sur la première note (INSERT), pas sur les modifications de note (UPDATE) — sinon un utilisateur pourrait fermer en upant/downant sa note pour farmer des points.

## 2. SCHÉMA DE LA TABLE

```sql
-- Colonne points sur la table users
points          INT UNSIGNED NOT NULL DEFAULT 0,
```

(Source: `database/scripts/03_create_tables.sql:39`)

- `INT UNSIGNED` = 0 à 4 milliards — on est tranquilles
- `DEFAULT 0` = tout nouveau utilisateur commence à zéro

## 3. LE CODE

### 3.1 — User.addPoints() (`src/models/User.js:92`)

```javascript
static async addPoints(id, points) {
    const [result] = await pool.execute(
        `UPDATE users
         SET points = points + ?, updated_at = NOW()
         WHERE id = ? AND deleted_at IS NULL`,
        [points, id]
        // points + ? se fait en SQL, PAS en JavaScript
        //
        // Pourquoi SQL ? Si deux requêtes arrivent EN MÊME TEMPS :
        //   Requête A : SELECT points FROM users WHERE id = 7 → 10
        //   Requête B : SELECT points FROM users WHERE id = 7 → 10 (lit la même valeur)
        //   Requête A : UPDATE users SET points = 10 + 5 → 15
        //   Requête B : UPDATE users SET points = 10 + 5 → 15 (et pas 20 !)
        //   → 5 points perdus !
        //
        // Avec SQL atomique (points = points + 5) :
        //   MariaDB verrouille la ligne et fait l'incrémentation séquentiellement
        //   Requête A : points = points + 5 → 15
        //   Requête B : points = points + 5 → 20 ✓
    );
    return result.affectedRows > 0;
}
```

### 3.2 — Attribution des points (dans Rating.rate(), `src/models/Rating.js:108`)

```javascript
// Dans le path INSERT de Rating.rate()
// Gamification : +5 points à l'auteur si score >= 4
let pointsAwarded = false;
if (score >= 4) {
    // Il faut retrouver l'auteur de la recette
    const recipe = await Recipe.findById(recipeId);
    if (recipe) {
        // +5 points à l'auteur (recipe.user_id), PAS à celui qui note
        await User.addPoints(recipe.user_id, 5);
        pointsAwarded = true;
    }
}

return {
    rating: { userId, recipeId, score },
    isNew: true,
    pointsAwarded  // true si l'auteur a gagné des points
};
```

### 3.3 — Protection anti-farming dans l'UPDATE (même fichier, ligne 69)

```javascript
if (existing) {
    // === PATH UPDATE ===
    await pool.execute(
        `UPDATE ratings
         SET score = ?
         WHERE user_id = ? AND recipe_id = ?`,
        [score, userId, recipeId]
    );

    return {
        rating: { userId, recipeId, score },
        isNew: false,
        pointsAwarded: false  // ← JAMAIS de points sur UPDATE
        // Si on donnait des points sur UPDATE, un utilisateur malveillant pourrait :
        // 1. Noter 5 → +5 points à l'auteur
        // 2. Changer pour 1 → update
        // 3. Remettre 5 → re-update → +5 points
        // 4. Boucler → farmer des points infinis
    };
}
```

### 3.4 — Affichage des points (lecture dans User.findById, `src/models/User.js:44`)

```javascript
static async findById(id) {
    const [rows] = await pool.execute(
        `SELECT id, username, email, role, points, created_at
         FROM users
         WHERE id = ? AND deleted_at IS NULL`,
        [id]
    );
    return rows[0] || null;
}
```

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

```
1. Utilisateur A (id=7) note la recette 42 de l'utilisateur B (id=3) avec score=5
2. Rating.rate() INSERT dans ratings
3. Condition : score (5) >= 4 → OUI
4. Recipe.findById(42) → récupère recipe.user_id = 3
5. User.addPoints(3, 5) → UPDATE users SET points = points + 5 WHERE id = 3
6. Retourne { pointsAwarded: true }

Si utilisateur A avait noté avec score=2 :
3. Condition : score (2) >= 4 → NON
4. Pas d'appel à addPoints()
5. Retourne { pointsAwarded: false }

Si utilisateur A modifie sa note de 5 à 2 (UPDATE) :
- pointsAwarded: false systématiquement
- Même si la nouvelle note est >= 4, on ne donne pas de points
```

## 5. ANALOGIE

C'est comme un **système de vignettes dans une cantine scolaire**. Quand un élève reçoit un compliment sur son plat (note ≥ 4), il gagne une vignette. Mais changer d'avis après coup ne rapporte pas de vignette supplémentaire — sinon les élèves passeraient leur temps à alterner "c'est nul / c'est génial" pour accumuler des vignettes. Le compteur de vignettes est sur le tableau de chaque élève, et on ajoute en une seule opération pour pas que deux compliments simultanés ne comptent pour un seul.

## 6. PIÈGES CLASSIQUES

### Piège #1 : Incrémenter en JavaScript au lieu de SQL

**MAUVAIS** — race condition :
```javascript
const user = await User.findById(id);
user.points += points;  // Lecture → modification → écriture = non atomique
await pool.execute('UPDATE users SET points = ? WHERE id = ?', [user.points, id]);
```

**BON** — atomique en SQL :
```javascript
await pool.execute(
    'UPDATE users SET points = points + ? WHERE id = ?',
    [points, id]
);
```

### Piège #2 : Donner des points sur UPDATE

**MAUVAIS** — farming possible :
```javascript
// Donner des points à chaque modification de note
if (score >= 4) {
    await User.addPoints(recipe.user_id, 5);
    // L'utilisateur peut alterner 5/1 à l'infini pour farmer des points
}
```

**BON** — points uniquement sur la première note :
```javascript
if (existing) {
    // UPDATE → pas de points
    return { pointsAwarded: false };
}
// INSERT → points si score >= 4
```

## 7. ET SI ON FAISAIT AUTREMENT ?

### Option A : Points à l'utilisateur qui note (et pas à l'auteur)
- **Comment ça marche** : `User.addPoints(userId, 1)` quand quelqu'un note une recette.
- **Avantage** : encourage les utilisateurs à interagir (plus de notes = plus de points).
- **Inconvénient** : peut encourager le vote sans discernement.
- **Notre cas** : on préfère récompenser la qualité du contenu (notes ≥ 4 sur les recettes), pas l'acte de voter.

### Option B : Points basés sur le nombre de votes reçus
- **Comment ça marche** : +X points à l'auteur à chaque nouveau vote, quel que soit le score.
- **Avantage** : récompense la visibilité.
- **Inconvénient** : ne distingue pas la qualité — une recette mauvaise mais polémique recevrait autant de points.
- **Notre cas** : on veut récompenser la qualité, pas la controverse.

## 8. CHECKLIST POUR LE JURY

- [ ] La colonne `points` existe sur `users` avec `INT UNSIGNED NOT NULL DEFAULT 0`
- [ ] `User.addPoints()` utilise une mise à jour atomique SQL : `points = points + ?`
- [ ] Les points ne sont attribués QUE sur le path INSERT de `Rating.rate()`, pas sur UPDATE
- [ ] Les points sont attribués à l'AUTEUR de la recette (`recipe.user_id`), pas à celui qui note
- [ ] Seules les notes ≥ 4 déclenchent l'attribution de points
- [ ] `pointsAwarded` est retourné dans la réponse API pour que le frontend puisse afficher une notification
