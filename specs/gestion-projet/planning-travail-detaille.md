__PHASE 1 – Environnement & Base de Données __

__Jour 1__  
__Tâche__ : Installation et configuration complète de l’environnement de développement  
__Détail concret__ : 

- Installer Node.js (version LTS recommandée), npm, Git, DBeaver, MariaDB (local ou via Docker si tu veux suivre 1.1). 
- Créer un dossier de projet nommé recettes-humaines. 
- Initialiser Git avec un .gitignore propre (node_modules, .env, etc.). 
- Créer un compte GitHub et pousser le repo vide avec un premier commit clair (feat: initial project structure). 
- Installer les extensions VS Code indispensables : ESLint, Prettier, GitLens, Docker (si tu l’utilises). 
- Rédiger un fichier README.md en anglais (niveau B1) expliquant le projet, les technologies et comment lancer l’environnement. 
- Commencer un fichier VEILLE.md avec tes premières notes sur les bonnes pratiques de sécurité Node.js \+ MariaDB.

__Livrable__ : 

- Repo GitHub avec structure initiale \+ README.md en anglais 
- .env.example créé 
- Capture d’écran ou log montrant que MariaDB est accessible via DBeaver

__Compétences RNCP travaillées__ :  
1.1 Installer et configurer son environnement de travail, 3.3 Apprendre en continu, 3.1 Communiquer en anglais (documentation)

__Jour 2__  
__Tâche__ : Conception du schéma de base de données (MCD → MPD)  
__Détail concret__ : 

- Analyser toutes les User Stories pour identifier les entités principales : User, Recipe, Comment, Category, Rating, Badge, UserBadge, AdminLog. 
- Réaliser un MCD (Modèle Conceptuel de Données) clair (sur papier ou avec Draw.io). 
- Transformer ce MCD en MPD (Modèle Physique) avec règles de nommage strictes (snake_case, préfixes cohérents, clés étrangères explicites). 
- Identifier les relations (1:1, 1:N, N:N) et les cardinalités. 
- Ajouter les champs d’audit (created_at, updated_at, deleted_at pour soft delete). 
- Rédiger un document DATABASE_DESIGN.md en anglais qui explique les choix, les raisons de sécurité (intégrité, confidentialité) et les index nécessaires.

__Livrable__ : 

- Fichiers : docs/technique/database-design.md (en anglais) \+ captures du MCD/MPD 
- Liste des tables avec types de données, contraintes et index proposés

__Compétences RNCP travaillées__ :  
2.1 Mettre en place une base de données relationnelle, 3.2 Démarche de résolution de problème, 3.1 Documentation technique en anglais

__Jour 3__  
__Tâche__ : Création de la base de données MariaDB \+ utilisateurs sécurisés  
__Détail concret__ : 

- Créer la base recettes_humaines (et une base de test recettes_humaines_test). 
- Créer 3 utilisateurs MariaDB distincts : 
	- dev_app (avec droits limités pour l’application) 
	- dev_admin (droits plus larges pour les migrations/tests) 
	- dev_readonly (lecture seule, pour simuler un audit)
- Appliquer le principe du moindre privilège. 
- Écrire les scripts SQL de création de base \+ utilisateurs dans un dossier database/scripts/. 
- Tester la connexion depuis DBeaver avec chacun des utilisateurs. 
- Ajouter dans VEILLE.md une note sur les risques SQL Injection et comment MariaDB les limite.

__Livrable__ : 

- Dossier database/scripts/ avec 01_create_database.sql, 02_create_users.sql 
- Preuve de connexion réussie pour les 3 utilisateurs 
- Mise à jour de DATABASE_DESIGN.md avec les utilisateurs et leurs droits

__Compétences RNCP travaillées__ :  
2.1 Mettre en place une base de données relationnelle (sécurité, intégrité, utilisateurs), 1.1 Configuration environnement

__Jour 4__  
__Tâche__ : Création des tables selon le MPD (première version)  
__Détail concret__ : 

- Écrire les scripts SQL pour créer toutes les tables dans l’ordre logique (tables sans dépendances d’abord). 
- Respecter : clés primaires auto-incrémentées, foreign keys avec ON DELETE/UPDATE appropriés, contraintes CHECK quand possible (ex: coût > 0), indexes sur les champs fréquemment filtrés (temps_prep, cout_portion, note_moyenne). 
- Implémenter le soft delete (deleted_at). 
- Ajouter des commentaires SQL sur chaque table et colonne (en anglais). 
- Tester l’exécution complète du script sur les deux bases (prod-like et test).

__Livrable__ : 

- Fichier database/scripts/03_create_tables.sql complet et commenté 
- Capture montrant que toutes les tables existent dans DBeaver (avec commentaires) 
- Mise à jour de DATABASE_DESIGN.md

__Compétences RNCP travaillées__ :  
2.1 (schéma physique, règles de nommage, sécurité, intégrité), 3.1 Documentation

