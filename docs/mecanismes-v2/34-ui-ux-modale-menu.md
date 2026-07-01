# 34 — UI/UX (Modale, Menu Mobile, Design Tokens)

## 1. CE QUE ÇA FAIT (vue d'ensemble)

Ce mécanisme regroupe trois éléments d'interface utilisateur :

1. **Modale de connexion** : fenêtre superposée avec overlay, focus trap, fermeture au clic sur l'overlay ou touche Échap
2. **Menu mobile** : navigation hamburger avec `aria-expanded` pour l'accessibilité
3. **Design tokens** : variables CSS (`:root`) qui centralisent les couleurs, polices, ombres, espacements

Ces trois éléments sont dans deux fichiers :

- `app.js` : logique JS (ouverture/fermeture modale, toggle menu mobile)
- `variables.css` : design tokens (couleurs, polices, ombres, bordures)

---

## 2. SCHÉMA DE LA TABLE

Pas de table.

---

## 3. LE CODE

### 3.1 — openLoginModal / closeLoginModal (`frontend/public/js/app.js:55`)

```js
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
```

**`openLoginModal()` :**
1. Récupère l'élément modale (`#login-modal`)
2. Si l'élément n'existe pas, on sort (`if (!modal) return`) — graceful degradation
3. Ajoute la classe `.is-open` qui rend la modale visible (via CSS : `display: block` ou `opacity: 1`)
4. Donne le focus au premier champ (email) pour que l'utilisateur puisse taper directement
5. Bloque le scroll du body (`overflow: hidden`) pour que la page en dessous ne soit pas défilable

**`closeLoginModal()` :**
1. Enlève la classe `.is-open`
2. Restaure le scroll (`overflow: ''`)

Le `overflow: hidden` sur le body est important : sans ça, l'utilisateur peut scroller la page derrière la modale, ce qui fait mauvais genre et peut prêter à confusion.

### 3.2 — Gestion des événements de la modale (`frontend/public/js/app.js:158`)

```js
// Fermeture au clic sur le bouton X
modalClose.addEventListener('click', closeLoginModal);

// Fermeture au clic sur l'overlay (fond sombre)
loginModal.addEventListener('click', (e) => {
    if (e.target === loginModal) closeLoginModal();
});

// Fermeture à la touche Échap
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && loginModal && loginModal.classList.contains('is-open')) {
        closeLoginModal();
    }
});
```

