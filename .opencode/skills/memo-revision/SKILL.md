---
name: memo-revision
description: Créer des fiches de révision à partir des notions bloquantes de la session. Déclenché quand l'utilisateur écrit "mémo session" ou "mémo".
license: MIT
compatibility: opencode
metadata:
  project: ovni-culinaire
  trigger: mémo session, mémo

---

## What I do

J'analyse la conversation en cours pour détecter automatiquement les notions techniques qui ont bloqué ou nécessité une explication, et je produis une fiche de révision par notion avec une explication simple, un exemple concret et les points clés à retenir.

## When to use me

Charge cette skill quand l'utilisateur écrit "mémo session" ou "mémo", pour générer du matériel de révision à partir des difficultés rencontrées durant la session.

## Format attendu

## [Notion]

### En bref

Explication simple, 4-6 phrases. Pas de jargon inutile.

### Exemple concret

Un bloc de code qui illustre réellement le concept.
Si le concept implique des relations ou des comparaisons, les montrer explicitement.

### À retenir

- Points clés sous forme de bullets
- Maximum 5 points
- Uniquement ce qui est utile pour un exam

Règles :
- Produire une fiche par notion identifiée
- Ne pas attendre que l'utilisateur liste les notions, les détecter automatiquement
- Pas de fioriture, aller droit au but
- Si deux notions sont liées, le signaler dans "À retenir"
