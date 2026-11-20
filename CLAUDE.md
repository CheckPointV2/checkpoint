# CheckPoint — notes for Claude

Personal hub for the Rixos Bab Al Bahr rooms controller (Room Guide, Departures, Reports,
Templates, Reminders, Notes). Static site, no build step: `index.html` + `shared/` load each tool.

## Ground rules from the owner
- **Room Guide work happens in this repo's `roomguide/`.** Never touch `sherilngar/Checkpoint`.
- The team's live Room Guide is **`rbabroomguide/rbabroomguide.github.io`**
  (https://rbabroomguide.github.io/, served from its default branch, standalone, own login).
  Since Nov 20 2026 the owner allows reading/reviewing it and preparing changes locally,
  but **nothing is pushed there without the owner's explicit "go"** for that push.
  It was updated on Nov 20 2026 (commit d617b00) with the same Room Guide as CheckPoint plus the
  3D tour button; build it with tools/roomguide/port_to_team_site.py, push to its main branch
  (GitHub Pages "pages build and deployment", ~1 min). The Claude GitHub App is installed there.
- Show a plan / screenshots before building anything big; the owner prefers **simple** UI
  (they asked to remove extra visuals more than once).
- Keep the **Old** Room Guide view exactly as it is. New features go in the **New** view only.
- Don't change the hub password without the owner choosing it (it would lock the team out).

## Where the live site comes from
- GitHub Pages deploys **only from branch `claude/install-code-skills-vf8653`**
  (`.github/workflows/deploy-pages.yml`, ~30 s). Pushing to `main` does **not** deploy.
- Check deploys with the GitHub Actions run list for "Deploy to GitHub Pages".
- Tests: `npm test` (node --test). `tests/roomguide-data.test.js` guards the room counts.

## Room Guide: Old | New switch (live since Nov 2026)
- Manual switch in the Room Guide header, remembered per device (`localStorage`
  `rbab-matrix-version`). Opens on **New** unless the device picked Old (Opera fully switched,
  owner made New the main view on Nov 20). No date-based switching (owner rejected it).
- First-visit tour was rewritten for the new features; key `rbab-tour-seen-v2` so everyone sees it once.
- **Old** = the guide as it was (original codes incl. TWA/TWAOV, original 63 interconnecting pairs).
- **New** = data from `ROOMS_Matrix - UPDATED FILE` (Nov 2026):
  - Room codes **only from the "RN Changed" tab** (276 changed, 426 unchanged).
    Changed rooms get the new code + official name; unchanged rooms are kept exactly as is.
    The 13 PI rooms (1033–1039, 1133–1139) are not in the tab and stay as they are.
  - New counts: DBA 66 · KGA 175 · KGAOV 59 · KGE 172 · KGEOV 77 · SKA 17 · SKB 73 · SKC 29 ·
    SKD 9 · SKP 14 · SXA 11 (+ PI 13). TWA / TWAOV no longer exist.
  - **Bed type** shown only for DBA / KGA / KGAOV, taken from the room's OLD code in the tab:
    TWA/TWAOV = Twin, KGA/KGAOV = King. Owner-confirmed overrides (BED_OVERRIDE in the build
    script): 3249, 3252, 3260, 3350 = King; 3263, 3349 = Twin. Totals: King 183, Twin 117
    (DBA 36/30, KGA 116/59, KGAOV 31/28). Shown as a KING/TWIN badge
    (tile top-right), "· Twin beds" after the name, a Bed type card, search results, Bed filter.
  - Room details also show an Old → New card for rooms whose code changed.
  - **Interconnecting** from the "Interconnecting Rooms" tab: 18 configured pairs, codes renamed
    by the owner: **D2A → D3A (4 pairs), D2C → D3B (9), D2D → D3C (5)**. Shown as a gold dot +
    the full box with the partner room's photo, titled "Interconnecting with Room X · D3x" (owner wants the photo kept here).
    On the plan: SOLID GOLD RING around the tile = configured pair; DASHED black/white ring = PHY.
  - The 53 old pairs that were dropped still have a door: shown as **PHY** — kept SMALL on purpose:
    hollow grey ring, one line "Physically connected to Room X · PHY / Not configured in the system",
    no photo card, "Physical only" filter.
  - 3D (Matterport) tour buttons were removed from all rooms at the owner's request.
  - New-view extras: "Copy N rooms for Opera" button on filter matches (comma list, no spaces,
    no trailing comma — Opera rejects a trailing comma), text search (twin / DBA / D3B / PHY /
    building), KING/TWIN + PHY legend, Overview shows PHY count and King/Twin split.
    Search results also show the connection: "Inter 2158 · D3B" or "PHY 2003" (New view only).
- Late checkout: New view lists **DBA with "Price TBA"** and hides the deleted TWA/TWAOV; Old view
  unchanged. Upsell grid unchanged (no DBA prices yet).

## Updating the room data next time
1. Put the new workbook somewhere local, then from the repo root:
   `python3 tools/roomguide/build_room_data.py "path/to/matrix.xlsx"` (needs `openpyxl`).
   It only reads the "RN Changed" and "Interconnecting Rooms" tabs and is idempotent.
2. Update the expected numbers in `tests/roomguide-data.test.js` if they changed on purpose,
   run `npm test`, check both views in a browser, then push to the deploy branch.

## Open items (need the owner / hotel)
- Upsell grid still uses old interconnecting codes (D2A/D2C, D2B/D2D).
- DBA late-checkout price (currently "TBA") and DBA upgrade prices.
- INT feature tag is inconsistent with real pairs (120 with no pair, 112 pairs without it); left as is.
- Hub password: the old one was written in `shared/app.js` (removed) and is still in git history,
  so it should be changed — owner to choose the new one.
- Team Room Guide login (`RBABFRONT` / its password) is written in plain text in that repo's
  `app.js` — public. Owner to decide on a new one when the team tool is updated.

## History (short)
- Oct 31 2026: October matrix work (Superior, sizes, switch, teal UI) — later fully reverted
  on Nov 20 at the owner's request (reverts, not history rewrites; Matterport kept then).
- Nov 20 2026: rebuilt simply from the updated matrix as described above; security fixes ported
  (xlsx from cdn.sheetjs.com, pdf.js `isEvalSupported:false`, password comment removed).
- Nov 20 2026 (later): bed overrides for 6 rooms, DBA late checkout "TBA", New as default view,
  new tour; team tool reviewed (same app.js/data.js as CheckPoint's first Room Guide copy, all
  715 rooms identical to the Old view) and updated on the owner's go (d617b00).
  Rebuild it any time with `tools/roomguide/port_to_team_site.py` (see its docstring).
  The owner wants 3D (Matterport) tours IN the team tool (they were removed from CheckPoint).
