// Tuning and palette for Coral Bay Heat. The view is a fixed 1280x720 logical
// area scaled to the window; the world is bigger than the view and the camera
// moves through it, so no rule below depends on screen size.

export const VIEW = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second at any refresh rate. */
export const STEP = 1 / 60;

export const WORLD = { width: 3840, height: 2880, shore: 170 };

/** Roads run on a regular grid: centres every SPACING px, ROAD_W wide overall. */
export const ROAD = { width: 104, spacing: 512, first: 466, lane: 26 };

/** Sidewalk band around each block, inside the road edge. */
export const SIDEWALK = 26;

export const PLAYER = {
  radius: 13,
  walkSpeed: 178,
  sprintSpeed: 272,
  turnRate: 14,
  maxHealth: 100,
  punchRange: 50,
  punchArc: 1.15,
  punchCooldown: 0.34,
  punchDamage: 34,
};

export const CAR = {
  length: 46,
  width: 23,
  radius: 25,
  maxHealth: 100,
};

/** Driving feel per kind: top speed (px/s), acceleration, grip. */
export const CAR_KINDS = {
  compact: { topSpeed: 430, reverse: 150, accel: 300, brake: 620, grip: 3.4, value: 90 },
  sedan: { topSpeed: 480, reverse: 160, accel: 320, brake: 660, grip: 3.2, value: 130 },
  sport: { topSpeed: 640, reverse: 190, accel: 460, brake: 760, grip: 3.9, value: 260 },
  van: { topSpeed: 390, reverse: 140, accel: 240, brake: 560, grip: 2.7, value: 170 },
  police: { topSpeed: 560, reverse: 180, accel: 420, brake: 720, grip: 3.6, value: 0 },
};

export const TRAFFIC = { cars: 12, speed: 250, gap: 92 };

export const PEDS = { count: 26, walkSpeed: 74, runSpeed: 196 };

/** Heat points per crime, and the heat at which each wanted star lights. */
export const HEAT = {
  stealCar: 30,
  hitPed: 35,
  punchPed: 15,
  hitPolice: 25,
  hitCar: 8,
  witnessRadius: 280,
  starThresholds: [0, 15, 40, 70, 110, 160],
  decayPerSecond: 3.2,
  calmSeconds: 7,
};

export const POLICE = {
  maxCars: 6,
  spawnNear: 820,
  despawnFar: 1500,
  bustRadius: 64,
  bustSeconds: 2.2,
  sightRadius: 520,
};

export const PALETTE = {
  water: '#2d9db4',
  waterDeep: '#23849c',
  sand: '#ecd9a4',
  cityGround: '#d9d2bf',
  grass: '#8fce6e',
  parkPath: '#e6d9ae',
  road: '#46484e',
  roadEdge: '#f4efe2',
  laneDash: '#e8c95a',
  sidewalk: '#c9c0aa',
  crosswalk: '#e9e6da',
  shadow: 'rgba(60, 45, 30, 0.25)',
  palmTrunk: '#8a6b45',
  palmLeaf: '#3f9e4d',
  text: '#fdfdf8',
  textDark: '#22303a',
  panel: 'rgba(18, 26, 34, 0.88)',
  accent: '#ffb52e',
  danger: '#ff5147',
  cash: '#7ddc6a',
  policeBlue: '#274bdb',
  policeRed: '#ff3b30',
};

/** Building paint: pastel walls for a sun-soaked city; the roof is derived. */
export const BUILDING_COLORS = [
  '#f6c177', '#f28b82', '#a8d8a8', '#8ecae6', '#fdf0c0', '#e0aaff',
  '#ffb4a2', '#b5e48c', '#ffc8dd', '#a2d2ff', '#f4e1a0', '#cdb4db',
];

export const CAR_COLORS = [
  '#e63946', '#f4f1de', '#3d405b', '#81b29a', '#f2cc8f', '#6d8ea0',
  '#e07a5f', '#9b5de5', '#00b4d8', '#ef476f', '#ffd166', '#06d6a0',
];

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** localStorage key for the save (cash, story progress, totals). */
export const SAVE_KEY = 'coral-bay-heat.save';
