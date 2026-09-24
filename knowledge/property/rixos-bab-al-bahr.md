# Property configuration — Rixos Bab Al Bahr

Tier B (property configuration). Unlike `../opera/*.md`, almost nothing
here comes from Oracle's documentation — it's what CheckPoint's own code
and data already encode about how this specific property's OPERA Cloud is
configured, plus an honest list of what's still unconfirmed. Do not treat
anything marked "Unconfirmed" as fact.

## Confirmed — from CheckPoint's own data (`roomguide/data.js`)

- **3 buildings**: Zumroud, Amwaj, Marmar. Room numbers are
  building-coded by their first digit: `1xxx` = Zumroud, `2xxx` = Amwaj,
  `3xxx` = Marmar (`departures/js/store.js`'s `CP.building()`).
- **715 total rooms** across the three buildings (218 in Zumroud alone,
  per the data file).
- **13 room type codes**: `KGA`, `KGAOV`, `KGE`, `KGEOV`, `PI`, `SKA`,
  `SKB`, `SKC`, `SKD`, `SKP`, `SXA`, `TWA`, `TWAOV`. The `OV` suffix
  denotes the ocean/sea-view variant of the base type (`KGA` ↔ `KGAOV`,
  etc.) — this convention is used throughout Departures' Room Finder and
  Allocation Copilot's room matching.
- **Room type descriptions** (`roomguide/data.js`'s `typeDesc`): e.g.
  `KGA` = "Deluxe King Garden", `SXA` = "King Suite". Full list in the
  data file.
- **Room feature/view codes** (`roomguide/data.js`'s `glossary`) — the
  code comment in the original source states these are "confirmed against
  the hotel's official Opera code list": `BAL` (Balcony), `COS` (Corniche
  Sea View), `POO` (Pool View), `BEA` (Beach View), `GAR` (Garden View),
  `INT` (Interconnecting Room), `GRD` (Ground Floor), floor codes
  (`1ST`–`8TH`), and more — full list in the data file. These are treated
  as confirmed given that explicit prior claim, but were not independently
  re-verified against OPERA during this round of work.
- **126 of the 715 rooms have a configured connecting partner**
  (`connecting` field in the room data).
- **126 rooms have photos** (`hasPhoto` field) — Room Guide-specific, not
  an OPERA fact.

## Confirmed — proven against a real due-out export

- The Due-out/Departures export's header names (`departures/js/departures.js`'s
  `HEADERS`) — `Confirmation Number`, `Room`, `Name`, `ETD`, `Balance`,
  `VIP Code`, `Travel Agent`, `Company`, `Room Type`, `Linked Name`,
  `Adults`, `Children`, `Nights`, `Membership Type`, `Membership Level` —
  have been in production use against this property's real Opera exports
  since early in this project's history (multiple accepted spellings per
  field, e.g. `Confirmation Number`/`Confirmation`/`Conf`).
- **ETD status codes**: `12:01` = Preparing, `12:02` = Luggage help,
  `12:04` = Unreachable, `12:05` = Left, `12:06` = Extension. These are
  not real departure times — they're this property's convention for
  encoding a departure-workflow status inside the ETD field. Confirmed
  because Departures' urgency logic (`checkUrgency()`) explicitly excludes
  these codes from "is this room overdue" math for exactly this reason.

## Unconfirmed — assumptions Allocation Copilot currently makes

- **Confirmation/Reservation export header names**
  (`allocation/parse.js`'s `ARRIVAL_HEADERS`). The shared fields reuse the
  due-out export's proven headers, on the reasoning that a Confirmation
  export is the same underlying Opera reservation record, just pulled for
  arrivals instead of departures. The arrival-only fields (`Arrival`,
  `Arrival Date`, `Date`, `ETA`, `Arrival Time`, `Time`, and the merged
  `Remarks`/`Comments`/`Guest Comments`/`Special Requests`/`Requests`/
  `Trace`/`Traces` field) are a reasonable guess at common OPERA Cloud
  export conventions, **not yet verified against a real file from this
  property**. If a real export uses different column names, add them to
  the alias list — it's additive, low-risk.
- **Whether this property's "Alerts Report" export is OPERA's own Alerts
  report, a housekeeping/OOO report, or something else** — see the
  Unknown note in `../opera/reports.md`. Allocation Copilot's current
  Alerts-slot scan looks for Out-of-Order/Out-of-Service/maintenance
  keywords, which may not match what this property's actual Alerts
  export contains.
- **Whether Traces, Alerts, Notes and Service Requests are separable
  fields in this property's exports**, or arrive merged into one remarks
  column in practice.
- **Real VIP codes used at this property** — the existing due-out export
  handling already reads a `VIP Code` field successfully, but the actual
  set of codes in use (e.g. is `VIP1` a real code, or just this app's
  placeholder in test data) has not been confirmed against real data
  during this work.
- **Early-arrival hour, large-party threshold, and the "due soon" window**
  used by the priority rules and urgency tiering are this app's own
  defaults (see `../controller-rules.md`), not anything read from OPERA —
  they belong to tier C, not this file, and are listed there.

## How to move something from Unconfirmed to Confirmed

Run it against a real export from this property, verify the parsed output
looks right, then edit this file to move the fact up and cite what
confirmed it (a specific file, a specific test). Don't mark something
confirmed because it seems likely.
