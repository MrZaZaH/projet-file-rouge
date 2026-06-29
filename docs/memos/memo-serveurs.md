# Mémo : Les différentes façons de servir une application web

## Le concept de base

Un **serveur web**, c'est un programme qui écoute des requêtes et renvoie des fichiers (HTML, CSS, JS, images) ou des réponses JSON. Sans serveur, un fichier HTML est juste un fichier sur ton disque dur. Avec un serveur, il devient accessible à travers un protocole (HTTP) et peut communiquer avec d'autres programmes (API, base de données).

Il y a plusieurs manières de "servir" un site. Voici les 5 principales, de la plus simple à la plus complète.

---

## 1. `file://` — Le fichier local (sans serveur)

**Comment ça marche :** Tu ouvres le fichier `.html` depuis l'explorateur Windows. Le navigateur lit le fichier directement sur le disque dur.

**URL typique :**
```
file:///C:/Users/vboxuser/Desktop/projet-file-rouge/frontend/public/index.html
```

**Ce qui fonctionne :**
- HTML, CSS, JS statique
- Les liens relatifs (`href="login.html"`)
- Le JS qui ne fait pas d'appels externes

**Ce qui ne fonctionne PAS :**
- Tous les appels `fetch()` ou `XMLHttpRequest` vers `/api/v1/...` (les appels API)
- Les redirections absolues (`window.location.href = '/login.html'` cherche à la racine du disque C:)
- `localStorage` ok, `sessionStorage` ok
- Les requêtes CORS (cross-origin) vers un autre domaine
- En gros : **tout ce qui nécessite un serveur pour répondre**

**Pourquoi ça ne marche pas pour l'API :** Quand tu fais `fetch('/api/v1/auth/login')`, le navigateur cherche `file:///C:/api/v1/auth/login` — ce chemin n'existe pas sur ton disque, donc erreur.

**Quand l'utiliser :** Pour tester une page HTML/CSS pure, sans aucune interaction dynamique. Pour le design uniquement.

---

## 2. Live Server (extension VS Code) — Serveur HTTP statique

**Comment ça marche :** L'extension VS Code crée un mini-serveur HTTP qui envoie les fichiers d'un dossier. Par défaut, le dossier racine est celui que tu as ouvert dans VS Code.

**URL typique :**
```
http://127.0.0.1:5500/frontend/public/index.html
```

**Ce qui fonctionne :**
- HTML, CSS, JS, images — tout le contenu statique
- Les chemins absolus (`/login.html`) — **à condition que le fichier soit à la racine du dossier servi**
- Le rechargement automatique (injecte un script dans la page)
- `localStorage`, `sessionStorage`

**Ce qui ne fonctionne PAS :**
- Les appels `fetch('/api/v1/...')` — Live Server ne connaît que les fichiers statiques, pas les routes API
- Les requêtes POST avec body JSON vers des endpoints qui n'existent pas sur Live Server
- Aucune interaction avec une base de données

**Pourquoi ça ne marche pas pour l'API :** Live Server est un serveur de fichiers, pas un serveur applicatif. Quand tu fais `fetch('/api/v1/auth/login')`, il cherche un fichier `/api/v1/auth/login` dans le dossier racine — il ne trouve pas et renvoie 404 (ou Cannot GET).

**Le piège absolu du chemin avec Live Server :**

Tu ouvres VS Code à la racine `C:\Users\vboxuser\Desktop\projet-file-rouge`.
Live Server sert depuis cette racine.

- `/index.html` → cherche `projet-file-rouge/index.html` → **existe pas**
- `/frontend/public/index.html` → cherche `projet-file-rouge/frontend/public/index.html` → **existe**
- `/login.html` → cherche `projet-file-rouge/login.html` → **existe pas**
- `/frontend/public/login.html` → cherche `projet-file-rouge/frontend/public/login.html` → **existe**

MAIS si tu ouvres VS Code directement dans `frontend/public/`, alors :
- `/index.html` → existe
- `/login.html` → existe
- `/api/v1/...` → toujours pas, parce que Live Server ne comprend toujours pas les routes API

**Quand l'utiliser :** Pour développer le frontend (HTML/CSS/JS) avec rechargement automatique, tant que tu n'as pas besoin de l'API.

---

## 3. `http-server` / Python `http.server` — Serveur statique minimal

Même principe que Live Server, juste en ligne de commande :

```bash
npx http-server ./frontend/public -p 8080
# ou
python -m http.server 8080 -d frontend/public
```

**Mêmes limitations que Live Server :**
- Sert des fichiers statiques uniquement
- Aucune route API
- Aucune logique back-end
- Aucune base de données

---

## 4. Express (Node.js) — Serveur applicatif full-stack

**Comment ça marche :** `npm start` ou `node app.js` lance un serveur Express qui fait deux choses :
1. Sert les fichiers statiques (HTML/CSS/JS/images) via `express.static()`
2. Expose des routes API (`/api/v1/auth/login`, `/api/v1/recipes`, etc.) qui exécutent du code back-end et interagissent avec la base de données

**URL typique :**
```
http://localhost:3000
```

