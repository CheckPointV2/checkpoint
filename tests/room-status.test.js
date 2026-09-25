'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadWindow } = require('./dom-shim.js');

const win = loadWindow(['departures/js/store.js', 'departures/js/departures.js']);
const { roomStatus } = win.CP;
const { checkRooms } = win.CP.dep;

// Physical check rule: 12:05 ("Left") and 12:06 ("Extension") never appear.
// Anything at-or-after the cutoff is excluded too. Blank ETD, and anything
// strictly before the cutoff, is included.
function stateWithCutoff(cutoff) {
  return { cutoff, co: { reported: {} } };
}

test('a blank ETD is included in the physical check', () => {
  const r = { room: '1001', roomType: 'KGA', etd: '' };
  assert.equal(roomStatus(r, stateWithCutoff('12:04')), 'check');
});

test('an ETD strictly before the cutoff is included', () => {
  const r = { room: '1002', roomType: 'KGA', etd: '11:45' };
  assert.equal(roomStatus(r, stateWithCutoff('12:04')), 'check');
});

test('an ETD equal to the cutoff is excluded (not yet due for physical check)', () => {
  const r = { room: '1003', roomType: 'KGA', etd: '12:04' };
  assert.equal(roomStatus(r, stateWithCutoff('12:04')), 'later');
});

test('an ETD after the cutoff is excluded', () => {
  const r = { room: '1004', roomType: 'KGA', etd: '13:30' };
  assert.equal(roomStatus(r, stateWithCutoff('12:04')), 'later');
});

test('12:05 (Left) is always excluded, even if it is before the cutoff', () => {
  const r = { room: '1005', roomType: 'KGA', etd: '12:05' };
  assert.equal(roomStatus(r, stateWithCutoff('18:00')), 'left');
});

test('12:06 (Extension) is always excluded, even if it is before the cutoff', () => {
  const r = { room: '1006', roomType: 'KGA', etd: '12:06' };
  assert.equal(roomStatus(r, stateWithCutoff('18:00')), 'ext');
});

test('a reported checkout is excluded regardless of ETD', () => {
  const r = { room: '1007', roomType: 'KGA', etd: '11:00' };
  const s = stateWithCutoff('12:04');
  s.co.reported['1007'] = Date.now();
  assert.equal(roomStatus(r, s), 'co');
});

test('checkRooms returns exactly the blank/before-cutoff rooms, never 12:05/12:06/after-cutoff', () => {
  const s = stateWithCutoff('12:04');
  s.dueouts = {
    rows: [
      { room: '1001', roomType: 'KGA', etd: '' },       // blank -> included
      { room: '1002', roomType: 'KGA', etd: '11:45' },  // before cutoff -> included
      { room: '1003', roomType: 'KGA', etd: '12:04' },  // at cutoff -> excluded
      { room: '1004', roomType: 'KGA', etd: '13:30' },  // after cutoff -> excluded
      { room: '1005', roomType: 'KGA', etd: '12:05' },  // Left -> excluded
      { room: '1006', roomType: 'KGA', etd: '12:06' },  // Extension -> excluded
      { room: '1007', roomType: 'KGA', etd: '12:01' }   // Opera "Preparing" code, before cutoff -> included
    ]
  };
  assert.deepEqual(checkRooms(s), ['1001', '1002', '1007']);
});
