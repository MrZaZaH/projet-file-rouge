---
name: explication-notation
description: Générer une fiche d'explication détaillée sur le mécanisme de notation et commentaires. Déclenché quand l'utilisateur écrit "explique la notation", "notation" ou "mécanisme notation".
license: MIT
compatibility: opencode
metadata:
  project: ovni-culinaire
  trigger: explication notation, explication notation et commentaires, mécanisme notation

---

1. Consulte le fichier `docs/notations-et-commentaires.md`
2. Adapte l'explication au niveau demandé :
   - **"jury"** : focus architecture, indépendance des entités, choix de dénormalisation, sécurité (3 niveaux anti-doublon), justifications techniques
   - **"révision"** : focus lignes de code, flux complet, fichiers concernés, formules
   - **"simple"** : focus conceptuel, analogies, schéma texte
3. Si l'utilisateur demande une mise à jour (ex: "rajoute le truc des invités"), mets à jour le fichier `docs/notations-et-commentaires.md` puis réponds avec la section modifiée
4. Réponds toujours avec les références aux fichiers et numéros de ligne du projet
