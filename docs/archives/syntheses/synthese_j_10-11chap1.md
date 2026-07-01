__Synthèse – Jour 10 /11 chap1 Auth User (jwt) / Auth Routes__

__Ce qu'on a fait__

- Créé AuthController.js (register, login, getMe)
- Créé jwtAuth.js (middleware authenticate)
- Créé authRoutes.js (routes \+ validation express-validator)
- Branché /api/v1/auth dans app.js
- Corrigé findByEmailWithPassword → ajout created_at
- Testé et validé les 3 routes

__Problèmes rencontrés__

- __Postman__ : difficulté à configurer le Bearer token → résolu via onglet Authorization → Bearer Token
- __Incohérence created_at__ : absent du login car findByEmailWithPassword ne le sélectionnait pas → corrigé

__Décisions techniques prises__

- JWT HS256, expiration 24h, payload minimal (id, role, username)
- bcrypt 12 rounds
- Messages d'erreur volontairement vagues au login (pas d'énumération d'utilisateurs)
- Versioning /api/v1/
- JWT_SECRET dans .env uniquement

__Ce qui a été écarté__

- bcrypt dans le modèle → responsabilité du contrôleur
- created_at dans le payload JWT → inutile, alourdit le token

__Corrections de nommage__

Dans authRoutes.js, la ligne d'import du middleware devient :

const \{ authenticate \} = require('../middlewares/jwtAuth');

Dans app.js :

const authRoutes = require('./src/routes/authRoutes');

Rien d'autre ne change — le reste référence AuthController et User qui n'ont pas été renommés.

