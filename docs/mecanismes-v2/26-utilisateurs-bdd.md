# 26 — Utilisateurs BDD (Moindre Privilège)

## 1. CE QUE ÇA FAIT (vue d'ensemble)

Le script `02_create_users.sql` crée 3 utilisateurs MariaDB avec des niveaux de privilèges strictement séparés : `dev_app` pour l'application (SELECT/INSERT/UPDATE/DELETE seulement), `dev_admin` pour les opérations d'administration (ALL), et `dev_readonly` pour la consultation uniquement (SELECT). Principe de moindre privilège : chaque utilisateur a EXACTEMENT les droits nécessaires à son rôle, rien de plus.

## 2. SCHÉMA DE LA TABLE

Pas de table applicative — ce sont des utilisateurs système MariaDB (stockés dans `mysql.user`).

## 3. LE CODE

### 3.1 — Script complet (`database/scripts/02_create_users.sql:1-57`)

```sql
-- USER 1: dev_app (pour l'application Node.js au runtime)
CREATE USER IF NOT EXISTS 'dev_app'@'localhost' IDENTIFIED BY 'REPLACE_WITH_STRONG_PASSWORD';

GRANT SELECT, INSERT, UPDATE, DELETE
    ON recettes_humaines.*
    TO 'dev_app'@'localhost';

GRANT SELECT, INSERT, UPDATE, DELETE
    ON recettes_humaines_test.*
    TO 'dev_app'@'localhost';

-- USER 2: dev_admin (pour les migrations, seeding, administration)
CREATE USER IF NOT EXISTS 'dev_admin'@'localhost' IDENTIFIED BY 'REPLACE_WITH_STRONG_PASSWORD';

GRANT ALL PRIVILEGES
    ON recettes_humaines.*
    TO 'dev_admin'@'localhost';

GRANT ALL PRIVILEGES
    ON recettes_humaines_test.*
    TO 'dev_admin'@'localhost';

-- USER 3: dev_readonly (pour audit/reporting)
CREATE USER IF NOT EXISTS 'dev_readonly'@'localhost' IDENTIFIED BY 'REPLACE_WITH_STRONG_PASSWORD';

GRANT SELECT
    ON recettes_humaines.*
    TO 'dev_readonly'@'localhost';

GRANT SELECT
    ON recettes_humaines_test.*
    TO 'dev_readonly'@'localhost';

FLUSH PRIVILEGES;
```

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

1. L'administrateur MariaDB (root) exécute `02_create_users.sql`.
2. MariaDB crée 3 users si ils n'existent pas déjà (`IF NOT EXISTS`).
3. Chaque GRANT s'applique à la base concernée (recettes_humaines pour la prod, recettes_humaines_test pour les tests).
4. `FLUSH PRIVILEGES` recharge les tables de privilèges — rend les nouveaux droits actifs immédiatement.
5. Le fichier `.env` référence l'utilisateur `dev_app` pour la connexion runtime.
6. Si un attaquant compromet l'application via une injection SQL, il ne peut QUE faire du SELECT/INSERT/UPDATE/DELETE sur les tables des bases spécifiées — pas de DROP TABLE, pas de ALTER, pas d'accès aux autres bases.

## 5. ANALOGIE

C'est le système de badges dans un immeuble de bureaux :
- **dev_app** (badge employé) : accès aux salles de travail (SELECT/INSERT/UPDATE/DELETE). Pas d'accès au local technique (structure BDD).
- **dev_admin** (badge technicien) : accès à TOUT, y compris le local électrique et les serveurs.
- **dev_readonly** (badge visiteur) : peut regarder mais toucher à rien (SELECT seulement).

Si un employé perd son badge (injection SQL), l'attaquant ne peut pas accéder aux locaux techniques. Si c'est le technicien qui perd son badge, les dégâts sont plus graves — c'est pourquoi le badge admin n'est JAMAIS utilisé par l'application au quotidien.

## 6. PIÈGES CLASSIQUES

### Piège #1 : Utiliser root dans l'application

