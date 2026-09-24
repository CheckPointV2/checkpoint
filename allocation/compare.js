// Allocation Copilot — candidate room comparison.
// The Rooms Controller finds a room in Opera; this compares it against what
// the reservation is known to need and says why it does or doesn't fit.
// Never a score — a checklist and a verdict in plain operational language,
// exactly the "Room 3132 / correct type / sea view / connecting / high
// floor not satisfied -> COMPROMISE" shape the product spec asks for.
(function (root) {
  'use strict';

  const baseType = (t) => String(t || '').replace(/OV$/, '');

  // A requirements object is the structured version of what a reservation
  // record + its arrival-report text signals imply the guest needs. Kept
  // separate from parse.js (which only extracts raw signals) and rules.js
  // (which turns signals into a priority, not a comparable checklist).
  function extractRequirements(record, ctx) {
    const labels = ctx && ctx.arrivalSignals && record.room ? ctx.arrivalSignals.get(record.room) : null;
    const arr = labels ? [...labels] : [];
    const viewLabel = arr.find(l => l.startsWith('View:'));
    const viewCodeMatch = viewLabel && viewLabel.match(/\(([A-Z0-9]+)\)/);
    const floorLabel = arr.find(l => l.startsWith('Floor:'));
    return {
      roomType: record.roomType || null,
      viewCode: viewCodeMatch ? viewCodeMatch[1] : null,
      viewLabel: viewLabel ? viewLabel.replace(/^View: /, '').replace(/\s*\([A-Z0-9]+\)$/, '') : null,
      floorPreference: floorLabel ? floorLabel.replace(/^Floor: /, '') : null,
      connecting: arr.includes('Connecting room requested'),
      occasions: arr.filter(l => l !== 'Connecting room requested' && !l.startsWith('View:') && !l.startsWith('Floor:'))
    };
  }

  function floorRank(floorCode) {
    // "GF" = 0, "1F" = 1, "2F" = 2, etc. — matches Room Guide's own floor
    // key convention (roomguide/data.js buildings.*.floors).
    if (!floorCode) return null;
    if (/^GF$/i.test(floorCode)) return 0;
    const m = /^(\d+)F$/i.exec(floorCode);
    return m ? +m[1] : null;
  }
  const HIGH_FLOOR_MIN = 4; // a guess (see knowledge/controller-rules.md) — not an OPERA or property fact

  // requirements: from extractRequirements(). room: a Room Guide room record
  // ({room, type, description, connecting, codes, floor}), or null if the
  // room number wasn't found at all.
  function compareRoom(requirements, room) {
    if (!room) {
      return { checks: [], verdict: 'UNKNOWN', reason: 'That room number isn\'t in Room Guide\'s room list — check it was typed correctly, then verify directly in Opera.' };
    }
    const checks = [];
    let critical = false;
    let compromise = false;

    if (requirements.roomType) {
      if (room.type === requirements.roomType) {
        checks.push({ status: 'pass', label: `Correct room type (${room.type})` });
      } else if (baseType(room.type) === baseType(requirements.roomType)) {
        checks.push({ status: 'warn', label: `${room.type} is the ${room.type.endsWith('OV') ? 'sea-view' : 'garden-view'} variant of the booked ${requirements.roomType}` });
        compromise = true;
      } else {
        checks.push({ status: 'fail', label: `Wrong room type (${room.type}, booked ${requirements.roomType})` });
        critical = true;
      }
    }

    if (requirements.viewCode) {
      const has = (room.codes || []).includes(requirements.viewCode);
      checks.push({ status: has ? 'pass' : 'warn', label: has ? requirements.viewLabel : `${requirements.viewLabel} not confirmed on this room` });
      if (!has) compromise = true;
    }

    if (requirements.floorPreference) {
      const rank = floorRank(room.floor);
      const wantsHigh = /high|top/i.test(requirements.floorPreference);
      const ok = rank === null ? null : (wantsHigh ? rank >= HIGH_FLOOR_MIN : rank <= 1);
      if (ok === null) {
        checks.push({ status: 'warn', label: `${requirements.floorPreference} — room's floor unknown` });
        compromise = true;
      } else {
        checks.push({ status: ok ? 'pass' : 'warn', label: `${requirements.floorPreference} (room is on ${room.floor})` });
        if (!ok) compromise = true;
      }
    }

    if (requirements.connecting) {
      const has = !!room.connecting;
      checks.push({ status: has ? 'pass' : 'fail', label: has ? `Connecting room (to ${room.connecting})` : 'No connecting room' });
      if (!has) critical = true;
    }

    if (!checks.length) {
      return { checks, verdict: 'MATCH', reason: 'No specific requirements were found for this reservation to check against — this is a standard allocation.' };
    }

    let verdict = 'MATCH', reason = 'All known requirements are satisfied.';
    if (critical) {
      verdict = 'CONFLICT';
      reason = checks.filter(c => c.status === 'fail').map(c => c.label).join('; ') + ' is not satisfied.';
    } else if (compromise) {
      verdict = 'COMPROMISE';
      reason = 'All critical requirements are satisfied, but ' +
        checks.filter(c => c.status === 'warn').map(c => c.label.charAt(0).toLowerCase() + c.label.slice(1)).join('; ') + '.';
    }
    return { checks, verdict, reason };
  }

  root.CPAllocCompare = { extractRequirements, compareRoom, baseType, floorRank, HIGH_FLOOR_MIN };

  if (typeof module !== 'undefined' && module.exports) module.exports = root.CPAllocCompare;
})(typeof window !== 'undefined' ? window : globalThis);
