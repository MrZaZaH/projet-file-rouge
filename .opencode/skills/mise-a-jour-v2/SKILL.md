---
name: mise-a-jour-v2
description: Mettre à jour la documentation technique (docs/mecanismes-v2/) après des changements dans le code ou la BDD. Déclenché par "mise à jour v2" suivi d'une description des changements.
license: MIT
compatibility: opencode
metadata:
  project: ovni-culinaire
  trigger: mise à jour v2
---

## What I do

J'identifie les fichiers `docs/mecanismes-v2/*.md` impactés par des changements décrits par l'utilisateur, je repère les sections obsolètes (anciens noms, comportements, chemins, extraits de code), et j'applique les corrections sans modifier la structure du fichier.

## When to use me

Charge cette skill quand l'utilisateur écrit "mise à jour v2" suivi d'une description des changements apportés au code, à la BDD ou à l'API.

## Comportement

1. **Identifier les fichiers impactés** : en fonction de la description des changements, déterminer quels fichiers `docs/mecanismes-v2/*.md` contiennent des informations devenues obsolètes.
2. **Lire chaque fichier identifié** : repérer les sections à corriger (anciens noms, anciens comportements, chemins, extraits de code obsolètes, examples de requêtes/réponses).
3. **Appliquer les corrections** : modifier le contenu obsolète sans changer la structure du fichier (en-têtes, ordre des sections, format Markdown).
4. **Signaler section 8 (Checklist jury)** : indiquer si la section "Checklist pour le jury" doit être mise à jour.
5. **Ne pas ajouter/supprimer de fichiers** : interdiction de créer ou supprimer des fichiers sans confirmation explicite de l'utilisateur.
6. **Relire après modification** : relire le fichier modifié pour confirmer la cohérence globale.

## Règles

- Ne jamais modifier la structure du fichier (titres, ordre des sections, format)
- Ne jamais créer ou supprimer un fichier sans confirmation explicite
- Après chaque modification, relire le fichier pour vérifier la cohérence
- Signaler systématiquement si la section 8 (Checklist jury) est impactée
