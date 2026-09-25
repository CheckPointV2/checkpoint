'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadWindow } = require('./dom-shim.js');

const win = loadWindow(['departures/js/store.js', 'departures/js/departures.js']);
const { roomStatus, fromMinutes, nowMinutes } = win.CP;
const { checkRooms } = win.CP.dep;

// Every case that hinges on the check/later boundary is built relative to
// the real current time (never a hardcoded clock) because roomStatus now
// compares a real ETD against whichever is later: the configured cutoff or
// "now" — so a hardcoded literal like '13:00' would pass or fail depending
// on what time the suite happens to run.
function etdMinutesAgo(mins) { return fromMinutes((nowMinutes() - mins + 1440) % 1440); }
function etdMinutesAhead(mins) { return fromMinutes((nowMinutes() + mins) % 1440); }

function stateWithCutoff(cutoff) {
  return { cutoff, co: { reported: {} } };
}

test('a blank ETD is included in the physical check', () => {
  const r = { room: '1001', roomType: 'KGA', etd: '' };
  assert.equal(roomStatus(r, stateWithCutoff('08:00')), 'check');
});

test('an ETD strictly before the cutoff (and already past) is included', () => {
  const r = { room: '1002', roomType: 'KGA', etd: etdMinutesAgo(30) };
  assert.equal(roomStatus(r, stateWithCutoff('08:00')), 'check');
});

// Regression: the configured cutoff can only ever pull rooms in early, never
// push one out past "now". A real ETD that has already passed must always
// be included, even if the cutoff itself is stale (e.g. still at its 12:04
// default) and numerically earlier than that ETD — this was the actual bug:
// a 13:00 checkout stayed hidden from the list well after 13:00 had passed,
// just because nobody had bumped the cutoff forward.
test('an ETD that has already passed "now" is included, even if it is after a stale cutoff', () => {
  const r = { room: '1003', roomType: 'KGA', etd: etdMinutesAgo(10) };
  assert.equal(roomStatus(r, stateWithCutoff('08:00')), 'check');
});

test('an ETD not yet due (still in the future, past both cutoff and now) is excluded', () => {
  const r = { room: '1004', roomType: 'KGA', etd: etdMinutesAhead(90) };
  const s = stateWithCutoff(etdMinutesAgo(60)); // cutoff earlier than now
  assert.equal(roomStatus(r, s), 'later');
});

// Staff can still push the cutoff ahead of "now" to get ahead of upcoming
// checks before they're actually due.
test('pushing the cutoff ahead of now pulls in an upcoming (not-yet-due) room', () => {
  const r = { room: '1005', roomType: 'KGA', etd: etdMinutesAhead(20) };
  const s = stateWithCutoff(etdMinutesAhead(45));
  assert.equal(roomStatus(r, s), 'check');
});

// Regression: 12:01/12:02/12:04 are Opera status codes (Preparing/Luggage
// help/Unreachable), not real departure times. They must always be
// included, the same as a blank ETD — regardless of the cutoff or the
// current time.
test('Opera status codes 12:01/12:02/12:04 are always included, never compared against the cutoff or clock', () => {
  ['12:01', '12:02', '12:04'].forEach(code => {
    const r = { room: '1006', roomType: 'KGA', etd: code };
    assert.equal(roomStatus(r, stateWithCutoff('08:00')), 'check', `${code} should be included`);
    assert.equal(roomStatus(r, stateWithCutoff('23:00')), 'check', `${code} should be included even with a late cutoff`);
  });
});

test('12:05 (Left) is always excluded, even though it has long since passed', () => {
  const r = { room: '1007', roomType: 'KGA', etd: '12:05' };
  assert.equal(roomStatus(r, stateWithCutoff('23:00')), 'left');
});

test('12:06 (Extension) is always excluded, even though it has long since passed', () => {
  const r = { room: '1008', roomType: 'KGA', etd: '12:06' };
  assert.equal(roomStatus(r, stateWithCutoff('23:00')), 'ext');
});

test('a reported checkout is excluded regardless of ETD', () => {
  const r = { room: '1009', roomType: 'KGA', etd: etdMinutesAgo(60) };
  const s = stateWithCutoff('08:00');
  s.co.reported['1009'] = Date.now();
  assert.equal(roomStatus(r, s), 'co');
});

test('checkRooms includes blanks, status codes, overdue and before-cutoff rooms; excludes only 12:05/12:06/not-yet-due', () => {
  const s = stateWithCutoff(etdMinutesAgo(60)); // stale cutoff, well before now
  s.dueouts = {
    rows: [
      { room: '1001', roomType: 'KGA', etd: '' },                 // blank -> included
      { room: '1002', roomType: 'KGA', etd: etdMinutesAgo(90) },  // before cutoff -> included
      { room: '1003', roomType: 'KGA', etd: etdMinutesAgo(10) },  // already overdue, past a stale cutoff -> included
      { room: '1004', roomType: 'KGA', etd: etdMinutesAhead(90) }, // genuinely not yet due -> excluded
      { room: '1005', roomType: 'KGA', etd: '12:05' },            // Left -> excluded
      { room: '1006', roomType: 'KGA', etd: '12:06' },            // Extension -> excluded
      { room: '1007', roomType: 'KGA', etd: '12:01' },            // Opera "Preparing" code -> included
      { room: '1008', roomType: 'KGA', etd: '12:04' }             // Opera "Unreachable" code -> included
    ]
  };
  assert.deepEqual(checkRooms(s), ['1001', '1002', '1003', '1007', '1008']);
});
