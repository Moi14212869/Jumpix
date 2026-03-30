// ===== LOAD =====
export let gameVolume = parseFloat(localStorage.getItem("gameVolume"));
export let keyboardLayout = localStorage.getItem("keyboardLayout") || "zqsd";

if (isNaN(gameVolume)) gameVolume = 0.5;

export let playerCoins = parseInt(localStorage.getItem("playerCoins")) || 0;
export let dead = parseInt(localStorage.getItem("dead")) || 0;
export let kill = parseInt(localStorage.getItem("kill")) || 0;
export let party = parseInt(localStorage.getItem("party")) || 0;
export let colorPlayer = parseInt(localStorage.getItem("colorPlayer")) || 0xAA66CC;

export const DEV_PASSWORD_HASH = "9651d08ab7a975b70a93f3c918842c44cda8f335ecbbaae88d5610d3a1790b4b";


// ===== SETTERS (🔥 IMPORTANT) =====

export function setVolume(v) {
    gameVolume = Phaser.Math.Clamp(v, 0, 1);
    localStorage.setItem("gameVolume", gameVolume);
}

export function setKeyboard(layout) {
    keyboardLayout = layout;
    localStorage.setItem("keyboardLayout", layout);
}

export function addCoins(amount) {
    playerCoins += amount;
    localStorage.setItem("playerCoins", playerCoins);
}

export function setCoins(amount) {
    playerCoins = Math.max(0, parseInt(amount) || 0);
    localStorage.setItem("playerCoins", playerCoins);
}

export function addDeath() {
    dead++;
    localStorage.setItem("dead", dead);
}

export function addKill() {
    kill++;
    localStorage.setItem("kill", kill);
}

export function addParty() {
    party++;
    localStorage.setItem("party", party);
}

export function setColor(color) {
    colorPlayer = color;
    localStorage.setItem("colorPlayer", color);
}


// ===== RESET =====
export function resetAll() {
    localStorage.clear();

    gameVolume = 0.5;
    keyboardLayout = "zqsd";
    playerCoins = 0;
    dead = 0;
    kill = 0;
    party = 0;
    colorPlayer = 0xAA66CC;

    localStorage.setItem("gameVolume", gameVolume);
    localStorage.setItem("keyboardLayout", keyboardLayout);
    localStorage.setItem("playerCoins", playerCoins);
    localStorage.setItem("dead", dead);
    localStorage.setItem("kill", kill);
    localStorage.setItem("party", party);
    localStorage.setItem("colorPlayer", colorPlayer);
}
