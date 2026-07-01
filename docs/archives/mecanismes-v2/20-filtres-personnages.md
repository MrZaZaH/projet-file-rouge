# #20 — Filtres par Personnages (Persona)

## 1. CE QUE ÇA FAIT (vue d'ensemble)

La page d'accueil propose 3 filtres sous forme de cartes personnages (personas) : "Salarié crevé", "Étudiant fauché", "Parent épuisé". Chaque personnage correspond à un jeu de filtres prédéfini qui reflète ses contraintes de vie. C'est l'UNIQUE système de filtre de la homepage — pas de sliders, de dropdowns, de champs de recherche avancée. Cliquer sur un personnage : (1) le met en surbrillance, (2) construit l'URL avec les bons paramètres de filtre via URLSearchParams, (3) appelle l'API avec ces paramètres, (4) réaffiche les recettes. Re-cliquer = désactive le filtre. Les 3 personnages sont les seuls filtres documentés par les specs.

## 2. SCHÉMA DE LA TABLE

```sql
-- Pas de table pour les personas — ce sont des constantes JavaScript.
-- Les filtres sont appliqués via les colonnes prep_time, cost_per_portion,
-- et average_rating de la table recipes (03_create_tables.sql:54)

CREATE TABLE IF NOT EXISTS recipes (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title               VARCHAR(255) NOT NULL,
    prep_time           SMALLINT UNSIGNED NOT NULL,
    -- Filtré par Salarié crevé (max 15 min) et Parent épuisé (max 20 min)
    cost_per_portion    DECIMAL(5,2) UNSIGNED NOT NULL,
    -- Filtré par Étudiant fauché (max 5€)
    average_rating      DECIMAL(3,2) UNSIGNED NOT NULL DEFAULT 0.00,
    -- Filtré par Parent épuisé (min 4 étoiles)
    status              ENUM('pending', 'published', 'rejected') NOT NULL DEFAULT 'pending',
    deleted_at          DATETIME NULL DEFAULT NULL
    -- Tous les filtres incluent WHERE deleted_at IS NULL
);

-- Constantes de filtrage dans src/constants/filters.js:24
-- QUICK_PREP_MAX: 15   → Salarié crevé : ≤ 15 min
-- BUDGET_MID_MAX: 5    → Étudiant fauché : ≤ 5€
-- QUICK_PREP_MAX + min_rating: 4 → Parent épuisé : ≤ 20 min, ≥ 4★
```

## 3. LE CODE

### 3.1 — Mapping Persona → Filtres (frontend/public/js/home.js:18)

```javascript
// Chaque personnage est une fonction qui retourne un objet de filtres
// Ces filtres sont directement utilisables par l'API /api/v1/recipes

function getPersonaFilter(persona) {
    switch (persona) {
        case 'salarie-creve':
            return { max_prep_time: 15 };
            // "Je veux manger rapidement → max 15 minutes de préparation"
            // Cette constante (15) est définie dans filters.js: QUICK_PREP_MAX

        case 'etudiant-fauche':
            return { max_cost: 5 };
            // "J'ai un petit budget → max 5€ par portion"
            // Cette constante (5) est définie dans filters.js: BUDGET_MID_MAX

        case 'parent-epuise':
            return { max_prep_time: 20, min_rating: 4 };
            // "Je veux du bon et pas trop long → max 20 min, min 4 étoiles"
            // 20 n'est pas une constante (c'est un cas spécifique)

        default:
            return null; // Aucun filtre → toutes les recettes
    }
}
```

### 3.1b — Swap d'image actif/défaut : setPersonaImage() (home.js:119)

```javascript
// Bascule l'illustration du personnage entre version "défaut" et "active"
// card : l'élément .persona-card
// persona : "salarie-creve", "etudiant-fauche" ou "parent-epuise"
// state : "default" ou "active"

function setPersonaImage(card, persona, state) {
    var img = card.querySelector('.persona-card-image');
    if (img) {
        img.src = '/assets/illustrations/' + persona + '-' + state + '.png';
    }
}
```

La convention de nommage est `{persona}-{state}.png`, stockée dans `frontend/public/assets/illustrations/`. Le dossier est servi statiquement par Express, accessible via `/assets/illustrations/`.

### 3.2 — Construction de l'URL avec URLSearchParams (home.js:145)

