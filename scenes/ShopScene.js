// =========================================================
//                       SHOP SCENE
// =========================================================

import {
  gameVolume, playerCoins, colorPlayer, SHOP_PAGES,
  setPlayerCoins, setColorPlayer
} from "../globals.js";
import { normalizeKeyToHex, showNotEnoughCoinsPopup } from "../utils/helpers.js";
import { save, skinOwned, loadPlayerData }            from "../utils/db.js";

export class ShopScene extends Phaser.Scene {
  constructor() { super("ShopScene"); }

  init(data) {
    this.page       = (data && data.page !== undefined) ? data.page : 0;
    // playerData peut être passé depuis une scène précédente pour éviter
    // une relecture Firestore, sinon null → on le charge dans create()
    this.playerData = data?.playerData ?? null;
  }

  async create() {
    // Si on n'a pas encore les données, on les charge
    if (!this.playerData) {
      this.playerData = await loadPlayerData();
    }

    const { width }    = this.scale;
    const pd           = this.playerData;
    const currentCoins = pd.playerCoins ?? playerCoins;
    const currentColor = pd.colorPlayer ?? colorPlayer;

    this.add.text(width / 2, 20, "SHOP", { fontSize: "40px", fill: "#ffffff" }).setOrigin(0.5, 0);
    this.coinText = this.add.text(width - 20, 20, `💰 ${currentCoins}`, {
      fontSize: "28px", color: "#ffff00"
    }).setOrigin(1, 0);

    this.add.text(width / 2, 70, `Page ${this.page + 1} / ${SHOP_PAGES.length}`, {
      fontSize: "20px", color: "#cccccc"
    }).setOrigin(0.5);

    const ITEMS  = SHOP_PAGES[this.page];
    let startY   = 170;
    const skinX  = 140;
    const labelX = 210;
    const actionX = 420;

    ITEMS.forEach(item => {
      const hexKey     = normalizeKeyToHex(item.key);
      const bought     = skinOwned(pd, hexKey) || item.price === 0;
      const isSelected = (pd.colorPlayer ?? colorPlayer) === parseInt("0x" + hexKey);

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
          this.buySkin(hexKey, item.price, pd);
        });
      }

      if (bought) {
        const selectText = this.add.text(actionX, startY - 20, isSelected ? "selected" : "select", {
          fontSize: "22px", fill: isSelected ? "#00FF66" : "#FFFFFF"
        }).setInteractive();
        selectText.on("pointerdown", () => {
          this.sound.play("select", { volume: gameVolume });
          this.selectSkin(hexKey, pd);
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
        this.scene.start("ShopScene", { page: this.page - 1, playerData: this.playerData });
      });
    }

    if (this.page < SHOP_PAGES.length - 1) {
      const next = this.add.text(750, 300, "▶", {
        fontSize: "28px", color: "#ffffff", backgroundColor: "#00BFFF", padding: { x: 10, y: 5 }
      }).setInteractive();
      next.on("pointerdown", () => {
        this.sound.play("menu", { volume: gameVolume });
        this.scene.start("ShopScene", { page: this.page + 1, playerData: this.playerData });
      });
    }
  }

  async buySkin(colorKey, price, pd) {
    const currentCoins = pd.playerCoins ?? playerCoins;
    if (currentCoins < price) { showNotEnoughCoinsPopup(this); return; }

    const newCoins = currentCoins - price;
    setPlayerCoins(newCoins);
    pd.playerCoins = newCoins;
    if (!pd.skins) pd.skins = {};
    pd.skins[colorKey] = true;

    await save.coins(newCoins);
    await save.skin(colorKey, true);

    this.scene.restart({ page: this.page, playerData: pd });
  }

  async selectSkin(colorKey, pd) {
    const colorNumber = parseInt("0x" + colorKey);
    setColorPlayer(colorNumber);
    pd.colorPlayer = colorNumber;

    await save.color(colorNumber);

    this.scene.restart({ page: this.page, playerData: pd });
  }
}
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
