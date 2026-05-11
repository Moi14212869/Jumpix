// =========================================================
//                     GLOBALS & CONSTANTS
// =========================================================
// Les valeurs sont initialisées à leurs défauts, puis
// écrasées par loadPlayerData() dans LoadingScene.
// =========================================================

export let gameVolume    = 0.5;
export let keyboardLayout = "zqsd";
export let playerCoins   = 0;
export let dead          = 0;
export let kill          = 0;
export let party         = 0;
export let colorPlayer      = 0xAA66CC;
export let completedLevels  = {}; // { Level1: true, Level2: true, … }
export let bestTimes        = {}; // { Level1: 4230, Level2: 7100, … }  (ms)
export let bestRanks        = {}; // { Level1: 3, Level2: 1, … }  (meilleur rang atteint)

export const DEV_PASSWORD_HASH =
  "9651d08ab7a975b70a93f3c918842c44cda8f335ecbbaae88d5610d3a1790b4b";

export const SHOP_PAGES = [
  [
    { key: "AA66CC", label: "Purple",      price: 0   },
    { key: "73BE73", label: "Green",       price: 50  },
    { key: "CC99A2", label: "Pink",        price: 100 },
    { key: "40E0D0", label: "Turquoise",   price: 150 },
    { key: "FFA500", label: "Orange",      price: 200 }
  ],
  [
    { key: "7A0000", label: "Maroon",      price: 250 },
    { key: "0B228A", label: "Dark Blue",   price: 300 },
    { key: "226546", label: "Dark Green",  price: 350 },
    { key: "E2FF00", label: "Yellow",      price: 400 },
    { key: "FFEADD", label: "Inna Beige",  price: 450 }
  ],
  [
    { key: "480437", label: "Eggplant",     price: 500 },
    { key: "E9C4F4", label: "Mauve",        price: 600 },
    { key: "A0A45B", label: "Olive Green",  price: 700 },
    { key: "2AF42D", label: "Light Green",  price: 800 },
    { key: "A5985A", label: "Antique gold", price: 900 }
  ]
];

// ── Setters ───────────────────────────────────────────────
export function setGameVolume(v)     { gameVolume     = v; }
export function setKeyboardLayout(v) { keyboardLayout = v; }
export function setPlayerCoins(v)    { playerCoins    = v; }
export function setDead(v)           { dead           = v; }
export function setKill(v)           { kill           = v; }
export function setParty(v)          { party          = v; }
export function setColorPlayer(v)      { colorPlayer      = v; }
export function setCompletedLevels(v) {
  // Vider puis recopier pour garder la même référence objet
  Object.keys(completedLevels).forEach(k => delete completedLevels[k]);
  Object.assign(completedLevels, v);
}
export function markLevelCompleted(key) { completedLevels[key] = true; }

export function setBestTimes(v) {
  Object.keys(bestTimes).forEach(k => delete bestTimes[k]);
  Object.assign(bestTimes, v);
}
export function updateBestTime(key, ms) { bestTimes[key] = ms; }

export function setBestRanks(v) {
  Object.keys(bestRanks).forEach(k => delete bestRanks[k]);
  Object.assign(bestRanks, v);
}
export function updateBestRank(key, rank) {
  if (bestRanks[key] === undefined || rank < bestRanks[key]) {
    bestRanks[key] = rank;
  }
}

// ── Charge toutes les variables depuis un objet playerData ─
export function applyPlayerData(data) {
  setGameVolume(data.gameVolume         ?? 0.5);
  setKeyboardLayout(data.keyboardLayout ?? "zqsd");
  setPlayerCoins(data.playerCoins       ?? 0);
  setDead(data.dead                     ?? 0);
  setKill(data.kill                     ?? 0);
  setParty(data.party                   ?? 0);
  setColorPlayer(data.colorPlayer       ?? 0xAA66CC);
  setCompletedLevels(data.completedLevels ?? {});
  setBestTimes(data.bestTimes           ?? {});
  setBestRanks(data.bestRanks           ?? {});
}
