/* ============================================================
   Resort Map — 3D map of Rixos Bab Al Bahr built from Room Guide data.
   Reads window.RBAB_DATA (roomguide/data.js) and never writes to it.
   Every tower is generated from the floor grids: one block per room,
   floors aligned on their lift core, so the model always matches the
   data. Layout guesses live in config.mjs.
   ============================================================ */
import * as THREE from "./vendor/three.module.min.js";
import { OrbitControls } from "./vendor/OrbitControls.js";
import {
  BUILDINGS, FLOOR_H, ROOM_SIZE, ROOM_H, SITE, VIEW_ORDER, VIEWS, CATEGORIES, FEATURES,
} from "./config.mjs";

const SLAB_T = 0.08;
const LIFT_AWAY = 16;          // how far floors above the chosen one slide up
const esc = (s) => (s ?? "").toString().replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const THEMES = {
  light: {
    sky: 0xedf0ea, ground: 0xa9be8c, plaza: 0xe7dcc6, sand: 0xf2e4c6, sea: 0x2f9fc0, seaFar: 0x1d7aa3,
    pool: 0x4cc3d4, coping: 0xf7f1e6, road: 0xb7ad9e, trunk: 0x8b6b48, palm: 0x5d8a43,
    wall: 0xf3ead9, top: 0xe4d4b8, slab: 0xd8c7a8, podium: 0xcdb898, core: 0x8f7c66, glass: 0xa9cfd6,
    service: 0xd2c2a5, main: 0xece0ca, mainRoof: 0xd9c6a4,
    hemiSky: 0xfff8ee, hemiGround: 0xa48e6c, hemi: 1.15, sun: 2.4, sunColor: 0xfff1dc,
    glow: 0.0, labelInk: "#2B2118", labelHalo: "rgba(255,255,255,.85)", dim: 0x9a9286,
  },
  dark: {
    sky: 0x10141b, ground: 0x263524, plaza: 0x40382e, sand: 0x524838, sea: 0x0f3550, seaFar: 0x0a2236,
    pool: 0x1f6f86, coping: 0x3d362c, road: 0x2a2724, trunk: 0x3d3022, palm: 0x22361c,
    wall: 0x8a7d6b, top: 0x6a5f50, slab: 0x5a5043, podium: 0x544a3e, core: 0x3a3229, glass: 0x3b6470,
    service: 0x544a3e, main: 0x8a7d6b, mainRoof: 0x5f5546,
    hemiSky: 0x8ea2c8, hemiGround: 0x3a2e22, hemi: 2.1, sun: 1.5, sunColor: 0xc3d0ec,
    glow: 0.75, labelInk: "#F3EDE3", labelHalo: "rgba(14,11,7,.85)", dim: 0x3b352d,
  },
};

const MODE_LABELS = { plain: "Plain", view: "Views", category: "Category" };
const VIEW_CHIPS = [
  { key: "COS", label: "Sea" }, { key: "BEA", label: "Beach" }, { key: "POO", label: "Pool" },
  { key: "GAR", label: "Garden" }, { key: "ROAD", label: "Road / entrance" },
];
const FLAG_CHIPS = [
  { key: "INT", label: "Interconnecting" }, { key: "HCA", label: "Accessible" }, { key: "SUITE", label: "Suites" },
];

/* ---------------------------------------------------------------- helpers */
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
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function makeWindowTextures() {
  const S = 128;
  const wall = document.createElement("canvas"); wall.width = wall.height = S;
  const g = wall.getContext("2d");
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, S, S);
  // balcony slab + soft shadow line
  g.fillStyle = "#e9e1d4"; g.fillRect(0, S * 0.82, S, S * 0.18);
  g.fillStyle = "rgba(0,0,0,.08)"; g.fillRect(0, S * 0.80, S, 3);
  // window
  const wx = S * 0.18, wy = S * 0.16, ww = S * 0.64, wh = S * 0.6;
  const grad = g.createLinearGradient(0, wy, 0, wy + wh);
  grad.addColorStop(0, "#5f7880"); grad.addColorStop(1, "#33434a");
  g.fillStyle = grad; g.fillRect(wx, wy, ww, wh);
  g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(wx + 4, wy + 4, ww * 0.35, wh - 8);
  g.strokeStyle = "#cdbfa8"; g.lineWidth = 4; g.strokeRect(wx, wy, ww, wh);
  g.beginPath(); g.moveTo(S / 2, wy); g.lineTo(S / 2, wy + wh); g.stroke();
  // railing
  g.strokeStyle = "rgba(60,48,36,.55)"; g.lineWidth = 2;
  g.beginPath(); g.moveTo(wx - 6, wy + wh * 0.62); g.lineTo(wx + ww + 6, wy + wh * 0.62); g.stroke();

  const glow = document.createElement("canvas"); glow.width = glow.height = S;
  const h = glow.getContext("2d");
  h.fillStyle = "#000"; h.fillRect(0, 0, S, S);
  const gg = h.createLinearGradient(0, wy, 0, wy + wh);
  gg.addColorStop(0, "#ffd9a0"); gg.addColorStop(1, "#ffb766");
  h.fillStyle = gg; h.fillRect(wx + 3, wy + 3, ww - 6, wh - 6);

  const tw = new THREE.CanvasTexture(wall); tw.colorSpace = THREE.SRGBColorSpace; tw.anisotropy = 4;
  const tg = new THREE.CanvasTexture(glow); tg.colorSpace = THREE.SRGBColorSpace;
  tw.wrapS = tw.wrapT = tg.wrapS = tg.wrapT = THREE.RepeatWrapping;
  return { wall: tw, glow: tg };
}

