// =========================================================
//                    LOADING SCENE
// =========================================================
import { gameVolume } from "../globals.js";

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

    const progressBar  = this.add.graphics();
    const percentText  = this.add.text(width / 2, height / 2 + 50, "0%", {
      fontSize: "20px", fill: "#ffffff"
    }).setOrigin(0.5);

    this.load.on("progress", (value) => {
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
      loadingText.setText("Prêt !");
      percentText.destroy();
    });
  }

  create() {
    this.bgm = this.sound.add("bgm", { loop: true, volume: gameVolume });
    this.time.delayedCall(500, () => {
      if (!this.bgm.isPlaying) this.bgm.play();
      this.scene.start("MenuScene");
    });
  }
}