Trois façons de fermer la modale (standards d'accessibilité) :

- **Bouton X** : clic explicite sur le bouton de fermeture
- **Overlay** : clic sur le fond sombre (vérifie que `e.target === loginModal` — l'overlay lui-même, pas un élément enfant)
- **Échap** : écoute globale `keydown`, ne ferme la modale que si elle est ouverte (évite de fermer une modale déjà fermée)

La vérification `e.target === loginModal` est cruciale : sans elle, un clic sur n'importe quel élément à l'intérieur de la modale (le formulaire, un input) fermerait la modale (propagation jusqu'à l'overlay). On veut que seul le clic direct sur le fond sombre ferme.

### 3.3 — toggleMobileMenu (`frontend/public/js/app.js:73`)

```js
function toggleMobileMenu() {
    const nav = document.getElementById('mobile-nav');
    const toggle = document.getElementById('menu-toggle');
    if (!nav || !toggle) return;

    const isOpen = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', isOpen);
}
```

**`classList.toggle('is-open')`** : si la classe existe, elle est retirée ; si elle n'existe pas, elle est ajoutée. Retourne `true` si la classe a été ajoutée, `false` si elle a été retirée.

**`aria-expanded`** : attribut ARIA qui indique aux lecteurs d'écran si le menu est déplié (`true`) ou replié (`false`). La valeur est synchronisée avec l'état du menu via la variable `isOpen`.

### 3.4 — Fermeture du menu mobile au clic sur un lien (`frontend/public/js/app.js:146`)

```js
mobileNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
        mobileNav.classList.remove('is-open');
        const toggle = document.getElementById('menu-toggle');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
    });
});
```

Quand l'utilisateur clique sur un lien dans le menu mobile, le menu se referme automatiquement. Sans ça, le menu resterait ouvert après navigation (ou après clic, si le lien est une ancre interne).

### 3.5 — Design Tokens (`frontend/public/css/variables.css:22`)

```css
:root {
    --bg: #faf6e9;
    --surface: #f0ead6;
    --ink: #1a1a1a;
    --ink-muted: #4a4540;
    --accent: #c0392b;
    --accent-hover: #e74c3c;
    --accent-2: #e67e22;
    --success: #1a7338;
    --error: #c0392b;
    --border: 2px solid #1a1a1a;
    --border-thin: 1px solid #1a1a1a;
    --shadow-sm: 3px 3px 0 var(--ink);
    --shadow-md: 5px 5px 0 var(--ink);
    --shadow-lg: 7px 7px 0 var(--ink);
    --font-heading: 'Playfair Display', Georgia, serif;
    --font-body: 'Special Elite', 'Courier New', monospace;
    --max-width: 1100px;
    --header-height: 72px;
}
```

Les **design tokens** sont des variables CSS qui centralisent les valeurs de design :

| Token | Valeur | Usage |
|-------|--------|-------|
| `--bg` | `#faf6e9` | Fond de page (beige clair) |
| `--surface` | `#f0ead6` | Fond des cartes/sections |
| `--ink` | `#1a1a1a` | Texte principal (presque noir) |
| `--accent` | `#c0392b` | Rouge accent (boutons, liens) |
| `--success` | `#1a7338` | Vert pour confirmations |
| `--error` | `#c0392b` | Rouge pour erreurs |
| `--border` | `2px solid #1a1a1a` | Bordures épaisses |
| `--shadow-sm` | `3px 3px 0 var(--ink)` | Ombres pixel-art (décalage sans flou) |
| `--font-heading` | `'Playfair Display', Georgia, serif` | Police pour titres (élégante, sérif) |
| `--font-body` | `'Special Elite', 'Courier New', monospace` | Police pour texte (dactylo, monospace) |

Les ombres `3px 3px 0` créent un effet pixel-art / brutalism : pas de flou (`0` à la fin), juste un décalage de 3px. C'est un choix de design délibéré qui donne un aspect "tampon encreur" au site.

### 3.6 — CSS Reset (`frontend/public/css/variables.css:13`)

```css
*,
*::before,
*::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}
```

**Reset universel** : applique `box-sizing: border-box` à tous les éléments. Ce qui signifie que `width: 100px` inclut le padding et la bordure (pas de dépassement). `margin: 0` et `padding: 0` supprime les marges par défaut du navigateur sur tous les éléments.

### 3.7 — Classe `.sr-only` (`frontend/public/css/variables.css:92`)

```css
.sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
}
```

**Screen reader only** : cache visuellement un élément tout en le laissant accessible aux lecteurs d'écran. Utilisé pour les textes descriptifs qui ne doivent pas être visibles (ex : "Menu de navigation" avant le menu hamburger).

### 3.8 — Typographie responsive (`frontend/public/css/variables.css:84`)

```css
h1 { font-size: clamp(2rem, 5vw, 3.2rem); }
h2 { font-size: clamp(1.5rem, 4vw, 2.2rem); }
h3 { font-size: clamp(1.25rem, 3vw, 1.5rem); }
```

`clamp(MIN, PREFERRED, MAX)` : fonction CSS qui définit une taille fluide.

- Exemple pour `h1` : `clamp(2rem, 5vw, 3.2rem)`
  - Minimum : `2rem` (32px)
  - Préféré : `5vw` (5% de la largeur de la fenêtre)
  - Maximum : `3.2rem` (51.2px)

Résultat : sur mobile (320px), `5vw = 16px` → prend le minimum `2rem` = 32px. Sur desktop (1200px), `5vw = 60px` → prend le maximum `3.2rem` = 51.2px. Entre les deux, la taille fluctue entre 32px et 51.2px.

---

## 4. CE QUI SE PASSE ÉTAPE PAR ÉTAPE

**Ouverture de la modale :**
```
1. L'utilisateur clique "Se connecter"
2. openLoginModal() est appelé
3. modal = document.getElementById('login-modal')
4. modal.classList.add('is-open')
5. CSS : .login-modal.is-open { display: flex; } → la modale apparaît
6. firstInput.focus() → le curseur est dans le champ email
7. body.style.overflow = 'hidden' → la page ne défile plus
8. L'utilisateur peut :
   - Fermer via le X, l'overlay, ou Échap
   - Remplir le formulaire et se connecter
```

**Toggle menu mobile :**
```
1. L'utilisateur clique sur le hamburger (#menu-toggle)
2. toggleMobileMenu() est appelé
3. nav.classList.toggle('is-open') → menu visible
4. toggle.setAttribute('aria-expanded', 'true')
5. L'utilisateur clique un lien :
   - menu.classList.remove('is-open')
   - aria-expanded = 'false'
6. L'utilisateur re-clique sur le hamburger :
   - is-open retiré → menu caché
   - aria-expanded = 'false'
```

---

## 5. ANALOGIE

**La modale** : c'est comme la **réceptionniste qui s'approche de ton bureau** :

- Elle arrive, et tout autour devient flou (overlay sombre)
- Tu ne peux plus bouger tant que tu ne lui as pas parlé (body overflow hidden)
- Tu peux la renvoyer en cliquant à côté (overlay click), en disant "non merci" (bouton X), ou en répondant à ses questions (remplir le formulaire)

**Le menu mobile** : c'est le **tiroir secret de ton bureau** :

- Tu tires la poignée (hamburger) → le tiroir s'ouvre (menu déroule)
- Tu prends ce dont tu as besoin (cliques un lien)
- Tu pousses le tiroir ou il se referme tout seul

**Les design tokens** : c'est le **cahier des charges du décorateur** :

- "La couleur du mur est beige clair" (`--bg`)
- "Les meubles sont beige foncé" (`--surface`)
- "Les titres sont en police Playfair Display, le texte en Special Elite"
- "Les bordures sont épaisses et noires, les ombres sont nettes sans flou"
- Si le décorateur veut changer la couleur des murs, il change UNE valeur au lieu de 50 endroits

---

## 6. PIÈGES CLASSIQUES

### Piège #1 : La modale qui ne se ferme pas

Si on oublie de gérer la fermeture par overlay ou Échap, un utilisateur qui ne trouve pas le bouton X est coincé sur la modale. C'est une erreur d'UX courante.

**Notre implémentation** : trois façons de fermer (X, overlay, Échap).

### Piège #2 : `overflow: hidden` oublié après fermeture

Si la modale se ferme mais que `body.style.overflow` reste `'hidden'`, la page reste bloquée. L'utilisateur ne peut plus scroller — il croit que la page est cassée.

**Notre implémentation** : `closeLoginModal()` remet `overflow: ''` à chaque fermeture.

### Piège #3 : `classList.toggle` mal interprété

```js
// MAUVAIS : on suppose que le menu est fermé
nav.classList.toggle('is-open');
toggle.setAttribute('aria-expanded', 'true'); // ← toujours 'true', même si fermé

// BON : on utilise la valeur de retour
const isOpen = nav.classList.toggle('is-open');
toggle.setAttribute('aria-expanded', isOpen); // ← valeur correcte
```

### Piège #4 : Design tokens non appliqués

Si un développeur utilise une valeur en dur (`color: #c0392b`) au lieu de la variable (`color: var(--accent)`), changer la couleur principale nécessite de chercher toutes les occurrences dans tous les fichiers CSS.

**Solution** : toujours utiliser `var(--nom-du-token)` et jamais la valeur hexadécimale directe. Ajouter un commentaire dans le code si nécessaire : `color: #c0392b; /* TODO: use var(--accent) */`

---

## 7. ET SI ON FAISAIT AUTREMENT ?

### Option A : Modale avec `<dialog>` HTML natif

- **Comment ça marche** : L'élément HTML `<dialog>` gère nativement l'ouverture/fermeture, le focus trap, et la fermeture à Échap.
- **Avantage** : Moins de code JS, support natif des navigateurs modernes (90%+).
- **Inconvénient** : Pas de contrôle fin sur l'animation, nécessite un polyfill pour les vieux navigateurs.
- **Notre cas** : Avec `classList.toggle('is-open')`, on a le contrôle total du CSS. Plus pédagogique pour un projet de formation.

### Option B : Menu mobile avec checkbox CSS (pas de JS)

- **Comment ça marche** : `<input type="checkbox" id="menu-toggle">` avec un label qui fait office de hamburger. Le menu s'affiche quand la checkbox est cochée via `#menu-toggle:checked ~ nav { display: block; }`.
- **Avantage** : Zéro JS pour le toggle. Fonctionne même si JS est désactivé.
- **Inconvénient** : Difficile de gérer les sous-menus, l'accessibilité ARIA, et la fermeture au clic sur un lien.
- **Notre cas** : Le JS permet plus de contrôle (aria-expanded, fermeture automatique au clic). Et de toute façon le site nécessite JS pour fonctionner.

### Option C : Design tokens dans un préprocesseur (Sass/PostCSS)

- **Comment ça marche** : Variables Sass/PostCSS compilées en CSS statique.
- **Avantage** : Possibilité de faire des opérations mathématiques sur les couleurs (`darken($accent, 10%)`).
- **Inconvénient** : Nécessite une étape de build. Le projet utilise du CSS vanilla sans build.
- **Notre cas** : Le CSS vanilla avec `:root` et `var()` est plus simple et ne nécessite pas d'outillage.

---

## 8. CHECKLIST POUR LE JURY

- [ ] `openLoginModal()` ajoute la classe `.is-open` et met le focus sur le premier champ
- [ ] `closeLoginModal()` enlève `.is-open` et restaure le scroll
- [ ] La modale se ferme au clic sur l'overlay (vérification `e.target === modal`)
- [ ] La modale se ferme à la touche Échap
- [ ] Le menu mobile utilise `classList.toggle('is-open')` et synchronise `aria-expanded`
- [ ] Les liens du menu mobile ferment le menu après clic
- [ ] Les design tokens sont définis dans `:root` et utilisés via `var(--nom)` dans le CSS
- [ ] Les ombres sont sans flou (pixel-art : `3px 3px 0`)
- [ ] Les polices sont déclarées en fallback (`font-family: 'Playfair Display', Georgia, serif`)
- [ ] La typographie est responsive via `clamp()`
- [ ] Le reset CSS utilise `box-sizing: border-box` sur tous les éléments
- [ ] La classe `.sr-only` cache visuellement mais reste accessible aux lecteurs d'écran
