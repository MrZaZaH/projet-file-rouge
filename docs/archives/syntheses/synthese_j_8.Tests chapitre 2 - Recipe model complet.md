# Synthèse Jour 8 — Tests chapitre 2 : Recipe model complet

__Synthèse – Jour 8 : les tests chapitre 2 __

__Recipe model complet \+ relations \+ tests __

__Ce qu'on a fait__

- Créé src/models/Recipe.js avec toutes les méthodes : create(), findById(), findAllWithFilters(), update(), updateStatus(), updateRating(), findRandom(), delete() (soft)
- Implémenté les filtres combinables : max_prep_time, max_cost, status, search
- findById() retourne la recette avec le username de l'auteur (JOIN sur users)
- ingredients et steps parsés automatiquement de JSON → array en sortie de requête
- Soft delete via deleted_at — toutes les requêtes filtrent WHERE deleted_at IS NULL
- Créé test-scripts/test-recipe-model.js — 12 tests manuels, tous passés ✅
- Documenté les cas de test TC-07 à TC-17 dans docs/qualite/test-cases.md
- Corrigé le bug dotenv dans les scripts de test (path.resolve(__dirname, '../.env'))

__Problèmes rencontrés__

__dotenv non chargé dans les scripts de test__

- __Contexte__ : test-recipe-model.js importe directement les modèles sans passer par app.js → process.env vide → exception au démarrage
- __Options envisagées__ : Mettre dotenv dans connection.js (pollue le module), mettre dans chaque script de test
- __Décision retenue__ : require('dotenv').config(\{ path: path.resolve(__dirname, '../.env') \}) en tête de chaque script de test — explicite et localisé

__Décisions techniques prises__

- ingredients et steps stockés en JSON dans MariaDB, parsés à la lecture — jamais exposés comme string brute
- updateRating() recalcule average_rating et rating_count directement en SQL (AVG \+ COUNT) plutôt qu'en JS — plus fiable, une seule source de vérité
- Toutes les requêtes en namedPlaceholders (:param) — zéro concaténation SQL

__Ce qui a été écarté__

- ingredient_count — supprimé définitivement, aucune trace dans le modèle
- Filtres côté JS sur les résultats — rejeté, les filtres se font en SQL uniquement

