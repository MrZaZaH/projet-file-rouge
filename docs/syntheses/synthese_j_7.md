__Synthèse jour 7 les tests chapitre 1 __

__ – Modèles Category et User__

__Ce qu'on a fait__

- Corrigé l'import de pool partout (const \{ pool \} = require(...) au lieu de const pool = require(...))
- Corrigé Category.js : retiré la colonne fantôme description, ajouté la génération de slug dans create() et update()
- Corrigé User.js : retiré bio et avatar_url (colonnes inexistantes), conservé updated_at (présent dans le schéma)
- Corrigé test-models.js : noms uniques via Date.now() pour create et update, retiré description des appels
- Nettoyé la BDD manuellement via DBeaver (soft delete des lignes de test orphelines)
- Tous les tests passent ✅

__Problèmes rencontrés__

__Colonnes fantômes dans les modèles__

- __Contexte__ : description, bio, avatar_url présents dans le code mais absents du schéma SQL réel
- __Décision retenue__ : Retirer du code — la BDD fait foi, pas le modèle

__Import destructuré manquant__

- __Contexte__ : connection.js exporte \{ pool, testConnection \}, pas pool directement
- __Décision retenue__ : const \{ pool \} = require(...) partout, sans exception

__Nom fixe dans le test d'update__

- __Contexte__ : 'Updated Category' → crash au 2ème run (UNIQUE constraint sur le slug)
- __Décision retenue__ : Date.now() systématique sur tout nom de test

__Ligne orpheline en BDD__

- __Contexte__ : test crashé avant le soft delete → ligne bloquante au run suivant
- __Décision retenue__ : nettoyage manuel SQL \+ correction du test pour éviter la récurrence

__Décisions techniques prises__

- Soft delete = mettre deleted_at = NOW(), jamais DELETE
- Le slug est toujours généré depuis le nom (lowercase, sans accents, tirets)
- Les mots de passe ne transitent jamais en clair dans les modèles
- 'use strict' sur tous les fichiers

__Ce qui a été écarté__

- description dans categories — pas dans le schéma, pas dans le code
- bio et avatar_url dans users — idem
- Noms fixes dans les tests — remplacés par Date.now()

__Prochain chantier : Recipe.js__ — quand tu es reposé.

