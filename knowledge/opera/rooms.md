# OPERA Cloud — Rooms

Tier A (generic OPERA knowledge). Sourced from Oracle's OPERA Cloud Services
User Guide via web search. See `../README.md` for sourcing notes.

## Room types and room classes

- A **room type** is the sellable unit — what's booked and rated (e.g. a
  Deluxe King Garden room). Configured as either **Physical** (real,
  inventory rooms, including component room types) or **Pseudo**
  (non-inventory — used for things that aren't a bookable physical room).
  Room type codes are alphanumeric, up to 8 characters.
- A **room class** groups room types that share characteristics (e.g.
  "all Club-floor room types", "all apartment accommodation") for easier
  inventory control and statistical reporting. A room class has a code, a
  description, and a display sequence.
- Room Classes and Room Types should both be defined before individual
  Room Codes (physical rooms) are created.

Sources: [Configuring Rooms](https://docs.oracle.com/en/industries/hospitality/opera-cloud/23.2/ocsuh/t_rooms_managing_rooms.htm), [Configuring Room Types](https://docs.oracle.com/en/industries/hospitality/opera-cloud/23.1/ocsuh/t_rooms_managing_room_types.htm), [Configuring Room Classes](https://docs.oracle.com/en/industries/hospitality/opera-cloud/21.4/ocsuh/t_rooms_managing_room_classes.htm)

## Individual rooms and features

An individual room (Room Code) carries: a code (up to 6 characters), the
room class (inherited from its room type), an accessible-room flag, a
description, **features**, floor, day/evening housekeeping section, and
stayover/departure credit (the housekeeping effort needed to service it).

**Room features** are attributes that don't materially change the rate or
demand — Oracle's own definition: "any attribute of the room for which
specific availability does not need to be tracked", with examples given as
proximity to an elevator, accessibility, or a specific view. This matters:
a *view* like sea view can be modeled as a feature in OPERA (not
necessarily its own room type), which is consistent with how CheckPoint's
existing Room Guide data already encodes views/balcony/floor as feature
codes rather than separate room types.

Source: [Configuring Rooms](https://docs.oracle.com/en/industries/hospitality/opera-cloud/23.2/ocsuh/t_rooms_managing_rooms.htm), [Configuring Room Features](https://docs.oracle.com/en/industries/hospitality/opera-cloud/23.4/ocsuh/t_admin_inventory_configuring_room_features.htm)

## Connecting rooms

Available when the "Connecting Rooms" OPERA Control is active. Configured
per room: add a connecting room by searching for and selecting the room to
connect to (a two-way relationship — deletable the same way). This matches
how CheckPoint's Room Guide data already stores a `connecting` field per
room, pointing at its connecting partner's room number.

Source: [Configuring Rooms](https://docs.oracle.com/en/industries/hospitality/opera-cloud/23.2/ocsuh/t_rooms_managing_rooms.htm)

## Room status — three separate axes, easy to conflate

This is the single most important distinction for allocation and is worth
being precise about, since "room status" colloquially gets used for all
three:

### 1. Housekeeping status (room condition)
- **Clean (CL)** — serviced, clean.
- **Dirty (DI)** — needs cleaning.
- **Inspected (IP)** — optional; a supervisor has verified a clean room
  (only shown if the "Inspected Status" Control is active).
- **Pickup (PU)** — optional; a light touch-up only, e.g. a room occupied
  briefly (only shown if the "Pickup Status" Control is active).

### 2. Front Office status
Whether the room is currently occupied or vacant from a guest-in-residence
standpoint (Vacant / Occupied), tracked alongside, not instead of,
housekeeping status.

### 3. Out of Order vs Out of Service — genuinely different, not synonyms
- **Out of Order (OO)**: removed from room **inventory** entirely — not
  available for front-desk assignment, and it reduces the total room count
  used for occupancy calculations (100% occupancy = Inventory Rooms − Out
  of Order rooms). Typically used for longer-term reasons (staff
  accommodation, a dormant seasonal room).
- **Out of Service (OS)**: stays in inventory and **remains sellable /
  assignable** — used for a temporary issue (e.g. a maintenance ticket)
  that doesn't prevent the room from eventually being used. Still counts
  toward total room inventory.

For allocation purposes: a room flagged **OO** should never be suggested.
A room flagged **OS** is a caution, not a hard block — it depends on
whether the issue will be resolved before the guest needs the room, which
is exactly the kind of thing CheckPoint should surface as a warning for
the controller to verify in Opera, not decide on its own.

Sources: [Using the Housekeeping Board](https://docs.oracle.com/en/industries/hospitality/opera-cloud/24.4/ocsuh/t_housekeeping_using_the_housekeeping_board.htm), [Configuring Out of Order and Out of Service Reasons](https://docs.oracle.com/en/industries/hospitality/opera-cloud/25.5/ocsuh/t_configuration_codes_out_of_order_out_of_service.htm), [Managing Out of Service Rooms](https://docs.oracle.com/en/industries/hospitality/opera-cloud/24.2/ocsuh/t_housekeeping_out_of_service.htm), [Managing Out of Order Rooms](https://docs.oracle.com/en/industries/hospitality/opera-cloud/26.2/ocsuh/t_housekeeping_out_of_order.htm)

## Room readiness and assignment workflow

Room Assignment (Front Desk → Front Desk Workspace → Room Assignment) can
filter candidate rooms by housekeeping status (Inspected / Clean / Pickup
checkboxes). ETA/ETD visibility directly in reservation search and quick
edit is specifically called out by Oracle as helping "prioritize room
readiness" and coordinate housekeeping/front desk — the same operational
goal CheckPoint's Allocation Copilot and urgency-tiered key rack serve.

Source: [(Batch) Room Assignment](https://docs.oracle.com/en/industries/hospitality/opera-cloud/23.2/ocsuh/t_front_desk_batch_room_assignment.htm), [Release Readiness Guide](https://docs.oracle.com/en/industries/hospitality/opera-cloud/26.2/oprnc/c_feature_summary.htm)

## Unknown / unconfirmed for this property

- Whether Rixos Bab Al Bahr uses the optional Inspected and Pickup
  statuses, or only Clean/Dirty.
- The property's actual Out of Order / Out of Service reason codes.
- Whether room features here are tracked in OPERA using codes matching
  CheckPoint's existing Room Guide glossary (`BAL`, `GRD`, `COS`, etc. —
  see `../property/rixos-bab-al-bahr.md`), or a different code set inside
  OPERA itself. The Room Guide codes are confirmed as *this app's own*
  reference data, not confirmed as OPERA's literal internal codes.
