# 01 — Authentification JWT (Register / Login / Token)

## 1. CE QUE ÇA FAIT (vue d'ensemble)

L'authentification JWT permet à un utilisateur de :
- **Créer un compte** (`POST /api/v1/auth/register`) avec username, email, mot de passe
- **Se connecter** (`POST /api/v1/auth/login`) avec email + mot de passe
- **Récupérer ses infos** (`GET /api/v1/auth/me`) via son token
- **Protéger les routes** qui nécessitent d'être connecté (middleware `authenticate`)
- **Identifier optionnellement** un utilisateur sans le bloquer (middleware `attachUser` pour les invités)

Le "token" est un **JWT (JSON Web Token)** — un petit fichier JSON signé numériquement que le serveur génère à la connexion et que le client renvoie à chaque requête. C'est comme un **badge d'entrée** : le serveur le signe avec un sceau secret (`JWT_SECRET`), et si quelqu'un essaye de le modifier, la signature ne correspond plus et le serveur le rejette.

---

## 2. SCHÉMA DE LA TABLE

**Fichier :** `database/scripts/03_create_tables.sql:32-43`

```sql
CREATE TABLE IF NOT EXISTS users (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username        VARCHAR(50)  NOT NULL UNIQUE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    points          INT UNSIGNED NOT NULL DEFAULT 0,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at      DATETIME NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

Points clés du schéma :
- **`password_hash`** : on ne stocke JAMAIS le mot de passe en clair. Seulement son hash (le résultat du hachage bcrypt).
- **`UNIQUE` sur email et username** : garantit qu'on ne peut pas avoir deux comptes avec le même email ou pseudo.
- **`role ENUM('user', 'admin')`** : permet de différencier les utilisateurs normaux des administrateurs.
- **`deleted_at`** : soft delete — on ne supprime jamais un compte, on le marque comme supprimé.
- **`ON UPDATE CURRENT_TIMESTAMP`** : la colonne `updated_at` se met automatiquement à jour à chaque modification de la ligne.

---

## 3. LE CODE

### 3.1 — Le modèle User (accès aux données)

**Fichier :** `src/models/User.js`

Deux méthodes essentielles pour l'auth :

#### `findByEmailWithPassword()` (ligne 18) — UNIQUEMENT pour le login

```js
static async findByEmailWithPassword(email) {
    const [rows] = await pool.execute(
        `SELECT id, username, email, password_hash, role, points, created_at
         FROM users 
         WHERE email = ? AND deleted_at IS NULL`,
        [email]
    );
    return rows[0] || null;
}
```

Pourquoi une méthode séparée avec `password_hash` ? Parce que le `password_hash` ne doit JAMAIS sortir du serveur. Cette méthode est appelée **uniquement** par le controller `AuthController.login()` pour vérifier le mot de passe. Toutes les autres méthodes (`findByEmail`, `findById`, `create`) ne retournent JAMAIS le `password_hash`.

Le paramètre **`?`** est un placeholder — `pool.execute()` remplace `?` par la valeur de `[email]` en l'échappant automatiquement. C'est ce qui empêche les injections SQL.

#### `create()` (ligne 57) — pour l'inscription

```js
static async create({ username, email, password_hash, role = 'user' }) {
    const [result] = await pool.execute(
        `INSERT INTO users (username, email, password_hash, role)
         VALUES (?, ?, ?, ?)`,
        [username, email, password_hash, role]
    );
    return User.findById(result.insertId);
}
```

Note : le `password_hash` arrive **déjà hashé** depuis le controller. Le modèle ne fait que le stocker. Le `role` par défaut est `'user'` — même si quelqu'un essaye d'envoyer `role: 'admin'` depuis le frontend, ça ne marchera pas parce que le frontend n'a pas accès à cette méthode directement (elle est appelée côté serveur seulement).

### 3.2 — Le controller AuthController (logique métier)

**Fichier :** `src/controllers/AuthController.js`

#### `register()` (ligne 16) — Inscription

```js
static async register(req, res, next) {
    try {
        // 1. Vérifier les erreurs de validation (express-validator)
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendError(res, 'Validation failed', 422);
        }

        // 2. Extraire les données du corps de la requête
        const { username, email, password } = req.body;

        // 3. Vérifier si l'email existe déjà (éviter les doublons)
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return sendError(res, 'Email already in use', 409);
        }

        // 4. Hacher le mot de passe (12 rounds de bcrypt)
        const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

        // 5. Créer l'utilisateur en base
        const newUser = await User.create({ username, email, password_hash });

        // 6. Générer le JWT avec les infos essentielles
        const token = jwt.sign(
            {
                id: newUser.id,
                role: newUser.role,
                username: newUser.username
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // 7. Retourner l'utilisateur + le token
        return sendSuccess(res, { user: newUser, token }, 'User registered', 201);

    } catch (error) {
        next(error);
    }
}
```

#### `login()` (ligne 59) — Connexion

```js
static async login(req, res, next) {
    try {
        // 1. Validation
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendError(res, 'Validation failed', 422);
        }

        const { email, password } = req.body;

        // 2. Récupérer l'utilisateur AVEC le password_hash
        const user = await User.findByEmailWithPassword(email);

        // 3. Même message que l'email soit faux ou le mot de passe faux
        //    → empêche un attaquant de deviner quels emails existent
        if (!user) {
            return sendError(res, 'Invalid email or password', 401);
        }

        // 4. Comparer le mot de passe fourni avec le hash stocké
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return sendError(res, 'Invalid email or password', 401);
        }

        // 5. Générer le JWT
        const token = jwt.sign(
            { id: user.id, role: user.role, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // 6. Enlever le password_hash avant d'envoyer la réponse
        const { password_hash, ...safeUser } = user;

        return sendSuccess(res, { user: safeUser, token }, 'Login successful');

    } catch (error) {
        next(error);
    }
}
```

### 3.3 — Le middleware JWT (vérification du token)

**Fichier :** `src/middlewares/jwtAuth.js`

#### `authenticate` (ligne 15) — Protection obligatoire

```js
const authenticate = (req, res, next) => {
    // 1. Récupérer le header Authorization
    const authHeader = req.headers.authorization;

    // 2. Vérifier qu'il commence par "Bearer "
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: { message: 'No token provided', code: 'MISSING_TOKEN' }
        });
    }

    // 3. Extraire le token (après "Bearer ")
    const token = authHeader.substring(7);

    try {
        // 4. Vérifier et décoder le token
        //    jwt.verify() lance une erreur si :
        //    - le token est expiré
        //    - le token a été modifié
        //    - la signature ne correspond pas (mauvais secret)
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 5. Attacher l'utilisateur décodé à la requête
        req.user = decoded;
        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            error: { message: 'Invalid or expired token', code: 'INVALID_TOKEN' }
        });
    }
};
```

#### `attachUser` (ligne 68) — Optionnel (ne bloque pas les invités)

```js
const attachUser = (req, res, next) => {
    const authHeader = req.headers.authorization;

    // Pas de token → on continue sans utilisateur identifié
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
    }

    const token = authHeader.substring(7);

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
    } catch {
        // Token invalide → on continue sans (pas d'erreur)
    }

    next();
};
```

Différence fondamentale entre `authenticate` et `attachUser` :
- **`authenticate`** : si pas de token valide → **401** (bloque la requête)
- **`attachUser`** : si pas de token valide → **next()** (continue sans utilisateur)

### 3.4 — Les routes

**Fichier :** `src/routes/authRoutes.js`

```js
const registerValidation = [
    body('username').trim().isLength({ min: 2, max: 50 }),
    body('email').trim().isEmail().normalizeEmail(),
    body('password')
        .isLength({ min: 8 })
        .matches(/[A-Z]/)   // au moins une majuscule
        .matches(/[0-9]/)    // au moins un chiffre
];

