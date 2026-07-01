# 44 — Validation Côté Frontend

## 1. CE QUE ÇA FAIT (vue d'ensemble)

Avant d'envoyer des données à l'API, chaque formulaire du frontend valide les entrées utilisateur en JavaScript. Cette validation côté client (frontend) est une première ligne de défense : elle évite un aller-retour serveur inutile si les données sont invalides, et donne un feedback immédiat à l'utilisateur. Elle NE remplace PAS la validation backend (qui est la vraie barrière de sécurité) — c'est une double validation pour l'expérience utilisateur et pour réduire la charge serveur.

## 2. SCHÉMA DE LA TABLE

Pas de table concernée directement — les validations portent sur les entrées utilisateur avant qu'elles deviennent des requêtes API. Les champs validés correspondent aux colonnes des tables `users`, `recipes` et `comments`.

### Champs validés par formulaire

| Page | Champs | Règles |
|---|---|---|
| register.js | username, email, password, confirm | pseudo >= 2, password >= 8, password == confirm, tous requis |
| login.js | email, password | tous requis |
| submit.js | title, ingredients, steps, anecdote, category, cost, prep_time | tous requis (champ manquant = alerte) |
| app.js (modal login) | email, password | tous requis |
| detail.js (handleCommentSubmit) | pseudo (si guest), comment, rating | pseudo requis si non connecté, comment >= 3 |

## 3. LE CODE

### 3.1 — register.js (frontend/public/js/register.js:22-44)

```javascript
if (!username || !email || !password || !confirm) {
    registerError.textContent = 'Veuillez remplir tous les champs.';
    registerError.style.display = 'block';
    return;
}
if (username.length < 2) {
    registerError.textContent = 'Le pseudo doit contenir au moins 2 caractères.';
    // ...
}
if (password.length < 8) {
    registerError.textContent = 'Le mot de passe doit contenir au moins 8 caractères.';
    // ...
}
if (password !== confirm) {
    registerError.textContent = 'Les mots de passe ne correspondent pas.';
    // ...
}
```

### 3.2 — login.js (frontend/public/js/login.js:20-24)

```javascript
if (!email || !password) {
    loginError.textContent = 'Veuillez remplir tous les champs.';
    loginError.style.display = 'block';
    return;
}
```

### 3.3 — submit.js (frontend/public/js/submit.js:64-67)

```javascript
if (!data.title || !data.ingredients || !data.steps || !data.anecdote || !data.category || !data.cost || !data.prep_time) {
    alert('Veuillez remplir tous les champs obligatoires.');
    return;
}
```

### 3.4 — app.js, formulaire modal login (frontend/public/js/app.js:181-184)

```javascript
if (!email || !password) {
    alert('Veuillez remplir l\'email et le mot de passe.');
    return;
}
```

### 3.5 — detail.js, validation commentaire (frontend/public/js/detail.js:164-181)

```javascript
function handleCommentSubmit(e) {
    e.preventDefault();
    var form = document.getElementById('review-form');
    var formData = new FormData(form);
    var data = Object.fromEntries(formData.entries());

    var pseudo = data.pseudo && data.pseudo.trim();
    var comment = data.comment && data.comment.trim();

    if (!isAuthenticated() && !pseudo) {
        alert('Veuillez entrer un pseudo.');
        return;
    }
    if (!comment || comment.length < 3) {
        alert('Le commentaire doit contenir au moins 3 caractères.');
        return;
    }
    // ...
```

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

Prenons l'exemple d'une inscription (register.js) :

1. L'utilisateur remplit le formulaire et clique sur "S'inscrire".
2. L'event listener `submit` est déclenché avec `e.preventDefault()` — la soumission HTML classique est bloquée.
3. Les valeurs sont récupérées depuis les champs DOM : `username`, `email`, `password`, `confirm`.
4. `value.trim()` est appliqué à username et email pour supprimer les espaces blancs au début/fin. Le password n'est pas trimé (les espaces dans un mot de passe sont significatifs).
5. **Première vérification** : tous les champs sont-ils remplis ? Si non, message "Veuillez remplir tous les champs." et return (arrêt du traitement).
6. **Deuxième vérification** : `username.length < 2` → message spécifique.
7. **Troisième vérification** : `password.length < 8` → message spécifique.
8. **Quatrième vérification** : `password !== confirm` → message spécifique.
9. Si tout est valide, l'erreur précédente est masquée (`registerError.style.display = 'none'`).
10. La fonction `registerUser(username, email, password)` de auth.js est appelée, qui envoie la requête POST à `/api/v1/auth/register`.
11. En cas de succès, le formulaire est caché et un message de succès s'affiche.
12. En cas d'erreur (ex: email déjà utilisé), le catch attrape l'erreur et affiche le message retourné par l'API dans la zone d'erreur.

