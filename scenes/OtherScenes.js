// =========================================================
//                     SETTINGS SCENE
// =========================================================
import {
  gameVolume, keyboardLayout, colorPlayer,
  setGameVolume, setKeyboardLayout,
  setPlayerCoins, setDead, setKill, setParty, setColorPlayer
} from "../globals.js";
import { hashText } from "../utils/helpers.js";
import { openDevMenu } from "../utils/devMenu.js";
import { DEV_PASSWORD_HASH } from "../globals.js";

export class SettingsScene extends Phaser.Scene {
  constructor() { super("SettingsScene"); }

  create() {
    this.add.text(400, 80, "Settings", { fontSize: "40px", color: "#ffffff" }).setOrigin(0.5);
    this.add.text(400, 160, "Volume",   { fontSize: "28px", color: "#ffffff" }).setOrigin(0.5);

    // ── Slider volume ──
    this.add.rectangle(400, 220, 300, 10, 0x555555);
    const knob = this.add.circle(400 - 150 + gameVolume * 300, 220, 12, 0xffffff)
      .setInteractive({ draggable: true });
    this.input.setDraggable(knob);

    this.input.on("drag", (pointer, obj, dragX) => {
      const minX = 250, maxX = 550;
      obj.x = Phaser.Math.Clamp(dragX, minX, maxX);
      setGameVolume(Phaser.Math.Clamp((obj.x - minX) / 300, 0, 1));
      localStorage.setItem("gameVolume", gameVolume);
      this.sound.volume = gameVolume;
    });

    // ── Clavier ZQSD / WASD ──
    const keyboardBtn = this.add.text(400, 440, "", {
      fontSize: "22px", color: "#ffffff",
      backgroundColor: "#00BFFF", padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setInteractive();

    const updateKeyboardBtn = () => keyboardBtn.setText(`Clavier : ${keyboardLayout.toUpperCase()}`);
    updateKeyboardBtn();

    keyboardBtn.on("pointerover", () => {
      keyboardBtn.setStyle({ backgroundColor: "#00FFFF", color: "#000000" });
      this.tweens.add({ targets: keyboardBtn, scale: 1.05, duration: 120 });
    });
    keyboardBtn.on("pointerout", () => {
      keyboardBtn.setStyle({ backgroundColor: "#00BFFF", color: "#ffffff" });
      this.tweens.add({ targets: keyboardBtn, scale: 1, duration: 120 });
    });
    keyboardBtn.on("pointerdown", () => {
      setKeyboardLayout(keyboardLayout === "zqsd" ? "wasd" : "zqsd");
      localStorage.setItem("keyboardLayout", keyboardLayout);
      this.sound.play("menu", { volume: gameVolume });
      updateKeyboardBtn();
    });

    // ── Reset compte ──
    const resetBtn = this.add.text(400, 320, "RESET ACCOUNT", {
      fontSize: "24px", color: "#ffffff",
      backgroundColor: "#FF4444", padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setInteractive();

    resetBtn.on("pointerdown", () => {
      this.sound.play("menu", { volume: gameVolume });
      this._showResetConfirm();
    });

    // ── Dev menu ──
    const devBtn = this.add.text(400, 380, "DEV MENU", {
      fontSize: "22px", color: "#ffffff",
      backgroundColor: "#4444AA", padding: { x: 25, y: 10 }
    }).setOrigin(0.5).setInteractive();

    devBtn.on("pointerdown", () => {
      this.sound.play("menu", { volume: gameVolume });
      this._showPasswordPopup();
    });

    // ── Retour ──
    const back = this.add.text(5, 5, "←", {
      fontSize: "24px", color: "#ffffff",
      backgroundColor: "#00BFFF", padding: { x: 7, y: 4 }
    }).setInteractive();
    back.on("pointerdown", () => {
      this.sound.play("menu", { volume: gameVolume });
      this.scene.start("MenuScene");
    });
  }

  _showResetConfirm() {
    const overlay = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.6);
    const box     = this.add.rectangle(400, 300, 360, 180, 0x222222).setStrokeStyle(3, 0xffffff);
    const txt     = this.add.text(400, 260, "Reset all progress?\nThis cannot be undone!", {
      fontSize: "20px", color: "#ffffff", align: "center"
    }).setOrigin(0.5);

    const yes = this.add.text(340, 340, "YES", {
      fontSize: "22px", backgroundColor: "#FF4444", padding: { x: 15, y: 8 }
    }).setOrigin(0.5).setInteractive();

    const no = this.add.text(460, 340, "NO", {
      fontSize: "22px", backgroundColor: "#00BFFF", padding: { x: 15, y: 8 }
    }).setOrigin(0.5).setInteractive();

    no.on("pointerdown",  () => [overlay, box, txt, yes, no].forEach(o => o.destroy()));
    yes.on("pointerdown", () => {
      localStorage.clear();
      localStorage.setItem("gameVolume", 0.5);
      localStorage.setItem("playerCoins", 0);
      localStorage.setItem("dead", 0);
      localStorage.setItem("kill", 0);
      localStorage.setItem("party", 0);
      localStorage.setItem("colorPlayer", 0xAA66CC);
      setGameVolume(0.5); setPlayerCoins(0);
      setDead(0); setKill(0); setParty(0);
      setColorPlayer(0xAA66CC);
      this.scene.start("MenuScene");
    });
  }

  _showPasswordPopup() {
    const overlay  = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.7);
    const box      = this.add.rectangle(400, 300, 400, 240, 0x222222).setStrokeStyle(3, 0xffffff);
    const title    = this.add.text(400, 240, "DEV PASSWORD", { fontSize: "24px", color: "#ffffff" }).setOrigin(0.5);
    let inputText  = "";
    const input    = this.add.text(400, 295, "••••••", {
      fontSize: "26px", color: "#00ffcc",
      backgroundColor: "#000000", padding: { x: 15, y: 8 }
    }).setOrigin(0.5);
    const info     = this.add.text(400, 335, "", { fontSize: "18px", color: "#ff5555" }).setOrigin(0.5);

    const closeBtn = this.add.text(400, 365, "CANCEL", {
      fontSize: "18px", backgroundColor: "#aa0000", color: "#ffffff", padding: { x: 20, y: 6 }
    }).setOrigin(0.5).setInteractive();

    const destroy = () => {
      [overlay, box, title, input, info, closeBtn].forEach(o => o.destroy());
      this.input.keyboard.removeAllListeners();
    };

    closeBtn.on("pointerdown", () => {
      this.sound.play("menu", { volume: gameVolume });
      destroy();
    });

    this.input.keyboard.on("keydown", async (event) => {
      if (event.key === "Backspace")      inputText = inputText.slice(0, -1);
      else if (event.key === "Enter") {
        const hashed = await hashText(inputText);
        if (hashed === DEV_PASSWORD_HASH) {
          destroy();
          openDevMenu.call(this);
        } else {
          info.setText("❌ Wrong password");
          inputText = "";
        }
      } else if (event.key.length === 1) inputText += event.key;
      input.setText("•".repeat(inputText.length));
    });
  }
}

// =========================================================
//                     CREDITS SCENE
// =========================================================
import { gameVolume as gv } from "../globals.js";

export class CreditsScene extends Phaser.Scene {
  constructor() { super("CreditsScene"); }

  create() {
    const { width, height } = this.scale;

    const credits = [
      "Credits", "",
      "A game by", "OneLevel Studio", "",
      "Producer & Lead Programmer", "Eliott MORBIDELLI", "",
      "Visual Designer", "Leonie MORBIDELLI", "",
      "Lead Level Designer", "Eliott MORBIDELLI", "",
      "Level Designers", "A. MORBIDELLI", "Alix MORBIDELLI", "",
      "QA Testers", "Maxence ROOS", "",
      "Thanks for playing!", "", "For Inna"
    ];

    this.creditContainer = this.add.container(width / 2, height + 50);
    let offsetY = 0;
    credits.forEach(line => {
      const text = this.add.text(0, offsetY, line, { fontSize: "28px", color: "#ffffff" }).setOrigin(0.5);
      this.creditContainer.add(text);
      offsetY += 50;
    });

    this.scrollSpeed = 50;
    this.input.once("pointerdown", () => {
      this.sound.play("menu", { volume: gv });
      this.scene.start("MenuScene");
    });
  }

  update(time, delta) {
    this.creditContainer.y -= this.scrollSpeed * (delta / 1000);
    const last = this.creditContainer.list[this.creditContainer.list.length - 1];
    if (last.y + this.creditContainer.y < -50) this.scene.start("MenuScene");
  }
}

// =========================================================
//                       STATS SCENE
// =========================================================
export class Stats extends Phaser.Scene {
  constructor() { super("Stats"); }

  create() {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x3d2505);
    this.add.text(width / 2, 60, "STATISTICS", {
      fontSize: "40px", color: "#ffffff", fontStyle: "bold"
    }).setOrigin(0.5);

    const statsData = [
      { label: "Coins 💰",           value: parseInt(localStorage.getItem("playerCoins")) || 0 },
      { label: "Deaths ☠️",          value: parseInt(localStorage.getItem("dead"))         || 0 },
      { label: "Kills 🔪",           value: parseInt(localStorage.getItem("kill"))         || 0 },
      { label: "Parties Played 🎮",  value: parseInt(localStorage.getItem("party"))        || 0 }
    ];

    let startY = 150;
    statsData.forEach(stat => {
      this.add.text(width / 2, startY, `${stat.label} : ${stat.value}`, {
        fontSize: "28px", color: "#ffff00"
      }).setOrigin(0.5);
      startY += 60;
    });

    const back = this.add.text(10, 10, "←", {
      fontSize: "24px", color: "#ffffff",
      backgroundColor: "#00BFFF", padding: { x: 10, y: 5 }
    }).setInteractive();
    back.on("pointerdown", () => {
      this.sound.play("menu", { volume: gameVolume });
      this.scene.start("MenuScene");
    });
  }
}

// =========================================================
//                    OBJECTIVES SCENE
// =========================================================
import { checkObjectives } from "../utils/helpers.js";

export class ObjectivesScene extends Phaser.Scene {
  constructor() { super("ObjectivesScene"); }

