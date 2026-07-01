/* ================================================
   OVNI CULINAIRE — Page d'accueil
   Fichier : home.js
   Dépendances : auth.js, app.js (chargés avant)
   ================================================ */

// ====== DOM ELEMENTS ======
const recipeGrid = document.getElementById('recipe-grid');
const recipesLoading = document.getElementById('recipes-loading');
const recipesError = document.getElementById('recipes-error');
const noRecipes = document.getElementById('no-recipes');
const personaCards = document.querySelectorAll('.persona-card');

// ====== STATE ======
let currentPersona = null;

// ====== PERSONA FILTER ======
function getPersonaFilter(persona) {
    switch (persona) {
        case 'salarie-creve':
            return { max_prep_time: 15 };
        case 'etudiant-fauche':
            return { max_cost: 5 };
        case 'parent-epuise':
            return { max_prep_time: 20, min_rating: 4 };
        default:
            return null;
    }
}

// ====== RECIPE RENDERING ======
function createRecipeCard(recipe) {
    const card = document.createElement('a');
    card.href = 'recipe.html?id=' + recipe.id;
    card.className = 'recipe-card';
    card.setAttribute('aria-label', recipe.title + ' – ' + formatTime(recipe.prep_time) + ' – ' + formatCost(recipe.cost_per_portion));

    const stars = '\u2605'.repeat(Math.round(recipe.average_rating || 0)) + '\u2606'.repeat(5 - Math.round(recipe.average_rating || 0));

    card.innerHTML = '<div class="recipe-card-meta">\n                    <div class="recipe-time">\n                        <strong>' + formatTime(recipe.prep_time) + '</strong>\n                        <span>pr\u00e9paration</span>\n                    </div>\n                    <div class="recipe-cost">\n                        <strong>' + formatCost(recipe.cost_per_portion) + '</strong>\n                        <span>portion</span>\n                    </div>\n                </div>\n                <h3>' + recipe.title + '</h3>\n                <div class="recipe-card-rating">\n                    ' + stars + '\n                    <span>(' + (recipe.rating_count || 0) + ' avis)</span>\n                </div>';

    if (recipe.anecdote) {
        const anecdote = document.createElement('p');
        anecdote.className = 'recipe-card-anecdote';
        anecdote.textContent = '\u201C' + recipe.anecdote + '\u201D';
        card.appendChild(anecdote);
    }

    return card;
}

function renderRecipes(recipes) {
    try {
        recipeGrid.innerHTML = '';
        const countEl = document.getElementById('result-count');

        if (!recipes || recipes.length === 0) {
            toggleDisplay(recipesLoading, false);
            toggleDisplay(noRecipes, true);
            if (countEl) countEl.textContent = 'Aucune recette trouv\u00e9e';
            return;
        }

        recipes.forEach(function(recipe) {
            recipeGrid.appendChild(createRecipeCard(recipe));
        });

        if (countEl) {
            const text = recipes.length === 1
                ? '1 recette trouv\u00e9e'
                : recipes.length + ' recettes trouv\u00e9es';
            countEl.textContent = text;
        }

        toggleDisplay(recipesLoading, false);
        toggleDisplay(noRecipes, false);
    } catch (error) {
        console.error('Render failed:', error);
        toggleDisplay(recipesLoading, false);
        toggleDisplay(recipesError, true);
    }
}

function updateActiveFilter(persona) {
    const container = document.getElementById('active-filters');
    const tags = document.getElementById('filter-tags');
    const count = document.getElementById('result-count');

    if (!persona) {
        container.style.display = 'none';
        tags.innerHTML = '';
        count.textContent = '';
        return;
    }

    const labels = {
        'salarie-creve': 'Salari\u00e9 crev\u00e9 \u2014 \u2264 15 min',
        'etudiant-fauche': '\u00c9tudiant fauch\u00e9 \u2014 \u2264 5 \u20ac',
        'parent-epuise': 'Parent \u00e9puis\u00e9 \u2014 \u2264 20 min, \u2265 4\u2605'
    };

    container.style.display = 'flex';
    tags.innerHTML = '\n                <span class="filter-tag">\n                    ' + labels[persona] + '\n                    <button type="button" id="remove-filter" aria-label="Retirer le filtre">\u00d7</button>\n                </span>\n            ';

    document.getElementById('remove-filter').addEventListener('click', async function() {
        personaCards.forEach(function(c) {
            c.classList.remove('persona-card--active');
            c.setAttribute('aria-pressed', 'false');
            setPersonaImage(c, c.dataset.persona, 'default');
        });
        currentPersona = null;
        toggleDisplay(recipesLoading, true);
        const recipes = await fetchRecipes('/api/v1/recipes');
        renderRecipes(recipes);
        updateActiveFilter(null);
    });
}

// ====== PERSONA IMAGE SWAP ======
function setPersonaImage(card, persona, state) {
    var img = card.querySelector('.persona-card-image');
    if (img) {
        img.src = '/assets/illustrations/' + persona + '-' + state + '.png';
    }
}

// ====== EVENT HANDLERS ======

personaCards.forEach(function(card) {
    card.addEventListener('click', async function() {
        const persona = card.dataset.persona;

        if (currentPersona === persona && card.classList.contains('persona-card--active')) {
            card.classList.remove('persona-card--active');
            card.setAttribute('aria-pressed', 'false');
            setPersonaImage(card, persona, 'default');
            currentPersona = null;
            toggleDisplay(recipesLoading, true);
            const recipes = await fetchRecipes('/api/v1/recipes');
            renderRecipes(recipes);
            updateActiveFilter(null);
            return;
        }

        personaCards.forEach(function(c) {
            c.classList.remove('persona-card--active');
            c.setAttribute('aria-pressed', 'false');
            setPersonaImage(c, c.dataset.persona, 'default');
        });
        card.classList.add('persona-card--active');
        card.setAttribute('aria-pressed', 'true');
        setPersonaImage(card, persona, 'active');

        toggleDisplay(recipesLoading, true);
        toggleDisplay(noRecipes, false);

        const filter = getPersonaFilter(persona);
        const params = new URLSearchParams(filter);
        const url = filter ? '/api/v1/recipes?' + params.toString() : '/api/v1/recipes';
        const recipes = await fetchRecipes(url);

        if (recipes) {
            currentPersona = persona;
            renderRecipes(recipes);
            updateActiveFilter(persona);
        } else {
            toggleDisplay(recipesLoading, false);
            toggleDisplay(recipesError, true);
        }
    });

    card.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            card.click();
        }
    });
});

// ====== INIT ======
async function init() {
    toggleDisplay(recipesLoading, true);
    const recipes = await fetchRecipes();
    renderRecipes(recipes);
}

init();