```javascript
// MAUVAIS — connexion avec root, droits illimités
const pool = mysql.createPool({
    user: 'root',
    password: 'rootpassword',
    database: 'recettes_humaines'
});
// Si SQL injection, l'attaquant peut DROP toutes les tables
```

```javascript
// BON — connexion avec dev_app, droits limités
const pool = mysql.createPool({
    user: 'dev_app',
    password: process.env.DB_PASSWORD,
    database: 'recettes_humaines'
});
```

### Piège #2 : Oublier de donner les droits sur la base de test

```sql
-- MAUVAIS — les tests échouent car dev_app n'a pas accès à recettes_humaines_test
GRANT SELECT, INSERT, UPDATE, DELETE ON recettes_humaines.* TO 'dev_app'@'localhost';
```

```sql
-- BON — les deux bases sont couvertes
GRANT SELECT, INSERT, UPDATE, DELETE ON recettes_humaines.* TO 'dev_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON recettes_humaines_test.* TO 'dev_app'@'localhost';
```

### Piège #3 : GRANT ALL sur TOUTES les bases (`ON *.*`)

```sql
-- MAUVAIS — dev_app peut tout faire sur TOUTES les bases
GRANT ALL PRIVILEGES ON *.* TO 'dev_app'@'localhost';
```

```sql
-- BON — restreint aux deux bases nécessaires
GRANT SELECT, INSERT, UPDATE, DELETE ON recettes_humaines.* TO 'dev_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON recettes_humaines_test.* TO 'dev_app'@'localhost';
```

### Piège #4 : Ne pas exécuter `FLUSH PRIVILEGES`

MariaDB met en cache les privilèges. Sans `FLUSH PRIVILEGES`, les nouveaux GRANT peuvent ne pas être pris en compte immédiatement. Dans certains cas, le serveur les recharge automatiquement, mais il est plus sûr d'être explicite.

### Piège #5 : Commiter les mots de passe en version control

Le script contient `'REPLACE_WITH_STRONG_PASSWORD'` — c'est intentionnel. Les vrais mots de passe ne doivent JAMAIS être commités. Ils sont stockés dans `.env` (fichier ignoré par git).

## 7. ET SI ON FAISAIT AUTREMENT ?

### Option A : Un seul utilisateur avec tous les droits

C'est plus simple mais catastrophique en sécurité : une injection SQL dans l'application donnerait un accès total à l'attaquant. La séparation des privilèges est une barrière de sécurité fondamentale.

### Option B : Utilisateur unique avec GRANT limité configurable

Certaines équipes créent un seul user avec les droits nécessaires (SELECT/INSERT/UPDATE/DELETE) sans séparer app/admin/readonly. Ça fonctionne mais perd la souplesse d'avoir un user admin pour les migrations et un user readonly pour les audits.

### Option C : Gestion des utilisateurs via un outil externe (Vault, Consul)

Pour une architecture plus complexe, on pourrait externaliser la gestion des credentials (HashiCorp Vault). Totalement hors scope pour un MVP de formation. Le principe de moindre privilège via SQL est le strict minimum attendu.

## 8. CHECKLIST POUR LE JURY

- [ ] 3 utilisateurs MariaDB créés : dev_app, dev_admin, dev_readonly.
- [ ] `dev_app` a uniquement SELECT, INSERT, UPDATE, DELETE (pas de CREATE/ALTER/DROP).
- [ ] `dev_admin` a ALL PRIVILEGES (pour les migrations et le seed).
- [ ] `dev_readonly` a uniquement SELECT (pas de modification possible).
- [ ] Les droits sont attribués sur les DEUX bases (production + test).
- [ ] Les mots de passe sont des placeholders (`REPLACE_WITH_STRONG_PASSWORD`) — pas de secrets en clair.
- [ ] `FLUSH PRIVILEGES` est exécuté pour activer les droits.
- [ ] L'application utilise `dev_app` dans sa configuration (`.env`).
- [ ] Le principe de moindre privilège est respecté : chaque user a le minimum de droits nécessaires.
- [ ] Aucun utilisateur n'a `GRANT OPTION` (ne peut pas donner ses droits à d'autres).
