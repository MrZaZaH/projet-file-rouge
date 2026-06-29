# Synthèse Jour 25 — Bis : Corrections post-déploiement

## Contexte

La session jour 25 a créé les pages login.html/register.html dédiées et remplacé la modal de connexion par une redirection. En test, le bouton "Se connecter" sur index.html affichait `Cannot GET /login.html` (Live Server) et `ERR_FILE_NOT_FOUND` (ouverture fichier local). Ce fichier documente les corrections apportées.

## Problème identifié

Le chemin absolu `/login.html` dans `auth.js` ne fonctionnait que sur Express. Sur Live Server (qui sert depuis la racine du projet), il cherchait `login.html` à la racine du projet. En `file://`, il cherchait à la racine du disque C:.

## Corrections appliquées

### auth.js (3 lignes modifiées)
- Ligne 149 : `userBtn.onclick` → `openLoginModal` (ouvre la modal au lieu de rediriger)
- Ligne 155 : `mobileUserBtn.onclick` → `openLoginModal` (idem pour mobile)
- Ligne 163 : `requireAuth()` → chemin relatif `'login.html'` au lieu d'absolu `'/login.html'`

### Décision : Modal conservée sur index, login.html gardé pour les redirections

- **index.html** : le bouton "Se connecter" ouvre la modal (rapide, pas de navigation)
- **login.html** conservé pour les redirections depuis recipe.html (bouton sauvegarder), submit.html (poster), register.html (lien "Se connecter")

### Autres corrections non commitées du jour 25 rattrapées

- Routes API `/api/recipes` → `/api/v1/recipes` dans index.html, app.js, recipe.html, submit.html
- Chemin static Express : `./frontend/public` → `path.join(__dirname, 'frontend', 'public')` dans app.js
- ID formulaire login.html : `login-form` → `login-page-form` (conflit avec modal index.html)

## Documentation ajoutée

- `docs/memos/memo-serveurs.md` : mémo expliquant les 5 façons de servir une app web (file://, Live Server, http-server, Express, Nginx) avec tableau récapitulatif
- `frontend/docs/frontend-report.md` : sections login mises à jour

## Enseignements

- Toujours utiliser `npm start` (Express) pour tester l'application complète — Live Server ne gère pas les appels API
- Les chemins absolus (`/fichier.html`) ne marchent qu'avec Express. Les chemins relatifs (`fichier.html`) marchent partout
- Vérifier le mode de serveur utilisé avant de chercher une erreur ailleurs
