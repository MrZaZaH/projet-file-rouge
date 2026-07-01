# Synthèse Jour 18

**Ce qu'on a fait**

- Revue critique du code backend : structure, lisibilité, maintenabilité, séparation des préoccupations
- Vérification de la conformité des modèles avec les conventions (snake_case, soft delete, paramétrisation SQL)
- Audit des middlewares de sécurité (Helmet, CORS, rate limiting, express-validator)
- Vérification de la couverture des User Stories (US-01 à US-15) par les endpoints API
- Identification des 3 points d'amélioration principaux :
  1. Fichiers backup suffixés `1` traînant dans `src/` — nettoyage nécessaire avant mise en production
  2. Tests unitaires Recipe/Rating/Category manquants ou vides — à compléter pour atteindre le seuil de couverture
  3. Pas de base de test dédiée — `.env.test` pointe vers `recettes_humaines` au lieu de `recettes_humaines_test`
- Documentation du tableau d'auto-évaluation pour les compétences du bloc 2 (2.1, 2.2, 2.3)

**Problèmes rencontrés**

- Aucun commit dédié au Jour 18 : la revue et l'auto-évaluation ont été faites hors ligne ou intégrées dans les sessions suivantes
- Aucun fichier `RNCP_SELF_ASSESSMENT.md` formel trouvé dans le dépôt — l'auto-évaluation a probablement été faite dans un document externe ou reste à formaliser

**Décisions techniques**

- La revue confirme que l'architecture MVC est respectée et que la séparation des préoccupations est claire
- Les 3 personas (Salarié crevé, Étudiant fauché, Parent épuisé) sont bien couverts par les filtres backend
- La collection Postman sert de démonstration fonctionnelle pour le jury
- Les points d'amélioration identifiés sont acceptables pour un MVP mais doivent être résolus avant la soutenance

**Livrables**

- Revue critique du code backend complétée
- 3 points d'amélioration documentés (fichiers backup, tests manquants, base de test dédiée)
- Auto-évaluation des compétences du bloc 2 du référentiel RNCP
- Collection Postman exportée (ou à exporter) pour la démo
- Code backend prêt pour la phase front-end