__Jour 5__  
__Tâche__ : Données de test réalistes \+ jeu d’essai  
__Détail concret__ : 

- Créer un jeu d’essai complet (minimum 8 recettes, 5 utilisateurs, 12 commentaires, catégories, notes). 
- Les données doivent refléter les 3 personas (recettes <15 min, <5 ingrédients, <3€, avec anecdotes humaines et humour). 
- Écrire un script 04_seed_data.sql qui insère ces données de façon cohérente (respecter les foreign keys). 
- Créer un fichier TEST_CASES.md listant 10 tests manuels (ex: "Vérifier qu’une recette avec coût 2.5€ apparaît dans le filtre <3€").

__Livrable__ : 

- database/scripts/04_seed_data.sql 
- docs/qualite/test-cases.md (en anglais pour la partie description des tests) 
- Base de données remplie et prête à être interrogée

__Compétences RNCP travaillées__ :  
2.1 (base de test), 2.2 (préparation des données), 3.2 Démarche de résolution de problème

__Jour 6  (erreur de planning, doublon attention  SPEEDRUN apartir de security.js)__  
__Tâche__ : Mise en place du projet Node.js \+ Express \+ connexion sécurisée à MariaDB  
__Détail concret__ : 

- Créer une architecture propre : src/config/, src/database/, src/middlewares/, src/utils/. 
- Configurer la connexion à MariaDB via un pool (fichier src/database/connection.js). 
- Créer un middleware de logging des erreurs et un middleware de sécurité de base (Helmet). 
- Rédiger un app.js ou server.js qui lance le serveur sur port 3000 avec une route /health qui renvoie l’état de la BDD. 

__Livrable__ : 

- Structure de dossiers complète 
- Serveur Express qui démarre et se connecte à MariaDB (route /health fonctionnelle) 
- README.md mis à jour avec instructions de lancement

__Compétences RNCP travaillées__ :  
1.1 (environnement, outils), 2.1 (connexion sécurisée), 3.3 Veille technologique

__Jour 7__  
__Tâche__ : Création des premiers modèles de données (Data Layer)  
__Détail concret__ : 

- Créer le dossier src/models avec un fichier par entité principale. 
- Commencer par les modèles les plus simples et indépendants : Category.js et User.js. 
- Chaque modèle doit contenir : 
	- Des méthodes statiques pour CRUD basiques (findAll, findById, create, update, delete). 
	- Utilisation exclusive de requêtes paramétrées (prepared statements) avec mysql2 pour prévenir les injections SQL. 
	- Gestion propre des erreurs et des cas où aucune ligne n’est trouvée.
- Rédiger en anglais (niveau B1) dans chaque fichier un commentaire en haut expliquant le rôle du modèle et les mesures de sécurité prises. 
- Respecter les règles de nommage du référentiel (clarté, cohérence).

__Livrable__ : 

- Fichiers : src/models/Category.js, src/models/User.js (avec méthodes CRUD sécurisées) 
- Mise à jour de DATABASE_DESIGN.md avec les méthodes implémentées 
- Premier jeu de tests manuels dans TEST_CASES.md (exécution des méthodes depuis un script de test)

__Compétences RNCP travaillées__ :  
2.2 Développer des composants d’accès aux données SQL, 2.1 (intégrité et confidentialité), 3.1 (documentation en anglais), 3.2 (démarche structurée)

__Jour 8__  
__Tâche__ : Modèle Recipe complet \+ relations  
__Détail concret__ : 

- Créer src/models/Recipe.js. 
- Inclure toutes les colonnes définies dans le MPD (titre, ingredients, steps, anecdote, temps_preparation, cout_portion, categorie_id, user_id, note_moyenne, etc.). 
- Ajouter les méthodes suivantes : 
	- findAllWithFilters(filters) : doit supporter la combinaison des filtres US-07 (temps, budget, nb ingredients, catégorie). 
	- findByIdWithDetails(id) : récupère la recette \+ son auteur \+ les commentaires associés. 
	- create(recipeData) avec validation côté modèle (coût > 0, temps > 0, anecdote non vide). 
	- Soft delete.
- Utiliser des jointures SQL propres et des requêtes paramétrées partout. 
- Ajouter des commentaires ligne par ligne sur les requêtes les plus complexes.

__Livrable__ : 

- src/models/Recipe.js complet et commenté en anglais 
- Script de test manuel (test-recipe-model.js) qui teste tous les filtres et la création 
- Mise à jour de TEST_CASES.md avec au moins 8 nouveaux cas de test

__Compétences RNCP travaillées__ :  
2.2 (composants d’accès aux données, cas d’exception, validation des entrées), 2.3 (préparation des traitements métier), 3.2 Résolution de problème

__Jour 9__  
__Tâche__ : Modèles Comment, Rating et système de points (Gamification basique)  
__Détail concret__ : 

