'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { extractRequirements, compareRoom } = require('../allocation/compare.js');

const KGA_SEA_CONNECTING = { room: '3132', type: 'KGAOV', description: 'Deluxe King View', connecting: '3134', codes: ['COS'], floor: '5F' };
const KGA_GARDEN_NO_CONNECT = { room: '3124', type: 'KGA', description: 'Deluxe King Garden', connecting: null, codes: ['GRD'], floor: 'GF' };

test('extractRequirements pulls type, view, floor and connecting from arrival signals', () => {
  const record = { room: '3132', roomType: 'KGAOV' };
  const ctx = { arrivalSignals: new Map([['3132', new Set(['View: Sea view (COS)', 'Floor: High floor requested', 'Connecting room requested', 'Anniversary'])]]) };
  const req = extractRequirements(record, ctx);
  assert.equal(req.roomType, 'KGAOV');
  assert.equal(req.viewCode, 'COS');
  assert.equal(req.connecting, true);
  assert.equal(req.floorPreference, 'High floor requested');
  assert.deepEqual(req.occasions, ['Anniversary']);
});

test('spec example: correct type + sea view + connecting, high floor not satisfied -> COMPROMISE', () => {
  const req = { roomType: 'KGAOV', viewCode: 'COS', viewLabel: 'Sea view', floorPreference: 'High floor requested', connecting: true, occasions: [] };
  const lowFloorButConnecting = Object.assign({}, KGA_SEA_CONNECTING, { floor: '1F' });
  const { checks, verdict, reason } = compareRoom(req, lowFloorButConnecting);
  assert.equal(verdict, 'COMPROMISE');
  assert.ok(checks.find(c => c.label.includes('Correct room type')).status === 'pass');
  assert.ok(checks.find(c => c.label === 'Sea view').status === 'pass');
  assert.ok(checks.find(c => c.label.includes('Connecting room')).status === 'pass');
  assert.ok(checks.find(c => c.status === 'warn' && c.label.includes('floor')));
  assert.match(reason, /floor/);
});

test('spec example: no connecting room when required -> CONFLICT', () => {
  const req = { roomType: 'KGA', viewCode: null, floorPreference: null, connecting: true, occasions: [] };
  const { verdict, reason } = compareRoom(req, KGA_GARDEN_NO_CONNECT);
  assert.equal(verdict, 'CONFLICT');
  assert.match(reason, /not satisfied/);
});

test('wrong room type entirely is a CONFLICT, not a compromise', () => {
  const req = { roomType: 'SXA', viewCode: null, floorPreference: null, connecting: false, occasions: [] };
  const { verdict, checks } = compareRoom(req, KGA_GARDEN_NO_CONNECT);
  assert.equal(verdict, 'CONFLICT');
  assert.equal(checks[0].status, 'fail');
});

test('the ocean-view variant of the booked base type is a compromise, not a hard fail', () => {
  const req = { roomType: 'KGA', viewCode: null, floorPreference: null, connecting: false, occasions: [] };
  const { verdict, checks } = compareRoom(req, KGA_SEA_CONNECTING); // booked KGA, room is KGAOV
  assert.equal(verdict, 'COMPROMISE');
  assert.equal(checks[0].status, 'warn');
});

test('a room that fully matches with no requirements is MATCH', () => {
  const req = { roomType: 'KGA', viewCode: null, floorPreference: null, connecting: false, occasions: [] };
  const { verdict } = compareRoom(req, { room: '1050', type: 'KGA', description: 'x', connecting: null, codes: [], floor: '1F' });
  assert.equal(verdict, 'MATCH');
});

test('a room not found in Room Guide is reported as unknown, never silently treated as a match', () => {
  const req = { roomType: 'KGA', connecting: false, occasions: [] };
  const { verdict, reason } = compareRoom(req, null);
  assert.equal(verdict, 'UNKNOWN');
  assert.match(reason, /Room Guide/);
});

test('no requirements at all still returns a clean MATCH, not an empty crash', () => {
  const req = { roomType: null, viewCode: null, floorPreference: null, connecting: false, occasions: [] };
  const { verdict, checks } = compareRoom(req, KGA_GARDEN_NO_CONNECT);
  assert.equal(verdict, 'MATCH');
  assert.equal(checks.length, 0);
});
