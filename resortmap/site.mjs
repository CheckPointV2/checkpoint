/* ============================================================
   Resort Map — the grounds around the towers.
   Ground, beach and sea are painted into one texture; pools,
   the main building, palms and beach furniture are real geometry.
   All positions are in room-cell units (1 ≈ 4 m); sea is +z.
   ============================================================ */
import * as THREE from "./vendor/three.module.min.js";
import { mergeGeometries } from "./vendor/jsm/utils/BufferGeometryUtils.js";
import * as TX from "./textures.mjs";
import { SITE } from "./config.mjs";

const GROUND = { x0: -110, z0: -95, size: 240, px: 2048 };
const shoreZ = (x) => SITE.shore + 2.6 * Math.sin(x / 17) + 1.2 * Math.sin(x / 7.3 + 1);

function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; }

/* ---------------------------------------------------------------- ground painting */
function paintGround(blocked) {
  const S = GROUND.px, k = S / GROUND.size;
  const c = document.createElement("canvas"); c.width = c.height = S;
  const g = c.getContext("2d");
  const X = (x) => (x - GROUND.x0) * k, Z = (z) => (z - GROUND.z0) * k;
  const r = rng(11);

  // lawn with soft mottling
  g.fillStyle = "#8db25a"; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) {
    const x = r() * S, y = r() * S, rad = 6 + r() * 40;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    const light = r() > 0.5;
    gr.addColorStop(0, light ? "rgba(178,206,110,.22)" : "rgba(84,128,52,.20)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  for (let i = 0; i < 26000; i++) { g.fillStyle = r() > 0.5 ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.05)"; g.fillRect(r() * S, r() * S, 1.5, 1.5); }

  // lagoon behind the road
  const lagoon = g.createLinearGradient(0, Z(SITE.lagoon - 30), 0, Z(SITE.lagoon));
  lagoon.addColorStop(0, "#2b9fc0"); lagoon.addColorStop(1, "#4cc1d2");
  g.fillStyle = lagoon;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(S, 0);
  for (let x = GROUND.x0 + GROUND.size; x >= GROUND.x0; x -= 4) g.lineTo(X(x), Z(SITE.lagoon + 1.5 * Math.sin(x / 13)));
  g.closePath(); g.fill();
  g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 3;
  g.beginPath(); for (let x = GROUND.x0; x <= GROUND.x0 + GROUND.size; x += 4) g.lineTo(X(x), Z(SITE.lagoon + 1.5 * Math.sin(x / 13)) - 2); g.stroke();

  // road with verge, centre dashes and a roundabout
  const road = (pts, w) => {
    g.lineCap = "round"; g.lineJoin = "round";
    g.strokeStyle = "#cfc8bb"; g.lineWidth = (w + 1.6) * k; g.beginPath(); pts.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z)))); g.stroke();
    g.strokeStyle = "#7d7a76"; g.lineWidth = w * k; g.stroke();
    g.setLineDash([2 * k, 2 * k]); g.strokeStyle = "rgba(255,255,255,.7)"; g.lineWidth = 0.18 * k; g.stroke(); g.setLineDash([]);
  };
  road([[GROUND.x0, SITE.road], [GROUND.x0 + GROUND.size, SITE.road]], 4.2);
  road([[SITE.mainBuilding.x - 6, SITE.road], [SITE.mainBuilding.x - 6, SITE.mainBuilding.z - 12]], 3.4);
  const rb = SITE.roundabout;
  g.fillStyle = "#cfc8bb"; g.beginPath(); g.arc(X(rb.x), Z(rb.z), (rb.r + 3) * k, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#7d7a76"; g.beginPath(); g.arc(X(rb.x), Z(rb.z), (rb.r + 2.2) * k, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#98bd62"; g.beginPath(); g.arc(X(rb.x), Z(rb.z), (rb.r - 1) * k, 0, Math.PI * 2); g.fill();
  road([[rb.x, rb.z + rb.r + 2], [rb.x + 10, SITE.beach - 4], [rb.x + 18, SITE.beach]], 3.2);

  // paved plazas & pool decks
  const deck = (x, z, w, d, rad, col) => {
    g.fillStyle = col; g.beginPath(); g.roundRect(X(x - w / 2), Z(z - d / 2), w * k, d * k, rad * k); g.fill();
  };
  for (const p of SITE.plazas) deck(p.x, p.z, p.w, p.d, p.r ?? 3, "#e8dccb");
  for (const p of SITE.pools) deck(p.x, p.z, p.w + 3.2, p.d + 3.2, 2.2, "#eee4d4");
  // subtle paving joints on decks
  g.strokeStyle = "rgba(160,140,110,.12)"; g.lineWidth = 1;
  for (const p of SITE.plazas.concat(SITE.pools.map((q) => ({ ...q, w: q.w + 3.2, d: q.d + 3.2 })))) {
    for (let x = p.x - p.w / 2; x < p.x + p.w / 2; x += 1) { g.beginPath(); g.moveTo(X(x), Z(p.z - p.d / 2)); g.lineTo(X(x), Z(p.z + p.d / 2)); g.stroke(); }
  }

  // garden paths
  g.lineCap = "round"; g.lineJoin = "round";
  for (const path of SITE.paths) {
    g.strokeStyle = "#e3dbcd"; g.lineWidth = (path.w || 1.3) * k;
    g.beginPath(); g.moveTo(X(path.pts[0][0]), Z(path.pts[0][1]));
    for (let i = 1; i < path.pts.length - 1; i++) {
      const [x1, z1] = path.pts[i], [x2, z2] = path.pts[i + 1];
      g.quadraticCurveTo(X(x1), Z(z1), (X(x1) + X(x2)) / 2, (Z(z1) + Z(z2)) / 2);
    }
    const last = path.pts[path.pts.length - 1]; g.lineTo(X(last[0]), Z(last[1])); g.stroke();
  }

  // courts
  for (const ct of SITE.courts) {
    g.save(); g.translate(X(ct.x), Z(ct.z));
    g.fillStyle = ct.surround; g.fillRect(-(ct.w / 2 + 1) * k, -(ct.d / 2 + 1) * k, (ct.w + 2) * k, (ct.d + 2) * k);
    g.fillStyle = ct.color; g.fillRect(-ct.w / 2 * k, -ct.d / 2 * k, ct.w * k, ct.d * k);
    g.strokeStyle = "rgba(255,255,255,.9)"; g.lineWidth = 2;
    g.strokeRect(-ct.w / 2 * k + 3, -ct.d / 2 * k + 3, ct.w * k - 6, ct.d * k - 6);
    g.beginPath(); g.moveTo(-ct.w / 2 * k + 3, 0); g.lineTo(ct.w / 2 * k - 3, 0); g.stroke();
    if (ct.kind === "basketball") { g.beginPath(); g.arc(0, 0, 1.2 * k, 0, Math.PI * 2); g.stroke(); }
    g.restore();
  }

  // beach: dry sand to wet sand, then foam and the sea
  const top = Z(SITE.beach - 1), mid = Z(SITE.shore);
  const sand = g.createLinearGradient(0, top, 0, mid);
  sand.addColorStop(0, "#eedfc2"); sand.addColorStop(0.8, "#e8d5b2"); sand.addColorStop(1, "#d9bf97");
  g.fillStyle = sand;
  g.beginPath(); g.moveTo(0, top);
  for (let x = GROUND.x0; x <= GROUND.x0 + GROUND.size; x += 3) g.lineTo(X(x), Z(SITE.beach + 1.2 * Math.sin(x / 9)));
  g.lineTo(S, S); g.lineTo(0, S); g.closePath(); g.fill();
  for (let i = 0; i < 9000; i++) { const x = r() * S, y = top + r() * (S - top); g.fillStyle = r() > 0.5 ? "rgba(255,255,255,.08)" : "rgba(120,90,50,.06)"; g.fillRect(x, y, 1.5, 1.5); }

  const sea = g.createLinearGradient(0, Z(SITE.shore - 2), 0, S);
  sea.addColorStop(0, "#7fe0d8"); sea.addColorStop(0.08, "#46c6d0"); sea.addColorStop(0.35, "#239fc2"); sea.addColorStop(1, "#16679a");
  const shorePath = () => {
    g.beginPath(); g.moveTo(0, S);
    for (let x = GROUND.x0; x <= GROUND.x0 + GROUND.size; x += 2) g.lineTo(X(x), Z(shoreZ(x)));
    g.lineTo(S, S); g.closePath();
  };
  g.fillStyle = sea; shorePath(); g.fill();
  // shallow band and foam
  for (const [off, col, wdt] of [[0.0, "rgba(255,255,255,.85)", 0.35], [0.9, "rgba(255,255,255,.35)", 0.25], [2.4, "rgba(255,255,255,.18)", 0.2]]) {
    g.strokeStyle = col; g.lineWidth = wdt * k; g.beginPath();
    for (let x = GROUND.x0; x <= GROUND.x0 + GROUND.size; x += 2) g.lineTo(X(x), Z(shoreZ(x) + off + 0.3 * Math.sin(x / 2.3 + off)));
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/* ---------------------------------------------------------------- palms & shrubs */
function palmGeometry() {
  const parts = [];
  const col = (geo, hex) => {
    const c = new THREE.Color(hex); const n = geo.attributes.position.count;
    const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    geo.setAttribute("color", new THREE.BufferAttribute(a, 3));
    if (geo.index) geo = geo.toNonIndexed();
    return geo;
  };
  // gently curved trunk in 4 segments
  const H = 3.0; let px = 0, py = 0;
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.CylinderGeometry(0.075 - i * 0.008, 0.095 - i * 0.008, H / 4 + 0.02, 7);
    const nx = px + 0.06 * (i + 1) * 0.5;
    seg.rotateZ(-0.04 * (i + 1)); seg.translate((px + nx) / 2, py + H / 8, 0);
    parts.push(col(seg, i % 2 ? 0x8c6c4c : 0x7f6143)); px = nx; py += H / 4;
  }
  // fronds: drooping tapered strips
  const N = 9;
  for (let f = 0; f < N; f++) {
    const segs = 6, len = 1.55, w = 0.32;
    const pos = [], idx = [];
    for (let s = 0; s <= segs; s++) {
      const u = s / segs, dist = u * len, droop = -0.95 * u * u + 0.28 * u, half = w * Math.sin(Math.PI * Math.min(1, u * 1.15)) * 0.5 + 0.02;
      pos.push(dist, droop, -half, dist, droop + 0.03, half);
    }
    for (let s = 0; s < segs; s++) { const a = s * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    let geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    geo.rotateY((f / N) * Math.PI * 2 + (f % 2) * 0.2);
    geo.translate(px, py, 0);
    parts.push(col(geo, f % 3 === 0 ? 0x4f7f34 : f % 3 === 1 ? 0x5e9140 : 0x46752e));
  }
  const crown = new THREE.SphereGeometry(0.16, 8, 6); crown.translate(px, py, 0);
  parts.push(col(crown, 0x6b5a3a));
  return mergeGeometries(parts.map((g) => { for (const k of Object.keys(g.attributes)) if (!["position", "normal", "color"].includes(k)) g.deleteAttribute(k); if (!g.attributes.normal) g.computeVertexNormals(); return g; }));
}

/* ---------------------------------------------------------------- build */
export function buildSite(scene, { towerFootprints }) {
  const site = new THREE.Group(); scene.add(site);
  const mats = {};
  const blockedRects = [];
  const isBlocked = (x, z, pad = 0) => blockedRects.some((b) => x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad);
  for (const f of towerFootprints) blockedRects.push(f);
  const mb = SITE.mainBuilding;
  for (const b of SITE.mainBlocks) blockedRects.push({ x0: mb.x + b.x - b.w / 2, x1: mb.x + b.x + b.w / 2, z0: mb.z + b.z - b.d / 2, z1: mb.z + b.z + b.d / 2 });
  for (const p of SITE.pools) blockedRects.push({ x0: p.x - p.w / 2 - 1.2, x1: p.x + p.w / 2 + 1.2, z0: p.z - p.d / 2 - 1.2, z1: p.z + p.d / 2 + 1.2 });
  for (const c of SITE.courts) blockedRects.push({ x0: c.x - c.w / 2 - 1, x1: c.x + c.w / 2 + 1, z0: c.z - c.d / 2 - 1, z1: c.z + c.d / 2 + 1 });

  /* ground */
  mats.ground = new THREE.MeshStandardMaterial({ map: paintGround(isBlocked), roughness: 0.96 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(GROUND.size, GROUND.size), mats.ground);
  ground.rotation.x = -Math.PI / 2; ground.position.set(GROUND.x0 + GROUND.size / 2, 0, GROUND.z0 + GROUND.size / 2);
  ground.receiveShadow = true; site.add(ground);
  // far sea and far land beyond the painted square
  mats.seaFar = new THREE.MeshStandardMaterial({ color: 0x16679a, roughness: 0.35 });
  const far = new THREE.Mesh(new THREE.PlaneGeometry(1600, 900), mats.seaFar);
  far.rotation.x = -Math.PI / 2; far.position.set(0, -0.02, GROUND.z0 + GROUND.size + 450 - 1); site.add(far);
  mats.landFar = new THREE.MeshStandardMaterial({ color: 0x2b9fc0, roughness: 0.5 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(1600, 700), mats.landFar);
  back.rotation.x = -Math.PI / 2; back.position.set(0, -0.02, GROUND.z0 - 350 + 1); site.add(back);
  // land and sea beyond the painted square, left and right
  for (const sx of [-1, 1]) {
    const xc = sx < 0 ? GROUND.x0 - 400 : GROUND.x0 + GROUND.size + 400;
    const land = new THREE.Mesh(new THREE.PlaneGeometry(800, SITE.shore - SITE.lagoon + 2), new THREE.MeshStandardMaterial({ color: 0x8db25a, roughness: 1 }));
    land.rotation.x = -Math.PI / 2; land.position.set(xc, -0.01, (SITE.shore + SITE.lagoon) / 2); land.receiveShadow = true; site.add(land);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(800, GROUND.z0 + GROUND.size - SITE.shore), mats.seaFar);
    sea.rotation.x = -Math.PI / 2; sea.position.set(xc, -0.01, (SITE.shore + GROUND.z0 + GROUND.size) / 2); site.add(sea);
    const lag = new THREE.Mesh(new THREE.PlaneGeometry(800, SITE.lagoon - GROUND.z0), mats.landFar);
    lag.rotation.x = -Math.PI / 2; lag.position.set(xc, -0.01, (SITE.lagoon + GROUND.z0) / 2); site.add(lag);
  }
  // glossy sea surface (sun glints) over the painted water
  mats.seaGloss = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.18, metalness: 0, transparent: true, opacity: 0.16, depthWrite: false });
  const gloss = new THREE.Mesh(new THREE.PlaneGeometry(GROUND.size + 1600, 900), mats.seaGloss);
  gloss.rotation.x = -Math.PI / 2; gloss.position.set(0, 0.012, SITE.shore + 450 + 3); site.add(gloss);

  /* pools */
  const waterTex = TX.poolWater();
  mats.pool = new THREE.MeshStandardMaterial({ map: waterTex, color: 0xffffff, roughness: 0.06, metalness: 0.0, emissive: 0x2fb6c8, emissiveIntensity: 0.08 });
  mats.coping = new THREE.MeshStandardMaterial({ color: 0xf7f1e7, roughness: 0.85 });
  const rr = (w, d, r) => {
    const s = new THREE.Shape(), x = -w / 2, y = -d / 2; r = Math.min(r, w / 2, d / 2);
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + d - r);
    s.quadraticCurveTo(x + w, y + d, x + w - r, y + d); s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
  };
  for (const p of SITE.pools) {
    const pg = new THREE.Group(); pg.position.set(p.x, 0, p.z); pg.rotation.y = p.rot || 0; site.add(pg);
    const outer = rr(p.w + 0.7, p.d + 0.7, 1.4); outer.holes.push(new THREE.Path(rr(p.w, p.d, 1.1).getPoints(24).reverse()));
    const cope = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: 0.1, bevelEnabled: false, curveSegments: 10 }), mats.coping);
    cope.rotation.x = -Math.PI / 2; cope.castShadow = cope.receiveShadow = true; pg.add(cope);
    const wg = new THREE.ShapeGeometry(rr(p.w, p.d, 1.1), 10);
    const uv = wg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 6, uv.getY(i) / 6);
    const water = new THREE.Mesh(wg, mats.pool);
    water.rotation.x = -Math.PI / 2; water.position.y = 0.06; water.receiveShadow = true; pg.add(water);
  }

  /* main building complex */
  const mf = TX.mainFacade();
  mats.mainA = new THREE.MeshStandardMaterial({ map: mf.map, emissiveMap: mf.glow, emissive: 0xffc27a, emissiveIntensity: 0, color: TX.PALETTE.apricot, roughness: 0.9 });
  mats.mainC = new THREE.MeshStandardMaterial({ map: mf.map, emissiveMap: mf.glow, emissive: 0xffc27a, emissiveIntensity: 0, color: TX.PALETTE.cream, roughness: 0.9 });
  mats.roof = new THREE.MeshStandardMaterial({ map: TX.paving(), color: 0xbab5ad, roughness: 0.95 });
  mats.roof.map.repeat.set(1, 1);
  mats.dome = new THREE.MeshStandardMaterial({ color: 0xf4ead9, roughness: 0.7 });
  const parTex = TX.parapet();
  const mainGroup = new THREE.Group(); mainGroup.position.set(mb.x, 0, mb.z); site.add(mainGroup);
  for (const b of SITE.mainBlocks) {
    const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
    const uv = geo.attributes.uv;
    const dims = [[b.d, b.h], [b.d, b.h], [b.w, b.d], [b.w, b.d], [b.w, b.h], [b.w, b.h]];
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(dims[f][0] / 3)), uv.getY(i) * Math.max(1, Math.round(dims[f][1] / 1.6))); }
    const wall = b.c === "cream" ? mats.mainC : mats.mainA;
    const m = new THREE.Mesh(geo, [wall, wall, mats.roof, mats.roof, wall, wall]);
    m.position.set(b.x, b.h / 2, b.z); m.castShadow = m.receiveShadow = true; mainGroup.add(m);
    // crenellated parapet on the roof edge
    for (const [px, pz, len, rot] of [[b.x, b.z + b.d / 2, b.w, 0], [b.x, b.z - b.d / 2, b.w, Math.PI], [b.x + b.w / 2, b.z, b.d, Math.PI / 2], [b.x - b.w / 2, b.z, b.d, -Math.PI / 2]]) {
      const tm = parTex.clone(); tm.wrapS = THREE.RepeatWrapping; tm.repeat.set(Math.max(1, Math.round(len * 1.2)), 1); tm.needsUpdate = true;
      const pm = new THREE.MeshStandardMaterial({ map: tm, color: 0xf6efe4, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 });
      const p = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.34), pm);
      p.position.set(px, b.h + 0.15, pz); p.rotation.y = rot; p.castShadow = true; mainGroup.add(p);
    }
    if (b.dome) {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(b.dome * 1.05, b.dome * 1.1, 0.7, 32), mats.mainC);
      drum.position.set(b.x, b.h + 0.35, b.z); drum.castShadow = true; mainGroup.add(drum);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(b.dome, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mats.dome);
      dome.position.set(b.x, b.h + 0.7, b.z); dome.castShadow = true; mainGroup.add(dome);
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 8), new THREE.MeshStandardMaterial({ color: 0xd4a85c, metalness: 0.6, roughness: 0.35 }));
      fin.position.set(b.x, b.h + 0.7 + b.dome + 0.25, b.z); mainGroup.add(fin);
    }
  }
  // gazebo / beach bar with conical roof, and shade pergolas
  mats.thatch = new THREE.MeshStandardMaterial({ color: 0x9a7a55, roughness: 1, flatShading: true });
  mats.wood = new THREE.MeshStandardMaterial({ color: 0x6d4f38, roughness: 0.9 });
  for (const gz of SITE.gazebos) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(gz.r, gz.r, 0.15, 24), mats.coping);
    base.position.set(gz.x, 0.075, gz.z); base.receiveShadow = true; site.add(base);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 6), mats.wood);
      post.position.set(gz.x + Math.cos(a) * gz.r * 0.85, 0.6, gz.z + Math.sin(a) * gz.r * 0.85); post.castShadow = true; site.add(post);
    }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(gz.r * 1.25, 1.0, 10), mats.thatch);
    roof.position.set(gz.x, 1.6, gz.z); roof.castShadow = true; site.add(roof);
  }

  /* palms, shrubs */
  const rand = rng(7);
  const palmSpots = [], shrubSpots = [];
  const add = (arr, x, z, pad = 0.8) => { if (!isBlocked(x, z, pad)) arr.push([x, z]); };
  for (let x = GROUND.x0 + 6; x < GROUND.x0 + GROUND.size - 6; x += 5) { add(palmSpots, x + rand(), SITE.road - 3.6); add(palmSpots, x + rand(), SITE.road + 3.6); }
  for (let x = -70; x < 100; x += 4.6) add(palmSpots, x + rand() * 1.5, SITE.beach - 3 - rand() * 2);
  for (const p of SITE.pools) {
    const per = 2 * (p.w + p.d), n = Math.round(per / 5);
    for (let i = 0; i < n; i++) {
      const t = i / n; let x, z;
      if (t < 0.25) { x = p.x - p.w / 2 - 2.2 + (p.w + 4.4) * (t / 0.25); z = p.z - p.d / 2 - 2.2; }
      else if (t < 0.5) { x = p.x + p.w / 2 + 2.2; z = p.z - p.d / 2 - 2.2 + (p.d + 4.4) * ((t - 0.25) / 0.25); }
      else if (t < 0.75) { x = p.x + p.w / 2 + 2.2 - (p.w + 4.4) * ((t - 0.5) / 0.25); z = p.z + p.d / 2 + 2.2; }
      else { x = p.x - p.w / 2 - 2.2; z = p.z + p.d / 2 + 2.2 - (p.d + 4.4) * ((t - 0.75) / 0.25); }
      if (rand() > 0.35) add(palmSpots, x, z, 0.2);
    }
  }
  for (let i = 0; i < 300; i++) {
    const x = GROUND.x0 + 8 + rand() * (GROUND.size - 16), z = SITE.road + 6 + rand() * (SITE.beach - SITE.road - 9);
    if (rand() > 0.55) add(palmSpots, x, z, 1.2); else add(shrubSpots, x, z, 0.6);
  }
  // shrub rings around tower plinths
  for (const f of towerFootprints) {
    for (let t = 0; t < 40; t++) {
      const side = t % 4, u = rand();
      const x = side < 2 ? f.x0 + (f.x1 - f.x0) * u : side === 2 ? f.x0 - 1.4 : f.x1 + 1.4;
      const z = side >= 2 ? f.z0 + (f.z1 - f.z0) * u : side === 0 ? f.z0 - 1.4 : f.z1 + 1.4;
      shrubSpots.push([x + (rand() - 0.5), z + (rand() - 0.5)]);
    }
  }
  mats.palm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
  const palms = new THREE.InstancedMesh(palmGeometry(), mats.palm, palmSpots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p3 = new THREE.Vector3(), s3 = new THREE.Vector3();
  palmSpots.forEach(([x, z], i) => {
    const k = 0.75 + rand() * 0.45; e.set((rand() - 0.5) * 0.12, rand() * Math.PI * 2, (rand() - 0.5) * 0.12); q.setFromEuler(e);
    m4.compose(p3.set(x, 0, z), q, s3.set(k, k, k)); palms.setMatrixAt(i, m4);
  });
  palms.castShadow = true; site.add(palms);

  mats.shrub = new THREE.MeshStandardMaterial({ color: 0x4f7d35, roughness: 0.95, flatShading: true });
  const shrubGeo = new THREE.IcosahedronGeometry(0.55, 1); shrubGeo.scale(1, 0.7, 1); shrubGeo.translate(0, 0.32, 0);
  const shrubs = new THREE.InstancedMesh(shrubGeo, mats.shrub, shrubSpots.length);
  const sc = new THREE.Color();
  shrubSpots.forEach(([x, z], i) => {
    const k = 0.55 + rand() * 0.7; q.setFromEuler(e.set(0, rand() * 6, 0));
    m4.compose(p3.set(x, 0, z), q, s3.set(k, k * (0.8 + rand() * 0.5), k)); shrubs.setMatrixAt(i, m4);
    shrubs.setColorAt(i, sc.setHSL(0.27 + rand() * 0.06, 0.42, 0.28 + rand() * 0.12));
  });
  shrubs.castShadow = true; shrubs.receiveShadow = true; site.add(shrubs);

  /* beach & pool-deck furniture: parasols with a pair of loungers */
  const spots = [];
  for (const row of SITE.parasolRows) for (let x = row.x0; x <= row.x1; x += row.step) spots.push([x + (rand() - 0.5) * 0.3, row.z]);
  for (const p of SITE.pools) if (p.w > 7) for (let x = p.x - p.w / 2 + 1; x <= p.x + p.w / 2 - 1; x += 2.6) spots.push([x, p.z + p.d / 2 + 1.5]);
  mats.canvas = new THREE.MeshStandardMaterial({ color: 0xfbf8f2, roughness: 0.8, side: THREE.DoubleSide });
  mats.pole = new THREE.MeshStandardMaterial({ color: 0x8a6d50, roughness: 0.8 });
  mats.lounger = new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.7 });
  const canopyGeo = new THREE.ConeGeometry(0.85, 0.32, 8, 1, true); canopyGeo.translate(0, 1.12, 0);
  const poleGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.2, 5); poleGeo.translate(0, 0.6, 0);
  const loungerGeo = mergeGeometries([
    (() => { const g = new THREE.BoxGeometry(0.34, 0.06, 0.78); g.translate(0, 0.13, 0.05); return g; })(),
    (() => { const g = new THREE.BoxGeometry(0.34, 0.06, 0.36); g.rotateX(-0.75); g.translate(0, 0.25, -0.42); return g; })(),
  ]);
  const can = new THREE.InstancedMesh(canopyGeo, mats.canvas, spots.length);
  const pol = new THREE.InstancedMesh(poleGeo, mats.pole, spots.length);
  const lou = new THREE.InstancedMesh(loungerGeo, mats.lounger, spots.length * 2);
  spots.forEach(([x, z], i) => {
    q.setFromEuler(e.set(0, rand() * 0.6, 0));
    m4.compose(p3.set(x, 0, z), q, s3.set(1, 1, 1)); can.setMatrixAt(i, m4); pol.setMatrixAt(i, m4);
    q.setFromEuler(e.set(0, Math.PI, 0));
    m4.compose(p3.set(x - 0.32, 0, z + 0.15), q, s3.set(1, 1, 1)); lou.setMatrixAt(i * 2, m4);
    m4.compose(p3.set(x + 0.32, 0, z + 0.15), q, s3.set(1, 1, 1)); lou.setMatrixAt(i * 2 + 1, m4);
  });
  for (const m of [can, pol, lou]) { m.castShadow = true; m.receiveShadow = true; site.add(m); }

  return { group: site, mats };
}
