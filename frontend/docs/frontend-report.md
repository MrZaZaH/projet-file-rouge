# OVNI Culinaire — Frontend Report

## Overview

This document tracks frontend development progress, architectural choices, and alignment with user stories and competencies.

## Status — Day 21

### Completed

- **Homepage** (`index.html`): Hero section, character-based filters (Salarié crevé, Étudiant fauché, Parent épuisé), recipe grid with cards (time, cost, rating, anecdote), "Surprends-moi" button wired to backend API
- **Design System** (`css/variables.css`, `css/styles.css`): CSS custom properties, typography, responsive grid, recipe cards, form components, modal, mobile navigation
- **Recipe detail page** (`recipe.html`): Structure for ingredients, steps, anecdote block, comments, rating
- **Submit page** (`submit.html`): Recipe submission form
- **Shared JavaScript** (`js/app.js`): Utility functions, auth modal, mobile menu, `surpriseMe()` calling `/api/recipes/random`, `fetchRecipes()` for API calls
- **Persona filtering**: Each character card triggers an API call with specific query parameters; filter is applied dynamically without page reload
- **Mobile-first responsive**: Three breakpoints (576px, 768px, 992px), hamburger menu on mobile

### Day 23 — Refinements

- **Persona filter toggle/deselect**: Re-clicking the active persona deselects it and reloads all recipes
- **Active filter tags**: `#active-filters` with `.filter-tag` (label + × button), `role="status"` `aria-live="polite"`
- **Result counter**: "X recettes trouvées" / "Aucune recette trouvée" in `#result-count`
- **URLSearchParams**: Used to build query strings instead of raw concatenation
- **API field fix**: `recipe.rating_count` replaces `recipe.comment_count` (actual DB field name)
- **US-04 removed**: Ingredient filter ("Moins de 5 ingrédients") definitively dropped from specs and planning
- **`/recettes.html` removed**: Persona filters are the **only** filtering mechanism on homepage (per specs)
- **Dynamic `aria-pressed`**: Persona cards update `aria-pressed` attribute on toggle

### Not yet implemented

- **Images**: Recipe cards have a placeholder container; actual images will be added in a later iteration
- **Dynamic recipe detail**: Currently static; will be connected to backend API on Day 27
- **User dashboard**: Planned for Day 28
- **Admin dashboard**: Planned for Day 29

## Filtering & Navigation

Filtering is based on three comic strip characters, each representing a specific user persona and filter preset:

- **Salarié crevé**: `prep_time <= 15 min` (time-pressed worker)
- **Étudiant fauché**: `cost <= 5€` (budget-conscious student)
- **Parent épuisé**: `prep_time <= 20 min + rating >= 4` (exhausted parent)

No additional filter controls exist — no dropdowns, sliders, or standalone filter chips. This keeps the UI simple, accessible, and aligned with the project's narrative identity.

## Accessibility

- Skip link to main content
- Semantic HTML5 landmarks (`header`, `main`, `nav`, `section`, `footer`)
- `aria-label`, `aria-pressed`, `role="button"` on interactive cards
- `aria-live="polite"` on recipe grid for dynamic content updates
- `aria-modal` and focus management on login modal
- Mobile menu with `aria-expanded` and `aria-controls`
- Keyboard navigation support on persona cards (Enter/Space)
- Color contrast: all text meets 4.5:1 minimum ratio
- Focus outlines visible on all interactive elements
- `role="alert"` on error messages

## Status — Day 22

### Completed

- **Recipe detail page** (`recipe.html`): Fully implemented with:
  - Recipe header (category, title, prep time, cost per portion, author)
  - Ingredients section with accessible list (`aria-labelledby`)
  - Steps section with ordered list
  - "L'histoire derrière" narrative block (hidden when no anecdote)
  - Save / Comment / Share actions (Web Share API with clipboard fallback)
  - Comment form with pseudo (no account required), rating (select), and text
  - Reviews section with average rating calculation and comment list
  - Loading / Error / Content state management
- **API connectivity**: `fetchRecipe(id)` calls `GET /api/v1/recipes/:id`; `fetchRecipes()` with persona-based query params
- **Data parsing**: JSON columns (ingredients, steps) parsed client-side
- **Accessibility**: skip link, landmarks, `aria-labelledby` on all sections, `aria-live` on reviews, `role="alert"` on errors, `aria-required` on form fields, visible focus states
- **Dynamic behavior**: recipe ID read from URL params (`?id=xx`), share via `navigator.share()`, comment form toggle, smooth scroll
- **Jackpot badge removed**: `refactor: remove Jackpot badge and utensils section from frontend and specs`

### Not yet implemented

- **Persistent comments**: Currently stored in memory only; backend connection planned for Day 27
- **Clickable star rating**: Using `<select>` for now; interactive stars planned for Day 27
- **Image display**: Placeholder containers remain; actual images from backend pending

## Performance

- `loading="lazy"` ready for future images
- CSS minified via single stylesheet
- No external dependencies except Google Fonts (preconnected)
- Grid layout minimizes reflows
- No JavaScript framework overhead

## Status — Day 24

### Completed

- Lighthouse audit: index, submit, login modal all >90% Performance & Accessibility
- Mobile-first responsive verified on 375px, 768px, 1024px
- Color contrast audit: WCAG AA calculations for all color pairs (table below)
- Skip link, Tab navigation, input labels, error states validated on all pages
- accessibility.md finalized (15 RGAA rules, checklist, testing recommendations)
- Styleguide updated with all components

