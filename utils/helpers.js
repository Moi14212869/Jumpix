// =========================================================
//                     UTILS / HELPERS
// =========================================================
import { gameVolume, dead, kill, party, colorPlayer,
         setDead, setKill, setParty, setColorPlayer,
         setPlayerCoins, playerCoins } from "../globals.js";

// ── Hash (mot de passe dev) ───────────────────────────────
export async function hashText(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Vérification des objectifs / déblocage de skins ──────
export function checkObjectives() {
  if (dead  >= 1000) localStorage.setItem("skin_000000", "1");
  if (kill  >=  500) localStorage.setItem("skin_FF0000", "1");
  if (party >= 1000) localStorage.setItem("skin_A0522D", "1");
}

// ── Coins (mode dev) ──────────────────────────────────────
export function devSetCoins(amount) {
  amount = parseInt(amount);
  if (isNaN(amount) || amount < 0) amount = 0;
  setPlayerCoins(amount);
  localStorage.setItem("playerCoins", amount);
}

// ── Normalise une clé couleur en hex string ───────────────
export function normalizeKeyToHex(key) {
  if (typeof key === "number")
    return key.toString(16).toUpperCase().padStart(6, "0");
  key = String(key).trim();
  if (key.startsWith("0x") || key.startsWith("0X")) key = key.slice(2);
  if (key.startsWith("#")) key = key.slice(1);
  return key.toUpperCase();
}

// ── Popup "pas assez de pièces" ───────────────────────────
export function showNotEnoughCoinsPopup(scene) {
  const { width, height } = scene.scale;

  const overlay = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6).setScrollFactor(0);
  const box     = scene.add.rectangle(width / 2, height / 2, 360, 160, 0x222222).setStrokeStyle(3, 0xffffff);
  const text    = scene.add.text(width / 2, height / 2 - 20, "💸 Oops! Not enough coins!", {
    fontSize: "26px", color: "#ffffff"
  }).setOrigin(0.5);

  const okBtn = scene.add.text(width / 2, height / 2 + 40, "OK", {
    fontSize: "22px", color: "#ffffff",
    backgroundColor: "#00BFFF", padding: { x: 20, y: 10 }
  }).setOrigin(0.5).setInteractive();

  okBtn.on("pointerdown", () => {
    scene.sound.play("menu", { volume: gameVolume });
    overlay.destroy(); box.destroy(); text.destroy(); okBtn.destroy();
  });
}

// ── Bouton animé réutilisable ─────────────────────────────
export function createButton(scene, x, y, width, height, label, callback, index = 0) {
  const bg = scene.add.rectangle(x, y + 50, width, height, 0x00BFFF, 0.5)
    .setOrigin(0.5).setStrokeStyle(2, 0xffffff).setInteractive();

  const text = scene.add.text(x, y + 50, label, {
    fontSize: "28px", color: "#ffffff", fontStyle: "bold"
  }).setOrigin(0.5);

  scene.tweens.add({
    targets: [bg, text], y, alpha: { from: 0, to: 1 },
    duration: 700, delay: index * 100, ease: "Back.easeOut"
  });

  [bg, text].forEach(obj => {
    obj.on("pointerover", () => {
      bg.setFillStyle(0x00BFFF, 0.9);
      text.setStyle({ color: "#00FFFF" });
      scene.tweens.add({ targets: [bg, text], scale: 1.05, duration: 150 });
    });
    obj.on("pointerout", () => {
      bg.setFillStyle(0x00BFFF, 0.5);
      text.setStyle({ color: "#ffffff" });
      scene.tweens.add({ targets: [bg, text], scale: 1, duration: 150 });
    });
    obj.on("pointerdown", () => {
      callback();
      scene.tweens.add({ targets: [bg, text], scale: 0.95, duration: 50, yoyo: true });
    });
  });

  return { bg, text };
}