router.post('/register', registerValidation, AuthController.register);
router.post('/login', loginValidation, AuthController.login);
router.get('/me', authenticate, AuthController.getMe);
```

### 3.5 — Le frontend (stockage et envoi du token)

**Fichier :** `frontend/public/js/auth.js`

```js
// Stockage dans localStorage
function setToken(token) {
    localStorage.setItem('ovni_token', token);
}

// Envoi du token dans chaque requête
async function apiRequest(endpoint, options) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json' };

    if (token) {
        headers['Authorization'] = 'Bearer ' + token;
    }

    const res = await fetch('/api/v1' + endpoint, {
        method: options.method || 'GET',
        headers: headers,
        body: options.body ? JSON.stringify(options.body) : undefined
    });
    // ...
}
```

---

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

### Cas 1 : Inscription

```
[NAVIGATEUR]                    [SERVEUR]                    [BASE DE DONNÉES]
     │                              │                              │
     │  POST /api/v1/auth/register  │                              │
     │  { username, email, password }│                             │
     │─────────────────────────────►│                              │
     │                              │  1. Validation middleware    │
     │                              │     (express-validator)     │
     │                              │                              │
     │                              │  2. AuthController.register │
     │                              │     vérifie email existant  │
     │                              │─────────────────────────────►│
     │                              │  SELECT email FROM users    │
     │                              │◄────────────────────────────│
     │                              │                              │
     │                              │  3. bcrypt.hash(password)   │
     │                              │     (12 rounds ≈ 300ms)     │
     │                              │                              │
     │                              │  4. INSERT INTO users       │
     │                              │─────────────────────────────►│
     │                              │                              │
     │                              │  5. jwt.sign({ id, role,    │
     │                              │       username }, SECRET,    │
     │                              │       { expiresIn: '24h' }) │
     │                              │                              │
     │  { success: true,            │                              │
     │    data: { user, token } }   │                              │
     │◄─────────────────────────────│                              │
     │                              │                              │
     │  6. localStorage.setItem(    │                              │
     │     'ovni_token', token)     │                              │
