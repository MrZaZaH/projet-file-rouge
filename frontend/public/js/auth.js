/* ================================================
   OVNI CULINAIRE – Authentication module
   File: auth.js
   Content:
     1. Token management (get/set/remove)
     2. User state (isAuthenticated, getCurrentUser)
     3. API calls (login, register, fetchCurrentUser)
     4. Generic apiRequest with token injection
     5. UI helpers (updateAuthUI, requireAuth, logout)
   ================================================ */

const AUTH_API = '/api/v1/auth';

// ====== 1. TOKEN MANAGEMENT ======

function getToken() {
    return localStorage.getItem('ovni_token');
}

function setToken(token) {
    localStorage.setItem('ovni_token', token);
}

function removeToken() {
    localStorage.removeItem('ovni_token');
    localStorage.removeItem('ovni_user');
    localStorage.removeItem('ovni_pseudo');
    localStorage.removeItem('ovni_email');
}

// ====== 2. USER STATE ======

function isAuthenticated() {
    return !!getToken();
}

function getCurrentUser() {
    try {
        const raw = localStorage.getItem('ovni_user');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function saveUser(user) {
    localStorage.setItem('ovni_user', JSON.stringify(user));
    if (user.username) localStorage.setItem('ovni_pseudo', user.username);
    if (user.email) localStorage.setItem('ovni_email', user.email);
}

// ====== 3. API CALLS ======

async function loginUser(email, password) {
    const res = await fetch(AUTH_API + '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error?.message || 'Échec de connexion');
    }
    setToken(data.data.token);
    saveUser(data.data.user);
    return data.data.user;
}

async function registerUser(username, email, password) {
    const res = await fetch(AUTH_API + '/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error?.message || "Échec de l'inscription");
    }
    setToken(data.data.token);
    saveUser(data.data.user);
    return data.data.user;
}

async function fetchCurrentUser() {
    const token = getToken();
    if (!token) return null;
    try {
        const res = await fetch(AUTH_API + '/me', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) {
            removeToken();
            return null;
        }
        const data = await res.json();
        saveUser(data.data.user);
        return data.data.user;
    } catch {
        removeToken();
        return null;
    }
}

// ====== 4. GENERIC API REQUEST ======

async function apiRequest(endpoint, options) {
    options = options || {};
    const token = getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (options.headers) {
        Object.assign(headers, options.headers);
    }
    if (token) {
        headers['Authorization'] = 'Bearer ' + token;
    }
    const res = await fetch('/api/v1' + endpoint, {
        method: options.method || 'GET',
        headers: headers,
        body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error?.message || 'Erreur serveur');
    }
    return data.data || data;
}

// ====== 5. LOGOUT ======

function logout() {
    removeToken();
    window.location.href = '/';
}

// ====== 6. HEADER UI UPDATE ======

function updateAuthUI() {
    var userLabel = document.getElementById('user-label');
    var userBtn = document.getElementById('user-btn');
    var mobileUserBtn = document.getElementById('mobile-user-btn');
    var user = getCurrentUser();
    var authed = isAuthenticated();

    if (userLabel) {
        userLabel.textContent = authed ? (user && user.username || 'Mon compte') : 'Se connecter';
    }

    if (userBtn) {
        userBtn.onclick = authed ? logout : openLoginModal;
        userBtn.setAttribute('aria-label', authed ? 'Se déconnecter (' + (user && user.username || '') + ')' : 'Se connecter');
    }

    if (mobileUserBtn) {
        mobileUserBtn.textContent = authed ? 'Se déconnecter' : 'Se connecter';
        mobileUserBtn.onclick = authed ? logout : openLoginModal;
    }

    // Show/hide dashboard links based on auth state
    var dashLinks = document.querySelectorAll('.auth-link');
    dashLinks.forEach(function(link) {
        link.style.display = authed ? '' : 'none';
    });
}

// ====== 7. ROUTE PROTECTION ======

function requireAuth(redirectTo) {
    if (!isAuthenticated()) {
        window.location.href = redirectTo || 'login.html';
        return false;
    }
    return true;
}