- Créer src/models/Comment.js et src/models/Rating.js. 
- Implémenter : 
	- Ajout de commentaire avec pseudo uniquement (US-13). 
	- Ajout de note (1 à 5) et calcul automatique de la note moyenne de la recette après chaque vote. 
	- Système de points très simple : \+10 points à l’auteur à chaque nouvelle recette, \+5 par note ≥ 4.
- Créer une table UserPoints ou ajouter les champs directement dans User (à décider dans ton design). 
- Mettre à jour Recipe.js pour recalculer la note moyenne via trigger SQL ou via une méthode dédiée.

__Livrable__ : 

- Modèles Comment.js, Rating.js \+ modification de User.js et Recipe.js 
- Script de test complet qui simule : création recette → commentaire → note → mise à jour des points 
- Mise à jour de VEILLE.md avec une note sur les triggers SQL vs logique applicative

__Compétences RNCP travaillées__ :  
2.2, 2.3 (composants métier, POO dans les modèles), sécurité des entrées, tests manuels, documentation

__Jour 10__  
__Tâche__ : Mise en place d’Express Router \+ premiers contrôleurs  
__Détail concret__ : 

- Créé RecipeController.js (getAllRecipes, getRecipeById, createRecipe, updateRecipe, deleteRecipe)
- Créé recipeRoutes.js avec validation express-validator (validation intégrée dans les routes)
- Créé CommentController.js (getCommentsByRecipe, createComment, deleteComment)
- Créé commentRoutes.js avec middleware attachUser (mode invité/connecté)
- Créé RatingController.js (rateRecipe)
- Créé ratingRoutes.js
- Branché toutes les routes dans app.js
- Créer errorHandler.js  un middleware global de gestion d’erreurs qui renvoie des réponses JSON propres avec status codes appropriés. 
- Testé l'ensemble via Postman :   
- GET /api/v1/recipes renvoie 200 \+ tableau JSON   
- POST /api/v1/recipes sans body renvoie 422 \+ erreurs de validation   
- GET /api/v1/recipes/:id inexistant renvoie 404  
-… etc 

__Livrable__ : 

- Routes et contrôleurs fonctionnels pour les recettes (testables avec Postman ou curl) 
- Routes protégées pour la soumission de recettes 

__Compétences RNCP travaillées__ :  
2.3 Développer des composants métier côté serveur, 1.1 (outils), 3.1 Documentation technique en anglais, 3.2 Résolution de problème

__Jour 11__  
__Tâche__ : Authentification basique \+ protection des routes contributeurs  
__Détail concret__ : 

- Etendre User.js avec : 
	- register(pseudo, email, password) 
	- login(email, password) qui renvoie un JWT.
- Créer un middleware jwtAuth.js qui protège les routes de création de recette et de tableau de bord utilisateur. 
- Créé AuthController.js (register, login, getMe, hashage bcrypt)
- Créé authRoutes.js (routes \+ validation express-validator)
- Branché /api/v1/auth dans app.js
- Créer API.md pour documenter chaque route et ajouter des tests de sécurité (ex: tenter de créer une recette sans token).

__Livrable__ : 

- Système d’authentification JWT \+ bcrypt fonctionnel 
- API.md mis à jour (description des endpoints, paramètres, exemples de réponses) 
- Tests manuels documentés dans TEST_CASES.md (authentification, injection, etc.)

__Compétences RNCP travaillées__ :  
2.3 (sécurisation des composants métier), 2.2 (validation des entrées), tests de sécurité, documentation

__Jour 12__  
__Tâche__ : Tests unitaires, jeu d’essai complet et documentation finale de la phase Backend  
__Détail concret__ : 

- • installer express-rate-limit
- • Créer admin_logs
- • Middleware attachUser (mode invité/connecté pour commentaires)
- • Gestion des statuts de recette (pending / published / rejected)
- Installer jest et supertest. 
- Écrire au minimum 12 tests unitaires (modèles \+ contrôleurs) : 
	- Tests de validation, tests de filtres multiples, tests d’erreurs (mauvais token, données invalides). 
	- Tests de sécurité (SQL injection simulée, XSS dans les commentaires).
- Compléter le jeu d’essai avec des scénarios réalistes correspondant aux 3 personas. 
- Rédiger un rapport technique BACKEND_REPORT.md en anglais (minimum 2 pages) qui couvre : architecture choisie, mesures de sécurité, difficultés rencontrées, tests réalisés, et comment cela répond aux User Stories. 
- Faire un commit final de cette phase avec un message clair et pousser sur GitHub.

__Livrable__ : 

- Dossier tests/ avec tous les tests (coverage > 70% si possible) 
- BACKEND_REPORT.md (en anglais, niveau B1) 
- Base de données de test propre \+ script de reset facile 
- Repo GitHub à jour avec historique propre

__Compétences RNCP travaillées__ :  
2.2, 2.3 (tests unitaires, tests de sécurité, jeu d’essai fonctionnel), 3.1 Documentation, 3.2 Démarche structurée, 3.3 Apprendre en continu

