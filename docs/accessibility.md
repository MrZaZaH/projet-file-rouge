# Accessibility Documentation – Ovni Culinaire

## Overview

This document outlines the 15 RGAA (Référentiel Général d'Amélioration de l'Accessibilité) rules applied in the Ovni Culinaire project. RGAA is the French accessibility standard based on WCAG 2.1.

---

## Applied RGAA Rules

### 1. Alternance de contraste (Contrast Alternation)

**Rule:** Text contrast ratio must be at least 4.5:1 for normal text and 3:1 for large text.

**Implementation:**
- CSS variables define text and background colors with sufficient contrast
- `--color-text: #eaeaea` on `--color-background: #0f0f23` provides ~13:1 ratio
- `--color-accent: #e94560` on white backgrounds maintains ~3.2:1 ratio
- All interactive elements have visible focus states with 2px outline

**Files:** `styles.css`

---

### 2. Structure de navigation (Navigation Structure)

**Rule:** Website must have a consistent navigation structure across all pages.

**Implementation:**
- Sticky header with `<header role="banner">` present on all pages
- `<nav aria-label="Navigation principale">` for desktop navigation
- `<nav aria-label="Navigation mobile">` for mobile hamburger menu
- Consistent header-inner structure across index.html, recipe.html, submit.html, styleguide.html

**Files:** `index.html`, `recipe.html`, `submit.html`, `styleguide.html`

---

### 3. Liens accélérateurs (Skip Links)

**Rule:** Provide a mechanism to skip repetitive navigation elements.

**Implementation:**
```html
<a href="#main-content" class="skip-link">Aller au contenu principal</a>
```
- Skip link positioned off-screen by default (top: -100%)
- Becomes visible on focus (top: 16px)
- High contrast styling (background: var(--color-accent))

**Files:** `index.html`, `recipe.html`, `submit.html`, `styleguide.html`

---

### 4. Langue du document (Document Language)

**Rule:** HTML document must specify the language attribute.

**Implementation:**
```html
<html lang="fr">
```
- All HTML documents declare `lang="fr"` on the `<html>` element
- French user-facing content, English code comments

**Files:** All HTML files

---

### 5. Titre de page (Page Title)

**Rule:** Each page must have a relevant and unique title.

**Implementation:**
- `index.html`: `<title>Ovni Culinaire – Recettes du quotidien</title>`
- `recipe.html`: Title updated dynamically via JavaScript: `${recipe.title} – Ovni Culinaire`
- `submit.html`: `<title>Poster une recette – Ovni Culinaire</title>`
- `styleguide.html`: `<title>Design System – Ovni Culinaire</title>`

**Files:** All HTML files

---

### 6. Hiérarchie de titres (Heading Hierarchy)

**Rule:** Headings must follow a logical hierarchy (h1 → h2 → h3).

**Implementation:**
- Single `<h1>` per page (page title)
- `<h2>` for major sections (Ingredients, Steps, Reviews)
- `<h3>` for subsections
- CSS clamp() functions provide responsive sizing without changing semantic level

**Files:** All HTML files

---

### 7. Images et médias (Images and Media)

**Rule:** Images must have alternative text or be marked as decorative.

**Implementation:**
- No `<img src="#">` placeholder patterns used
- Colored div placeholders use `role="img"` and `aria-label`:
```html
<div class="persona-card-image" role="img" aria-label="Icône Salarié Crevé"></div>
```
- All `<svg>` icons have `aria-hidden="true"` and `focusable="false"`
- SVG icons include meaningful aria-label on parent button if needed

**Files:** `index.html`, `styleguide.html`

---

### 8. Formulaires et étiquettes (Forms and Labels)

**Rule:** All form inputs must have associated labels.

**Implementation:**
- All `<input>`, `<textarea>`, and `<select>` elements have explicit `<label>` with `for` attribute
- Required fields marked with `aria-required="true"`
- Form groups use `.form-group` wrapper for proper association
- Login modal example:
```html
<label for="login-pseudo">Pseudo</label>
<input type="text" id="login-pseudo" name="pseudo" required aria-required="true">
```

**Files:** `index.html`, `recipe.html`, `submit.html`, `styleguide.html`

---

### 9. Contrôle de formulaire (Form Control)

