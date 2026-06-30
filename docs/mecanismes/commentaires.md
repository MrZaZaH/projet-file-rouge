# Commentaires : invités vs connectés

## Contexte

Un utilisateur doit pouvoir commenter une recette même sans avoir de compte. Mais un utilisateur connecté ne doit pas avoir à donner son pseudo.

---

## Pourquoi `attachUser` plutôt que `authenticate` ?

### Le problème

`POST /api/v1/recipes/:id/comments` doit fonctionner pour :
- Un utilisateur connecté → `user_id` renseigné, `guest_name` ignoré
- Un invité → pas de `user_id`, `guest_name` requis

### Option écartée : forcer la création de compte

Forcer l'inscription pour commenter tuerait l'engagement. Le projet vise les recettes du quotidien — un visiteur veut pouvoir réagir sans friction.

### Ce qui est fait

Un middleware spécifique `attachUser` (`src/routes/commentRoutes.js:22-37`) qui :

```javascript
function attachUser(req, _res, next) {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
        try {
            const token = header.slice(7);
            req.user = jwt.verify(token, process.env.JWT_SECRET);
        } catch {
            req.user = undefined;  // Token invalide → traité comme invité
        }
    }
    next();  // Jamais bloqué
}
```

**Risque de l'inverse (utiliser `authenticate` directement) :** un invité reçoit 401 et ne peut pas commenter du tout.

### Validation conditionnelle

`src/routes/commentRoutes.js:46-53` :

```javascript
body('guest_name')
    .if((_, { req }) => !req.user)  // Valide seulement si pas connecté
    .trim()
    .notEmpty().withMessage('A name is required to comment as a guest.')
```

**Pourquoi `.if()` ?** Si l'utilisateur est connecté, `guest_name` est ignoré dans le controller (`CommentController.js:47-48`) — inutile de le valider.

### En version 2

- Ajouter une vérification anti-spam : délai minimum entre deux commentaires
- Notifier l'auteur de la recette quand quelqu'un commente
- Signaler les commentaires (modération participative)

---

## Pourquoi une validation séparée dans chaque route ?

### Option écartée : validation dans le modèle

Le modèle `Comment.create()` (`src/models/comment.js:30-41`) a déjà ses propres vérifications (content ≥ 3 chars, name requis si pas user_id).

**Pourquoi répéter la validation dans les routes alors ?**

1. **Feedback immédiat** : les erreurs de validation sont renvoyées avant d'atteindre la BDD. Pas de requête SQL inutile.
2. **Contrat API** : la validation dans la route documente ce que l'API attend. Lisible sans ouvrir le modèle.
3. **Double sécurité** : si un jour quelqu'un modifie la route sans passer par les règles du modèle, la validation route protège encore.

### Risque de l'inverse (validation uniquement dans le modèle)

Une requête malformée arrive jusqu'à la BDD, exécute une requête, puis échoue sur une contrainte. Gaspillage de ressources et message d'erreur moins clair (erreur MySQL vs message personnalisé).

### En version 2

- Centraliser les règles de validation par ressource (ex: `src/validators/commentValidator.js`)
- Tests de validation automatisés (actuellement testés dans les tests d'intégration)
