# Synthèse Jour 19

**Ce qu'on a fait**

- Création du dossier `frontend/public/` avec les fichiers HTML structurés :
  - `index.html` — page d'accueil avec section héros, grille de recettes, filtres par personnage
  - `recipe.html` — page détail de recette avec ingrédients, étapes, histoire, commentaires
  - `styleguide.html` — guide de style pour le Design System
  - `submit.html` — formulaire de soumission de recette
- Structure HTML5 sémantique appliquée partout : `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>`
- Skip link vers le contenu principal sur toutes les pages
- `lang="fr"` sur toutes les pages
- Hiérarchie de titres correcte (h1 → h2 → h3)
- Meta tags SEO et Open Graph de base
- Création de `docs/accessibility.md` avec 15+ règles RGAA/WCAG documentées (contrastes, focus, landmarks, aria, navigation clavier)
- Base du styleguide avec les éléments fondamentaux : headings, boutons, cartes

**Problèmes rencontrés**

- Aucun commit distinct pour le Jour 19 : les fichiers HTML squelettes ont été créés en une seule session de travail avec les jours 20-22 (commit `eac3c65`)
- Le squelette `admin.html` et `dashboard.html` prévus au planning n'ont pas été créés — reportés à la phase d'intégration backend (Jours 28-29)

**Décisions techniques**

- HTML5 sémantique uniquement, zéro framework CSS/JS
- Mobile-first avec viewport meta et breakpoints à définir dans le CSS
- Accessibilité intégrée dès la structure (pas de rattrapage après coup)
- SEO et Open Graph intégrés dans chaque page pour le référencement
- Les placeholders de données backend sont marqués explicitement pour faciliter le cablage futur

**Livrables**

- `frontend/public/index.html` — page d'accueil squelette
- `frontend/public/recipe.html` — page détail squelette
- `frontend/public/styleguide.html` — base du guide de style
- `frontend/public/submit.html` — formulaire de soumission
- `docs/accessibility.md` — documentation accessibilité (15+ règles RGAA)
