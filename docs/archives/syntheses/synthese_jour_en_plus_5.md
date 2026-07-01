## Synthèse – Jour 5 : Illustrations des personnages et swap visuel

### Ce qu'on a fait
- Remplacé les `<div class="persona-card-image">` vides (pastilles grises CSS) par des `<img>` avec les vraies illustrations des 3 personnages
- Implémenté un mécanisme de swap JavaScript entre versions `-default` et `-active` au clic sur une carte persona
- Ajusté le CSS pour passer d'un cercle 100×100 à une image responsive (`width: 85%; height: auto; border-radius: 8px`)
- Défini des `alt` texts humoristiques et positifs pour chaque personnage
- Mis à jour la documentation dans `20-filtres-personnages.md` (HTML, JS, CSS, dossier, swap)
- Ajouté les entrées checklist jury pour les illustrations
- Mis à jour le `styleguide.html` en miroir

### Problèmes rencontrés
- **Problème 1 : Dossier des illustrations mal situé dans le plan initial**
  - Contexte : J'avais prévu `assets/illustrations/` à la racine, mais les fichiers étaient déjà dans `frontend/public/assets/illustrations/`
  - Options envisagées : Déplacer les fichiers vs utiliser le chemin existant
  - Décision retenue : Ne rien bouger. Express sert `frontend/public/` statiquement, donc `/assets/illustrations/` fonctionne directement. C'est la bonne pratique (assets dans le dossier public du frontend).

- **Problème 2 : Format des images incompatible avec le placeholder circulaire**
  - Contexte : Les illustrations sont des PNG rectangulaires en portrait, mais le placeholder CSS était un cercle (border-radius: 50%, 100×100)
  - Options envisagées : Forcer le crop en cercle (déformation), redimensionner en 100×100 (écrasement), ou laisser l'image s'afficher dans ses proportions
  - Décision retenue : `width: 85%; height: auto; border-radius: 8px`. On garde les proportions naturelles avec des coins légèrement arrondis. L'utilisateur ajustera la taille après rendu visuel.

- **Problème 3 : Documentation existante décalée par rapport au code réel**
  - Contexte : Le fichier `20-filtres-personnages.md` montrait un HTML avec des `<div class="persona-card-icon">💼</div>` qui n'ont jamais existé (c'était un placeholder de conception, pas le code réel)
  - Décision retenue : Remplacer tout le contenu obsolète de la section 3.6 et ajouter une section 3.7 dédiée aux illustrations. La documentation est maintenant synchronisée avec le code.

### Décisions techniques prises
- Les illustrations sont stockées dans `frontend/public/assets/illustrations/` avec la convention `{persona}-{state}.png` (state = `default` ou `active`)
- Le swap se fait exclusivement en modifiant la propriété `src` de l'élément `<img>` — pas de CSS `background-image`, pas de `content` swap
- Fonction `setPersonaImage(card, persona, state)` appelée à 3 moments : activation, désactivation, bouton ×
- Taille fixée à 85% de la largeur du conteneur (modifiable par l'utilisateur)
- Les `alt` texts adoptent un ton humoristique positif ("Le maître des deadlines", "Le virtuose du repas à 2€", "La chef d'orchestre familial")

### Ce qui a été écarté et pourquoi
- **Dossier `assets/` à la racine** : Inutile, les fichiers sont déjà bien placés dans le répertoire servi statiquement
- **Crop en cercle** : Les illustrations sont en portrait, un crop circulaire les déformerait ou les couperait
- **Images en WebP** : Pas prioritaire pour l'instant (6 fichiers PNG, ~350 Ko chacun). Sera envisagé si problème de perf
- **Fichier de doc séparé pour les illustrations** : Intégré dans `20-filtres-personnages.md` car les illustrations sont une composante visuelle du mécanisme des personnages
