# OPERA Cloud — Report dictionary

Tier A (generic OPERA knowledge). Sourced from Oracle's OPERA Cloud Services
User Guide via web search — mostly the Reports chapters
(`c_reports_*.htm`). See `../README.md` for sourcing notes.

Report **internal codes** below (the short names in parentheses, e.g.
`res_detail`) come from Oracle's own documentation URLs and page text where
findable. Where a report is real and documented but no internal code
surfaced in search, that's marked explicitly — don't treat an absent code
as one that doesn't exist.

"Can CheckPoint import this" means: does one of the three current upload
slots (Arrival Report PDF, Confirmation/Reservation Excel, Alerts PDF)
realistically fit this report's typical export format. Every "Yes" below
still goes through CheckPoint's best-effort parser, not a guaranteed exact
match to this property's real layout — see
`../property/rixos-bab-al-bahr.md`.

---

## Arrivals: Detailed (`res_detail`)

- **Purpose**: full list of arrival reservations for a date range, with
  filter/sort options (by name, room, reservation type, ETA, etc.).
- **Filters**: arrival date range; option to include reservations that
  already checked in today when filtering by arrival date.
- **Fields** (typical for this report type): confirmation number, guest
  name, room/room type, ETA, VIP, membership, nights, adults/children,
  travel agent, company, balance.
- **Output means**: who's arriving and when, one row per reservation.
- **CheckPoint use**: this is the natural source for the "Confirmation /
  Reservation Export" upload slot — it's the report Allocation Copilot's
  parsing (`allocation/parse.js`) is built against.
- Arrivals: Yes · Allocation: Yes · Departures: No · Room control: No
- **Can CheckPoint import it**: Yes (Excel/CSV export) — this is the
  primary intended source for the Confirmation/Reservation slot.

