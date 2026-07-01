# 37 — Notifications Utilisateur (user_notifications)

## 1. CE QUE ÇA FAIT (vue d'ensemble)

Quand un admin approuve, rejette ou supprime une recette, l'auteur reçoit une notification dans la table `user_notifications`. Le message est en français avec un emoji pour rendre l'expérience plus humaine.

Trois types de notification :
- `recipe_approved` — la recette est publiée
- `recipe_rejected` — la recette est refusée (avec raison optionnelle)
- `recipe_deleted` — la recette est supprimée (avec raison optionnelle)

## 2. SCHÉMA DE LA TABLE

```sql
CREATE TABLE IF NOT EXISTS user_notifications (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id     INT UNSIGNED NOT NULL,
    type        ENUM('recipe_approved', 'recipe_rejected', 'recipe_deleted') NOT NULL,
    message     TEXT NOT NULL,
    recipe_id   INT UNSIGNED NOT NULL,
    read_at     DATETIME NULL DEFAULT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_notifications_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT fk_notifications_recipe
        FOREIGN KEY (recipe_id) REFERENCES recipes(id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

(La table n'apparaît pas dans les scripts SQL fournis — elle a été créée manuellement ou via une migration non versionnée. Le code l'utilise directement.)

## 3. LE CODE

### 3.1 — AdminController.js (`src/controllers/AdminController.js:210-222`)

```javascript
const notificationType = status === 'published'
    ? 'recipe_approved'
    : 'recipe_rejected';

const message = status === 'published'
    ? `Votre recette "${recipe[0].title}" a été publiée ! 🎉`
    : `Votre recette "${recipe[0].title}" n'a pas été retenue.${rejection_reason ? ' Raison : ' + rejection_reason : ''}`;

await pool.query(
    `INSERT INTO user_notifications (user_id, type, message, recipe_id, created_at)
     VALUES (?, ?, ?, ?, NOW())`,
    [recipe[0].user_id, notificationType, message, id]
);
```

### 3.2 — Suppression de recette (`src/controllers/AdminController.js:273-278`)

```javascript
const message = `Votre recette "${recipe[0].title}" a été supprimée.${reason ? ' Raison : ' + reason : ''}`;

await pool.query(
    `INSERT INTO user_notifications (user_id, type, message, recipe_id, created_at)
     VALUES (?, ?, ?, ?, NOW())`,
    [recipe[0].user_id, 'recipe_deleted', message, id]
);
```

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

1. L'admin appelle `PATCH /admin/recipes/:id/status` ou `DELETE /admin/recipes/:id`.
2. `AdminController.updateRecipeStatus()` ou `deleteRecipe()` récupère la recette avec son `user_id` (l'auteur).
3. Le contrôleur construit le message en fonction du type d'action :
   - Approbation → message positif avec 🎉
   - Rejet → message neutre avec raison optionnelle
   - Suppression → message avec raison optionnelle
4. Il INSERT une ligne dans `user_notifications` avec :
   - `user_id` : l'auteur de la recette
   - `type` : le type d'action (`recipe_approved`, `recipe_rejected`, `recipe_deleted`)
   - `message` : le texte en français
   - `recipe_id` : l'identifiant de la recette concernée
5. La notification est stockée en base, consultable via une future route GET.

## 5. ANALOGIE

C'est comme la boîte aux lettres de l'école. Le directeur (admin) dépose un mot dans le casier de l'élève (auteur de la recette) pour lui dire "ton dessin est affiché dans le couloir ! 🎉" ou "ton dessin n'est pas retenu". Le message attend dans le casier jusqu'à ce que l'élève vienne le lire.

## 6. PIÈGES CLASSIQUES

### Piège #1 : Pas de requête de récupération des notifications

Le code INSERT les notifications mais il n'y a pas de route API pour les récupérer côté frontend. Les notifications sont stockées mais pas encore lisibles par l'utilisateur. C'est une feature à implémenter après le MVP.

### Piège #2 : Injection potentielle via `rejection_reason`

La raison du rejet est concaténée directement dans le message avec `${rejection_reason}`. Ce n'est pas une injection SQL (c'est dans le message JavaScript, pas dans la requête SQL), mais il faudrait échapper le contenu pour éviter l'injection de caractères spéciaux dans le message affiché.

### Piège #3 : Pas de read_at / non lues

La colonne `read_at` existe dans la table mais n'est jamais mise à jour dans le code actuel. Les notifications restent "non lues" pour toujours. La logique de marquage comme "lu" est à implémenter.

## 7. ET SI ON FAISAIT AUTREMENT ?

**Option A** : Notifications en temps réel avec WebSocket. L'utilisateur reçoit la notification instantanément sans recharger la page. Beaucoup plus complexe (socket.io, gestion des connexions), pas justifié pour un MVP.

**Option B** : Notifications par email. Envoi d'un email à l'auteur quand sa recette est traitée. Solution plus intrusive, nécessite un service SMTP et la gestion des files d'envoi.

**Option C** : Stockage des notifications dans un fichier JSON ou une collection NoSQL. Plus simple à prototyper, mais incohérent avec le reste du projet qui utilise MariaDB.

## 8. CHECKLIST POUR LE JURY

- [ ] Table `user_notifications` créée avec les bons types et contraintes
- [ ] INSERT dans `user_notifications` après chaque action admin (approbation/rejet/suppression)
- [ ] Message en français avec emoji 🎉 pour l'approbation
- [ ] `user_id` = auteur de la recette (pas l'admin qui fait l'action)
- [ ] Les trois types sont utilisés : `recipe_approved`, `recipe_rejected`, `recipe_deleted`
- [ ] La raison optionnelle est incluse dans le message si fournie
- [ ] `read_at` est NULL à la création (non lu)
- [ ] Route de récupération des notifications à implémenter côté frontend
