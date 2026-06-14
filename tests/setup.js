// tests/setup.js
//
// Global test setup and teardown.
// Loads test environment variables before any test runs.
// Closes the database pool after all tests complete.

'use strict';

// Load .env.test before anything else
// This must happen before any module that reads process.env
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.test') });