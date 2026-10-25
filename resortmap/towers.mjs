/* ============================================================
   Resort Map — towers generated from Room Guide floor grids.
   Each room is a loggia module facing its real outward side
   (the side with no neighbour on the same floor). The central
   hub (lifts/atrium) becomes the mint core that ends in the crown.
   ============================================================ */
import * as THREE from "./vendor/three.module.min.js";
import * as TX from "./textures.mjs";

export const FLOOR_H = 1.0;
export const SLAB_T = 0.08;
export const BODY_H = FLOOR_H - SLAB_T;     // 0.92
export const BODY_D = 0.78;                 // room body depth; the rest of the cell is the loggia
const BODY_Z = -0.5 + BODY_D / 2;           // body centre along local z
const LOGGIA_D = 1 - BODY_D;

const DIRS = {               // outward direction -> rotation that turns local +z to it
  N: { dx: 0, dz: -1, rot: Math.PI },
  S: { dx: 0, dz: 1, rot: 0 },
  E: { dx: 1, dz: 0, rot: Math.PI / 2 },
  W: { dx: -1, dz: 0, rot: -Math.PI / 2 },
};
const hash = (a, b) => { let h = (a * 73856093) ^ (b * 19349663); h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };

/* Per-room window glow: an instanced attribute scales the emissive term. */
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

/* Terrace tops ignore the wall tint in Natural mode; data modes fade the tint in. */
export const ROOF_TINT = { value: 0 };
function roofMaterial(params) {
  const mat = new THREE.MeshStandardMaterial(params);
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uRoofTint = ROOF_TINT;
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uRoofTint;")
      .replace("#include <color_fragment>", "#ifdef USE_COLOR\n diffuseColor.rgb *= mix(vec3(1.0), vColor, uRoofTint);\n#endif");
  };
  mat.customProgramCacheKey = () => "rm-roof";
  return mat;
}

/* Box with per-face UV repeat in world units so painted details keep their size. */
function tiledBox(w, h, d, tile) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v;
    uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(dims[f][0] / tile)), uv.getY(i) * Math.max(1, Math.round(dims[f][1] / tile)));
  }
  return g;
}

export function createTowerKit() {
  const t = {
    front: TX.roomFront(), side: TX.roomSide(), stucco: TX.stucco(), arcade: TX.arcade(),
    parapet: TX.parapet(), pergola: TX.pergola(), paving: TX.paving(), core: TX.coreWall(), crown: TX.crownWall(),
  };
  // geometry shared by every floor
  const body = new THREE.BoxGeometry(1, BODY_H, BODY_D); body.translate(0, SLAB_T + BODY_H / 2, BODY_Z);
  const slab = new THREE.BoxGeometry(1, SLAB_T, 1); slab.translate(0, SLAB_T / 2, 0);
  const cell = new THREE.BoxGeometry(1, FLOOR_H, 1); cell.translate(0, FLOOR_H / 2, 0);
  const parapetFront = new THREE.PlaneGeometry(1, 0.27); parapetFront.translate(0, SLAB_T + 0.135, 0.5 - 0.02);
  const roofEdge = new THREE.PlaneGeometry(1, 0.2); roofEdge.translate(0, FLOOR_H + 0.1, 0);
  const pergola = new THREE.PlaneGeometry(1, LOGGIA_D + 0.06); pergola.rotateX(-Math.PI / 2); pergola.translate(0, FLOOR_H - 0.06, 0.5 - LOGGIA_D / 2);
  const post = new THREE.BoxGeometry(0.04, BODY_H - 0.06, 0.04); post.translate(0, SLAB_T + (BODY_H - 0.06) / 2, 0.47);
  const plinth = new THREE.BoxGeometry(1, 0.1, 1); plinth.translate(0, 0.05, 0);
  return { t, geo: { body, slab, cell, parapetFront, roofEdge, pergola, post, plinth } };
}

