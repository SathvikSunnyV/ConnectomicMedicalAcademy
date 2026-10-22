const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizePhone, normalizeEmail } = require('../normalize');

test('normalizePhone: bare 10-digit number assumes Indian mobile', () => {
    assert.equal(normalizePhone('9876543210'), '+919876543210');
});

test('normalizePhone: already-E.164 numbers pass through unchanged', () => {
    assert.equal(normalizePhone('+919876543210'), '+919876543210');
});

test('normalizePhone: strips spaces, dashes and parentheses before parsing', () => {
    assert.equal(normalizePhone('(987) 654-3210'), '+919876543210');
});

test('normalizePhone: drops a leading trunk 0', () => {
    assert.equal(normalizePhone('09876543210'), '+919876543210');
});

test('normalizePhone: 11-15 digit number missing "+" gets it prefixed', () => {
    assert.equal(normalizePhone('14155552671'), '+14155552671');
});

test('normalizePhone: null/empty input returns null', () => {
    assert.equal(normalizePhone(''), null);
    assert.equal(normalizePhone(null), null);
});

test('normalizeEmail: lowercases and trims', () => {
    assert.equal(normalizeEmail('  Student@Example.COM  '), 'student@example.com');
});

test('normalizeEmail: null/empty input returns null', () => {
    assert.equal(normalizeEmail(''), null);
    assert.equal(normalizeEmail(null), null);
});
