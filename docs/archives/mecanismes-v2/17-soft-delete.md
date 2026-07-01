# #17 — Soft Delete

## 1. CE QUE ÇA FAIT (vue d'ensemble)

Le soft delete est une technique qui consiste à "masquer" des données au lieu de les supprimer physiquement de la base. Au lieu d'exécuter `DELETE FROM recipes WHERE id = ?`, on exécute `UPDATE recipes SET deleted_at = NOW() WHERE id = ?`. La ligne reste dans la table mais toutes les requêtes de l'application incluent `WHERE deleted_at IS NULL` pour l'exclure des résultats. Ça permet de récupérer des données supprimées par erreur, de garder un historique d'audit, et de ne pas casser les relations avec d'autres tables (commentaires, favoris, notes) qui référencent la ligne.

## 2. SCHÉMA DE LA TABLE

Toutes les tables principales ont une colonne `deleted_at` :

```sql
CREATE TABLE IF NOT EXISTS categories (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at      DATETIME NULL DEFAULT NULL   -- NULL = actif, date = supprimé
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username        VARCHAR(50) NOT NULL UNIQUE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at      DATETIME NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS recipes (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id             INT UNSIGNED NOT NULL,
    title               VARCHAR(255) NOT NULL,
    -- ... autres colonnes ...
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at          DATETIME NULL DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comments (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    recipe_id       INT UNSIGNED NOT NULL,
    user_id         INT UNSIGNED NULL DEFAULT NULL,
    guest_name      VARCHAR(100) NULL DEFAULT NULL,
    content         TEXT NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at      DATETIME NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Note : ratings et favorites n'ont PAS de deleted_at
-- Pourquoi ? Une note supprimée n'a pas de sens (on ne "restaure" pas une note).
-- Un favorite supprimé = on l'enlève, pas besoin de le garder.
```

## 3. LE CODE

### 3.1 — Recipe.softDelete (src/models/Recipe.js:908)

```javascript
static async softDelete(id) {
    try {
        // On UPDATE, pas DELETE
        const query = `
            UPDATE recipes
            SET    deleted_at = NOW(),
                   updated_at = NOW()
            WHERE  id = ? AND deleted_at IS NULL
            -- WHERE deleted_at IS NULL empêche de double-supprimer
            -- Si la recette est déjà soft-deletée, affectedRows = 0
        `;

        const [result] = await pool.query(query, [id]);
        // affectedRows > 0 → la recette existait et a été marquée supprimée
        // affectedRows === 0 → recette déjà supprimée ou inexistante
        return result.affectedRows > 0;

    } catch (error) {
        logger.error(`Recipe.softDelete(${id}) failed: ${error.message}`);
        throw error;
    }
}
```

### 3.2 — User.delete (src/models/User.js:106)

```javascript
// Même principe pour les utilisateurs
static async delete(id) {
    const [result] = await pool.execute(
        'UPDATE users SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL',
        [id]
    );
    return result.affectedRows > 0;
    // L'utilisateur reste en BDD mais plus accessible via findById(), findByEmail(), etc.
}
```

### 3.3 — Comment.softDelete (src/models/Comment.js:77)

```javascript
static async softDelete(id) {
    await pool.execute(
        `UPDATE comments
         SET deleted_at = NOW()
         WHERE id = ?`,
        [id]
        // Note : pas de WHERE deleted_at IS NULL sur les commentaires → idempotent
        // On permet le soft delete même si déjà supprimé (pas d'erreur)
    );
    // Pas de retour booléen ici — le contrôleur ne vérifie pas
    // Si le commentaire existait, il est marqué supprimé
    // S'il n'existait pas, l'UPDATE n'affecte aucune ligne, erreur silencieuse
}
```

### 3.4 — Category.delete (src/models/Category.js:82)

```javascript
static async delete(id) {
    const [result] = await pool.execute(
        'UPDATE categories SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL',
        [id]
    );
    return result.affectedRows > 0;
    // Pourquoi soft delete sur les catégories ?
    // Si une catégorie est supprimée alors que des recettes la référencent,
    // le hard delete casserait la FK (ON DELETE RESTRICT bloquerait).
    // Avec soft delete, les recettes gardent leur category_id intact.
}
```

