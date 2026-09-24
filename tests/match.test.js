'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { rankCandidates, baseType } = require('../allocation/match.js');

const ROOMS = [
  { room: '1041', type: 'KGA', description: 'Deluxe King Garden', connecting: '1042', codes: ['BAL'] },
  { room: '1042', type: 'KGA', description: 'Deluxe King Garden', connecting: '1041', codes: [] },
  { room: '1050', type: 'KGA', description: 'Deluxe King Garden', connecting: null, codes: ['GRD'] },
  { room: '2100', type: 'KGAOV', description: 'Deluxe King View', connecting: null, codes: ['COS'] },
  { room: '3001', type: 'SXA', description: 'King Suite', connecting: null, codes: [] }
];

test('baseType strips the OV (ocean view) suffix', () => {
  assert.equal(baseType('KGAOV'), 'KGA');
  assert.equal(baseType('KGA'), 'KGA');
});

test('ranks a free room above one still needing a physical check', () => {
  const idx = new Map([
    ['1041', { status: 'check', urgencyMins: 10 }],
    ['1050', { status: 'free', urgencyMins: null }]
  ]);
  const { candidates } = rankCandidates(ROOMS, 'KGA', idx);
  assert.equal(candidates[0].room, '1050'); // free beats check
});

test('among rooms still needing a check, the more overdue one ranks first', () => {
  const idx = new Map([
    ['1041', { status: 'check', urgencyMins: 5 }],
    ['1042', { status: 'check', urgencyMins: 90 }]
  ]);
  const { candidates } = rankCandidates(ROOMS, 'KGA', idx);
  assert.equal(candidates[0].room, '1042'); // more overdue first
  assert.equal(candidates[1].room, '1041');
});

test('a room not in the due-out import at all is "unknown", not assumed free', () => {
  const { candidates } = rankCandidates(ROOMS, 'KGA', new Map());
  candidates.forEach(c => assert.equal(c.status, 'unknown'));
});

test('warns when no room of the requested type is free or checking out today', () => {
  const idx = new Map([['1041', { status: 'later', urgencyMins: null }]]);
  const { warnings } = rankCandidates(ROOMS, 'KGA', idx);
  assert.ok(warnings.some(w => /no .*room is showing as free or checking out/i.test(w)));
});

test('warns clearly when the requested type does not exist at all', () => {
  const { warnings, candidates } = rankCandidates(ROOMS, 'ZZZ', new Map());
  assert.equal(candidates.length, 0);
  assert.ok(warnings.some(w => /No ZZZ rooms exist/.test(w)));
});

test('falls back to the same base type (sea-view variant) as an alternative when the exact type has none free', () => {
  const idx = new Map(); // nothing imported — everything "unknown", so exact KGA candidates still exist, just unknown status
  const { alternatives } = rankCandidates(ROOMS.filter(r => r.type !== 'KGA'), 'KGA', idx);
  assert.ok(alternatives.some(r => r.type === 'KGAOV'));
});

test('preferConnecting sorts a room whose connecting partner is also in the pool first', () => {
  const idx = new Map([
    ['1041', { status: 'free', urgencyMins: null }],
    ['1042', { status: 'free', urgencyMins: null }],
    ['1050', { status: 'free', urgencyMins: null }]
  ]);
  const { candidates } = rankCandidates(ROOMS, 'KGA', idx, { preferConnecting: true });
  assert.ok(['1041', '1042'].includes(candidates[0].room));
});

test('caps the candidate list at 5 even with more matches', () => {
  const many = Array.from({ length: 10 }, (_, i) => ({ room: String(1000 + i), type: 'KGA', description: 'x', connecting: null, codes: [] }));
  const { candidates, totalExactMatches } = rankCandidates(many, 'KGA', new Map());
  assert.equal(candidates.length, 5);
  assert.equal(totalExactMatches, 10);
});
