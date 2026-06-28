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

### Not yet implemented

- **Images**: Recipe cards have a placeholder container; actual images will be added in a later iteration
- **Authentication**: Login/register frontend pages and token management are planned for Day 25
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
