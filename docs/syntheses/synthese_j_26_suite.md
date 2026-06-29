## Synthèse – Jour 26 (suite) — Blocage CSP et externalisation des scripts

### Ce qu'on a fait
- Diagnostic du blocage "Chargement des recettes..." infini sur la homepage
- Identification de la cause racine : Helmet bloque les scripts inline via `Content-Security-Policy: script-src 'self'`
- Ajout d'un timeout `AbortController` à `fetchRecipes()` pour éviter les promesses pendantes
- Ajout d'un guard `Array.isArray()` dans `fetchRecipes()` pour éviter les crashs si `data` est null
- Ajout d'un try/catch dans `renderRecipes()` pour garantir le masquage du loader même en cas d'erreur
- Externalisation de tous les scripts inline de `index.html` et `recipe.html` dans des fichiers `.js` dédiés
- Retour à la config Helmet par défaut (plus besoin de CSP customisé)

### Problèmes rencontrés

#### Problème 1 : "Chargement des recettes..." reste indéfiniment
- **Contexte** : la page d'accueil affiche le loader mais ne montre jamais les recettes. Aucune erreur visible dans l'interface.
- **Options envisagées** :
  1. Ajouter un timeout à `fetch()` via `AbortController` (10s) → utile si la requête pend, mais ne résout pas la cause racine
  2. Customiser Helmet CSP avec `'unsafe-inline'` → fonctionnel mais affaiblit la sécurité
  3. Externaliser les scripts inline dans des fichiers `.js` → solution propre et définitive
- **Décision retenue** : option 3. Les scripts inline sont déplacés dans `home.js` et `detail.js`, servis comme fichiers statiques. CSP `script-src 'self'` les autorise naturellement.

#### Problème 2 : La console navigateur révèle une erreur CSP
- **Contexte** : `Content-Security-Policy: script-src 'self'` bloque l'exécution du `<script>` inline dans le HTML. Le JS est exécuté PUIS immédiatement annulé par le navigateur.
- **Options envisagées** :
  1. Désactiver CSP (`helmet({ contentSecurityPolicy: false })`) — perte de protection XSS
  2. Ajouter `'unsafe-inline'` — acceptable en dev, pas bien en prod
  3. Externaliser les scripts — meilleure pratique, CSP par défaut intact
- **Décision retenue** : option 3. Plus aucun script inline dans les pages HTML.

#### Problème 3 : `fetchRecipes()` retourne un objet au lieu d'un tableau si `data` est null
- **Contexte** : `result.data || result` renvoie l'objet `{success, data, message}` si `data` est falsy → `renderRecipes()` reçoit un objet → `forEach` plante → le loader ne se masque jamais.
- **Solution** : `Array.isArray(result.data) ? result.data : []` garantit de toujours retourner un tableau.

### Décisions techniques prises
- Tout le JS frontend doit être dans des fichiers `.js` externes, pas dans des balises `<script>` inline.
- Ordre de chargement strict : `auth.js` → `app.js` (utilitaires partagés) → `home.js` ou `detail.js` (spécifique page).
- `home.js` : code spécifique à la page d'accueil (filtres, grille, init).
- `detail.js` : code spécifique à la page détail recette (fetch, render, reviews, share).
- Retour strict à la config Helmet par défaut — pas de configuration CSP personnalisée.

### Ce qui a été écarté et pourquoi
- **Timeout seul sans externalisation** : ne résout pas la cause racine (CSP bloque les scripts). Gardé comme garde-fou mais insuffisant seul.
- **`'unsafe-inline'` dans CSP** : acceptable mais pas idéal. Inutile maintenant que les scripts sont externalisés.
- **Désactiver complètement CSP** : trop risqué, supprime une protection XSS importante.
