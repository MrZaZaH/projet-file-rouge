// detail.js
let recipe = null;
let currentComments = [];

// ====== FETCH ======

async function fetchRecipe(id) {
    try {
        const response = await fetch('/api/v1/recipes/' + id);
        if (!response.ok) return null;
        const result = await response.json();
        return result.data || null;
    } catch (error) {
        console.error('Failed to fetch recipe:', error);
        return null;
    }
}

async function submitComment(recipeId, formData) {
    var body = {
        content: formData.comment
    };

    var headers = { 'Content-Type': 'application/json' };
    var token = getToken();
    if (token) {
        headers['Authorization'] = 'Bearer ' + token;
    } else {
        body.guest_name = formData.pseudo;
    }

    var response = await fetch('/api/v1/recipes/' + recipeId + '/comments', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
    });
    var result = await response.json();
    if (!response.ok) {
        throw new Error(result.error?.message || 'Erreur lors de l\'envoi du commentaire');
    }
    return result.data || result;
}

async function submitRating(recipeId, score) {
    var response = await fetch('/api/v1/recipes/' + recipeId + '/ratings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + getToken()
        },
        body: JSON.stringify({ score: score })
    });
    var result = await response.json();
    if (!response.ok) {
        throw new Error(result.error?.message || 'Erreur lors de l\'envoi de la note');
    }
    return result.data || result;
}

// ====== PARSE ======

function parseJSON(data) {
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') {
        try { return JSON.parse(data); } catch { return []; }
    }
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

    var ingredientsList = document.getElementById('ingredients-list');
    ingredientsList.innerHTML = '';
    var ingredients = parseJSON(data.ingredients);
    ingredients.forEach(function(item) {
        var li = document.createElement('li');
        li.textContent = item;
        ingredientsList.appendChild(li);
    });

    var stepsList = document.getElementById('steps-list');
    stepsList.innerHTML = '';
    var steps = parseJSON(data.steps);
    steps.forEach(function(step, index) {
        var li = document.createElement('li');
        li.textContent = step;
        stepsList.appendChild(li);
    });

    var storyEl = document.getElementById('recipe-story');
    if (data.anecdote) {
        storyEl.textContent = data.anecdote;
    } else {
        storyEl.parentElement.style.display = 'none';
    }

    renderRatingDisplay(data.average_rating, data.rating_count || 0);
    currentComments = data.comments || [];
    renderComments(currentComments);
}

function renderRatingDisplay(average, count) {
    var avgEl = document.getElementById('avg-rating');
    var countEl = document.getElementById('review-count');
    if (avgEl) {
        var full = Math.round(average || 0);
        var empty = 5 - full;
        avgEl.textContent = '\u2605'.repeat(full) + '\u2606'.repeat(Math.max(0, empty));
    }
    if (countEl) {
        countEl.textContent = '(' + (count || 0) + ' avis)';
    }
}

function renderComments(comments) {
    var list = document.getElementById('reviews-list');
    var noReviews = document.getElementById('no-reviews');

    list.innerHTML = '';

    if (!comments || comments.length === 0) {
        noReviews.style.display = 'block';
        return;
    }

    noReviews.style.display = 'none';

    comments.forEach(function(c) {
        var li = document.createElement('li');
        li.className = 'review-item';
        var date = c.created_at ? new Date(c.created_at).toLocaleDateString('fr-FR') : '';
        li.innerHTML =
            '<div class="review-item-meta">' +
                '<span class="review-author">' + escapeHTML(c.pseudo || 'Anonyme') + '</span>' +
                '<span class="review-date">' + date + '</span>' +
            '</div>' +
            '<p>' + escapeHTML(c.content || '') + '</p>';
        list.appendChild(li);
    });
}

function escapeHTML(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

// ====== COMMENT FORM ======

function handleCommentSubmit(e) {
    e.preventDefault();
    var form = document.getElementById('review-form');
    var formData = new FormData(form);
    var data = Object.fromEntries(formData.entries());

    var pseudo = data.pseudo && data.pseudo.trim();
    var comment = data.comment && data.comment.trim();
    var rating = data.rating;

    if (!isAuthenticated() && !pseudo) {
        alert('Veuillez entrer un pseudo.');
        return;
    }
    if (!comment || comment.length < 3) {
        alert('Le commentaire doit contenir au moins 3 caractères.');
        return;
    }

    var submitBtn = form.querySelector('button[type="submit"]');
    var originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi en cours...';

    var submitter = (function(recipeId, data, isAuthed) {
        return async function() {
            try {
                if (isAuthed && rating) {
                    var score = parseInt(rating, 10);
                    if (score >= 1 && score <= 5) {
                        try {
                            await submitRating(recipeId, score);
                        } catch (err) {
                            console.warn('Rating failed (may be own recipe):', err.message);
                        }
                    }
                }

                await submitComment(recipeId, {
                    comment: data.comment,
                    pseudo: pseudo || data.pseudo
                });

                form.reset();
                var stars = form.querySelectorAll('.star-rating-stars input');
                stars.forEach(function(s) { s.checked = false; });
                toggleDisplay(document.getElementById('comment-form'), false);

                recipe = await fetchRecipe(recipeId);
                renderRatingDisplay(recipe.average_rating, recipe.rating_count || 0);
                currentComments = recipe.comments || [];
                renderComments(currentComments);

            } catch (err) {
                alert(err.message || 'Erreur lors de l\'envoi.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        };
    })(recipe.id, data, isAuthenticated());

    submitter();
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
        alert('Lien copié dans le presse-papier!');
    }).catch(function() {
        prompt('Copiez ce lien:', window.location.href);
    });
}

// ====== EVENT LISTENERS ======

function initEventListeners() {
    document.getElementById('btn-save').addEventListener('click', function() {
        if (!isAuthenticated()) {
            openLoginModal();
            return;
        }
        alert('Recette sauvegardée !');
    });

    document.getElementById('btn-comment').addEventListener('click', function() {
        toggleDisplay(document.getElementById('comment-form'), true);
        document.getElementById('comment-form').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        if (isAuthenticated()) {
            var pseudoGroup = document.getElementById('review-pseudo').closest('.form-group');
            if (pseudoGroup) pseudoGroup.style.display = 'none';
        } else {
            var pseudoGroup = document.getElementById('review-pseudo').closest('.form-group');
            if (pseudoGroup) pseudoGroup.style.display = '';
            document.getElementById('review-pseudo').focus();
        }
    });

    document.getElementById('btn-share').addEventListener('click', shareRecipe);

    document.getElementById('review-form').addEventListener('submit', handleCommentSubmit);
}

// ====== INIT ======

async function init() {
    var recipeId = getUrlParam('id');
    if (!recipeId) {
        toggleDisplay(document.getElementById('loading-state'), false);
        toggleDisplay(document.getElementById('error-state'), true);
        document.querySelector('#error-state h1').textContent = 'Paramètre manquant';
        document.querySelector('#error-state p').textContent = 'Aucune recette spécifiée dans l\'URL.';
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
    initEventListeners();
}

init();
