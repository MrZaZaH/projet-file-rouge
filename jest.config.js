/**
 * Jest Configuration for Ovni Culinaire Backend Tests
 * 
 * This configuration sets up Jest to:
 * - Run tests with a 10-second timeout (API/DB operations)
 * - Use Node environment (not jsdom)
 * - Load test setup before running tests
 * - Generate coverage reports
 * - Only look for test files in tests/ folder
 */

'use strict';

module.exports = {
    // Test environment: use Node.js (not browser/jsdom)
    testEnvironment: 'node',

    // Timeout for each test: 10 seconds (API and database operations can be slow)
    testTimeout: 10000,

    // Files to execute before running any test
    setupFiles: ['<rootDir>/tests/setup.js'],

    // Directory where Jest should look for test files
    testMatch: ['<rootDir>/tests/**/*.test.js'],

    // Generate coverage report in HTML and LCOV format
    collectCoverage: true,

    // Only collect coverage from these directories
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/database/connection.js', // Skip connection file (hard to test in isolation)
        '!src/config/**', // Skip config files
    ],

    // Coverage thresholds to maintain quality
    // We aim for 70%+ coverage across the board
    coverageThreshold: {
        global: {
            branches: 60,      // 60% of code branches must be tested
            functions: 70,     // 70% of functions must be tested
            lines: 70,         // 70% of code lines must be tested
            statements: 70,    // 70% of statements must be tested
        },
    },

    // Do not transform files (we're using vanilla Node.js, not ES6 modules)
    transform: {},

    // Verbose output: show each test as it runs
    verbose: true,

    // Clear mocks between tests to prevent test pollution
    clearMocks: true,
};