### Contrast Verification Table

- ink (#1a1a1a) on bg (#faf6e9) = 16.10:1 ✅
- ink-muted (#4a4540) on bg (#faf6e9) = 8.76:1 ✅
- accent (#c0392b) on bg (#faf6e9) = 5.03:1 ✅
- ink (#1a1a1a) on surface (#f0ead6) = 14.46:1 ✅
- ink-muted (#4a4540) on surface (#f0ead6) = 7.87:1 ✅
- accent (#c0392b) on surface (#f0ead6) = 4.52:1 ✅
- white (#ffffff) on accent (#c0392b) = 5.44:1 ✅
- success (#1a7338) on surface (#f0ead6) = 4.91:1 ✅
- ink (#1a1a1a) on white (#ffffff) = 17.40:1 ✅

### Not yet implemented

- Same as Day 22 — no new feature work on Day 24

## Lighthouse Scores

- **index.html**: Performance >90, Accessibility >90, SEO >90
- **submit.html**: Performance >90, Accessibility >90, SEO >90
- **Login modal**: Accessibility >90 (focus trap, ARIA modal, labels)
- Improvements: success green contrast fixed (#27ae60 → #1a7338)
- Note: images not yet implemented, so Best Practices may be slightly impacted

## Responsive Testing

| Breakpoint | Layout | Notes |
|-----------|--------|-------|
| 375px (mobile) | 1-column grid, hamburger menu, persona cards stacked | Width corresponds to iPhone SE |
| 768px (tablet) | 2-column grid, desktop navigation visible | Tested on iPad portrait |
| 1024px (desktop) | 3-column grid, full layout, max-width container | Standard laptop viewport |

- Mobile: `@media (max-width: 575px)` — hamburger active, single column
- Tablet: `@media (min-width: 576px)` — 2 columns, full nav
- Desktop: `@media (min-width: 768px)` — 3 columns
- Wide: `@media (min-width: 992px)` — max-width constrained with margin auto

## Status — Day 25

### Completed

- **`js/auth.js`**: Full authentication module with:
  - `loginUser(email, password)` → `POST /api/v1/auth/login` with error handling
  - `registerUser(username, email, password)` → `POST /api/v1/auth/register` with validation
  - `fetchCurrentUser()` → `GET /api/v1/auth/me` to verify token server-side
  - `isAuthenticated()` / `getCurrentUser()` for client-side state checks
  - `apiRequest(endpoint, options)` generic fetch with automatic Bearer token injection
  - `updateAuthUI()` dynamically re-wires header buttons (redirect to login or logout)
  - `requireAuth(redirectTo)` for front-end route protection
  - JWT stored in `localStorage` as `ovni_token`; user object as `ovni_user` JSON
- **`login.html`**: Dedicated login page with email + password, inline error display (role="alert"), success state with redirect (`?redirect=` param), accessible labels and ARIA attributes
- **`register.html`**: Dedicated registration page with username, email, password, confirm password; client-side validation (password match, min length, empty field checks), inline error messages, success state
- **Modal login**: Updated in all pages (index, recipe, submit, styleguide) — simplified form (email + password only, removed pseudo field), button "Se connecter", "Créer un compte" link to register.html
- **`submit.html` auth update**: Uses `isAuthenticated()` + `getCurrentUser()` + `getToken()` from auth.js, redirects to login with return URL (`?redirect=submit.html`), fetch error messages from backend
- **`recipe.html` auth update**: Save button checks `isAuthenticated()` before allowing, redirects to login with return URL
- **Header dynamic**: `#user-btn` and `#mobile-user-btn` wired by `updateAuthUI()` — shows "Se connecter" → login.html or username → logout based on auth state
- **Route protection**: `requireAuth()` utility redirects unauthenticated users to login page
- **Backward compat**: `updateUserUI()` kept as a wrapper calling `updateAuthUI()`; all existing `localStorage` keys preserved

### Security front-end

- Password never stored in localStorage, only the JWT token
- Token stored alongside user JSON, sent via `Authorization: Bearer` header
- `apiRequest()` centralises credential transmission — one place to audit
- Server-side validation exists on all auth endpoints (express-validator, bcrypt, JWT 24h expiry)
- Auth rate limiting: 10 requests/15min on `/api/v1/auth` (brute force protection)
- XSS protection: all backend responses sanitised via express-validator; front-end uses `textContent` not `innerHTML` where user data is rendered
- No sensitive data exposed in URLs (tokens never in query strings)
- Login page errors do not distinguish between "email not found" and "wrong password" (prevents user enumeration)

## Self-Assessment (Competences 1.2 & 1.3)

See full evaluation in `docs/competences/auto-evaluation-bloc1.md`.

### Competence 1.2 — Maquetter des interfaces utilisateur

- Design System complete with CSS variables, reusable components
- Responsive mockups with 3 breakpoints
- Design tokens (9 colors, 3 shadows, 2 fonts, spacings, border-radius)

### Competence 1.3 — Réaliser des interfaces utilisateur statiques

- Semantic HTML5 with ARIA landmarks on all pages
- RGAA/WCAG 15 rules applied (contrast, skip link, aria, focus, labels, heading hierarchy)
- Mobile-first responsive design
- Eco-design: minified CSS, no JS framework, `loading="lazy"`, Google Fonts preconnect
- Design System documented in styleguide.html
- Technical SEO (meta tags, Open Graph, unique titles, lang="fr")
- Contrast validated for all color pairs
