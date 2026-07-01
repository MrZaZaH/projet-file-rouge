# 22 — Middleware Chain (Ordre d'exécution Express)

## 1. CE QUE ÇA FAIT (vue d'ensemble)

L'ordre dans lequel les middlewares sont déclarés dans `app.js` définit la chaîne d'exécution pour chaque requête. Express exécute chaque middleware dans l'ordre, et chaque middleware peut soit passer à la suite (`next()`), soit stopper la chaîne (réponse directe). Si l'ordre est mauvais, certaines fonctionnalités ne marchent pas (ex: body parsing après les routes).

## 2. SCHÉMA DE LA TABLE

Pas de table — c'est l'architecture de l'application Express.

## 3. LE CODE

### 3.1 — app.js (`app.js:27-101`, ordre complet)

```javascript
// 1 ─── Security headers (doit être le plus tôt possible)
app.use(helmetMiddleware);
app.use(corsMiddleware);

// 2 ─── Rate limiting (avant les routes, après CORS pour les vrais IPs)
app.use(globalLimiter);

// 3 ─── Request logging (avant body parsing pour logger aussi les malformés)
app.use(httpLogger);

// 4 ─── Body parsing (après logging, avant routes)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// 5 ─── Static files (avant routes pour servir le frontend)
app.use(express.static(path.join(__dirname, 'frontend', 'public')));

// 6 ─── Routes (le coeur de l'API)
app.get('/health', ...);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/recipes', recipeRoutes);
// ...

// 7 ─── 404 (doit être APRÈS toutes les routes)
app.use((req, res) => {
    res.status(404).json({ success: false, error: { message: `Route ${req.method} ${req.originalUrl} not found` } });
});

// 8 ─── Error handler (doit être le TOUT dernier)
app.use(errorHandler);
```

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

1. Une requête HTTP arrive sur le serveur.
2. `helmetMiddleware` définit les en-têtes de sécurité (Content-Security-Policy, X-Frame-Options, etc.) — doit être le plus tôt possible pour que TOUTES les réponses soient sécurisées.
3. `corsMiddleware` ajoute les en-têtes CORS — placé avant le rate limiting pour que les requêtes OPTIONS (preflight) ne soient pas comptées dans le quota.
4. `globalLimiter` vérifie le compteur de requêtes (100 req/15 min) et rejette immédiatement si dépassé.
5. `httpLogger` enregistre la requête dans les logs AVANT qu'elle soit parsée ou traitée.
6. `express.json()` parse le body JSON (limité à 10kb). Si le body est > 10kb, rejet silencieux.
7. `express.static()` sert les fichiers du frontend public.
8. La requête arrive dans les routes — `/health` d'abord (hors API), puis les routes admin, auth, recipes, etc.
9. Si aucune route n'a matché, le middleware 404 est exécuté.
10. Si une erreur est passée via `next(err)`, le `errorHandler` (4 paramètres) est le seul à la rattraper.

## 5. ANALOGIE

C'est une chaîne de montage dans une usine :
- Poste 1 (Helmet) : pose les étiquettes de sécurité sur le produit.
- Poste 2 (CORS) : vérifie que le produit est autorisé à sortir.
- Poste 3 (Rate limiting) : compteur de pièces — si quota max, rejet.
- Poste 4 (Logger) : scanne le code-barres pour tracer la pièce.
- Poste 5 (Body parser) : déballage et inspection du contenu.
- Poste 6 (Routes) : assemblage final selon le type de pièce.
- Poste 7 (404) : pièce inconnue → poubelle.
- Poste 8 (Error handler) : pièce cassée → réparation ou mise au rebut.

Si on intervertit deux postes, la chaîne de montage ne marche plus.

## 6. PIÈGES CLASSIQUES

### Piège #1 : Body parser APRÈS les routes

```javascript
// MAUVAIS — les routes reçoivent req.body = undefined
app.use('/api/v1', routes);
app.use(express.json());
// req.body est undefined dans les routes car le body n'a pas été parsé
```

```javascript
// BON — body parser avant les routes
app.use(express.json());
app.use('/api/v1', routes);
```

