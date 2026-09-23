/* RBAB Room Guide — Rixos Bab Al Bahr
   Reads RBAB_DATA (from data.js) and renders a building- and floor-tabbed,
   interactive room guide with filtering, a coverage dashboard, a feature
   glossary, dark mode, and recently-viewed rooms. */

const TYPE_COLOR = {
  KGA: "var(--c-kga)", KGAOV: "var(--c-kgaov)", KGE: "var(--c-kge)", KGEOV: "var(--c-kgeov)",
  TWA: "var(--c-twa)", TWAOV: "var(--c-twaov)", SKA: "var(--c-ska)", SKB: "var(--c-skb)",
  SKC: "var(--c-skc)", SKD: "var(--c-skd)", SKP: "var(--c-skp)", SXA: "var(--c-sxa)", PI: "var(--c-pi)",
};

// Upsell grid + late checkout reference data
const UPSELL_TIERS = [{"key": "t1", "label": "Occupancy 85\u2013100%", "extraPax": 570, "grid": {"KGA": {"KGAOV": 90, "KGE": 180, "KGEOV": 270, "SKA": 1170, "SKB": 1260, "SKC": 1350, "D2A/D2C": 1485, "D2B/D2D": 1575, "SKD": 1710, "SKP": 2250, "SXA": 3150}, "KGAOV": {"KGE": 90, "KGEOV": 180, "SKA": 1080, "SKB": 1170, "SKC": 1260, "D2A/D2C": 1395, "D2B/D2D": 1485, "SKD": 1620, "SKP": 2160, "SXA": 3060}, "KGE": {"KGEOV": 90, "SKA": 990, "SKB": 1080, "SKC": 1170, "D2A/D2C": 1305, "D2B/D2D": 1395, "SKD": 1530, "SKP": 2070, "SXA": 2970}, "KGEOV": {"SKA": 900, "SKB": 990, "SKC": 1080, "D2A/D2C": 1215, "D2B/D2D": 1305, "SKD": 1440, "SKP": 1980, "SXA": 2880}, "SKA": {"SKB": 90, "SKC": 180, "SKD": 540, "SKP": 1080, "SXA": 1980}, "SKB": {"SKC": 90, "SKD": 450, "SKP": 990, "SXA": 1890}, "SKC": {"SKD": 360, "SKP": 900, "SXA": 1800}, "D2A/D2C": {"D2B/D2D": 90, "SKD": 225, "SKP": 765, "SXA": 1665}, "D2B/D2D": {"SKD": 135, "SKP": 675, "SXA": 1575}, "SKD": {"SKP": 540, "SXA": 1440}, "SKP": {"SXA": 900}}}, {"key": "t2", "label": "Occupancy 70\u201385%", "extraPax": 570, "grid": {"KGA": {"KGAOV": 70, "KGE": 140, "KGEOV": 210, "SKA": 910, "SKB": 980, "SKC": 1050, "D2A/D2C": 1155, "D2B/D2D": 1225, "SKD": 1330, "SKP": 1750, "SXA": 2450}, "KGAOV": {"KGE": 70, "KGEOV": 140, "SKA": 840, "SKB": 910, "SKC": 980, "D2A/D2C": 1085, "D2B/D2D": 1155, "SKD": 1260, "SKP": 1680, "SXA": 2380}, "KGE": {"KGEOV": 70, "SKA": 770, "SKB": 840, "SKC": 910, "D2A/D2C": 1015, "D2B/D2D": 1085, "SKD": 1190, "SKP": 1610, "SXA": 2310}, "KGEOV": {"SKA": 700, "SKB": 770, "SKC": 840, "D2A/D2C": 945, "D2B/D2D": 1015, "SKD": 1120, "SKP": 1540, "SXA": 2240}, "SKA": {"SKB": 70, "SKC": 140, "SKD": 420, "SKP": 840, "SXA": 1540}, "SKB": {"SKC": 70, "SKD": 350, "SKP": 770, "SXA": 1470}, "SKC": {"SKD": 280, "SKP": 700, "SXA": 1400}, "D2A/D2C": {"D2B/D2D": 70, "SKD": 175, "SKP": 595, "SXA": 1295}, "D2B/D2D": {"SKD": 105, "SKP": 525, "SXA": 1225}, "SKD": {"SKP": 420, "SXA": 1120}, "SKP": {"SXA": 700}}}, {"key": "t3", "label": "Occupancy 50\u201370%", "extraPax": 485, "grid": {"KGA": {"KGAOV": 60, "KGE": 120, "KGEOV": 180, "SKA": 780, "SKB": 840, "SKC": 900, "D2A/D2C": 990, "D2B/D2D": 1050, "SKD": 1140, "SKP": 1500, "SXA": 2100}, "KGAOV": {"KGE": 60, "KGEOV": 120, "SKA": 720, "SKB": 780, "SKC": 840, "D2A/D2C": 930, "D2B/D2D": 990, "SKD": 1080, "SKP": 1440, "SXA": 2040}, "KGE": {"KGEOV": 60, "SKA": 660, "SKB": 720, "SKC": 780, "D2A/D2C": 870, "D2B/D2D": 930, "SKD": 1020, "SKP": 1380, "SXA": 1980}, "KGEOV": {"SKA": 600, "SKB": 660, "SKC": 720, "D2A/D2C": 810, "D2B/D2D": 870, "SKD": 960, "SKP": 1320, "SXA": 1920}, "SKA": {"SKB": 60, "SKC": 120, "SKD": 360, "SKP": 720, "SXA": 1320}, "SKB": {"SKC": 60, "SKD": 300, "SKP": 660, "SXA": 1260}, "SKC": {"SKD": 240, "SKP": 600, "SXA": 1200}, "D2A/D2C": {"D2B/D2D": 60, "SKD": 150, "SKP": 510, "SXA": 1110}, "D2B/D2D": {"SKD": 90, "SKP": 450, "SXA": 1050}, "SKD": {"SKP": 360, "SXA": 960}, "SKP": {"SXA": 600}}}, {"key": "t4", "label": "Occupancy <50% or 4+ Nights", "extraPax": 425, "grid": {"KGA": {"KGAOV": 50, "KGE": 100, "KGEOV": 150, "SKA": 650, "SKB": 700, "SKC": 750, "D2A/D2C": 825, "D2B/D2D": 875, "SKD": 950, "SKP": 1250, "SXA": 1750}, "KGAOV": {"KGE": 50, "KGEOV": 100, "SKA": 600, "SKB": 650, "SKC": 700, "D2A/D2C": 775, "D2B/D2D": 825, "SKD": 900, "SKP": 1200, "SXA": 1700}, "KGE": {"KGEOV": 50, "SKA": 550, "SKB": 600, "SKC": 650, "D2A/D2C": 725, "D2B/D2D": 775, "SKD": 850, "SKP": 1150, "SXA": 1650}, "KGEOV": {"SKA": 500, "SKB": 550, "SKC": 600, "D2A/D2C": 675, "D2B/D2D": 725, "SKD": 800, "SKP": 1100, "SXA": 1600}, "SKA": {"SKB": 50, "SKC": 100, "SKD": 300, "SKP": 600, "SXA": 1100}, "SKB": {"SKC": 50, "SKD": 250, "SKP": 550, "SXA": 1050}, "SKC": {"SKD": 200, "SKP": 500, "SXA": 1000}, "D2A/D2C": {"D2B/D2D": 50, "SKD": 125, "SKP": 425, "SXA": 925}, "D2B/D2D": {"SKD": 75, "SKP": 375, "SXA": 875}, "SKD": {"SKP": 300, "SXA": 800}, "SKP": {"SXA": 500}}}];
const LATE_CHECKOUT_DATA = [{"category": "Deluxe", "time": "16:00", "charges": 400, "room": 300, "fb": 100}, {"category": "Deluxe", "time": "18:00", "charges": 600, "room": 450, "fb": 150}, {"category": "Premium / Family Suite / Interconnecting", "time": "16:00", "charges": 600, "room": 450, "fb": 150}, {"category": "Premium / Family Suite / Interconnecting", "time": "18:00", "charges": 800, "room": 600, "fb": 200}, {"category": "All Suites", "time": "16:00", "charges": 750, "room": 562.5, "fb": 187.5}, {"category": "All Suites", "time": "18:00", "charges": 950, "room": 712.5, "fb": 237.5}];


