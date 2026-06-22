---
name: synthese-session
description: Générer une synthèse structurée de session de travail. Déclenché quand l'utilisateur écrit "fais la synthèse" ou "synthèse".
license: MIT
compatibility: opencode
metadata:
  project: ovni-culinaire
  trigger: fais la synthèse, synthèse

---

1. Crée un nouveau fichier dans docs/syntheses/synthese_titre-de-la-synthese.md
2. Produis un résumé structuré de toute la session / discussion et mets cette synthèse dans le fichier créé. Utilise le format attendu ci-dessous.

## Format attendu

```md
## Synthèse – [Nom de l'étape]
### Ce qu'on a fait
- Liste courte et concrète des actions réalisées.

### Problèmes rencontrés
- Problème 1 : description courte
  - Contexte : d'où il vient, comment il a été découvert
  - Options envisagées : ce qu'on aurait pu faire (avec avantages/inconvénients)
  - Décision retenue : ce qu'on a choisi et pourquoi
- Problème 2 : description courte
  - etc.

### Décisions techniques prises
- Liste des choix techniques actés, non négociables pour la suite du projet.

### Ce qui a été écarté et pourquoi
- Ce qu'on a explicitement décidé de ne pas faire, avec la raison.
```

L'objectif est que l'utilisateur ait un historique pertinent de l'avancée de son travail et qu'un développeur qui reprend le projet à froid comprenne exactement ce qui a été fait et pourquoi.