```javascript
// Dans l'event listener du clic sur une carte personnage

const filter = getPersonaFilter(persona);
// filter = { max_prep_time: 15 } par exemple

const params = new URLSearchParams(filter);
// URLSearchParams transforme un objet en query string
// { max_prep_time: 15 } → "max_prep_time=15"
// { max_prep_time: 20, min_rating: 4 } → "max_prep_time=20&min_rating=4"

const url = filter
    ? '/api/v1/recipes?' + params.toString()
    : '/api/v1/recipes';
// Si filtre actif : "/api/v1/recipes?max_prep_time=15"
// Si pas de filtre : "/api/v1/recipes"

const recipes = await fetchRecipes(url);
// fetchRecipes() fait un GET à cette URL
// Le serveur reçoit les paramètres et les passe à findAllWithFilters()
```

### 3.3 — Gestion de l'état "actif" avec swap d'illustration (home.js:129)

```javascript
// Chaque carte personnage a :
// - data-persona="salarie-creve" (identifiant)
// - classe CSS "persona-card" (style initial)
// - aria-pressed="false" (accessibilité)

personaCards.forEach(function(card) {
    card.addEventListener('click', async function() {
        const persona = card.dataset.persona;
        // dataset.persona = "salarie-creve", "etudiant-fauche" ou "parent-epuise"

        // Si on reclique sur le même personnage → désactivation
        if (currentPersona === persona && card.classList.contains('persona-card--active')) {
            card.classList.remove('persona-card--active');
            card.setAttribute('aria-pressed', 'false');
            setPersonaImage(card, persona, 'default'); // ← illustration retour en version défaut
            currentPersona = null;
            // On recharge TOUTES les recettes (sans filtre)
            const recipes = await fetchRecipes('/api/v1/recipes');
            renderRecipes(recipes);
            updateActiveFilter(null);
            return;
        }

        // Sinon : désactiver tous les autres, activer celui-ci
        personaCards.forEach(function(c) {
            c.classList.remove('persona-card--active');
            c.setAttribute('aria-pressed', 'false');
            setPersonaImage(c, c.dataset.persona, 'default'); // ← tous en version défaut
        });
        card.classList.add('persona-card--active');
        card.setAttribute('aria-pressed', 'true');
        setPersonaImage(card, persona, 'active'); // ← illustration en version active

        // Nouveau filtre → appel API avec paramètres
        const filter = getPersonaFilter(persona);
        const params = new URLSearchParams(filter);
        const url = filter ? '/api/v1/recipes?' + params.toString() : '/api/v1/recipes';
        const recipes = await fetchRecipes(url);

        if (recipes) {
            currentPersona = persona;
            renderRecipes(recipes);
            updateActiveFilter(persona);
            // Affiche le tag "Salarié crevé — ≤ 15 min" au-dessus des résultats
        } else {
            // Erreur : on affiche le message d'erreur
            toggleDisplay(recipesError, true);
        }
    });
});
```

### 3.4 — Affichage du tag de filtre actif (home.js:84)

```javascript
function updateActiveFilter(persona) {
    const container = document.getElementById('active-filters');
    const tags = document.getElementById('filter-tags');

    if (!persona) {
        // Aucun filtre actif → cache le tag
        container.style.display = 'none';
        tags.innerHTML = '';
        return;
    }

    const labels = {
        'salarie-creve': 'Salarié crevé — ≤ 15 min',
        'etudiant-fauche': 'Étudiant fauché — ≤ 5 €',
        'parent-epuise': 'Parent épuisé — ≤ 20 min, ≥ 4★'
    };

    // Affiche le tag avec la croix de suppression
    container.style.display = 'flex';
    tags.innerHTML = `
        <span class="filter-tag">
            ${labels[persona]}
            <button type="button" id="remove-filter" aria-label="Retirer le filtre">×</button>
        </span>
    `;

    // Bouton × → désactive le filtre
    document.getElementById('remove-filter').addEventListener('click', async function() {
        personaCards.forEach(function(c) {
            c.classList.remove('persona-card--active');
            c.setAttribute('aria-pressed', 'false');
            setPersonaImage(c, c.dataset.persona, 'default'); // ← retour à la version défaut
        });
        currentPersona = null;
        const recipes = await fetchRecipes('/api/v1/recipes');
        renderRecipes(recipes);
        updateActiveFilter(null);
    });
}
```

### 3.5 — Accessibilité clavier (home.js:160)

```javascript
// Chaque carte personnage peut être activée au clavier
card.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') {
        // Enter ou Espace → même comportement qu'un clic
        e.preventDefault(); // Empêche le scroll par défaut (Espace)
        card.click();
    }
});
```

### 3.6 — HTML des personnages avec illustrations (index.html:74)

