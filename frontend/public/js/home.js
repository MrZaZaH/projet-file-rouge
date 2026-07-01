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
const paginationEl = document.getElementById('pagination');
const paginationPages = document.getElementById('pagination-pages');
const paginationInfo = document.getElementById('pagination-info');
const paginationPrev = document.getElementById('pagination-prev');
const paginationNext = document.getElementById('pagination-next');

// ====== STATE ======
let currentPersona = null;
let currentPage = 1;
let totalPages = 0;
let totalRecipes = 0;
const RECIPES_PER_PAGE = 12;

// ====== PERSONA FILTER ======
function getPersonaFilter(persona) {
    switch (persona) {
        case 'maitre-deadlines':
            return { max_prep_time: 15 };
        case 'virtuose-budget':
            return { max_cost: 5 };
        case 'chef-famille':
            return { max_prep_time: 20, min_rating: 4 };
        default:
            return null;
    }
}

function buildApiUrl(persona, page) {
    const base = '/api/v1/recipes';
    const params = new URLSearchParams();
    params.set('limit', RECIPES_PER_PAGE);
    params.set('offset', (page - 1) * RECIPES_PER_PAGE);

    if (persona) {
        const filter = getPersonaFilter(persona);
        if (filter) {
            Object.keys(filter).forEach(function(key) {
                params.set(key, filter[key]);
            });
        }
    }

    return base + '?' + params.toString();
}

// ====== PAGINATION UI ======
function renderPagination() {
    if (totalPages <= 1) {
        paginationEl.style.display = 'none';
        return;
    }

    paginationEl.style.display = 'flex';
    paginationPrev.disabled = currentPage <= 1;
    paginationNext.disabled = currentPage >= totalPages;
    paginationInfo.textContent = 'Page ' + currentPage + ' / ' + totalPages;

    paginationPages.innerHTML = '';

    var start = Math.max(1, currentPage - 2);
    var end = Math.min(totalPages, currentPage + 2);

    if (start > 1) {
        var first = document.createElement('button');
        first.textContent = '1';
        first.setAttribute('aria-label', 'Page 1');
        first.addEventListener('click', function() { goToPage(1); });
        paginationPages.appendChild(first);
        if (start > 2) {
            var dots = document.createElement('span');
            dots.textContent = '…';
            dots.className = 'page-info';
            paginationPages.appendChild(dots);
        }
    }

    for (var i = start; i <= end; i++) {
        var btn = document.createElement('button');
        btn.textContent = i;
        if (i === currentPage) btn.className = 'active';
        btn.setAttribute('aria-label', 'Page ' + i);
        btn.addEventListener('click', (function(p) {
            return function() { goToPage(p); };
        })(i));
        paginationPages.appendChild(btn);
    }

    if (end < totalPages) {
        if (end < totalPages - 1) {
            var dots2 = document.createElement('span');
            dots2.textContent = '…';
            dots2.className = 'page-info';
            paginationPages.appendChild(dots2);
        }
        var last = document.createElement('button');
        last.textContent = totalPages;
        last.setAttribute('aria-label', 'Page ' + totalPages);
        last.addEventListener('click', function() { goToPage(totalPages); });
        paginationPages.appendChild(last);
    }
}

function goToPage(page) {
    if (page === currentPage) return;
    currentPage = page;
    loadRecipes();
}

// ====== RECIPE RENDERING ======
function createRecipeCard(recipe) {
    var card = document.createElement('a');
    card.href = 'recipe.html?id=' + recipe.id;
    card.className = 'recipe-card';
    card.setAttribute('aria-label', recipe.title + ' – ' + formatTime(recipe.prep_time) + ' – ' + formatCost(recipe.cost_per_portion));

    var stars = '\u2605'.repeat(Math.round(recipe.average_rating || 0)) + '\u2606'.repeat(5 - Math.round(recipe.average_rating || 0));

    card.innerHTML = '<div class="recipe-card-meta">\n                    <div class="recipe-time">\n                        <strong>' + formatTime(recipe.prep_time) + '</strong>\n                        <span>pr\u00e9paration</span>\n                    </div>\n                    <div class="recipe-cost">\n                        <strong>' + formatCost(recipe.cost_per_portion) + '</strong>\n                        <span>portion</span>\n                    </div>\n                </div>\n                <h3>' + recipe.title + '</h3>\n                <div class="recipe-card-rating">\n                    ' + stars + '\n                    <span>(' + (recipe.rating_count || 0) + ' avis)</span>\n                </div>';

    if (recipe.anecdote) {
        var anecdote = document.createElement('p');
        anecdote.className = 'recipe-card-anecdote';
        anecdote.textContent = '\u201C' + recipe.anecdote + '\u201D';
        card.appendChild(anecdote);
    }

    return card;
}

