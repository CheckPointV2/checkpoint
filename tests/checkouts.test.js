'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadWindow } = require('./dom-shim.js');

const win = loadWindow(['departures/js/store.js', 'departures/js/checkouts.js']);
const extract = win.CP.extractCheckouts;

// Every variation the product spec explicitly requires must be recognized.
test('recognizes every required checkout phrasing', () => {
  const cases = [
    ['1234 Check out', ['1234']],
    ['1234 Checkout', ['1234']],
    ['1234 Checked out', ['1234']],
    ['1234 Vacant', ['1234']],
    ['1234 CO', ['1234']],
    ['1234 C Out', ['1234']],
    ['1234 c/out', ['1234']],
    ['1234 c/o', ['1234']],
    ['1234 chk out', ['1234']],
    ['1234 vd', ['1234']],
  ];
  for (const [text, expected] of cases) {
    assert.deepEqual(extract(text), expected, `failed on: ${text}`);
  }
});

test('reads a real, messy multi-line WhatsApp message', () => {
  const text = `
    morning! quick update
    1141, 1414 co
    2255 and 2277 checked out just now
    3040 c/o
    thanks team
  `;
  assert.deepEqual(extract(text).sort(), ['1141', '1414', '2255', '2277', '3040'].sort());
});

test('does not fire on ordinary words that merely start with "co"', () => {
  assert.deepEqual(extract('1234 is a corner room with a nice cottage view'), []);
});

test('does not treat a bare 4-digit number as a checkout without a keyword', () => {
  assert.deepEqual(extract('the year 2024 was long, room 1234 total'), []);
});

test('duplicate mentions of the same room are both counted (caller dedupes for the unique list)', () => {
  assert.deepEqual(extract('1234 co, 1234 co again'), ['1234', '1234']);
});

test('a run of rooms sharing one keyword all count', () => {
  assert.deepEqual(extract('1141,1414,1500 checked out'), ['1141', '1414', '1500']);
});

test('empty and keyword-less text extracts nothing', () => {
  assert.deepEqual(extract(''), []);
  assert.deepEqual(extract('no rooms mentioned here at all'), []);
  assert.deepEqual(extract('1234 5678 9999'), []); // numbers with no checkout keyword
});
