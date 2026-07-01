# Synthèse Jour 3 — Création des bases de données et utilisateurs MariaDB

__Synthèse – Jour 3 : Création des bases de données et utilisateurs MariaDB__

__Ce qu'on a fait__

- Créé le dossier database/scripts/
- Écrit et exécuté 01_create_databases.sql → deux bases créées : recettes_humaines et recettes_humaines_test
- Écrit et exécuté 02_create_users.sql → trois utilisateurs créés : dev_app, dev_readonly, dev_admin
- Tenté de vérifier les permissions des utilisateurs

__Problèmes rencontrés__

__Erreur 1146 lors des tests de permissions__

- Contexte : en testant que dev_readonly ne peut pas faire d'INSERT, on obtient Table doesn't exist au lieu de Permission denied
- Options envisagées : alimenter les tables en données de test / créer les tables d'abord
- Décision retenue : ni l'un ni l'autre — le vrai problème est que les tables n'ont jamais été créées. Le script 01_create_databases.sql crée les bases, pas les tables. C'est une étape qui n'a pas encore été faite.

__Confusion bases vides vs tables inexistantes__

- Contexte : SHOW TABLES retourne Empty set, ce qui a été interprété comme des tables sans données
- Décision retenue : clarifier la distinction. Tables inexistantes = aucune structure. Tables vides = structure existe, zéro ligne.

__Décisions techniques prises__

- Les scripts SQL sont la source de vérité du projet — tout doit pouvoir être recréé depuis zéro en les exécutant dans l'ordre
- Les mots de passe ne vont pas dans Git, ils passent par .env
- La base recettes_humaines_test est réservée aux tests pour ne pas polluer les données de dev
- Prochaine étape obligatoire : écrire 03_create_tables.sql avant tout test de permissions
- Tests reportés à la prochaine journées. 

__Ce qui a été écarté et pourquoi__

- Tester les permissions avant d'avoir les tables : impossible, MariaDB vérifie l'existence de la table avant les droits
- Alimenter les tables en données avant de créer leur structure : logiquement impossible, la structure doit exister en premier

