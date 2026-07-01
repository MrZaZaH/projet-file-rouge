# Sécurité : Helmet, CORS, Rate Limiting

## Contexte

Une API exposée sur Internet doit se protéger contre des attaques courantes : scraping, brute-force, clickjacking, requêtes cross-origin non autorisées.

---

## Helmet

### Pourquoi Helmet ?

Helmet configure automatiquement ~15 headers HTTP de sécurité (`src/middlewares/security.js:24`) :

```javascript
const helmetMiddleware = helmet();
```

| Header | Protège contre |
|---|---|
| `X-Frame-Options` | Clickjacking (iframe externe) |
| `X-Content-Type-Options` | MIME sniffing (ex: JS déguisé en image) |
| `Strict-Transport-Security` | Forcer HTTPS |
| `Content-Security-Policy` | XSS (restreint les sources de scripts) |

**Risque de l'inverse (pas de helmet) :** un attaquant pourrait afficher le site dans une iframe transparente (clickjacking) ou injecter du contenu non sécurisé.

### En version 2

- Configurer CSP plus stricte (actuellement tout open)
- Ajouter `expect-ct` pour Certificate Transparency

---

## CORS

### Pourquoi une whitelist explicite ?

`src/middlewares/security.js:33-48` :

```javascript
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:5500'];
```

**Risque de l'inverse (`origin: '*'`) :** n'importe quel site peut faire des requêtes AJAX vers l'API. Si un utilisateur est connecté, un site malveillant peut voler ses données (CSRF-like via CORS).

**Pourquoi `!origin` est autorisé :** les appels serveur (curl, Postman, test) n'ont pas d'en-tête Origin — on les laisse passer.

### En version 2

- Gérer les méthodes HTTP et headers dynamiquement selon les besoins des routes
- Bloquer les requêtes avec Origin non autorisée avant même d'atteindre le routeur

---

## Rate Limiting

### Pourquoi deux limiteurs différents ?

`src/middlewares/security.js:58-98` :

| Limiteur | Max | Routes | Objectif |
|---|---|---|---|
| Global | 100 req/15min | Toutes | Anti-scraping, flood basique |
| Auth | 10 req/15min | `/api/v1/auth/*` | Anti brute-force login |

**Risque de l'inverse (un seul limiteur à 100 partout) :** un attaquant peut tenter 100 mots de passe différents avant d'être bloqué. Avec la limite auth à 10, il est bloqué après 10 tentatives.

**Risque de l'inverse (un seul limiteur à 10 partout) :** un utilisateur qui navigue normalement (affiche des recettes, lit des commentaires) dépasse 10 requêtes en moins d'une minute.

### Pourquoi désactivé en test ?

`src/middlewares/security.js:64` :

```javascript
const globalLimiter = process.env.NODE_ENV === 'test'
    ? noopMiddleware
    : rateLimit({...})
```

Les tests envoient des requêtes en rafale — le rate limiter les ferait échouer aléatoirement.

### En version 2

- Rate limiting par utilisateur (pas seulement par IP) pour les connectés
- Limiteurs spécifiques par route : `/api/v1/recipes` GET = 200, POST = 20
- Retourner un header `Retry-After` pour que le client sache quand réessayer
