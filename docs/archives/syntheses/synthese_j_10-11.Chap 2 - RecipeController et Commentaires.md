# Synthèse Jour 10-11 Chap 2 — RecipeController, Commentaires et Ratings

__Synthèse – RecipeController \+ Commentaires & Ratings__

__Ce qu'on a fait__

- Créé RecipeController.js (getAllRecipes, getRecipeById, createRecipe, updateRecipe, deleteRecipe)
- Créé recipeRoutes.js avec validation express-validator
- Créé CommentController.js (getCommentsByRecipe, createComment, deleteComment)
- Créé RatingController.js (rateRecipe)
- Créé commentRoutes.js avec middleware attachUser (mode invité/connecté)
- Créé ratingRoutes.js
- Branché toutes les routes dans app.js
- Testé l'ensemble via Postman

__Problèmes rencontrés__

__Modification de recette non spécifiée dans les US__

- __Contexte__ : Aucune US ne couvre explicitement l'édition d'une recette existante.
- __Options envisagées__ :
	- Ne pas l'implémenter → auteurs bloqués en cas d'erreur, inutilisable en production.
	- L'implémenter sans restriction → n'importe qui peut modifier n'importe quelle recette, inacceptable.
	- L'implémenter avec contrôle de propriété → seul l'auteur ou un admin peut modifier.
- __Décision retenue__ : Implémentée avec contrôle de propriété strict. Un auteur ne peut modifier que ses propres recettes. Un admin peut modifier toutes les recettes. Toute modification repasse la recette en statut pending.

__Décisions techniques prises__

- __Retour en pending sur modification__ : une recette modifiée doit être revalidée par un admin — empêche les contournements de modération.
- __attachUser vs authenticate__ : middleware dédié pour les commentaires invités.
- __mergeParams: true__ : obligatoire sur les routers enfants pour accéder à :recipeId.
- __Guest = pas de suppression de commentaire__ : pas d'identité vérifiable.
- __Auto-rating interdit__ : 403 si l'auteur tente de noter sa propre recette.
- __Points uniquement sur premier rating__ : pas de points sur mise à jour pour éviter le farming.
- __Race condition rating__ : ER_DUP_ENTRY intercepté et retourné en 409.

__Ce qui a été écarté__

- Comment.findById() dans le modèle → post-MVP.
- Recalcul de average_rating sur update de rating → reporté post-MVP.

