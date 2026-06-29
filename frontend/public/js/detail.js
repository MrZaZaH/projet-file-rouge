/* ================================================
   OVNI CULINAIRE — Page détail d'une recette
   Fichier : detail.js
   Dépendances : auth.js, app.js (chargés avant)
   ================================================ */

// ====== STATE ======
let recipe = null;

// ====== RECIPE FETCH ======
async function fetchRecipe(id) {
    try {
        const response = await fetch('/api/v1/recipes/' + id);
        if (!response.ok) return null;
        const data = await response.json();
        return data.data || data;
    } catch (error) {
        console.error('Failed to fetch recipe:', error);
        return null;
    }
}

function parseIngredients(data) {
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') {
        try { return JSON.parse(data); } catch { return []; }
    }
    if (typeof data === 'object') return data.items || [];
    return [];
}

function parseSteps(data) {
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') {
        try { return JSON.parse(data); } catch { return []; }
    }
    if (typeof data === 'object') return data.steps || [];
    return [];
}

// ====== RENDER ======
function renderRecipe(data) {
    document.title = data.title + ' – Ovni Culinaire';

    document.getElementById('recipe-category').textContent = (data.category && data.category.name) || 'Autre';
    document.getElementById('recipe-title').textContent = data.title;
    document.getElementById('recipe-time').textContent = formatTime(data.prep_time);
    document.getElementById('recipe-cost').textContent = formatCost(data.cost_per_portion);
    document.getElementById('recipe-author').textContent = data.username || 'Anonyme';

    const ingredientsList = document.getElementById('ingredients-list');
    const ingredients = parseIngredients(data.ingredients);
    ingredients.forEach(function(item) {
        var li = document.createElement('li');
        li.textContent = item;
        ingredientsList.appendChild(li);
    });

    const stepsList = document.getElementById('steps-list');
    const steps = parseSteps(data.steps);
    steps.forEach(function(step) {
        var li = document.createElement('li');
        li.textContent = step;
        stepsList.appendChild(li);
    });

    const storyEl = document.getElementById('recipe-story');
    if (data.anecdote || data.story) {
        storyEl.textContent = data.anecdote || data.story;
    } else {
        storyEl.parentElement.style.display = 'none';
    }

    renderReviews(data.reviews || []);
}

function renderReviews(reviews) {
    const reviewsList = document.getElementById('reviews-list');
    const noReviews = document.getElementById('no-reviews');
    const reviewCount = document.getElementById('review-count');
    const avgRating = document.getElementById('avg-rating');

    reviewCount.textContent = '(' + reviews.length + ' avis)';

    if (reviews.length === 0) {
        noReviews.style.display = 'block';
        return;
    }

    noReviews.style.display = 'none';

    const total = reviews.reduce(function(sum, r) { return sum + (r.rating || 0); }, 0);
    const avg = reviews.length > 0 ? (total / reviews.length) : 0;
    const fullStars = Math.round(avg);
    avgRating.textContent = '\u2605'.repeat(fullStars) + '\u2606'.repeat(5 - fullStars);

    reviews.forEach(function(review) {
        var li = document.createElement('li');
        li.className = 'review-item';
        var date = review.created_at ? new Date(review.created_at).toLocaleDateString('fr-FR') : '';
        li.innerHTML = '<div class="review-item-meta"><span class="review-author">' + (review.pseudo || 'Anonyme') + '</span><span class="review-date">' + date + '</span></div><div class="rating-display" style="margin-bottom:0.5rem;" aria-label="Note: ' + review.rating + ' sur 5">' + '\u2605'.repeat(review.rating || 0) + '\u2606'.repeat(5 - (review.rating || 0)) + '</div><p>' + (review.comment || '') + '</p>';
        reviewsList.appendChild(li);
    });
}

// ====== SHARE ======
function shareRecipe() {
    if (navigator.share) {
        navigator.share({
            title: recipe.title,
            text: 'Découvrez cette recette: ' + recipe.title,
            url: window.location.href
        }).catch(function(err) {
            if (err.name !== 'AbortError') copyLink();
        });
    } else {
        copyLink();
    }
}

function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(function() {
        alert('Lien copi\u00e9 dans le presse-papier!');
    }).catch(function() {
        prompt('Copiez ce lien:', window.location.href);
    });
}

// ====== EVENT LISTENERS ======
document.getElementById('btn-save').addEventListener('click', function() {
    if (typeof isAuthenticated === 'function' && !isAuthenticated()) {
        window.location.href = '/login.html?redirect=' + window.location.pathname + window.location.search;
        return;
    }
    alert('Recette sauvegard\u00e9e !');
});

document.getElementById('btn-comment').addEventListener('click', function() {
    toggleDisplay(document.getElementById('comment-form'), true);
    document.getElementById('comment-form').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    document.getElementById('review-pseudo').focus();
});

document.getElementById('btn-share').addEventListener('click', shareRecipe);

document.getElementById('review-form').addEventListener('submit', function(e) {
    e.preventDefault();
    var formData = new FormData(document.getElementById('review-form'));
    var data = Object.fromEntries(formData.entries());

    if (!data.pseudo || !data.rating || !data.comment) {
        alert('Veuillez remplir tous les champs obligatoires.');
        return;
    }

    console.log('Review submitted:', data);
    alert('Merci pour votre commentaire!');
    document.getElementById('review-form').reset();
    toggleDisplay(document.getElementById('comment-form'), false);
});

// ====== INIT ======
async function init() {
    var recipeId = getUrlParam('id');
    if (!recipeId) {
        toggleDisplay(document.getElementById('loading-state'), false);
        toggleDisplay(document.getElementById('error-state'), true);
        document.querySelector('#error-state h1').textContent = 'Param\u00e8tre manquant';
        document.querySelector('#error-state p').textContent = 'Aucune recette sp\u00e9cifi\u00e9e dans l\'URL.';
        return;
    }

    recipe = await fetchRecipe(recipeId);

    if (!recipe) {
        toggleDisplay(document.getElementById('loading-state'), false);
        toggleDisplay(document.getElementById('error-state'), true);
        return;
    }

    toggleDisplay(document.getElementById('loading-state'), false);
    toggleDisplay(document.getElementById('error-state'), false);
    toggleDisplay(document.getElementById('recipe-content'), true);

    renderRecipe(recipe);
}

init();
