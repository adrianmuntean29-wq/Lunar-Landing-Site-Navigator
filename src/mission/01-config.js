/* Mission view, runs inside __boot() and shares its scope with the other files here (see tools/build_js.py): CONFIG:
   constants, launch sites, landing sites, mission profiles, scoring. Edit freely. */

/* =====================================================================
   CONFIG — edit these freely
   ===================================================================== */
var C = { muE: 398600.4418, RE: 6378.137, muM: 4902.800, RM: 1737.4, dEM: 384400, wE: 7.2921159e-5,
          g0: 0.00980665, sunR: 0.267, siderealMonth: 27.321661, launchLosses: 1.5 };
var MODEL = { moonDecAmp: 28.4, year: 365, tableDays: 560 };
var LAUNCH_SITES = [
  {id: 'ns', name: 'Spaceport Nova Scotia (Canada)', lat: 45.35, lon: -61.02},
  {id: 'ksc', name: 'Kennedy LC-39B (USA)', lat: 28.63, lon: -80.62},
  {id: 'csg', name: 'Kourou (French Guiana)', lat: 5.24, lon: -52.77}
];
/* kind → assumed local horizon in degrees (negative = you see below the flat horizon from a high point) */
var SITES = [
  {id: 'moutonPl', g: 'Past landing', name: 'Mons Mouton Plateau', lat: -84.7906, lon: 29.1957, kind: 'plateau', horizon: 0.0, ref: 'IM-2 Athena landing point (6 Mar 2025)'},
  {id: 'im1', g: 'CLPS / commercial', name: 'IM-1 Odysseus', lat: -80.13, lon: 1.44, kind: 'landing site', horizon: 0.5, ref: 'Landed 22 Feb 2024 (LRO)'},
  {id: 'bg1', g: 'CLPS / commercial', name: 'Blue Ghost M1', lat: 18.5623, lon: 61.8103, kind: 'landing site', horizon: 0.0, ref: 'Mare Crisium, landed 2 Mar 2025'},
  {id: 'ch3', g: 'Other countries', name: 'Chandrayaan-3 (India)', lat: -69.3741, lon: 32.32, kind: 'landing site', horizon: 0.5, ref: 'Vikram lander, 23 Aug 2023'},
  {id: 'ce4', g: 'Other countries', name: "Chang'e 4 (China)", lat: -45.4561, lon: 177.5885, kind: 'landing site', horizon: 0.5, ref: 'Far side, von Kármán crater, 2019 (no direct Earth view)'},
  {id: 'ce6', g: 'Other countries', name: "Chang'e 6 (China)", lat: -41.6385, lon: -153.9852, kind: 'landing site', horizon: 0.5, ref: 'Far side, Apollo basin, 2024'},
  {id: 'slim', g: 'Other countries', name: 'SLIM (Japan)', lat: -13.3160, lon: 25.2510, kind: 'landing site', horizon: 0.5, ref: 'Near Shioli crater, 2024'},
  {id: 'a11', g: 'Apollo', name: 'Apollo 11', lat: 0.67416, lon: 23.47314, kind: 'landing site', horizon: 0.0, ref: 'Mare Tranquillitatis, 1969'},
  {id: 'a15', g: 'Apollo', name: 'Apollo 15', lat: 26.13239, lon: 3.63330, kind: 'landing site', horizon: 1.0, ref: 'Hadley–Apennine, 1971'},
  {id: 'a17', g: 'Apollo', name: 'Apollo 17', lat: 20.1911, lon: 30.7723, kind: 'landing site', horizon: 1.0, ref: 'Taurus–Littrow valley, 1972'}
];
/* the four published sites with LOLA horizon masks from the team's engine (data/sites.json, ids A-D) */
SITES.unshift(
  {id: 'C1', eng: 'A', g: 'Published site', name: 'Connecting Ridge (C1)', lat: -89.4505, lon: -137.16, kind: 'ridge', horizon: 0, ref: 'Gläser et al. 2018, site C1'},
  {id: 'S', eng: 'B', g: 'Published site', name: 'Shackleton rim (S)', lat: -89.7849, lon: -156.03, kind: 'rim', horizon: 0, ref: 'Gläser et al. 2018, site S'},
  {id: 'MP1', eng: 'D', g: 'Published site', name: 'Malapert massif (MP1)', lat: -85.9756, lon: -2.1124, kind: 'massif', horizon: 0, ref: 'De Rosa et al. 2012, MP1'},
  {id: 'GR1', eng: 'C', g: 'Published site', name: 'de Gerlache rim (GR1)', lat: -88.6952, lon: -68.2846, kind: 'rim', horizon: 0, ref: 'De Rosa et al. 2012, GR1'}
);
var DEFAULT_PICKS = {
  crewed: ['C1', 'S', 'MP1', 'GR1'],
  robotic: ['C1', 'S', 'MP1', 'GR1']
};
var PROFILES = {
  crewed: {
    label: 'Crewed', tof: 3.5, stay: 6.0, stayMin: 2, stayMax: 14, stayLabel: 'Surface stay',
    parkingAlt: 185, lloAlt: 100, lloBefore: 1.0, lloAfter: 0.5,
    midcourse: 0.03, descentLoss: 0.25, hover: 0.10, ascentLoss: 0.15, rendezvous: 0.05, reserve: 0.10,
    mass: {capsule: 9.5, cabin: 5.0, cargo: 1.0},
    eng: {tli: {isp: 450, k: 0.12}, sm: {isp: 316, k: 0.25}, desc: {isp: 345, k: 0.20}, asc: {isp: 320, k: 0.25}}
  },
  robotic: {
    label: 'Robotic', tof: 5.0, stay: 13, stayMin: 1, stayMax: 60, stayLabel: 'Surface mission',
    parkingAlt: 185, lloAlt: 100, lloBefore: 1.5,
    midcourse: 0.03, descentLoss: 0.25, hover: 0.04, reserve: 0.05,
    mass: {rover: 0.5},
    eng: {tli: {isp: 450, k: 0.12}, lander: {isp: 320, k: 0.35}}
  }
};
/* Score weights (0–100). Crewed: landing windows per year, Earth in view during the stay, Sun over the year.
   Robotic: Sun over the year, Earth over the year, shortest worst night. */
var SCORE = {
  crewed: {windows: 40, earthStay: 40, sunYear: 20, windowsFull: 12},
  robotic: {sunYear: 50, earthYear: 30, night: 20, nightFull: 14}
};