__Planning de développement du projet "File Rouge" – Backend (Bloc 3 : Jours 13 à 18)__

Voici la suite. Ce bloc finalise le backend en couvrant les User Stories liées à l’administration, à la gamification et aux métriques. On maintient le niveau d’exigence : sécurité, documentation en anglais, tests, Git propre, et lien permanent avec le référentiel.

__Jour 13__  
__Tâche__ : Interface d’administration (US-14) – Suppression et modération  
__Détail concret__ : 

- PREREQUIS : crée middleware requireAdmin.js
- Créer un middleware requireAdmin basé sur un rôle dans la table User (champ role : 'user', 'admin'). 
- Créer src/controllers/AdminController.js avec : 
	- getAllRecipesForAdmin() → liste toutes les recettes (même non publiées). 
	- deleteRecipe(id) ou moderateRecipe(id, status) (soft delete \+ statut "rejected").
- Ajouter une route protégée /admin/recipes (GET, DELETE). 
- Quand une recette est rejetée, insérer une ligne dans une table AdminLogs et simuler l’envoi d’une notification simple à l’auteur (pour l’instant console.log \+ champ notification dans User). 
- Mettre à jour API.md avec les nouvelles routes admin (en anglais, avec exemples de requêtes et réponses). 
- Ajouter des tests de sécurité : un utilisateur normal ne doit pas pouvoir supprimer une recette.

__Livrable__ : 

- AdminController.js \+ routes admin fonctionnelles 
- Middleware requireAdmin 
- Tests de sécurité documentés dans TEST_CASES.md 
- Mise à jour de BACKEND_REPORT.md

__Compétences RNCP travaillées__ :  
2.3 Développer des composants métier côté serveur, 2.2 (sécurité et intégrité des données), tests de sécurité, 3.1 Documentation technique en anglais, 3.2 Démarche de résolution de problème

__Jour 14__  
__Tâche__ : Dashboard Admin – Métriques et statistiques (US-15)  
__Détail concret__ : 

- Dans AdminController.js, ajouter les méthodes : 
	- getDashboardStats() : nombre total de recettes, recettes les plus consultées (ajouter un champ views dans Recipe), mieux notées, catégories les plus actives. 
	- getTopRecipes(limit) et getMostActiveCategories().
- Créer une route /admin/dashboard protégée qui renvoie un objet JSON structuré avec toutes ces métriques. 
- Ajouter un endpoint d’export basique (ex: /admin/export/recipes.csv) qui génère un CSV simple des recettes (utiliser un module léger comme json2csv). 
- Optimiser les requêtes SQL (utilisation d’indexes sur views, average_rating, created_at). 
- Documenter dans VEILLE.md les bonnes pratiques d’indexation MariaDB et les limites de performance.

__Livrable__ : 

- Routes /admin/dashboard et export fonctionnelles 
- Requêtes SQL optimisées avec indexes créés dans un script 05_indexes.sql 
- Mise à jour complète de API.md et BACKEND_REPORT.md (section métriques)

__Compétences RNCP travaillées__ :  
2.3 (composants métier, optimisation), 2.1 (base de données relationnelle, indexes), 2.2 (sécurité des endpoints admin), 3.3 Apprendre en continu (veille performance)

__Jour 15__  
__Tâche__ : Système de gamification complet (points, badges, niveaux) – US-11 & US-12  
__Détail concret__ : 

- Créer src/models/Gamification.js ou étendre User.js et Recipe.js. 
- Implémenter la logique : 
	- \+10 points à la publication d’une recette. 
	- \+5 points par note ≥ 4 reçue. 
	- Calcul de niveau en fonction du total de points (ex: niveau 1 = 0-50, niveau 2 = 51-150, etc.). 
	- Table Badges et UserBadges (badges débloqués : “Débutant”, “Cuistot du soir”, “Légende des recettes”).
- Créer UserController.js avec getUserDashboard(userId) qui renvoie points, niveau, badges, recettes publiées et statistiques personnelles. 
- Route protégée /me/dashboard. 
- Page explicative statique (pour l’instant une route /badges qui renvoie la liste des badges et les conditions). 
- Les recettes des hauts niveaux ont un champ boosted qui peut être utilisé plus tard pour le tri.

__Livrable__ : 

- Modèle Gamification \+ logique de points et badges 
- UserController.js avec dashboard utilisateur 
- Route /badges et /me/dashboard 
- Tests unitaires pour le calcul de points et de niveaux

__Compétences RNCP travaillées__ :  
2.3 (composants métier, logique métier complexe), 2.2 (intégrité des données), tests unitaires, documentation des règles métier en anglais dans GAMIFICATION.md

__Jour 16__  
__Tâche__ : Finalisation des filtres avancés côté backend (US-01, US-03, US-04, US-07)  
__Détail concret__ : 