```html
<article class="persona-card" data-persona="salarie-creve" role="button" tabindex="0"
    aria-pressed="false" aria-label="Filtrer pour Salarié Crevé – Temps ≤ 15 min">
    <img class="persona-card-image" src="/assets/illustrations/salarie-creve-default.png"
         alt="Le maître des deadlines">
    <h3>Salarié Crevé</h3>
    <p>Recettes prêtes en 15 minutes chrono</p>
</article>

<article class="persona-card" data-persona="etudiant-fauche" role="button" tabindex="0"
    aria-pressed="false" aria-label="Filtrer pour Étudiant Fauché – Budget ≤ 5€">
    <img class="persona-card-image" src="/assets/illustrations/etudiant-fauche-default.png"
         alt="Le virtuose du repas à 2€">
    <h3>Étudiant Fauché</h3>
    <p>Manger bon sans ruiner son compte</p>
</article>

<article class="persona-card" data-persona="parent-epuise" role="button" tabindex="0"
    aria-pressed="false" aria-label="Filtrer pour Parent Épuisé – Rapide et bien noté">
    <img class="persona-card-image" src="/assets/illustrations/parent-epuise-default.png"
         alt="La chef d'orchestre familial">
    <h3>Parent Épuisé</h3>
    <p>Repas express notés par d'autres parents</p>
</article>
```

### 3.7 — Illustrations : dossier, CSS et swap visuel

#### Dossier de stockage

```
frontend/public/assets/illustrations/
├── salarie-creve-default.png     ← 344 Ko, affiché par défaut
├── salarie-creve-active.png      ← 327 Ko, affiché quand le filtre est actif
├── etudiant-fauche-default.png   ← 419 Ko
├── etudiant-fauche-active.png    ← 419 Ko
├── parent-epuise-default.png     ← 364 Ko
└── parent-epuise-active.png      ← 364 Ko
```

Le dossier `frontend/public/` est servi statiquement par Express (`app.js`), donc les images sont accessibles via l'URL `/assets/illustrations/{persona}-{state}.png`.

#### CSS — de la pastille au rectangle illustré (styles.css:331)

```css
.persona-card-image {
    display: block;
    width: 85%;
    height: auto;
    border-radius: 8px;
    margin: 0 auto 1rem;
}
```

| Propriété | Rôle |
|---|---|
| `display: block; margin: 0 auto` | Centre l'image horizontalement dans la carte |
| `width: 85%` | L'image prend 85% de la largeur de son conteneur (la carte avec son padding) |
| `height: auto` | Maintient le ratio hauteur/largeur naturel de l'image |
| `border-radius: 8px` | Coins légèrement arrondis pour un rendu plus doux |

Avant l'implémentation, le placeholder était un cercle gris (`border-radius: 50%; width: 100px; height: 100px; background: var(--bg)`). Les illustrations en format portrait (rectangulaires debout) ont imposé le passage en `width: 85%; height: auto` pour respecter leurs proportions.

#### Alt texts — un parti pris éditorial

Les attributs `alt` des illustrations ne décrivent pas le contenu visuel (un dessin) mais l'esprit du personnage :

| Personnage | Texte alternatif |
|---|---|
| Salarié Crevé | `"Le maître des deadlines"` |
| Étudiant Fauché | `"Le virtuose du repas à 2€"` |
| Parent Épuisé | `"La chef d'orchestre familial"` |

Ce choix éditorial remplace des `alt` techniques (comme `"Icône Salarié Crevé"`) par des textes à l'humour positif, aligné avec la tonalité du projet.

#### Swap d'image : le mécanisme

Appelée à 3 moments différents dans `home.js` :

1. **Désactivation** (re-clic ou clic sur un autre personnage) → `setPersonaImage(card, persona, 'default')`
2. **Activation** (clic sur un personnage inactif) → `setPersonaImage(card, persona, 'active')`
3. **Bouton "×"** du tag de filtre actif → `setPersonaImage(card, persona, 'default')` sur toutes les cartes

Pas de `background-image` CSS, pas de `content` — le swap se fait uniquement en modifiant la propriété `src` de l'élément `<img>`. C'est volontairement simple, facile à déboguer (l'inspecteur réseau montre le changement de fichier) et accessible (l'attribut `alt` reste inchangé).

#### Performance

6 fichiers PNG, chacun entre 320 et 420 Ko. Pas de lazy loading (les 3 images sont dans le viewport initial). Si le poids devient un problème, on pourra :
- Convertir en WebP (meilleure compression sans perte visible)
- Redimensionner les PNG à 2× leur taille d'affichage max plutôt que de garder des fichiers à pleine résolution

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

