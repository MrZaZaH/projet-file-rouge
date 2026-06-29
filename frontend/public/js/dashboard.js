// dashboard.js
// User dashboard — profile stats + recipe history.

// ====== STATE ======
var profileData = null;
var userRecipes = [];

// ====== FETCH ======

async function fetchProfile() {
    return apiRequest('/users/me/profile');
}

async function fetchMyRecipes() {
    return apiRequest('/users/me/recipes');
}

// ====== RENDER ======

function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function getStatusLabel(status) {
    switch (status) {
        case 'published': return 'Publiée';
        case 'pending': return 'En attente';
        case 'rejected': return 'Non retenue';
        default: return status;
    }
}

function getStatusClass(status) {
    switch (status) {
        case 'published': return 'status-published';
        case 'pending': return 'status-pending';
        case 'rejected': return 'status-rejected';
        default: return '';
    }
}

function renderProfile(data) {
    document.getElementById('profile-username').textContent = data.user.username;
    document.getElementById('profile-email').textContent = data.user.email;
    document.getElementById('profile-created').textContent = formatDate(data.user.created_at);
    document.getElementById('dashboard-subtitle').textContent =
        'Bienvenue ' + data.user.username + ' — voici votre activité sur Ovni Culinaire';
}

function renderStats(stats) {
    document.getElementById('stat-total').textContent = stats.total_recipes;
    document.getElementById('stat-published').textContent = stats.published_recipes;
    document.getElementById('stat-pending').textContent = stats.pending_recipes;
    document.getElementById('stat-rejected').textContent = stats.rejected_recipes;
    document.getElementById('stat-comments').textContent = stats.total_comments_received;
}

function renderRecipes(recipes) {
    var loadingEl = document.getElementById('recipes-loading');
    var emptyEl = document.getElementById('recipes-empty');
    var listEl = document.getElementById('recipes-list');

    toggleDisplay(loadingEl, false);

    if (!recipes || recipes.length === 0) {
        toggleDisplay(emptyEl, true);
        listEl.innerHTML = '';
        return;
    }

    toggleDisplay(emptyEl, false);
    listEl.innerHTML = '';

    recipes.forEach(function(recipe) {
        var card = document.createElement('a');
        card.href = 'recipe.html?id=' + recipe.id;
        card.className = 'recipe-card';
        card.setAttribute('aria-label', recipe.title + ' – ' + getStatusLabel(recipe.status));

        var stars = '\u2605'.repeat(Math.round(recipe.average_rating || 0)) +
                    '\u2606'.repeat(5 - Math.round(recipe.average_rating || 0));

        card.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;">' +
                '<div>' +
                    '<div class="recipe-card-meta">' +
                        '<div class="recipe-time"><strong>' + formatTime(recipe.prep_time) + '</strong><span>pr\u00e9paration</span></div>' +
                        '<div class="recipe-cost"><strong>' + formatCost(recipe.cost_per_portion) + '</strong><span>portion</span></div>' +
                    '</div>' +
                    '<h3 style="font-style:italic;margin-bottom:0.5rem;">' + recipe.title + '</h3>' +
                    '<div class="recipe-card-rating">' + stars +
                        ' <span>(' + (recipe.rating_count || 0) + ' avis)</span>' +
                    '</div>' +
                '</div>' +
                '<span class="status-badge ' + getStatusClass(recipe.status) + '">' + getStatusLabel(recipe.status) + '</span>' +
            '</div>';

        if (recipe.anecdote) {
            var p = document.createElement('p');
            p.className = 'recipe-card-anecdote';
            p.textContent = '\u201C' + recipe.anecdote + '\u201D';
            card.appendChild(p);
        }

        listEl.appendChild(card);
    });
}

// ====== INIT ======

async function initDashboard() {
    if (!requireAuth('login.html?redirect=dashboard.html')) return;

    toggleDisplay(document.getElementById('loading-state'), true);
    toggleDisplay(document.getElementById('error-state'), false);
    toggleDisplay(document.getElementById('dashboard-content'), false);

    try {
        var profileResult = await fetchProfile();
        var recipesResult = await fetchMyRecipes();

        profileData = profileResult;
        userRecipes = recipesResult;

        renderProfile(profileResult);
        renderStats(profileResult.stats);
        renderRecipes(recipesResult);

        toggleDisplay(document.getElementById('loading-state'), false);
        toggleDisplay(document.getElementById('dashboard-content'), true);

    } catch (error) {
        toggleDisplay(document.getElementById('loading-state'), false);
        toggleDisplay(document.getElementById('error-state'), true);
        document.getElementById('error-message').textContent =
            error.message || 'Impossible de charger vos données.';
    }
}

initDashboard();
