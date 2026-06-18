---
name: synthese-session
description: Générer une synthèse structurée de session de travail. Déclenché quand l'utilisateur écrit "fais la synthèse" ou "synthèse".
license: MIT
compatibility: opencode
metadata:
  project: ovni-culinaire
  trigger: fais la synthèse, synthèse

---

## What I do

Je produis un résumé structuré de la session ou de l'étape en cours, couvrant les actions réalisées, les problèmes rencontrés, les décisions techniques prises et ce qui a été écarté. Utile pour garder une trace historique du projet.

## When to use me

Charge cette skill quand l'utilisateur écrit explicitement "fais la synthèse" ou "synthèse" dans la conversation, pour formaliser l'avancement de la session en cours.

## Format attendu

## Synthèse – [Nom de l'étape]

### Ce qu'on a fait

Liste courte et concrète des actions réalisées.

### Problèmes rencontrés

Pour chaque problème :
- Contexte : d'où il vient, comment il a été découvert
- Options envisagées : ce qu'on aurait pu faire (avec avantages/inconvénients)
- Décision retenue : ce qu'on a choisi et pourquoi

### Décisions techniques prises

Liste des choix techniques actés, non négociables pour la suite du projet.

### Ce qui a été écarté et pourquoi

Ce qu'on a explicitement décidé de ne pas faire, avec la raison.

L'objectif est que l'utilisateur ait un historique pertinent de l'avancée de son travail et qu'un développeur qui reprend le projet à froid comprenne exactement ce qui a été fait et pourquoi.
