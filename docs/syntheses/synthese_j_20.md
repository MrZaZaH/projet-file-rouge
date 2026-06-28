# Synthèse Jour 20

**Ce qu'on a fait**

- Création de `frontend/public/css/variables.css` avec les Custom Properties :
  - Couleurs principales, secondaires, textes, fonds
  - Typographie (tailles en rem, familles de polices)
  - Espacements (--spacing-xs à --spacing-xl)
  - Bordures, rayons, ombres
  - Breakpoints responsive
- Création de `frontend/public/css/styles.css` :
  - Reset léger (box-sizing, marges)
  - Typographie accessible (contraste 4.5:1 minimum, tailles relatives)
  - Layout : header, footer, grille de recettes
  - Composants : cards, boutons, formulaires, modale, navigation mobile
  - États :hover, :focus, :accessibles avec focus visibles
  - Mobile-first avec 3 breakpoints (576px, 768px, 992px)
  - Menu hamburger pour mobile
- Mise à jour de `styleguide.html` avec tous les composants du Design System
- Documentation des contrastes et du focus management dans `accessibility.md`

**Problèmes rencontrés**

- Aucun commit distinct pour le Jour 20 : le CSS a été créé dans le même commit que les pages HTML (`eac3c65`)
- Pas de séparation en fichiers `_card.css`, `_button.css`, `_filter.css`, `_badge.css` comme prévu au planning — tout est dans un seul fichier `styles.css` pour simplifier

**Décisions techniques**

- CSS vanilla uniquement — pas de préprocesseur, pas de framework
- Custom Properties pour la maintenabilité et la cohérence visuelle
- Mobile-first : les styles de base sont pour mobile, les media queries ajoutent pour les écrans plus larges
- Contraste minimum 4.5:1 vérifié sur tous les textes
- Police système avec fallback, Google Fonts en option (Playfair Display + Special Elite)
- Un seul fichier CSS pour limiter les requêtes HTTP (éco-conception)

**Livrables**

- `frontend/public/css/variables.css` — Custom Properties complètes
- `frontend/public/css/styles.css` — Design System complet
- `frontend/public/styleguide.html` — guide de style mis à jour
- `docs/accessibility.md` — section contrastes et focus management ajoutée