- Améliorer Recipe.js → méthode findAllWithFilters(filters) pour supporter : 
	- Temps de préparation (< 15 min) 
	- Budget (< 3€, < 5€) 
	- Nombre d’ingrédients (< 5) 
	- Catégorie, popularité (combinaison rapide \+ original \+ <3€)
- Ajouter un tri intelligent (par pertinence pour le persona : d’abord les recettes <15 min pour le salarié crevé, etc.). 
- Créer des constantes dans src/constants/filters.js pour éviter la magie dans le code. 
- Ajouter des tests unitaires spécifiques pour chaque combinaison de filtres (minimum 6 tests). 
- Mettre à jour TEST_CASES.md avec un tableau complet de tous les filtres et scénarios attendus.

__Livrable__ : 

- findAllWithFilters ultra-robuste et bien testé 
- constants/filters.js 
- Rapport dans BACKEND_REPORT.md expliquant comment les filtres répondent aux personas

__Compétences RNCP travaillées__ :  
2.2 (développement de composants d’accès aux données complexes), 2.3 (logique métier), 3.2 Démarche structurée de résolution de problème, tests unitaires

__Jour 17__  
__Tâche__ : Sécurité globale, nettoyage, documentation technique finale et préparation au front  
__Détail concret__ : 

- Audit complet : Helmet, CORS (restreint), rate limiting (express-rate-limit), validation de toutes les entrées, protection contre XSS (via middleware ou escape), JWT sécurisé (httpOnly cookies si possible). 
- Ajouter des logs structurés avec Winston (erreurs, accès admin, tentatives de suppression). 
- Mettre à jour tous les fichiers de documentation : 
	- API.md complet (toutes les routes, avec authentication requise ou non). 
	- SECURITY.md (mesures prises, correspondant au référentiel). 
	- Mise à jour finale de BACKEND_REPORT.md (minimum 4-5 pages en anglais).
- Créer un script reset-db.js \+ seed.js pour pouvoir recréer la base proprement. 
- Faire un commit majeur : chore: finalize backend core - ready for frontend.

__Livrable__ : 

- SECURITY.md \+ API.md finalisés 
- Audit de sécurité documenté 
- Scripts de reset et seed faciles à utiliser 
- Repo GitHub propre avec historique clair et messages de commit professionnels

__Compétences RNCP travaillées__ :  
2.3 (sécurisation des composants), 1.1 (outils et documentation), 3.1 (documentation en anglais B1), 3.2 Résolution de problème, 3.3 Veille technologique et sécurité

__Jour 18__  
__Tâche__ : Revue globale du backend \+ auto-évaluation par rapport au référentiel  
__Détail concret__ : 

- Relire tout le code avec un regard critique : structure, lisibilité, maintenabilité, respect des bonnes pratiques (sémantique des noms, commentaires, séparation des préoccupations). 
- Remplir un tableau d’auto-évaluation dans RNCP_SELF_ASSESSMENT.md en listant chaque item du bloc 2 du référentiel (2.1, 2.2, 2.3) et en indiquant où et comment tu l’as couvert (avec liens vers les fichiers). 
- Identifier les points faibles restants et proposer un plan de correction (maximum 3 points d’amélioration concrets). 
- Préparer une démo backend : un script ou une collection Postman exportée qui permet de tester toutes les fonctionnalités principales (création compte, publication recette, filtres, admin, dashboard, gamification).

__Livrable__ : 

- RNCP_SELF_ASSESSMENT.md rempli (en français \+ tableau en anglais) 
- Collection Postman exportée (postman_collection.json) 
- Liste des 3 points d’amélioration identifiés 
- Repo prêt pour la phase front-end

__Compétences RNCP travaillées__ :  
Toutes les compétences du bloc 2 (2.1, 2.2, 2.3), 3.1, 3.2, 3.3 – Revue critique et auto-évaluation

__Phase Front-end (Bloc 4 : Jours 19 à 30)__

__Règles strictes pour cette phase :__

- HTML5 sémantique uniquement, zéro framework.
- CSS3 vanilla (Flexbox, Grid, Mobile-first, pas de Bootstrap).
- JavaScript vanilla (pas de React, pas de librairies externes sauf si indispensable et justifié).
- Accessibilité WCAG 2.1 niveau AA / RGAA prioritaire à chaque étape.
- Mobile-first \+ Responsive.
- Éco-conception (poids des images, lazy loading, réduction des requêtes).
- SEO technique (balises meta, titres, structure, aria, schema.org quand pertinent).
- Documentation en anglais (niveau B1) dans chaque fichier important.

__Jour 19__  
__Tâche__ : Structure HTML sémantique globale \+ Accessibilité de base (1.3)  
__Détail concret__ : 