const TYPE_DESC = {
  KGA: "Deluxe King Garden", KGAOV: "Deluxe King View", KGE: "Premium King Garden", KGEOV: "Premium King View",
  PI: "Posting Interface", SKA: "Kids Escape Suite", SKB: "Family Room Garden", SKC: "Family Room View",
  SKD: "Junior Suite", SKP: "Senior Suite", SXA: "King Suite", TWA: "Deluxe Twin Garden", TWAOV: "Deluxe Twin View",
};

// Feature code meanings, confirmed against the hotel's official Opera code list.
const GLOSSARY = {
  BAL:    { label: "Balcony", conf: "high" },
  NBA:    { label: "No Balcony", conf: "high" },
  S:      { label: "Small Balcony", conf: "high" },
  KGB:    { label: "King Bed", conf: "high" },
  TWB:    { label: "Twin Bed", conf: "high" },
  BBE:    { label: "Bunk Bed", conf: "high" },
  SOF:    { label: "Sofa Cum Bed", conf: "high" },
  "1EXBED": { label: "1 Extra Bed Space in Room", conf: "high" },
  "2EXBED": { label: "2 Extra Bed Space in Room", conf: "high" },
  GAR:    { label: "Garden View", conf: "high" },
  GRD:    { label: "Ground Floor", conf: "high" },
  POO:    { label: "Pool View", conf: "high" },
  BEA:    { label: "Beach View", conf: "high" },
  ROA:    { label: "Road View", conf: "high" },
  CAV:    { label: "Car Park View", conf: "high" },
  MAN:    { label: "Main Entrance View", conf: "high" },
  COS:    { label: "Corniche Sea View", conf: "high" },
  TER:    { label: "Terrace", conf: "high" },
  NSM:    { label: "Non-Smoking", conf: "high" },
  HCA:    { label: "Disabled Room (Handicap Accessible)", conf: "high" },
  INT:    { label: "Interconnecting Room", conf: "high" },
  KTC:    { label: "Kitchenette", conf: "high" },
  COR:    { label: "Corner Room", conf: "high" },
  SA:     { label: "Small Room, No Extra Bed Space", conf: "high" },
  ZMR:    { label: "Zumroud (building reference)", conf: "high" },
  AMJ:    { label: "Amwaj (building reference)", conf: "high" },
  MRM:    { label: "Marmar (building reference)", conf: "high" },
  "1ST": { label: "First Floor", conf: "high" }, "2ND": { label: "Second Floor", conf: "high" },
  "3RD": { label: "Third Floor", conf: "high" }, "4TH": { label: "Fourth Floor", conf: "high" },
  "5TH": { label: "Fifth Floor", conf: "high" }, "6TH": { label: "Sixth Floor", conf: "high" },
  "7TH": { label: "Seventh Floor", conf: "high" }, "8TH": { label: "Eighth Floor", conf: "high" },
};

const isTouch = window.matchMedia("(hover: none), (pointer: coarse)").matches;

let currentBuilding = null;
let currentFloor = null;
let activeRoom = null;
let filters = { types: new Set(), codes: new Set(), connectOnly: false };

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function typeColor(type) { return TYPE_COLOR[type] || "var(--c-pi)"; }

// Normalize inconsistent capitalization/spacing straight from the sheet
function titleCase(str) {
  if (!str) return "";
  const cleaned = str.replace(/\s+/g, " ").trim();
  return cleaned.toLowerCase().split(" ").map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
}

function imgPath(building, roomNum) { return `images/${building}/${roomNum}.jpg`; }
function thumbPath(building, roomNum) { return `thumbs/${building}/${roomNum}.jpg`; }
function buildingData(key) { return RBAB_DATA.buildings[key]; }

function findRoomAnyBuilding(roomNum) {
  for (const bkey of RBAB_DATA.buildingOrder) {
    const b = buildingData(bkey);
    if (b.rooms[String(roomNum)]) return { building: bkey, room: b.rooms[String(roomNum)] };
  }
  return null;
}

