__Synthèse – Jour 5 : Données de test \+ Sécurité des accès MariaDB__

__Ce qu'on a fait__

- Généré les hash bcrypt pour 3 utilisateurs applicatifs (dont 1 admin)
- Écrit et exécuté 04_seed_data.sql : 3 catégories, 5 utilisateurs, 8 recettes, 30 commentaires, 30 notations
- Vérifié l'intégrité des données (average_rating cohérent, statuts variés, contraintes UNIQUE et CHECK testées)
- Rédigé TEST_CASES.md avec 10 cas de test manuels couvrant les US principales
- Changé les mots de passe des utilisateurs MariaDB via ALTER USER pour dev_app, dev_admin
- Mise à jour du .env avec les nouveaux mots de passe

__Problèmes rencontrés__

__Mots de passe en clair dans les commentaires SQL__

- __Contexte__ : présents dans 04_seed_data.sql sous forme de commentaires -- MotDePasse\!
- __Options envisagées__ : garder / supprimer / déplacer hors repo
- __Décision retenue__ : Laisser tel quel. C'est du seed data de test, les hash sont irréversibles, et documenter les mots de passe de test est une bonne pratique d'équipe. Ce fichier ne s'exécute jamais en production.

__Confusion sur la gestion des mots de passe__

- __Contexte__ : deux systèmes de mots de passe distincts à ne pas confondre
- __Décision retenue__ : clarification définitive —
	- __Utilisateurs MariaDB__ (dev_app, dev_admin, root) → gérés via ALTER USER en SQL, MariaDB hash en interne, credentials stockés dans .env
	- __Utilisateurs applicatifs__ (Mickael.b, l'admin, etc.) → hashés avec bcrypt avant insertion en base, parce que c'est le code qui gère l'authentification

__Formatage de TEST_CASES.md__

- __Contexte__ : sauts de ligne manquants, un Expected à l'intérieur d'un bloc SQL
- __Décision retenue__ : correction manuelle

__Décisions techniques prises__

- 3 utilisateurs MariaDB actifs : root, dev_app, dev_admin — mots de passe uniques, stockés uniquement dans .env
- Seed limité à 3 catégories : plats-rapides, budget-etudiant, accident-heureux
- average_rating dénormalisé dans recipes — cohérence vérifiable via JOIN sur ratings

__Ce qui a été écarté__

- Commentaires -- MotDePasse\! dans le SQL : supprimés
- Mots de passe dans les scripts SQL versionnés : interdit définitivement