function floorMaterials(kit) {
  const t = kit.t;
  const glow = { emissive: 0xffc27a, emissiveIntensity: 0 };
  const m = {
    front: withRoomGlow(new THREE.MeshStandardMaterial({ map: t.front.map, emissiveMap: t.front.glow, roughness: 0.88, ...glow })),
    side: withRoomGlow(new THREE.MeshStandardMaterial({ map: t.side.map, emissiveMap: t.side.glow, roughness: 0.88, ...glow })),
    plain: new THREE.MeshStandardMaterial({ map: t.stucco, roughness: 0.9 }),
    roof: roofMaterial({ map: t.paving, color: TX.PALETTE.terrace, roughness: 0.95 }),
    slabTop: new THREE.MeshStandardMaterial({ map: t.paving, color: TX.PALETTE.terrace, roughness: 0.95 }),
    slabSide: new THREE.MeshStandardMaterial({ color: 0xf0dcc0, roughness: 0.9 }),
    parapet: new THREE.MeshStandardMaterial({ map: t.parapet, color: TX.PALETTE.parapet, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }),
    parapetWarm: new THREE.MeshStandardMaterial({ map: t.parapet, color: 0xffffff, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }),
    pergola: new THREE.MeshStandardMaterial({ map: t.pergola, color: TX.PALETTE.pergola, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 }),
    post: new THREE.MeshStandardMaterial({ color: TX.PALETTE.pergola, roughness: 0.8 }),
    core: new THREE.MeshStandardMaterial({ map: t.core, color: TX.PALETTE.mint, roughness: 0.85 }),
    podium: new THREE.MeshStandardMaterial({ map: t.arcade, roughness: 0.9 }),
  };
  m.all = Object.values(m);
  m.glowMats = [m.front, m.side];
  return m;
}

const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpP = new THREE.Vector3(), tmpS = new THREE.Vector3(1, 1, 1);
const UP = new THREE.Vector3(0, 1, 0);
function place(list, mesh) {
  list.forEach((p, i) => {
    tmpQ.setFromAxisAngle(UP, p.rot || 0); tmpP.set(p.x, p.y || 0, p.z);
    tmpS.set(p.sx || 1, p.sy || 1, p.sz || 1);
    tmpM.compose(tmpP, tmpQ, tmpS); mesh.setMatrixAt(i, tmpM);
  });
}
function inst(geo, mat, list, parent, { cast = true, receive = true } = {}) {
  if (!list.length) return null;
  const m = new THREE.InstancedMesh(geo, mat, list.length);
  place(list, m); m.castShadow = cast; m.receiveShadow = receive;
  m.computeBoundingSphere();
  parent.add(m);
  return m;
}

/**
 * Build one tower. Returns floor records and room records; the caller owns the scene graph.
 * cfg: { x, z, rotation } in degrees.
 */