  create() {
    checkObjectives();
    const { width } = this.scale;

    this.add.text(width / 2, 60, "OBJECTIVES", { fontSize: "40px", color: "#ffffff" }).setOrigin(0.5);

    const objectives = [
      { label: "☠️ Die 1000 times",       progress: parseInt(localStorage.getItem("dead"))  || 0, goal: 1000, skin: "000000", color: 0x000000 },
      { label: "🔪 Make 500 kills",        progress: parseInt(localStorage.getItem("kill"))  || 0, goal:  500, skin: "FF0000", color: 0xFF0000 },
      { label: "🎮 Complete 1000 levels",  progress: parseInt(localStorage.getItem("party")) || 0, goal: 1000, skin: "A0522D", color: 0xA0522D }
    ];

    let y = 150;
    objectives.forEach(obj => {
      const unlocked = localStorage.getItem("skin_" + obj.skin) === "1";
      const percent  = Math.min(obj.progress / obj.goal, 1);

      this.add.text(100, y, obj.label, { fontSize: "22px", color: "#ffffff" });
      this.add.rectangle(100, y + 30, 300, 12, 0x444444).setOrigin(0);
      this.add.rectangle(100, y + 30, 300 * percent, 12, unlocked ? 0x00FF66 : 0xFFD700).setOrigin(0);
      this.add.text(420, y + 20, `${obj.progress}/${obj.goal}`, { fontSize: "18px", color: "#ffffff" });
      this.add.rectangle(600, y + 20, 40, 40, obj.color);

      if (unlocked) {
        const isSelected = colorPlayer === obj.color;
        const select = this.add.text(660, y + 10, isSelected ? "Selected" : "Select", {
          fontSize: "18px", color: isSelected ? "#00FF66" : "#ffffff",
          backgroundColor: "#ADD8E6", padding: { x: 10, y: 5 }
        }).setInteractive();

        select.on("pointerdown", () => {
          this.sound.play("select", { volume: gameVolume });
          localStorage.setItem("colorPlayer", obj.color);
          setColorPlayer(obj.color);
          select.setText("Selected").setColor("#00FF66");
        });
      } else {
        this.add.text(660, y + 10, "🔒", { fontSize: "22px" });
      }

      y += 100;
    });

    const back = this.add.text(10, 10, "←", {
      fontSize: "24px", backgroundColor: "#00BFFF", padding: { x: 10, y: 5 }
    }).setInteractive();
    back.on("pointerdown", () => {
      this.sound.play("menu", { volume: gameVolume });
      this.scene.start("MenuScene");
    });
  }
}
