# 📋 ____Fiches Personas & User Stories____

Projet : Plateforme de recettes collaboratives

## ____👥 Partie 1 : Personas & User Stories Primaires____

(US-01 à US-06)

### __🧑‍💼 PERSONA 1 – Le maître des deadlines (critère : RAPIDITÉ)__

"Je rentre du boulot, j'ai faim, je ne veux pas commander une pizza et je veux pas non plus passer une heure en cuisine"

#### __🔹 US-01 – Accès ultra-rapide à une recette__

__En tant que__ maître des deadlines, __Je veux__ accéder à une recette originale en moins de 2 minutes de navigation, __Afin de__ manger quelque chose de bien sans effort de recherche.

✅ __Critères d'acceptation :__

- Bouton __"Surprends-moi"__ en homepage → redirige vers une recette aléatoire sans friction
- __Temps de préparation__ affiché en gros dès la carte recette
- Persona __"Le maître des deadlines"__ filtre les recettes prêtes en moins de 15 minutes

#### __🔹 US-02 – Recettes avec une touche humaine__

__En tant que__ maître des deadlines, __Je veux__ sentir que la recette vient d'un vrai humain dans ma situation, \*\*Afin d'\*\*avoir envie de la tenter ce soir.

✅ __Critères d'acceptation :__

- Chaque recette contient un bloc __"L'histoire derrière"__ (mini-récit de 3 à 5 lignes)
- __Contexte de l'auteur__ mentionné (ex : "Posté et vécu par Karim, un dimanche pluvieux à Lyon")
- __Ton narratif et humoristique__, jamais froid ni générique

### __🧑‍🎓 PERSONA 2 – Le virtuose du repas à 2€ (critère : PETIT BUDGET)__

"5€ en poche, frigo presque vide, mais pas envie de manger triste"

#### __🔹 US-03 – Filtres budget serré__

\*\*En tant qu'\*\*virtuose du budget, __Je veux__ filtrer les recettes par budget très serré, __Afin de__ manger bien sans me ruiner.

✅ __Critères d'acceptation :__