- Créer le dossier public/ ou frontend/ avec index.html, recette.html, dashboard.html, admin.html. 
- Définir une structure HTML5 parfaitement sémantique : <header>, <nav>, <main>, <section>, <article>, <footer>, <aside> quand pertinent. 
- Implémenter un système de skip links, role="main", lang="fr", titres hiérarchiques corrects. 
- Ajouter toutes les meta tags SEO \+ Open Graph de base. 
- Créer un fichier accessibility.md (en anglais) listant les règles WCAG/RGAA appliquées. 
- Commencer un Design System très simple (styleguide.html) qui servira de référence.

__Livrable__ : 

- 4 fichiers HTML squelettes sémantiquement corrects 
- styleguide.html avec les éléments de base (headings, buttons, cards) 
- accessibility.md rempli (minimum 15 règles documentées) 
- Premier commit : feat: semantic html skeleton \+ accessibility baseline

__Compétences RNCP travaillées__ :  
1.3 Réaliser des interfaces utilisateur statiques, 1.2 Maquetter des interfaces, 3.1 Documentation, accessibilité (RGAA/WCAG), SEO de base

__Jour 20__  
__Tâche__ : Design System complet \+ Variables CSS \+ Mobile-first (1.3)  
__Détail concret__ : 

- Créer css/variables.css avec Custom Properties (--primary-color, --font-size-base, --spacing-xs à --spacing-xl, --radius, etc.). 
- Définir une typographie accessible (tailles relatives en rem, contrastes minimum 4.5:1). 
- Créer css/base.css (reset léger, box-sizing, font-family système). 
- Créer css/components/ : _card.css, _button.css, _filter.css, _badge.css. 
- Tout en Mobile-first. 
- Ajouter des focus visibles et states :hover, :focus, :active accessibles. 
- Tester le contraste avec un outil (Wave ou axe DevTools). 
- Mettre à jour styleguide.html avec tous les composants.

__Livrable__ : 

- Dossier css/ complet avec variables et composants réutilisables 
- styleguide.html à jour et responsive 
- Rapport dans accessibility.md sur les contrastes et focus management

__Compétences RNCP travaillées__ :  
1.3 (interfaces statiques, éco-conception, responsive), accessibilité, code maintenable, 3.2 Résolution de problème (design system)

__Jour 21__  
__Tâche__ : Homepage – Mise en page \+ Bouton "Surprends-moi" (US-01)  
__Détail concret__ : 

- Réaliser la homepage en respectant le persona "Salarié crevé" (priorité au filtre <15 min et bouton Surprends-moi très visible). 
- Intégrer le bouton "Surprends-moi" qui appellera plus tard l’API (pour l’instant il affiche une carte recette statique aléatoire parmi 3-4 exemples). 
- Afficher clairement le temps de préparation en gros sur chaque carte. 
- Filtre "Prêt en moins de 15 minutes" en évidence. 
- Respecter éco-conception : images en loading="lazy", tailles optimisées, peu de requêtes. 
- Ajouter aria-labels pertinents et rôle sur les cartes interactives.

__Livrable__ : 

- index.html complet et responsive 
- Carte recette réutilisable via CSS components 
- Bouton "Surprends-moi" fonctionnel en statique 
- Mise à jour de accessibility.md et frontend-report.md (en cours)

__Compétences RNCP travaillées__ :  
1.3 (interface conforme, UX, accessibilité, responsive, éco-conception), 1.4 (préparation du dynamique), SEO

__Jour 22__  
__Tâche__ : Page Recette détaillée \+ Bloc "L’histoire derrière" (US-02)  
__Détail concret__ : 

- Créer recette.html avec tous les éléments : titre, temps, coût, ingrédients (<5 pour le persona étudiant), étapes, et surtout le bloc narratif "L’histoire derrière" avec ton humain et humoristique. 
- Ajouter les commentaires (US-13) : formulaire simple avec pseudo (sans compte) \+ affichage des commentaires existants. 
- Rendre la page accessible (landmarks, aria sur les listes d’ingrédients, contraste sur le récit). 
- Préparer des placeholders pour les données qui viendront du backend plus tard.

__Livrable__ : 

- recette.html complète, accessible et narrative 
- Système de commentaires statique (ajout via JS) 
- Exemples concrets d’anecdotes dans le ton exigé

__Compétences RNCP travaillées__ :  
1.3 & 1.4 (interface dynamique statique pour l’instant, accessibilité, UX pour les 3 personas), documentation des choix narratifs

__Jour 23__  
__Tâche__ : Filtres avancés \+ Recherche (US-03, US-04, US-07)  
__Détail concret__ : 

- Sur la homepage et une page /recettes.html, implémenter : 
	- Filtres budget (<3€, <5€) 
	- Filtre "Moins de 5 ingrédients" 
	- Filtre temps (<15 min) 
	- Combinaison de plusieurs filtres en JavaScript vanilla.
- Afficher le coût estimé par portion sur chaque carte. 
- Créer un système de tags/filtres actifs (avec bouton pour les retirer). 
- Tout doit fonctionner sans rechargement de page (state en JS). 
- Ajouter un indicateur de nombre de recettes trouvées. 
- Respecter performance (éviter les reflows inutiles).

