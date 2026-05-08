// =========================================================
//                      DEV MENU
// =========================================================
import { devSetCoins } from "./helpers.js";
import { gameVolume } from "../globals.js";

export function openDevMenu() {
  // `this` = scène Phaser courante (appelé via .call(scene))

  const overlay = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.75);
  const box     = this.add.rectangle(400, 300, 420, 320, 0x1c1c1c).setStrokeStyle(3, 0x00ffff);

  this.add.text(400, 160, "DEV MENU", { fontSize: "26px", color: "#00ffff" }).setOrigin(0.5);

  // ── Input coins ──
  let coinInputValue = "";

  this.add.text(400, 200, "SET COINS", { fontSize: "18px", color: "#cccccc" }).setOrigin(0.5);
  const coinInputBox  = this.add.rectangle(400, 240, 200, 40, 0x000000).setStrokeStyle(2, 0x00ffff);
  const coinInputText = this.add.text(400, 240, "0", { fontSize: "22px", color: "#00ffcc" }).setOrigin(0.5);

  const keyboardHandler = (e) => {
    if (e.key >= "0" && e.key <= "9") coinInputValue += e.key;
    if (e.key === "Backspace")         coinInputValue = coinInputValue.slice(0, -1);
    if (coinInputValue.length > 9)     coinInputValue = coinInputValue.slice(0, 9);
    coinInputText.setText(coinInputValue || "0");
  };
  this.input.keyboard.on("keydown", keyboardHandler);

  // ── Bouton Apply coins ──
  const setCoinsBtn = this.add.text(400, 290, "APPLY COINS", {
    fontSize: "20px", backgroundColor: "#00aa00", color: "#ffffff", padding: { x: 20, y: 8 }
  }).setOrigin(0.5).setInteractive();

  setCoinsBtn.on("pointerdown", () => {
    devSetCoins(coinInputValue);
    this.input.keyboard.off("keydown", keyboardHandler);
    this.scene.restart();
  });

  // ── Bouton Unlock all skins ──
  const unlockBtn = this.add.text(400, 340, "UNLOCK ALL SKINS", {
    fontSize: "20px", backgroundColor: "#AA8800", color: "#ffffff", padding: { x: 20, y: 8 }
  }).setOrigin(0.5).setInteractive();

  unlockBtn.on("pointerdown", () => {
    Object.keys(localStorage)
      .filter(k => k.startsWith("skin_"))
      .forEach(k => localStorage.setItem(k, "1"));
    localStorage.setItem("skin_000000", "1");
    localStorage.setItem("skin_FF0000", "1");
    localStorage.setItem("skin_A0522D", "1");
    this.scene.restart();
  });

  // ── Bouton Close ──
  const closeBtn = this.add.text(400, 390, "CLOSE", {
    fontSize: "18px", backgroundColor: "#AA0000", color: "#ffffff", padding: { x: 20, y: 6 }
  }).setOrigin(0.5).setInteractive();

  closeBtn.on("pointerdown", () => {
    this.input.keyboard.off("keydown", keyboardHandler);
    [overlay, box, coinInputBox, coinInputText, setCoinsBtn, unlockBtn, closeBtn]
      .forEach(o => o.destroy());
  });
}
