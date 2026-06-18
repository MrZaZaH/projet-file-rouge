__Synthèse – Jour 16 : Filtres avancés backend__

__Ce qu'on a fait__

- findAllWithFilters() dans Recipe.js — supporte temps, budget, ingrédients, catégorie, popularité, Jackpot, pagination
- Tri conditionnel selon le filtre actif (BY_TIME, BY_COST, BY_RATING, BY_DATE)
- src/constants/filters.js créé — centralise toutes les valeurs magiques (QUICK_PREP_MAX, BUDGET_LOW_MAX, BUDGET_MID_MAX, DEFAULT_LIMIT, MAX_LIMIT) \+ constantes SORT
- Déviation non prévue : debug/exploration Winston (hors scope jour 16)

__Problèmes rencontrés__

__recipeModel.test.js vide__

- Contexte : découvert en fin de session lors du check des livrables
- Options : écrire les tests maintenant / reporter à la phase tests finaux
- Décision : reporté — le planning prévoit déjà une phase de tests consolidée, et avancer sur le frontend est prioritaire

__Décisions techniques prises__

- constants/filters.js est la source unique de vérité pour toutes les valeurs de filtrage — aucune valeur magique autorisée dans le reste du code
- Pagination obligatoire sur findAllWithFilters() — hard cap à 100 lignes
- Tri conditionnel : le sort s'adapte au filtre dominant, pas un tri fixe unique

__Ce qui a été écarté et pourquoi__

- TEST_CASES.md — reporté à la phase tests finaux
- BACKEND_REPORT.md section filtres — reporté, dépend des tests
- Tests unitaires filtres (6 minimum) — reportés, recipeModel.test.js sera écrit en bloc en fin de projet
- Doublons (Recipe1.js, RecipeController1.js, etc.) — identifiés, nettoyage prévu lors du hardening final

