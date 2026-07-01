# 38 — Admin Logs (Audit Trail)

## 1. CE QUE ÇA FAIT (vue d'ensemble)

Chaque action administrative (approbation, rejet, suppression de recette) est enregistrée dans la table `admin_logs`. Cela permet de tracer qui a fait quoi, sur quelle cible, et à quel moment. Les logs sont consultables via une route API dédiée.

Le système utilise une référence **polymorphique** : `target_type` + `target_id` permettent de pointer vers n'importe quel type d'entité (recette, commentaire, utilisateur) sans avoir besoin d'une colonne de clé étrangère par type.

## 2. SCHÉMA DE LA TABLE

```sql
CREATE TABLE IF NOT EXISTS admin_logs (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    admin_id        INT UNSIGNED NOT NULL,
    target_type     VARCHAR(50) NOT NULL,
    -- 'recipe', 'comment', 'user' — détermine à quelle table appartient target_id
    target_id       INT UNSIGNED NOT NULL,
    action          VARCHAR(255) NOT NULL,
    -- 'recipe_published', 'recipe_rejected', 'recipe_deleted', etc.
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_admin_logs_admin
        FOREIGN KEY (admin_id) REFERENCES users(id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## 3. LE CODE

### 3.1 — INSERT dans les actions admin (`src/controllers/AdminController.js:224-228`)

```javascript
await pool.query(
    `INSERT INTO admin_logs (admin_id, action, recipe_id, target_type, target_id, created_at)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [req.user.id, `recipe_${status}`, id, 'recipe', id]
);
```

### 3.2 — Récupération des logs (`src/controllers/AdminController.js:307-353`)

```javascript
static async getLogs(req, res) {
    try {
        const { limit = 50, offset = 0, action } = req.query;

        let query = `
            SELECT 
                al.id,
                al.admin_id,
                u.username as admin_name,
                al.action,
                al.recipe_id,
                al.target_type,
                al.target_id,
                al.created_at
            FROM admin_logs al
            LEFT JOIN users u ON al.admin_id = u.id
            WHERE 1=1
        `;

        const params = [];

        if (action) {
            query += ` AND al.action = ?`;
            params.push(action);
        }

        query += ` ORDER BY al.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const [logs] = await pool.query(query, params);

        res.json({
            success: true,
            count: logs.length,
            data: logs
        });
    } catch (error) { ... }
}
```

### 3.3 — Route (`src/routes/adminRoutes.js:119-138`)

```javascript
router.get(
    '/logs',
    [
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limit must be between 1 and 100'),
        query('offset')
            .optional()
            .isInt({ min: 0 })
            .withMessage('Offset must be 0 or positive'),
        query('action')
            .optional()
            .isString()
            .trim()
    ],
    handleValidationErrors,
    AdminController.getLogs
);
```

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

1. Un admin effectue une action (approbation, rejet, suppression).
2. Dans la même fonction, juste après l'UPDATE de la recette et l'INSERT de la notification, un INSERT est fait dans `admin_logs`.
3. Les champs enregistrés :
   - `admin_id` : l'ID de l'admin qui a fait l'action (tiré de `req.user.id`)
   - `action` : le nom de l'action (ex: `recipe_published`, `recipe_deleted`)
   - `target_type` : le type d'entité (`'recipe'`)
   - `target_id` : l'ID de l'entité
   - `created_at` : timestamp automatique
4. Pour consulter les logs, l'admin appelle `GET /api/v1/admin/logs`.
5. La requête fait un `LEFT JOIN users` pour récupérer le nom de l'admin (`admin_name`).
6. Les logs sont triés du plus récent au plus ancien.
7. On peut filtrer par `action` (ex: `?action=recipe_published`).

## 5. ANALOGIE

C'est le registre de bord d'un navire. Chaque action du capitaine (admin) est notée : "Jour 45 — J'ai approuvé le chargement de la recette 'Pâtes bolo'." Plus tard, si on doit savoir qui a fait quoi, on consulte le registre. C'est une trace écrite qui ne peut pas être modifiée rétroactivement.

## 6. PIÈGES CLASSIQUES

### Piège #1 : Pas de suppression de logs

Les `admin_logs` n'ont pas de `deleted_at` ni de soft delete. C'est intentionnel — les logs d'audit ne doivent jamais être supprimés. Une fois écrits, ils restent.

### Piège #2 : Référence polymorphique sans contrainte FK

`target_type` et `target_id` sont des champs libres. Il n'y a pas de contrainte de clé étrangère qui vérifie que `target_id` existe vraiment dans la table indiquée par `target_type`. C'est un choix délibéré car MariaDB ne supporte pas les clés étrangères polymorphiques.

### Piège #3 : Pas de pagination maximum

La requête `getLogs()` n'a pas de limite haute stricte autre que celle définie par validateur (max 100). Sans limite, un admin pourrait charger des millions de lignes d'un coup. Le middleware express-validator limite à 100.

## 7. ET SI ON FAISAIT AUTREMENT ?

**Option A** : Une table de logs par type d'entité (`recipe_logs`, `comment_logs`, `user_logs`). Plus strict, chaque table a une vraie FK. Mais ça multiplie le nombre de tables et complexifie les requêtes "afficher tous les logs".

**Option B** : Un service externe de logging (ELK Stack, Datadog, etc.). Les logs sont envoyés à un service spécialisé avec recherche full-text, dashboards, alerting. Totalement hors-scope pour un MVP.

**Option C** : Stockage des logs en JSON dans un fichier. Simple mais pas requêtable, pas scalable, pas sécurisé (fichier accessible ?).

## 8. CHECKLIST POUR LE JURY

- [ ] Table `admin_logs` avec les colonnes : id, admin_id, action, target_type, target_id, created_at
- [ ] INSERT dans `admin_logs` pour chaque action admin (approbation, rejet, suppression)
- [ ] `admin_id` = `req.user.id` (admin authentifié qui fait l'action)
- [ ] `action` descriptive (ex: `recipe_published`, `recipe_deleted`)
- [ ] `target_type` = `'recipe'` dans les cas actuels
- [ ] `target_id` = l'ID de la recette
- [ ] Route `GET /api/v1/admin/logs` avec pagination (limit/offset)
- [ ] `LEFT JOIN users` pour afficher le nom de l'admin
- [ ] Filtre optionnel par `action`
- [ ] Pas de soft delete sur admin_logs (données d'audit immutables)
