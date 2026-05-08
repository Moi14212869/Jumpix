// =========================================================
//                    LOADING SCENE
// =========================================================
// Charge les assets audio, attend que Firebase ait résolu
// l'état d'authentification, puis charge la progression
// si l'utilisateur est connecté.
// =========================================================

import { gameVolume, applyPlayerData } from "../globals.js";
import { waitForAuthReady }            from "../utils/firebase.js";
import { loadPlayerData }              from "../utils/db.js";

export class LoadingScene extends Phaser.Scene {
  constructor() { super("LoadingScene"); }

  preload() {
    const { width, height } = this.scale;

    const loadingText = this.add.text(width / 2, height / 2 - 50, "Chargement...", {
      fontSize: "32px", fill: "#ffffff"
    }).setOrigin(0.5);

    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2, 320, 30);

    const progressBar = this.add.graphics();
    const percentText = this.add.text(width / 2, height / 2 + 50, "0%", {
      fontSize: "20px", fill: "#ffffff"
    }).setOrigin(0.5);

    this.load.on("progress", value => {
      progressBar.clear();
      progressBar.fillStyle(0xffffff, 1);
      progressBar.fillRect(width / 2 - 150, height / 2 + 5, 300 * value, 20);
      percentText.setText(parseInt(value * 100) + "%");
    });

    this.load.audio("bgm",     "asset/8bit-music-for-game-68698.mp3");
    this.load.audio("jump",    "asset/jump_c_02-102843.mp3");
    this.load.audio("dead",    "asset/game-over-arcade-6435.mp3");
    this.load.audio("victory", "asset/level-up-enhancement-8-bit-retro-sound-effect-153002.mp3");
    this.load.audio("menu",    "asset/menu.mp3");
    this.load.audio("select",  "asset/select.mp3");
    this.load.audio("kill",    "asset/kill.mp3");
    this.load.audio("buy",     "asset/buy.mp3");
    this.load.audio("slide",   "asset/slide.mp3");

    this.load.on("complete", () => {
      progressBar.destroy();
      progressBox.destroy();
      percentText.destroy();
      loadingText.setText("Connexion...");
    });
  }

  async create() {
    this.bgm = this.sound.add("bgm", { loop: true, volume: gameVolume });
    if (!this.bgm.isPlaying) this.bgm.play();

    try {
      // Attend que Firebase sache si une session existe
      await waitForAuthReady();
      // Si connecté, charge la progression ; sinon retourne les défauts
      const data = await loadPlayerData();
      applyPlayerData(data);
    } catch (err) {
      console.warn("Firebase indisponible, démarrage en mode invité.", err);
    }

    this.scene.start("MenuScene");
  }
}