### Piège #2 : 404 AVANT les routes

```javascript
// MAUVAIS — toutes les requêtes reçoivent 404
app.use((req, res) => res.status(404).json(...));
app.use('/api/v1', routes);
// Le middleware 404 intercepte TOUT, les routes ne sont jamais atteintes
```

```javascript
// BON — 404 après toutes les routes
app.use('/api/v1', routes);
app.use((req, res) => res.status(404).json(...));
```

### Piège #3 : Error handler avant les routes

```javascript
// MAUVAIS — l'error handler ne rattrapera rien
app.use(errorHandler);
app.use('/api/v1', routes);
// L'error handler DOIT être le dernier — Express vérifie le nombre de params
// mais seul le dernier middleware est appelé pour next(err)
```

```javascript
// BON — error handler en dernier
app.use('/api/v1', routes);
app.use(errorHandler);
```

### Piège #4 : Rate limiting APRÈS les routes lourdes

Mettre le rate limiter après les routes qui font des opérations coûteuses (DB, calculs) gaspille des ressources. Il doit être le plus tôt possible pour rejeter rapidement les requêtes excessives sans travail inutile.

### Piège #5 : Helmet après CORS

Helmet doit être avant CORS car certains headers helmet (comme `X-Content-Type-Options`) doivent être posés avant que CORS n'ajoute les siens. L'ordre helmet → CORS garantit que tous les headers de sécurité sont présents avant les headers cross-origin.

### Piège #6 : Validation APRÈS le contrôleur (per-route chain)

```javascript
// MAUVAIS — le contrôleur reçoit des données non validées
router.post('/', authenticate, RecipeController.createRecipe, recipeBodyRules, validate);
// Le contrôleur s'exécute avant la validation — les données invalides passent
```

```javascript
// BON — validation avant le contrôleur
router.post('/', authenticate, recipeBodyRules, validate, RecipeController.createRecipe);
// Si validate renvoie 422, le contrôleur n'est jamais atteint
// → la normalisation string→array dans le modèle devient dead code
```

Conséquence : toute normalisation de format dans le modèle (ex: `split(',')` sur ingredients) n'est jamais exécutée car la validation middleware garantit que seuls des tableaux arrivent jusqu'au contrôleur et au modèle.

## 7. ET SI ON FAISAIT AUTREMENT ?

### Option A : Inline tous les middlewares dans app.js

Certains projets mettent TOUTE la configuration dans app.js sans séparation. Ça devient vite illisible (500+ lignes). La séparation en fichiers (security.js, logger.js, errorHandler.js) rend chaque module testable et maintenable.

### Option B : Utiliser un framework comme Fastify

Fastify a un système de plugins avec encapsulation qui rend l'ordre moins critique car chaque plugin est autonome. Mais Express reste plus simple et plus connu, et l'ordre bien maîtrisé n'est pas un problème.

### Option C : Routes avant logging

Logger après l'exécution des routes ferait perdre la trace des erreurs et des temps de réponse. Le logger doit être AVANT les routes pour mesurer le début de la requête et après pour la fin (via un timer), ce qui est fait ici.

## 8. CHECKLIST POUR LE JURY

- [ ] Helmet et CORS sont les premiers middlewares de la chaîne (sécurité avant tout).
- [ ] Rate limiting est placé entre CORS et le logging (rejet rapide sans traitement).
- [ ] Body parsing (json/urlencoded) est déclaré AVANT les routes.
- [ ] Les routes sont déclarées AVANT le middleware 404.
- [ ] Le error handler (4 paramètres) est le TOUT dernier middleware.
- [ ] `/health` est déclaré avant /api/v1/* (pas de collision).
- [ ] `/random` est déclaré avant `/:id` dans recipeRoutes (évite que "random" soit interprété comme un ID).
- [ ] `authLimiter` est appliqué uniquement sur les routes auth (pas sur toutes les routes).
- [ ] La taille du body est limitée (`limit: '10kb'`) pour éviter les attaques par body massif.
- [ ] L'ordre per-route `authenticate → rules → validate → controller` garantit que la validation bloque avant le modèle.
