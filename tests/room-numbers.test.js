'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadWindow } = require('./dom-shim.js');

const win = loadWindow(['departures/js/store.js']);
const { allRoomNumbers, building, sortRooms, groupByBuilding, parseBalance, toMinutes, fromMinutes } = win.CP;

test('extracts every 4-digit room number from free text', () => {
  assert.deepEqual(allRoomNumbers('Housekeeping notes: rooms 1041, 2205 and 3040 need turndown.'), ['1041', '2205', '3040']);
});

test('ignores a 4-digit number glued to a time or date (12:05, 12/05), only the bare room number', () => {
  // This is the generic extractor (also used by Room Lists on arbitrary
  // pasted text) — it deliberately only excludes syntactic time/date
  // adjacency, not "is this semantically a year". A bare number like a
  // report's year still matches here; daylist.js's own PDF scanner is where
  // year-exclusion actually belongs, and has its own coverage for that.
  assert.deepEqual(allRoomNumbers('checkout at 12:05 on 12/05, room 1041 only'), ['1041']);
});

test('building() maps the first digit to the right building', () => {
  assert.equal(building('1041'), 'Zumroud');
  assert.equal(building('2205'), 'Amwaj');
  assert.equal(building('3040'), 'Marmar');
  assert.equal(building('9999'), 'Other');
});

test('sortRooms sorts numerically, not lexically', () => {
  assert.deepEqual(sortRooms(['1041', '1005', '1200', '999']), ['999', '1005', '1041', '1200']);
});

test('groupByBuilding splits and sorts within each group', () => {
  const g = groupByBuilding(['2205', '1041', '3040', '1005']);
  assert.deepEqual(g.Zumroud, ['1005', '1041']);
  assert.deepEqual(g.Amwaj, ['2205']);
  assert.deepEqual(g.Marmar, ['3040']);
});

test('parseBalance handles negatives, CR, commas and blanks honestly', () => {
  assert.equal(parseBalance('150.00'), 150);
  assert.equal(parseBalance('-45.00'), -45);
  assert.equal(parseBalance('1,250.50'), 1250.5);
  assert.equal(parseBalance('45.00 CR'), -45);
  assert.equal(parseBalance(''), 0);
  assert.equal(parseBalance(null), 0);
});

test('toMinutes/fromMinutes round-trip and reject garbage rather than guessing', () => {
  assert.equal(toMinutes('12:04'), 724);
  assert.equal(fromMinutes(724), '12:04');
  assert.equal(toMinutes('not a time'), null);
  assert.equal(toMinutes('25:99'), null);
});
