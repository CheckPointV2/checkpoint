// Allocation Copilot — room candidate matching.
// Never assigns a room. Given what a reservation needs, it ranks the rooms
// that could work and says why, so the controller picks and does the actual
// assignment in Opera. rankCandidates() is the pure part (plain data in,
// plain data out — see tests/match.test.js); findCandidates() is the thin
// browser-only wrapper that gathers RBAB_DATA (Room Guide) and window.CP's
// live due-out state (Departures) to feed it.
(function (root) {
  'use strict';

  const baseType = (t) => String(t || '').replace(/OV$/, '');

  // status: 'free' (already checked out/left), 'check' (due out, still
  // needs a physical check — the same vocabulary departures/js/finder.js's
  // lanes already use, kept identical on purpose so a controller who knows
  // Room Finder already knows what these mean), 'later', 'ext', or
  // 'unknown' (not in today's due-out import at all — not a guess, just
  // means Departures has no live signal for it either way).
  const STATUS_RANK = { free: 0, check: 1, later: 2, ext: 3, unknown: 4 };

  // rooms: array of Room Guide room records ({room, type, description,
  // connecting, codes, building}). dueoutIndex: Map<roomNumber, {status,
  // urgencyMins}> — the live signal from Departures, or an empty Map if
  // Departures has no import yet. requestedType: an Opera room type code.
  function rankCandidates(rooms, requestedType, dueoutIndex, opts) {
    opts = opts || {};
    const exact = rooms.filter(r => r.type === requestedType);
    const related = rooms.filter(r => r.type !== requestedType && baseType(r.type) === baseType(requestedType));

    function withStatus(list) {
      return list.map(r => {
        const live = dueoutIndex.get(String(r.room));
        return Object.assign({}, r, {
          status: live ? live.status : 'unknown',
          urgencyMins: live ? live.urgencyMins : null
        });
      });
    }

    function sortRank(list) {
      return list.slice().sort((a, b) => {
        const rankDiff = STATUS_RANK[a.status] - STATUS_RANK[b.status];
        if (rankDiff !== 0) return rankDiff;
        if (a.status === 'check' && b.status === 'check') return (b.urgencyMins || 0) - (a.urgencyMins || 0);
        return String(a.room).localeCompare(String(b.room), undefined, { numeric: true });
      });
    }

    let exactRanked = sortRank(withStatus(exact));
    const relatedRanked = sortRank(withStatus(related));

    if (opts.preferConnecting) {
      const connectedRoomNums = new Set(rooms.map(r => String(r.room)));
      exactRanked = exactRanked.slice().sort((a, b) => {
        const aOk = a.connecting && connectedRoomNums.has(String(a.connecting)) ? 0 : 1;
        const bOk = b.connecting && connectedRoomNums.has(String(b.connecting)) ? 0 : 1;
        return aOk - bOk;
      });
    }

    const top = exactRanked.slice(0, 5);
    const warnings = [];
    if (!exact.length) {
      warnings.push(`No ${requestedType} rooms exist in the room list at all — check the room type code.`);
    } else if (!exactRanked.some(r => r.status === 'free' || r.status === 'check')) {
      warnings.push(`No ${requestedType} room is showing as free or checking out today per the imported due-out list — check current availability in Opera.`);
    }

    return {
      requestedType,
      candidates: top,
      totalExactMatches: exact.length,
      alternatives: top.length ? [] : relatedRanked.slice(0, 5),
      warnings
    };
  }

  // ---------- browser wrapper ----------
  function allRoomGuideRooms() {
    const data = root.RBAB_DATA;
    if (!data) return [];
    const out = [];
    data.buildingOrder.forEach(bkey => {
      const b = data.buildings[bkey];
      for (const num in b.rooms) out.push(Object.assign({ building: b.label }, b.rooms[num]));
    });
    return out;
  }

  // Builds room -> live status from whatever Departures currently has
  // imported (window.CP), or an empty index if Departures has no data yet —
  // matching never silently assumes a room is free when there's no signal.
  function buildDueoutIndex() {
    const idx = new Map();
    const CP = root.CP;
    if (!CP || !CP.state) return idx;
    const s = CP.state();
    if (!s.dueouts) return idx;
    s.dueouts.rows.forEach(row => {
      const st = CP.roomStatus(row, s);
      let status = null;
      if (st === 'co' || st === 'left') status = 'free';
      else if (st === 'check') status = 'check';
      else if (st === 'later') status = 'later';
      else if (st === 'ext') status = 'ext';
      if (!status) return;
      let urgencyMins = null;
      if (status === 'check' && row.etd && !CP.ETD_CODES[row.etd]) {
        const etdMins = CP.toMinutes(row.etd);
        if (etdMins !== null) urgencyMins = CP.nowMinutes() - etdMins;
      }
      idx.set(row.room, { status, urgencyMins });
    });
    return idx;
  }

  function findCandidates(record, opts) {
    const rooms = allRoomGuideRooms();
    if (!rooms.length) return { requestedType: record.roomType, candidates: [], totalExactMatches: 0, alternatives: [], warnings: ['Room Guide data has not loaded yet.'] };
    return rankCandidates(rooms, record.roomType, buildDueoutIndex(), opts);
  }

  // For the Candidate Room Comparison feature: look up one specific room the
  // controller typed in, by number, regardless of type. Returns null if it
  // isn't in Room Guide's room list at all (a typo, or a room this data
  // doesn't cover) — compare.js reports that honestly rather than guessing.
  function getRoom(roomNumber) {
    const num = String(roomNumber || '').trim();
    if (!num) return null;
    return allRoomGuideRooms().find(r => String(r.room) === num) || null;
  }

  root.CPAllocMatch = { rankCandidates, findCandidates, getRoom, baseType };

  if (typeof module !== 'undefined' && module.exports) module.exports = { rankCandidates, baseType };
})(typeof window !== 'undefined' ? window : globalThis);
