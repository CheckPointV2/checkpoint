/* ============================================================
   Resort Map — 3D map of Rixos Bab Al Bahr built from Room Guide data.
   Reads window.RBAB_DATA (roomguide/data.js) and never writes to it.
   Towers: towers.mjs (generated from the floor grids).
   Grounds: site.mjs. Layout guesses: config.mjs.
   ============================================================ */
import * as THREE from "./vendor/three.module.min.js";
import { OrbitControls } from "./vendor/OrbitControls.js";
import { RoomEnvironment } from "./vendor/jsm/environments/RoomEnvironment.js";
import { BUILDINGS, VIEW_ORDER, VIEWS, CATEGORIES, FEATURES, SITE } from "./config.mjs";
import { createTowerKit, buildTower, FLOOR_H, SLAB_T, BODY_H, BODY_D, ROOF_TINT } from "./towers.mjs";
import { buildSite } from "./site.mjs";
import { PALETTE } from "./textures.mjs";

const LIFT_AWAY = 18;
const esc = (s) => (s ?? "").toString().replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const THEMES = {
  light: {
    skyTop: "#7fb2d6", skyHorizon: "#e6eee9", fog: 0xdfe8e4,
    hemiSky: 0xf4f7ff, hemiGround: 0x8f7a58, hemi: 0.42, env: 0.32,
    sun: 3.6, sunColor: 0xffe9cc, exposure: 0.8, glow: 0, pool: 0.08, seaFar: 0x16679a,
    labelInk: "#2B2118", labelHalo: "rgba(255,255,255,.9)",
  },
  dark: {
    skyTop: "#050913", skyHorizon: "#1a2437", fog: 0x161f30,
    hemiSky: 0x6d86c0, hemiGround: 0x1a1510, hemi: 0.2, env: 0.06,
    sun: 0.38, sunColor: 0xa9bde8, exposure: 1.0, glow: 1.6, pool: 0.75, seaFar: 0x0b2c47,
    labelInk: "#F3EDE3", labelHalo: "rgba(14,11,7,.85)",
  },
};

const MODE_LABELS = { plain: "Natural", view: "Views", category: "Category" };
const VIEW_CHIPS = [
  { key: "COS", label: "Sea" }, { key: "BEA", label: "Beach" }, { key: "POO", label: "Pool" },
  { key: "GAR", label: "Garden" }, { key: "ROAD", label: "Road / entrance" },
];
const FLAG_CHIPS = [
  { key: "INT", label: "Interconnecting" }, { key: "HCA", label: "Accessible" }, { key: "SUITE", label: "Suites" },
];

function primaryView(room) {
  const codes = room.codes || [];
  for (const v of VIEW_ORDER) if (codes.includes(v)) return v;
  return "NONE";
}
function categoryOf(room) {
  for (const [k, c] of Object.entries(CATEGORIES)) if (c.types.includes(room.type)) return k;
  return null;
}
function typeLabel(room) {
  const d = (room.description || room.type || "").toLowerCase();
  return d.replace(/\b\w/g, (m) => m.toUpperCase()).replace(/\s+/g, " ").trim();
}
function skyTexture(top, horizon) {
  const c = document.createElement("canvas"); c.width = 2; c.height = 256;
  const g = c.getContext("2d"); const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, top); gr.addColorStop(0.75, horizon); gr.addColorStop(1, horizon);
  g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ================================================================ mount */
