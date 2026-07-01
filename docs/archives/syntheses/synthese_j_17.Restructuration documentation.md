# Synthèse Jour 17

**Ce qu'on a fait**

- Restructuration complète de la documentation : migration des anciens `docs/` vers `specs/` comme source de vérité
- Création de `specs/architecture.md` comme document d'architecture central
- Création de `AGENTS.md` avec les conventions de projet pour opencode
- Création du dossier `.opencode/` avec les skills (ovni-culinaire, memo-revision, synthese-session)
- Réorganisation de `docs/` en sous-dossiers : `memos/`, `prompts/`, `recettes/`, `syntheses/`
- Ajout de la dépendance mammoth pour l'import DOCX de recettes
- Mise à jour de la structure des dossiers (déplacement de fichiers : `docs/Api.md` → `specs/technique/api.md`, `docs/TEST_CASES.md` → `docs/qualite/test-cases.md`, etc.)
- Audit de sécurité : Helmet actif, CORS configuré, rate limiting (express-rate-limit) dédoublé (global 100 req/15min, auth 10 req/15min)
- Winston logging actif avec logger centralisé et httpLogger
- Toutes les entrées validées via express-validator

**Problèmes rencontrés**

- Fichiers backup suffixés avec des chiffres (`AdminController1.js`, `Recipe1.js`, etc.) — laissés en l'état pour ne pas casser le repo
- Certains fichiers utilisaient encore `db.promise().query()` au lieu de `pool.query()` directement — corrigé dans les sessions ultérieures (Jour 13)

**Décisions techniques**

- `specs/` devient la source de vérité unique — toute nouvelle fonctionnalité doit y être documentée avant implémentation
- Rate limiting dédoublé : 100 req/15min global, 10 req/15min sur les routes auth
- JWT avec expiration 24h, payload minimal (id, role, username)
- Les fichiers de documentation sont architecturés par domaine : `specs/technique/`, `specs/gestion-projet/`, `docs/qualite/`
- `AGENTS.md` sert de référentiel unique des conventions de code pour l'assistant IA
- Les prompts et commandes IA sont versionnés dans `docs/prompts/`

**Livrables**

- `AGENTS.md` — conventions de projet
- `specs/architecture.md` — architecture de référence
- `specs/technique/api.md` — documentation API déplacée
- `specs/technique/database-design.md` — design BDD déplacé
- `specs/gestion-projet/planning-travail-detaille.md` — planning déplacé
- `docs/memos/`, `docs/prompts/`, `docs/recettes/`, `docs/syntheses/` — nouveaux dossiers
- `.opencode/skills/` — 3 skills IA configurés