// Window glow per room: an instanced attribute scales the emissive term.
function withRoomGlow(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aGlow;\nvarying float vGlow;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGlow = aGlow;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vGlow;")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vGlow;");
  };
  mat.customProgramCacheKey = () => "rm-room-glow";
  return mat;
}

// Box whose UVs are in world units / tile, so a window texture repeats instead of stretching.
function tiledBox(w, h, d, tile) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];   // +x -x +y -y +z -z
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v;
    uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(dims[f][0] / tile)), uv.getY(i) * Math.max(1, Math.round(dims[f][1] / tile)));
  }
  return g;
}

function roundedRect(w, d, r) {
  const s = new THREE.Shape(); const x = -w / 2, y = -d / 2; r = Math.min(r, w / 2, d / 2);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function flatShape(shape, mat, y) {
  const m = new THREE.Mesh(new THREE.ShapeGeometry(shape, 12), mat);
  m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true;
  return m;
}
function seeded(seed) { return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; }

/* ================================================================ mount */
export async function mount(container) {
  const D = window.RBAB_DATA;
  if (!D) throw new Error("Room data not loaded");

  container.innerHTML = shellHTML();
  const root = container.querySelector(".rm-root");
  const $ = (s) => root.querySelector(s);
  const canvas = $(".rm-canvas");

  /* ---------- state ---------- */
  const state = {
    level: "resort", bkey: null, fk: null, sel: null,
    mode: "view", views: new Set(), flags: new Set(),
    theme: document.documentElement.dataset.theme === "dark" ? "dark" : "light",
  };
  let T = THEMES[state.theme];

  /* ---------- renderer / scene ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(T.sky);
  scene.fog = new THREE.Fog(T.sky, 170, 380);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 900);
  const HOME = { pos: new THREE.Vector3(64, 60, 96), target: new THREE.Vector3(8, 0, 6) };
  camera.position.copy(HOME.pos);

  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(HOME.target);
  controls.enableDamping = true; controls.dampingFactor = 0.09;
  controls.maxPolarAngle = 1.38; controls.minDistance = 6; controls.maxDistance = 260;
  controls.screenSpacePanning = false; controls.zoomToCursor = true;
  controls.update();

  const hemi = new THREE.HemisphereLight(T.hemiSky, T.hemiGround, T.hemi);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(T.sunColor, T.sun);
  sun.position.set(70, 110, 55); sun.target.position.set(6, 0, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -85, right: 85, top: 85, bottom: -85, near: 10, far: 300 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  const tex = makeWindowTextures();

  /* ---------- site (ground, beach, sea, pools, palms) ---------- */
  const siteMats = {
    ground: new THREE.MeshStandardMaterial({ color: T.ground, roughness: 1 }),
    plaza: new THREE.MeshStandardMaterial({ color: T.plaza, roughness: 0.95 }),
    sand: new THREE.MeshStandardMaterial({ color: T.sand, roughness: 1 }),
    sea: new THREE.MeshStandardMaterial({ color: T.sea, roughness: 0.25, metalness: 0.05 }),
    seaFar: new THREE.MeshStandardMaterial({ color: T.seaFar, roughness: 0.3 }),
    pool: new THREE.MeshStandardMaterial({ color: T.pool, roughness: 0.12, emissive: T.pool, emissiveIntensity: 0.12 }),
    coping: new THREE.MeshStandardMaterial({ color: T.coping, roughness: 0.9 }),
    road: new THREE.MeshStandardMaterial({ color: T.road, roughness: 1 }),
    trunk: new THREE.MeshStandardMaterial({ color: T.trunk, roughness: 1 }),
    palm: new THREE.MeshStandardMaterial({ color: T.palm, roughness: 0.9, flatShading: true, side: THREE.DoubleSide }),
    main: new THREE.MeshStandardMaterial({ color: T.main, roughness: 0.85, map: tex.wall, emissiveMap: tex.glow, emissive: 0xffc27a, emissiveIntensity: T.glow }),
    mainRoof: new THREE.MeshStandardMaterial({ color: T.mainRoof, roughness: 0.9 }),
  };
  const site = new THREE.Group(); scene.add(site);
  {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), siteMats.ground);
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.02, 0); ground.receiveShadow = true; site.add(ground);

    const sand = new THREE.Mesh(new THREE.PlaneGeometry(700, SITE.seaStart - SITE.beachStart + 6), siteMats.sand);
    sand.rotation.x = -Math.PI / 2; sand.position.set(0, -0.005, (SITE.beachStart + SITE.seaStart) / 2); sand.receiveShadow = true; site.add(sand);

    const sea = new THREE.Mesh(new THREE.PlaneGeometry(700, 60), siteMats.sea);
    sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.0, SITE.seaStart + 30); site.add(sea);
    const seaFar = new THREE.Mesh(new THREE.PlaneGeometry(700, 400), siteMats.seaFar);
    seaFar.rotation.x = -Math.PI / 2; seaFar.position.set(0, -0.01, SITE.seaStart + 60 + 200); site.add(seaFar);

    const road = new THREE.Mesh(new THREE.PlaneGeometry(700, 6), siteMats.road);
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0.0, SITE.road); road.receiveShadow = true; site.add(road);

    // paved plaza linking main building, pools and the towers
    const plazaA = flatShape(roundedRect(46, 30, 6), siteMats.plaza, 0.004);
    plazaA.position.set(34, 0.004, -4); site.add(plazaA);
    const plazaB = flatShape(roundedRect(30, 34, 6), siteMats.plaza, 0.004);
    plazaB.position.set(15, 0.004, 19); site.add(plazaB);

    for (const p of SITE.pools) {
      const cope = flatShape(roundedRect(p.w + 1.2, p.d + 1.2, 1.6), siteMats.coping, 0.02);
      cope.position.x = p.x; cope.position.z = p.z; site.add(cope);
      const water = flatShape(roundedRect(p.w, p.d, 1.2), siteMats.pool, 0.04);
      water.position.x = p.x; water.position.z = p.z; site.add(water);
    }
    for (const c of SITE.courts) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(c.w, c.d), new THREE.MeshStandardMaterial({ color: c.color, roughness: 0.9 }));
      m.rotation.x = -Math.PI / 2; m.position.set(c.x, 0.03, c.z); m.receiveShadow = true; site.add(m);
      const lines = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.PlaneGeometry(c.w - 0.6, c.d - 0.6)),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }),
      );
      lines.rotation.x = -Math.PI / 2; lines.position.set(c.x, 0.04, c.z); site.add(lines);
      const mid = new THREE.Mesh(new THREE.PlaneGeometry(c.w - 0.6, 0.06), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      mid.rotation.x = -Math.PI / 2; mid.position.set(c.x, 0.04, c.z); site.add(mid);
    }

    // main building: low wings around a courtyard
    const mb = SITE.mainBuilding;
    const mainGroup = new THREE.Group(); mainGroup.position.set(mb.x, 0, mb.z); site.add(mainGroup);
    const wings = [
      [0, -mb.d / 2 + 2.5, mb.w, 5], [0, mb.d / 2 - 2.5, mb.w * 0.8, 5],
      [-mb.w / 2 + 2.5, 0, 5, mb.d], [mb.w / 2 - 2.5, 0, 5, mb.d * 0.7],
    ];
    for (const [x, z, w, d] of wings) {
      const geo = tiledBox(w, mb.h, d, 1.4);
      const mats = [siteMats.main, siteMats.main, siteMats.mainRoof, siteMats.mainRoof, siteMats.main, siteMats.main];
      const m = new THREE.Mesh(geo, mats); m.position.set(x, mb.h / 2, z);
      m.castShadow = true; m.receiveShadow = true; mainGroup.add(m);
    }
    const lobby = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 1.4, 40), siteMats.mainRoof);
    lobby.position.set(-mb.w / 2 + 2.5, mb.h + 0.7, -mb.d / 2 + 2.5); lobby.castShadow = true; mainGroup.add(lobby);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2.6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), siteMats.mainRoof);
    dome.position.set(-mb.w / 2 + 2.5, mb.h + 1.4, -mb.d / 2 + 2.5); dome.castShadow = true; mainGroup.add(dome);
  }

  /* ---------- towers ---------- */
  const bData = {};            // bkey -> { group, floors: {fk: floorRec}, order:[fk], bounds, center, roomCount }
  const roomIndex = {};        // "bkey:num" -> rec
  const pickables = [];

  const roomGeo = new THREE.BoxGeometry(ROOM_SIZE, ROOM_H, ROOM_SIZE);
  const slabGeo = new THREE.BoxGeometry(1.0, SLAB_T, 1.0);
  const cellGeo = new THREE.BoxGeometry(1.0, FLOOR_H, 1.0);
  const tmpM = new THREE.Matrix4();
  const white = new THREE.Color(1, 1, 1);

  function newFloorMats() {
    const side = withRoomGlow(new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex.wall, roughness: 0.82, emissiveMap: tex.glow, emissive: 0xffc27a, emissiveIntensity: T.glow }));
    const top = new THREE.MeshStandardMaterial({ color: T.top, roughness: 0.9 });
    const slab = new THREE.MeshStandardMaterial({ color: T.slab, roughness: 0.95 });
    const core = new THREE.MeshStandardMaterial({ color: T.core, roughness: 0.8 });
    const glass = new THREE.MeshStandardMaterial({ color: T.glass, roughness: 0.15, transparent: true, opacity: 0.55 });
    const service = new THREE.MeshStandardMaterial({ color: T.service, roughness: 0.95 });
    const podium = new THREE.MeshStandardMaterial({ color: T.podium, roughness: 0.95 });
    return { side, top, slab, core, glass, service, podium };
  }

  function instanced(geo, mat, cells, y, store) {
    if (!cells.length) return null;
    const m = new THREE.InstancedMesh(geo, mat, cells.length);
    cells.forEach((c, i) => { tmpM.makeTranslation(c.x, y, c.z); m.setMatrixAt(i, tmpM); });
    m.castShadow = true; m.receiveShadow = true;
    store.add(m);
    return m;
  }

  for (const bkey of D.buildingOrder) {
    const B = D.buildings[bkey];
    const cfg = BUILDINGS[bkey] || { x: 0, z: 0, rotation: 0 };
    const group = new THREE.Group();
    group.position.set(cfg.x, 0, cfg.z);
    group.rotation.y = THREE.MathUtils.degToRad(cfg.rotation || 0);
    scene.add(group);

    const order = Object.keys(B.floors).sort((a, b) => B.floors[a].order - B.floors[b].order);
    const recs = {};
    const occupied = {};
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;

    for (const fk of order) {
      const F = B.floors[fk];
      const fac = F.facilities || [];
      const anchor = fac.find((f) => f.label === "Lift 2") || fac.find((f) => /lift/i.test(f.label)) || { row: Math.floor(F.rows / 2), col: Math.floor(F.cols / 2) };
      const rooms = Object.values(B.rooms).filter((r) => r.floor === fk && r.type !== "PI");
      const cells = [];
      const set = new Set();
      for (const r of rooms) {
        const x = r.col - anchor.col, z = r.row - anchor.row;
        cells.push({ x, z, room: r }); set.add(x + "," + z);
      }
      const facCells = { core: [], glass: [], service: [] };
      for (const f of fac) {
        const x = f.col - anchor.col, z = f.row - anchor.row; set.add(x + "," + z);
        const kind = /lift/i.test(f.label) ? "core" : /atrium/i.test(f.label) ? "glass" : "service";
        facCells[kind].push({ x, z, label: f.label });
      }
      occupied[fk] = set;
      for (const k of set) { const [x, z] = k.split(",").map(Number); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
      recs[fk] = { fk, label: F.label, order: F.order, y: F.order * FLOOR_H, cells, facCells, rooms };
    }

    // podium: fill any cell that a higher floor covers but this floor doesn't, so nothing floats
    const above = new Set();
    for (let i = order.length - 1; i >= 0; i--) {
      const fk = order[i];
      recs[fk].podium = [...above].filter((k) => !occupied[fk].has(k)).map((k) => { const [x, z] = k.split(",").map(Number); return { x, z }; });
      for (const k of occupied[fk]) above.add(k);
    }

    for (const fk of order) {
      const r = recs[fk];
      const fg = new THREE.Group(); fg.position.y = r.y; group.add(fg);
      const mats = newFloorMats();
      const slabCells = [...occupied[fk]].map((k) => { const [x, z] = k.split(",").map(Number); return { x, z }; });
      instanced(slabGeo, mats.slab, slabCells, SLAB_T / 2, fg);
      instanced(cellGeo, mats.podium, r.podium, FLOOR_H / 2, fg);
      instanced(cellGeo, mats.core, r.facCells.core, FLOOR_H / 2, fg);
      const g = instanced(cellGeo, mats.glass, r.facCells.glass, FLOOR_H / 2, fg);
      if (g) g.castShadow = false;
      const svc = r.facCells.service.length ? instanced(new THREE.BoxGeometry(1, ROOM_H * 0.6, 1), mats.service, r.facCells.service, SLAB_T + ROOM_H * 0.3, fg) : null;
      const roomMats = [mats.side, mats.side, mats.top, mats.top, mats.side, mats.side];
      const geo = roomGeo.clone();
      geo.setAttribute("aGlow", new THREE.InstancedBufferAttribute(new Float32Array(r.cells.length).fill(1), 1));
      const rm = instanced(geo, roomMats, r.cells, SLAB_T + ROOM_H / 2, fg);
      if (rm) {
        rm.userData = { bkey, fk, nums: r.cells.map((c) => String(c.room.room)) };
        r.cells.forEach((c, i) => {
          rm.setColorAt(i, white);
          const key = bkey + ":" + c.room.room;
          roomIndex[key] = {
            key, bkey, fk, num: String(c.room.room), room: c.room, mesh: rm, idx: i,
            local: new THREE.Vector3(c.x, SLAB_T + ROOM_H / 2, c.z), floorGroup: fg,
            view: primaryView(c.room), cat: categoryOf(c.room),
          };
        });
        rm.instanceColor.needsUpdate = true;
        pickables.push(rm);
      }
      Object.assign(r, { group: fg, mats, roomMesh: rm, serviceMesh: svc, lift: 0, liftTarget: 0, opacity: 1, opacityTarget: 1 });
    }

    // crown on the lift core above the top floor
    const top = recs[order[order.length - 1]];
    const crownMats = newFloorMats();
    const crown = new THREE.Group(); crown.position.y = top.y + FLOOR_H; group.add(crown);
    const cx = top.facCells.core.reduce((s, c) => s + c.x, 0) / Math.max(1, top.facCells.core.length);
    const cz = top.facCells.core.reduce((s, c) => s + c.z, 0) / Math.max(1, top.facCells.core.length);
    const crownGeo = tiledBox(3.4, 1.1, 2.4, 1.1);
    crownGeo.setAttribute("aGlow", new THREE.Float32BufferAttribute(new Float32Array(crownGeo.attributes.position.count).fill(1), 1));
    const base = new THREE.Mesh(crownGeo, [crownMats.side, crownMats.side, crownMats.top, crownMats.top, crownMats.side, crownMats.side]);
    base.position.set(cx, 0.55, cz); base.castShadow = true; crown.add(base);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.18, 3.0), crownMats.slab);
    cap.position.set(cx, 1.2, cz); cap.castShadow = true; crown.add(cap);

    const bounds = new THREE.Box3(
      new THREE.Vector3(minX - 0.5, 0, minZ - 0.5),
      new THREE.Vector3(maxX + 0.5, order.length * FLOOR_H + 1.3, maxZ + 0.5),
    );
    bData[bkey] = {
      bkey, label: B.label, group, floors: recs, order, bounds, crown, crownMats,
      roomCount: Object.values(recs).reduce((s, r) => s + r.cells.length, 0), opacity: 1, opacityTarget: 1,
    };
  }

  /* ---------- palms (instanced) ---------- */
  {
    const rand = seeded(7);
    const spots = [];
    const blocked = (x, z) => {
      for (const b of Object.values(bData)) {
        const c = b.group.position; const bx = b.bounds;
        if (x > c.x + bx.min.x - 2 && x < c.x + bx.max.x + 2 && z > c.z + bx.min.z - 2 && z < c.z + bx.max.z + 2) return true;
      }
      const mb = SITE.mainBuilding;
      if (Math.abs(x - mb.x) < mb.w / 2 + 2 && Math.abs(z - mb.z) < mb.d / 2 + 2) return true;
      for (const p of SITE.pools) if (Math.abs(x - p.x) < p.w / 2 + 1.2 && Math.abs(z - p.z) < p.d / 2 + 1.2) return true;
      return false;
    };
    for (let x = -70; x <= 90; x += 6) { spots.push([x + rand() * 1.5, SITE.road + 4.5]); spots.push([x + rand() * 1.5, SITE.road - 4.5]); }
    for (let x = -70; x <= 90; x += 9) spots.push([x + rand() * 3, SITE.beachStart - 1.5 + rand() * 2]);
    for (let i = 0; i < 70; i++) {
      const x = -60 + rand() * 140, z = -34 + rand() * 72;
      if (!blocked(x, z)) spots.push([x, z]);
    }
    const trunkGeo = new THREE.CylinderGeometry(0.07, 0.11, 3.0, 6); trunkGeo.translate(0, 1.5, 0);
    const crownGeo = new THREE.ConeGeometry(0.95, 0.55, 7, 1, true); crownGeo.rotateX(Math.PI); crownGeo.translate(0, 3.05, 0);
    const trunks = new THREE.InstancedMesh(trunkGeo, siteMats.trunk, spots.length);
    const crowns = new THREE.InstancedMesh(crownGeo, siteMats.palm, spots.length);
    const q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
    spots.forEach(([x, z], i) => {
      const k = 0.8 + rand() * 0.5;
      e.set((rand() - 0.5) * 0.15, rand() * Math.PI, (rand() - 0.5) * 0.15); q.setFromEuler(e);
      s.set(k, k, k); p.set(x, 0, z);
      tmpM.compose(p, q, s); trunks.setMatrixAt(i, tmpM); crowns.setMatrixAt(i, tmpM);
    });
    trunks.castShadow = crowns.castShadow = true;
    site.add(trunks, crowns);
  }

  /* ---------- selection markers ---------- */
  const selBox = new THREE.Group();
  {
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(ROOM_SIZE + 0.1, ROOM_H + 0.1, ROOM_SIZE + 0.1)),
      new THREE.LineBasicMaterial({ color: 0x6b4e33, linewidth: 2 }),
    );
    const glowBox = new THREE.Mesh(
      new THREE.BoxGeometry(ROOM_SIZE + 0.16, ROOM_H + 0.16, ROOM_SIZE + 0.16),
      new THREE.MeshBasicMaterial({ color: 0xe3b04f, transparent: true, opacity: 0.42, depthWrite: false }),
    );
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 6, 8),
      new THREE.MeshBasicMaterial({ color: 0xc9a24b, transparent: true, opacity: 0.55, depthWrite: false }),
    );
    beam.position.y = 3.4;
    selBox.add(edges, glowBox, beam); selBox.visible = false;
  }
  const connBox = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(ROOM_SIZE + 0.08, ROOM_H + 0.08, ROOM_SIZE + 0.08)),
    new THREE.LineDashedMaterial({ color: 0xc9a24b, dashSize: 0.12, gapSize: 0.08 }),
  );
  connBox.computeLineDistances(); connBox.visible = false;

  /* ---------- floor number labels (one canvas per floor, made on demand) ---------- */
  const numberPlanes = {};
  function numberPlane(bkey, fk) {
    const key = bkey + ":" + fk;
    if (numberPlanes[key]) return numberPlanes[key];
    const r = bData[bkey].floors[fk];
    if (!r.cells.length) return null;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const c of r.cells) { minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x); minZ = Math.min(minZ, c.z); maxZ = Math.max(maxZ, c.z); }
    const PX = 96;
    const w = maxX - minX + 1, d = maxZ - minZ + 1;
    const cv = document.createElement("canvas"); cv.width = w * PX; cv.height = d * PX;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }),
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(minX + w / 2 - 0.5, SLAB_T + ROOM_H + 0.012, minZ + d / 2 - 0.5);
    plane.renderOrder = 5;
    const rec = { plane, cv, minX, minZ, PX, r };
    paintNumbers(rec);
    r.group.add(plane);
    numberPlanes[key] = rec;
    return rec;
  }
  function paintNumbers(rec) {
    const g = rec.cv.getContext("2d");
    g.clearRect(0, 0, rec.cv.width, rec.cv.height);
    g.font = `700 ${Math.round(rec.PX * 0.3)}px "Plus Jakarta Sans", system-ui, sans-serif`;
    g.textAlign = "center"; g.textBaseline = "middle";
    g.lineJoin = "round"; g.lineWidth = rec.PX * 0.07;
    for (const c of rec.r.cells) {
      const x = (c.x - rec.minX + 0.5) * rec.PX, y = (c.z - rec.minZ + 0.5) * rec.PX;
      const t = String(c.room.room);
      g.strokeStyle = T.labelHalo; g.strokeText(t, x, y);
      g.fillStyle = T.labelInk; g.fillText(t, x, y);
    }
    if (rec.plane.material.map) rec.plane.material.map.dispose();
    const t = new THREE.CanvasTexture(rec.cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    rec.plane.material.map = t; rec.plane.material.needsUpdate = true;
  }

  /* ---------- colouring & filters ---------- */
  const cTmp = new THREE.Color();
  const cDim = new THREE.Color();
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

  function baseColor(rec, out) {
    if (state.mode === "view") return out.setHex(VIEWS[rec.view].color);
    if (state.mode === "category") return out.setHex(rec.cat ? CATEGORIES[rec.cat].color : VIEWS.NONE.color);
    return out.copy(white);
  }
  function recolor() {
    const on = filtering();
    cDim.setHex(T.dim);
    let count = 0; const perB = {};
    for (const rec of Object.values(roomIndex)) {
      const m = on ? matches(rec) : true;
      if (m && on) { count++; perB[rec.bkey] = (perB[rec.bkey] || 0) + 1; }
      baseColor(rec, cTmp);
      if (on && !m) cTmp.copy(cDim);
      else if (on && m && state.mode === "plain") cTmp.setHex(0xe0a94e);
      rec.mesh.setColorAt(rec.idx, cTmp);
      rec.mesh.geometry.attributes.aGlow.setX(rec.idx, on && !m ? 0.06 : 1);
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
    scene.background.setHex(T.sky); scene.fog.color.setHex(T.sky);
    hemi.color.setHex(T.hemiSky); hemi.groundColor.setHex(T.hemiGround); hemi.intensity = T.hemi;
    sun.color.setHex(T.sunColor); sun.intensity = T.sun;
    for (const k of ["ground", "plaza", "sand", "sea", "seaFar", "coping", "road", "trunk", "palm", "mainRoof"]) siteMats[k].color.setHex(T[k]);
    siteMats.pool.color.setHex(T.pool); siteMats.pool.emissive.setHex(T.pool);
    siteMats.main.color.setHex(T.main); siteMats.main.emissiveIntensity = T.glow;
    const setMats = (m) => {
      m.side.emissiveIntensity = T.glow; m.top.color.setHex(T.top); m.slab.color.setHex(T.slab);
      m.core.color.setHex(T.core); m.glass.color.setHex(T.glass); m.service.color.setHex(T.service); m.podium.color.setHex(T.podium);
    };
    for (const b of Object.values(bData)) { for (const r of Object.values(b.floors)) setMats(r.mats); setMats(b.crownMats); }
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
    const top = new THREE.Vector3(0, b.bounds.max.y + 1.6, 0);
    tags.push({ el, world: () => b.group.localToWorld(top.clone()), show: () => state.level === "resort" });
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
      const off = projV.z > 1 || Math.abs(projV.x) > 1.1 || Math.abs(projV.y) > 1.1;
      t.el.hidden = off;
      if (!off) t.el.style.transform = `translate(${(projV.x * 0.5 + 0.5) * w}px, ${(-projV.y * 0.5 + 0.5) * h}px) translate(-50%, -100%)`;
    }
  }

  /* ---------- camera flights ---------- */
  let flight = null;
  function flyTo(pos, target, dur = 950) {
    flight = { t0: performance.now(), dur, p0: camera.position.clone(), t0v: controls.target.clone(), p1: pos.clone(), t1: target.clone() };
    requestRender();
  }
  function worldCenter(b) {
    const c = new THREE.Vector3(); b.bounds.getCenter(c); return b.group.localToWorld(c);
  }
  const VIEW_DIR = new THREE.Vector3(0.62, 0.72, 1).normalize();
  function frameBuilding(b) {
    const size = new THREE.Vector3(); b.bounds.getSize(size);
    const c = worldCenter(b); c.y = size.y * 0.35;
    const dist = Math.max(size.x, size.z, size.y * 1.6) * 2.3;
    flyTo(c.clone().addScaledVector(VIEW_DIR, dist), c);
  }
  function frameFloor(b, fk) {
    const r = b.floors[fk];
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    const all = r.cells.length ? r.cells : r.facCells.core;
    for (const c of all) { minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x); minZ = Math.min(minZ, c.z); maxZ = Math.max(maxZ, c.z); }
    const c = b.group.localToWorld(new THREE.Vector3((minX + maxX) / 2, r.y + ROOM_H, (minZ + maxZ) / 2));
    const span = Math.max(maxX - minX, maxZ - minZ) + 2;
    const dir = new THREE.Vector3(0.45, 1.25, 0.8).normalize();
    flyTo(c.clone().addScaledVector(dir, span * 2.15), c);
  }

  /* ---------- level transitions ---------- */
  function setBuildingFocus(bkey) {
    for (const b of Object.values(bData)) b.opacityTarget = !bkey || b.bkey === bkey ? 1 : 0.13;
  }
  function setFloorFocus(bkey, fk) {
    for (const b of Object.values(bData)) {
      const selOrder = b.bkey === bkey && fk ? b.floors[fk].order : Infinity;
      for (const r of Object.values(b.floors)) {
        const up = r.order > selOrder;
        r.liftTarget = up ? LIFT_AWAY + (r.order - selOrder) * 1.2 : 0;
        r.opacityTarget = up ? 0 : 1;
      }
      b.crownLift = b.bkey === bkey && fk ? LIFT_AWAY + 4 : 0;
    }
    for (const [key, rec] of Object.entries(numberPlanes)) rec.plane.visible = key === bkey + ":" + fk;
    if (bkey && fk) { const np = numberPlane(bkey, fk); if (np) np.plane.visible = true; }
  }

  function goResort() {
    state.level = "resort"; state.bkey = null; state.fk = null; clearSelection();
    setBuildingFocus(null); setFloorFocus(null, null);
    flyTo(HOME.pos, HOME.target, 1100);
    renderPanel(); syncHash();
  }
  function goBuilding(bkey) {
    state.level = "building"; state.bkey = bkey; state.fk = null; clearSelection();
    setBuildingFocus(bkey); setFloorFocus(bkey, null);
    frameBuilding(bData[bkey]);
    renderPanel(); syncHash();
  }
  function goFloor(bkey, fk, { keepSelection = false, fly = true } = {}) {
    state.level = "floor"; state.bkey = bkey; state.fk = fk;
    if (!keepSelection) clearSelection();
    setBuildingFocus(bkey); setFloorFocus(bkey, fk);
    if (fly) frameFloor(bData[bkey], fk);
    renderPanel(); syncHash();
  }
  function selectRoom(key, { fly = true } = {}) {
    const rec = roomIndex[key];
    if (!rec) return false;
    if (state.level !== "floor" || state.bkey !== rec.bkey || state.fk !== rec.fk) goFloor(rec.bkey, rec.fk, { keepSelection: true, fly: false });
    state.sel = key;
    rec.floorGroup.add(selBox); selBox.position.copy(rec.local); selBox.visible = true;
    const conn = rec.room.connecting != null ? roomIndex[rec.bkey + ":" + rec.room.connecting] : null;
    if (conn && conn.fk === rec.fk) { conn.floorGroup.add(connBox); connBox.position.copy(conn.local); connBox.visible = true; }
    else connBox.visible = false;
    if (fly) {
      const b = bData[rec.bkey];
      const r = b.floors[rec.fk];
      const w = b.group.localToWorld(new THREE.Vector3(rec.local.x, r.y + ROOM_H, rec.local.z));
      const dir = new THREE.Vector3(0.45, 1.25, 0.8).normalize();
      flyTo(w.clone().addScaledVector(dir, 26), w, 900);
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

  /* ---------- panel (left) ---------- */
  function viewBreakdown(recs) {
    const counts = {};
    for (const r of recs) counts[r.view] = (counts[r.view] || 0) + 1;
    return VIEW_ORDER.concat("NONE").filter((v) => counts[v]).map((v) =>
      `<span class="rm-mini"><i style="background:#${VIEWS[v].color.toString(16).padStart(6, "0")}"></i>${esc(VIEWS[v].short)} <b>${counts[v]}</b></span>`).join("");
  }
  function recsFor(bkey, fk) {
    return Object.values(roomIndex).filter((r) => r.bkey === bkey && (!fk || r.fk === fk));
  }
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
        <div class="rm-sub">${total} rooms across ${D.buildingOrder.length} buildings. Pick a building, or search a room number.</div>
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
          const r = b.floors[fk];
          return `<button class="rm-row" data-f="${fk}"><span class="rm-row-main"><b>${esc(r.label)}</b><span>${r.cells.length} rooms</span></span><span class="rm-row-go">›</span></button>`;
        }).join("")}</div>`;
    } else {
      const b = bData[state.bkey]; const r = b.floors[state.fk];
      const recs = recsFor(b.bkey, state.fk).sort((a, c) => a.room.room - c.room.room);
      p.innerHTML = `
        <button class="rm-back" data-up>‹ ${esc(b.label)}</button>
        <h2 class="rm-title">${esc(r.label)}</h2>
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

  /* ---------- room card (right) ---------- */
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

  /* ---------- filters & legend (bottom) ---------- */
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
    const sw = (hex, label) => `<span class="rm-mini"><i style="background:#${hex.toString(16).padStart(6, "0")}"></i>${esc(label)}</span>`;
    let html = "";
    if (state.mode === "view") html = ["BEA", "COS", "POO", "GAR", "ROA", "NONE"].map((v) => sw(VIEWS[v].color, VIEWS[v].short)).join("");
    else if (state.mode === "category") html = Object.values(CATEGORIES).map((c) => sw(c.color, c.label)).join("");
    if (filtering()) html += sw(T.dim, "Not matching");
    L.innerHTML = html; L.hidden = !html;
  }

  /* ---------- search ---------- */
  const search = $(".rm-search input");
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

  let toastTimer = 0;
  function toast(msg) {
    const t = $(".rm-toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
  }

  /* ---------- picking ---------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tip = $(".rm-tip");
  function pick(ev) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const visible = pickables.filter((m) => {
      const r = bData[m.userData.bkey].floors[m.userData.fk];
      return r.opacity > 0.5 && bData[m.userData.bkey].opacity > 0.5;
    });
    const hit = ray.intersectObjects(visible, false)[0];
    if (!hit) return null;
    const key = hit.object.userData.bkey + ":" + hit.object.userData.nums[hit.instanceId];
    return roomIndex[key];
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
      tip.innerHTML = state.level === "resort"
        ? `<b>${esc(bData[rec.bkey].label)}</b>`
        : `<b>${esc(rec.num)}</b> ${esc(typeLabel(rec.room))}`;
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

  // On phones the panel/card are bottom sheets: shift the picture up so the
  // focused building or room stays visible above them.
  function updateViewOffset() {
    const w = root.clientWidth, h = root.clientHeight;
    if (!w || !h) return;
    if (w < 760) {
      const card = !$(".rm-card").hidden;
      camera.setViewOffset(w, h, 0, Math.round(h * (card ? 0.27 : 0.17)), w, h);
    } else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    requestRender();
  }
  function resize() {
    const w = root.clientWidth, h = root.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 640 ? 40 : 30;
    updateViewOffset();
  }
  new ResizeObserver(resize).observe(root);

  function stepAnimations(dt) {
    let busy = false;
    const k = 1 - Math.pow(0.0009, dt);           // frame-rate independent smoothing
    for (const b of Object.values(bData)) {
      if (Math.abs(b.opacity - b.opacityTarget) > 0.004) { b.opacity += (b.opacityTarget - b.opacity) * k; busy = true; }
      else b.opacity = b.opacityTarget;
      const cl = b.crownLift || 0;
      const cur = b.crown.userData.lift || 0;
      if (Math.abs(cur - cl) > 0.01) { b.crown.userData.lift = cur + (cl - cur) * k; busy = true; }
      else b.crown.userData.lift = cl;
      const cf = b.crown.userData.fade ?? 1, cft = cl ? 0 : 1;
      if (Math.abs(cf - cft) > 0.004) { b.crown.userData.fade = cf + (cft - cf) * k; busy = true; }
      else b.crown.userData.fade = cft;
      const top = b.floors[b.order[b.order.length - 1]];
      b.crown.position.y = top.y + FLOOR_H + b.crown.userData.lift;
      const crownO = b.opacity * b.crown.userData.fade;
      setOpacity(b.crownMats, crownO); b.crown.visible = crownO > 0.01;
      for (const r of Object.values(b.floors)) {
        if (Math.abs(r.lift - r.liftTarget) > 0.01) { r.lift += (r.liftTarget - r.lift) * k; busy = true; } else r.lift = r.liftTarget;
        if (Math.abs(r.opacity - r.opacityTarget) > 0.004) { r.opacity += (r.opacityTarget - r.opacity) * k; busy = true; } else r.opacity = r.opacityTarget;
        r.group.position.y = r.y + r.lift;
        const o = r.opacity * b.opacity;
        setOpacity(r.mats, o);
        r.group.visible = o > 0.01;
      }
    }
    if (flight) {
      const t = Math.min(1, (performance.now() - flight.t0) / flight.dur), e = ease(t);
      camera.position.lerpVectors(flight.p0, flight.p1, e);
      controls.target.lerpVectors(flight.t0v, flight.t1, e);
      if (t >= 1) flight = null;
      busy = true;
    }
    return busy;
  }
  function setOpacity(m, o) {
    for (const key of ["side", "top", "slab", "core", "service", "podium"]) {
      const mat = m[key]; const tr = o < 0.999;
      if (mat.transparent !== tr) { mat.transparent = tr; mat.needsUpdate = true; }
      mat.opacity = o; mat.depthWrite = o > 0.6;
    }
    m.glass.opacity = 0.55 * o;
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