/* ================= Theme ================= */
function initTheme() {
  const saved = localStorage.getItem("rbab-theme");
  const theme = saved || "light";
  document.documentElement.dataset.theme = theme;
  updateThemeIcon(theme);
}
function toggleTheme() {
  const cur = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("rbab-theme", next);
  updateThemeIcon(next);
}
function updateThemeIcon(theme) {
  const btn = $("#themeToggle");
  if (!btn) return;
  btn.innerHTML = theme === "dark"
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`;
}

/* ================= Recently viewed ================= */
function getRecent() {
  try { return JSON.parse(localStorage.getItem("rbab-recent") || "[]"); } catch (e) { return []; }
}
function addRecent(bkey, roomNum) {
  let recent = getRecent().filter((r) => !(r.b === bkey && r.r === roomNum));
  recent.unshift({ b: bkey, r: roomNum });
  recent = recent.slice(0, 8);
  localStorage.setItem("rbab-recent", JSON.stringify(recent));
}
function renderRecent() {
  const recent = getRecent();
  const wrap = $("#recentWrap");
  if (!recent.length) { wrap.innerHTML = ""; return; }
  let html = `<div class="recent-label">Recently viewed</div><div class="recent-strip">`;
  recent.forEach((r) => {
    const b = buildingData(r.b);
    if (!b || !b.rooms[String(r.r)]) return;
    html += `<button class="rchip" data-b="${r.b}" data-r="${r.r}">${r.r}</button>`;
  });
  html += `</div>`;
  wrap.innerHTML = html;
  $$(".rchip", wrap).forEach((btn) => {
    btn.addEventListener("click", () => showDetail(btn.dataset.b, Number(btn.dataset.r)));
  });
}

/* ================= Building / floor tabs ================= */
function buildBuildingTabs() {
  const wrap = $("#buildingTabs");
  wrap.innerHTML = "";
  RBAB_DATA.buildingOrder.forEach((key) => {
    const b = buildingData(key);
    const btn = document.createElement("button");
    btn.textContent = b.label;
    btn.dataset.building = key;
    btn.addEventListener("click", () => selectBuilding(key));
    wrap.appendChild(btn);
  });
}

function selectBuilding(key) {
  currentBuilding = key;
  $$("#buildingTabs button").forEach((b) => b.classList.toggle("active", b.dataset.building === key));
  buildFloorTabs();
  selectFloor(buildingData(key).floorOrder[0]);
}

function buildFloorTabs() {
  const b = buildingData(currentBuilding);
  const wrap = $("#floorTabs");
  wrap.innerHTML = "";

  b.floorOrder.forEach((key) => {
    const f = b.floors[key];
    const btn = document.createElement("button");
    btn.textContent = f.label;
    btn.dataset.floor = key;
    btn.addEventListener("click", () => selectFloor(key));
    wrap.appendChild(btn);
  });
}

function selectFloor(key) {
  currentFloor = key;
  filters = { types: new Set(), codes: new Set(), connectOnly: false };
  $$("#floorTabs button").forEach((btn) => btn.classList.toggle("active", btn.dataset.floor === key));
  renderFloor(key);
  clearDetail();
}

function stepFloor(delta) {
  const b = buildingData(currentBuilding);
  const idx = b.floorOrder.indexOf(currentFloor);
  const next = idx + delta;
  if (next >= 0 && next < b.floorOrder.length) selectFloor(b.floorOrder[next]);
}

/* ================= Grid rendering ================= */
function roomsForFloor(bkey, fkey) {
  return Object.values(buildingData(bkey).rooms).filter((r) => r.floor === fkey);
}

function renderFloor(key) {
  const grid = $("#grid");
  grid.classList.add("transitioning");
  renderFloorContent(key);
  requestAnimationFrame(() => requestAnimationFrame(() => grid.classList.remove("transitioning")));
}

function renderFloorContent(key) {
  const b = buildingData(currentBuilding);
  const f = b.floors[key];
  const rooms = roomsForFloor(currentBuilding, key);

  $("#floorTitle").textContent = f.label;
  $("#roomCount").textContent = rooms.length;
  const withConnect = rooms.filter((r) => r.connecting != null).length;
  $("#connectCount").textContent = withConnect;
  const noPhoto = rooms.filter((r) => !r.hasPhoto && r.type !== "PI").length;
  const photoStat = $("#photoStat");
  if (noPhoto > 0) { $("#noPhotoCount").textContent = noPhoto; photoStat.style.display = ""; }
  else { photoStat.style.display = "none"; }

  const grid = $("#grid");
  grid.innerHTML = "";
  const tileSize = isTouch ? 48 : 62;
  grid.style.gridTemplateColumns = `repeat(${f.cols}, ${tileSize}px)`;
  grid.style.gridTemplateRows = `repeat(${f.rows}, ${tileSize}px)`;

  rooms.forEach((r) => {
    const tile = document.createElement("div");
    tile.className = "tile room-tile";
    tile.dataset.room = r.room;
    tile.style.gridColumn = r.col + 1;
    tile.style.gridRow = r.row + 1;

    if (r.hasPhoto) {
      tile.classList.add("has-thumb");
      tile.style.backgroundImage = `linear-gradient(to bottom, rgba(20,15,10,0.18), rgba(20,15,10,0.62)), url(${thumbPath(currentBuilding, r.room)})`;
      tile.innerHTML = `<span class="type-dot" style="background:${typeColor(r.type)}"></span><div class="rnum">${r.room}</div><div class="rtype">${r.type}</div>`;
    } else {
      tile.style.background = typeColor(r.type);
      tile.classList.add("no-photo");
      tile.innerHTML = `<div class="rnum">${r.room}</div><div class="rtype">${r.type}</div>`;
    }

    if (r.connecting != null) tile.classList.add("link-badge");
    attachRoomEvents(tile, r.room);
    grid.appendChild(tile);
  });

  f.facilities.forEach((fac) => {
    const tile = document.createElement("div");
    tile.className = "tile facility";
    if (fac.label === "Atrium") tile.classList.add("atrium");
    tile.style.gridColumn = fac.col + 1;
    tile.style.gridRow = fac.row + 1;
    tile.textContent = fac.label;
    grid.appendChild(tile);
  });

  buildLegend(rooms);
  buildFilterBar(rooms);
}

function attachRoomEvents(tile, roomNum) {
  if (!isTouch) tile.addEventListener("mouseenter", () => showDetail(currentBuilding, roomNum));
  tile.addEventListener("click", () => {
    if (isTouch && activeRoom === roomNum) clearDetail();
    else showDetail(currentBuilding, roomNum);
  });
}

/* ================= Building overview (all buildings, modal) ================= */
function openOverview() {
  let html = "";
  RBAB_DATA.buildingOrder.forEach((bkey) => {
    const b = buildingData(bkey);
    const allRooms = Object.values(b.rooms);
    const guestRooms = allRooms.filter((r) => r.type !== "PI");
    const withPhoto = guestRooms.filter((r) => r.hasPhoto).length;
    const pct = Math.round((withPhoto / guestRooms.length) * 100);
    const withConnect = allRooms.filter((r) => r.connecting != null).length;

    const typeCounts = {};
    guestRooms.forEach((r) => { typeCounts[r.type] = (typeCounts[r.type] || 0) + 1; });
    const maxCount = Math.max(...Object.values(typeCounts));

    html += `<div class="ov-building-block">
      <h3 class="ov-building-heading">${b.label}</h3>
      <div class="overview-stats">
        <div class="ov-stat-card"><div class="ov-num">${allRooms.length}</div><div class="ov-label">Total Rooms</div></div>
        <div class="ov-stat-card"><div class="ov-num">${b.floorOrder.length}</div><div class="ov-label">Floors</div></div>
        <div class="ov-stat-card"><div class="ov-num">${withConnect}</div><div class="ov-label">Interconnecting</div></div>
        <div class="ov-stat-card"><div class="ov-num">${pct}%</div><div class="ov-label">Photo Coverage</div></div>
      </div>

      <div class="ov-type-bars">`;
    Object.entries(typeCounts).sort((a, b2) => b2[1] - a[1]).forEach(([t, count]) => {
      html += `<div class="ov-type-row">
        <span class="ov-type-label">${t}</span>
        <span class="ov-type-track"><span class="ov-type-fill" style="width:${(count / maxCount) * 100}%; background:${typeColor(t)}"></span></span>
        <span class="ov-type-count">${count}</span>
      </div>`;
    });
    html += `</div><div class="ov-floor-list">`;

    b.floorOrder.forEach((fkey) => {
      const f = b.floors[fkey];
      const floorRooms = allRooms.filter((r) => r.floor === fkey);
      const floorGuestRooms = floorRooms.filter((r) => r.type !== "PI");
      const floorPhoto = floorGuestRooms.filter((r) => r.hasPhoto).length;
      const floorPct = floorGuestRooms.length ? Math.round((floorPhoto / floorGuestRooms.length) * 100) : 100;
      html += `<div class="ov-floor-card" data-building="${bkey}" data-floor="${fkey}">
        <span class="ov-floor-name">${f.label}</span>
        <span class="ov-floor-bar"><span class="ov-floor-fill" style="width:${floorPct}%"></span></span>
        <span class="ov-floor-stat">${floorRooms.length} rooms · ${floorPct}% photographed</span>
        <span class="ov-floor-arrow">→</span>
      </div>`;
    });
    html += `</div></div>`;
  });

  const wrap = $("#overviewBody");
  wrap.innerHTML = html;
  $$(".ov-floor-card", wrap).forEach((card) => {
    card.addEventListener("click", () => {
      closeOverview();
      selectBuilding(card.dataset.building);
      selectFloor(card.dataset.floor);
    });
  });

  $("#overviewModal").classList.add("show");
}
function closeOverview() { $("#overviewModal").classList.remove("show"); }


/* ================= Legend ================= */
function buildLegend(rooms) {
  const types = Array.from(new Set(rooms.map((r) => r.type))).sort();
  const legend = $("#legend");
  legend.innerHTML = "";
  types.forEach((t) => {
    const sample = rooms.find((r) => r.type === t);
    const label = titleCase(sample ? sample.description : t);
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `<span class="swatch" style="background:${typeColor(t)}"></span>${t} — ${label}`;
    legend.appendChild(item);
  });
  legend.insertAdjacentHTML("beforeend", `
    <div class="item"><span class="swatch" style="background:var(--c-facility)"></span>Elevator</div>
    <div class="item"><span class="swatch" style="background:var(--c-atrium)"></span>Atrium</div>
    <div class="item"><span class="swatch" style="background:var(--gold-accent)"></span>Interconnecting room</div>
  `);
}

/* ================= Filter bar ================= */
function buildFilterBar(rooms) {
  const bar = $("#filterBar");
  bar.innerHTML = "";

  const allRooms = allRoomsFlat().map((x) => x.room);

  const typeOptions = Array.from(new Set(allRooms.map((r) => r.type))).sort()
    .map((t) => ({ value: t, desc: TYPE_DESC[t] || "" }));
  buildDropdownFilter(bar, "Category", typeOptions, filters.types, () => applyFilters());

  const codeOptions = Array.from(new Set(allRooms.flatMap((r) => r.codes))).sort()
    .map((c) => ({ value: c, desc: GLOSSARY[c] ? GLOSSARY[c].label : "Meaning not yet confirmed" }));
  buildDropdownFilter(bar, "Features", codeOptions, filters.codes, () => applyFilters());

  const sep2 = document.createElement("div");
  sep2.className = "filter-sep";
  bar.appendChild(sep2);

  const connChip = document.createElement("button");
  connChip.className = "filter-chip";
  connChip.textContent = "Interconnecting only";
  connChip.classList.toggle("active", filters.connectOnly);
  connChip.addEventListener("click", () => {
    filters.connectOnly = !filters.connectOnly;
    connChip.classList.toggle("active");
    applyFilters();
  });
  bar.appendChild(connChip);

  const clear = document.createElement("button");
  clear.className = "filter-clear";
  clear.textContent = "Clear filters";
  clear.style.display = "none";
  clear.addEventListener("click", () => {
    filters = { types: new Set(), codes: new Set(), connectOnly: false };
    buildFilterBar(rooms);
    applyFilters();
  });
  bar.appendChild(clear);

  const count = document.createElement("span");
  count.className = "filter-match-count";
  count.id = "filterMatchCount";
  bar.appendChild(count);

  applyFilters();
}

function buildDropdownFilter(bar, label, options, selectedSet, onChange) {
  const wrap = document.createElement("div");
  wrap.className = "fdrop";

  const btn = document.createElement("button");
  btn.className = "fdrop-btn";
  btn.innerHTML = `${label} <span class="fdrop-count">${selectedSet.size}</span> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>`;
  wrap.appendChild(btn);

  const panel = document.createElement("div");
  panel.className = "fdrop-panel";
  panel.innerHTML = `
    <div class="fdrop-search-wrap"><input type="text" class="fdrop-search" placeholder="Search ${label.toLowerCase()}..."></div>
    <div class="fdrop-list"></div>`;
  wrap.appendChild(panel);

  const list = $(".fdrop-list", panel);
  const searchInput = $(".fdrop-search", panel);

  function renderList(filterText) {
    const q = (filterText || "").trim().toLowerCase();
    const filtered = options.filter((o) => !q || o.value.toLowerCase().includes(q) || o.desc.toLowerCase().includes(q));
    if (!filtered.length) {
      list.innerHTML = `<div class="fdrop-empty">No matches</div>`;
      return;
    }
    list.innerHTML = filtered.map((o) => `
      <label class="fdrop-item">
        <input type="checkbox" value="${o.value}" ${selectedSet.has(o.value) ? "checked" : ""}>
        <span class="fdrop-item-main"><b>${o.value}</b>${o.desc ? `<span class="fdrop-item-desc">${o.desc}</span>` : ""}</span>
      </label>`).join("");
    $$('input[type="checkbox"]', list).forEach((cb) => {
      cb.addEventListener("change", () => {
        if (cb.checked) selectedSet.add(cb.value); else selectedSet.delete(cb.value);
        updateBtnState();
        onChange();
      });
    });
  }

  function updateBtnState() {
    btn.classList.toggle("has-selection", selectedSet.size > 0);
    $(".fdrop-count", btn).textContent = selectedSet.size;
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const wasOpen = wrap.classList.contains("open");
    $$(".fdrop.open").forEach((el) => el.classList.remove("open"));
    if (!wasOpen) {
      wrap.classList.add("open");
      renderList("");
      searchInput.value = "";
      searchInput.focus();
    }
  });
  searchInput.addEventListener("input", () => renderList(searchInput.value));
  panel.addEventListener("click", (e) => e.stopPropagation());

  updateBtnState();
  bar.appendChild(wrap);
}

function filtersActive() {
  return filters.types.size || filters.codes.size || filters.connectOnly;
}

function roomMatchesFilters(r) {
  if (filters.types.size && !filters.types.has(r.type)) return false;
  if (filters.codes.size) {
    for (const c of filters.codes) { if (!r.codes.includes(c)) return false; }
  }
  if (filters.connectOnly && r.connecting == null) return false;
  return true;
}

function applyFilters() {
  const rooms = roomsForFloor(currentBuilding, currentFloor);
  const active = filtersActive();
  let matchCount = 0;

  rooms.forEach((r) => {
    const tile = $(`.tile.room-tile[data-room="${r.room}"]`);
    if (!tile) return;
    const match = roomMatchesFilters(r);
    tile.classList.toggle("filtered-out", active && !match);
    if (match) matchCount++;
  });

  const clearBtn = $(".filter-clear", $("#filterBar"));
  const countEl = $("#filterMatchCount");
  if (clearBtn) clearBtn.style.display = active ? "" : "none";
  if (countEl) countEl.textContent = active ? `${matchCount} of ${rooms.length} match` : "";

  renderCrossBuildingPanel(active);
}

/* ================= Cross-building matches ================= */
function renderCrossBuildingPanel(active) {
  const panel = $("#crossPanel");
  if (!active) { panel.style.display = "none"; return; }
  panel.style.display = "";

  let html = "";

  RBAB_DATA.buildingOrder.forEach((bkey) => {
    const b = buildingData(bkey);
    const matches = Object.values(b.rooms)
      .filter(roomMatchesFilters)
      .sort((a, c) => a.room - c.room);
    html += `<div class="cross-group">
      <div class="cross-group-label">${b.label} <span class="cnt">(${matches.length})</span></div>
      <div class="cross-list">`;
    if (matches.length) {
      matches.forEach((r) => {
        html += `<span class="cross-chip" data-b="${bkey}" data-r="${r.room}">${r.room}</span>`;
      });
    } else {
      html += `<span class="cross-empty">No matches</span>`;
    }
    html += `</div></div>`;
  });

  $("#crossBody").innerHTML = html;

  $$(".cross-chip", $("#crossBody")).forEach((chip) => {
    const bkey = chip.dataset.b;
    const rnum = chip.dataset.r;
    const room = buildingData(bkey).rooms[rnum];

    chip.addEventListener("click", () => showDetail(bkey, Number(rnum)));

    if (room.hasPhoto) {
      chip.addEventListener("mouseenter", () => {
        const hp = $("#hoverPreview");
        $("#hpImg").src = thumbPath(bkey, rnum);
        hp.classList.add("show");
      });
      chip.addEventListener("mousemove", (e) => {
        const hp = $("#hoverPreview");
        let left = e.clientX + 16;
        let top = e.clientY + 16;
        if (left + 200 > window.innerWidth) left = e.clientX - 216;
        if (top + 113 > window.innerHeight) top = e.clientY - 129;
        hp.style.left = left + "px";
        hp.style.top = top + "px";
      });
      chip.addEventListener("mouseleave", () => {
        $("#hoverPreview").classList.remove("show");
      });
    }
  });
}

/* ================= Detail panel ================= */
function clearDetail() {
  activeRoom = null;
  $("#detailEmpty").style.display = "flex";
  $("#detailRoom").classList.remove("show");
  $$(".tile.room-tile").forEach((t) => t.classList.remove("active", "linked", "dim"));
  renderRecent();
}

function showDetail(bkey, roomNum) {
  const b = buildingData(bkey);
  const room = b.rooms[String(roomNum)];
  if (!room) return;
  activeRoom = roomNum;
  addRecent(bkey, roomNum);

  if (bkey !== currentBuilding) {
    currentBuilding = bkey;
    $$("#buildingTabs button").forEach((btn) => btn.classList.toggle("active", btn.dataset.building === bkey));
    buildFloorTabs();
  }
  if (room.floor !== currentFloor) {
    currentFloor = room.floor;
    filters = { types: new Set(), codes: new Set(), connectOnly: false };
    $$("#floorTabs button").forEach((btn) => btn.classList.toggle("active", btn.dataset.floor === room.floor));
    renderFloor(room.floor);
  }

  $("#detailEmpty").style.display = "none";
  $("#detailRoom").classList.add("show");

  const label = titleCase(room.description) || room.type;
  $("#dRoomNum").textContent = room.room;
  const pill = $("#dTypePill");
  pill.textContent = room.type;
  pill.style.background = typeColor(room.type);
  $("#dDesc").textContent = label;

  const photoFrame = $("#dPhoto");
  if (room.hasPhoto) {
    photoFrame.classList.add("skeleton");
    photoFrame.innerHTML = `<img src="${imgPath(bkey, room.room)}" alt="View from room ${room.room}">`;
    const imgEl = $("#dPhoto img");
    imgEl.addEventListener("load", () => { imgEl.classList.add("loaded"); photoFrame.classList.remove("skeleton"); });
    imgEl.addEventListener("click", () => openLightbox(imgPath(bkey, room.room), `Room ${room.room} — view`));
  } else {
    photoFrame.classList.remove("skeleton");
    photoFrame.innerHTML = `<div class="no-img">
      <svg class="no-img-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 3l18 18M10.5 5H17a2 2 0 0 1 2 2v9.5M3 7v10a2 2 0 0 0 2 2h11.5"/><circle cx="12" cy="13" r="3.2"/></svg><br>
      No photo available yet<br>for room ${room.room}</div>`;
  }

  const tagsWrap = $("#dTags");
  tagsWrap.innerHTML = "";
  if (room.codes && room.codes.length) {
    room.codes.forEach((c) => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = c;
      tag.title = GLOSSARY[c] ? `${GLOSSARY[c].label}${GLOSSARY[c].conf === "low" ? " (unconfirmed)" : ""}` : "Meaning not yet confirmed";
      tagsWrap.appendChild(tag);
    });
  } else {
    tagsWrap.innerHTML = `<div class="no-codes">No feature codes listed for this room.</div>`;
  }

  const connectWrap = $("#dConnect");
  if (room.connecting != null) {
    const other = b.rooms[String(room.connecting)];
    connectWrap.innerHTML = `<div class="connect-title">🔗 Interconnecting with Room ${room.connecting}</div>`;
    const card = document.createElement("div");
    card.className = "connect-room-card";
    const otherLabel = other ? titleCase(other.description) : "";
    card.innerHTML = `
      <div class="cphoto">${
        other && other.hasPhoto
          ? `<img src="${imgPath(bkey, other.room)}" alt="View from room ${other.room}">`
          : `<div class="thumb-empty">No photo available yet</div>`
      }</div>
      <div class="cmeta">
        <div><strong>Room ${room.connecting}</strong><br><span class="ctype">${other ? `${other.type} — ${otherLabel}` : ""}</span></div>
        <span class="go">View room →</span>
      </div>`;
    if (other && other.hasPhoto) {
      card.querySelector(".cphoto img").addEventListener("click", (e) => {
        e.stopPropagation();
        openLightbox(imgPath(bkey, other.room), `Room ${other.room} — view`);
      });
    }
    card.querySelector(".cmeta").addEventListener("click", () => showDetail(bkey, room.connecting));
    connectWrap.appendChild(card);
  } else {
    connectWrap.innerHTML = `<div class="no-connect">This room is not interconnecting.</div>`;
  }

  highlightConnections(room);
  renderRecent();
}

function highlightConnections(room) {
  $$(".tile.room-tile").forEach((t) => {
    const rn = Number(t.dataset.room);
    t.classList.remove("active", "linked", "dim");
    if (rn === room.room) t.classList.add("active");
    else if (room.connecting != null && rn === room.connecting) t.classList.add("linked");
    else t.classList.add("dim");
  });
}

/* ================= Lightbox ================= */
function openLightbox(src, caption) {
  $("#lbImg").src = src;
  $("#lbCaption").textContent = caption || "";
  $("#lightbox").classList.add("show");
}
function closeLightbox() { $("#lightbox").classList.remove("show"); }

/* ================= Upsell Grid ================= */
let upsellOcc = "";
let upsellNights4Plus = false;
let upsellFrom = "";
let upsellTo = "";

function upsellRowOptions(tierKey) {
  return Object.keys(UPSELL_TIERS.find((t) => t.key === tierKey).grid);
}

function upsellTierFromOccupancy(occ, nights4Plus) {
  if (nights4Plus) return "t4";
  if (occ === "" || occ == null || isNaN(occ)) return null;
  const n = Number(occ);
  if (n < 50) return "t4";
  if (n < 70) return "t3";
  if (n < 85) return "t2";
  return "t1";
}

function openUpsell() {
  upsellOcc = ""; upsellNights4Plus = false;
  upsellFrom = ""; upsellTo = "";
  $("#upOccInput").value = "";
  $("#upNightsCheck").checked = false;
  $("#upOccInput").disabled = false;
  renderUpsellResults();
  $("#upsellModal").classList.add("show");
}
function closeUpsell() { $("#upsellModal").classList.remove("show"); }

function renderUpsellResults() {
  const tierKey = upsellTierFromOccupancy(upsellOcc, upsellNights4Plus);
  const tier = tierKey ? UPSELL_TIERS.find((t) => t.key === tierKey) : null;
  const wrap = $("#upsellBody");

  if (!tier) {
    wrap.innerHTML = `<div class="up-prompt">Enter an occupancy % (or check "4+ nights stay") to see the matching prices.</div>`;
    return;
  }

  let html = `<div class="up-supplement-note">Matched tier: <b>${tier.label}</b> — extra-pax supplement (if not same occupancy): <b>AED ${tier.extraPax}</b></div>
    <div class="up-select-row">
      <label>From <select id="upFromSelect"><option value="">Any</option>
        ${upsellRowOptions(tierKey).map((r) => `<option value="${r}" ${r === upsellFrom ? "selected" : ""}>${r}</option>`).join("")}
      </select></label>
      <label>To <select id="upToSelect" ${upsellFrom ? "" : "disabled"}><option value="">Any</option>
        ${upsellFrom ? Object.keys(tier.grid[upsellFrom] || {}).map((c) => `<option value="${c}" ${c === upsellTo ? "selected" : ""}>${c}</option>`).join("") : ""}
      </select></label>
    </div>`;

  if (upsellFrom && upsellTo && tier.grid[upsellFrom] && tier.grid[upsellFrom][upsellTo] != null) {
    html += `<div class="up-result"><div class="up-result-label">${upsellFrom} → ${upsellTo}</div><div class="up-result-price">AED ${tier.grid[upsellFrom][upsellTo]}</div></div>`;
  } else if (upsellFrom && tier.grid[upsellFrom]) {
    html += `<table class="gloss-table"><thead><tr><th>To</th><th>Price</th></tr></thead><tbody>`;
    Object.entries(tier.grid[upsellFrom]).forEach(([to, price]) => {
      html += `<tr><td><code>${to}</code></td><td>AED ${price}</td></tr>`;
    });
    html += `</tbody></table>`;
  } else {
    const rowKeys = upsellRowOptions(tierKey);
    const colKeys = ["KGAOV","KGE","KGEOV","SKA","SKB","SKC","D2A/D2C","D2B/D2D","SKD","SKP","SXA"];
    html += `<div class="up-grid-scroll"><table class="gloss-table up-full-grid"><thead><tr><th>From \\ To</th>${colKeys.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>`;
    rowKeys.forEach((r) => {
      html += `<tr><td><b>${r}</b></td>`;
      colKeys.forEach((c) => {
        const v = tier.grid[r][c];
        html += `<td>${v != null ? v : "—"}</td>`;
      });
      html += `</tr>`;
    });
    html += `</tbody></table></div>`;
  }

  wrap.innerHTML = html;

  $("#upFromSelect").addEventListener("change", (e) => {
    upsellFrom = e.target.value; upsellTo = "";
    renderUpsellResults();
  });
  const toSel = $("#upToSelect");
  if (toSel) toSel.addEventListener("change", (e) => { upsellTo = e.target.value; renderUpsellResults(); });
}

/* ================= Late Checkout ================= */
const LC_TYPE_TIER = {
  KGA: "Deluxe", KGAOV: "Deluxe", TWA: "Deluxe", TWAOV: "Deluxe",
  KGE: "Premium / Family Suite / Interconnecting", KGEOV: "Premium / Family Suite / Interconnecting",
  SKB: "Premium / Family Suite / Interconnecting", SKC: "Premium / Family Suite / Interconnecting",
  SKD: "All Suites", SKP: "All Suites", SXA: "All Suites", SKA: "All Suites",
};
const LC_TIER_RANK = { "Deluxe": 0, "Premium / Family Suite / Interconnecting": 1, "All Suites": 2 };

let lcType = "";
let lcTime = "";

function openLateCheckout() {
  lcType = ""; lcTime = "";
  renderLateCheckout();
  $("#lateCheckoutModal").classList.add("show");
}
function closeLateCheckout() { $("#lateCheckoutModal").classList.remove("show"); }

function lcEffectiveTier(typeCode) {
  return LC_TYPE_TIER[typeCode] || null;
}

function renderLateCheckout() {
  const wrap = $("#lateCheckoutBody");
  const typeCodes = Object.keys(LC_TYPE_TIER);
  const times = Array.from(new Set(LATE_CHECKOUT_DATA.map((r) => r.time)));

  let html = `<div class="up-select-row">
      <label>Room Type <select id="lcTypeSelect"><option value="">Any</option>
        ${typeCodes.map((t) => `<option value="${t}" ${t === lcType ? "selected" : ""}>${t}</option>`).join("")}
      </select></label>
      <label>Check Out <select id="lcTimeSelect"><option value="">Any</option>
        ${times.map((t) => `<option value="${t}" ${t === lcTime ? "selected" : ""}>${t}H</option>`).join("")}
      </select></label>
    </div>`;

  const tier = lcType ? lcEffectiveTier(lcType) : null;
  const matches = LATE_CHECKOUT_DATA.filter((r) => (!tier || r.category === tier) && (!lcTime || r.time === lcTime));

  if (tier) {
    html += `<div class="up-supplement-note">${lcType} falls under <b>${tier}</b> pricing.</div>`;
  }

  if (tier && lcTime && matches.length === 1) {
    const r = matches[0];
    html += `<div class="up-result">
      <div class="up-result-label">${lcType} — ${r.time}H Checkout</div>
      <div class="up-result-price">AED ${r.charges}</div>
      <div class="lc-breakdown">
        <span>Room Allocation <b>AED ${r.room}</b></span>
        <span>F&amp;B Allocation <b>AED ${r.fb}</b></span>
      </div>
    </div>`;
  } else {
    html += `<table class="gloss-table"><thead><tr><th>Category</th><th>Check Out</th><th>Charges</th><th>Room Alloc.</th><th>F&amp;B Alloc.</th></tr></thead><tbody>`;
    matches.forEach((r) => {
      html += `<tr><td><b>${r.category}</b></td><td>${r.time}H</td><td><b>AED ${r.charges}</b></td><td>AED ${r.room}</td><td>AED ${r.fb}</td></tr>`;
    });
    html += `</tbody></table>`;
  }

  wrap.innerHTML = html;
  $("#lcTypeSelect").addEventListener("change", (e) => { lcType = e.target.value; renderLateCheckout(); });
  $("#lcTimeSelect").addEventListener("change", (e) => { lcTime = e.target.value; renderLateCheckout(); });
}

/* ================= Search (global, live dropdown) ================= */
function allRoomsFlat() {
  const out = [];
  RBAB_DATA.buildingOrder.forEach((bkey) => {
    const b = buildingData(bkey);
    Object.values(b.rooms).forEach((r) => out.push({ building: bkey, buildingLabel: b.label, room: r }));
  });
  return out;
}

let searchHighlight = -1;

function setupSearch() {
  const input = $("#searchInput");
  const dropdown = $("#searchDropdown");
  const allRooms = allRoomsFlat();

  function renderResults(matches) {
    searchHighlight = -1;
    if (!matches.length) {
      dropdown.innerHTML = `<div class="sd-empty">No matching room</div>`;
    } else {
      dropdown.innerHTML = matches.slice(0, 8).map((m, i) => `
        <div class="sd-item" data-idx="${i}" data-b="${m.building}" data-r="${m.room.room}">
          <span class="sd-room">${m.room.room}</span>
          <span class="sd-meta">${m.buildingLabel} · ${m.room.type}</span>
        </div>`).join("");
      $$(".sd-item", dropdown).forEach((el) => {
        el.addEventListener("click", () => {
          showDetail(el.dataset.b, Number(el.dataset.r));
          input.value = "";
          dropdown.classList.remove("show");
          input.blur();
        });
      });
    }
    dropdown.classList.add("show");
  }

  input.addEventListener("input", () => {
    const val = input.value.trim();
    if (!val) { dropdown.classList.remove("show"); return; }
    const matches = allRooms.filter((m) => String(m.room.room).startsWith(val));
    renderResults(matches);
  });

  input.addEventListener("keydown", (e) => {
    const items = $$(".sd-item", dropdown);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      searchHighlight = Math.min(searchHighlight + 1, items.length - 1);
      items.forEach((it, i) => it.classList.toggle("hl", i === searchHighlight));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      searchHighlight = Math.max(searchHighlight - 1, 0);
      items.forEach((it, i) => it.classList.toggle("hl", i === searchHighlight));
    } else if (e.key === "Enter") {
      if (searchHighlight >= 0 && items[searchHighlight]) {
        items[searchHighlight].click();
      } else {
        const found = findRoomAnyBuilding(input.value.trim());
        if (found) { showDetail(found.building, found.room.room); input.value = ""; dropdown.classList.remove("show"); input.blur(); }
      }
    } else if (e.key === "Escape") {
      e.stopPropagation();
      dropdown.classList.remove("show");
      input.blur();
    }
  });

  document.addEventListener("click", (e) => {
    if (!$("#searchWrap").contains(e.target)) dropdown.classList.remove("show");
  });
}

/* ================= Keyboard shortcuts ================= */
function setupShortcuts() {
  document.addEventListener("keydown", (e) => {
    const typing = ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName);

    if (e.key === "Escape") {
      if ($("#tourOverlay").classList.contains("show")) endTour();
      else if ($("#lightbox").classList.contains("show")) closeLightbox();
      else if ($("#overviewModal").classList.contains("show")) closeOverview();
      else if ($("#lateCheckoutModal").classList.contains("show")) closeLateCheckout();
      else if ($("#upsellModal").classList.contains("show")) closeUpsell();
      else if ($$(".fdrop.open").length) $$(".fdrop.open").forEach((el) => el.classList.remove("open"));
      else if (typing) document.activeElement.blur();
      else clearDetail();
      return;
    }
    if (typing) return;

    if (e.key === "/") { e.preventDefault(); $("#searchInput").focus(); }
    else if (e.key === "d" || e.key === "D") { toggleTheme(); }
    else if (e.key === "ArrowLeft") { stepFloor(-1); }
    else if (e.key === "ArrowRight") { stepFloor(1); }
  });
}

/* ================= Auth gate =================
   Client-side only: this deters casual link-sharing, it does not secure the
   photos or data, which remain reachable at their direct URLs regardless. */
const AUTH_USER = "RBABFRONT";
const AUTH_PASS = "RoomGuide@@2026$$";

function isAuthed() {
  return localStorage.getItem("rbab-auth") === "ok";
}

function setupAuthGate() {
  const form = $("#authForm");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const u = $("#authUser").value.trim();
    const p = $("#authPass").value;
    if (u === AUTH_USER && p === AUTH_PASS) {
      localStorage.setItem("rbab-auth", "ok");
      $("#authGate").classList.add("hidden");
      $("#mainApp").style.display = "";
      initApp();
    } else {
      $("#authError").classList.add("show");
    }
  });
}

/* ================= First-visit tour ================= */
const TOUR_STEPS = [
  { sel: "#buildingTabs", title: "Switch buildings", text: "Jump between Zumroud, Amwaj, and Marmar here." },
  { sel: "#floorTabs", title: "Pick a floor", text: "Each building's floors are listed here." },
  { sel: "#filterBar", title: "Filter the floor", text: "Search and check any room category or feature — matches highlight on the floor and show up for all 3 buildings in the sidebar." },
  { sel: "#searchWrap", title: "Jump to any room", text: "Type a room number from any building to go straight to it." },
  { sel: "#overviewBtn", title: "All-buildings overview", text: "Room counts, type breakdown, and coverage for all three buildings at a glance." },
  { sel: "#upsellBtn", title: "Upselling grid", text: "Look up upgrade prices by occupancy tier, from category and to category." },
  { sel: "#lateCheckoutBtn", title: "Late checkout", text: "Charges and room/F&B split by category and checkout time." },
];
let tourIdx = 0;

function positionTour() {
  const step = TOUR_STEPS[tourIdx];
  const target = document.querySelector(step.sel);
  if (!target) { nextTourStep(); return; }
  const rect = target.getBoundingClientRect();
  const pad = 6;
  const hl = $("#tourHighlight");
  hl.style.left = (rect.left - pad) + "px";
  hl.style.top = (rect.top - pad) + "px";
  hl.style.width = (rect.width + pad * 2) + "px";
  hl.style.height = (rect.height + pad * 2) + "px";

  const card = $("#tourCard");
  $("#tourStepLabel").textContent = `Step ${tourIdx + 1} of ${TOUR_STEPS.length}`;
  $("#tourTitle").textContent = step.title;
  $("#tourText").textContent = step.text;
  $("#tourNext").textContent = tourIdx === TOUR_STEPS.length - 1 ? "Done" : "Next";

  const cardWidth = isTouch ? 240 : 280;
  let top = rect.bottom + 16;
  let left = Math.min(Math.max(rect.left, 10), window.innerWidth - cardWidth - 10);
  if (top + 140 > window.innerHeight) top = Math.max(rect.top - 160, 10);
  card.style.top = top + "px";
  card.style.left = left + "px";
}

function nextTourStep() {
  tourIdx++;
  if (tourIdx >= TOUR_STEPS.length) { endTour(); return; }
  positionTour();
}

function startTour() {
  tourIdx = 0;
  $("#tourOverlay").classList.add("show");
  positionTour();
}

function endTour() {
  $("#tourOverlay").classList.remove("show");
  localStorage.setItem("rbab-tour-seen", "yes");
}

/* ================= Init ================= */
function initApp() {
  initTheme();
  if (isTouch) $("#detailHint").innerHTML = "Tap a room on the plan<br>to see its view and features.";
  buildBuildingTabs();
  setupSearch();
  setupShortcuts();

  document.addEventListener("click", () => {
    $$(".fdrop.open").forEach((el) => el.classList.remove("open"));
  });

  $("#themeToggle").addEventListener("click", toggleTheme);
  $("#overviewBtn").addEventListener("click", openOverview);
  $("#upsellBtn").addEventListener("click", openUpsell);
  $("#upOccInput").addEventListener("input", (e) => {
    upsellOcc = e.target.value;
    upsellFrom = ""; upsellTo = "";
    renderUpsellResults();
  });
  $("#upNightsCheck").addEventListener("change", (e) => {
    upsellNights4Plus = e.target.checked;
    $("#upOccInput").disabled = upsellNights4Plus;
    upsellFrom = ""; upsellTo = "";
    renderUpsellResults();
  });
  $("#lateCheckoutBtn").addEventListener("click", openLateCheckout);
  $("#overviewModal").addEventListener("click", (e) => { if (e.target.id === "overviewModal") closeOverview(); });
  $("#upsellModal").addEventListener("click", (e) => { if (e.target.id === "upsellModal") closeUpsell(); });
  $("#lateCheckoutModal").addEventListener("click", (e) => { if (e.target.id === "lateCheckoutModal") closeLateCheckout(); });
  $("#overviewClose").addEventListener("click", closeOverview);
  $("#upsellClose").addEventListener("click", closeUpsell);
  $("#lateCheckoutClose").addEventListener("click", closeLateCheckout);
  $("#lightbox").addEventListener("click", closeLightbox);

  $("#tourBtn").addEventListener("click", startTour);
  $("#tourNext").addEventListener("click", nextTourStep);
  $("#tourSkip").addEventListener("click", endTour);
  window.addEventListener("resize", () => {
    if ($("#tourOverlay").classList.contains("show")) positionTour();
  });

  selectBuilding(RBAB_DATA.buildingOrder[0]);
  renderRecent();

  if (!localStorage.getItem("rbab-tour-seen")) {
    setTimeout(startTour, 500);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (isAuthed()) {
    $("#authGate").classList.add("hidden");
    $("#mainApp").style.display = "";
    initApp();
  } else {
    setupAuthGate();
  }
});
