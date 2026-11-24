#!/usr/bin/env python3
"""Rebuild the Room Guide's "New" view data from the rooms matrix workbook.

Usage (from the repo root):
    python3 tools/roomguide/build_room_data.py "ROOMS_Matrix - UPDATED FILE.xlsx"
    npm test          # then check the counts still pass (tests/roomguide-data.test.js)

What it reads from the workbook (nothing else):
  * "RN Changed" tab  - Room Number | Change FROM ROOM TYPE | Change TO ROOM TYPE | Status
  * "Interconnecting Rooms" tab - the approved interconnecting pairs and their codes

What it writes into roomguide/data.js (the Old view data is never changed):
  * type / description      - the New view code and name. "Unchanged" rooms keep
                              their current code and description exactly as is.
  * prevType / prevDescription - the Old view code and name (today's guide)
  * bed                     - "King" / "Twin" for new DBA / KGA / KGAOV rooms only,
                              from the room's OLD code: TWA/TWAOV = Twin, KGA/KGAOV = King
  * connectingNew, icCodeNew - New view interconnecting partner + code
                              (D2A -> D3A, D2C -> D3B, D2D -> D3C)
  * physicalNew             - old pairs that are no longer configured (shown as PHY)
  * typeDesc / typeDescOld  - category names for the New / Old view
Rooms that are not in the RN Changed tab (the 13 PI rooms) are left as they are.
The script is idempotent: running it twice gives the same file.
"""
import json
import sys
import warnings
from pathlib import Path

warnings.filterwarnings("ignore", module="openpyxl")  # the workbook's conditional formatting is irrelevant here

try:
    import openpyxl
except ImportError:
    sys.exit("Needs openpyxl:  pip install openpyxl")

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "roomguide" / "data.js"

BED_FROM_OLD_CODE = {"TWA": "Twin", "TWAOV": "Twin", "KGA": "King", "KGAOV": "King"}
BED_SHOWN_FOR = {"DBA", "KGA", "KGAOV"}
DELETED_CODES = {"TWA", "TWAOV"}
# Rooms where the RN Changed tab's FROM code disagreed with the guide's old data;
# bed type confirmed by the owner on 20 Nov 2026 (takes priority over the rule above).
BED_OVERRIDE = {"3249": "King", "3252": "King", "3260": "King", "3350": "King", "3263": "Twin", "3349": "Twin"}
IC_CODE = {"D2A": "D3A", "D2C": "D3B", "D2D": "D3C"}
NEW_NAME = {
    "DBA": "Superior Room", "KGA": "Deluxe Room Garden View", "KGAOV": "Deluxe Room Sea/Pool View",
    "KGE": "Premium Room Garden View", "KGEOV": "Premium Room Sea/Pool View", "SKA": "Kids Escape Family Suite",
    "SKB": "Two Bedroom Family Suite Garden View", "SKC": "Two Bedroom Family Suite Sea/Pool View",
    "SKD": "Two Bedroom Junior Suite", "SKP": "Three Bedroom Senior Suite", "SXA": "Three Bedroom King Suite",
}


def read_rn_changed(wb):
    ws = wb["RN Changed"]
    header = [c.value for c in ws[1]][:4]
    assert header == ["Room Number", "Change FROM ROOM TYPE", "Change TO ROOM TYPE", "Status"], header
    rows = {}
    for r in ws.iter_rows(min_row=2, values_only=True):
        if r[0] is None:
            continue
        room = str(int(r[0]))
        assert room not in rows, f"duplicate room {room} in RN Changed"
        rows[room] = (str(r[1]).strip(), str(r[2]).strip(), str(r[3]).strip())
    return rows


def read_interconnecting(wb):
    ws = wb["Interconnecting Rooms"]
    header = [c.value for c in ws[5]]
    assert header[0] == "Room no." and header[6] == "Connected room numbers" and header[11] == "INTERCONNECTING CODE", header
    pairs = {}
    for r in ws.iter_rows(min_row=6, values_only=True):
        if not isinstance(r[0], (int, float)):
            continue
        room = str(int(r[0]))
        a, b = [x.strip() for x in str(r[6]).split("/")]
        assert room in (a, b), f"{room} not in its own pair {r[6]}"
        assert r[11] in IC_CODE, f"unknown interconnecting code {r[11]} for {room}"
        pairs[room] = (int(b if a == room else a), IC_CODE[r[11]])
    for room, (other, code) in pairs.items():
        assert pairs.get(str(other)) == (int(room), code), f"pair {room}/{other} not listed both ways with the same code"
    return pairs


def main(xlsx):
    wb = openpyxl.load_workbook(xlsx, data_only=True)
    rn = read_rn_changed(wb)
    ic = read_interconnecting(wb)

    text = DATA.read_text(encoding="utf-8")
    prefix = text[:text.index("{")]
    data = json.loads(text[text.index("{"):text.rindex("}") + 1])
    old_desc = data.get("typeDescOld") or data["typeDesc"]

    for building in data["buildings"].values():
        for room in building["rooms"].values():
            # Old view = today's guide. On a first run that's type/description;
            # on later runs it's already stored in prevType/prevDescription.
            old_type = room.get("prevType", room["type"])
            old_desc_room = room.get("prevDescription", room["description"])
            key = str(room["room"])
            for f in ("prevType", "prevDescription", "bed", "connectingNew", "icCodeNew", "physicalNew"):
                room.pop(f, None)
            room["type"], room["description"] = old_type, old_desc_room
            if key in rn:  # rooms not in the tab (e.g. Posting Interface) keep their code in both views
                frm, to, status = rn[key]
                room["prevType"], room["prevDescription"] = old_type, old_desc_room
                # "Unchanged" means the room keeps its CURRENT code (checked against Opera on
                # 24 Nov 2026: 2350 stays KGAOV, 2354 stays KGA even though the tab says
                # otherwise). Only rooms whose current code was deleted (TWA/TWAOV) take the
                # tab's code (3263, 3349 -> KGAOV).
                keep = status == "Unchanged" and old_type not in DELETED_CODES
                if not keep:
                    assert to in NEW_NAME, f"no name for new code {to}"
                    room["type"], room["description"] = to, NEW_NAME[to]
                if room["type"] in BED_SHOWN_FOR:
                    # Bed comes from the room's current (old) code — the owner confirmed this
                    # for every room where the tab's FROM code disagreed.
                    assert old_type in BED_FROM_OLD_CODE, f"{key}: no bed rule for old code {old_type}"
                    room["bed"] = BED_OVERRIDE.get(key, BED_FROM_OLD_CODE[old_type])
            partner, code = ic.get(key, (None, None))
            room["connectingNew"], room["icCodeNew"] = partner, code
            old_partner = room.get("connecting")
            room["physicalNew"] = old_partner if (old_partner is not None and old_partner != partner and partner is None) else None

    rest = {k: v for k, v in data.items() if k not in ("typeDesc", "typeDescOld")}
    out = {"typeDesc": {**NEW_NAME, "PI": old_desc.get("PI", "Posting Interface")}, "typeDescOld": old_desc, **rest}
    DATA.write_text(prefix + json.dumps(out, ensure_ascii=False) + ";\n", encoding="utf-8")
    print(f"Updated {DATA.relative_to(ROOT)} from {Path(xlsx).name}: {len(rn)} rooms in RN Changed, {len(ic) // 2} interconnecting pairs")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