```
Utilisateur arrive sur la page d'accueil :

1. home.js init() → fetchRecipes() → GET /api/v1/recipes
   → Aucun filtre → affiche les 50 recettes les plus récentes

Utilisateur clique sur "Salarié crevé" :

2. card.dataset.persona = "salarie-creve"
3. getPersonaFilter("salarie-creve") → { max_prep_time: 15 }
4. URLSearchParams({ max_prep_time: 15 }) → "max_prep_time=15"
5. fetchRecipes("/api/v1/recipes?max_prep_time=15")
6. Serveur reçoit req.query.max_prep_time = "15"
7. findAllWithFilters({ max_prep_time: 15 }) exécute :
   SELECT r.* FROM recipes r
   WHERE r.deleted_at IS NULL AND r.prep_time <= 15
   ORDER BY r.prep_time ASC
   LIMIT 50 OFFSET 0
8. Frontend reçoit les recettes rapides, les affiche
9. Tag "Salarié crevé — ≤ 15 min" apparaît au-dessus des résultats

Utilisateur reclique sur "Salarié crevé" :

10. currentPersona === "salarie-creve" ET classe 'persona-card--active'
    → Désactivation : on recharge /api/v1/recipes sans filtre
    → Tag disparaît

Utilisateur clique sur "Parent épuisé" :

11. getPersonaFilter("parent-epuise") → { max_prep_time: 20, min_rating: 4 }
12. URL → "/api/v1/recipes?max_prep_time=20&min_rating=4"
13. findAllWithFilters({ max_prep_time: 20, min_rating: 4 }) exécute :
    SELECT r.* FROM recipes r
    WHERE r.deleted_at IS NULL
      AND r.prep_time <= 20
      AND r.average_rating >= 4
    ORDER BY r.average_rating DESC
    LIMIT 50 OFFSET 0
    → Tri par note (min_rating présent) PAS par temps
```

## 5. ANALOGIE

Tu as trois amis qui veulent manger chez toi :

**Salarié crevé** (💼) : "J'ai fini le boulot à 20h, j'ai la dalle, donne-moi n'importe quoi mais en moins de 15 minutes montre en main." → Tu filtres par temps de préparation ≤ 15 min.

**Étudiant fauché** (🎓) : "Mon budget courses c'est 20€ pour la semaine, je peux pas mettre 10€ par repas." → Tu filtres par coût ≤ 5€ par portion.

**Parent épuisé** (👨‍👩‍👧‍👦) : "Les gosses crient, j'ai pas fait les courses, et faut que ce soit bon sinon ils râlent." → Tu filtres par temps ≤ 20 min ET note ≥ 4★.

C'est comme si tu avais trois "profils" de recherche sur ton appli de livraison de repas : les filtres sont pré-choisis pour toi, tu cliques et tu obtiens ce qui correspond à TA situation. ZERO réglage manuel.

## 6. PIÈGES CLASSIQUES

### Piège #1 : Ajouter d'autres contrôles de filtre (sliders, dropdowns)

Les specs sont claires : les 3 personnages sont les **seuls filtres** de la homepage. Ajouter un curseur de prix ou un menu déroulant de catégorie contredit les specs.

**MAUVAIS :**
```html
<select id="category-filter">
    <option>Toutes les catégories</option>
</select>
<input type="range" min="0" max="60" id="time-filter">
```

**BON :** Rien. Juste les 3 cartes personnage. C'est un choix de design délibéré : simple, narratif, pas technique.

### Piège #2 : Ne pas désactiver le filtre au re-clic

Si l'utilisateur reclique sur le même personnage, il s'attend à voir "tout" réapparaître. Si rien ne se passe, il est perdu.

**MAUVAIS :**
```javascript
card.addEventListener('click', function() {
    // On applique le filtre sans vérifier l'état actuel
    applyFilter(persona);
});
```

**BON :**
```javascript
if (currentPersona === persona && card.classList.contains('persona-card--active')) {
    // Toggle OFF
    currentPersona = null;
    fetchRecipes('/api/v1/recipes'); // Reset
} else {
    // Toggle ON
    applyFilter(persona);
}
```

### Piège #3 : Oublier la désactivation visuelle des autres cartes

Quand on clique sur "Étudiant fauché", "Salarié crevé" ne doit plus être en surbrillance. Si on ne désactive pas les autres, l'utilisateur croit que deux filtres sont actifs en même temps.

**MAUVAIS :**
```javascript
card.classList.add('persona-card--active');
// Les autres cartes gardent leur état précédent
```

