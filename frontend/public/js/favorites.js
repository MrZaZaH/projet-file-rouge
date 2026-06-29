// favorites.js
// User favorites page — list of saved recipes.

var favorites = [];

async function fetchFavorites() {
    return apiRequest('/favorites');
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function renderFavorites(recipes) {
    var loadingEl = document.getElementById('favorites-loading');
    var emptyEl = document.getElementById('favorites-empty');
    var gridEl = document.getElementById('favorites-grid');

    toggleDisplay(loadingEl, false);

    if (!recipes || recipes.length === 0) {
        toggleDisplay(emptyEl, true);
        gridEl.innerHTML = '';
        return;
    }

    toggleDisplay(emptyEl, false);
    gridEl.innerHTML = '';

    recipes.forEach(function(recipe) {
        var card = document.createElement('a');
        card.href = 'recipe.html?id=' + recipe.id;
        card.className = 'recipe-card';
        card.setAttribute('aria-label', recipe.title);

        var stars = '\u2605'.repeat(Math.round(recipe.average_rating || 0)) +
                    '\u2606'.repeat(5 - Math.round(recipe.average_rating || 0));

        card.innerHTML =
            '<div class="recipe-card-meta">' +
                '<div class="recipe-time"><strong>' + formatTime(recipe.prep_time) + '</strong><span>pr\u00e9paration</span></div>' +
                '<div class="recipe-cost"><strong>' + formatCost(recipe.cost_per_portion) + '</strong><span>portion</span></div>' +
            '</div>' +
            '<h3 style="font-style:italic;margin-bottom:0.5rem;">' + recipe.title + '</h3>' +
            '<div class="recipe-card-rating">' + stars +
                ' <span>(' + (recipe.rating_count || 0) + ' avis)</span>' +
            '</div>' +
            '<p class="text-muted" style="font-size:0.8rem;margin-top:0.5rem;">' +
                'Sauvegard\u00e9 le ' + formatDate(recipe.favorited_at) +
                ' &mdash; par ' + recipe.author +
            '</p>';

        gridEl.appendChild(card);
    });
}

async function initFavorites() {
    if (!requireAuth('login.html?redirect=favorites.html')) return;

    toggleDisplay(document.getElementById('loading-state'), true);
    toggleDisplay(document.getElementById('error-state'), false);
    toggleDisplay(document.getElementById('favorites-content'), false);

    try {
        favorites = await fetchFavorites();

        var subtitle = document.getElementById('favorites-subtitle');
        if (subtitle) {
            subtitle.textContent = favorites.length + ' recette' + (favorites.length > 1 ? 's' : '') + ' sauvegard\u00e9e' + (favorites.length > 1 ? 's' : '');
        }

        renderFavorites(favorites);

        toggleDisplay(document.getElementById('loading-state'), false);
        toggleDisplay(document.getElementById('favorites-content'), true);

    } catch (error) {
        toggleDisplay(document.getElementById('loading-state'), false);
        toggleDisplay(document.getElementById('error-state'), true);
        document.getElementById('error-message').textContent =
            error.message || 'Impossible de charger vos favoris.';
    }
}

initFavorites();
