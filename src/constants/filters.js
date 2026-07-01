/**
 * Filter Constants
 *
 * Purpose:
 * --------
 * Centralizes all magic numbers used in recipe filtering.
 * Prevents hardcoded values scattered across the codebase.
 *
 * Usage:
 * ------
 * const { FILTERS } = require('../constants/filters');
 * findAllWithFilters({ max_prep_time: FILTERS.QUICK_PREP_MAX })
 *
 * User story mapping:
 * - QUICK_PREP_MAX  → US-01: ready in less than 15 minutes
 * - BUDGET_LOW_MAX  → US-03: less than 3€ per portion
 * - BUDGET_MID_MAX  → US-03: less than 5€ per portion
 * - DEFAULT_LIMIT   → pagination default page size
 * - MAX_LIMIT       → pagination hard cap (prevents abuse)
 */

'use strict';

const FILTERS = {
    QUICK_PREP_MAX: 15,   // minutes — US-01
    BUDGET_LOW_MAX: 3,    // euros  — US-03
    BUDGET_MID_MAX: 5,    // euros  — US-03
    DEFAULT_LIMIT: 12,    // rows per page — grille de 3-4 colonnes, 3-4 lignes
    MAX_LIMIT: 100,       // hard cap — prevents client requesting 10000 rows
};

// Sort strategies — used by findAllWithFilters() ORDER BY logic
const SORT = {
    BY_DATE: 'created_at DESC',   // default — newest first
    BY_TIME: 'prep_time ASC',     // when filtering by prep time — fastest first
    BY_COST: 'cost_per_portion ASC', // when filtering by cost — cheapest first
    BY_RATING: 'average_rating DESC',  // when filtering by rating — best first
};

module.exports = { FILTERS, SORT };
