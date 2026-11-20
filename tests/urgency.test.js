'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadWindow } = require('./dom-shim.js');

const win = loadWindow(['departures/js/store.js', 'departures/js/departures.js']);
const { checkUrgency, checkSub } = win.CP.dep;
const { fromMinutes, nowMinutes } = win.CP;

// Every case is built relative to the real current time so the test is
// deterministic regardless of when it's run, rather than a hardcoded clock.
function etdMinutesAgo(mins) { return fromMinutes((nowMinutes() - mins + 1440) % 1440); }
function etdMinutesAhead(mins) { return fromMinutes((nowMinutes() + mins) % 1440); }

test('a room whose ETD already passed is overdue', () => {
  const r = { etd: etdMinutesAgo(90), roomType: 'KGA' };
  assert.equal(checkUrgency(r), 'overdue');
  assert.match(checkSub(r, 'check'), /^Late /);
});

test('a room due within the soon window (15 min) is flagged soon, not overdue', () => {
  const r = { etd: etdMinutesAhead(10) };
  assert.equal(checkUrgency(r), 'soon');
  assert.match(checkSub(r, 'check'), /^Due /);
});

test('a room due well in the future is neither overdue nor soon', () => {
  const r = { etd: etdMinutesAhead(120) };
  assert.equal(checkUrgency(r), null);
  assert.equal(checkSub(r, 'check'), 'ETD ' + r.etd);
});

test('a blank ETD is never treated as overdue — there is no time to compare', () => {
  const r = { etd: '' };
  assert.equal(checkUrgency(r), null);
  assert.equal(checkSub(r, 'check'), 'No ETD');
});

// This is the important correctness guard: 12:01/12:02/12:04 are Opera
// status codes ("Preparing" etc.), not real departure times. Comparing them
// against the clock would produce a nonsensical "overdue by N hours".
test('Opera status codes (12:01, 12:02, 12:04) are never treated as real overdue times', () => {
  ;['12:01', '12:02', '12:04'].forEach(code => {
    const r = { etd: code };
    assert.equal(checkUrgency(r), null, `${code} should not compute urgency`);
    assert.equal(checkSub(r, 'check'), win.CP.ETD_CODES[code]);
  });
});

test('a checked-out room always shows "Checked out" regardless of ETD urgency', () => {
  const r = { etd: etdMinutesAgo(500) };
  assert.equal(checkSub(r, 'co'), 'Checked out');
});

test('urgency labels are short enough not to be silently truncated by the 84px tile', () => {
  // Regression guard for the original bug: "Overdue 1 h 37" truncated to
  // "Overdue 1 ..." and hid the number. Anything past ~12 chars is suspect.
  const overdue = checkSub({ etd: etdMinutesAgo(600) }, 'check'); // 10 hours — a long duration on purpose
  const soon = checkSub({ etd: etdMinutesAhead(10) }, 'check');
  assert.ok(overdue.length <= 13, `"${overdue}" (${overdue.length} chars) is too long for the tile`);
  assert.ok(soon.length <= 13, `"${soon}" (${soon.length} chars) is too long for the tile`);
});
