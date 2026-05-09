// =========================================================
//                      DEV MENU
// =========================================================

import { devSetCoins } from "./helpers.js";
import { gameVolume }  from "../globals.js";
import { save, loadPlayerData } from "./db.js";

export function openDevMenu() {
  // `this` = scène Phaser courante (appelé via .call(scene))

  const overlay = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.75);
  const box     = this.add.rectangle(400, 300, 420, 370, 0x1c1c1c).setStrokeStyle(3, 0x00ffff);

  this.add.text(400, 160, "DEV MENU", { fontSize: "26px", color: "#00ffff" }).setOrigin(0.5);

  // ── Input coins ──
  let coinInputValue = "";

  this.add.text(400, 200, "SET COINS", { fontSize: "18px", color: "#cccccc" }).setOrigin(0.5);
  const coinInputBox  = this.add.rectangle(400, 240, 200, 40, 0x000000).setStrokeStyle(2, 0x00ffff);
  const coinInputText = this.add.text(400, 240, "0", { fontSize: "22px", color: "#00ffcc" }).setOrigin(0.5);

  const keyboardHandler = e => {
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

  setCoinsBtn.on("pointerdown", async () => {
    this.input.keyboard.off("keydown", keyboardHandler);
    await devSetCoins(coinInputValue);
    this.scene.restart();
  });

  // ── Bouton Unlock all skins ──
  const unlockBtn = this.add.text(400, 340, "UNLOCK ALL SKINS", {
    fontSize: "20px", backgroundColor: "#AA8800", color: "#ffffff", padding: { x: 20, y: 8 }
  }).setOrigin(0.5).setInteractive();

  unlockBtn.on("pointerdown", async () => {
    // Unlock toutes les skins connues + les skins d'objectifs
    const allSkins = [
      "AA66CC","73BE73","CC99A2","40E0D0","FFA500",
      "7A0000","0B228A","226546","E2FF00","FFEADD",
      "480437","E9C4F4","A0A45B","ADD8E6",
      "000000","FF0000","A0522D"
    ];
    const fields = {};
    allSkins.forEach(k => { fields[`skins.${k}`] = true; });
    await save.skin && Object.entries(fields).reduce(
      (p, [k, v]) => p.then(() => save.skin(k.replace("skins.", ""), v)),
      Promise.resolve()
    );
    // Plus simple : écriture groupée via saveFields
    const { saveFields } = await import("./db.js");
    await saveFields(fields);
    this.scene.restart();
  });

  // ── Bouton Unlock all levels ──
  const unlockLevelsBtn = this.add.text(400, 390, "UNLOCK ALL LEVELS", {
    fontSize: "20px", backgroundColor: "#005588", color: "#ffffff", padding: { x: 20, y: 8 }
  }).setOrigin(0.5).setInteractive();

  unlockLevelsBtn.on("pointerdown", async () => {
    const allLevels = [
      "Level1","Level2","Level3","Level4","Level5",
      "Level6","Level7","Level8","Level9"
    ];
    const fields = {};
    allLevels.forEach(k => { fields[`completedLevels.${k}`] = true; });
    const { saveFields } = await import("./db.js");
    await saveFields(fields);
    // Mettre à jour la variable en mémoire aussi
    const { setCompletedLevels } = await import("../globals.js");
    const completed = {};
    allLevels.forEach(k => { completed[k] = true; });
    setCompletedLevels(completed);
    this.scene.restart();
  });

  // ── Bouton Close ──
  const closeBtn = this.add.text(400, 440, "CLOSE", {
    fontSize: "18px", backgroundColor: "#AA0000", color: "#ffffff", padding: { x: 20, y: 6 }
  }).setOrigin(0.5).setInteractive();

  closeBtn.on("pointerdown", () => {
    this.input.keyboard.off("keydown", keyboardHandler);
    [overlay, box, coinInputBox, coinInputText, setCoinsBtn, unlockBtn, unlockLevelsBtn, closeBtn]
      .forEach(o => o.destroy());
  });
}