__Livrable__ : 

- Page /recettes.html avec filtres multiples fonctionnels en JS vanilla 
- Système de tags actifs 
- Données mockées correspondant aux personas (au moins 12 recettes différentes)

__Compétences RNCP travaillées__ :  
1.4 Développer la partie dynamique des interfaces (JavaScript vanilla), accessibilité des filtres (aria-live pour annonces), UX, 3.2 Démarche structurée

__Jour 24__  
__Tâche__ : Revue critique Front-end statique \+ Documentation intermédiaire  
__Détail concret__ : 

- Audit complet d’accessibilité (utiliser axe ou Wave \+ checklist RGAA). 
- Vérifier Mobile-first sur plusieurs tailles (375px, 768px, 1024px). 
- Optimiser les performances (Lighthouse score objectif > 90 en Performance et Accessibilité). 
- Rédiger FRONTEND_REPORT.md (en anglais, niveau B1) : choix techniques, mesures d’accessibilité prises, comment les US des 3 personas sont respectées, difficultés rencontrées. 
- Mettre à jour styleguide.html avec tous les composants créés. 
- Commit majeur et push.

__Livrable__ : 

- FRONTEND_REPORT.md (minimum 3 pages) 
- Scores Lighthouse documentés 
- accessibility.md finalisé pour la partie statique 
- Auto-évaluation des compétences 1.2 et 1.3 du référentiel

__Compétences RNCP travaillées__ :  
1.2, 1.3 (maquettage et interfaces statiques), 1.4 (début du dynamique), 3.1 Documentation en anglais, 3.2 & 3.3 (veille et apprentissage continu)

__Planning de développement du projet "File Rouge" – Phase Front-end (Bloc 5 : Jours 25 à 30)__

__VALIDÉ – CONTINUE__ accepté. On passe maintenant à la partie la plus exigeante du front-end : l’intégration dynamique avec ton backend, l’authentification, les dashboards et la finition selon le référentiel 1.4.

__Rappel des règles (je ne les répéterai plus) :__ 

- JavaScript vanilla uniquement. 
- Accessibilité dynamique (aria-live, focus management, annonces). 
- Sécurité front (sanitization des données venant du backend, protection XSS). 
- Mobile-first, performance, éco-conception. 
- Documentation en anglais dans les fichiers JS. 
- Chaque fonctionnalité doit être testable manuellement avec un jeu d’essai.

__Jour 25__  
__Tâche__ : Authentification front-end (Login / Register) – US liées aux comptes  
__Détail concret__ : 

- Créer login.html et register.html avec formulaires accessibles (labels explicites, aria-describedby pour les erreurs, validation native \+ JS). 
- Créer js/auth.js avec : 
	- Fonctions login(email, password) et register(username, email, password) utilisant fetch vers ton API backend (/api/auth/login, /api/auth/register). 
	- Stockage sécurisé du token JWT dans localStorage (avec commentaire expliquant les risques et pourquoi c’est acceptable pour ce projet). 
	- Middleware-like : fonction isAuthenticated() et getCurrentUser(). 
	- Gestion des erreurs (affichage clair, messages accessibles).
- Ajouter un header dynamique qui affiche "Se connecter" ou "Mon compte \+ logout" selon l’état. 
- Protéger les routes sensibles côté front (redirection si non connecté).

__Livrable__ : 

- js/auth.js bien commenté en anglais 
- Pages login/register fonctionnelles et accessibles 
- Mise à jour de FRONTEND_REPORT.md (ajout des mesures de sécurité front-end) 
- Tests manuels documentés (échecs de connexion, inscription, token expiré)

__Compétences RNCP travaillées__ :  
1.4 Développer la partie dynamique des interfaces utilisateur, respect des recommandations de sécurité, accessibilité, documentation du code en anglais, tests manuels

__Jour 26__  
__Tâche__ : Connexion réelle à l’API – Recettes dynamiques (Homepage \+ Filtres)  
__Détail concret__ : 

- Créer js/api.js avec une fonction générique apiRequest(endpoint, method = 'GET', data = null) qui gère le token automatiquement. 
- Rendre la homepage dynamique : au chargement, récupérer les recettes via fetch et afficher les cartes. 
- Implémenter les filtres (temps, budget, nombre d’ingrédients) en JavaScript : ils doivent déclencher une nouvelle requête à ton backend avec query params (?time=15&budget=5&ingredients=5). 
- Ajouter le bouton "Surprends-moi" qui appelle une route backend aléatoire ou filtre côté client sur les résultats. 
- Utiliser aria-live pour annoncer le nombre de résultats trouvés (accessibilité). 
- Gérer les états de chargement (spinner accessible) et les erreurs réseau.

__Livrable__ : 

- js/api.js \+ js/recipes.js 
- Homepage et page liste complètement dynamiques 
- Filtres multiples fonctionnels avec le backend 
- Mise à jour de accessibility.md (gestion dynamique des annonces)

