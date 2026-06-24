// =========================================================
//                      MENU SCENE
// =========================================================
import { gameVolume, playerCoins } from "../globals.js";
import { createButton } from "../utils/helpers.js";

export class MenuScene extends Phaser.Scene {
  constructor() { super("MenuScene"); }

  create() {
    const { width, height } = this.scale;

    this.add.text(width / 2, 120, "Jumpix", {
      fontSize: "50px", color: "#ffffff", fontStyle: "bold"
    }).setOrigin(0.5);

    this.coinText = this.add.text(width - 20, 20, `💰 ${playerCoins}`, {
      fontSize: "28px", color: "#ffff00", fontStyle: "bold"
    }).setOrigin(1, 0);

    const buttons = [
      { label: "➡ Play !!", scene: "World1"         },
      { label: "Shop 🛒",   scene: "ShopScene"       },
      { label: "🏆 Objectives", scene: "ObjectivesScene" },
      { label: "Statistics",    scene: "Stats"        },
      { label: "🛠 Level Editor", scene: "LevelEditorScene" },
      { label: "⚔ Duel local", scene: "MinigameScene" },
    ];

    let startY = 185;
    buttons.forEach((btn, i) => {
      createButton(this, width / 2, startY, 320, 60, btn.label, () => {
        this.sound.play("select", { volume: gameVolume });
        this.scene.start(btn.scene);
      }, i);
      startY += 62;
    });

    createButton(this, 40, 40, 60, 50, "⚙", () => {
      this.sound.play("menu", { volume: gameVolume });
      this.scene.start("SettingsScene");
    });


    createButton(this, 110, 40, 60, 50, "🏆", () => {
      this.sound.play("menu", { volume: gameVolume });
      this.scene.start("LeaderboardScene");
    });
  }
}