function renderRecipes(recipes) {
    try {
        recipeGrid.innerHTML = '';
        var countEl = document.getElementById('result-count');

        if (!recipes || recipes.length === 0) {
            toggleDisplay(recipesLoading, false);
            toggleDisplay(noRecipes, true);
            paginationEl.style.display = 'none';
            if (countEl) countEl.textContent = 'Aucune recette trouv\u00e9e';
            return;
        }

        recipes.forEach(function(recipe) {
            recipeGrid.appendChild(createRecipeCard(recipe));
        });

        if (countEl) {
            var text = totalRecipes === 1
                ? '1 recette trouv\u00e9e'
                : totalRecipes + ' recettes trouv\u00e9es';
            countEl.textContent = text;
        }

        toggleDisplay(recipesLoading, false);
        toggleDisplay(noRecipes, false);
        renderPagination();
    } catch (error) {
        console.error('Render failed:', error);
        toggleDisplay(recipesLoading, false);
        toggleDisplay(recipesError, true);
    }
}

function updateActiveFilter(persona) {
    var container = document.getElementById('active-filters');
    var tags = document.getElementById('filter-tags');
    var count = document.getElementById('result-count');

    if (!persona) {
        container.style.display = 'none';
        tags.innerHTML = '';
        if (count) count.textContent = '';
        return;
    }

    var labels = {
        'maitre-deadlines': 'Le ma\u00eetre des deadlines \u2014 \u2264 15 min',
        'virtuose-budget': 'Le virtuose du repas \u00e0 2\u20ac \u2014 \u2264 5 \u20ac',
        'chef-famille': 'La chef d\u2019orchestre familial \u2014 \u2264 20 min, \u2265 4\u2605'
    };

    container.style.display = 'flex';
    tags.innerHTML = '\n                <span class="filter-tag">\n                    ' + labels[persona] + '\n                    <button type="button" id="remove-filter" aria-label="Retirer le filtre">\u00d7</button>\n                </span>\n            ';

    document.getElementById('remove-filter').addEventListener('click', function() {
        personaCards.forEach(function(c) {
            c.classList.remove('persona-card--active');
            c.setAttribute('aria-pressed', 'false');
            setPersonaImage(c, c.dataset.persona, 'default');
        });
        currentPersona = null;
        currentPage = 1;
        loadRecipes();
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

// ====== FETCH + LOAD ======
async function loadRecipes() {
    var url = buildApiUrl(currentPersona, currentPage);

    toggleDisplay(recipesLoading, true);
    toggleDisplay(recipesError, false);
    paginationEl.style.display = 'none';

    try {
        var response = await fetch(url);
        if (!response.ok) {
            toggleDisplay(recipesLoading, false);
            toggleDisplay(recipesError, true);
            return;
        }

        var result = await response.json();

        if (!result.success || !result.data) {
            toggleDisplay(recipesLoading, false);
            toggleDisplay(noRecipes, true);
            return;
        }

        totalRecipes = result.pagination ? result.pagination.total : result.data.length;
        currentPage = result.pagination ? result.pagination.page : 1;
        totalPages = result.pagination ? result.pagination.totalPages : 1;

        renderRecipes(result.data);

    } catch (err) {
        console.error('Failed to load recipes:', err);
        toggleDisplay(recipesLoading, false);
        toggleDisplay(recipesError, true);
    }
}

// ====== EVENT HANDLERS ======

personaCards.forEach(function(card) {
    card.addEventListener('click', function() {
        var persona = card.dataset.persona;

        if (currentPersona === persona && card.classList.contains('persona-card--active')) {
            card.classList.remove('persona-card--active');
            card.setAttribute('aria-pressed', 'false');
            setPersonaImage(card, persona, 'default');
            currentPersona = null;
            currentPage = 1;
            loadRecipes();
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

        currentPersona = persona;
        currentPage = 1;
        loadRecipes();
        updateActiveFilter(persona);
    });

    card.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            card.click();
        }
    });
});

paginationPrev.addEventListener('click', function() {
    if (currentPage > 1) goToPage(currentPage - 1);
});

paginationNext.addEventListener('click', function() {
    if (currentPage < totalPages) goToPage(currentPage + 1);
});

// ====== INIT ======
function init() {
    loadRecipes();
}

init();
