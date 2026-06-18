__MCP — Model Context Protocol__

__En bref__

MCP est un protocole créé par Anthropic qui définit un standard universel pour connecter une IA à des outils externes. Avant MCP, chaque connexion IA ↔ outil était codée sur mesure, ce qui créait de l'incompatibilité. MCP règle ça en imposant un langage commun. Concrètement, ça permet à une IA de ne plus juste répondre, mais d'agir sur des outils réels.

__Exemple concret__

Sans MCP :

IA → code custom → GitHub

IA → code custom → BDD

IA → code custom → Slack

(3 connexions différentes, 3 logiques différentes)

Avec MCP :

IA → MCP → GitHub

         → BDD

         → Slack

(1 seul standard, tout parle le même langage)

__À retenir__

- MCP = Model Context Protocol, créé par Anthropic
- C'est un standard universel, pas un outil spécifique
- Permet à l'IA de se connecter à des outils externes (BDD, GitHub, fichiers...)
- Sans MCP : l'IA répond. Avec MCP : l'IA agit
- Analogie utile : c'est le USB-C des connexions IA ↔ outils

__npm / package.json / node_modules__

__En bref__

npm est le gestionnaire de paquets de Node.js. Tu listes tes dépendances dans package.json, npm lit ce fichier et installe tout dans node_modules. Tu n'écris jamais dans node_modules manuellement, c'est npm qui gère ça seul.

__Exemple concret__

// package.json — tu écris ça

\{

  "dependencies": \{

    "express": "^4.18.0",

    "mysql2": "^3.0.0"

  \}

\}

npm install

→ npm lit package.json

→ npm remplit node_modules automatiquement

__À retenir__

- package.json = ta liste de courses
- npm = le livreur qui exécute la liste
- node_modules = le placard rempli par npm
- Tu ne touches jamais node_modules directement
- node_modules n'est jamais envoyé sur le serveur, on envoie package.json et npm réinstalle tout sur place

__Architecture BDD / Serveur / Site web__

__En bref__

La base de données tourne sur le serveur, pas dans les fichiers du site. Ton code Node.js fait le pont entre les deux : il reçoit une requête du navigateur, interroge la BDD, et renvoie les données. Les fichiers SQL que tu crées localement servent à construire la structure de ta BDD, pas à être déposés dans un dossier du site.

__Exemple concret__

Navigateur → requête HTTP

                ↓

           Node.js (serveur)

                ↓

           MariaDB (BDD)

                ↓

           Node.js renvoie les données

                ↓

           Navigateur affiche le résultat

__À retenir__

- La BDD est sur le serveur, séparée des fichiers du site
- Node.js fait le lien entre le site et la BDD
- Tes fichiers SQL définissent la structure, ils ne "vivent" pas dans le site
- En production : même installation que en local, juste sur un vrai serveur
- Lié à npm : Node.js a besoin de ses dépendances installées sur le serveur aussi

__Le Slug 🔗__

Un __slug__ est une version __simplifiée et formatée pour les URLs__ d'un texte.

__Règles de transformation :__

__Original__

__Slug__

Plats rapides

plats-rapides

Budget étudiant

budget-etudiant

Accident heureux

accident-heureux

__Les transformations appliquées :__

- ✅ __Minuscules__ → Plats devient plats
- ✅ __Espaces → tirets__ → Plats rapides devient plats-rapides
- ✅ __Accents supprimés__ → étudiant devient etudiant
- ✅ __Caractères spéciaux supprimés__ → \!, @, etc. sont retirés

__À quoi ça sert ? 🎯__

Le slug est utilisé dans les __URLs__ :

❌ monsite.com/categorie/Plats rapides

✅ monsite.com/categorie/plats-rapides

C'est plus __lisible__, __SEO-friendly__ et ça __évite les problèmes d'encodage__ dans les URLs.

__Config__

__En bref__

Le dossier config sert à centraliser tous les paramètres de ton application. On y met les variables d’environnement, les clés API, les ports, ou encore les réglages de connexion. Ça évite de disperser ces infos partout dans le code. C’est aussi pratique pour adapter ton app selon l’environnement (dev, test, prod). En résumé, c’est le cerveau des réglages.

__Exemple concret__

// src/config/db.js

