// Allocation Intelligence — priority rules.
// A plain array of rule objects, not a scoring model: every rule that fires
// contributes a human-readable reason, and the reasons ARE the explanation
// ("VIP + Sea View Request + Early Arrival"), never a bare number. Add,
// remove or edit a rule here as the real hotel workflow gets confirmed —
// nothing elsewhere in the app needs to change to pick it up.
(function (root) {
  'use strict';

  // Arrivals due before this hour are treated as "early" — before typical
  // 14:00 check-in. A guess pending a real confirmed check-in time; change
  // this one constant if the hotel's is different.
  const EARLY_ARRIVAL_HOUR = 14;
  const LARGE_PARTY_SIZE = 4;

  function toMinutes(hhmm) {
    const m = /^(\d{1,2})[:.]?(\d{2})$/.exec(String(hhmm || '').trim());
    if (!m) return null;
    const h = +m[1], mi = +m[2];
    if (h > 23 || mi > 59) return null;
    return h * 60 + mi;
  }

  // Each rule: id (stable key), hard (true = alone is enough for HIGH),
  // test(record, ctx) -> a reason string, or null/false if it doesn't apply.
  // ctx carries cross-referenced signals module.js gathers from the other
  // two uploads (arrival-report text scan, alerts text scan) — a rule that
  // doesn't need them just ignores ctx.
  const RULES = [
    {
      id: 'vip',
      hard: true,
      test: (r) => r.vip ? `VIP (${r.vip})` : null
    },
    {
      // Without this, an arrival with no room yet and nothing else notable
      // scores zero reasons and never appears in the attention list — which
      // would hide exactly the case Room Allocation Assistance exists for.
      id: 'needs-room',
      hard: false,
      test: (r) => r.needsRoom ? 'No room assigned yet' : null
    },
    {
      id: 'member',
      hard: false,
      test: (r) => (r.memberLevel || r.memberType) ? `Loyalty member${r.memberLevel ? ' (' + r.memberLevel + ')' : ''}` : null
    },
    {
      id: 'linked',
      hard: false,
      test: (r) => r.linked ? 'Linked / family reservation' : null
    },
    {
      id: 'early-arrival',
      hard: false,
      test: (r) => {
        const m = toMinutes(r.eta);
        if (m === null) return null;
        return m < EARLY_ARRIVAL_HOUR * 60 ? `Early arrival (${r.eta})` : null;
      }
    },
    {
      id: 'large-party',
      hard: false,
      test: (r) => (r.adults + r.children) >= LARGE_PARTY_SIZE ? `Large party (${r.adults + r.children} guests)` : null
    },
    {
      id: 'balance',
      hard: false,
      test: (r) => {
        if (!r.balance) return null;
        const negative = /-/.test(r.balance) || /\bCR\b/i.test(r.balance);
        const num = parseFloat((r.balance.match(/[\d,]+(?:\.\d+)?/) || ['0'])[0].replace(/,/g, '')) || 0;
        return num !== 0 ? `Balance on arrival (${r.balance})` : null;
      }
    },
    {
      id: 'occasion',
      hard: true,
      test: (r, ctx) => {
        const labels = ctx && ctx.arrivalSignals && r.room ? ctx.arrivalSignals.get(r.room) : null;
        if (!labels) return null;
        const occasions = [...labels].filter(l => l !== 'Connecting room requested');
        return occasions.length ? occasions.join(', ') + ' (from arrival report)' : null;
      }
    },
    {
      id: 'connecting-requested',
      hard: false,
      test: (r, ctx) => {
        const labels = ctx && ctx.arrivalSignals && r.room ? ctx.arrivalSignals.get(r.room) : null;
        return labels && labels.has('Connecting room requested') ? 'Connecting room requested (from arrival report)' : null;
      }
    },
    {
      id: 'alert-room',
      hard: true,
      test: (r, ctx) => {
        const labels = ctx && ctx.alertSignals && r.room ? ctx.alertSignals.get(r.room) : null;
        return labels ? `Room ${r.room} flagged in alerts report: ${[...labels].join(', ')}` : null;
      }
    }
  ];

  function applyRules(record, ctx) {
    const reasons = [];
    let hard = false;
    RULES.forEach(rule => {
      const reason = rule.test(record, ctx || {});
      if (reason) {
        reasons.push({ id: rule.id, text: reason, hard: !!rule.hard });
        if (rule.hard) hard = true;
      }
    });
    let tier = null;
    if (hard || reasons.length >= 2) tier = 'high';
    else if (reasons.length === 1) tier = 'medium';
    return { tier, reasons };
  }

  root.CPAllocRules = { RULES, applyRules, EARLY_ARRIVAL_HOUR, LARGE_PARTY_SIZE };

  if (typeof module !== 'undefined' && module.exports) module.exports = root.CPAllocRules;
})(typeof window !== 'undefined' ? window : globalThis);