export async function mount(container) {
  const D = window.RBAB_DATA;
  if (!D) throw new Error("Room data not loaded");

  container.innerHTML = shellHTML();
  const root = container.querySelector(".rm-root");
  const $ = (s) => root.querySelector(s);
  const canvas = $(".rm-canvas");
  const small = () => root.clientWidth < 760;

  const state = {
    level: "resort", bkey: null, fk: null, sel: null,
    mode: "plain", views: new Set(), flags: new Set(),
    theme: document.documentElement.dataset.theme === "dark" ? "dark" : "light",
  };
  let T = THEMES[state.theme];

  /* ---------- renderer ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  const mobileGPU = matchMedia("(pointer: coarse)").matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobileGPU ? 2 : 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = T.exposure;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(T.fog, 260, 620);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = T.env;

  const camera = new THREE.PerspectiveCamera(28, 1, 0.5, 1200);
  const HOME_T = new THREE.Vector3(8, 0, 2);
  const HOME_DIR = new THREE.Vector3(0.22, 0.78, 1).normalize();
  // phones look along the coast, so the towers stack down the tall screen
  const HOME_DIR_PHONE = new THREE.Vector3(1, 1.05, 0.3).normalize();
  const HOME_T_PHONE = new THREE.Vector3(-6, 0, 0);
  const homeTarget = () => (small() ? HOME_T_PHONE : HOME_T);
  const homePos = () => homeTarget().clone().addScaledVector(small() ? HOME_DIR_PHONE : HOME_DIR, small() ? 235 : 178);
  camera.position.copy(homePos());

  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(homeTarget());
  controls.enableDamping = true; controls.dampingFactor = 0.085;
  controls.maxPolarAngle = 1.3; controls.minDistance = 5; controls.maxDistance = 330;
  controls.screenSpacePanning = false; controls.zoomToCursor = true;
  controls.update();

  const hemi = new THREE.HemisphereLight(T.hemiSky, T.hemiGround, T.hemi); scene.add(hemi);
  const sun = new THREE.DirectionalLight(T.sunColor, T.sun);
  sun.position.set(-70, 120, 85); sun.target.position.set(8, 0, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobileGPU ? 2048 : 4096, mobileGPU ? 2048 : 4096);
  Object.assign(sun.shadow.camera, { left: -95, right: 95, top: 95, bottom: -95, near: 20, far: 340 });
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.025;
  scene.add(sun, sun.target);

  /* ---------- towers ---------- */
  const kit = createTowerKit();
  const bData = {};
  const roomIndex = {};
  const pickables = [];
  const footprints = [];
  for (const bkey of D.buildingOrder) {
    const tw = buildTower(kit, bkey, D.buildings[bkey], BUILDINGS[bkey] || { x: 0, z: 0, rotation: 0 });
    scene.add(tw.group);
    tw.group.updateMatrixWorld(true);
    const wb = tw.bounds.clone().applyMatrix4(tw.group.matrixWorld);
    footprints.push({ x0: wb.min.x - 1.5, x1: wb.max.x + 1.5, z0: wb.min.z - 1.5, z1: wb.max.z + 1.5 });
    tw.opacity = 1; tw.opacityTarget = 1; tw.crownLift = 0;
    tw.roomCount = 0;
    for (const fk of tw.order) {
      const f = tw.floors[fk];
      if (f.roomMesh) pickables.push(f.roomMesh);
      for (const r of f.rooms) {
        tw.roomCount++;
        const key = bkey + ":" + r.room.room;
        roomIndex[key] = {
          key, bkey, fk, num: String(r.room.room), room: r.room, r, mesh: f.roomMesh, idx: r.idx,
          floorGroup: f.group, view: primaryView(r.room), cat: categoryOf(r.room),
          base: new THREE.Color(r.cream ? PALETTE.cream : PALETTE.apricot),
        };
      }
    }
    bData[bkey] = tw;
  }

  /* ---------- grounds ---------- */
  const site = buildSite(scene, { towerFootprints: footprints });

  /* ---------- selection markers ---------- */
  const selBox = new THREE.Group();
  {
    const geo = new THREE.BoxGeometry(1.06, BODY_H + 0.06, BODY_D + 0.06);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xffd27a }));
    const fill = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffc04d, transparent: true, opacity: 0.38, depthWrite: false }));
    const cap = new THREE.Mesh(new THREE.PlaneGeometry(1.0, BODY_D), new THREE.MeshBasicMaterial({ color: 0xffbf3f, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
    cap.rotation.x = -Math.PI / 2; cap.position.y = BODY_H / 2 + 0.03; cap.renderOrder = 4;
    selBox.add(edges, fill, cap); selBox.visible = false;
  }
  const connBox = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.04, BODY_H + 0.04, BODY_D + 0.04)),
    new THREE.LineDashedMaterial({ color: 0xffc04d, dashSize: 0.12, gapSize: 0.08 }),
  );
  connBox.computeLineDistances(); connBox.visible = false;
  const bodyCenter = (r) => new THREE.Vector3(
    r.x + Math.sin(r.rot) * (-0.5 + BODY_D / 2), SLAB_T + BODY_H / 2, r.z + Math.cos(r.rot) * (-0.5 + BODY_D / 2));
  function placeMarker(obj, rec) {
    rec.floorGroup.add(obj);
    obj.position.copy(bodyCenter(rec.r)); obj.rotation.y = rec.r.rot; obj.visible = true;
  }

  /* ---------- floor number labels ---------- */
  const numberPlanes = {};
  function numberPlane(bkey, fk) {
    const key = bkey + ":" + fk;
    if (numberPlanes[key]) return numberPlanes[key];
    const f = bData[bkey].floors[fk];
    if (!f.rooms.length) return null;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const r of f.rooms) { minX = Math.min(minX, r.x); maxX = Math.max(maxX, r.x); minZ = Math.min(minZ, r.z); maxZ = Math.max(maxZ, r.z); }
    const PX = 112, w = maxX - minX + 1, d = maxZ - minZ + 1;
    const cv = document.createElement("canvas"); cv.width = w * PX; cv.height = d * PX;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }));
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(minX + w / 2 - 0.5, FLOOR_H + 0.015, minZ + d / 2 - 0.5);
    plane.renderOrder = 5;
    const rec = { plane, cv, minX, minZ, PX, f, rot: bData[bkey].group.rotation.y };
    paintNumbers(rec);
    f.group.add(plane);
    numberPlanes[key] = rec;
    return rec;
  }
  function paintNumbers(rec) {
    const g = rec.cv.getContext("2d");
    g.clearRect(0, 0, rec.cv.width, rec.cv.height);
    g.font = `800 ${Math.round(rec.PX * 0.27)}px "Plus Jakarta Sans", system-ui, sans-serif`;
    g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round"; g.lineWidth = rec.PX * 0.08;
    for (const r of rec.f.rooms) {
      const c = bodyCenter(r);
      const x = (c.x - rec.minX + 0.5) * rec.PX, y = (c.z - rec.minZ + 0.5) * rec.PX;
      g.save(); g.translate(x, y); g.rotate(rec.rot);
      const t = String(r.room.room);
      g.strokeStyle = T.labelHalo; g.strokeText(t, 0, 0);
      g.fillStyle = T.labelInk; g.fillText(t, 0, 0);
      g.restore();
    }
    if (rec.plane.material.map) rec.plane.material.map.dispose();
    const t = new THREE.CanvasTexture(rec.cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    rec.plane.material.map = t; rec.plane.material.needsUpdate = true;
  }

  /* ---------- colouring & filters ---------- */
  const cTmp = new THREE.Color(), cMix = new THREE.Color(), cGrey = new THREE.Color(0x8f8a84), cStone = new THREE.Color(0xf1ebe1);
  function matches(rec) {
    const v = state.views, f = state.flags;
    if (v.size) {
      const codes = rec.room.codes || [];
      const ok = [...v].some((k) => (k === "ROAD" ? ["ROA", "MAN", "CAV"].some((c) => codes.includes(c)) : codes.includes(k)));
      if (!ok) return false;
    }
    if (f.has("INT") && rec.room.connecting == null) return false;
    if (f.has("HCA") && !(rec.room.codes || []).includes("HCA")) return false;
    if (f.has("SUITE") && rec.cat !== "suite") return false;
    return true;
  }
  const filtering = () => state.views.size > 0 || state.flags.size > 0;
  function updateRoofTint() {
    ROOF_TINT.value = state.mode !== "plain" || filtering() ? 1 : state.level === "floor" ? 0.45 : 0;
    requestRender();
  }
  function recolor() {
    updateRoofTint();
    const on = filtering();
    let count = 0; const perB = {};
    for (const rec of Object.values(roomIndex)) {
      const m = on ? matches(rec) : true;
      if (m && on) { count++; perB[rec.bkey] = (perB[rec.bkey] || 0) + 1; }
      if (state.mode === "plain") cTmp.copy(rec.base); else cTmp.copy(cStone);
      if (state.mode === "view") cTmp.lerp(cMix.setHex(VIEWS[rec.view].color), 0.78);
      else if (state.mode === "category") cTmp.lerp(cMix.setHex(rec.cat ? CATEGORIES[rec.cat].color : VIEWS.NONE.color), 0.78);
      if (on && !m) cTmp.lerp(cGrey, 0.82);
      rec.mesh.setColorAt(rec.idx, cTmp);
      rec.mesh.geometry.attributes.aGlow.setX(rec.idx, on && !m ? 0.04 : 1);
    }
    for (const m of pickables) { m.instanceColor.needsUpdate = true; m.geometry.attributes.aGlow.needsUpdate = true; }
    const cnt = $(".rm-count");
    if (on) {
      cnt.innerHTML = `<b>${count}</b> room${count === 1 ? "" : "s"} · ` +
        D.buildingOrder.filter((b) => perB[b]).map((b) => `${esc(bData[b].label)} ${perB[b]}`).join(" · ");
      cnt.hidden = false;
    } else cnt.hidden = true;
    renderLegend();
    requestRender();
  }

  /* ---------- theme ---------- */
  function applyTheme(name) {
    state.theme = name === "dark" ? "dark" : "light";
    T = THEMES[state.theme];
    if (scene.background) scene.background.dispose();
    scene.background = skyTexture(T.skyTop, T.skyHorizon);
    scene.fog.color.setHex(T.fog);
    scene.environmentIntensity = T.env;
    hemi.color.setHex(T.hemiSky); hemi.groundColor.setHex(T.hemiGround); hemi.intensity = T.hemi;
    sun.color.setHex(T.sunColor); sun.intensity = T.sun;
    renderer.toneMappingExposure = T.exposure;
    site.mats.pool.emissiveIntensity = T.pool;
    site.mats.seaFar.color.setHex(T.seaFar);
    site.mats.mainA.emissiveIntensity = site.mats.mainC.emissiveIntensity = T.glow * 0.9;
    for (const b of Object.values(bData)) for (const f of Object.values(b.floors)) for (const m of f.mats.glowMats) m.emissiveIntensity = T.glow;
    for (const rec of Object.values(numberPlanes)) paintNumbers(rec);
    recolor();
  }
  if (window.CPOnThemeChange) window.CPOnThemeChange((t) => applyTheme(t));

  /* ---------- HTML labels ---------- */
  const labelLayer = $(".rm-labels");
  const tags = [];
  for (const bkey of D.buildingOrder) {
    const b = bData[bkey];
    const el = document.createElement("button");
    el.className = "rm-tag";
    el.innerHTML = `<span class="rm-tag-name">${esc(b.label)}</span><span class="rm-tag-sub">${b.roomCount} rooms · ${b.order.length} floors</span>`;
    el.addEventListener("click", () => goBuilding(bkey));
    labelLayer.appendChild(el);
    const c = new THREE.Vector3(); b.bounds.getCenter(c); c.y = b.bounds.max.y + 1.2;
    tags.push({ el, world: () => b.group.localToWorld(c.clone()), show: () => state.level === "resort" });
  }
  for (const l of SITE.labels) {
    const el = document.createElement("div");
    el.className = "rm-tag rm-tag-site"; el.textContent = l.text;
    labelLayer.appendChild(el);
    const p = new THREE.Vector3(l.x, l.y, l.z);
    tags.push({ el, world: () => p, show: () => state.level === "resort" });
  }
  const projV = new THREE.Vector3();
  function placeLabels() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    for (const t of tags) {
      if (!t.show()) { t.el.hidden = true; continue; }
      projV.copy(t.world()).project(camera);
      const out = projV.z > 1 || Math.abs(projV.x) > 1.1 || Math.abs(projV.y) > 1.1;
      t.el.hidden = out;
      if (!out) t.el.style.transform = `translate(${(projV.x * 0.5 + 0.5) * w}px, ${(-projV.y * 0.5 + 0.5) * h}px) translate(-50%, -100%)`;
    }
  }

  /* ---------- camera flights ---------- */
  let flight = null;
  function flyTo(pos, target, dur = 1000) {
    flight = { t0: performance.now(), dur, p0: camera.position.clone(), q0: controls.target.clone(), p1: pos.clone(), q1: target.clone() };
    requestRender();
  }
  function towerCenter(b, y) {
    const c = new THREE.Vector3(); b.bounds.getCenter(c); c.y = y; return b.group.localToWorld(c);
  }
  function frameBuilding(b) {
    const size = new THREE.Vector3(); b.bounds.getSize(size);
    const c = towerCenter(b, size.y * 0.32);
    const dist = Math.max(size.x, size.z) * (small() ? 3.3 : 2.35);
    flyTo(c.clone().addScaledVector(new THREE.Vector3(0.42, 0.82, 1).normalize(), dist), c);
  }
  function floorBox(b, fk) {
    const f = b.floors[fk];
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const r of f.rooms.length ? f.rooms : f.core) { minX = Math.min(minX, r.x); maxX = Math.max(maxX, r.x); minZ = Math.min(minZ, r.z); maxZ = Math.max(maxZ, r.z); }
    return { c: b.group.localToWorld(new THREE.Vector3((minX + maxX) / 2, f.y + FLOOR_H, (minZ + maxZ) / 2)), span: Math.max(maxX - minX, maxZ - minZ) + 2 };
  }
  const FLOOR_DIR = new THREE.Vector3(0.28, 1.45, 0.82).normalize();
  function frameFloor(b, fk) {
    const { c, span } = floorBox(b, fk);
    flyTo(c.clone().addScaledVector(FLOOR_DIR, span * (small() ? 3.0 : 2.15)), c);
  }

  /* ---------- level transitions ---------- */
  function setBuildingFocus(bkey) {
    for (const b of Object.values(bData)) b.opacityTarget = !bkey || b.bkey === bkey ? 1 : 0.12;
  }
  function setFloorFocus(bkey, fk) {
    for (const b of Object.values(bData)) {
      const selOrder = b.bkey === bkey && fk ? b.floors[fk].order : Infinity;
      for (const f of Object.values(b.floors)) {
        const up = f.order > selOrder;
        f.liftTarget = up ? LIFT_AWAY + (f.order - selOrder) * 1.3 : 0;
        f.opacityTarget = up ? 0 : 1;
      }
      b.crownLift = b.bkey === bkey && fk ? 1 : 0;
    }
    for (const [key, rec] of Object.entries(numberPlanes)) rec.plane.visible = key === bkey + ":" + fk;
    if (bkey && fk) { const np = numberPlane(bkey, fk); if (np) np.plane.visible = true; }
  }

  function goResort() {
    state.level = "resort"; state.bkey = null; state.fk = null; clearSelection();
    setBuildingFocus(null); setFloorFocus(null, null); updateRoofTint();
    flyTo(homePos(), homeTarget(), 1150);
    renderPanel(); syncHash();
  }
  function goBuilding(bkey) {
    state.level = "building"; state.bkey = bkey; state.fk = null; clearSelection();
    setBuildingFocus(bkey); setFloorFocus(bkey, null); updateRoofTint();
    frameBuilding(bData[bkey]);
    renderPanel(); syncHash();
  }
  function goFloor(bkey, fk, { keepSelection = false, fly = true } = {}) {
    state.level = "floor"; state.bkey = bkey; state.fk = fk;
    if (!keepSelection) clearSelection();
    setBuildingFocus(bkey); setFloorFocus(bkey, fk); updateRoofTint();
    if (fly) frameFloor(bData[bkey], fk);
    renderPanel(); syncHash();
  }
  function selectRoom(key, { fly = true } = {}) {
    const rec = roomIndex[key];
    if (!rec) return false;
    if (state.level !== "floor" || state.bkey !== rec.bkey || state.fk !== rec.fk) goFloor(rec.bkey, rec.fk, { keepSelection: true, fly: false });
    state.sel = key;
    placeMarker(selBox, rec);
    const conn = rec.room.connecting != null ? roomIndex[rec.bkey + ":" + rec.room.connecting] : null;
    if (conn && conn.fk === rec.fk) placeMarker(connBox, conn); else connBox.visible = false;
    if (fly) {
      const b = bData[rec.bkey], f = b.floors[rec.fk];
      const w = b.group.localToWorld(new THREE.Vector3(rec.r.x, f.y + FLOOR_H, rec.r.z));
      flyTo(w.clone().addScaledVector(FLOOR_DIR, small() ? 34 : 24), w, 950);
    }
    renderCard(rec); renderPanel(); syncHash();
    requestRender();
    return true;
  }
  function clearSelection() {
    state.sel = null; selBox.visible = false; connBox.visible = false;
    $(".rm-card").hidden = true;
    updateViewOffset();
  }
  function goUp() {
    if (state.sel) { clearSelection(); renderPanel(); syncHash(); }
    else if (state.level === "floor") goBuilding(state.bkey);
    else if (state.level === "building") goResort();
  }

  /* ---------- deep links: #/resortmap/2134 ---------- */
  let syncing = false;
  function syncHash() {
    if (!location.hash.startsWith("#/resortmap")) return;
    const want = state.sel ? "#/resortmap/" + roomIndex[state.sel].num : "#/resortmap";
    if (location.hash !== want) { syncing = true; history.replaceState(null, "", want); syncing = false; }
  }
  function findRoom(num) {
    num = String(num).trim();
    for (const b of D.buildingOrder) if (roomIndex[b + ":" + num]) return b + ":" + num;
    return null;
  }
  function readHash() {
    if (syncing) return;
    const m = location.hash.match(/^#\/resortmap\/(\d+)/);
    if (m) { const k = findRoom(m[1]); if (k && k !== state.sel) selectRoom(k); }
  }
  window.addEventListener("hashchange", readHash);
  window.CPResortMapGoTo = (num) => { const k = findRoom(num); if (k) selectRoom(k); return !!k; };

  /* ---------- panel ---------- */
  const hex = (n) => "#" + n.toString(16).padStart(6, "0");
  function viewBreakdown(recs) {
    const counts = {};
    for (const r of recs) counts[r.view] = (counts[r.view] || 0) + 1;
    return VIEW_ORDER.concat("NONE").filter((v) => counts[v]).map((v) =>
      `<span class="rm-mini"><i style="background:${hex(VIEWS[v].color)}"></i>${esc(VIEWS[v].short)} <b>${counts[v]}</b></span>`).join("");
  }
  const recsFor = (bkey, fk) => Object.values(roomIndex).filter((r) => r.bkey === bkey && (!fk || r.fk === fk));
  function renderPanel() {
    const p = $(".rm-panel");
    const crumbs = [`<button data-go="resort">Resort</button>`];
    if (state.bkey) crumbs.push(`<button data-go="building">${esc(bData[state.bkey].label)}</button>`);
    if (state.fk) crumbs.push(`<span>${esc(bData[state.bkey].floors[state.fk].label)}</span>`);
    $(".rm-crumbs").innerHTML = crumbs.join('<span class="rm-crumb-sep">›</span>');

    if (state.level === "resort") {
      const total = Object.values(roomIndex).length;
      p.innerHTML = `
        <div class="rm-eyebrow">Rixos Bab Al Bahr</div>
        <h2 class="rm-title">Resort Map</h2>
        <div class="rm-sub">${total} rooms across ${D.buildingOrder.length} towers. Pick a tower or search a room number.</div>
        <div class="rm-list">${D.buildingOrder.map((b) => `
          <button class="rm-row" data-b="${b}">
            <span class="rm-row-main"><b>${esc(bData[b].label)}</b><span>${bData[b].roomCount} rooms · ${bData[b].order.length} floors</span></span>
            <span class="rm-row-go">›</span>
          </button>`).join("")}</div>`;
    } else if (state.level === "building") {
      const b = bData[state.bkey];
      const recs = recsFor(b.bkey);
      p.innerHTML = `
        <button class="rm-back" data-up>‹ Resort</button>
        <h2 class="rm-title">${esc(b.label)}</h2>
        <div class="rm-sub">${recs.length} rooms · ${b.order.length} floors</div>
        <div class="rm-minis">${viewBreakdown(recs)}</div>
        <div class="rm-list-title">Floors</div>
        <div class="rm-list rm-floors">${b.order.slice().reverse().map((fk) => {
          const f = b.floors[fk];
          return `<button class="rm-row" data-f="${fk}"><span class="rm-row-main"><b>${esc(f.label)}</b><span>${f.rooms.length} rooms</span></span><span class="rm-row-go">›</span></button>`;
        }).join("")}</div>`;
    } else {
      const b = bData[state.bkey]; const f = b.floors[state.fk];
      const recs = recsFor(b.bkey, state.fk).sort((a, c) => a.room.room - c.room.room);
      p.innerHTML = `
        <button class="rm-back" data-up>‹ ${esc(b.label)}</button>
        <h2 class="rm-title">${esc(f.label)}</h2>
        <div class="rm-sub">${esc(b.label)} · ${recs.length} rooms</div>
        <div class="rm-minis">${viewBreakdown(recs)}</div>
        <div class="rm-floor-step">
          <button class="rm-step" data-step="1" ${b.order.indexOf(state.fk) === b.order.length - 1 ? "disabled" : ""} aria-label="Floor up">▲</button>
          <button class="rm-step" data-step="-1" ${b.order.indexOf(state.fk) === 0 ? "disabled" : ""} aria-label="Floor down">▼</button>
        </div>
        <div class="rm-list-title">Rooms</div>
        <div class="rm-roomgrid">${recs.map((x) => `<button class="rm-num${x.key === state.sel ? " on" : ""}${filtering() && !matches(x) ? " off" : ""}" data-k="${x.key}">${x.num}</button>`).join("")}</div>`;
    }
  }
  $(".rm-panel").addEventListener("click", (e) => {
    const t = e.target.closest("button"); if (!t) return;
    if (t.dataset.b) goBuilding(t.dataset.b);
    else if (t.dataset.f) goFloor(state.bkey, t.dataset.f);
    else if (t.dataset.k) selectRoom(t.dataset.k);
    else if (t.dataset.step) {
      const b = bData[state.bkey]; const i = b.order.indexOf(state.fk) + Number(t.dataset.step);
      if (b.order[i]) goFloor(state.bkey, b.order[i]);
    } else if (t.hasAttribute("data-up")) goUp();
  });
  $(".rm-crumbs").addEventListener("click", (e) => {
    const t = e.target.closest("button"); if (!t) return;
    if (t.dataset.go === "resort") goResort(); else if (t.dataset.go === "building") goBuilding(state.bkey);
  });

  /* ---------- room card ---------- */
  function renderCard(rec) {
    const r = rec.room; const b = bData[rec.bkey];
    const codes = r.codes || [];
    const views = VIEW_ORDER.filter((v) => codes.includes(v)).map((v) => VIEWS[v].label);
    const feats = Object.keys(FEATURES).filter((k) => codes.includes(k)).map((k) => FEATURES[k]);
    const photo = r.hasPhoto ? `roomguide/images/${rec.bkey}/${r.room}.jpg` : null;
    const conn = r.connecting != null ? findRoom(r.connecting) : null;
    const card = $(".rm-card");
    card.innerHTML = `
      <button class="rm-card-x" data-close aria-label="Close">×</button>
      ${photo ? `<div class="rm-card-photo"><img src="${esc(photo)}" alt="Room ${esc(r.room)}" loading="lazy"></div>` : ""}
      <div class="rm-card-body">
        <div class="rm-eyebrow">${esc(b.label)} · ${esc(b.floors[rec.fk].label)}</div>
        <div class="rm-card-num">${esc(r.room)}</div>
        <div class="rm-card-type">${esc(typeLabel(r))} <span class="rm-code">${esc(r.type)}</span></div>
        ${views.length ? `<div class="rm-card-row"><span class="rm-k">View</span><span>${views.map(esc).join(", ")}</span></div>` : ""}
        ${conn ? `<div class="rm-card-row"><span class="rm-k">Connects to</span><button class="rm-link" data-k="${conn}">${esc(r.connecting)}</button></div>` : ""}
        ${feats.length ? `<div class="rm-chips">${feats.map((f) => `<span class="rm-chip-s">${esc(f)}</span>`).join("")}</div>` : ""}
        <button class="cp-btn cp-btn-primary rm-open" data-open>Open in Room Guide</button>
      </div>`;
    card.hidden = false;
    updateViewOffset();
    const img = card.querySelector("img");
    if (img) img.addEventListener("error", () => img.closest(".rm-card-photo").remove());
  }
  $(".rm-card").addEventListener("click", (e) => {
    const t = e.target.closest("button"); if (!t) return;
    if (t.hasAttribute("data-close")) { clearSelection(); renderPanel(); syncHash(); }
    else if (t.dataset.k) selectRoom(t.dataset.k);
    else if (t.hasAttribute("data-open")) openInRoomGuide(roomIndex[state.sel]);
  });
  function openInRoomGuide(rec) {
    if (!rec) return;
    location.hash = "#/roomguide";
    const t0 = Date.now();
    (function wait() {
      if (window.CPRoomGuideMounted && window.CPRoomGuideGoTo) { window.CPRoomGuideGoTo(rec.bkey, rec.num); return; }
      if (Date.now() - t0 < 8000) setTimeout(wait, 80);
    })();
  }

  /* ---------- filters & legend ---------- */
  function renderFilters() {
    $(".rm-modes").innerHTML = Object.entries(MODE_LABELS).map(([k, l]) =>
      `<button class="rm-mode${state.mode === k ? " on" : ""}" data-mode="${k}">${l}</button>`).join("");
    $(".rm-chips-bar").innerHTML =
      VIEW_CHIPS.map((c) => `<button class="rm-chip${state.views.has(c.key) ? " on" : ""}" data-view="${c.key}">${c.label}</button>`).join("") +
      '<span class="rm-chip-sep"></span>' +
      FLAG_CHIPS.map((c) => `<button class="rm-chip${state.flags.has(c.key) ? " on" : ""}" data-flag="${c.key}">${c.label}</button>`).join("") +
      (filtering() ? '<button class="rm-chip rm-chip-clear" data-clear>Clear</button>' : "");
  }
  $(".rm-filters").addEventListener("click", (e) => {
    const t = e.target.closest("button"); if (!t) return;
    if (t.dataset.mode) state.mode = t.dataset.mode;
    else if (t.dataset.view) state.views.has(t.dataset.view) ? state.views.delete(t.dataset.view) : state.views.add(t.dataset.view);
    else if (t.dataset.flag) state.flags.has(t.dataset.flag) ? state.flags.delete(t.dataset.flag) : state.flags.add(t.dataset.flag);
    else if (t.hasAttribute("data-clear")) { state.views.clear(); state.flags.clear(); }
    renderFilters(); recolor();
    if (state.level === "floor") renderPanel();
  });
  function renderLegend() {
    const L = $(".rm-legend");
    const sw = (c, label) => `<span class="rm-mini"><i style="background:${hex(c)}"></i>${esc(label)}</span>`;
    let html = "";
    if (state.mode === "view") html = ["BEA", "COS", "POO", "GAR", "ROA", "NONE"].map((v) => sw(VIEWS[v].color, VIEWS[v].short)).join("");
    else if (state.mode === "category") html = Object.values(CATEGORIES).map((c) => sw(c.color, c.label)).join("");
    if (filtering()) html += sw(0x8f8a84, "Not matching");
    L.innerHTML = html; L.hidden = !html;
  }

  /* ---------- search ---------- */
  const search = $(".rm-search input");
  let toastTimer = 0;
  function toast(msg) {
    const t = $(".rm-toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
  }
  $(".rm-search").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = search.value.replace(/\D/g, "");
    const k = q && findRoom(q);
    if (k) { selectRoom(k); search.blur(); }
    else {
      $(".rm-search").classList.remove("shake"); void $(".rm-search").offsetWidth; $(".rm-search").classList.add("shake");
      toast(q ? `No room ${q}` : "Type a room number");
    }
  });

  /* ---------- picking ---------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tip = $(".rm-tip");
  function pick(ev) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const visible = pickables.filter((m) => {
      const b = bData[m.userData.bkey], f = b.floors[m.userData.fk];
      return f.opacity > 0.5 && b.opacity > 0.5;
    });
    const hit = ray.intersectObjects(visible, false)[0];
    if (!hit) return null;
    return roomIndex[hit.object.userData.bkey + ":" + hit.object.userData.nums[hit.instanceId]];
  }
  let down = null;
  canvas.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener("pointerup", (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { down = null; return; }
    down = null;
    const rec = pick(e);
    if (!rec) { if (state.sel) { clearSelection(); renderPanel(); syncHash(); } return; }
    if (state.level === "resort") goBuilding(rec.bkey);
    else selectRoom(rec.key);
  });
  let hoverRaf = 0;
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || down) { tip.hidden = true; return; }
    cancelAnimationFrame(hoverRaf);
    hoverRaf = requestAnimationFrame(() => {
      const rec = pick(e);
      if (!rec) { tip.hidden = true; canvas.style.cursor = ""; return; }
      canvas.style.cursor = "pointer";
      const rect = root.getBoundingClientRect();
      tip.innerHTML = state.level === "resort" ? `<b>${esc(bData[rec.bkey].label)}</b>` : `<b>${esc(rec.num)}</b> ${esc(typeLabel(rec.room))}`;
      tip.style.transform = `translate(${e.clientX - rect.left + 14}px, ${e.clientY - rect.top + 14}px)`;
      tip.hidden = false;
    });
  });
  canvas.addEventListener("pointerleave", () => { tip.hidden = true; });
  root.addEventListener("keydown", (e) => { if (e.key === "Escape" && document.activeElement !== search) goUp(); });
  $(".rm-home").addEventListener("click", goResort);

  /* ---------- render loop ---------- */
  let dirty = true;
  function requestRender() { dirty = true; }
  controls.addEventListener("change", requestRender);

  // On phones the panel/card are bottom sheets: lift the picture so the subject stays visible.
  function updateViewOffset() {
    const w = root.clientWidth, h = root.clientHeight;
    if (!w || !h) return;
    if (small()) {
      const card = !$(".rm-card").hidden;
      camera.setViewOffset(w, h, 0, Math.round(h * (card ? 0.27 : 0.17)), w, h);
    } else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    requestRender();
  }
  let placed = false, wasSmall = null;
  function resize() {
    const w = root.clientWidth, h = root.clientHeight;
    if (!w || !h) return;
    // first real size, or a phone/desktop switch while on the overview: re-frame
    if (!placed || (wasSmall !== small() && state.level === "resort" && !flight)) {
      camera.position.copy(homePos()); controls.target.copy(homeTarget()); controls.update();
      placed = true;
    }
    wasSmall = small();
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 640 ? 40 : 28;
    updateViewOffset();
  }
  new ResizeObserver(resize).observe(root);

  function setOpacity(mats, o) {
    for (const mat of mats) {
      const tr = o < 0.999;
      if (mat.transparent !== tr) { mat.transparent = tr; mat.needsUpdate = true; }
      mat.opacity = o; mat.depthWrite = o > 0.6;
    }
  }
  function stepAnimations(dt) {
    let busy = false;
    const k = 1 - Math.pow(0.0008, dt);
    const approach = (obj, key, target, eps) => {
      if (Math.abs(obj[key] - target) > eps) { obj[key] += (target - obj[key]) * k; busy = true; } else obj[key] = target;
    };
    for (const b of Object.values(bData)) {
      approach(b, "opacity", b.opacityTarget, 0.004);
      const cr = b.crown;
      approach(cr, "lift", b.crownLift ? LIFT_AWAY + 6 : 0, 0.01);
      approach(cr, "fade", b.crownLift ? 0 : 1, 0.004);
      const top = b.floors[b.order[b.order.length - 1]];
      cr.group.position.y = top.y + FLOOR_H + cr.lift;
      const co = b.opacity * cr.fade;
      setOpacity(cr.mats, co); cr.group.visible = co > 0.01;
      for (const f of Object.values(b.floors)) {
        approach(f, "lift", f.liftTarget, 0.01);
        approach(f, "opacity", f.opacityTarget, 0.004);
        f.group.position.y = f.y + f.lift;
        const o = f.opacity * b.opacity;
        setOpacity(f.mats.all, o);
        f.group.visible = o > 0.01;
      }
    }
    if (flight) {
      const t = Math.min(1, (performance.now() - flight.t0) / flight.dur), e = ease(t);
      camera.position.lerpVectors(flight.p0, flight.p1, e);
      controls.target.lerpVectors(flight.q0, flight.q1, e);
      if (t >= 1) flight = null;
      busy = true;
    }
    return busy;
  }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!root.isConnected || root.clientWidth === 0) return;
    const animating = stepAnimations(dt);
    const moved = controls.update();
    if (animating || moved || dirty) {
      renderer.render(scene, camera);
      placeLabels();
      dirty = false;
    }
  }

  /* ---------- go ---------- */
  renderFilters();
  applyTheme(state.theme);
  renderPanel();
  resize();
  requestAnimationFrame(frame);
  readHash();
  root.focus({ preventScroll: true });
}

function shellHTML() {
  return `
  <div class="rm-root" tabindex="-1">
    <canvas class="rm-canvas" aria-label="3D resort map"></canvas>
    <div class="rm-labels"></div>
    <div class="rm-tip" hidden></div>

    <div class="rm-top">
      <button class="rm-home" aria-label="Back to resort view" title="Resort view">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>
      </button>
      <nav class="rm-crumbs" aria-label="Location"></nav>
      <form class="rm-search" role="search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
        <input inputmode="numeric" placeholder="Find room…" aria-label="Find room number" autocomplete="off">
      </form>
    </div>

    <div class="rm-toast" role="status" hidden></div>
    <aside class="rm-panel"></aside>
    <div class="rm-card" hidden></div>

    <div class="rm-bottom">
      <div class="rm-legend" hidden></div>
      <div class="rm-count" hidden></div>
      <div class="rm-filters">
        <div class="rm-modes" role="tablist" aria-label="Colour rooms by"></div>
        <div class="rm-chips-bar"></div>
      </div>
    </div>
  </div>`;
}
