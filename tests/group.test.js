'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { groupLinkedArrivals, checkGroupConnectivity } = require('../allocation/group.js');

test('groups records sharing the same linked confirmation number', () => {
  // A linked field is a real Opera confirmation number (6+ digits) followed
  // by the lead guest's name — matching the exact convention already proven
  // in departures/js/departures.js's own linkedGroups().
  const records = [
    { conf: '456789', name: 'Parent A', linked: '', room: '3132' },
    { conf: '456790', name: 'Parent B', linked: '456789 Family', room: '3134' },
    { conf: '456791', name: 'Child C', linked: '456789 Family', room: '' },
    { conf: '456792', name: 'Unrelated Guest', linked: '', room: '1041' }
  ];
  const groups = groupLinkedArrivals(records);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].members.length, 3); // lead C001 + the two linked-to-it
  assert.ok(groups[0].members.some(m => m.name === 'Parent A'));
  assert.ok(groups[0].members.some(m => m.name === 'Child C'));
});

test('a lone reservation with an unresolvable linked value is not treated as a group', () => {
  const records = [{ conf: 'C099', name: 'Solo Guest', linked: 'some note that is not a real link', room: '1041' }];
  const groups = groupLinkedArrivals(records);
  assert.equal(groups.length, 0);
});

test('no linked reservations at all produces no groups', () => {
  const records = [{ conf: 'C001', name: 'A', linked: '', room: '1041' }, { conf: 'C002', name: 'B', linked: '', room: '2205' }];
  assert.deepEqual(groupLinkedArrivals(records), []);
});

test('checkGroupConnectivity confirms when every member with a room connects to another member', () => {
  const group = { members: [{ room: '3132' }, { room: '3134' }] };
  const lookup = (room) => ({ '3132': { connecting: '3134' }, '3134': { connecting: '3132' } }[room]);
  const result = checkGroupConnectivity(group, lookup);
  assert.equal(result.checked, true);
  assert.equal(result.allConnected, true);
  assert.deepEqual(result.isolated, []);
});

test('checkGroupConnectivity flags a member whose room does not connect to any other member\'s room', () => {
  const group = { members: [{ room: '3132' }, { room: '3134' }, { room: '3140' }] };
  const lookup = (room) => ({ '3132': { connecting: '3134' }, '3134': { connecting: '3132' }, '3140': { connecting: null } }[room]);
  const result = checkGroupConnectivity(group, lookup);
  assert.equal(result.allConnected, false);
  assert.deepEqual(result.isolated, ['3140']);
});

test('checkGroupConnectivity does not check groups where fewer than 2 members have a room yet', () => {
  const group = { members: [{ room: '3132' }, { room: '' }] };
  const result = checkGroupConnectivity(group, () => null);
  assert.equal(result.checked, false);
  assert.equal(result.allConnected, null);
});
