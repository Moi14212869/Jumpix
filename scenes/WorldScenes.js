// =========================================================
//                       WORLD 1
// =========================================================
import { gameVolume, playerCoins } from "../globals.js";

export class World1 extends Phaser.Scene {
  constructor() { super("World1"); }

  create() {
    this.add.text(400, 80, "World 1", { fontSize: "50px", color: "#ffffff" }).setOrigin(0.5);

    this.add.text(780, 20, `💰 ${playerCoins}`, {
      fontSize: "28px", color: "#ffff00"
    }).setOrigin(1, 0);

    // ── Bouton menu ──
    const menuBtn = this.add.text(5, 5, "←", {
      fontSize: "24px", color: "#ffffff",
      backgroundColor: "#00BFFF", padding: { x: 7, y: 4 }
    }).setInteractive();
    menuBtn.on("pointerdown", () => {
      this.sound.play("menu", { volume: gameVolume });
      this.scene.start("MenuScene");
    });

    // ── Bouton monde suivant ──
    const next = this.add.text(700, 280, "▶", {
      fontSize: "24px", color: "#ffffff",
      backgroundColor: "#00BFFF", padding: { x: 7, y: 4 }
    }).setInteractive();
    next.on("pointerdown", () => {
      this.sound.play("menu", { volume: gameVolume });
      this.scene.start("World2");
    });

    // ── Niveaux ──
    const col1 = [
      { nom: "➡ Level 1", scene: "Level1" }, { nom: "➡ Level 2", scene: "Level2" },
      { nom: "➡ Level 3", scene: "Level3" }, { nom: "➡ Level 4", scene: "Level4" }
    ];
    const col2 = [
      { nom: "➡ Level 5", scene: "Level5" }, { nom: "➡ Level 6", scene: "Level6" },
      { nom: "➡ Level 7", scene: "Level7" }, { nom: "➡ Level 8", scene: "Level8" }
    ];

    this._renderLevelList(col1, 200, 260);
    this._renderLevelList(col2, 550, 260);
  }

  _renderLevelList(levels, x, startY) {
    levels.forEach(niv => {
      const btn = this.add.text(x, startY, niv.nom, {
        fontSize: "34px", color: "#ffffff"
      }).setOrigin(0.5).setInteractive();
      btn.on("pointerdown", () => {
        this.sound.play("select", { volume: gameVolume });
        this.scene.start("LevelScene", { levelKey: niv.scene });
      });
      startY += 60;
    });
  }
}

// =========================================================
//                       WORLD 2
// =========================================================
import { createSnow } from "../utils/gameObjects.js";

export class World2 extends Phaser.Scene {
  constructor() { super("World2"); }

  create() {
    createSnow(this);

    this.add.text(400, 80, "World 2", { fontSize: "50px", color: "#ffffff" }).setOrigin(0.5);
    this.add.text(780, 20, `💰 ${playerCoins}`, {
      fontSize: "28px", color: "#ffff00"
    }).setOrigin(1, 0);

    const menuBtn = this.add.text(5, 5, "←", {
      fontSize: "24px", color: "#ffffff",
      backgroundColor: "#00BFFF", padding: { x: 7, y: 4 }
    }).setInteractive();
    menuBtn.on("pointerdown", () => {
      this.sound.play("menu", { volume: gameVolume });
      this.scene.start("MenuScene");
    });

    const prec = this.add.text(10, 280, "◀", {
      fontSize: "24px", color: "#ffffff",
      backgroundColor: "#00BFFF", padding: { x: 7, y: 4 }
    }).setInteractive();
    prec.on("pointerdown", () => {
      this.sound.play("menu", { volume: gameVolume });
      this.scene.start("World1");
    });

    const niveaux = [{ nom: "➡ Level 9", scene: "Level9" }];
    let y = 260;
    niveaux.forEach(niv => {
      const btn = this.add.text(200, y, niv.nom, {
        fontSize: "34px", color: "#ffffff"
      }).setOrigin(0.5).setInteractive();
      btn.on("pointerdown", () => {
        this.sound.play("select", { volume: gameVolume });
        this.scene.start("LevelScene", { levelKey: niv.scene });
      });
      y += 60;
    });
  }
}
