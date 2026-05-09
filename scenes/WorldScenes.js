// =========================================================
//                       WORLD 1
// =========================================================
import { gameVolume, playerCoins, completedLevels, bestTimes } from "../globals.js";
import { createSnow } from "../utils/gameObjects.js";

// ── Fonction partagée de rendu de liste de niveaux ────────
function renderLevelList(scene, levels, x, startY, allLevels) {
  levels.forEach(niv => {
    const idx  = allLevels.indexOf(niv.scene);
    const prev = idx > 0 ? allLevels[idx - 1] : null;
    const unlocked = !prev || !!completedLevels[prev];

    const color = unlocked ? "#ffffff" : "#888888";
    const label = unlocked ? niv.nom : `🔒 ${niv.nom.replace("➡ ", "")}`;

    const btn = scene.add.text(x, startY, label, {
      fontSize: "34px", color
    }).setOrigin(0.5);

    if (unlocked) {
      btn.setInteractive();
      btn.on("pointerdown", () => {
        scene.sound.play("select", { volume: gameVolume });
        scene.scene.start("LevelScene", { levelKey: niv.scene });
      });
      btn.on("pointerover", () => btn.setStyle({ color: "#00FFFF" }));
      btn.on("pointerout",  () => btn.setStyle({ color: "#ffffff" }));
    }

    if (completedLevels[niv.scene]) {
      const ms    = bestTimes[niv.scene];
      const badge = ms !== undefined ? `⏱ ${(ms / 1000).toFixed(2)}s` : "✅";
      scene.add.text(x + 115, startY, badge, {
        fontSize: "16px", color: "#00FF99"
      }).setOrigin(0.5);
    }

    startY += 60;
  });
}

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

    // ── Bouton monde suivant (débloqué si Level8 terminé) ──
    const w2Unlocked = !!completedLevels["Level8"];
    const next = this.add.text(700, 280, "▶", {
      fontSize: "24px",
      color: w2Unlocked ? "#ffffff" : "#888888",
      backgroundColor: w2Unlocked ? "#00BFFF" : "#444444",
      padding: { x: 7, y: 4 }
    });
    if (w2Unlocked) {
      next.setInteractive();
      next.on("pointerdown", () => {
        this.sound.play("menu", { volume: gameVolume });
        this.scene.start("World2");
      });
    }

    // ── Niveaux ──
    const col1 = [
      { nom: "➡ Level 1", scene: "Level1" }, { nom: "➡ Level 2", scene: "Level2" },
      { nom: "➡ Level 3", scene: "Level3" }, { nom: "➡ Level 4", scene: "Level4" }
    ];
    const col2 = [
      { nom: "➡ Level 5", scene: "Level5" }, { nom: "➡ Level 6", scene: "Level6" },
      { nom: "➡ Level 7", scene: "Level7" }, { nom: "➡ Level 8", scene: "Level8" }
    ];

    const allW1 = ["Level1","Level2","Level3","Level4","Level5","Level6","Level7","Level8"];

    renderLevelList(this, col1, 200, 260, allW1);
    renderLevelList(this, col2, 550, 260, allW1);
  }
}

// =========================================================
//                       WORLD 2
// =========================================================
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

    // Level9 débloqué si Level8 terminé
    const allW2 = ["Level8", "Level9"];
    const niveaux = [{ nom: "➡ Level 9", scene: "Level9" }];
    renderLevelList(this, niveaux, 200, 260, allW2);
  }
}
