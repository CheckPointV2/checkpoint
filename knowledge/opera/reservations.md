# OPERA Cloud — Reservations

Tier A (generic OPERA knowledge). Sourced from Oracle's OPERA Cloud Services
User Guide (`docs.oracle.com/en/industries/hospitality/opera-cloud/*/ocsuh/`)
via web search, releases ~21.4–26.3. See `../README.md` for sourcing notes.

## Reservation lifecycle and statuses

A reservation moves through a small set of statuses from booking to
departure:

- **Reservation** — booked, arrival date in the future, not yet arrived.
- **Due In** — expected to arrive (used for today's arrivals).
- **Checked In / In House** — guest has arrived and is currently staying.
- **Due Out** — a reservation checking out early moves to this status.
- **Checked Out / Departed** — the stay is complete.
- **Cancelled** — the booking was cancelled before arrival.
- **No Show** — guest never arrived for a confirmed booking on its arrival
  date.
- **Waitlist** — assigned when the requested room type/dates aren't
  available; can be confirmed later if availability opens up.

Checked-out reservations can be **reinstated** if checked out in error.
No-show reservations can similarly be reinstated.

Sources: [Reinstating Checked Out Reservations](https://docs.oracle.com/en/industries/hospitality/opera-cloud/25.5/ocsuh/t_departures_reinstating_checked_out_reservations.htm), [Reinstating Reservations](https://docs.oracle.com/en/industries/hospitality/opera-cloud/25.4/ocsuh/t_managing_reservations_reinstating_no_show_reservations.htm), [Managing Waitlist Reservations](https://docs.oracle.com/en/industries/hospitality/opera-cloud/23.1/ocsuh/t_managing_reservations_waitlist.htm), [Checking Out Reservations Early](https://docs.oracle.com/en/industries/hospitality/opera-cloud/24.3/ocsuh/t_checking_out_guests_early.htm), [Managing Reservation Cancellation](https://docs.oracle.com/en/industries/hospitality/opera-cloud/25.5/ocsuh/t_managing_reservation_cancellation.htm), [Reservations chapter](https://docs.oracle.com/en/industries/hospitality/opera-cloud/26.3/ocsuh/ch_reservations.htm)

## Room assignment and blocking

- **Room Assignment** assigns a physical room to a reservation. Can be done
  one at a time or in batch ("(Batch) Room Assignment" — Front Desk →
  Front Desk Workspace → Room Assignment): auto-assign, or step through and
  manually assign a suitable room to each reservation.
- **Pre-blocking** is assigning a room to a reservation *before* the guest
  checks in — the assignment exists but check-in hasn't happened yet. A
  dedicated **Reservation Pre-Blocked** report exists specifically to
  monitor these (see `reports.md`).
- **Block reservations** (a different concept from pre-blocking a room) are
  groups of rooms held for an event — a conference, wedding, tour group.
  A block has a header (post master) with dates, rate, room count and
  people-per-room; individual reservations are "picked up" from the block
  and inherit its details.

Sources: [(Batch) Room Assignment](https://docs.oracle.com/en/industries/hospitality/opera-cloud/23.2/ocsuh/t_front_desk_batch_room_assignment.htm), [Assigning a Room to a Reservation](https://docs.oracle.com/en/industries/hospitality/opera-cloud/25.2/ocsuh/t_managing_reservations_assigning_rooms_to_a_reservation.htm), [Creating Room Keys for Block Reservations](https://docs.oracle.com/en/industries/hospitality/opera-cloud/24.3/ocsuh/t_managing_blocks_creating_room_keys_for_block_reservations.htm)

## Shared, split, and linked reservations — three different things

- **Shared reservation**: two or more guests sharing one room, each with
  their own reservation record. The rate can be applied in full to each
  sharer, applied entirely to the first, split evenly, or split by a custom
  amount.
- **Split reservation**: the opposite direction — a single multi-room
  reservation gets divided into separate reservations (all of them, or just
  one). Everything copies across to the split-off reservation: stay
  details, payment method, packages, preferences, membership, **traces**,
  linked profiles, **notes**, and deposit/cancellation policy.
- **Linked reservations**: separate reservations *associated* with each
  other without necessarily sharing a room — the documented example is a
  family or group of friends traveling together, each with their own room.
  A common pattern: book one multi-room reservation, split it into
  individual reservations, link each to its own guest profile — the result
  is several reservations, linked together, each identical to the
  original. Linked reservations are viewed/managed from a reservation's
  "Linked reservations" panel.

This is the OPERA concept CheckPoint's "group/linked reservation
intelligence" is built on — a linked group is the right unit to evaluate
room combinations against, not each reservation in isolation.

Sources: [Managing Reservations Shares](https://docs.oracle.com/en/industries/hospitality/opera-cloud/25.3/ocsuh/t_managing_reservations_shares.htm), [Splitting Reservations](https://docs.oracle.com/en/industries/hospitality/opera-cloud/26.3/ocsuh/t_central_reservation_splitting_reservations.htm), [Managing Linked Reservations](https://docs.oracle.com/en/industries/hospitality/opera-cloud/24.1/ocsuh/t_booking_reservations_managing_linked_reservations.htm)

## Profiles, VIP, membership, preferences

- Every reservation requires a linked **profile** (typically a guest
  profile) — names, contact info, language, preferences, loyalty
  memberships, negotiated rates.
- **VIP** is a profile field. It auto-updates based on the guest's primary
  membership level, but a VIP designation isn't only about loyalty tier —
  Oracle's own description covers regular guests, celebrities, royalty,
  hotel owners, loyalty members, and important corporate guests.
- **Membership**: a profile can hold multiple loyalty memberships; one is
  marked the **Preferred Card** (defaults to the first one added).
- **Preferences** live on the profile (room preferences, etc.) and travel
  with the guest across stays; in multi-property setups with profile
  sharing active, preferences/notes/membership are shared across
  properties.

Sources: [Creating Guest or Contact Profiles](https://docs.oracle.com/en/industries/hospitality/opera-cloud/24.4/ocsuh/t_creating_profiles.htm), [VIP Levels](https://docs.oracle.com/en/industries/hospitality/opera-cloud/25.2/ocsuh/c_admin_client_relations_vip_levels.htm), [Managing Profile Memberships](https://docs.oracle.com/en/industries/hospitality/opera-cloud/26.1/ocsuh/t_managing_profile_memberships.htm)

## Traces, alerts, notes, requests — four different things, easy to conflate

- **Traces**: actionable instructions for a specific department, for a
  specific date/time. Once actioned, a trace is marked resolved. Traces are
  purged 30 days after checkout.
- **Alerts**: pop-up messages for staff, shown when the reservation is
  opened/updated, at check-in, or at check-out. Purged 30 days after
  checkout (or 30 days after the proposed stay end for cancelled/no-show
  reservations).
- **Notes**: free-text, attached to the reservation and/or the primary
  profile; can be typed/filtered, and can be marked internal.
- **Service requests / special requests**: tracked separately for incident,
  complaint, or general-request purposes, and can be attached to a profile,
  a reservation, or a room. Configured via Service Request Codes
  (Administration → Enterprise → Chain and Property → Service Request
  Codes), each with a code, description, and an associated department.

CheckPoint's Allocation Copilot treats all four as "things worth surfacing
to the controller" from a parsed Arrival Report, but they are genuinely
different OPERA objects with different lifecycles — worth keeping distinct
in the UI rather than merging into one generic "notes" bucket, once real
exports show they're separable in the data CheckPoint actually receives.

Sources: [Managing Reservation Traces](https://docs.oracle.com/en/industries/hospitality/opera-cloud/23.2/ocsuh/t_managing_reservations_adding_traces_to_reservations.htm), [Managing Reservation Alerts](https://docs.oracle.com/en/industries/hospitality/opera-cloud/23.2/ocsuh/t_managing_reservation_alerts.htm), [Managing Reservation Notes](https://docs.oracle.com/en/industries/hospitality/opera-cloud/21.5/ocsuh/t_adding_notes_to_reservations.htm), [Managing Service Requests](https://docs.oracle.com/cd/F18689_01/doc.193/f33329/t_managing_reservations_service_requests.htm), [Configuring Service Request Codes](https://docs.oracle.com/en/industries/hospitality/opera-cloud/25.5/ocsuh/t_admin_configuring_service_request_codes.htm)

## Routing instructions

Automatically forwards charges (for specific transaction codes, or groups
of them) from one guest's bill to another's, at the moment of posting.
There are 8 billing folios; non-routed charges post to folio #1 (tied to
the reservation's primary profile). Routing can move a limited amount or a
percentage, and can be time-bounded. Default routing can be pre-configured
on a Company, Travel Agent, Source, or Contact profile, so linking that
profile to a reservation prompts to apply it.

Relevant to CheckPoint mainly as context: a routing instruction on a
reservation is a signal there's a billing arrangement (a company paying
for the room, a travel agent's commission split) that doesn't change room
allocation but is worth knowing about if a balance shows up unexpectedly.

Source: [About Reservation Routing Instructions](https://docs.oracle.com/en/industries/hospitality/opera-cloud/25.3/ocsuh/c_managing_reservations_routing_instructions.htm)

## Rates, packages, sources, travel agents, companies

- **Rate codes** define the price and inclusions for a stay; a rate code
  can have **package** elements attached, bundling entitlements (breakfast,
  spa credit, etc.) into the rate.
- **Source** identifies where a booking came from (a source profile).
- **Travel agent** and **company** are also profile types, linkable to a
  reservation (with an OPERA Control governing whether both a TA and a
  source can be attached at once). Company profiles carry demographic
  details (addresses, phones, notes).

Sources: [About Rate Codes](https://docs.oracle.com/en/industries/hospitality/opera-cloud/25.3/ocsuh/c_rate_codes.htm), [Booking a Reservation](https://docs.oracle.com/en/industries/hospitality/opera-cloud/22.5/ocsuh/t_booking_reservations_booking_a_reservation.htm)

## Unknown / unconfirmed for this property

- The exact column names/layout of *this* property's Confirmation/
  Reservation export, Arrival Report, and Alerts Report — CheckPoint's
  parser assumes header names consistent with the due-out export already
  proven against a real file, plus reasonable guesses for arrival-only
  fields (see `../property/rixos-bab-al-bahr.md`).
- Whether this property uses Traces, Alerts, Notes, and Service Requests
  as four separable fields in its exports, or whether they're merged into
  one "Remarks"-style column in practice.
- Whether Waitlist reservations are something Rixos Bab Al Bahr's Rooms
  Controller ever needs to see in CheckPoint (not currently handled).