### 3.5 — Requêtes avec WHERE deleted_at IS NULL (exemples)

Toutes les requêtes de l'application excluent les lignes soft-deletées :

```javascript
// Recipe.findById (src/models/Recipe.js:304)
const query = `
    SELECT r.*, u.username AS user_pseudo, c.name AS category_name
    FROM recipes r
    LEFT JOIN users u ON r.user_id = u.id
    LEFT JOIN categories c ON r.category_id = c.id
    WHERE r.id = ? AND r.deleted_at IS NULL
    LIMIT 1
`;

// Recipe.findAllWithFilters (src/models/Recipe.js:449)
let query = `
    SELECT r.*
    FROM recipes r
    WHERE r.deleted_at IS NULL
`;

// Recipe.findByUserId (src/models/Recipe.js:950)
const query = `
    SELECT r.*
    FROM recipes r
    WHERE r.user_id = ? AND r.deleted_at IS NULL
    ORDER BY r.created_at DESC
`;

// User.findById (src/models/User.js:44)
const [rows] = await pool.execute(
    `SELECT id, username, email, role, points, created_at
     FROM users
     WHERE id = ? AND deleted_at IS NULL`,
    [id]
);

// AdminController — suppression admin (AdminController.js:268)
await pool.query(
    'UPDATE recipes SET deleted_at = NOW(), updated_at = NOW() WHERE id = ?',
    [id]
    // Note : pas de WHERE deleted_at IS NULL ici → si déjà supprimé, pas d'erreur
);
```

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

```
Avant soft delete :
┌────┬──────────────────────┬──────────────────────┐
│ id │ title                │ deleted_at           │
├────┼──────────────────────┼──────────────────────┤
│ 1  │ Pâtes carbonara      │ NULL                 │ ← visible partout
│ 2  │ Pizza ananas         │ 2024-01-15 10:30:00  │ ← masquée
│ 3  │ Omelette fromage     │ NULL                 │ ← visible partout
└────┴──────────────────────┴──────────────────────┘

Quand on soft-delete la recette #1 :
UPDATE recipes SET deleted_at = NOW() WHERE id = 1

Résultat :
┌────┬──────────────────────┬──────────────────────┐
│ id │ title                │ deleted_at           │
├────┼──────────────────────┼──────────────────────┤
│ 1  │ Pâtes carbonara      │ 2024-07-01 14:30:00  │ ← masquée maintenant
│ 2  │ Pizza ananas         │ 2024-01-15 10:30:00  │ ← toujours masquée
│ 3  │ Omelette fromage     │ NULL                 │ ← toujours visible
└────┴──────────────────────┴──────────────────────┘

Requête SELECT WHERE deleted_at IS NULL :
→ Retourne seulement l'omelette (id 3)
→ Les recettes 1 et 2 sont filtrées

Mais la ligne #1 existe toujours en BDD :
- Un admin peut faire SELECT * FROM recipes WHERE id = 1 pour la voir
- Les commentaires de la recette #1 existent encore (pas d'erreur FK)
- On peut "restaurer" en faisant UPDATE SET deleted_at = NULL WHERE id = 1
```

## 5. ANALOGIE

Tu travailles dans un supermarché. Un produit est périmé, tu dois le retirer du rayon.

**Hard delete (DELETE)** : Tu jettes le produit à la poubelle, tu le déchires, tu effaces son code-barres du système. Impossible de savoir ce que c'était ni de le retrouver. Si un client avait commandé ce produit (commentaire), sa commande pointe vers rien.

**Soft delete (UPDATE deleted_at)** : Tu mets le produit dans la réserve avec une étiquette "PÉRIMÉ - [date]". Il n'est plus en rayon (WHERE deleted_at IS NULL dans les requêtes "normales"), mais il existe toujours dans la réserve. Si le client demande "j'avais commandé ce produit et il était génial", tu peux aller en réserve, retrouver l'étiquette, et dire "oui effectivement on l'avait, voici ce que c'était". Tu peux même le remettre en rayon si c'était une erreur.

## 6. PIÈGES CLASSIQUES

### Piège #1 : Oublier WHERE deleted_at IS NULL sur une requête

