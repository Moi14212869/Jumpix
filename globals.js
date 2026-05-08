// =========================================================
//                     GLOBALS & CONSTANTS
// =========================================================

export let gameVolume = parseFloat(localStorage.getItem("gameVolume"));
export let keyboardLayout = localStorage.getItem("keyboardLayout") || "zqsd";
if (isNaN(gameVolume)) gameVolume = 0.5;

export let playerCoins = parseInt(localStorage.getItem("playerCoins")) || 0;
export let dead        = parseInt(localStorage.getItem("dead"))         || 0;
export let kill        = parseInt(localStorage.getItem("kill"))         || 0;
export let party       = parseInt(localStorage.getItem("party"))        || 0;
export let colorPlayer = parseInt(localStorage.getItem("colorPlayer"))  || 0xAA66CC;

export const DEV_PASSWORD_HASH =
  "9651d08ab7a975b70a93f3c918842c44cda8f335ecbbaae88d5610d3a1790b4b";

export const SHOP_PAGES = [
  [
    { key: "AA66CC", label: "Purple",    price: 0   },
    { key: "73BE73", label: "Green",     price: 50  },
    { key: "CC99A2", label: "Pink",      price: 100 },
    { key: "40E0D0", label: "Turquoise", price: 150 },
    { key: "FFA500", label: "Orange",    price: 200 }
  ],
  [
    { key: "7A0000", label: "Maroon",     price: 250 },
    { key: "0B228A", label: "Dark Blue",  price: 300 },
    { key: "226546", label: "Dark Green", price: 350 },
    { key: "E2FF00", label: "Yellow",     price: 400 },
    { key: "FFEADD", label: "Inna Beige", price: 450 }
  ],
  [
    { key: "480437", label: "Eggplant",   price: 500 },
    { key: "E9C4F4", label: "Mauve",      price: 600 },
    { key: "A0A45B", label: "Olive Green",price: 700 },
    { key: "ADD8E6", label: "",           price: 800 },
    { key: "ADD8E6", label: "",           price: 900 }
  ]
];

// ── Setters (pour modifier depuis l'extérieur) ────────────
export function setGameVolume(v)    { gameVolume    = v; }
export function setKeyboardLayout(v){ keyboardLayout = v; }
export function setPlayerCoins(v)   { playerCoins   = v; }
export function setDead(v)          { dead          = v; }
export function setKill(v)          { kill          = v; }
export function setParty(v)         { party         = v; }
export function setColorPlayer(v)   { colorPlayer   = v; }