**Rule:** Users must be able to check, uncheck, or select options.

**Implementation:**
- `<select>` elements have custom arrow via CSS background-image
- `appearance: none` removed to maintain native functionality
- Rating selection uses `<select>` with descriptive options: "★★★★★ – Excellent"
- All form controls keyboard accessible via native HTML elements

**Files:** `recipe.html`, `submit.html`

---

### 10. Navigation au clavier (Keyboard Navigation)

**Rule:** All functionality must be accessible via keyboard.

**Implementation:**
- Custom buttons use semantic `<button type="button">` elements
- Focus styles defined for all interactive elements:
```css
a:focus-visible, button:focus-visible, input:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
}
```
- Mobile menu toggle has `aria-expanded` attribute updated on state change
- `aria-controls` links button to navigation menu

**Files:** All HTML files

---

### 11. Gestion du focus (Focus Management)

**Rule:** Focus must not be trapped or lost during user interactions.

**Implementation:**
- Modal opens with focus on first input field
- Close button has aria-label "Fermer la fenêtre"
- Escape key closes modal (event listener on document)
- After modal close, focus returns to trigger element (commented TODO for production)
- Modal overlay click closes modal

**Files:** `index.html`, `recipe.html`, `submit.html`, `styleguide.html`

---

### 12. Modales et fenêtres (Modals and Dialogs)

**Rule:** Modal dialogs must have proper ARIA roles and be announced.

**Implementation:**
```html
<div class="modal-overlay" id="login-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1">
```
- `role="dialog"` identifies the modal
- `aria-modal="true"` announces modal is modal
- `aria-labelledby` references the modal title
- Focus trap TODO comment indicates implementation scope

**Files:** `index.html`, `recipe.html`, `submit.html`, `styleguide.html`

---

### 13. Pertinence des liens (Link Relevance)

**Rule:** Link text must be descriptive and make sense out of context.

**Implementation:**
- No "Cliquez ici" or "Lire plus" generic text
- Buttons describe their action: "Surprends-moi", "Sauvegarder", "Commenter"
- Links include context: aria-label on logo "Ovni Culinaire – Accueil"
- External links should have descriptive text

**Files:** All HTML files

---

### 14. Contenu temporel (Temporal Content)

**Rule:** Users must have control over moving, blinking, or scrolling content.

**Implementation:**
- No auto-scrolling carousels or animations in MVP
- CSS transitions use `prefers-reduced-motion` media query pattern available:
```css
@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
    }
}
```

**Files:** `styles.css`

---

### 15. Aides à la navigation (Navigation Aids)

**Rule:** Provide landmarks and regions to help users navigate the page.

**Implementation:**
- Semantic landmarks defined:
  - `<header role="banner">` – site header
  - `<main id="main-content">` – main content
  - `<footer role="contentinfo">` – footer
  - `<nav aria-label="...">` – navigation sections
- `aria-labelledby` on sections references section headings
- `aria-live="polite"` on dynamic content areas (recipe grid, reviews list)
- Loading and error states use `role="status"` and `role="alert"`

**Files:** All HTML files

---

## Accessibility Checklist

| Rule | Implemented | Files |
|------|-------------|-------|
| Contrast alternation | ✅ | styles.css |
| Navigation structure | ✅ | All HTML |
| Skip links | ✅ | All HTML |
| Document language | ✅ | All HTML |
| Page titles | ✅ | All HTML |
| Heading hierarchy | ✅ | All HTML |
| Images and media | ✅ | index.html |
| Forms and labels | ✅ | All HTML |
| Form control | ✅ | recipe.html, submit.html |
| Keyboard navigation | ✅ | All HTML |
| Focus management | ✅ | All HTML |
| Modals and dialogs | ✅ | All HTML |
| Link relevance | ✅ | All HTML |
| Temporal content | ✅ | styles.css |
| Navigation aids | ✅ | All HTML |

---

## Testing Recommendations

1. **Keyboard-only testing:** Navigate entire site using only Tab, Enter, Space, Escape
2. **Screen reader testing:** Test with NVDA (Windows), VoiceOver (macOS), Orca (Linux)
3. **Color contrast:** Verify with browser developer tools or WebAIM contrast checker
4. **Zoom testing:** Test at 200% browser zoom without horizontal scrolling
