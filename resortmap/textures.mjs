/* ============================================================
   Resort Map — painted textures (canvas, generated at load).
   Palette follows the resort's own art: apricot & cream stucco,
   white crenellated parapets, dark paired windows, mint crown.
   ============================================================ */
import * as THREE from "./vendor/three.module.min.js";

export const PALETTE = {
  apricot: 0xe6ab7c,
  cream: 0xf1e7d8,
  terrace: 0xb9b4ad,
  parapet: 0xf6efe4,
  mint: 0xc6e6da,
  coral: 0xe5948b,
  pergola: 0x5e4433,
  glass: "#2a2420",
};

function canvas(w, h) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  return [c, c.getContext("2d")];
}
function tex(c, { repeat = false, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function speckle(g, w, h, n, alpha, seed = 1) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    g.fillStyle = r() > 0.5 ? `rgba(0,0,0,${alpha * r()})` : `rgba(255,255,255,${alpha * r()})`;
    g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
  }
}
function windowPair(g, x, y, w, h, frame = "#f8f3ea") {
  // white surround, two dark panes, slim mullion, soft top shadow
  g.fillStyle = frame; g.fillRect(x - 3, y - 3, w + 6, h + 6);
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, "#1d1916"); gr.addColorStop(1, "#3a312b");
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.fillStyle = frame; g.fillRect(x + w / 2 - 1.5, y, 3, h); g.fillRect(x, y + h * 0.3, w, 2.5);
  g.fillStyle = "rgba(255,255,255,.10)"; g.fillRect(x + 2, y + 2, w * 0.18, h - 4);
  g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(x, y, w, 4);
}

/* Room front (loggia back wall): balcony door + window pair, neutral so instance colour sets the stucco. */
export function roomFront() {
  const W = 256, H = 236;
  const [c, g] = canvas(W, H);
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H);
  speckle(g, W, H, 900, 0.05, 3);
  // shadow under the slab above (loggia ceiling)
  const sh = g.createLinearGradient(0, 0, 0, 46);
  sh.addColorStop(0, "rgba(60,40,25,.38)"); sh.addColorStop(1, "rgba(60,40,25,0)");
  g.fillStyle = sh; g.fillRect(0, 0, W, 46);
  windowPair(g, 34, 62, 70, 150);     // balcony door
  windowPair(g, 150, 62, 70, 92);     // window
  // glow mask for night
  const [m, mg] = canvas(W, H);
  mg.fillStyle = "#000"; mg.fillRect(0, 0, W, H);
  const gl = mg.createLinearGradient(0, 62, 0, 212);
  gl.addColorStop(0, "#ffcf8f"); gl.addColorStop(1, "#ffb46a");
  mg.fillStyle = gl; mg.fillRect(36, 64, 66, 146); mg.fillRect(152, 64, 66, 88);
  return { map: tex(c), glow: tex(m) };
}

/* Room side (exposed wing end): one window pair. */
export function roomSide() {
  const W = 256, H = 236;
  const [c, g] = canvas(W, H);
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H);
  speckle(g, W, H, 900, 0.05, 5);
  windowPair(g, 92, 70, 72, 100);
  const [m, mg] = canvas(W, H);
  mg.fillStyle = "#000"; mg.fillRect(0, 0, W, H);
  mg.fillStyle = "#ffc27a"; mg.fillRect(94, 72, 68, 96);
  return { map: tex(c), glow: tex(m) };
}

/* Plain stucco (hidden faces, podium sides). */
export function stucco() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, 128, 128);
  speckle(g, 128, 128, 500, 0.05, 9);
  return tex(c, { repeat: true });
}

/* Podium / ground arcade: arched openings. */
export function arcade() {
  const W = 256, H = 256;
  const [c, g] = canvas(W, H);
  g.fillStyle = "#f3e6d3"; g.fillRect(0, 0, W, H);
  speckle(g, W, H, 700, 0.05, 11);
  g.fillStyle = "#3a2f28";
  g.beginPath(); g.moveTo(58, H); g.lineTo(58, 120); g.arc(128, 120, 70, Math.PI, 0); g.lineTo(198, H); g.closePath(); g.fill();
  g.strokeStyle = "#fbf6ee"; g.lineWidth = 8;
  g.beginPath(); g.moveTo(58, H); g.lineTo(58, 120); g.arc(128, 120, 70, Math.PI, 0); g.lineTo(198, H); g.stroke();
  return tex(c);
}

