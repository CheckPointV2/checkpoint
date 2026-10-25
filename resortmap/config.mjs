/* ============================================================
   Resort Map — layout settings.
   Units: 1 = one room cell from Room Guide's floor grids (≈ 4 m).
   The sea is toward +z (bottom of the default view).
   ============================================================ */

// Tower placement. rotation (degrees) turns each tower about its lift core.
// 180° is derived from the room data: in all three towers the rooms coded
// Beach View / Pool View sit on grid-north faces and Road View on south/east,
// so grid-north has to face the sea.
export const BUILDINGS = {
  amwaj:   { x: -22, z: -16, rotation: 180 },
  zumroud: { x:  14, z: -21, rotation: 180 },
  marmar:  { x: -13, z:  19, rotation: 180 },
};

export const SITE = {
  road: -40,              // z of the access road behind the towers
  lagoon: -50,            // water begins north of this
  roundabout: { x: -74, z: -40, r: 5 },
  beach: 34,              // z where the sand begins
  shore: 50,              // average shoreline

  mainBuilding: { x: 41, z: -14 },
  mainBlocks: [           // relative to mainBuilding
    { x: 0,   z: -9, w: 18, d: 10, h: 3.2, c: "cream", dome: 3.0 },
    { x: 13,  z: 2,  w: 8,  d: 22, h: 2.6, c: "apricot" },
    { x: -5,  z: 7,  w: 12, d: 7,  h: 2.0, c: "apricot" },
    { x: 5,   z: 14, w: 10, d: 7,  h: 1.8, c: "cream" },
    { x: -13, z: -1, w: 6,  d: 8,  h: 2.0, c: "apricot" },
  ],

  pools: [
    { name: "Upper Main Pool",  x: 25, z: -3, w: 9,  d: 5 },
    { name: "Middle Main Pool", x: 18, z: 5,  w: 10, d: 5.5 },
    { name: "Lower Main Pool",  x: 9,  z: 14, w: 13, d: 6 },
    { name: "Kids' Pool",       x: -1, z: 23.5, w: 6,  d: 3.6 },
    { name: "Infinity Pool",    x: 24, z: 27.5, w: 20, d: 4 },
    { name: "Main Building Pool", x: 44, z: 11, w: 13, d: 4.6 },
  ],
  plazas: [
    { x: 17, z: 8, w: 32, d: 30, r: 7 },
    { x: 41, z: 8, w: 34, d: 17, r: 5 },
    { x: 35, z: -31, w: 18, d: 8, r: 3 },
  ],
  paths: [
    { pts: [[-12, -5], [-3, 1], [4, 5]] },
    { pts: [[-14, 28], [-10, 31], [-5, 34]] },
    { pts: [[-22, -27], [-21, -35], [-24, -40]] },
    { pts: [[-90, 32.5], [-20, 32], [40, 33], [110, 32]], w: 1.7 },
    { pts: [[-5, 14], [1, 12], [3, 9]] },
    { pts: [[24, -21], [29, -24], [32, -25]] },
    { pts: [[14, -9], [16, -5], [19, -3]] },
    { pts: [[-36, -10], [-44, -2], [-48, 12], [-46, 24], [-40, 32]] },
  ],
  courts: [
    { kind: "tennis",     x: -36, z: 26, w: 5.5, d: 10, color: "#4b78b8", surround: "#3f8a63" },
    { kind: "basketball", x: -28.5, z: 26, w: 5,   d: 8.5, color: "#3f6db2", surround: "#c0563f" },
  ],
  gazebos: [
    { x: 8,  z: 24, r: 2.0 },
    { x: 58, z: 29, r: 1.8 },
  ],
  parasolRows: [
    { x0: -26, x1: 6, step: 3.2, z: 38 },
    { x0: 16, x1: 72, step: 3.2, z: 38 },
    { x0: 16, x1: 72, step: 3.2, z: 41.6 },
  ],
  labels: [
    { text: "Lobby & Restaurants", x: 41, y: 7.5, z: -23 },
    { text: "Main Pools", x: 17, y: 1.4, z: 6 },
    { text: "Infinity Pool", x: 24, y: 1.2, z: 27.5 },
    { text: "Beach", x: 10, y: 0.8, z: 42 },
  ],
};

// How a room's view is decided when it has several view codes.
export const VIEW_ORDER = ["BEA", "COS", "POO", "GAR", "MAN", "ROA", "CAV"];

export const VIEWS = {
  BEA: { label: "Beach View",          short: "Beach",    color: 0x22b3c2 },
  COS: { label: "Corniche Sea View",   short: "Sea",      color: 0x2c6fbf },
  POO: { label: "Pool View",           short: "Pool",     color: 0x5fd0e2 },
  GAR: { label: "Garden View",         short: "Garden",   color: 0x6aa553 },
  MAN: { label: "Main Entrance View",  short: "Entrance", color: 0xc49566 },
  ROA: { label: "Road View",           short: "Road",     color: 0x9b928a },
  CAV: { label: "Car Park View",       short: "Car park", color: 0x9b928a },
  NONE:{ label: "Inner / no view code",short: "Other",    color: 0xe9dcc6 },
};

// Room categories, grouped from Room Guide's type codes.
export const CATEGORIES = {
  deluxe:  { label: "Deluxe",        types: ["KGA", "KGAOV", "TWA", "TWAOV"], color: 0xead6ad },
  premium: { label: "Premium",       types: ["KGE", "KGEOV"],                 color: 0xc47c4a },
  family:  { label: "Family & Kids", types: ["SKB", "SKC", "SKA"],            color: 0x47a39c },
  suite:   { label: "Suites",        types: ["SKD", "SKP", "SXA"],            color: 0xc9a032 },
};

// Feature codes worth showing on the room card.
export const FEATURES = {
  BAL: "Balcony", S: "Small balcony", NBA: "No balcony", TER: "Terrace", COR: "Corner room",
  KTC: "Kitchenette", HCA: "Accessible", INT: "Interconnecting", SOF: "Sofa bed",
  "1EXBED": "1 extra bed", "2EXBED": "2 extra beds", SA: "No extra bed space", BBE: "Bunk bed",
  KGB: "King bed", TWB: "Twin beds",
};