Source: [Arrivals: Detailed Report](https://docs.oracle.com/en/industries/hospitality/opera-cloud/23.2/ocsuh/c_reports_arrivals_detailed_res_detail.htm)

## Arrivals and Checked In Today (`arrchkinbyroom`)

- **Purpose**: everyone expected to arrive today, plus everyone who has
  already checked in today — one combined view.
- **CheckPoint use**: a same-day snapshot; useful as an alternative or
  supplement to Arrivals: Detailed for a narrower "just today" pull.
- Arrivals: Yes · Allocation: Yes · Departures: No · Room control: No
- **Can CheckPoint import it**: Yes, same shape as Arrivals: Detailed for
  parsing purposes.

Source: [Arrivals Reports](https://docs.oracle.com/en/industries/hospitality/opera-cloud/22.3/ocsuh/c_reports_arrival.htm)

## Alerts

- **Purpose**: every guest with an attached alert, for reservations in the
  selected date range. Depends on the Alerts application function being
  active.
- **CheckPoint use**: this is conceptually the "Alerts Report" upload slot
  — but Oracle's own Alerts report is about reservation-level *pop-up
  alerts* (VIP arrival notices, billing flags, etc.), not necessarily
  Out-of-Order/Out-of-Service room flags. **This is a real gap worth
  flagging**: CheckPoint's current Alerts-slot parsing scans for
  OOO/OOS/maintenance keywords, which may not be what a real OPERA
  "Alerts" export actually contains — see Unknowns below.
- Arrivals: Yes · Allocation: Yes (guest-level flags) · Departures: No ·
  Room control: Uncertain, see above
- **Can CheckPoint import it**: Yes as PDF/text, but what it's scanned for
  needs verifying against a real export.

Source: [Managing Reservation Alerts](https://docs.oracle.com/en/industries/hospitality/opera-cloud/23.2/ocsuh/t_managing_reservation_alerts.htm), [Reservations Reports](https://docs.oracle.com/en/industries/hospitality/opera-cloud/25.1/ocsuh/c_reports_reservations.htm)

## Reservations with Notes

- **Purpose**: all notes attached to a reservation and its primary profile,
  filterable by note type, optionally including internal notes, and
  excludable below a chosen age. Selected by arrival date range.
- **CheckPoint use**: a good real source for the special-occasion/request
  keyword scan Allocation Copilot runs — closer to what that scan
  actually needs than the generic "Alerts" report.
- Arrivals: Yes · Allocation: Yes · Departures: No · Room control: No
- **Can CheckPoint import it**: Yes, as an alternative or supplement to the
  Arrival Report PDF for the special-occasion/request signal scan.

Source: [Reservations Reports](https://docs.oracle.com/en/industries/hospitality/opera-cloud/25.1/ocsuh/c_reports_reservations.htm)

## Reservation Pre-Blocked

- **Purpose**: shows what room assignments (pre-blocks) have already been
  made, together with each room's current Front Office status and
  housekeeping status. Oracle's own documentation specifically calls out
  running it for the *current business date* so front desk can track room
  status and adjust.
- **CheckPoint use**: potentially the single most useful report for the
  Allocation Copilot's "who already has a room, is it actually ready"
  question — closer to real-time room readiness than the Confirmation
  export alone. Not currently a dedicated upload slot; worth considering
  as a fourth input if this property runs it routinely.
- Arrivals: Yes · Allocation: Yes (high value) · Departures: No ·
  Room control: Yes
- **Can CheckPoint import it**: Not currently wired to a slot — see
  Known Limitations in the property file.

Source: [Reservations Reports](https://docs.oracle.com/en/industries/hospitality/opera-cloud/25.1/ocsuh/c_reports_reservations.htm)

## Guest Preference Report (`preference_forecast`)

- **Purpose**: forecasts guest preferences by date, using each
  reservation's preference code, across arriving / in-house / due-out /
  future reservations.
- **CheckPoint use**: a real, structured source for "requirements" data
  (view, floor, bed type preferences) that's currently only reachable
  through Allocation Copilot's best-effort text scan of the Arrival
  Report. Worth considering as a real upload source once confirmed
  available at this property.
- Arrivals: Yes · Allocation: Yes (high value) · Departures: No ·
  Room control: No
- **Can CheckPoint import it**: Not currently wired to a slot.

Source: [Forecast Reports](https://docs.oracle.com/en/industries/hospitality/opera-cloud/25.3/ocsuh/c_reports_forecast.htm)

## Future Occupancy Report (`resfutureoccupancy`)

- **Purpose**: forecasted occupancy for a date range, broken down by
  individual reservations, block reservations, unpicked-up block rooms,
  and total rooms.
- **CheckPoint use**: property-wide planning context (is the property
  about to be very full), not room-level allocation detail. Low priority
  for CheckPoint's current scope.
- Arrivals: No · Allocation: Low · Departures: No · Room control: No
- **Can CheckPoint import it**: Not currently relevant to a slot.

Source: [Forecast Reports](https://docs.oracle.com/en/industries/hospitality/opera-cloud/25.3/ocsuh/c_reports_forecast.htm)

## Property Availability / Detailed Availability / Room Plan

These are live OPERA **screens**, not typically exported reports in the
PDF/Excel sense — see `availability.md` for what each shows. Listed here
because they're exactly the kind of "verify in Opera" step CheckPoint's
Allocation Brief points the controller toward, and because Room Plan in
particular (per-room, 15-day availability) is the closest OPERA equivalent
to what Allocation Copilot's room matching is trying to approximate from
imported data alone.
- Arrivals: No · Allocation: Yes (as the verification step, not an import)
  · Departures: No · Room control: Yes
- **Can CheckPoint import it**: No — these are live screens, not files to
  upload. This is exactly why CheckPoint's Allocation Brief always ends
  with "CHECK IN OPERA".

## Housekeeping reports (for context, not currently used by CheckPoint)

| Report | Code | Purpose |
| --- | --- | --- |
| House Status | `hkroomstatusbytype` | All of today's room-status movements, by room type |
| Housekeeping Detail | `hk_details` | Detailed per-room housekeeping status |
| Housekeeping Discrepancy | `hk_discrepancy` | Rooms where housekeeping status disagrees with expected status |
| Housekeeping Status | `hk_allstatus` | Status of every room's activity, property-wide |
| Housekeeping Stayover | `hkstayover` | All stayover guests |

- Arrivals: No · Allocation: Low · Departures: No · Room control: Yes
- **Can CheckPoint import it**: Not currently wired to a slot; the
  Housekeeping Discrepancy report in particular could be a good future
  source for room-readiness flags in allocation matching.

Source: [Housekeeping Reports](https://docs.oracle.com/en/industries/hospitality/opera-cloud/22.3/ocsuh/c_reports_housekeeping.htm)

---

## Unknown / unconfirmed

- **Routing Details report**: not confirmed to exist as a named report in
  search results returned. Reservation-level routing instructions are a
  real OPERA concept (`reservations.md`), but a dedicated "Routing
  Details" *report* wasn't found and shouldn't be assumed to exist under
  that exact name without checking this property's actual OPERA report
  list.
- Whether Rixos Bab Al Bahr's actual "Alerts Report" (the one the
  Rooms Controller already has access to and has been asked to feed into
  CheckPoint) is OPERA's Alerts report, a Housekeeping Discrepancy-style
  report, or a custom property report — this materially affects what
  CheckPoint's Alerts-slot parser should actually be scanning for, and is
  worth confirming against a real file before trusting that parser's
  output.
- The exact report names/codes this property's OPERA instance exposes in
  its own menus — report names can be customized per-property in OPERA
  Cloud's report configuration, so this dictionary should be treated as
  "what a standard install calls these", not a guarantee this property's
  menu uses the identical labels.
