// Allocation Copilot — linked reservation groups.
// A family or group of friends shouldn't be allocated as N independent
// puzzles — a room combination that's individually optimal for each person
// can still split a family across floors or buildings. This groups linked
// reservations from one Confirmation export batch and surfaces the whole
// combination together, mirroring the same linked-reservation grouping
// departures/js/departures.js already does for due-outs (same "confirmation
// number + lead name" convention in the `linked` field).
(function (root) {
  'use strict';

  function groupLinkedArrivals(records) {
    const groups = {};
    records.forEach(r => {
      if (!r.linked) return;
      const m = /^(\d{6,})\s*(.*)$/.exec(r.linked);
      const key = m ? m[1] : r.linked;
      const g = groups[key] || (groups[key] = { key, leadName: m ? m[2] : r.linked, members: [] });
      g.members.push(r);
    });
    Object.values(groups).forEach(g => {
      const lead = records.find(r => r.conf === g.key);
      if (lead && !g.members.includes(lead)) g.members.unshift(lead);
    });
    // A "group" worth showing as a group is 2+ people — one record whose
    // linked field doesn't resolve to any sibling is just noise, not a group.
    return Object.values(groups).filter(g => g.members.length > 1);
  }

  // Whether every member who has a room already assigned is connected to at
  // least one other member's room, using Room Guide's own connecting-room
  // data. Doesn't require every pair to connect — a group can legitimately
  // be "two connecting rooms plus one nearby standard room".
  function checkGroupConnectivity(group, roomLookup) {
    const withRooms = group.members.filter(m => m.room);
    if (withRooms.length < 2) return { checked: false, allConnected: null, isolated: [] };
    const roomSet = new Set(withRooms.map(m => m.room));
    const isolated = withRooms.filter(m => {
      const info = roomLookup(m.room);
      return !info || !info.connecting || !roomSet.has(String(info.connecting));
    });
    return { checked: true, allConnected: isolated.length === 0, isolated: isolated.map(m => m.room) };
  }

  root.CPAllocGroup = { groupLinkedArrivals, checkGroupConnectivity };

  if (typeof module !== 'undefined' && module.exports) module.exports = root.CPAllocGroup;
})(typeof window !== 'undefined' ? window : globalThis);