C'est le piège numéro 1 du soft delete. Tu ajoutes une nouvelle fonctionnalité, tu écris `SELECT * FROM recipes WHERE user_id = ?` sans penser au `deleted_at`, et soudain les recettes "supprimées" réapparaissent dans les résultats.

**MAUVAIS :**
```javascript
const [rows] = await pool.execute(
    'SELECT * FROM recipes WHERE user_id = ?',
    [userId]
    // → retourne aussi les recettes supprimées
);
```

**BON :**
```javascript
const [rows] = await pool.execute(
    'SELECT * FROM recipes WHERE user_id = ? AND deleted_at IS NULL',
    [userId]
);
```

### Piège #2 : Utiliser un index sur deleted_at seul

L'index `idx_recipes_deleted_at` existe mais un index composé `(status, deleted_at)` est PLUS efficace car MariaDB peut filtrer les deux conditions en une seule passe.

**MOINS BIEN :**
```sql
CREATE INDEX idx_recipes_deleted_at ON recipes(deleted_at);
-- Index seul, moins utile
```

**MEILLEUR (06_indexes.sql:30) :**
```sql
CREATE INDEX idx_recipes_status_deleted ON recipes (status, deleted_at);
-- Index composé : une seule recherche pour les deux conditions
```

### Piège #3 : Hard delete sur une table avec FK RESTRICT

Si tu fais `DELETE FROM categories WHERE id = 1` et qu'une recette référence cette catégorie, la base refuse (`ON DELETE RESTRICT`). Mais un soft delete passe sans problème car la ligne existe toujours.

**MAUVAIS :** `DELETE FROM categories WHERE id = ?` → `ER_ROW_IS_REFERENCED_2` si des recettes existent

**BON :** `UPDATE categories SET deleted_at = NOW() WHERE id = ?` → toujours OK

### Piège #4 : Compter avec COUNT(*) sans tenir compte du soft delete

Les stats du dashboard utilisateur ou admin doivent exclure les lignes soft-deletées, sinon les chiffres sont gonflés.

**MAUVAIS :**
```sql
SELECT COUNT(*) as total FROM recipes WHERE user_id = ?
```

**BON :**
```sql
SELECT COUNT(*) as total FROM recipes WHERE user_id = ? AND deleted_at IS NULL
```

## 7. ET SI ON FAISAIT AUTREMENT ?

### Option A : Hard delete avec CASCADE (suppression physique)

- Comment ça marche : `DELETE FROM recipes WHERE id = ?` et toutes les FK ont `ON DELETE CASCADE` pour supprimer les commentaires/notes/favoris automatiquement
- Avantage : Pas de lignes orphelines, pas besoin de `WHERE deleted_at IS NULL` partout, requêtes plus simples
- Inconvénient : Impossible de restaurer des données supprimées par erreur. Aucune trace d'audit de suppression. Perte de l'intégrité historique des données.
- Notre cas : Le soft delete est une meilleure pratique pour toute application métier. On garde.

### Option B : Table archive dédiée

- Comment ça marche : Déplacer les lignes supprimées dans une table `recipes_archived` avant DELETE
- Avantage : Les tables principales restent légères, pas besoin de filtrer `deleted_at IS NULL`
- Inconvénient : Complexité du déplacement, requêtes plus longues (INSERT dans archive + DELETE), risque d'oublier des tables, entretien du schéma d'archive synchronisé avec le schéma principal
- Notre cas : Overkill pour un MVP. Le soft delete avec colonne `deleted_at` est le standard de l'industrie.

## 8. CHECKLIST POUR LE JURY

- [ ] Toutes les requêtes SELECT principales incluent `WHERE deleted_at IS NULL`
- [ ] Le soft delete est un UPDATE, pas un DELETE
- [ ] Les comptages (COUNT, stats) excluent les lignes soft-deletées
- [ ] Les tables `ratings` et `favorites` n'ont PAS de `deleted_at` (cohérent avec leur usage)
- [ ] Un soft delete peut être annulé en remettant `deleted_at` à NULL manuellement
- [ ] Les contraintes FK ne sont pas violées par le soft delete (la ligne existe toujours)
- [ ] `Recipe.softDelete()` retourne `true` si la ligne a été mise à jour, `false` sinon