- Persona __"Le virtuose du budget"__ filtre les recettes à moins de 5€ par portion
- __Coût estimé par portion__ affiché sur chaque carte recette (renseigné par l'auteur)

#### __🔹 US-04 – ~~Recettes minimalistes~~__

~~Supprimée — filtre ingrédients jugé non pertinent.~~

### __👩‍👧 PERSONA 3 – La chef d'orchestre familial (critère : CONFIANCE)__

"Il est 19h, les enfants ont faim, je ne veux pas commander une pizza (encore)"

#### __🔹 US-05 – Confiance via retours utilisateurs__

__En tant que__ chef d'orchestre familial, __Je veux__ savoir si la recette a été testée par d'autres personnes réelles, \*\*Afin d'\*\*avoir confiance avant de me lancer.

✅ __Critères d'acceptation :__

- Mention __"Posté et vécu par \[pseudo\]"__ visible avant les ingrédients
- __Section de retours utilisateurs__ sous forme de phrases libres (pas uniquement des étoiles)
- Les commentaires positifs __remontent naturellement__ via le système de notation

#### __🔹 US-06 – Navigation sans friction__

__En tant que__ chef d'orchestre familial, __Je veux__ trouver une recette originale en moins de 2 minutes de navigation, __Afin de__ ne pas perdre le peu d'énergie qu'il me reste.

✅ __Critères d'acceptation :__

- Bouton __"Surprends-moi"__ en homepage → recette directe sans friction
- __Temps de préparation__ affiché en gros dès la carte recette
- __Aucune publicité intrusive ni popup__ qui ralentit la navigation

## ____🔍 Partie 2 : User Stories Fonctionnelles____

(US-07 à US-10)

### __💾 Sauvegarde & Favoris__

#### __🔹 US-16 – Sauvegarder une recette pour plus tard__

__En tant que__ visiteur connecté, __Je veux__ pouvoir sauvegarder une recette en un clic et la retrouver depuis n'importe quelle page, __Afin de__ ne pas perdre une recette qui m'intéresse.

✅ __Critères d'acceptation :__

- Bouton "Sauvegarder" sur chaque page détail recette → toggle (ajouter/retirer)
- Icône cœur dans le header (visible uniquement quand connecté) → lien direct vers la liste des favoris
- Page "Mes favoris" listant toutes les recettes sauvegardées par l'utilisateur
- Les recettes supprimées ou dépubliées disparaissent automatiquement de la liste
- Compteur de favoris dans le tableau de bord

### __🎯 Navigation & Découverte__

#### __🔹 US-07 – Découverte par filtres__

__En tant que__ visiteur, __Je veux__ naviguer par filtres __sans barre de recherche__, __Afin de__ découvrir des recettes que je n'aurais pas pensé à chercher.

✅ __Critères d'acceptation :__

- Filtres disponibles via les 3 personnages :
	- __Le maître des deadlines__ : `prep_time <= 15`
	- __Le virtuose du budget__ : `cost_per_portion <= 5`
	- __La chef d'orchestre familial__ : `prep_time <= 20` + `min_rating = 4`
- __Pas de barre de recherche textuelle__
- __Filtres mutuellement exclusifs__ (un seul personnage actif à la fois)

#### __🔹 US-08 – Découverte guidée en homepage__

__En tant que__ visiteur, __Je veux__ voir en homepage :

- Les recettes __les plus appréciées du moment__
- Les __catégories les plus actives__, \*\*Afin d'\*\*entrer directement dans le vif du sujet.

✅ __Critères d'acceptation :__

- Grille de recettes avec pagination (12 par page) affichant toutes les recettes publiées
- Cartes recettes avec méta-infos (temps, coût, note, anecdote)
- __Mise à jour dynamique__ via API sans rechargement de page (filtrée ou non)

### __✍️ Contribution & Modération__

#### __🔹 US-09 – Création de compte simplifiée__

__En tant que__ futur contributeur, __Je veux__ créer un compte avec __juste un pseudo__, __Afin de__ pouvoir poster ma recette sans friction.

✅ __Critères d'acceptation :__

- Création de compte : __pseudo, email, mot de passe__ (validation : pseudo 2-50 chars, password min 8 avec majuscule + chiffre)
- __Pas de vérification d'identité__ ni de profil obligatoire à remplir
- Le compte est __actif immédiatement__ (pas d'email de confirmation)

#### __🔹 US-10 – Soumission de recettes enrichie__

__En tant que__ contributeur, __Je veux__ soumettre ma recette avec :

- Son histoire
- Le coût estimé par portion, __Afin que__ les lecteurs comprennent d'où elle vient et si elle rentre dans leur budget.

✅ __Critères d'acceptation :__

- Formulaire avec champs :
	- Titre
	- Ingrédients
	- Étapes
	- __Anecdote__ (libre, sans contrainte de style)
	- Catégorie
	- __Coût estimé par portion__
- Message de confirmation : "Votre recette est en attente de publication"

## ____🎮 Partie 3 : Gamification & Administration____

(US-11 à US-15)

### __🏆 Gamification__

#### __🔹 US-11 – Système de points motivant__

__En tant que__ contributeur, __Je veux__ voir mes points augmenter quand :

- Je poste une recette
- Ma recette plaît à la communauté, __Afin de__ me sentir reconnu pour ma contribution.

✅ __Critères d'acceptation :__

- __5 points__ attribués quand une recette reçoit une note >= 4 (premier vote uniquement)
- Points attribués dans `Rating.rate()` via `User.addPoints()` — pas sur la publication de la recette
- Tableau de bord personnel avec stats (total, publiées, en attente, rejetées, commentaires reçus, favoris)
- __Badges et niveaux__ : repoussés en V2 (tables non créées en BDD)

#### __🔹 US-12 – Avantages concrets pour les contributeurs assidus__

__En tant que__ contributeur assidu, __Je veux__ débloquer des avantages concrets quand j'atteins un certain niveau de badges, \*\*Afin d'\*\*avoir une vraie raison de revenir régulièrement.

✅ __Critères d'acceptation :__

> **Repoussé en V2.** Le système de badges et niveaux n'est pas implémenté dans le MVP.  
> Le champ `points` est conservé dans la table `users` pour éviter une migration future, mais aucune UI de badges n'expose cette information.

### __🛡️ Administration & Modération__

#### __🔹 US-13 – Commentaires sans compte__

__En tant que__ visiteur sans compte, __Je veux__ pouvoir commenter une recette avec __juste un pseudo__, __Afin de__ donner mon avis sans m'engager davantage.

✅ __Critères d'acceptation :__

- Champ commentaire accessible __sans création de compte__
- __Saisie d'un pseudo obligatoire__ avant de commenter
- Les commentaires sont visibles sous la recette sous forme de __phrases libres__

#### __🔹 US-14 – Modération discrète des recettes__

\*\*En tant qu'\*\*administratrice, __Je veux__ pouvoir retirer une recette publiée si elle ne correspond pas à l'esprit du site, __Afin de__ garder le contrôle éditorial __sans avoir à me justifier publiquement__.

✅ __Critères d'acceptation :__

- Interface d'administration avec tableau des __recettes en attente/publiées/rejetées__
- Actions : __Publier__, __Rejeter__ (avec motif optionnel), __Supprimer__ (avec motif obligatoire)
- Notifications utilisateur créées automatiquement pour les rejets et suppressions
- Export CSV des recettes publiées via `GET /api/v1/admin/export/recipes`

#### __🔹 US-15 – Tableau de bord analytique__

\*\*En tant qu'\*\*administratrice, __Je veux__ suivre :

- Les recettes les plus consultées
- Les mieux notées
- Les catégories les plus actives, __Afin de__ piloter le site et d'orienter les futurs partenariats.

✅ __Critères d'acceptation :__

- Dashboard admin avec statistiques globales (total recettes, en attente, publiées, utilisateurs, note moyenne)
- Top __5 recettes les plus vues__
- Top __5 recettes les mieux notées__ (minimum 3 notes)
- __Top catégories__ les plus actives
- Tableau des __logs d'administration__ (50 dernières actions, filtrable)
- __Export CSV__ des recettes publiées