Pour le commentaire (detail.js), le flux est similaire mais avec une particularité : si l'utilisateur est connecté (`isAuthenticated()`), le champ pseudo n'est pas requis. Sinon, il devient obligatoire. Puis la fonction `submitComment()` est appelée, et après succès, le formulaire est réinitialisé et la liste des commentaires est re-rendue.

## 5. ANALOGIE

C'est comme un videur à l'entrée d'une boîte de nuit qui vérifie que les gens ont bien 18 ans avant de les laisser entrer. S'ils n'ont pas la majorité, pas la peine d'aller jusqu'au comptoir (le serveur) pour se faire servir — ils sont refoulés à la porte. Mais le videur n'est pas infaillible (un faux papier pourrait passer), donc le barman (le backend) vérifie aussi les pièces d'identité une fois à l'intérieur.

## 6. PIÈGES CLASSIQUES

### Piège #1 : Validation frontend uniquement

Un utilisateur malveillant peut contourner la validation frontend en désactivant JavaScript ou en envoyant une requête directement avec curl/Postman. La validation frontend est une commodité UX, PAS une mesure de sécurité. Sans validation backend robuste (express-validator + Joi/schémas), une simple requête HTTP peut injecter des données invalides.

### Piège #2 : Affichage des messages d'erreur

Les messages d'erreur (`registerError.textContent = '...'`) sont écrits en innerHTML potentiel si on utilisait `innerHTML`. Ici c'est du `textContent`, donc pas de risque XSS (le texte est échappé automatiquement). Mais la propriété `style.display = 'block'` doit être réinitialisée (`style.display = 'none'`) avant chaque nouvelle validation, sinon des messages d'erreur obsolètes persistent.

### Piège #3 : Confirmation de mot de passe incohérente

La vérification `password !== confirm` compare la valeur brute. Si l'utilisateur tape un espace à la fin du mot de passe dans un champ mais pas dans l'autre, la comparaison échoue sans que l'utilisateur comprenne pourquoi (les espaces sont invisibles à l'écran). `trim()` devrait être utilisé des deux côtés ou alors pas du tout — l'incohérence est source de bugs.

### Piège #4 : Pas de validation email côté frontend

Dans register.js, l'email n'est pas validé côté frontend (pas de regex, pas de vérification de format). La validation est uniquement côté backend. Un utilisateur peut taper "pasunemail" et le formulaire sera accepté localement avant que l'API ne le rejette. C'est un choix discutable (gain de temps vs expérience utilisateur dégradée).

## 7. ET SI ON FAISAIT AUTREMENT ?

**Validation déclarative avec attributs HTML5** : On pourrait ajouter `required`, `minlength="8"`, `type="email"` directement sur les champs HTML. Le navigateur bloquerait la soumission sans JavaScript. Mais le style par défaut des messages d'erreur natifs du navigateur varie selon le navigateur OS — moins de contrôle sur l'apparence et la langue des messages.

**Utiliser une bibliothèque de validation** : Des librairies comme Validator.js (côté client) permettraient de définir des règles de validation déclaratives (champs requis, longueur min, format email) plus simplement. Mais le projet interdit les librairies externes sans justification — la validation maison en 5 lignes est suffisante ici.

**Validation temps réel (oninput)** : Au lieu d'attendre la soumission, valider chaque champ quand l'utilisateur tape. Meilleure UX mais plus complexe (gérer les erreurs qui disparaissent/ réapparaissent, éviter de montrer "pseudo trop court" alors que l'utilisateur est en train de finir de taper).

## 8. CHECKLIST POUR LE JURY

- [ ] Comprendre pourquoi la validation frontend ne remplace PAS la validation backend
- [ ] Expliquer le rôle de `e.preventDefault()` — empêcher le rechargement de la page
- [ ] Justifier les messages d'erreur en français (cohérence avec le public cible francophone)
- [ ] Savoir où est faite la validation email (uniquement backend) et pourquoi c'est un risque
- [ ] Expliquer la gestion du pseudo/guest dans detail.js (condition isAuthenticated)
- [ ] Comprendre le mécanisme d'affichage/masquage des erreurs (style.display)
- [ ] Connaître la différence entre `alert()` et `textContent` pour l'affichage des erreurs