```

### Cas 2 : Requête protégée (ex: GET /me)

```
[NAVIGATEUR]                    [SERVEUR]                    [BASE DE DONNÉES]
     │                              │                              │
     │  GET /api/v1/auth/me         │                              │
     │  Authorization: Bearer <tok> │                              │
     │─────────────────────────────►│                              │
     │                              │  1. Middleware authenticate  │
     │                              │     jwt.verify(token,       │
     │                              │       JWT_SECRET)           │
     │                              │     → decoded = { id: 7 }  │
     │                              │     → req.user = decoded    │
     │                              │     → next()                │
     │                              │                              │
     │                              │  2. AuthController.getMe    │
     │                              │     User.findById(7)        │
     │                              │─────────────────────────────►│
     │                              │◄────────────────────────────│
     │                              │                              │
     │  { success: true,            │                              │
     │    data: { user } }          │                              │
     │◄─────────────────────────────│                              │
```

---

## 5. ANALOGIE

Le JWT, c'est comme un **ticket de vestiaire** :

1. Tu arrives au vestiaire (le serveur), tu donnes ton manteau (email + mot de passe)
2. Le vestiaire te donne un ticket avec un numéro (le JWT)
3. Le ticket a un **sceau officiel** (la signature JWT) — si quelqu'un essaye de le falsifier, le sceau ne correspond plus
4. À chaque fois que tu reviens chercher quelque chose, tu présentes ton ticket
5. Le vestiaire vérifie le sceau, et si c'est bon, il te sert
6. Le ticket expire à la fin de la soirée (24h) — après, tu dois en prendre un nouveau

Pourquoi c'est mieux qu'un mot de passe à chaque fois ? Parce que tu ne donnes ton mot de passe qu'une fois (à la connexion). Après, tu utilises juste le ticket. Si quelqu'un vole le ticket, il a accès, mais seulement pour la durée limitée (24h), et tu peux toujours changer ton mot de passe pour invalider tous les tickets.

---

## 6. PIÈGES CLASSIQUES

### Piège #1 : Anti-énumération d'utilisateurs

```js
// MAUVAIS : message différent selon que l'email existe ou non
if (!user) {
    return sendError(res, 'Email not found', 401);  // ← FAIBLE : un attaquant
}                                                     //   peut deviner quels emails
                                                      //   sont inscrits
if (!passwordMatch) {
    return sendError(res, 'Invalid password', 401);
}

// BON : même message dans les deux cas
if (!user || !passwordMatch) {
    return sendError(res, 'Invalid email or password', 401);  // ← FORT : l'attaquant
}                                                              //   ne sait pas ce qui
                                                               //   est faux
```

Conséquence : si on avait deux messages différents, un attaquant pourrait envoyer une liste de 1000 emails, et ceux qui renvoient "Email not found" sont des utilisateurs valides. En 5 minutes, il a une liste de comptes existants.

### Piège #2 : Stocker le hash en clair

Si on oublie de hacher le mot de passe avant de le stocker :
```js
// MAUVAIS : mot de passe en clair dans la base
await User.create({ username, email, password_hash: password });  // ← DANGER
// Si la DB est compromise, tous les mots de passe sont volés

// BON : on hache avant de stocker
const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
await User.create({ username, email, password_hash });  // ← SÉCURISÉ
```

### Piège #3 : Oublier d'enlever le password_hash de la réponse

```js
// MAUVAIS : on renvoie le hash dans la réponse
return sendSuccess(res, { user });  // ← FAIBLE : le client reçoit password_hash
// Même hashé, un attaquant peut tenter de le casser hors-ligne

