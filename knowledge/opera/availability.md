# OPERA Cloud — Availability

Tier A (generic OPERA knowledge). Sourced from Oracle's OPERA Cloud Services
User Guide via web search. See `../README.md` for sourcing notes.

## Room-type availability vs. individual-room availability — the key distinction

OPERA tracks availability at two different levels, and CheckPoint's own
Allocation Copilot sits right on this seam:

- **Room-type / inventory availability** ("is there a KGA room type to
  sell") is a *count*, managed through **Property Availability** and
  **Inventory** — house-level and room-type-level sold/available counts,
  sell limits, blocks. This is what confirms a booking is possible at all.
- **Individual-room availability** ("is room 3132 specifically free and
  assignable right now") is a different question, answered by that one
  room's current reservation, housekeeping status, and front office
  status — not by the room-type count.

This is exactly why CheckPoint never claims a *specific* room is
assignable: it can cross-reference a room's booked-type match and (when
Departures data is imported) whether that room appears in *today's*
due-out list — but it has no live feed of OPERA's actual current
room-level status, sell limits, or last-minute changes. That verification
step stays with the controller, in Opera, every time.

## Property Availability

A detailed view of available and sold rooms for each inventory and
component-suite room type, at the House and Room Type level. View Options
control which details display and which levels default when it's opened.

Source: [Property Availability](https://docs.oracle.com/en/industries/hospitality/opera-cloud/26.2/ocsuh/c_availability_availability_ch.htm), [Viewing Property Availability](https://docs.oracle.com/en/industries/hospitality/opera-cloud/26.2/ocsuh/t_availability_viewing_room_availabillity.htm)

## Detailed Availability

Availability broken down by room class (not including pseudo room
classes), with filtering options that depend on the property's license
codes and configuration.

Source: [Detailed Availability](https://docs.oracle.com/cd/E53533_01/opera_5_05_00_core_help/detailed_availability_(ctrl+f2).htm)

## Room Plan

An enhanced, per-room summary of availability — shows each individual
physical room in the property, 15 days at a time. This is the closest
OPERA screen to "which specific rooms are free when", as opposed to
Property/Detailed Availability's type-level counts.

Source: [Room Plan](https://ohdcs.hospitality.oracleindustry.com/OperaHelp/room_plan_(ctrl+f3).htm)

## Inventory and sell limits

- **Inventory** gives the overview of availability split into house and
  room types, including sell limits, channel sell limits, and blocks.
  Refreshes automatically (documented default: every 300 seconds) and
  defaults to showing the next 7 days.
- **Sell limits** set booking caps for a date range at a given level
  (House, Room Class, or Room Type). The effective sell limit is the room
  type's physical inventory plus/minus the configured "sell control"
  adjustment:
  - **Positive** sell control = intentional **overbooking** (compensating
    for expected no-shows/cancellations).
  - **Negative** sell control = intentional **under-booking** (holding
    rooms back from sale).
- **Channel sell limits** apply the same idea per distribution channel.

Sources: [Inventory](https://docs.oracle.com/en/industries/hospitality/opera-cloud-distribution/23.1/ohdug/c_availability_inventory.htm), [Managing Sell Limits](https://docs.oracle.com/en/industries/hospitality/opera-cloud/26.2/ocsuh/t_availability_setting_sell_limits.htm), [Setting Channel Sell Limits](https://docs.oracle.com/en/industries/hospitality/opera-cloud/25.4/ocsuh/t_availability_setting_channel_sell_limits.htm)

## How this maps to what CheckPoint can and can't know

| OPERA concept | Can CheckPoint see it? | How |
| --- | --- | --- |
| Room-type sold/available counts (Property/Detailed Availability) | No | Not imported; no live OPERA connection |
| Sell limits, overbooking/underbooking | No | Not imported |
| A specific room's status *today*, if it's in the imported due-out list | Partially | Cross-referenced from the Departures due-out import — reflects the moment that file was exported, not live |
| A specific room's status if it's *not* in today's due-out list | No | Honestly reported as "not tracked today", never guessed |
| Out of Order / Out of Service flags | Partially | Best-effort text scan of an uploaded Alerts report, not a live feed |

This table is the honest basis for the "CHECK IN OPERA" step that appears
on every Allocation Brief CheckPoint produces — it exists precisely because
of this gap.
