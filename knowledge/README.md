# CheckPoint knowledge layer

Reference material, not application code. Nothing in `knowledge/` is imported
by the running app — it exists so the people (and the AI sessions) building
CheckPoint's Allocation Copilot have a documented, updatable understanding of
how OPERA Cloud actually works, instead of that understanding living only as
assumptions buried in `allocation/rules.js` or in someone's memory.

## Three tiers — never mix them

Every fact in this directory belongs to exactly one of these. When you add
something, say which one it is. When you don't know, write "Unknown".

**A. OPERA knowledge** — `opera/*.md`
How OPERA Cloud works in general, according to Oracle's own documentation.
True for any property running OPERA Cloud, regardless of configuration.

**B. Property configuration** — `property/*.md`
How *this* hotel (Rixos Bab Al Bahr) has OPERA Cloud configured: which room
type codes exist, which VIP codes are actually used, which report layouts
this property's exports actually produce. Most of this is currently
**unconfirmed** — see the file's own status markers.

**C. Rooms Controller operational rules** — `controller-rules.md`
How the person using CheckPoint personally wants the shift to run: what
counts as high priority, how early is "early arrival", what to flag. This is
opinion and preference, not fact about OPERA or the property, and it's the
one tier meant to change often as the workflow gets tuned.

Mixing these is exactly the mistake this structure exists to prevent: OPERA
generically supports connecting rooms (tier A) doesn't mean *this* property
has any configured that way (tier B), and neither tells you whether a
connecting-room request should be HIGH or MEDIUM priority for *this*
Rooms Controller (tier C).

## Sourcing rules

- Everything in `opera/*.md` is sourced from `docs.oracle.com`, Oracle's
  official OPERA Cloud documentation, via web search (direct fetch of
  `docs.oracle.com` is blocked in the environment these files were written
  in — search snippets were used instead, and every claim below links the
  page it came from). Where a claim could not be confirmed from a real page,
  it's marked **Unknown / unconfirmed** rather than filled in from general
  hospitality-industry knowledge.
- OPERA Cloud is versioned (this research pulled from releases spanning
  ~21.x–26.x); terminology is generally stable release to release, but a
  specific screen name or menu path can move. Treat these files as
  "generally true, verify the exact path in your own OPERA instance", not a
  pixel-accurate manual.
- Nothing here is a substitute for Oracle's own documentation or your
  property's OPERA training. It's a working reference for people building
  and maintaining CheckPoint.

## Files

| File | Tier | Covers |
| --- | --- | --- |
| `opera/reservations.md` | A | Lifecycle, statuses, blocking, shares/splits/links, profiles, VIP, membership, traces, alerts, notes, requests, routing, rates, packages, sources, travel agents, companies |
| `opera/rooms.md` | A | Room types, room classes, features, connecting rooms, housekeeping status, front office status, Out of Order vs Out of Service |
| `opera/availability.md` | A | Room-type vs individual-room availability, sell limits, Property Availability, Detailed Availability, Room Plan |
| `opera/reports.md` | A | Structured dictionary of OPERA reports relevant to Rooms Control |
| `property/rixos-bab-al-bahr.md` | B | What's actually confirmed about this property's OPERA configuration (mostly derived from CheckPoint's own existing data files), and what's still unknown |
| `controller-rules.md` | C | The operational priority rules CheckPoint's Allocation Copilot actually runs, in plain language, kept in sync with `allocation/rules.js` |

## Updating this

OPERA Cloud changes release to release. When something here turns out to be
wrong, out of date, or contradicted by what you see in your own OPERA
instance, fix the file and note it — don't leave stale generic knowledge
next to what you've since confirmed. Property-specific facts in
`property/rixos-bab-al-bahr.md` should move from "unknown" to "confirmed"
as they're verified against your real OPERA Cloud instance and real
exports, not assumed.
