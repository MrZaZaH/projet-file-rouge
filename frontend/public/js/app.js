/* ================================================
   OVNI CULINAIRE – Fonctions partagées
   Fichier : app.js
   Contenu :
     1. Utilitaires (formatTime, formatCost, toggleDisplay, getUrlParam)
     2. Auth UI (openLoginModal, closeLoginModal)
     3. Navigation (toggleMobileMenu, surpriseMe)
     4. API (fetchRecipes)
     5. Initialisation partagée
   ================================================ */

// auth.js must be loaded BEFORE app.js
// It provides: loginUser, registerUser, isAuthenticated,
//              getCurrentUser, updateAuthUI, requireAuth,
//              logout, apiRequest

// ====== 1. UTILITAIRES ======

function formatTime(minutes) {
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h${m}` : `${h}h`;
}

function formatCost(amount) {
    return `${Number(amount).toFixed(2).replace('.', ',')} €`;
}

function toggleDisplay(element, show) {
    element.style.display = show ? 'block' : 'none';
}

function getUrlParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

// ====== 2. AUTH UI ======

// Backward compat — calls updateAuthUI from auth.js
function updateUserUI() {
    if (typeof updateAuthUI === 'function') {
        updateAuthUI();
    } else {
        // Fallback if auth.js not loaded
        const userLabel = document.getElementById('user-label');
        const pseudo = localStorage.getItem('ovni_pseudo');
        if (userLabel && pseudo) {
            userLabel.textContent = pseudo;
        }
    }
}

function openLoginModal() {
    const modal = document.getElementById('login-modal');
    if (!modal) return;
    modal.classList.add('is-open');
    const firstInput = document.getElementById('login-email');
    if (firstInput) firstInput.focus();
    document.body.style.overflow = 'hidden';
}

function closeLoginModal() {
    const modal = document.getElementById('login-modal');
    if (!modal) return;
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
}

// ====== 3. NAVIGATION ======

function toggleMobileMenu() {
    const nav = document.getElementById('mobile-nav');
    const toggle = document.getElementById('menu-toggle');
    if (!nav || !toggle) return;
    const isOpen = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', isOpen);
}

async function surpriseMe() {
    try {
        const response = await fetch('/api/v1/recipes/random');
        if (response.ok) {
            const result = await response.json();
            const recipe = result.data || result;
            window.location.href = 'recipe.html?id=' + recipe.id;
        }
    } catch (error) {
        console.error('Surprise failed:', error);
    }
}

// ====== 4. API ======

async function fetchRecipes(url) {
    const controller = new AbortController();
    const timeout = setTimeout(function () {
        controller.abort();
    }, 10000);

    try {
        const response = await fetch(url || '/api/v1/recipes', {
            signal: controller.signal
        });
        clearTimeout(timeout);
        if (!response.ok) return null;
        const result = await response.json();
        return Array.isArray(result.data) ? result.data : [];
    } catch (error) {
        console.error('Failed to fetch recipes:', error);
        return null;
    }
}

// ====== 5. INIT PARTAGÉE ======

function initShared() {
    // Update auth UI
    updateUserUI();

    // Surprise me button
    const surpriseBtn = document.getElementById('surprise-btn');
    if (surpriseBtn) {
        surpriseBtn.addEventListener('click', surpriseMe);
    }

    // User button → handle by auth.js (updateAuthUI sets onclick)
    // But add fallback: if auth.js not loaded, open modal
    const userBtn = document.getElementById('user-btn');
    if (userBtn && typeof isAuthenticated === 'undefined') {
        userBtn.addEventListener('click', openLoginModal);
    }
    const mobileUserBtn = document.getElementById('mobile-user-btn');
    if (mobileUserBtn && typeof isAuthenticated === 'undefined') {
        mobileUserBtn.addEventListener('click', openLoginModal);
    }

    // Mobile menu toggle
    const menuToggle = document.getElementById('menu-toggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', toggleMobileMenu);
    }

    // Mobile nav links → close menu
    const mobileNav = document.getElementById('mobile-nav');
    if (mobileNav) {
        mobileNav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                mobileNav.classList.remove('is-open');
                const toggle = document.getElementById('menu-toggle');
                if (toggle) toggle.setAttribute('aria-expanded', 'false');
            });
        });
    }

    // Modal close
    const modalClose = document.getElementById('modal-close');
    if (modalClose) {
        modalClose.addEventListener('click', closeLoginModal);
    }
    const loginModal = document.getElementById('login-modal');
    if (loginModal) {
        loginModal.addEventListener('click', (e) => {
            if (e.target === loginModal) closeLoginModal();
        });
    }

    // Login form (modal) — real API call
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(loginForm);
            const data = Object.fromEntries(formData.entries());

            // Use email + password for login via API
            var email = data.email && data.email.trim();
            var password = data.password;

            if (!email || !password) {
                alert('Veuillez remplir l\'email et le mot de passe.');
                return;
            }

            // Show loading state
            var submitBtn = loginForm.querySelector('button[type="submit"]');
            var originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Connexion...';

            try {
                if (typeof loginUser === 'function') {
                    await loginUser(email, password);
                } else {
                    // Fallback: store locally if auth.js not loaded
                    var pseudo = data.pseudo || email.split('@')[0];
                    localStorage.setItem('ovni_pseudo', pseudo);
                    localStorage.setItem('ovni_email', email);
                }
                updateUserUI();
                closeLoginModal();
                loginForm.reset();
                // Hook for pages that need extra logic after login
                if (window.afterLogin) window.afterLogin();
            } catch (err) {
                alert(err.message || 'Échec de connexion. Vérifiez vos identifiants.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }

    // Escape key → close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && loginModal && loginModal.classList.contains('is-open')) {
            closeLoginModal();
        }
    });
}

document.addEventListener('DOMContentLoaded', initShared);
