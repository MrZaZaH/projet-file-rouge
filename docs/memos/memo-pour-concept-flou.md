__MariaDB vs MongoDB__

__En bref__

Ce sont deux types de bases de données différents. MariaDB stocke les données dans des tableaux avec des colonnes fixes (relationnel). MongoDB stocke des documents flexibles sans structure imposée car évolutif et/ou différents formes et tailles et généralement en .json (NoSQL).

__Exemple concret__

-- MariaDB : structure rigide, mais relations possibles

CREATE TABLE utilisateurs (

    id  INT PRIMARY KEY AUTO_INCREMENT,

    nom VARCHAR(100) NOT NULL

);

CREATE TABLE recettes (

    id             INT PRIMARY KEY AUTO_INCREMENT,

    titre          VARCHAR(100) NOT NULL,

    utilisateur_id INT,

    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id)

);

-- chaque recette est liée à un utilisateur précis

-- MariaDB empêche d'avoir une recette sans auteur valide

Elle empêche également la suppression des données liés pour pas faire des orphelins 

// MongoDB : flexible, pas de liaison native

\{ "titre": "Pasta", "auteur": "Jean" \}

\{ "titre": "Pizza" \} // auteur absent, MongoDB s'en fout

__À retenir__

- MariaDB = tableaux \+ relations entre tables = cohérence garantie
- MongoDB = documents flexibles = liberté mais moins de contrôle
- FOREIGN KEY est ce qui crée la liaison entre deux tables dans MariaDB
- MongoDB est utile quand la structure des données change souvent
- Pour un exam : MariaDB = relationnel donc SQL, MongoDB = NoSQL

memo jour 19 début frontend
Fiche 1 – Modèle de contenu HTML (flow vs phrasing content)
En bref
HTML définit des catégories de contenu. Chaque élément n'accepte que certaines catégories comme enfants. <button> n'accepte que du phrasing content (texte, <span>, <strong>, <svg>…). <div>, <p>, <h3> sont du flow content — ils sont interdits à l'intérieur d'un <button>. Si tu mets du flow content dans un bouton, le navigateur reparsera le DOM de manière imprévisible selon le moteur. Le W3C validator détecte ça comme une erreur bloquante.
Exemple concret
<!-- ❌ INVALIDE – div, h3, p sont du flow content -->
<button type="button">
    <div class="image"></div>
    <h3>Titre</h3>
    <p>Description</p>
</button>

<!-- ✅ VALIDE – span est du phrasing content -->
<button type="button">
    <span class="image"></span>
    <span class="title">Titre</span>
    <span class="desc">Description</span>
</button>

<!-- ✅ VALIDE – article avec role=button si on a besoin de sémantique riche -->
<article role="button" tabindex="0" aria-pressed="false">
    <div class="image"></div>
    <h3>Titre</h3>
    <p>Description</p>
</article>
À retenir

<button> = phrasing content uniquement. Pas de <div>, <p>, <h3> dedans
Si tu as besoin d'un bouton avec structure complexe → <article> ou <div> + role="button" + tabindex="0"
Le navigateur ne plante pas, mais il reparsera le DOM différemment selon Chrome/Firefox/Safari → bugs JS difficiles à tracer
Lié à la fiche ARIA ci-dessous : dès qu'on utilise un non-<button> cliquable, ARIA devient obligatoire


Fiche 2 – ARIA roles et accessibilité clavier
En bref
ARIA (Accessible Rich Internet Applications) permet d'ajouter de la sémantique là où le HTML natif ne suffit pas. Si un élément non-interactif (<div>, <article>) doit se comporter comme un bouton, il faut trois attributs : role="button" pour que les lecteurs d'écran l'annoncent correctement, tabindex="0" pour qu'il soit atteignable au clavier, et une gestion JS de keydown Enter/Space parce que ces touches ne déclenchent pas automatiquement le click sur un non-<button>. Sans ces trois, l'élément est inutilisable sans souris.
Exemple concret
<!-- L'élément HTML -->
<article 
    class="persona-card"
    role="button"
    tabindex="0"
    aria-pressed="false"
    data-persona="maitre-deadlines">
    <div role="img" aria-label="Icône Le maître des deadlines"></div>
    <h3>Le maître des deadlines</h3>
    <p>Recettes prêtes en 15 minutes</p>
</article>

<!-- Le JS obligatoire pour la navigation clavier -->
card.addEventListener('keydown', (e) => {
    // Enter et Space doivent déclencher le click
    // sur un non-<button>, ce n'est pas automatique
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); // évite le scroll sur Space
        card.click();
    }
});

// Mettre à jour aria-pressed quand l'état change
card.setAttribute('aria-pressed', 'true');  // filtre actif
card.setAttribute('aria-pressed', 'false'); // filtre inactif
À retenir

role="button" → annonce l'élément comme bouton aux lecteurs d'écran
tabindex="0" → rend l'élément focusable dans l'ordre naturel du DOM
keydown Enter/Space → obligatoire sur tout non-<button> cliquable, non automatique
aria-pressed → communique l'état toggle (actif/inactif) aux lecteurs d'écran
Lié à la fiche précédente : on n'utilise role="button" que parce qu'on ne peut pas utiliser <button> nativement ici


Fiche 3 – Erreurs W3C vs Warnings : quelle différence ?
En bref
Le W3C validator distingue deux niveaux. Les erreurs sont des violations du spec HTML — le DOM peut être reparser différemment selon le navigateur, et le JS qui s'appuie dessus peut se comporter de manière inattendue. Les warnings sont des redondances ou des pratiques dépassées — le comportement est identique avec ou sans, rien ne casse. La règle pratique : corriger les erreurs dès qu'elles apparaissent parce qu'elles ont des effets réels. Grouper les warnings et les corriger en fin de projet quand le HTML est stabilisé.
Exemple concret
<!-- ERROR : div interdit dans button → corriger immédiatement -->
<button><div>...</div></button>

<!-- ERROR : h3 interdit dans button → corriger immédiatement -->
<button><h3>Titre</h3></button>

<!-- WARNING : role="banner" redondant sur <header> → ignorer jusqu'au Jour 30 -->
<!-- <header> est déjà implicitement role="banner" -->
<header role="banner">...</header>  <!-- redondant mais inoffensif -->
<header>...</header>                <!-- strictement identique -->

<!-- WARNING : aria-required redondant avec required → ignorer jusqu'au Jour 30 -->
<input required aria-required="true">  <!-- redondant -->
<input required>                        <!-- identique en comportement -->
À retenir

Erreur = violation spec → comportement navigateur imprévisible → corriger immédiatement
Warning = redondance → comportement identique → corriger en fin de projet
role="banner" sur <header> est inutile : <header> porte ce rôle implicitement
role="contentinfo" sur <footer> idem
aria-required="true" + required = doublon : required suffit en HTML5