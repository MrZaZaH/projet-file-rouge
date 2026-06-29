/* ================================================
   OVNI CULINAIRE — Page de connexion
   Fichier : login.js
   Dépendances : auth.js, app.js (chargés avant)
   ================================================ */

// ====== DOM ELEMENTS ======
var loginForm = document.getElementById('login-page-form');
var loginError = document.getElementById('login-error');
var loginSuccess = document.getElementById('login-success');
var formContainer = document.querySelector('.submit-form-container');

// ====== LOGIN HANDLER ======
loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    var email = document.getElementById('login-email').value.trim();
    var password = document.getElementById('login-password').value;

    if (!email || !password) {
        loginError.textContent = 'Veuillez remplir tous les champs.';
        loginError.style.display = 'block';
        return;
    }

    loginError.style.display = 'none';

    try {
        await loginUser(email, password);

        formContainer.style.display = 'none';
        loginSuccess.style.display = 'block';

        var redirect = getUrlParam('redirect') || 'index.html';
        setTimeout(function() {
            window.location.href = redirect;
        }, 1200);

    } catch (error) {
        loginError.textContent = error.message;
        loginError.style.display = 'block';
    }
});
