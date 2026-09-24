'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { applyRules } = require('../allocation/rules.js');

test('a reservation with no room assigned yet is always flagged, even with nothing else notable', () => {
  // This is the case Room Allocation Assistance exists for — it must never
  // score zero reasons and silently disappear from the attention list.
  const { tier, reasons } = applyRules({ needsRoom: true, adults: 1, children: 0 });
  assert.equal(tier, 'medium');
  assert.ok(reasons.some(r => /No room assigned yet/.test(r.text)));
});

test('a plain reservation with a room and nothing notable gets no tier', () => {
  const { tier, reasons } = applyRules({ vip: '', memberLevel: '', linked: '', adults: 2, children: 0, balance: '', needsRoom: false });
  assert.equal(tier, null);
  assert.deepEqual(reasons, []);
});

test('VIP alone is a hard rule -> HIGH, with an explainable reason', () => {
  const { tier, reasons } = applyRules({ vip: 'VIP1', adults: 1, children: 0 });
  assert.equal(tier, 'high');
  assert.equal(reasons.length, 1);
  assert.match(reasons[0].text, /^VIP \(VIP1\)$/);
});

test('one soft rule alone is MEDIUM, not HIGH', () => {
  const { tier } = applyRules({ memberLevel: 'Gold', adults: 1, children: 0 });
  assert.equal(tier, 'medium');
});

test('two soft rules together escalate to HIGH, and both reasons are explainable', () => {
  const { tier, reasons } = applyRules({ linked: 'Smith Family', adults: 4, children: 2 });
  assert.equal(tier, 'high');
  const texts = reasons.map(r => r.text);
  assert.ok(texts.some(t => /Linked/.test(t)));
  assert.ok(texts.some(t => /Large party/.test(t)));
});

test('the reason text matches the product spec\'s explainable format, not a bare score', () => {
  const { reasons } = applyRules({ vip: 'VIP1', eta: '10:30', adults: 1, children: 0 });
  reasons.forEach(r => {
    assert.equal(typeof r.text, 'string');
    assert.ok(!/^\d+$/.test(r.text), 'reason must not be a bare number');
  });
});

test('early arrival only fires before the configured hour, and carries the actual time', () => {
  const early = applyRules({ eta: '09:00', adults: 1, children: 0 });
  const late = applyRules({ eta: '16:00', adults: 1, children: 0 });
  assert.equal(early.tier, 'medium');
  assert.match(early.reasons[0].text, /09:00/);
  assert.equal(late.tier, null);
});

test('a nonzero balance fires the balance rule; a zero or blank balance does not', () => {
  assert.equal(applyRules({ balance: '150.00', adults: 1, children: 0 }).tier, 'medium');
  assert.equal(applyRules({ balance: '0.00', adults: 1, children: 0 }).tier, null);
  assert.equal(applyRules({ balance: '', adults: 1, children: 0 }).tier, null);
});

test('an alert-flagged room is a hard rule regardless of anything else', () => {
  const ctx = { alertSignals: new Map([['1041', new Set(['Out of order'])]]) };
  const { tier, reasons } = applyRules({ room: '1041', adults: 1, children: 0 }, ctx);
  assert.equal(tier, 'high');
  assert.match(reasons[0].text, /flagged in alerts report/);
});

test('a special occasion found in the arrival report is a hard rule', () => {
  const ctx = { arrivalSignals: new Map([['1041', new Set(['Honeymoon'])]]) };
  const { tier, reasons } = applyRules({ room: '1041', adults: 2, children: 0 }, ctx);
  assert.equal(tier, 'high');
  assert.match(reasons[0].text, /Honeymoon/);
});

test('missing ctx does not throw for rules that read it', () => {
  assert.doesNotThrow(() => applyRules({ room: '1041', adults: 1, children: 0 }));
  assert.doesNotThrow(() => applyRules({ room: '1041', adults: 1, children: 0 }, {}));
});