export function buildTower(kit, bkey, B, cfg) {
  const group = new THREE.Group();
  group.position.set(cfg.x, 0, cfg.z);
  group.rotation.y = THREE.MathUtils.degToRad(cfg.rotation || 0);

  const order = Object.keys(B.floors).sort((a, b) => B.floors[a].order - B.floors[b].order);
  const floors = {};
  const occAll = {};
  // pass 1: cells per floor, aligned on the lift core
  for (const fk of order) {
    const F = B.floors[fk];
    const fac = F.facilities || [];
    const anchor = fac.find((f) => f.label === "Lift 2") || fac.find((f) => /lift/i.test(f.label)) || { row: F.rows >> 1, col: F.cols >> 1 };
    const rooms = Object.values(B.rooms).filter((r) => r.floor === fk && r.type !== "PI")
      .map((r) => ({ room: r, x: r.col - anchor.col, z: r.row - anchor.row }));
    const roomSet = new Set(rooms.map((r) => r.x + "," + r.z));
    const facCells = fac.map((f) => ({ x: f.col - anchor.col, z: f.row - anchor.row, label: f.label }));
    // hub: bounding box of the facility cells, minus room cells
    let hx0 = Infinity, hx1 = -Infinity, hz0 = Infinity, hz1 = -Infinity;
    for (const c of facCells) { hx0 = Math.min(hx0, c.x); hx1 = Math.max(hx1, c.x); hz0 = Math.min(hz0, c.z); hz1 = Math.max(hz1, c.z); }
    const core = [];
    if (facCells.length) for (let x = hx0; x <= hx1; x++) for (let z = hz0; z <= hz1; z++) if (!roomSet.has(x + "," + z)) core.push({ x, z });
    const occ = new Set([...roomSet, ...core.map((c) => c.x + "," + c.z)]);
    occAll[fk] = occ;
    floors[fk] = { fk, label: F.label, order: F.order, y: F.order * FLOOR_H, rooms, core, occ, hub: { x0: hx0, x1: hx1, z0: hz0, z1: hz1 } };
  }

  // pass 2: geometry
  const roomRecs = [];
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  const above = new Set();
  for (let i = order.length - 1; i >= 0; i--) {
    const f = floors[order[i]];
    f.coveredAbove = new Set(above);
    f.podium = [...above].filter((k) => !f.occ.has(k)).map((k) => { const [x, z] = k.split(",").map(Number); return { x, z }; });
    for (const k of f.occ) above.add(k);
  }
  const footprint = new Set(above);

  for (const fk of order) {
    const f = floors[fk];
    const upper = order[order.indexOf(fk) + 1];
    const occUp = upper ? occAll[upper] : new Set();
    const fg = new THREE.Group(); fg.position.y = f.y; group.add(fg);
    const mats = floorMaterials(kit);

    const bodies = [], fronts = [], roofs = [], pergolas = [], posts = [];
    for (const r of f.rooms) {
      minX = Math.min(minX, r.x); maxX = Math.max(maxX, r.x); minZ = Math.min(minZ, r.z); maxZ = Math.max(maxZ, r.z);
      const open = Object.entries(DIRS).filter(([, d]) => !f.occ.has((r.x + d.dx) + "," + (r.z + d.dz))).map(([k]) => k);
      // primary facade is across the wing, not along it
      const alongX = Math.abs(r.x) >= Math.abs(r.z);
      const pref = alongX ? ["N", "S", "E", "W"] : ["E", "W", "N", "S"];
      const face = pref.find((k) => open.includes(k)) || "S";
      const rot = DIRS[face].rot;
      r.face = face; r.rot = rot;
      const along = alongX ? Math.abs(r.x) : Math.abs(r.z);
      r.cream = along % 4 === 1;
      bodies.push({ x: r.x, z: r.z, rot });
      fronts.push({ x: r.x, z: r.z, rot });
      const roofOpen = !occUp.has(r.x + "," + r.z);
      r.roofOpen = roofOpen;
      if (roofOpen) {
        // parapets on the roof edges of the room body: always the front (over the terrace),
        // plus any side whose neighbour cell on this floor is empty
        const L = (lx, lz, lrot, len) => ({
          x: r.x + lx * Math.cos(rot) + lz * Math.sin(rot),
          z: r.z - lx * Math.sin(rot) + lz * Math.cos(rot),
          rot: rot + lrot, sx: len,
        });
        const sideDir = (lrot) => { const a = rot + lrot; return { dx: Math.round(Math.sin(a)), dz: Math.round(Math.cos(a)) }; };
        const exposed = (lrot) => { const d = sideDir(lrot); return !f.occ.has((r.x + d.dx) + "," + (r.z + d.dz)); };
        roofs.push(L(0, -0.5 + BODY_D, 0, 1));
        if (exposed(Math.PI)) roofs.push(L(0, -0.5, Math.PI, 1));
        if (exposed(Math.PI / 2)) roofs.push(L(0.5, BODY_Z, Math.PI / 2, BODY_D));
        if (exposed(-Math.PI / 2)) roofs.push(L(-0.5, BODY_Z, -Math.PI / 2, BODY_D));
        if (hash(r.x * 7 + 3, r.z * 11 + f.order) > 0.45) {
          pergolas.push({ x: r.x, z: r.z, rot });
          posts.push(L(0.45, 0, 0, 1), L(-0.45, 0, 0, 1));
        }
      }
      roomRecs.push(r);
    }

    const slabCells = [...f.occ].map((k) => { const [x, z] = k.split(",").map(Number); return { x, z }; });
    inst(kit.geo.slab, [mats.slabSide, mats.slabSide, mats.slabTop, mats.slabSide, mats.slabSide, mats.slabSide], slabCells, fg);
    const bodyMesh = inst(kit.geo.body.clone(), [mats.side, mats.side, mats.roof, mats.plain, mats.front, mats.plain], bodies, fg);
    const frontPar = inst(kit.geo.parapetFront, mats.parapetWarm, fronts, fg, { cast: true });
    if (frontPar) {
      const c = new THREE.Color();
      f.rooms.forEach((r, i) => frontPar.setColorAt(i, c.setHex(r.cream ? TX.PALETTE.cream : TX.PALETTE.apricot)));
      frontPar.instanceColor.needsUpdate = true;
    }
    inst(kit.geo.roofEdge, mats.parapet, roofs.map((p) => ({ ...p, sx: p.sx || 1 })), fg);
    inst(kit.geo.pergola, mats.pergola, pergolas, fg);
    inst(kit.geo.post, mats.post, posts.map((p) => ({ ...p, sx: 1 })), fg);
    inst(kit.geo.cell, [mats.core, mats.core, mats.roof, mats.plain, mats.core, mats.core], f.core, fg);
    inst(kit.geo.cell, [mats.podium, mats.podium, mats.roof, mats.plain, mats.podium, mats.podium], f.podium, fg);

    if (bodyMesh) {
      const n = bodies.length;
      bodyMesh.geometry.setAttribute("aGlow", new THREE.InstancedBufferAttribute(new Float32Array(n).fill(1), 1));
      const base = new THREE.Color();
      f.rooms.forEach((r, i) => { base.setHex(r.cream ? TX.PALETTE.cream : TX.PALETTE.apricot); bodyMesh.setColorAt(i, base); r.idx = i; });
      bodyMesh.instanceColor.needsUpdate = true;
      bodyMesh.userData = { bkey, fk, nums: f.rooms.map((r) => String(r.room.room)) };
    }
    Object.assign(f, { group: fg, mats, roomMesh: bodyMesh, lift: 0, liftTarget: 0, opacity: 1, opacityTarget: 1 });
  }

  // ground plinth: the footprint grown by one cell, a cream terrace the tower stands on
  const plinth = new Set();
  for (const k of footprint) { const [x, z] = k.split(",").map(Number); for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) plinth.add((x + dx) + "," + (z + dz)); }
  const plinthMat = new THREE.MeshStandardMaterial({ map: kit.t.paving, color: 0xd9cbb3, roughness: 0.95 });
  inst(kit.geo.plinth, plinthMat, [...plinth].map((k) => { const [x, z] = k.split(",").map(Number); return { x, z }; }), group, { cast: false });

  // crown over the hub of the top floor
  const top = floors[order[order.length - 1]];
  const crown = buildCrown(kit, top.hub);
  crown.group.position.y = top.y + FLOOR_H;
  group.add(crown.group);

  const height = order.length * FLOOR_H + crown.height;
  const bounds = new THREE.Box3(new THREE.Vector3(minX - 0.5, 0, minZ - 0.5), new THREE.Vector3(maxX + 0.5, height, maxZ + 0.5));
  return { bkey, label: B.label, group, floors, order, bounds, crown, roomRecs };
}

