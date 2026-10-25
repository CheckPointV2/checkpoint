# CheckPoint — Mastertool

Personal hub linking to Sherif's tools:
- Room Guide (copied in, self-contained)
- Resort Map (`resortmap/`): 3D map of the resort, towers generated from Room Guide's
  `roomguide/data.js` (read-only): every room is a loggia module facing its real outward
  side, the lift hub becomes the mint core and crown. Tower orientation comes from the view
  codes (Beach/Pool View rooms are on grid-north, so each tower is turned 180° to face the sea).
  `towers.mjs` builds the towers, `site.mjs` the grounds, `textures.mjs` paints materials;
  layout guesses (positions, pools, beach) live in `resortmap/config.mjs`.
  Deep link to a room: `#/resortmap/2134`. Three.js r170 is vendored in `resortmap/vendor/` (MIT).
- Departures (external, sherilngar/Checkpoint)
- Email Templates (external, RBABGR)
