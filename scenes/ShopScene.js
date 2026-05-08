// =========================================================
//                       SHOP SCENE
// =========================================================
import {
  gameVolume, playerCoins, colorPlayer, SHOP_PAGES,
  setPlayerCoins, setColorPlayer
} from "../globals.js";
import { normalizeKeyToHex, showNotEnoughCoinsPopup } from "../utils/helpers.js";

export class ShopScene extends Phaser.Scene {
  constructor() { super("ShopScene"); }

  init(data) {
    this.page = (data && data.page !== undefined) ? data.page : 0;
  }

  create() {
    const { width } = this.scale;

    this.add.text(width / 2, 20, "SHOP", { fontSize: "40px", fill: "#ffffff" }).setOrigin(0.5, 0);
    this.coinText = this.add.text(width - 20, 20, `💰 ${playerCoins}`, {
      fontSize: "28px", color: "#ffff00"
    }).setOrigin(1, 0);

    this.add.text(width / 2, 70, `Page ${this.page + 1} / ${SHOP_PAGES.length}`, {
      fontSize: "20px", color: "#cccccc"
    }).setOrigin(0.5);

    const ITEMS   = SHOP_PAGES[this.page];
    let startY    = 170;
    const skinX   = 140;
    const labelX  = 210;
    const actionX = 420;

    ITEMS.forEach(item => {
      const hexKey    = normalizeKeyToHex(item.key);
      const bought    = localStorage.getItem("skin_" + hexKey) === "1";
      const isSelected = parseInt(localStorage.getItem("colorPlayer")) === parseInt("0x" + hexKey);

      this.add.rectangle(skinX, startY, 50, 50, parseInt("0x" + hexKey));

      if (isSelected) {
        this.add.rectangle(skinX, startY, 60, 60).setStrokeStyle(3, 0x00FF66).setFillStyle();
      }

      this.add.text(labelX, startY - 20, item.label, { fontSize: "24px", fill: "#ffffff" });

      if (!bought && item.price > 0) {
        const buyText = this.add.text(actionX, startY - 20, `Buy ${item.price} ⬡`, {
          fontSize: "22px", fill: "#00FFFF"
        }).setInteractive();
        buyText.on("pointerdown", () => {
          this.sound.play("buy", { volume: gameVolume });
          this.buySkin(hexKey, item.price);
        });
      }

      if (bought || item.price === 0) {
        const selectText = this.add.text(actionX, startY - 20, isSelected ? "selected" : "select", {
          fontSize: "22px", fill: isSelected ? "#00FF66" : "#FFFFFF"
        }).setInteractive();
        selectText.on("pointerdown", () => {
          this.sound.play("select", { volume: gameVolume });
          this.selectSkin(hexKey);
        });
      }

      startY += 80;
    });

    // ── Navigation ──
    const back = this.add.text(10, 10, "←", {
      fontSize: "24px", color: "#ffffff", backgroundColor: "#00BFFF", padding: { x: 7, y: 4 }
    }).setInteractive();
    back.on("pointerdown", () => {
      this.sound.play("menu", { volume: gameVolume });
      this.scene.start("MenuScene");
    });

    if (this.page > 0) {
      const prev = this.add.text(20, 300, "◀", {
        fontSize: "28px", color: "#ffffff", backgroundColor: "#00BFFF", padding: { x: 10, y: 5 }
      }).setInteractive();
      prev.on("pointerdown", () => {
        this.sound.play("menu", { volume: gameVolume });
        this.scene.start("ShopScene", { page: this.page - 1 });
      });
    }

    if (this.page < SHOP_PAGES.length - 1) {
      const next = this.add.text(750, 300, "▶", {
        fontSize: "28px", color: "#ffffff", backgroundColor: "#00BFFF", padding: { x: 10, y: 5 }
      }).setInteractive();
      next.on("pointerdown", () => {
        this.sound.play("menu", { volume: gameVolume });
        this.scene.start("ShopScene", { page: this.page + 1 });
      });
    }
  }

  buySkin(colorKey, price) {
    if (playerCoins < price) { showNotEnoughCoinsPopup(this); return; }
    setPlayerCoins(playerCoins - price);
    localStorage.setItem("playerCoins", playerCoins);
    localStorage.setItem("skin_" + colorKey, "1");
    this.scene.restart({ page: this.page });
  }

  selectSkin(colorKey) {
    const colorNumber = parseInt("0x" + colorKey);
    localStorage.setItem("colorPlayer", colorNumber);
    setColorPlayer(colorNumber);
    this.scene.restart({ page: this.page });
  }
}