/* Parapet: solid white wall with crenellated top (alpha). */
export function parapet() {
  const W = 256, H = 64;
  const [c, g] = canvas(W, H);
  g.clearRect(0, 0, W, H);
  g.fillStyle = "#ffffff"; g.fillRect(0, 22, W, H - 22);
  const n = 6, step = W / n;
  for (let i = 0; i < n; i++) g.fillRect(i * step + step * 0.18, 4, step * 0.64, 22);
  g.fillStyle = "rgba(0,0,0,.08)"; g.fillRect(0, H - 6, W, 6);
  // thin coral accent line
  g.fillStyle = "rgba(229,148,139,.75)"; g.fillRect(0, 40, W, 3);
  const t = tex(c);
  return t;
}

/* Pergola slats (alpha). */
export function pergola() {
  const [c, g] = canvas(256, 64);
  g.clearRect(0, 0, 256, 64);
  g.fillStyle = "#ffffff";
  for (let x = 4; x < 256; x += 22) g.fillRect(x, 0, 9, 64);
  g.fillRect(0, 0, 256, 7); g.fillRect(0, 57, 256, 7);
  return tex(c);
}

/* Terrace / roof paving. */
export function paving() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, 128, 128);
  speckle(g, 128, 128, 400, 0.06, 13);
  g.strokeStyle = "rgba(0,0,0,.09)"; g.lineWidth = 1.5;
  for (let i = 0; i <= 128; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); }
  return tex(c, { repeat: true });
}

/* Core / crown wall: mint with a band of coral slots near the top. */
export function crownWall() {
  const W = 512, H = 256;
  const [c, g] = canvas(W, H);
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H);
  speckle(g, W, H, 1400, 0.04, 17);
  g.fillStyle = "#e5948b";
  for (let x = 14; x < W; x += 40) g.fillRect(x, 40, 14, 34);
  g.fillStyle = "rgba(0,0,0,.06)"; g.fillRect(0, 96, W, 3);
  for (let x = 30; x < W; x += 80) windowPair(g, x, 140, 22, 70, "#f4f8f6");
  return tex(c, { repeat: true });
}
export function coreWall() {
  const W = 128, H = 128;
  const [c, g] = canvas(W, H);
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H);
  speckle(g, W, H, 400, 0.04, 19);
  windowPair(g, 54, 34, 20, 66, "#f4f8f6");
  return tex(c, { repeat: true });
}

/* Main building facade: arched windows in a row. */
export function mainFacade() {
  const W = 256, H = 128;
  const [c, g] = canvas(W, H);
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H);
  speckle(g, W, H, 600, 0.05, 23);
  for (let x = 16; x < W; x += 60) {
    g.fillStyle = "#f8f3ea";
    g.beginPath(); g.moveTo(x - 3, 110); g.lineTo(x - 3, 52); g.arc(x + 15, 52, 18, Math.PI, 0); g.lineTo(x + 33, 110); g.fill();
    g.fillStyle = "#2c2521";
    g.beginPath(); g.moveTo(x, 108); g.lineTo(x, 52); g.arc(x + 15, 52, 15, Math.PI, 0); g.lineTo(x + 30, 108); g.fill();
  }
  const [m, mg] = canvas(W, H);
  mg.fillStyle = "#000"; mg.fillRect(0, 0, W, H);
  mg.fillStyle = "#ffbf75";
  for (let x = 16; x < W; x += 60) { mg.beginPath(); mg.moveTo(x, 108); mg.lineTo(x, 52); mg.arc(x + 15, 52, 15, Math.PI, 0); mg.lineTo(x + 30, 108); mg.fill(); }
  const a = tex(c, { repeat: true }), b = tex(m, { repeat: true });
  return { map: a, glow: b };
}

/* Pool water: bright centre, darker edges, faint tile grid and caustic noise. */
export function poolWater() {
  const S = 256;
  const [c, g] = canvas(S, S);
  g.fillStyle = "#44c7d6"; g.fillRect(0, 0, S, S);
  let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 260; i++) {
    const x = r() * S, y = r() * S, rad = 6 + r() * 20;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, "rgba(190,250,255,.22)"); gr.addColorStop(1, "rgba(190,250,255,0)");
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  g.strokeStyle = "rgba(255,255,255,.08)"; g.lineWidth = 1;
  for (let i = 0; i <= S; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, S); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(S, i); g.stroke(); }
  return tex(c, { repeat: true });
}

/* Parasol canopy: white with soft segment lines. */
export function radialSoft(color = "#ffffff") {
  const [c, g] = canvas(64, 64);
  g.fillStyle = color; g.fillRect(0, 0, 64, 64);
  return tex(c);
}
