# Rooms Controller operational rules

Tier C (personal operational preference, not OPERA fact or property fact).
This documents what `allocation/rules.js` and the urgency logic in
`departures/js/departures.js` actually run, in plain language, so it's
possible to reason about "why did this show as HIGH" without reading code.
When the code changes, update this file in the same commit — it exists to
stay in sync, not to describe an aspirational version.

## Allocation priority rules (`allocation/rules.js`)

Every rule below produces its own reason text when it fires. A reservation
escalates to **HIGH** if any *hard* rule fires, or if two or more rules
fire together. Exactly one rule firing is **MEDIUM**. No rule firing is
**Normal** — a standard allocation with nothing to flag.

| Rule | Hard (alone = HIGH)? | Fires when |
| --- | --- | --- |
| VIP | Yes | `VIP Code` is set |
| Connecting room requested | Yes | The Arrival Report text scan finds "connect"/"interconnect" near this room's number |
| Special occasion | Yes | The Arrival Report text scan finds a honeymoon/anniversary/birthday/wedding/proposal mention near this room's number |
| Room flagged in Alerts report | Yes | The Alerts Report text scan finds an out-of-order/out-of-service/maintenance/blocked/damage mention near this room's number |
| No room assigned yet | No | The Confirmation export has no room number for this reservation — this is the case room matching exists to help with, so it's never silently dropped |
| Loyalty member | No | `Membership Type` or `Membership Level` is set |
| Linked / family reservation | No | `Linked Name` is set |
| Early arrival | No | ETA is before 14:00 |
| Large party | No | Adults + children ≥ 4 |
| Balance on arrival | No | Balance is non-zero |
| View requested | No | The Arrival Report text scan finds "sea view"/"pool view"/"beach view"/"garden view"/"corniche" near this room's number |
| Floor preference | No | The Arrival Report text scan finds "high floor"/"top floor"/"ground floor"/"low floor" near this room's number |

**Why connecting-room and special-occasion are hard rules on their own,
not just contributors**: a family that doesn't get connecting rooms, or a
honeymoon that goes unrecognized, is a real service failure worth a
controller's attention regardless of what else is or isn't also true about
that reservation — the product spec's own HIGH-priority examples list
these individually, not just as point-scoring contributors.

## Tunable constants — this app's own defaults, not OPERA or property facts

| Constant | Current value | Where | Basis |
| --- | --- | --- | --- |
| Early-arrival hour | 14:00 | `allocation/rules.js` `EARLY_ARRIVAL_HOUR` | A guess at typical check-in time. Change if this property's is different. |
| Large-party size | 4 guests | `allocation/rules.js` `LARGE_PARTY_SIZE` | A guess. |
| "High floor" threshold | Floor 4 and above | `allocation/compare.js` `HIGH_FLOOR_MIN` | Arbitrary, given the buildings here go up to 6-7 floors. |
| Due-out "urgency" window | 15 minutes | `departures/js/departures.js` `CHECK_SOON_MINS` | How close to (or past) a departure's own ETD before the key rack visually flags it. |

Each is one named constant in its file — changing the operational rule
doesn't require touching any rendering code.

## Room candidate ranking (`allocation/match.js`)

When suggesting rooms for an arrival with no room assigned, candidates of
the exact booked room type are ranked:

1. **Free now** (already checked out/left in today's due-out import)
2. **Checking out** (still on today's due-out list, most-overdue first)
3. **Departs later today**
4. **Extension**
5. **Not in due-outs** (no live signal either way — never assumed free)

If a linked group member needs a room and the group has a connecting
requirement, candidates whose connecting partner is also in the same room
pool are preferred. If no room of the exact type has a live "free" or
"checking out" signal, that's surfaced as a warning, not hidden — the
controller decides whether to verify in Opera anyway.

## Candidate Room Comparison verdicts (`allocation/compare.js`)

- **MATCH** — every known requirement is satisfied.
- **COMPROMISE** — the room type is right (or its exact ocean/garden-view
  variant) and, if connecting was required, it is connecting; but a view or
  floor *preference* isn't met.
- **CONFLICT** — the room type is wrong, or a required connecting room is
  missing. These are the two requirements treated as non-negotiable; a
  view or floor miss is treated as a preference, not a hard failure — this
  mirrors the product spec's own examples (a missing connecting room is a
  CONFLICT; an unmet floor preference alongside everything else correct is
  a COMPROMISE).
- **UNKNOWN** — the typed room number isn't in Room Guide's room list at
  all (a typo, or a room this app doesn't have data for).

## What's deliberately *not* a rule

- Nothing here ever assigns a room, writes to Opera, or claims a room is
  currently assignable. Every output is a suggestion the controller
  verifies and acts on directly in Opera — see `knowledge/opera/availability.md`
  for exactly what CheckPoint can and can't know about live room status.
- Room-type sold-out counts, sell limits, and anything from Property/
  Detailed Availability are not modeled at all — CheckPoint has no feed
  for them.
