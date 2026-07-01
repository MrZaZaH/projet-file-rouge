# Synthèse Jour 21

**Ce qu'on a fait**

- Implémentation complète de la homepage (`index.html`) :
  - Section héros avec présentation du concept
  - Filtres par personnage BD (Salarié crevé, Étudiant fauché, Parent épuisé)
  - Grille de recettes avec cartes (temps, coût, anecdote, note)
  - Bouton "Surprends-moi" très visible cablé à l'API backend (`/api/v1/recipes/random`)
- Persona filtering : chaque carte personnage déclenche un appel API avec des paramètres spécifiques :
  - Salarié crevé : `prep_time <= 15 min`
  - Étudiant fauché : `cost <= 5€`
  - Parent épuisé : `prep_time <= 20 min + rating >= 4`
- Filtrage dynamique sans rechargement de page (JavaScript vanilla)
- Réarchitecture complète du CSS/JS (commit `bfa228b`) :
  - Refonte graphique avec le Design System
  - JavaScript partagé dans `js/app.js` (utilitaires, modale auth, menu mobile, `surpriseMe()`, `fetchRecipes()`)
  - États de chargement, erreur et contenu gérés
- Accessibilité : `aria-label`, `aria-pressed`, `role="button"` sur les cartes personnage, `aria-live` sur la grille, `aria-expanded` sur le menu mobile
- Éco-conception : `loading="lazy"` pour les images, CSS minifié en un seul fichier, pas de dépendances externes
- Documentation : `frontend/docs/frontend-report.md` créé avec le statut Day 21

**Problèmes rencontrés**

- Le commit `eac3c65` contenait une faute de frappe dans le nom du fichier `sbmit.html` au lieu de `submit.html` — corrigé dans le refactor suivant
- Les cartes personnage utilisaient initialement des éléments `<button>` invalides comme conteneurs — corrigé avec `role="button"` sur des `<article>` accessibles

**Décisions techniques**

- Les 3 personnages BD sont les seuls filtres de la homepage — pas de contrôles supplémentaires (chips, sliders, dropdowns)
- "Surprends-moi" appelle `GET /api/v1/recipes/random` côté backend — pas de fallback statique
- Les images des recettes utilisent des placeholders en attendant l'implémentation réelle
- Le design est délibérément non-lisse, reflet de l'identité du projet (recettes authentiques, humour)

**Livrables**

- `frontend/public/index.html` — homepage complète et responsive
- `frontend/public/js/app.js` — JavaScript partagé
- `frontend/css/variables.css` et `frontend/css/styles.css` — refonte graphique complète
- `frontend/docs/frontend-report.md` — rapport frontend statut Day 21
- `frontend/docs/architecture-frontend.md` — documentation d'architecture