export const dbConfig = \{

  host: process.env.DB_HOST,

  user: process.env.DB_USER,

  password: process.env.DB_PASSWORD,

  database: process.env.DB_NAME,

\};

__À retenir__

- Centralise tous les paramètres
- Utilise souvent process.env
- Facilite le changement d’environnement
- Évite le code en dur (hardcoded)
- Souvent utilisé par database

__Database__

__En bref__

Le dossier database gère la connexion à la base de données. Il contient le code pour se connecter, configurer, et parfois initialiser la base. C’est ici que tu définis comment ton application parle à la DB. Il sert de point d’entrée unique pour toutes les requêtes. Ça évite de dupliquer la logique de connexion.

__Exemple concret__

// src/database/connection.js

import mysql from "mysql2";

export const connection = mysql.createConnection(\{

  host: "localhost",

  user: "root",

  password: "",

  database: "my_db",

\});

__À retenir__

- Gère la connexion à la DB
- Utilisé par les models
- Évite les connexions multiples
- Peut inclure migrations/seeds
- Dépend souvent de config

__Middlewares__

__En bref__

Les middlewares sont des fonctions exécutées entre la requête et la réponse. Ils servent à intercepter et modifier le flux (auth, logs, validation…). Ils sont très utilisés avec Express. Chaque middleware peut bloquer, modifier ou laisser passer la requête. C’est une couche de contrôle très puissante.

__Exemple concret__

// src/middlewares/auth.js

export const authMiddleware = (req, res, next) => \{

  if (\!req.headers.authorization) \{

    return res.status(401).json(\{ message: "Unauthorized" \});

  \}

  next();

\};

__À retenir__

- S’exécute avant le controller
- Peut bloquer une requête
- Utilisé pour auth, logs, validation
- Chaînable avec next()
- Lié aux routes

__Utils__

__En bref__

Le dossier utils contient des fonctions utilitaires réutilisables. Ce sont des petits outils génériques (formatage, helpers, etc.). Ils ne dépendent pas de la logique métier. Ça permet d’éviter la duplication de code. C’est un peu la boîte à outils du projet.

__Exemple concret__

// src/utils/formatDate.js

export const formatDate = (date) => \{

  return new Date(date).toLocaleDateString();

\};

__À retenir__

- Fonctions réutilisables
- Pas liées au business
- Utilisées partout dans le projet
- Réduit la duplication
- Indépendant des models et controllers

__Models__

__En bref__

Les models représentent la structure des données. Ils définissent comment les données sont stockées et manipulées. Ils interagissent directement avec la base de données. Chaque model correspond souvent à une table. C’est la couche “data” de ton application.

__Exemple concret__

// src/models/User.js

import \{ connection \} from "../database/connection.js";

export const getAllUsers = () => \{

  return connection.query("SELECT \* FROM users");

\};

__À retenir__

- Représente les données (tables)
- Communique avec la DB
- Utilisé par les controllers
- Peut contenir des requêtes SQL
- Dépend de database

__Controllers__

__En bref__

Les controllers gèrent la logique métier de ton application. Ils reçoivent les requêtes des routes et appellent les models. Ensuite, ils renvoient une réponse au client. Ils font le lien entre la logique et les données. C’est le cerveau de ton API.

__Exemple concret__

// src/controllers/userController.js

import \{ getAllUsers \} from "../models/User.js";

export const getUsers = async (req, res) => \{

  const users = await getAllUsers();

  res.json(users);

\};

__À retenir__

- Gère la logique métier
- Appelle les models
- Répond au client (res)
- Reçoit req/res
- Utilisé par les routes

__Routes__

__En bref__

Les routes définissent les endpoints de ton API. Elles relient une URL à un controller. Elles peuvent aussi utiliser des middlewares. C’est le point d’entrée des requêtes HTTP. Elles organisent l’accès aux fonctionnalités.

__Exemple concret__

// src/routes/userRoutes.js

import express from "express";

import \{ getUsers \} from "../controllers/userController.js";

const router = express.Router();

router.get("/users", getUsers);

export default router;

__À retenir__

- Définit les endpoints (URL)
- Appelle les controllers
- Peut utiliser des middlewares
- Structure l’API
- Point d’entrée des requêtes HTTP

__Credentials__

__En bref__

