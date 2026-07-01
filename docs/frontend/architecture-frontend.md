# OVNI Culinaire — Frontend Architecture

## Navigation & Filtering

### Characters as filters (core UX decision)

The three comic strip characters are the **only** filtering mechanism on the homepage. There are no standalone filter controls (chips, dropdowns, sliders) — each character represents a complete filter preset:

| Character | Filter logic | API query |
|-----------|-------------|-----------|
| Le maître des deadlines | Quick recipes | `?prep_time<=15` |
| Le virtuose du repas à 2€ | Cheap meals | `?cost<=5` |
| La chef d'orchestre familial | Fast & well rated | `?prep_time<=20&min_rating=4` |

**Why this choice:** The project brief defines three personas. Instead of abstract controls (dropdowns, sliders), we personify each filter as a character the user identifies with. This is both more engaging and more accessible — one click, no learning curve. It also avoids cluttering the UI with redundant controls.

**What this means for development:**
- No separate "filter by time" / "filter by budget" components
- Character cards are `role="button"` with `aria-pressed` state
- Active filter is visually distinct (dark background)
- Only one character can be active at a time (mutually exclusive)
- No active filter = all recipes displayed

### Surprise Me

The "Surprends-moi" button calls `GET /api/v1/recipes/random` and redirects to the recipe detail page. It works regardless of active filter — picks any recipe from the database.

### Images

Recipe images are **not yet implemented**. The recipe card includes a placeholder container ready for future image integration. When images are added, they will use:
- `loading="lazy"` for deferred loading
- Explicit `width` and `height` to prevent layout shifts
- `alt` text based on recipe title

## Page structure

- `index.html` — Homepage with hero, character filters, recipe grid, anecdote block
- `recipe.html` — Recipe detail page
- `submit.html` — Recipe submission form
- `styleguide.html` — Design system reference

## Routing

Single-page navigation is handled via vanilla JavaScript:
- URL parameters (`?id=xx`) for recipe detail
- `localStorage` for auth token and pseudo
- No client-side router — simple link navigation with dynamic content loading