**BON :**
```javascript
personaCards.forEach(function(c) {
    c.classList.remove('persona-card--active'); // Nettoie tout
    c.setAttribute('aria-pressed', 'false');
});
card.classList.add('persona-card--active'); // Active seulement celui-ci
```

### Piège #4 : Utiliser fetchRecipes sans gérer l'erreur réseau

Si l'API est injoignable (serveur down, pas de connexion), l'utilisateur reste sur "Chargement..." indéfini.

**MAUVAIS :**
```javascript
const recipes = await fetchRecipes(url);
renderRecipes(recipes);
```

**BON :**
```javascript
const recipes = await fetchRecipes(url);
if (recipes) {
    renderRecipes(recipes);
} else {
    toggleDisplay(recipesLoading, false);
    toggleDisplay(recipesError, true);
}
```

## 7. ET SI ON FAISAIT AUTREMENT ?

### Option A : Combinaison de personnages (filtres multiples)

- Comment ça marche : Possibilité d'activer "Salarié crevé" ET "Étudiant fauché" en même temps → `max_prep_time=15&max_cost=5`
- Avantage : Plus flexible pour les utilisateurs qui sont dans plusieurs situations à la fois
- Inconvénient : Plus complexe (gestion d'état, intersection de filtres, UI des badges multiples). Et si on active "Parent épuisé" + "Étudiant fauché" ? Ça fait beaucoup de conditions.
- Notre cas : Un seul personnage à la fois. C'est plus simple, plus narratif, et ça évite les combinaisons absurdes (on ne peut pas être fauché ET salarié senior en même temps dans l'esprit du concept).

### Option B : Stockage des préférences dans localStorage

- Comment ça marche : Quand un utilisateur choisit "Étudiant fauché", on sauvegarde dans localStorage. À la prochaine visite, le filtre est automatiquement appliqué.
- Avantage : Expérience personnalisée, l'utilisateur retrouve son contexte
- Inconvénient : Un étudiant qui devient salarié (ou vice versa) doit penser à changer manuellement. Le "Surprends-moi" random devient moins aléatoire si un filtre persiste.
- Notre cas : Pas de localStorage. Chaque visite commence sans filtre. Le personnage est un état temporaire, pas un profil utilisateur.

### Option C : Algorithmes de recommandation (ML)

- Comment ça marche : Analyser l'historique de navigation, les favoris, les clics pour proposer des recettes personnalisées
- Avantage : Ultra-personnalisé, "Netflix des recettes"
- Inconvénient : Complètement hors-cadre (titre pro niveau Bac+2). Infrastructure serveur complexe (Python/TensorFlow ou équivalent). Vie privée (RGPD). Maintenance impossible.
- Notre cas : 3 personnages = 3 ensembles de règles métier simples. Pas de machine learning, pas de profilage. Juste des if/else et des WHERE clauses.

## 8. CHECKLIST POUR LE JURY

- [ ] Les 3 personnages sont les SEULS filtres de la homepage (pas de sliders/dropdowns supplémentaires)
- [ ] Salarié crevé → `max_prep_time=15` (≤ 15 min)
- [ ] Étudiant fauché → `max_cost=5` (≤ 5€)
- [ ] Parent épuisé → `max_prep_time=20&min_rating=4` (≤ 20 min, ≥ 4★)
- [ ] Cliquer sur un personnage l'active et désactive les autres
- [ ] Re-cliquer sur le même personnage désactive le filtre
- [ ] Un tag visuel indique quel filtre est actif avec une croix pour le retirer
- [ ] `aria-pressed` est mis à jour pour l'accessibilité
- [ ] Les cartes sont navigables au clavier (Enter/Espace)
- [ ] `URLSearchParams` est utilisé pour construire la query string
- [ ] Le filtre "Parent épuisé" trie par note (pas par temps) — logique conditionnelle
- [ ] Le "Surprends-moi" appelle `GET /api/v1/recipes/random` sans aucun paramètre
- [ ] Chaque personnage a une illustration dans `frontend/public/assets/illustrations/`
- [ ] Deux versions par illustration : `{persona}-default.png` et `{persona}-active.png`
- [ ] Les images sont servies statiquement par Express via `/assets/illustrations/`
- [ ] Le clic active le personnage ET change l'image vers la version `-active`
- [ ] La désactivation (re-clic, autre personnage, bouton ×) remet en version `-default`
- [ ] Les `alt` texts sont humoristiques et positifs (ex: "Le maître des deadlines")
- [ ] CSS : `display: block; width: 85%; height: auto; border-radius: 8px; margin: 0 auto`
