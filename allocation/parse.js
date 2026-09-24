// Allocation Copilot — parsing & normalization.
// Pure functions only: no DOM, no fetch, no globals besides the CPAllocParse
// export itself. That's what makes this testable with plain Node (see
// tests/parse.test.js) and keeps it reusable from module.js without coupling
// the parsing rules to how they happen to be rendered.
(function (root) {
  'use strict';

  // A room (or a short run of them) is a bare 4-digit number, the same rule
  // Departures already uses (departures/js/store.js's CP.allRoomNumbers) —
  // kept as an independent copy here since this file has to run standalone
  // in Node for tests, without pulling in the whole Departures module.
  const ROOM_NUM = /(?<![\d:./])\d{4}(?![\d:/])/g;

  // ---------- Confirmation / Reservation export -> arrival records ----------
  // Same flexible multi-header-spelling approach Departures already uses for
  // the due-out export (departures/js/departures.js HEADERS/normalize) — a
  // Confirmation export is the same Opera reservation record, just pulled for
  // arrivals instead of departures, so the shared fields (room, name, VIP,
  // room type, balance, linked name, party size) use the exact same header
  // names that are already proven against a real due-out export. Arrival-only
  // fields (arrival date/time, remarks/requests/traces) are a best-effort
  // guess at common Opera Cloud export column names — call out any that don't
  // match your real export and they're a one-line change to extend below.
  const ARRIVAL_HEADERS = {
    conf: ['Confirmation Number', 'Confirmation', 'Conf'],
    room: ['Room', 'Room No', 'Room Number'],
    name: ['Name', 'Guest Name'],
    arrival: ['Arrival', 'Arrival Date', 'Date'],
    eta: ['ETA', 'Arrival Time', 'Time'],
    balance: ['Balance'],
    vip: ['VIP Code', 'VIP'],
    ta: ['Travel Agent'],
    company: ['Company'],
    roomType: ['Room Type'],
    rate: ['Rate Code', 'Rate'],
    source: ['Source', 'Source Code'],
    linked: ['Linked Name'],
    adults: ['Adults'],
    children: ['Children'],
    nights: ['Nights'],
    memberType: ['Membership Type'],
    memberLevel: ['Membership Level'],
    // merged into one "notes" field to scan for keywords — Opera exports call
    // this column different things depending on the report, and functionally
    // a request, a comment and a trace are all just text worth reading here.
    notes: ['Remarks', 'Comments', 'Guest Comments', 'Special Requests', 'Requests', 'Trace', 'Traces']
  };

  function pick(row, aliases) {
    const key = aliases.find(h => Object.prototype.hasOwnProperty.call(row, h));
    return key ? String(row[key] ?? '').trim() : '';
  }

  // rows: array of plain objects (SheetJS sheet_to_json / HTML-table-to-object
  // output — the same shape departures/js/departures.js's parseFile already
  // produces, deliberately, so this can eventually share a parseFile call).
  function normalizeArrivals(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map(row => {
      const r = {};
      for (const key in ARRIVAL_HEADERS) r[key] = pick(row, ARRIVAL_HEADERS[key]);
      r.room = r.room.replace(/\s+/g, '');
      if (r.vip === '0') r.vip = '';
      r.adults = parseInt(r.adults, 10) || 0;
      r.children = parseInt(r.children, 10) || 0;
      return r;
    }).filter(r => r.room || r.name);
  }

  // ---------- validation ----------
  // "No room assigned yet" is not an error — it's exactly the case Room
  // Allocation Assistance exists for, so that record stays in `valid` with
  // needsRoom set, not dropped. Only genuinely broken data (a room value
  // that isn't a real room number, or no name to show at all) is excluded,
  // and even then it's excluded loudly, via `warnings`, never silently.
  function validateArrivals(records) {
    const warnings = [];
    const seenConf = new Map();
    const seenRoom = new Map();
    const valid = [];

    records.forEach((r, i) => {
      const label = `Row ${i + 1}${r.name ? ' (' + r.name + ')' : ''}`;
      if (r.room && !/^\d{4}$/.test(r.room)) {
        warnings.push(`${label}: "${r.room}" is not a valid 4-digit room number — excluded until corrected.`);
        return;
      }
      if (!r.name) {
        warnings.push(`${label}: no guest name — excluded.`);
        return;
      }

      if (r.conf) {
        if (seenConf.has(r.conf)) {
          warnings.push(`Confirmation ${r.conf} appears more than once (rows ${seenConf.get(r.conf) + 1} and ${i + 1}).`);
        } else {
          seenConf.set(r.conf, i);
        }
      }
      if (r.room) {
        if (seenRoom.has(r.room) && r.conf !== records[seenRoom.get(r.room)].conf) {
          warnings.push(`Room ${r.room} is assigned to more than one reservation (rows ${seenRoom.get(r.room) + 1} and ${i + 1}) — check for a room-move or a data error before relying on it.`);
        } else {
          seenRoom.set(r.room, i);
        }
      } else {
        warnings.push(`${label}: no room assigned yet — see suggested rooms.`);
      }

      valid.push(Object.assign({}, r, { needsRoom: !r.room }));
    });

    return { valid, warnings };
  }

  // ---------- best-effort PDF text signal extraction ----------
  // PDF text extraction (pdf.js) gives one unstructured blob per page with no
  // reliable column alignment, so this is deliberately NOT a structured table
  // parse — it's a keyword/room-number scan, exactly like Departures' own
  // free-text tools (checkouts.js, tools.js) already are. Every result here
  // must be shown to the controller as "found in the text", not asserted as
  // fact, since a scanned blob can miss or misattribute things a real table
  // parse wouldn't.
  const SPECIAL_OCCASION_WORDS = [
    ['HONEYMOON', 'Honeymoon'], ['ANNIVERSARY', 'Anniversary'], ['BIRTHDAY', 'Birthday'],
    ['WEDDING', 'Wedding'], ['PROPOSAL', 'Proposal']
  ];
  const CONNECTING_WORDS = ['CONNECT', 'INTERCONNECT'];
  // View/floor words map to Room Guide's own glossary codes (roomguide/data.js
  // glossary — confirmed against the hotel's real Opera feature-code list) so
  // a requirement found in free text can be compared against a real room's
  // actual codes later, not just displayed as loose text.
  const VIEW_WORDS = [
    ['SEA VIEW', 'View: Sea view (COS)'], ['CORNICHE', 'View: Sea view (COS)'],
    ['POOL VIEW', 'View: Pool view (POO)'], ['BEACH VIEW', 'View: Beach view (BEA)'],
    ['GARDEN VIEW', 'View: Garden view (GAR)']
  ];
  const FLOOR_WORDS = [
    ['HIGH FLOOR', 'Floor: High floor requested'], ['TOP FLOOR', 'Floor: High floor requested'],
    ['GROUND FLOOR', 'Floor: Ground floor requested (GRD)'], ['LOW FLOOR', 'Floor: Low/ground floor requested']
  ];
  const OOO_WORDS = [
    ['OUT OF ORDER', 'Out of order'], ['OUT OF SERVICE', 'Out of service'], ['OOO', 'Out of order'],
    ['OOS', 'Out of service'], ['MAINTENANCE', 'Maintenance'], ['BLOCKED', 'Blocked'], ['DAMAGE', 'Damage']
  ];

  // Rooms mentioned close together with a keyword are treated as related;
  // "close together" means within this many characters in the extracted text,
  // wide enough to survive pdf.js's word-spacing quirks, narrow enough that
  // it doesn't casually associate two unrelated rooms on the same PDF page.
  const PROXIMITY_CHARS = 200;

  function scanTextForRooms(text, wordList) {
    const str = String(text || '');
    const rooms = new Map(); // room -> Set of matched labels
    let m;
    ROOM_NUM.lastIndex = 0;
    while ((m = ROOM_NUM.exec(str)) !== null) {
      const room = m[0];
      const windowText = str.slice(Math.max(0, m.index - PROXIMITY_CHARS), m.index + PROXIMITY_CHARS).toUpperCase();
      wordList.forEach(([needle, label]) => {
        if (windowText.includes(needle)) {
          if (!rooms.has(room)) rooms.set(room, new Set());
          rooms.get(room).add(label);
        }
      });
    }
    return rooms; // Map<room, Set<label>>
  }

  function extractArrivalSignals(text) {
    const scans = [
      scanTextForRooms(text, SPECIAL_OCCASION_WORDS),
      scanTextForRooms(text, CONNECTING_WORDS.map(w => [w, 'Connecting room requested'])),
      scanTextForRooms(text, VIEW_WORDS),
      scanTextForRooms(text, FLOOR_WORDS)
    ];
    const out = new Map();
    scans.forEach(scan => {
      for (const [room, labels] of scan) {
        if (!out.has(room)) out.set(room, new Set());
        labels.forEach(l => out.get(room).add(l));
      }
    });
    return out; // Map<room, Set<label>> — labels are either bare occasion/connecting text, or "View: ..." / "Floor: ..." prefixed
  }

  function extractAlertSignals(text) {
    return scanTextForRooms(text, OOO_WORDS); // Map<room, Set<label>>
  }

  root.CPAllocParse = {
    normalizeArrivals,
    validateArrivals,
    extractArrivalSignals,
    extractAlertSignals,
    ROOM_NUM
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = root.CPAllocParse;
})(typeof window !== 'undefined' ? window : globalThis);