Les *credentials* sont les informations qui permettent de s’authentifier. En gros, c’est ce qui prouve que tu as le droit d’accéder à quelque chose. Ça peut être un identifiant \+ mot de passe, une clé API, ou un token. On les utilise souvent pour se connecter à une base de données ou un service externe. C’est sensible, donc il ne faut jamais les exposer dans le code.

__Exemple concret__

// ❌ Mauvaise pratique

const db = \{

  user: "admin",

  password: "1234"

\};

// ✅ Bonne pratique

const db = \{

  user: process.env.DB_USER,

  password: process.env.DB_PASSWORD

\};

__À retenir__

- Sert à s’authentifier (login, API, DB)
- Très sensible → ne jamais hardcoder
- Stocké dans .env
- Utilisé dans config et database
- Peut être volé si mal protégé

__Logs__

__En bref__

Les *logs* sont des messages que ton application enregistre pour dire ce qu’elle fait. Ils servent à comprendre ce qui se passe, surtout en cas d’erreur. Ça peut être des infos simples, des erreurs, ou des actions utilisateur. C’est essentiel pour le debug et la maintenance. Sans logs, tu es aveugle quand ça casse.

__Exemple concret__

// src/utils/logger.js

export const log = (message) => \{

  console.log(\`\[LOG\] $\{message\}\`);

\};

// utilisation

log("User created");

__À retenir__

- Sert à suivre ce que fait l’app
- Utile pour debug et erreurs
- Peut être affiché ou stocké (fichier)
- Utilisé dans toute l’app
- Souvent combiné avec middlewares

__Bash  (à compléter \!)__

__En bref__

*Bash* est un interpréteur de commandes (un terminal) utilisé surtout sur Linux et macOS. Il permet d’exécuter des commandes comme créer des fichiers, lancer un serveur, etc. C’est différent de PowerShell (Windows). Beaucoup de tutos utilisent bash, donc les commandes peuvent varier. C’est un outil clé pour les devs.

__Exemple concret__

# créer des dossiers

mkdir -p src/controllers

# lancer un serveur

node index.js

__À retenir__

- Terminal Linux/macOS
- Différent de PowerShell
- Utilisé pour lancer des commandes
- Très présent dans les tutos
- Peut nécessiter adaptation sous Windows

__SSL (Secure Socket Layer)__

__En bref__

SSL (ou plutôt TLS aujourd’hui) sert à sécuriser la communication entre ton app et un service (ex: base de données). Ça chiffre les données pour éviter qu’elles soient interceptées. En production, c’est fortement recommandé, voire obligatoire. En local (dev), on le désactive souvent pour simplifier. La ligne que tu montres active SSL uniquement en production.

__Exemple concret__

// src/config/database.js

export const dbConfig = \{

  host: process.env.DB_HOST,

  user: process.env.DB_USER,

  password: process.env.DB_PASSWORD,

  database: process.env.DB_NAME,

  // SSL activé uniquement en production

  ssl: process.env.NODE_ENV === 'production'

    ? \{ rejectUnauthorized: true \}

    : false,

\};

👉 Concrètement :

- en dev → ssl = false
- en prod → ssl = sécurisé

__À retenir__

- Sert à chiffrer les échanges (sécurité)
- Indispensable en production
- Souvent désactivé en local
- Dépend de NODE_ENV
- Lié aux credentials (protège leur transmission)

__NODE_ENV__

__En bref__

NODE_ENV est une variable d’environnement qui indique dans quel mode tourne ton app. Les valeurs classiques sont development, production, ou test. Elle permet de changer le comportement du code selon le contexte. Par exemple : activer SSL, afficher plus de logs, etc. C’est une base pour gérer les environnements.

__Exemple concret__

if (process.env.NODE_ENV === "production") \{

  console.log("Mode sécurisé activé");

\} else \{

  console.log("Mode développement");

\}

__À retenir__

- Définit l’environnement (dev / prod / test)
- Influence le comportement de l’app
- Utilisée dans config
- Permet d’activer/désactiver des options
- Liée à la sécurité (ex: SSL)

__HTTP Headers__

__En bref__

Les headers HTTP sont des informations envoyées entre le client (navigateur) et le serveur. Ils ne sont pas visibles directement dans la page web. Ils servent à donner des instructions sur la manière de traiter une requête ou une réponse. Par exemple, ils indiquent le type de contenu ou les règles de sécurité. Ce ne sont pas des messages d’erreur affichés à l’utilisateur.

__Exemple concret__

GET /api/users HTTP/1.1

Host: example.com

Authorization: Bearer token123

Réponse :

HTTP/1.1 200 OK

Content-Type: application/json

X-Frame-Options: DENY

\{ "name": "Alice" \}

👉 Comparaison :

- Headers → infos techniques (invisibles)
- Body → contenu affiché (visible)

__À retenir__

- Les headers ne sont pas affichés dans la page
- Ils contrôlent le comportement du navigateur/serveur
- Ils sont envoyés dans chaque requête et réponse
- À ne pas confondre avec le body (contenu visible)
- Utilisés par des middlewares comme helmet

__Middleware (Express)__

__En bref__

Un middleware est une fonction qui s’exécute entre la réception d’une requête et l’envoi de la réponse dans Express.js. Il peut modifier la requête, la réponse ou décider de continuer ou non le traitement. Les middlewares sont chaînés et exécutés dans l’ordre. Ils sont utilisés pour ajouter des fonctionnalités comme la sécurité ou le logging.

__Exemple concret__

app.use((req, res, next) => \{

  console.log("Requête reçue");

  next();

\});

app.get("/", (req, res) => \{

  res.send("Hello");

\});

__À retenir__

- Fonction exécutée entre requête et réponse
- Peut modifier req et res
- Doit appeler next() pour continuer
- Exécuté dans l’ordre d’ajout
- Base pour helmet et cors

__Helmet (headers sécurisés)__

__En bref__

Helmet est un middleware Express qui ajoute automatiquement des headers HTTP pour améliorer la sécurité. Il protège contre plusieurs types d’attaques web en configurant correctement les headers. Il ne change pas le contenu de la page, seulement les règles de sécurité envoyées au navigateur. C’est une couche de protection côté serveur.

__Exemple concret__

import helmet from "helmet";

app.use(helmet());

Exemple de header ajouté :

X-Frame-Options: DENY

__À retenir__

- Ajoute des headers HTTP de sécurité
- Protège contre XSS, clickjacking, etc.
- Invisible pour l’utilisateur
- Ne modifie pas le contenu affiché
- Fonctionne via middleware (lié à HTTP headers)

__CORS (Cross-Origin Resource Sharing)__

__En bref__

CORS est un mécanisme qui permet de contrôler quelles origines (domaines) peuvent accéder à ton serveur. Par défaut, les navigateurs bloquent les requêtes entre domaines différents. Le middleware CORS permet d’autoriser certaines requêtes externes. Il fonctionne en ajoutant des headers HTTP spécifiques.

__Exemple concret__

import cors from "cors";

app.use(cors(\{

  origin: "http://localhost:3000"

\}));

Header ajouté :

Access-Control-Allow-Origin: http://localhost:3000

__À retenir__

- Contrôle les requêtes entre domaines différents
- Bloqué par défaut par le navigateur
- Configuré via des headers HTTP
- Utilisé avec frontend séparé (React, etc.)
- Middleware basé sur HTTP headers (lié à Helmet)

Convention Git :

Type du commit

Le type nous informe du type de commit. 9 types sont disponibles :

build : changements qui affectent le système de build ou des dépendances externes (npm, make…)

ci : changements concernant les fichiers et scripts d’intégration ou de configuration (Travis, Ansible, BrowserStack…)

feat : ajout d’une nouvelle fonctionnalité

fix : correction d’un bug

perf : amélioration des performances

refactor : modification qui n’apporte ni nouvelle fonctionalité ni d’amélioration de performances

style : changement qui n’apporte aucune alteration fonctionnelle ou sémantique (indentation, mise en forme, ajout d’espace, renommante d’une variable…)

docs : rédaction ou mise à jour de documentation

test : ajout ou modification de tests

À cela s’ajoute revert. Ce dernier permet comme son nom l’indique, d’annuler un précédent commit. Dans ce cas, le message prend la forme suivante :

revert sujet du commit annulé hash du commit annulé

Le sujet

Le sujet contient une description succinte des changements. En général, on se limite à 50 caractères. De nombreux outils avertissent d’ailleurs lorsque l’on dépasse la longueur maximale.