__Compétences RNCP travaillées__ :  
1.4 (interface dynamique, amélioration UX, accessibilité incluse), sécurité (validation des entrées côté front), 3.2 Démarche structurée de résolution de problème

__Jour 27__  
__Tâche__ : Page Recette détaillée dynamique \+ Commentaires (US-02, US-13)  
__Détail concret__ : 

- Rendre recette.html dynamique : récupérer l’ID via l’URL (?id=xx ou route avec paramètre), appeler l’API pour charger les détails, ingrédients, étapes, histoire, notes. 
- Implémenter le système de commentaires : formulaire d’ajout (avec sanitization basique), affichage des commentaires existants, mise à jour en temps réel après ajout. 
- Ajouter un système simple de notation (étoiles cliquables) qui met à jour average_rating. 
- Gérer les focus et les mises à jour du DOM de façon accessible.

__Livrable__ : 

- recette.html \+ js/recipe-detail.js complet 
- Commentaires et notation fonctionnels (connectés au backend) 
- Tests manuels avec jeu d’essai (3 personas) documentés dans TEST_CASES.md

__Compétences RNCP travaillées__ :  
1.4 (partie dynamique, UX, accessibilité), documentation du code, tests de sécurité basiques (XSS dans les commentaires), jeu d’essai fonctionnel

__Jour 28__  
__Tâche__ : Dashboard Utilisateur – Points, Badges & Historique (US-11, US-12)  
__Détail concret__ : 

- Créer dashboard.html protégé (vérification token). 
- Afficher : niveau actuel, points accumulés, badges débloqués (avec icônes CSS), historique des recettes publiées et notées. 
- Récupérer ces données via ton backend (/api/user/profile, /api/user/badges, etc.). 
- Ajouter une section "Mes recettes en attente de modération" avec statut visible. 
- Rendre le dashboard responsive et accessible (navigation au clavier, contrastes, annonces lors du chargement des badges). 
- Appliquer le style du Design System créé précédemment.

__Livrable__ : 

- dashboard.html \+ js/dashboard.js 
- Affichage dynamique des points, badges et historique 
- Mise à jour de FRONTEND_REPORT.md avec captures et explication de la gamification

__Compétences RNCP travaillées__ :  
1.4 (interface dynamique conforme au dossier de conception), accessibilité, UX pour le persona "Passionné", documentation

__Jour 29__  
__Tâche__ : Dashboard Admin \+ Modération (US-14, US-15)  
__Détail concret__ : 

- Créer admin.html protégé par rôle admin. 
- Afficher le dashboard statistiques (nombre de recettes, top recettes, catégories actives) via l’API admin. 
- Liste des recettes en attente avec boutons "Publier" / "Rejeter" (appels aux routes admin créées au bloc 3). 
- Tableau des logs d’administration. 
- Bouton d’export CSV des recettes. 
- Très forte exigence sur l’accessibilité (tableaux accessibles avec aria, tri possible au clavier).

__Livrable__ : 

- admin.html \+ js/admin.js fonctionnel 
- Tests de sécurité : un utilisateur normal ne doit pas accéder à cette page 
- Mise à jour complète de BACKEND_REPORT.md et FRONTEND_REPORT.md

__Compétences RNCP travaillées__ :  
1.4, 2.3 (intégration front/back), tests de sécurité, accessibilité avancée, documentation en anglais

__Jour 30__  
__Tâche__ : Revue finale Front-end \+ Préparation au rendu RNCP  
__Détail concret__ : 

- Audit complet Lighthouse (Performance, Accessibility, Best Practices, SEO) – objectif > 90 partout. 
- Vérification RGAA complète (focus, contrastes, aria, navigation clavier, lecteur d’écran simulé). 
- Optimisations éco-conception finales (images, lazy loading, minification manuelle si possible). 
- Rédiger la version finale de FRONTEND_REPORT.md (en anglais, minimum 5-6 pages) : architecture, choix techniques, mesures de sécurité et d’accessibilité, correspondance aux User Stories et personas, tests réalisés. 
- Compléter RNCP_SELF_ASSESSMENT.md pour toutes les compétences du bloc 1 (1.1 à 1.4). 
- Préparer une démo front-end fluide (script de présentation ou collection de captures). 
- Commit final : feat: complete frontend integration - ready for final review.

__Livrable__ : 

- Tous les rapports finaux à jour 
- Scores Lighthouse et audit accessibilité documentés 
- RNCP_SELF_ASSESSMENT.md complet pour le bloc Front-end 
- Repo GitHub impeccable (historique, README clair, .gitignore propre)

__Compétences RNCP travaillées__ :  
__Toutes les compétences du bloc 1__ (1.1 à 1.4), 3.1 Communication en français et anglais, 3.2 Démarche de résolution de problème, 3.3 Apprendre en continu

__Fin du planning structuré "File Rouge"__

