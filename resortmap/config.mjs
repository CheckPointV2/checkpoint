/* ============================================================
   Resort Map — layout settings
   Everything here is a best guess until confirmed on site.
   Units: 1 = one room cell from Room Guide's floor grids.
   ============================================================ */

// Where each tower stands on the site and how it is turned.
// Positions follow the official resort map: Amwaj top-left, Zumroud
// to its right beside the lobby, Marmar below Amwaj toward the sea.
// rotation is in degrees around the vertical axis. If a wing points
// the wrong way, change only the rotation here.
export const BUILDINGS = {
  amwaj:   { x: -17, z: -12, rotation: 0 },
  zumroud: { x:  15, z: -15, rotation: 0 },
  marmar:  { x: -13, z:  19, rotation: 0 },
};

// Floor-to-floor height and room block size, in cell units.
export const FLOOR_H = 1.0;
export const ROOM_SIZE = 0.92;
export const ROOM_H = 0.82;

// Which way is the sea: +z (toward the bottom of the default view).
export const SITE = {
  beachStart: 40,          // z where the sand begins
  seaStart: 54,            // z where the water begins
  road: -40,               // z of the access road behind the towers
  mainBuilding: { x: 44, z: -6, w: 24, d: 16, h: 2.4 },
  pools: [
    { name: "Upper Main Pool",  x: 24, z:  5,  w: 9,  d: 5 },
    { name: "Middle Main Pool", x: 19, z: 12,  w: 10, d: 5 },
    { name: "Lower Main Pool",  x: 13, z: 19,  w: 11, d: 6 },
    { name: "Kids' Pool",       x:  4, z: 28,  w: 5,  d: 4 },
    { name: "Infinity Pool",    x: 16, z: 34,  w: 16, d: 4 },
  ],
  courts: [
    { name: "Tennis",     x: -30, z: 33, w: 5, d: 9, color: 0x7e9a74 },
    { name: "Basketball", x: -23, z: 33, w: 5, d: 8, color: 0xb98a63 },
  ],
  labels: [
    { text: "Lobby & Main Building", x: 44, y: 5.6, z: -6 },
    { text: "Main Pools", x: 19, y: 1.2, z: 12 },
    { text: "Beach", x: 0, y: 0.6, z: 46 },
  ],
};

// How a room's view is decided when it has several view codes.
export const VIEW_ORDER = ["BEA", "COS", "POO", "GAR", "MAN", "ROA", "CAV"];

export const VIEWS = {
  BEA: { label: "Beach View",          short: "Beach",   color: 0x2bb3c0 },
  COS: { label: "Corniche Sea View",   short: "Sea",     color: 0x1f6fa8 },
  POO: { label: "Pool View",           short: "Pool",    color: 0x58c9d9 },
  GAR: { label: "Garden View",         short: "Garden",  color: 0x6f9e5a },
  MAN: { label: "Main Entrance View",  short: "Entrance",color: 0xb39b7a },
  ROA: { label: "Road View",           short: "Road",    color: 0x9a8f84 },
  CAV: { label: "Car Park View",       short: "Car park",color: 0x9a8f84 },
  NONE:{ label: "Inner / no view code",short: "Other",   color: 0xd9ccb6 },
};

// Room categories, grouped from Room Guide's type codes.
export const CATEGORIES = {
  deluxe:  { label: "Deluxe",          types: ["KGA", "KGAOV", "TWA", "TWAOV"], color: 0xe6d6ba },
  premium: { label: "Premium",         types: ["KGE", "KGEOV"],                 color: 0xc08b55 },
  family:  { label: "Family & Kids",   types: ["SKB", "SKC", "SKA"],            color: 0x4fa3a0 },
  suite:   { label: "Suites",          types: ["SKD", "SKP", "SXA"],            color: 0xc9a24b },
};

// Feature codes worth showing on the room card.
export const FEATURES = {
  BAL: "Balcony", S: "Small balcony", NBA: "No balcony", TER: "Terrace", COR: "Corner room",
  KTC: "Kitchenette", HCA: "Accessible", INT: "Interconnecting", SOF: "Sofa bed",
  "1EXBED": "1 extra bed", "2EXBED": "2 extra beds", SA: "No extra bed space", BBE: "Bunk bed",
  KGB: "King bed", TWB: "Twin beds",
};
