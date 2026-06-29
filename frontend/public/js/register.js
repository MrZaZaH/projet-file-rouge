/* ================================================
   OVNI CULINAIRE — Page d'inscription
   Fichier : register.js
   Dépendances : auth.js, app.js (chargés avant)
   ================================================ */

// ====== DOM ELEMENTS ======
var registerForm = document.getElementById('register-form');
var registerError = document.getElementById('register-error');
var registerSuccess = document.getElementById('register-success');
var formContainer = document.querySelector('.submit-form-container');

// ====== REGISTER HANDLER ======
registerForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    var username = document.getElementById('register-username').value.trim();
    var email = document.getElementById('register-email').value.trim();
    var password = document.getElementById('register-password').value;
    var confirm = document.getElementById('register-confirm').value;

    if (!username || !email || !password || !confirm) {
        registerError.textContent = 'Veuillez remplir tous les champs.';
        registerError.style.display = 'block';
        return;
    }

    if (username.length < 2) {
        registerError.textContent = 'Le pseudo doit contenir au moins 2 caractères.';
        registerError.style.display = 'block';
        return;
    }

    if (password.length < 8) {
        registerError.textContent = 'Le mot de passe doit contenir au moins 8 caractères.';
        registerError.style.display = 'block';
        return;
    }

    if (password !== confirm) {
        registerError.textContent = 'Les mots de passe ne correspondent pas.';
        registerError.style.display = 'block';
        return;
    }

    registerError.style.display = 'none';

    try {
        await registerUser(username, email, password);

        formContainer.style.display = 'none';
        registerSuccess.style.display = 'block';

    } catch (error) {
        registerError.textContent = error.message;
        registerError.style.display = 'block';
    }
});
