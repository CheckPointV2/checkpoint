'use strict';
// Guards the Room Guide's Old / New data (roomguide/data.js). If a future
// matrix update changes these numbers on purpose, update them here too.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'roomguide', 'data.js'), 'utf8'), ctx);
const D = ctx.window.RBAB_DATA;
const rooms = Object.values(D.buildings).flatMap((b) => Object.values(b.rooms));
const byNum = Object.fromEntries(rooms.map((r) => [String(r.room), r]));
const count = (list, key) => list.reduce((m, r) => { const k = key(r); m[k] = (m[k] || 0) + 1; return m; }, {});
const oldType = (r) => r.prevType || r.type;

test('715 rooms in 3 buildings', () => {
  assert.equal(rooms.length, 715);
  assert.deepEqual([...D.buildingOrder], ['zumroud', 'amwaj', 'marmar']);
});

test('Old view counts are the current room types', () => {
  assert.deepEqual(count(rooms, oldType), {
    KGA: 224, TWA: 94, KGAOV: 53, TWAOV: 32, KGE: 92, KGEOV: 54,
    SKA: 17, SKB: 77, SKC: 25, SKD: 9, SKP: 14, SXA: 11, PI: 13,
  });
});

test('New view counts match the RN Changed tab (OPERA NEW)', () => {
  assert.deepEqual(count(rooms, (r) => r.type), {
    DBA: 66, KGA: 175, KGAOV: 59, KGE: 172, KGEOV: 77,
    SKA: 17, SKB: 73, SKC: 29, SKD: 9, SKP: 14, SXA: 11, PI: 13,
  });
  assert.ok(!rooms.some((r) => r.type === 'TWA' || r.type === 'TWAOV'), 'TWA / TWAOV must not exist in the New view');
});

test('bed type only on DBA / KGA / KGAOV, from the old code (TWA/TWAOV = Twin, KGA/KGAOV = King)', () => {
  const withBed = rooms.filter((r) => r.bed);
  assert.ok(withBed.every((r) => ['DBA', 'KGA', 'KGAOV'].includes(r.type)));
  assert.ok(rooms.filter((r) => ['DBA', 'KGA', 'KGAOV'].includes(r.type)).every((r) => r.bed === 'King' || r.bed === 'Twin'));
  assert.deepEqual(count(withBed, (r) => `${r.type} ${r.bed}`), {
    'DBA King': 36, 'DBA Twin': 30, 'KGA King': 116, 'KGA Twin': 59, 'KGAOV King': 31, 'KGAOV Twin': 28,
  });
  // spot checks
  assert.equal(byNum['2003'].bed, 'Twin');   // TWA -> DBA
  assert.equal(byNum['2050'].bed, 'King');   // KGA -> DBA
  assert.equal(byNum['1019'].bed, 'Twin');   // TWA -> KGA
  // confirmed by the owner (RN tab and old data disagreed)
  for (const n of ['3249', '3252', '3260', '3350']) assert.equal(byNum[n].bed, 'King', n);
  for (const n of ['3263', '3349']) assert.equal(byNum[n].bed, 'Twin', n);
});

test('New view interconnecting: 18 configured pairs (D3A 4, D3B 9, D3C 5), listed both ways', () => {
  const ic = rooms.filter((r) => r.connectingNew != null);
  assert.equal(ic.length, 36);
  for (const r of ic) {
    const o = byNum[String(r.connectingNew)];
    assert.equal(o.connectingNew, r.room, `pair ${r.room}/${r.connectingNew}`);
    assert.equal(o.icCodeNew, r.icCodeNew);
  }
  assert.deepEqual(count(ic, (r) => r.icCodeNew), { D3A: 8, D3B: 18, D3C: 10 });
  assert.equal(byNum['2157'].connectingNew, 2158);
  assert.equal(byNum['2157'].icCodeNew, 'D3B');
});

test('removed pairs are kept as physical-only (PHY); the Old view keeps all 63 pairs', () => {
  const oldPairs = rooms.filter((r) => r.connecting != null);
  assert.equal(oldPairs.length, 126);
  const phys = rooms.filter((r) => r.physicalNew != null);
  assert.equal(phys.length, 106);
  for (const r of phys) {
    assert.equal(r.connectingNew, null, `${r.room} cannot be both configured and physical-only`);
    assert.equal(byNum[String(r.physicalNew)].physicalNew, r.room);
  }
  assert.equal(byNum['1018'].physicalNew, 1019);
});

test('Posting Interface rooms are untouched', () => {
  for (const r of rooms.filter((x) => x.type === 'PI')) {
    assert.equal(r.prevType, undefined);
    assert.equal(r.bed, undefined);
  }
});
