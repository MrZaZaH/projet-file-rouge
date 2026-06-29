## Content-Security-Policy (CSP) — "J'ai été mon propre pirate"

### En bref

CSP est un en-tête HTTP qui dit au navigateur **ce qui est autorisé ou non** à s'exécuter sur ta page. C'est comme un videur à l'entrée d'une boîte : tu lui donnes une liste (scripts autorisés, styles autorisés, etc.) et il bloque tout ce qui n'est pas sur la liste.

Quand Helmet est utilisé avec ses réglages par défaut, il envoie `Content-Security-Policy: script-src 'self'`. Ça signifie : "Seuls les fichiers `.js` servis par le même domaine que la page sont autorisés". Les scripts écrits directement dans le HTML avec `<script> /* code */ </script>` sont bloqués — même s'ils sont dans ton propre fichier HTML.

C'est une protection contre les injections XSS : si un pirate arrive à injecter `<script>alerte(pirate)</script>` dans un commentaire, CSP l'empêche de s'exécuter.

### L'épopée complète de la session

**Le symptôme :** page d'accueil bloquée sur "Chargement des recettes..." indéfiniment. "Surprends-moi" renvoie vers la page détail... également bloquée.

**Ce qu'on a fait avant de comprendre :**

1. Vérifié que l'API répond avec `curl` → 6 recettes, 200 OK. Back-end nickel.
2. Ajouté un timeout (`AbortController`) à `fetchRecipes()` → au bout de 10s la requête échoue mais le loader reste.
3. Ajouté `Array.isArray()` guard dans `fetchRecipes()`.
4. Ajouté try/catch dans `renderRecipes()`.
5. Modifié la config CSP d'Helmet pour ajouter `'unsafe-inline'` → toujours bloqué parce que le serveur (qui tournait encore avec l'ancien code) n'était pas redémarré.
6. `Ctrl+F5` à répétition en navigation privée.
7. Joué du `taskkill /F /IM node.exe`.
8. Tapé `npm start` au moins 20 fois.
9. Atteint la limite de rate-limit (429) à force de recharger.
10. Investiguer si c'était CORS, si c'était les middlewares, si c'était la BDD...

**Le vrai problème :** erreur dans la console navigateur. `Content-Security-Policy: script-src 'self'` bloque les scripts inline. Tout le code JavaScript écrit directement dans `<script> ... </script>` dans `index.html` et `recipe.html` est exécuté, puis immédiatement annulé par le navigateur. Les fonctions `init()`, `fetchRecipes()`, `renderRecipes()` n'existent jamais.

**Pourquoi on ne l'a pas vu plus tôt :** l'erreur est **silencieuse côté serveur**. Le serveur reçoit bien la requête GET /, sert le HTML, sert les fichiers CSS/JS externes, mais le navigateur bloque l'exécution du script inline **après** l'avoir reçu. Les logs serveur ne montrent rien d'anormal. Il fallait ouvrir la console du navigateur (F12 → Console).

**La solution :** extraire tout le JavaScript des balises `<script>...</script>` dans des fichiers `.js` externes (`home.js`, `detail.js`). CSP accepte les fichiers externes servis par le même domaine (`'self'`). Plus aucun script inline → Helmet par défaut = tout fonctionne.

**La leçon :** quand le back-end répond (curl marche) mais que le front-end ne bouge pas → **ouvre la console navigateur**. L'erreur était là depuis le début, juste planquée.

### Exemple concret

**BLOQUÉ par CSP :**
```html
<script>
    async function init() {
        const recipes = await fetchRecipes();
        renderRecipes(recipes);
    }
    init();
</script>
```

**AUTORISÉ par CSP :**
```html
<script src="js/home.js"></script>
```

```js
// js/home.js — fichier externe
async function init() {
    const recipes = await fetchRecipes();
    renderRecipes(recipes);
}
init();
```

Même code, deux endroits différents. CSP ne fait pas de différence sur le contenu, seulement sur l'origine (inline vs fichier).

### Points clés

- CSP bloque les scripts inline (`<script>...</script>`). C'est une **protection XSS**, pas un bug.
- Helmet par défaut = `script-src 'self'` : seuls les fichiers `.js` du même domaine sont autorisés.
- Si tu veux des scripts inline : `'unsafe-inline'` (déconseillé en production) ou hash/nonce.
- Si curl répond OK mais que le navigateur ne fait rien : **console du navigateur. Toujours.**
- Les logs serveur ne montreront pas d'erreur CSP — c'est le navigateur qui bloque, pas le serveur.
- Pour un site vanilla JS : zéro script inline, tout dans des fichiers `.js`. C'est plus propre, mieux organisé, compatible CSP.
