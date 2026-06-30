# Authentification JWT

## Contexte

L'API REST doit identifier les utilisateurs pour protéger certaines routes (créer une recette, noter, administrer) tout en permettant un accès public aux recettes publiées.

---

## Pourquoi JWT et pas des sessions ?

### Option écartée : sessions avec cookie

**Comment ça marche :** le serveur crée une session, stocke l'ID dans un cookie, le navigateur l'envoie à chaque requête.

| Critère | Session cookie | JWT |
|---|---|---|
| Stockage | Côté serveur (RAM/Redis) | Côté client (token auto-portant) |
| Scalabilité | Requiert un store partagé (Redis) entre instances | Aucun store — n'importe quelle instance peut vérifier |
| API mobile | Les cookies ne sont pas toujours pratiques | Header Authorization universel |
| Expiration | Gérée côté serveur | Intégrée dans le token (exp claim) |
| Révocation | Immédiate (supprimer la session) | Pas possible avant expiration (sauf blacklist) |

**Risque de l'inverse (sessions) :** pour scale à plusieurs serveurs, il faudrait Redis ou sticky sessions. En MVP, c'est de la complexité inutile. Par contre, JWT signifie qu'un token volé est valide jusqu'à expiration.

### Ce qui est fait

Un middleware `authenticate` (`src/middlewares/jwtAuth.js:15`) vérifie le token Bearer dans le header. Le payload contient `{ id, role, username }`. Durée de vie : 24h.

```javascript
// src/middlewares/jwtAuth.js:33
const decoded = jwt.verify(token, process.env.JWT_SECRET);
req.user = decoded;
next();
```

### En version 2

- Ajouter une blacklist Redis pour révoquer les tokens immédiatement (ex: changement de mot de passe)
- Refresh tokens : un token court (15min) + un token long (7 jours) pour renouveler sans re-login
- Rotation de clé JWT (plusieurs secrets, rotation périodique)

---

## Pourquoi 3 middlewares différents ?

### Le problème

Toutes les routes n'ont pas les mêmes besoins d'auth :

| Besoin | Middleware |
|---|---|
| Route strictement protégée (créer recette, noter) | `authenticate` → 401 si pas de token |
| Route admin (modération, stats) | `authenticate` + `requireAdmin` → 403 si pas admin |
| Route ouverte à tous avec bonus si connecté (commentaire) | `attachUser` → continue sans token |

### Ce qui est fait

- `authenticate` (`src/middlewares/jwtAuth.js:15`) : vérifie le token, set `req.user`, ou 401
- `requireAdmin` (`src/middlewares/jwtAuth.js:52`) : vérifie `req.user.role === 'admin'`, ou 403
- `attachUser` (`src/middlewares/jwtAuth.js:68`) : vérifie le token si présent, mais ne bloque jamais

**Risque de l'inverse (un seul middleware qui bloque tout) :** les commentaires invités seraient impossibles sans abaisser la protection générale.

### En version 2

- Ajouter un système de permission fine (ex: `can('moderate')`) plutôt que le binaire admin/user
- Middleware `requireAdmin` actuellement dupliqué (`jwtAuth.js` ET `requireAdmin.js`) — fusionner

---

## Pourquoi bcrypt avec 12 rounds ?

Le hash doit être lent pour ralentir les attaques par force brute.

| Rounds | Temps approximatif | Sécurité |
|---|---|---|
| 10 | ~100ms | Standard OWASP minimum |
| 12 | ~400ms | Recommandé actuellement |
| 14 | ~1.6s | Overkill pour un MVP |

**Risque de l'inverse (moins de rounds) :** un attaquant avec la DB brute-force les mots de passe plus vite. Plus de rounds = utilisateur attend plus longtemps au login.

### En version 2

- Rendre le coût configurable via variable d'environnement
- Ajouter un mécanisme de ré-hash automatique au login si le coût augmente
