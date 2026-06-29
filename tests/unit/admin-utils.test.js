/**
 * Standalone unit tests for admin utility functions
 * (escapeHtml, escapeAttr, admin role check)
 *
 * Run with: node tests/unit/admin-utils.test.js
 * Zero dependencies — uses Node.js built-in assert module.
 * Not using Jest/supertest (too slow, per user request).
 */

'use strict';

const assert = require('assert');

// ======================================================================
// Functions under test (mirror implementations from moderation-panel.js)
// ======================================================================

function escapeHtml(str) {
    if (!str) return '';
    var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return str.replace(/[&<>"']/g, function(m) { return map[m]; });
}

function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function isAdmin(user) {
    return !!user && user.role === 'admin';
}

// ======================================================================
// Test runner
// ======================================================================

var total = 0;
var passed = 0;

function test(name, fn) {
    total++;
    try {
        fn();
        passed++;
        console.log('  \u2713 PASS:', name);
    } catch (e) {
        console.error('  \u2717 FAIL:', name);
        console.error('       ', e.message);
    }
}

// ======================================================================
// escapeHtml tests
// ======================================================================

console.log('\n--- escapeHtml ---');

test('returns empty string for null', function() {
    assert.strictEqual(escapeHtml(null), '');
});

test('returns empty string for undefined', function() {
    assert.strictEqual(escapeHtml(undefined), '');
});

test('returns empty string for empty input', function() {
    assert.strictEqual(escapeHtml(''), '');
});

test('escapes <script> tag', function() {
    var result = escapeHtml('<script>alert("xss")</script>');
    assert.strictEqual(result.indexOf('<script>'), -1);
    assert.strictEqual(result.indexOf('&lt;script&gt;') >= 0, true);
});

test('escapes ampersand', function() {
    assert.strictEqual(escapeHtml('a & b'), 'a &amp; b');
});

test('escapes double quotes', function() {
    assert.strictEqual(escapeHtml('say "hello"'), 'say &quot;hello&quot;');
});

test('escapes single quotes', function() {
    assert.strictEqual(escapeHtml("it's"), 'it&#39;s');
});

test('escapes all HTML special chars together', function() {
    assert.strictEqual(
        escapeHtml('<a href="test" title=\'x\'> &'),
        '&lt;a href=&quot;test&quot; title=&#39;x&#39;&gt; &amp;'
    );
});

test('preserves normal text unchanged', function() {
    assert.strictEqual(escapeHtml('hello world'), 'hello world');
});

test('preserves numbers unchanged', function() {
    assert.strictEqual(escapeHtml('42'), '42');
});

test('preserves French characters', function() {
    assert.strictEqual(escapeHtml('Pâté en croûte'), 'Pâté en croûte');
});

// ======================================================================
// escapeAttr tests
// ======================================================================

console.log('\n--- escapeAttr ---');

test('returns empty string for null', function() {
    assert.strictEqual(escapeAttr(null), '');
});

test('returns empty string for empty input', function() {
    assert.strictEqual(escapeAttr(''), '');
});

test('escapes double quotes in attribute value', function() {
    assert.strictEqual(escapeAttr('title "test"'), 'title &quot;test&quot;');
});

test('escapes single quotes in attribute value', function() {
    assert.strictEqual(escapeAttr("title 'test'"), "title &#39;test&#39;");
});

test('preserves normal text unchanged', function() {
    assert.strictEqual(escapeAttr('hello world'), 'hello world');
});

test('handles mixed quotes', function() {
    var result = escapeAttr('say "hello" then \'world\'');
    assert.strictEqual(result.indexOf('&quot;') >= 0, true);
    assert.strictEqual(result.indexOf('&#39;') >= 0, true);
});

// ======================================================================
// isAdmin tests
// ======================================================================

console.log('\n--- isAdmin (role check) ---');

test('returns true for user with role admin', function() {
    assert.strictEqual(isAdmin({ id: 1, role: 'admin', username: 'test' }), true);
});

test('returns false for user with role user', function() {
    assert.strictEqual(isAdmin({ id: 2, role: 'user', username: 'test' }), false);
});

test('returns false for null user', function() {
    assert.strictEqual(isAdmin(null), false);
});

test('returns false for undefined user', function() {
    assert.strictEqual(isAdmin(undefined), false);
});

test('returns false for user without role property', function() {
    assert.strictEqual(isAdmin({ id: 3, username: 'test' }), false);
});

test('returns false for empty object', function() {
    assert.strictEqual(isAdmin({}), false);
});

test('returns false for user with role in different case', function() {
    assert.strictEqual(isAdmin({ role: 'Admin' }), false);
    assert.strictEqual(isAdmin({ role: 'ADMIN' }), false);
});

// ======================================================================
// Summary
// ======================================================================

console.log('\n======================');
console.log('Results: ' + passed + '/' + total + ' passed');
if (passed === total) {
    console.log('All tests passed.');
} else {
    console.log((total - passed) + ' test(s) FAILED.');
    process.exitCode = 1;
}
