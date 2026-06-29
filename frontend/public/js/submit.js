/* ================================================
   OVNI CULINAIRE — Page de soumission de recette
   Fichier : submit.js
   Dépendances : auth.js, app.js (chargés avant)
   ================================================ */

// ====== DOM ELEMENTS ======
const recipeForm = document.getElementById('recipe-form');
const loginRequired = document.getElementById('login-required');
const submitSuccess = document.getElementById('submit-success');
const submitFormContainer = document.getElementById('submit-form-container');
const openLoginBtn = document.getElementById('open-login-btn');

// ====== LOGIN STATE ======
function checkLoginState() {
    var authed = typeof isAuthenticated === 'function' && isAuthenticated();
    if (authed) {
        loginRequired.style.display = 'none';
        submitFormContainer.style.display = 'block';
    } else {
        loginRequired.style.display = 'block';
        submitFormContainer.style.display = 'none';
    }
}

window.afterLogin = function() {
    checkLoginState();
};

if (openLoginBtn) {
    openLoginBtn.addEventListener('click', function() {
        window.location.href = '/login.html?redirect=submit.html';
    });
}

// ====== FORM ======
function parseListInput(text) {
    return text.split('\n')
        .map(function(line) { return line.trim(); })
        .filter(function(line) { return line.length > 0; });
}

recipeForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    if (!(typeof isAuthenticated === 'function' && isAuthenticated())) {
        window.location.href = '/login.html?redirect=submit.html';
        return;
    }

    var formData = new FormData(recipeForm);
    var data = Object.fromEntries(formData.entries());

    if (!data.title || !data.ingredients || !data.steps || !data.category || !data.cost || !data.prep_time) {
        alert('Veuillez remplir tous les champs obligatoires.');
        return;
    }

    var currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    var payload = {
        title: data.title,
        ingredients: JSON.stringify(parseListInput(data.ingredients)),
        steps: JSON.stringify(parseListInput(data.steps)),
        anecdote: data.anecdote || null,
        category: data.category,
        cost_per_portion: parseFloat(data.cost),
        prep_time: parseInt(data.prep_time, 10),
        author_pseudo: currentUser ? currentUser.username : (localStorage.getItem('ovni_pseudo') || 'Anonyme')
    };

    try {
        var response = await fetch('/api/v1/recipes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + (typeof getToken === 'function' ? getToken() : localStorage.getItem('ovni_token') || '')
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            submitFormContainer.style.display = 'none';
            submitSuccess.style.display = 'block';
            recipeForm.reset();
        } else {
            var errData = await response.json().catch(function() { return {}; });
            alert(errData.error && errData.error.message || 'Erreur lors de l\'envoi. Veuillez réessayer.');
        }
    } catch (error) {
        console.error('Submit failed:', error);
        alert('Erreur lors de l\'envoi. Veuillez réessayer.');
    }
});

// ====== INIT ======
checkLoginState();
