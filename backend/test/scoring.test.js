const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computeScore } = require('../scoring');

const questions = [
    { id: 1, correct_answer: 'A' },
    { id: 2, correct_answer: 'B' },
    { id: 3, correct_answer: 'C' },
];

test('computeScore: counts correct, wrong and skipped separately', () => {
    const result = computeScore({ 1: 'A', 2: 'D', 3: undefined }, questions);
    assert.equal(result.correct, 1);
    assert.equal(result.wrong, 1);
    assert.equal(result.skipped, 1);
    assert.equal(result.total, 3);
    assert.equal(result.score, 1);
});

test('computeScore: all correct', () => {
    const result = computeScore({ 1: 'A', 2: 'B', 3: 'C' }, questions);
    assert.equal(result.correct, 3);
    assert.equal(result.wrong, 0);
    assert.equal(result.skipped, 0);
});

test('computeScore: no answers given at all -- everything skipped', () => {
    const result = computeScore({}, questions);
    assert.equal(result.correct, 0);
    assert.equal(result.wrong, 0);
    assert.equal(result.skipped, 3);
});

test('computeScore: empty question set', () => {
    const result = computeScore({}, []);
    assert.deepEqual(result, { correct: 0, wrong: 0, skipped: 0, total: 0, score: 0 });
});