**Ce qui fonctionne :**
- Tout. Pages statiques + routes API + base de données
- `fetch('/api/v1/auth/login')` → Express intercepte la requête, appelle le contrôleur, qui appelle le modèle, qui requête MariaDB, et renvoie une réponse JSON avec le token JWT
- `fetch('/api/v1/recipes')` → pareil, Express sert les recettes depuis la BDD
- Redirections, sessions, uploads, tout

**Pourquoi tout marche avec Express :**

Express a des "routes" définies dans le code :

```js
// app.js (simplifié)
app.use(express.static('frontend/public'));    // Sert les fichiers statiques
app.use('/api/v1/auth', authRoutes);           // Sert l'API auth
app.use('/api/v1/recipes', recipeRoutes);      // Sert l'API recettes
```

Quand tu fais `GET /login.html` :
1. Express cherche `frontend/public/login.html` → trouve → l'envoie

Quand tu fais `POST /api/v1/auth/login` :
1. Express ne trouve pas de fichier statique
2. Il passe à la route suivante
3. Il trouve `authRoutes` qui matche `/api/v1/auth/login`
4. Il exécute la fonction `loginUser` dans le contrôleur
5. Qui vérifie le mot de passe avec bcrypt
6. Qui génère un token JWT
7. Qui renvoie le token au frontend

**C'est la seule façon de faire fonctionner l'application complète.**

**Quand l'utiliser :** Toujours. C'est le mode de développement normal pour une app full-stack.

---

## 5. Nginx / Apache + PM2 — Serveur de production

**Comment ça marche :** En production (quand le site est en ligne sur un serveur), on utilise souvent Nginx comme serveur frontal (reverse proxy) qui redirige les requêtes vers Express en arrière-plan, avec PM2 pour garder l'app Express allumée en permanence.

**URL typique :**
```
https://ovni-culinaire.com
```

**Ce qui fonctionne :** Tout comme en développement Express, mais en plus :
- Mise à l'échelle (plusieurs instances)
- Cache des fichiers statiques
- HTTPS (SSL/TLS)
- Équilibrage de charge

**Hors-scope pour ton projet,** mais à savoir que ça existe.

---

## Tableau récapitulatif

| Mode | Commande / Action | URL | Pages HTML | CSS/JS | API fetch | Base de données | Quand l'utiliser |
|------|-------------------|-----|------------|--------|-----------|-----------------|------------------|
| `file://` | Double-clic sur le fichier | `file:///C:/...` | ✅ | ✅ | ❌ | ❌ | Jamais (sauf design HTML pur) |
| Live Server | Extension VS Code | `http://127.0.0.1:5500` | ✅ | ✅ | ❌ | ❌ | Développement frontend seul |
| `http-server` | Ligne de commande | `http://localhost:8080` | ✅ | ✅ | ❌ | ❌ | Alternative à Live Server |
| Express | `npm start` / `node app.js` | `http://localhost:3000` | ✅ | ✅ | ✅ | ✅ | Développement complet |
| Nginx + PM2 | Déploiement serveur | `https://monsite.com` | ✅ | ✅ | ✅ | ✅ | Production (site en ligne) |

---

## Mémo synthèse

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  MÉMO : Comment servir ton app OVNI Culinaire
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📂 file://  →  Ouvre dans le navigateur depuis Windows
               ❌ Pages OK, mais API/BDD/redirections = mort
               → Utile uniquement pour du HTML/CSS statique

🟢 Live Server  →  Extension VS Code (rechargement auto)
               ❌ Pages OK, mais API/BDD toujours pas disponibles
               → Les fetch('/api/v1/...') ne marcheront jamais

🟣 npm start  →  Serveur Express (node app.js)
               ✅ Tout fonctionne : pages + API + BDD
               → LE seul mode à utiliser pour le vrai développement

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  RÈGLE D'OR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Si tu vois une erreur du type :
    • Cannot GET /api/v1/...
    • Cannot GET /login.html (quand le fichier existe)
    • fetch() refuse de marcher
    • ERR_FILE_NOT_FOUND

  → Tu n'es PAS sur Express. Lance npm start et va sur localhost:3000.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Décision technique : Modal vs page login.html

**Contexte :** Le commit `b21b191` (jour 25) a remplacé la modal de connexion d'`index.html` par une redirection vers une page `login.html` dédiée. Cela a cassé la navigation sur Live Server et en `file://` car le chemin absolu `/login.html` ne résolvait pas correctement.

**Décision (jour 26) :** Revenir à la **modal** sur `index.html` car :
- Plus fluide (pas de navigation, tout reste sur la même page)
- Évite les problèmes de chemin selon le serveur utilisé
- La modal était déjà codée et fonctionnelle — il suffisait de changer 2 lignes dans `auth.js` pour que le bouton l'ouvre

**`login.html` est conservé** pour :
- Les redirections depuis `recipe.html` (bouton "Sauvegarder" quand non connecté)
- Les redirections depuis `submit.html` (bouton "Poster" quand non connecté)
- Le lien "Se connecter" depuis `register.html`
- `requireAuth()` dans `auth.js` (fallback)

**Modifications effectuées :**
- `auth.js` lignes 149, 155 : `window.location.href = '/login.html'` → `openLoginModal`
- `auth.js` ligne 163 : `'/login.html'` → `'login.html'` (chemin relatif pour le fallback)

---

*Fichier créé le 29/06/2026 — Session résolution bug login*
