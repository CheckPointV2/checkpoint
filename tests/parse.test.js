'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeArrivals, validateArrivals, extractArrivalSignals, extractAlertSignals } = require('../allocation/parse.js');

test('normalizeArrivals maps a variety of real-looking header spellings', () => {
  const rows = [
    { 'Confirmation Number': 'C001', 'Room': '1041', 'Name': 'A Guest', 'Room Type': 'KGA', 'VIP Code': 'VIP1', Adults: '2', Children: '1' },
    { 'Conf': 'C002', 'Room No': '2205', 'Guest Name': 'B Guest', 'Room Type': 'KGAOV' }
  ];
  const out = normalizeArrivals(rows);
  assert.equal(out.length, 2);
  assert.equal(out[0].room, '1041');
  assert.equal(out[0].vip, 'VIP1');
  assert.equal(out[0].adults, 2);
  assert.equal(out[0].children, 1);
  assert.equal(out[1].room, '2205');
  assert.equal(out[1].name, 'B Guest');
});

test('normalizeArrivals drops completely empty rows and never crashes on missing columns', () => {
  const out = normalizeArrivals([{ Room: '', Name: '' }, {}, { Room: '1041' }]);
  assert.equal(out.length, 1);
  assert.equal(out[0].room, '1041');
});

test('normalizeArrivals handles a non-array or empty input safely', () => {
  assert.deepEqual(normalizeArrivals([]), []);
  assert.deepEqual(normalizeArrivals(null), []);
  assert.deepEqual(normalizeArrivals(undefined), []);
});

test('validateArrivals keeps a record with no room yet and flags it, rather than dropping it', () => {
  const { valid, warnings } = validateArrivals([{ room: '', name: 'Needs A Room', roomType: 'KGA' }]);
  assert.equal(valid.length, 1);
  assert.equal(valid[0].needsRoom, true);
  assert.ok(warnings.some(w => /no room assigned yet/.test(w)));
});

test('validateArrivals excludes a garbage room number, loudly', () => {
  const { valid, warnings } = validateArrivals([{ room: 'ABCD', name: 'Bad Data' }]);
  assert.equal(valid.length, 0);
  assert.ok(warnings.some(w => /not a valid 4-digit room number/.test(w)));
});

test('validateArrivals excludes a record with no name at all', () => {
  const { valid, warnings } = validateArrivals([{ room: '1041', name: '' }]);
  assert.equal(valid.length, 0);
  assert.ok(warnings.some(w => /no guest name/.test(w)));
});

test('validateArrivals flags a duplicate confirmation number', () => {
  const { warnings } = validateArrivals([
    { room: '1041', name: 'A', conf: 'C001' },
    { room: '2205', name: 'B', conf: 'C001' }
  ]);
  assert.ok(warnings.some(w => /appears more than once/.test(w)));
});

test('validateArrivals flags the same room assigned to two different reservations', () => {
  const { warnings } = validateArrivals([
    { room: '1041', name: 'A', conf: 'C001' },
    { room: '1041', name: 'B', conf: 'C002' }
  ]);
  assert.ok(warnings.some(w => /assigned to more than one reservation/.test(w)));
});

test('validateArrivals does not flag the same room appearing twice for the SAME confirmation', () => {
  const { warnings } = validateArrivals([
    { room: '1041', name: 'A', conf: 'C001' },
    { room: '1041', name: 'A', conf: 'C001' }
  ]);
  assert.ok(!warnings.some(w => /assigned to more than one reservation/.test(w)));
});

test('extractArrivalSignals finds a special occasion near a room number', () => {
  const text = 'Guest in room 1041 celebrating their HONEYMOON this week, please prepare amenity.';
  const signals = extractArrivalSignals(text);
  assert.ok(signals.get('1041'));
  assert.ok([...signals.get('1041')].includes('Honeymoon'));
});

test('extractArrivalSignals does not attach a keyword to a room far away in the text', () => {
  const text = 'Room 1041 standard arrival. '.padEnd(500, '. ') + 'Room 2205 is a HONEYMOON booking.';
  const signals = extractArrivalSignals(text);
  assert.ok(!signals.get('1041'));
  assert.ok(signals.get('2205'));
});

test('extractAlertSignals flags an out-of-order room', () => {
  const text = 'Room 3040 is OUT OF ORDER due to plumbing issue.';
  const signals = extractAlertSignals(text);
  assert.ok([...signals.get('3040')].includes('Out of order'));
});

test('extraction functions handle empty text without throwing', () => {
  assert.equal(extractArrivalSignals('').size, 0);
  assert.equal(extractAlertSignals(undefined).size, 0);
});
