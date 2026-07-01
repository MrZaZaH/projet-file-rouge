# 45 — Bouton "Surprends-Moi"

## 1. CE QUE ÇA FAIT (vue d'ensemble)

Le bouton "Surprends-Moi" sur la page d'accueil permet de découvrir une recette aléatoire. Quand l'utilisateur clique dessus, le frontend appelle `GET /api/v1/recipes/random`, qui renvoie une recette au hasard parmi les recettes publiées. Si la requête réussit, l'utilisateur est redirigé immédiatement vers la page détail de cette recette. Aucune recette de fallback n'est affichée en cas d'échec — soit ça marche, soit rien ne se passe (avec une erreur dans la console).

## 2. SCHÉMA DE LA TABLE

Pas de table spécifique. La route backend `/api/v1/recipes/random` exécute une requête SQL sur la table `recipes` :

```sql
SELECT * FROM recipes
WHERE status = 'published' AND deleted_at IS NULL
ORDER BY RAND() LIMIT 1
```

`ORDER BY RAND()` tire une ligne aléatoire. C'est volontairement simple et pédagogique (pas performant pour des millions de lignes, mais pour un projet MVP avec quelques centaines de recettes, ça suffit).

## 3. LE CODE

### 3.1 — app.js, fonction surpriseMe (frontend/public/js/app.js:81-92)

```javascript
async function surpriseMe() {
    try {
        const response = await fetch('/api/v1/recipes/random');
        if (response.ok) {
            const result = await response.json();
            const recipe = result.data || result;
            window.location.href = 'recipe.html?id=' + recipe.id;
        }
    } catch (error) {
        console.error('Surprise failed:', error);
    }
}
```

### 3.2 — app.js, attachement de l'événement dans initShared (frontend/public/js/app.js:123-126)

```javascript
const surpriseBtn = document.getElementById('surprise-btn');
if (surpriseBtn) {
    surpriseBtn.addEventListener('click', surpriseMe);
}
```

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

1. L'utilisateur charge la page d'accueil (index.html). Le `DOMContentLoaded` déclenche `initShared()`.
2. `initShared()` cherche dans le DOM un élément avec `id="surprise-btn"` (le bouton "Surprends-Moi").
3. Si le bouton existe, un `event listener` est attaché : `click → surpriseMe`.
4. L'utilisateur clique sur le bouton "Surprends-Moi".
5. `surpriseMe()` est exécutée en tant que fonction asynchrone (`async`).
6. `fetch('/api/v1/recipes/random')` envoie une requête GET à l'API.
   - Pas de header particulier, pas de token requis (c'est un appel public).
   - La route backend exécute `SELECT ... ORDER BY RAND() LIMIT 1` sur les recettes publiées.
7. Si `response.ok` est `true` (code HTTP 200) :
   a. `response.json()` extrait le corps JSON.
   b. `result.data || result` : la réponse standardisée est `{ success: true, data: { ... } }`, donc on prend `result.data`. Mais si le format est différent, on prend `result` directement (fallback).
   c. `window.location.href = 'recipe.html?id=' + recipe.id` : redirection immédiate vers la page détail de la recette avec son ID dans l'URL.
8. Si `response.ok` est `false` (ex: 404, 500) :
   - La condition `if (response.ok)` n'est pas remplie → la fonction se termine silencieusement. Rien ne se passe pour l'utilisateur.
9. Si une erreur réseau survient (fetch échoue, pas de connexion) :
   - Le `catch(error)` intercepte l'exception, logge dans la console, et ne fait rien d'autre.
   - L'utilisateur ne voit aucun message d'erreur (pas d'alerte, pas de notification).

## 5. ANALOGIE

C'est comme une machine à distribuer des bonbons surprise : tu appuies sur le bouton, la machine pioche au hasard dans son stock et te donne un bonbon. Si la machine est vide ou cassée, rien ne sort (et tu entends un petit bruit mécanique — le `console.error` — que seul le technicien entendra). Tu ne reçois pas de bonbon de substitution. Tu réessaies plus tard.

## 6. PIÈGES CLASSIQUES

### Piège #1 : Aucun feedback en cas d'échec

Si la requête échoue (API down, réseau coupé), l'utilisateur clique et... rien. Le bouton ne donne aucun signe de vie : pas de message d'erreur, pas de loading state, pas de changement visuel. C'est déroutant pour l'utilisateur : il ne sait pas si ça a marché ou non. Un état de chargement (désactiver le bouton, changer son texte) et un message d'erreur minimal amélioreraient l'UX.

### Piège #2 : Pas de cache control

La requête fetch est faite sans en-tête de cache. Si le navigateur met en cache la réponse de `/api/v1/recipes/random`, l'utilisateur pourrait obtenir la même recette aléatoire plusieurs fois de suite. L'ajout d'un paramètre anti-cache (`?t=Date.now()`) ou d'un header `Cache-Control: no-cache` côté backend résoudrait ça.

### Piège #3 : ORDER BY RAND() sur grande table

`ORDER BY RAND()` est célèbre pour être catastrophique en performance sur de grandes tables : MariaDB doit charger TOUTES les lignes, leur attribuer un nombre aléatoire à chacune, puis trier le tout, pour n'en garder qu'une. Pour un projet MVP avec des centaines/milliers de recettes, ça passe. Pour des millions, il faudrait une approche différente (ex: compter le total, choisir un offset aléatoire, et faire `LIMIT 1 OFFSET ?`).

### Piège #4 : window.location.href écrase la navigation

La redirection avec `window.location.href` est immédiate et non annulable. Si l'utilisateur clique par erreur, il est embarqué sur la page recette. On pourrait proposer un aperçu avant redirection (afficher la recette dans une modale, avec un bouton "Voir la recette complète"), mais ça complexifie l'implémentation.

## 7. ET SI ON FAISAIT AUTREMENT ?

**Afficher la recette dans une modale/overlay** : Au lieu de rediriger, on pourrait charger la recette aléatoire via fetch et l'afficher dans une modale sur la page d'accueil. L'utilisateur peut décider s'il veut voir le détail complet. Plus riche, mais nécessite du HTML/CSS supplémentaire et un appel API avec les données complètes.

**Algorithme de random pondéré** : Au lieu du pur hasard, on pourrait favoriser les recettes les mieux notées ou les plus récentes. Par exemple : 70% de chance de tomber sur une recette notée 4+, 30% sur le reste. Mais ça sort de la simplicité du "Surprends-Moi" et rend le mécanisme opaque pour l'utilisateur.

**Stockage local du dernier ID** : On pourrait stocker dans localStorage l'ID de la dernière recette suggérée pour éviter de tomber deux fois de suite sur la même. Simple à faire avec `localStorage.setItem('last_surprise', recipe.id)` et en passant l'ID comme paramètre à l'API (`/api/v1/recipes/random?not=${lastId}`).

## 8. CHECKLIST POUR LE JURY

- [ ] Comprendre le flux : clic → fetch → redirection
- [ ] Savoir expliquer pourquoi `async/await` est utilisé (code asynchrone lisible)
- [ ] Expliquer la structure de réponse standardisée `{ success, data }` et pourquoi `result.data || result`
- [ ] Connaître la limitation de `ORDER BY RAND()` (performance)
- [ ] Justifier l'absence de fallback statique (cohérence avec les specs)
- [ ] Proposer une amélioration pour le feedback utilisateur en cas d'échec
- [ ] Comprendre pourquoi `window.location.href` change de page (navigation complète, pas de SPA)