function buildCrown(kit, hub) {
  const g = new THREE.Group();
  const cx = (hub.x0 + hub.x1) / 2, cz = (hub.z0 + hub.z1) / 2;
  const w = Math.max(3, hub.x1 - hub.x0 + 2.2), d = Math.max(3, hub.z1 - hub.z0 + 2.2);
  const H = 1.5;
  const wall = new THREE.MeshStandardMaterial({ map: kit.t.crown, color: TX.PALETTE.mint, roughness: 0.85 });
  const roof = new THREE.MeshStandardMaterial({ map: kit.t.paving, color: 0xb7b6b2, roughness: 0.95 });
  const white = new THREE.MeshStandardMaterial({ color: TX.PALETTE.parapet, roughness: 0.9 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xf2e3cf, roughness: 0.9 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xe4a361, roughness: 0.8 });
  const parapetMat = new THREE.MeshStandardMaterial({ map: kit.t.parapet, color: 0xf3f8f5, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 });
  const mats = [wall, roof, white, cream, orange, parapetMat];

  const boxGeo = tiledBox(w, H, d, 1.6);
  const box = new THREE.Mesh(boxGeo, [wall, wall, roof, roof, wall, wall]);
  box.position.set(cx, H / 2, cz); box.castShadow = box.receiveShadow = true; g.add(box);
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.08, d + 0.12), white);
  cornice.position.set(cx, H, cz); cornice.castShadow = true; g.add(cornice);
  // crenellated parapet ring
  for (const [px, pz, len, rot] of [[cx, cz + d / 2, w, 0], [cx, cz - d / 2, w, Math.PI], [cx + w / 2, cz, d, Math.PI / 2], [cx - w / 2, cz, d, -Math.PI / 2]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.32), parapetMat);
    p.position.set(px, H + 0.2, pz); p.rotation.y = rot; p.castShadow = true;
    const tm = parapetMat.map.clone(); tm.wrapS = THREE.RepeatWrapping; tm.repeat.set(Math.round(len), 1); tm.needsUpdate = true;
    p.material = parapetMat.clone(); p.material.map = tm; mats.push(p.material);
    g.add(p);
  }
  // stepped octagonal skylight
  const r1 = Math.min(w, d) * 0.3;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(r1 * 1.25, r1 * 1.3, 0.22, 8), cream);
  base.rotation.y = Math.PI / 8; base.position.set(cx, H + 0.11, cz); base.castShadow = true; g.add(base);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(r1 * 0.95, r1 * 0.95, 0.32, 8, 1, true), orange);
  ring.rotation.y = Math.PI / 8; ring.position.set(cx, H + 0.38, cz); g.add(ring);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(r1 * 0.92, r1 * 0.92, 0.3, 8), cream);
  cap.rotation.y = Math.PI / 8; cap.position.set(cx, H + 0.36, cz); cap.castShadow = true; g.add(cap);
  return { group: g, height: H + 0.6, mats, lift: 0, fade: 1 };
}