// BON : on le vire avant d'envoyer
const { password_hash, ...safeUser } = user;
return sendSuccess(res, { user: safeUser, token });
```

### Piège #4 : Token stocké dans un endroit vulnérable

Le frontend utilise `localStorage`. Alternative possible : `httpOnly` cookie. Pourquoi `localStorage` ici ? Par simplicité (pas de configuration cookie côté serveur). Mais c'est vulnérable aux attaques XSS : si un attaquant injecte du JS dans la page, il peut lire `localStorage` et voler le token. Dans une version plus sécurisée, on utiliserait un cookie `httpOnly` (pas accessible en JS).

### Piège #5 : Ordre des routes (le `/:id` qui mange tout)

Si tu mets une route `/random` APRÈS `/:id`, Express va interpréter "random" comme un `:id` :
```js
// MAUVAIS : /random ne sera jamais atteint, "random" sera capturé par /:id
router.get('/:id', controller.getById);
router.get('/random', controller.getRandom);  // ← MORT : inaccessible

// BON : les routes spécifiques AVANT les routes paramétrées
router.get('/random', controller.getRandom);
router.get('/:id', controller.getById);
```
(Ce piège n'est pas spécifique à l'auth, mais au routing Express en général.)

---

## 7. ET SI ON FAISAIT AUTREMENT ?

### Option A : Sessions côté serveur (au lieu de JWT)

- **Comment ça marche** : Le serveur stocke la session en mémoire/Redis et renvoie un cookie `session_id`. Le navigateur renvoie le cookie automatiquement.
- **Avantage** : On peut révoquer une session immédiatement (supprimer la session côté serveur). Pas de secret JWT à gérer.
- **Inconvénient** : Le serveur doit stocker l'état de chaque utilisateur connecté. Si on a plusieurs serveurs (scale horizontal), il faut une base Redis partagée. Plus complexe.
- **Notre cas** : En MVP (Monolithic, un seul serveur), JWT est plus simple. Si on ajoutait un deuxième serveur, le JWT fonctionne sans modification (le même secret signe tous les tokens).

### Option B : OAuth2 (Google, GitHub, etc.)

- **Comment ça marche** : On délègue l'authentification à un fournisseur tiers (Google, GitHub). L'utilisateur clique "Se connecter avec Google".
- **Avantage** : L'utilisateur n'a pas besoin de créer un nouveau compte. Plus sécurisé (pas de mot de passe à stocker).
- **Inconvénient** : Dépend d'un service externe. Plus complexe à mettre en place (redirect URI, client ID/secret, etc.). Nécessite HTTPS obligatoirement.
- **Notre cas** : Hors-scope MVP. Pas justifié pour un projet de fin de formation.

### Option C : JWT avec refresh token

- **Comment ça marche** : Deux tokens : un court (15 min) + un long (7 jours) pour en générer un nouveau sans se reconnecter.
- **Avantage** : Si le token court est volé, il expire vite. Le refresh token peut être révoqué.
- **Inconvénient** : Plus complexe (gestion du refresh, stockage côté serveur du refresh token).
- **Notre cas** : Pas justifié pour un MVP. 24h d'expiration est un bon compromis simplicité/sécurité.

---

## 8. CHECKLIST POUR LE JURY

- [ ] Le mot de passe n'est **jamais stocké en clair** — seulement le hash bcrypt
- [ ] Le `password_hash` n'est **jamais renvoyé au client** — viré avec `const { password_hash, ...safeUser } = user;`
- [ ] Le message d'erreur de login est **volontairement vague** (`'Invalid email or password'`) — anti-énumération
- [ ] Le JWT contient **le minimum nécessaire** (id, role, username) — pas de mot de passe dans le token
- [ ] Le token expire en **24h** — pas de session permanente
- [ ] La validation des entrées est faite **avant** le controller (express-validator) — pas de confiance dans les données client
- [ ] Les requêtes SQL utilisent des **placeholders (`?`)** — pas de concaténation (injection SQL impossible)
- [ ] Le rôle par défaut est `'user'` — un client ne peut pas s'inscrire en admin
- [ ] Le middleware `authenticate` bloque les requêtes sans token (401) — le middleware `attachUser` permet les invités
- [ ] Le frontend stocke le token dans `localStorage` (pas dans un cookie) — choix délibéré de simplicité, avec la conscience que c'est vulnérable au XSS
