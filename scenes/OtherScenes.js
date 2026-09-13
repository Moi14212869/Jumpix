// =========================================================
//                     SETTINGS SCENE
// =========================================================

import {
  gameVolume, keyboardLayout, colorPlayer,
  setGameVolume, setKeyboardLayout,
  setPlayerCoins, setDead, setKill, setParty, setColorPlayer,
  applyPlayerData
} from "../globals.js";
import { save, resetAccount, loadPlayerData, isLoggedIn, getPseudo, DEFAULTS, updateLeaderboardColor, loadLeaderboard, loadPublicPlayerStats, isPseudoTaken
} from "../utils/db.js";
import {
  registerWithEmail, loginWithEmail, logout, firebaseErrorMessage,
  getCurrentUser, isAnonymousUser, linkGuestToEmail
} from "../utils/firebase.js";

// =========================================================
//  FILTRE PSEUDO INAPPROPRIÉ
// =========================================================
const BAD_WORDS = [
  // FR
  "putain","merde","connard","connasse","salope","pute","batard","bâtard",
  "enculé","enculer","encule","nique","niquer","con","conne","couille",
  "bite","pine","chier","chieur","chieuse","baiser","couilles","couillon",
  "fdp","ntm","tg","va te faire","vtff","fils de pute","pd","tapette",
  "pédé","negro","negre","nègre","nigg","gros porc","sale gosse",
  // EN
  "fuck","shit","bitch","asshole","bastard","cunt","dick","cock","pussy",
  "faggot","fag","nigger","nigga","whore","slut","retard","moron","idiot",
  "stupid","dumb","kill","kys","rape","nazi","hitler","sex","porn",
  // Common bypasses / leet
  "f4ck","sh1t","b1tch","@ss","a55","d1ck","n1gg","fuk","phuck",
];

function isBadPseudo(pseudo) {
  const normalized = pseudo
    .toLowerCase()
    .replace(/[àáâ]/g, "a").replace(/[èéêë]/g, "e")
    .replace(/[ìíî]/g, "i").replace(/[òóô]/g, "o")
    .replace(/[ùúû]/g, "u").replace(/ç/g, "c")
    .replace(/[^a-z0-9]/g, ""); // retirer ponctuation/espaces pour détecter les contournements

  return BAD_WORDS.some(w => {
    const wNorm = w.toLowerCase().replace(/[^a-z0-9]/g, "");
    return normalized.includes(wNorm);
  });
}

// ── Palette visuelle ──────────────────────────────────────
const UI = {
  accent:       0x00BFFF,
  accentHover:  0x33D6FF,
  accentSoft:   0x0F3A52,
  cardBg:       0x141C2E,
  cardBorder:   0x27344A,
  trackBg:      0x223046,
  pillInactive: 0x1B2438,
  pillHover:    0x24314A,
  textMain:     "#F2F5FA",
  textMuted:    "#8592A8",
  textFaint:    "#5D6980",
  danger:       0xFF4D4D,
  dangerHover:  0xFF6B6B,
  success:      0x00D68A,
};

export class SettingsScene extends Phaser.Scene {
  constructor() { super("SettingsScene"); }

  create() {
    const { width, height } = this.scale;

    // ── Fond dégradé + vignette ─────────────────────────────
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0A101C, 0x0A101C, 0x141C30, 0x141C30, 1);
    bg.fillRect(0, 0, width, height);
    bg.setDepth(-20);

    const glow = this.add.graphics();
    glow.fillStyle(UI.accent, 0.05);
    glow.fillCircle(width / 2, -40, width * 0.7);
    glow.setDepth(-19);

    // ── Titre ────────────────────────────────────────────────
    this.add.text(width / 2, 34, "SETTINGS", {
      fontSize: "30px", color: UI.textMain, fontStyle: "bold",
      letterSpacing: 2
    }).setOrigin(0.5);
    this.add.rectangle(width / 2, 54, 46, 3, UI.accent).setOrigin(0.5);

    // ── Onglets (segmented control arrondi) ──────────────────
    const TABS = ["General", "Gameplay", "Credits"];
    this._activeTab = 0;
    this._tabContainer = null;

    const TAB_Y = 88;
    const TAB_W = 150, TAB_H = 40, TAB_GAP = 6, TAB_R = 12;
    const totalTabW = TABS.length * TAB_W + (TABS.length - 1) * TAB_GAP;
    const tabStartX = width / 2 - totalTabW / 2;

    // Piste de fond du segmented control
    const trackPad = 5;
    this.add.graphics()
      .fillStyle(UI.cardBg, 1)
      .fillRoundedRect(tabStartX - trackPad, TAB_Y - TAB_H / 2 - trackPad,
                        totalTabW + trackPad * 2, TAB_H + trackPad * 2, TAB_R + trackPad)
      .lineStyle(1, UI.cardBorder, 1)
      .strokeRoundedRect(tabStartX - trackPad, TAB_Y - TAB_H / 2 - trackPad,
                          totalTabW + trackPad * 2, TAB_H + trackPad * 2, TAB_R + trackPad);

    this._tabBgs = [];
    this._tabLabels = [];
    this._tabPills = [];
    this._tabRects = [];

    TABS.forEach((label, i) => {
      const tx = tabStartX + i * (TAB_W + TAB_GAP) + TAB_W / 2;
      const rect = { x: tx - TAB_W / 2, y: TAB_Y - TAB_H / 2, w: TAB_W, h: TAB_H };

      const pill = this.add.graphics();
      const bg = this.add.rectangle(tx, TAB_Y, TAB_W, TAB_H, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      const txt = this.add.text(tx, TAB_Y, label, {
        fontSize: "16px", color: UI.textMuted, fontStyle: "normal"
      }).setOrigin(0.5);

      bg.on("pointerover", () => { if (i !== this._activeTab) this._drawTabPill(pill, rect, UI.pillHover, TAB_R); });
      bg.on("pointerout",  () => { if (i !== this._activeTab) this._drawTabPill(pill, rect, UI.pillInactive, TAB_R); });
      bg.on("pointerdown", () => {
        if (i === this._activeTab) return;
        this.sound.play("menu", { volume: gameVolume });
        this._activeTab = i;
        this._refreshTabs();
        this._buildTabContent();
      });

      this._tabBgs.push(bg);
      this._tabLabels.push(txt);
      this._tabPills.push(pill);
      this._tabRects.push(rect);
    });

    // ── Carte de fond pour le contenu ─────────────────────────
    const cardTop = TAB_Y + TAB_H / 2 + 16;
    const cardBottom = height - 88;
    this.add.graphics()
      .fillStyle(UI.cardBg, 0.85)
      .fillRoundedRect(30, cardTop, width - 60, cardBottom - cardTop, 16)
      .lineStyle(1, UI.cardBorder, 1)
      .strokeRoundedRect(30, cardTop, width - 60, cardBottom - cardTop, 16);

    // ── Contenu dynamique ────────────────────────────────────
    this._tabContainer = this.add.container(0, 0);
    this._refreshTabs();
    this._buildTabContent();

    // ── Bloc compte (commun aux deux onglets) ────────────────
    this._buildAccountBlock();

    // ── Reset account ─────────────────────────────────────────
    const resetBtn = this.add.text(width / 2, height - 58, "⚠  RESET ACCOUNT", {
      fontSize: "15px", color: "#ffffff", fontStyle: "bold",
      backgroundColor: "#B93030", padding: { x: 16, y: 9 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    resetBtn.on("pointerover", () => resetBtn.setStyle({ backgroundColor: "#D63E3E" }));
    resetBtn.on("pointerout",  () => resetBtn.setStyle({ backgroundColor: "#B93030" }));
    resetBtn.on("pointerdown", () => {
      this.sound.play("menu", { volume: gameVolume });
      this._showResetConfirm();
    });

    // ── Retour ──────────────────────────────────────────────
    const back = this.add.text(18, 18, "←", {
      fontSize: "22px", color: "#ffffff", fontStyle: "bold",
      backgroundColor: "#182338", padding: { x: 11, y: 5 }
    }).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    back.setStroke("#27344A", 1);
    back.on("pointerover", () => back.setStyle({ backgroundColor: "#22314A" }));
    back.on("pointerout",  () => back.setStyle({ backgroundColor: "#182338" }));
    back.on("pointerdown", () => {
      this.sound.play("menu", { volume: gameVolume });
      this.scene.start("MenuScene");
    });
  }

  // ── Dessine une pilule d'onglet arrondie ─────────────────
  _drawTabPill(pill, rect, color, radius) {
    pill.clear();
    pill.fillStyle(color, 1);
    pill.fillRoundedRect(rect.x, rect.y, rect.w, rect.h, radius);
  }

  // ── Met à jour l'apparence des onglets ───────────────────
  _refreshTabs() {
    this._tabPills.forEach((pill, i) => {
      const active = i === this._activeTab;
      this._drawTabPill(pill, this._tabRects[i], active ? UI.accent : UI.pillInactive, 12);
    });
    this._tabLabels.forEach((txt, i) => {
      txt.setStyle({ color: i === this._activeTab ? "#04202B" : UI.textMuted,
                     fontStyle: i === this._activeTab ? "bold" : "normal" });
    });
  }

  // ── Construit le contenu de l'onglet actif ───────────────
  _buildTabContent() {
    if (this._tabContainer) this._tabContainer.removeAll(true);

    if (this._activeTab === 0) {
      this._buildTabGeneral();
    } else if (this._activeTab === 1) {
      this._buildTabGameplay();
    } else {
      this._buildTabCredits();
    }

    // Le bloc compte n'a pas sa place sur l'onglet Crédits
    if (this._accountContainer) {
      this._accountContainer.setVisible(this._activeTab !== 2);
    }
  }

  // ── Onglet "Général" : volume + clavier ──────────────────
  _buildTabGeneral() {
    const { width } = this.scale;
    const startY = 128;
    const sliderW = 300;
    const minX = width / 2 - sliderW / 2, maxX = width / 2 + sliderW / 2;

    // Volume
    const volLabel = this.add.text(width / 2 - sliderW / 2, startY, "🔊  Volume", {
      fontSize: "18px", color: UI.textMuted, fontStyle: "500"
    }).setOrigin(0, 0.5);
    const volPct = this.add.text(width / 2 + sliderW / 2, startY, `${Math.round(gameVolume * 100)}%`, {
      fontSize: "16px", color: UI.textFaint
    }).setOrigin(1, 0.5);

    const trackY = startY + 32;
    const track = this.add.graphics()
      .fillStyle(UI.trackBg, 1)
      .fillRoundedRect(minX, trackY - 4, sliderW, 8, 4);
    const fill = this.add.graphics();
    const drawFill = (vol) => {
      fill.clear();
      fill.fillStyle(UI.accent, 1);
      fill.fillRoundedRect(minX, trackY - 4, Math.max(8, sliderW * vol), 8, 4);
    };
    drawFill(gameVolume);

    const knob = this.add.circle(minX + gameVolume * sliderW, trackY, 10, 0xffffff)
      .setStrokeStyle(3, UI.accent)
      .setInteractive({ draggable: true, useHandCursor: true });
    this.input.setDraggable(knob);
    this.input.on("drag", (pointer, obj, dragX) => {
      if (obj !== knob) return;
      obj.x = Phaser.Math.Clamp(dragX, minX, maxX);
      const newVol = Phaser.Math.Clamp((obj.x - minX) / sliderW, 0, 1);
      setGameVolume(newVol);
      this.sound.volume = newVol;
      save.volume(newVol);
      drawFill(newVol);
      volPct.setText(`${Math.round(newVol * 100)}%`);
    });

    // Séparateur
    const sep = this.add.rectangle(width / 2, startY + 70, width - 100, 1, UI.cardBorder);

    // Clavier
    const kbLabel = this.add.text(width / 2 - sliderW / 2, startY + 95, "⌨  Layout", {
      fontSize: "18px", color: UI.textMuted
    }).setOrigin(0, 0.5);

    const keyboardBtn = this.add.text(width / 2 + sliderW / 2, startY + 95, "", {
      fontSize: "17px", color: "#04202B", fontStyle: "bold",
      backgroundColor: "#00BFFF", padding: { x: 18, y: 9 }
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });

    const updateKeyboardBtn = () =>
      keyboardBtn.setText(`${keyboardLayout.toUpperCase()}  ⇄`);
    updateKeyboardBtn();

    keyboardBtn.on("pointerover",  () => keyboardBtn.setStyle({ backgroundColor: "#33D6FF" }));
    keyboardBtn.on("pointerout",   () => keyboardBtn.setStyle({ backgroundColor: "#00BFFF" }));
    keyboardBtn.on("pointerdown",  () => {
      const newLayout = keyboardLayout === "zqsd" ? "wasd" : "zqsd";
      setKeyboardLayout(newLayout);
      save.keyboard(newLayout);
      this.sound.play("menu", { volume: gameVolume });
      updateKeyboardBtn();
    });

    this._tabContainer.add([volLabel, volPct, track, fill, knob, sep, kbLabel, keyboardBtn]);
  }

  // ── Onglet "Gameplay" : tutoriel + mode ghost ────────────
  _buildTabGameplay() {
    const { width } = this.scale;
    const startY = 130;

    const LS_TUTO = "jumpix_doubleJumpTutorialSeen";
    let tutoHidden = localStorage.getItem(LS_TUTO) === "true";

    // Titre de section
    const sectionLabel = this.add.text(width / 2 - 220, startY, "TUTORIALS", {
      fontSize: "14px", color: UI.textFaint, fontStyle: "bold", letterSpacing: 1
    }).setOrigin(0, 0.5);

    // Ligne "carte" pour le tutoriel
    const rowY = startY + 46;
    const rowW = 440, rowH = 64;
    const rowBg = this.add.graphics()
      .fillStyle(UI.trackBg, 0.6)
      .fillRoundedRect(width / 2 - rowW / 2, rowY - rowH / 2, rowW, rowH, 10);

    const title = this.add.text(width / 2 - rowW / 2 + 18, rowY - 12, "Double Jump", {
      fontSize: "17px", color: UI.textMain, fontStyle: "bold"
    }).setOrigin(0, 0.5);
    const desc = this.add.text(width / 2 - rowW / 2 + 18, rowY + 14, "Shown once, on Level 1", {
      fontSize: "13px", color: UI.textFaint
    }).setOrigin(0, 0.5);

    // Toggle bouton (pill on/off)
    const tutoBtn = this.add.text(width / 2 + rowW / 2 - 18, rowY, "", {
      fontSize: "15px", color: "#ffffff", fontStyle: "bold",
      backgroundColor: "#226622", padding: { x: 16, y: 8 }
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });

    const updateTutoBtn = () => {
      tutoBtn.setText(tutoHidden ? "✓  Hidden" : "●  Visible");
      tutoBtn.setStyle({ backgroundColor: tutoHidden ? "#2E7D46" : "#B93030" });
    };
    updateTutoBtn();

    tutoBtn.on("pointerdown", () => {
      tutoHidden = !tutoHidden;
      if (tutoHidden) localStorage.setItem(LS_TUTO, "true");
      else            localStorage.removeItem(LS_TUTO);
      this.sound.play("menu", { volume: gameVolume });
      updateTutoBtn();
    });

    this._tabContainer.add([sectionLabel, rowBg, title, desc, tutoBtn]);
  }

  // ── Onglet "Crédits" : voir les crédits + lien site du studio ──
  _buildTabCredits() {
    const { width } = this.scale;
    const startY = 150;

    const sectionLabel = this.add.text(width / 2, startY, "ABOUT", {
      fontSize: "14px", color: UI.textFaint, fontStyle: "bold", letterSpacing: 1
    }).setOrigin(0.5);

    const btnW = 280, btnH = 52;

    // Bouton "Voir les crédits"
    const creditsY = startY + 34;
    const creditsBg = this.add.graphics()
      .fillStyle(UI.accent, 1)
      .fillRoundedRect(width / 2 - btnW / 2, creditsY - btnH / 2, btnW, btnH, 12);
    const creditsLabel = this.add.text(width / 2, creditsY, "🎬  View Credits", {
      fontSize: "18px", color: "#04202B", fontStyle: "bold"
    }).setOrigin(0.5);
    const creditsHit = this.add.rectangle(width / 2, creditsY, btnW, btnH, 0x000000, 0)
      .setInteractive({ useHandCursor: true });

    creditsHit.on("pointerover", () => creditsBg.clear().fillStyle(0x33D6FF, 1).fillRoundedRect(width / 2 - btnW / 2, creditsY - btnH / 2, btnW, btnH, 12));
    creditsHit.on("pointerout",  () => creditsBg.clear().fillStyle(UI.accent, 1).fillRoundedRect(width / 2 - btnW / 2, creditsY - btnH / 2, btnW, btnH, 12));
    creditsHit.on("pointerdown", () => {
      this.sound.play("menu", { volume: gameVolume });
      this.scene.start("CreditsScene");
    });

    // Bouton lien vers le site du studio
    const siteY = startY + 104;
    const siteRect = { x: width / 2 - btnW / 2, y: siteY - btnH / 2, w: btnW, h: btnH };
    const redrawSite = (fill) => siteBg.clear()
      .fillStyle(fill, 1).lineStyle(1, UI.success, 0.6)
      .fillRoundedRect(siteRect.x, siteRect.y, siteRect.w, siteRect.h, 12)
      .strokeRoundedRect(siteRect.x, siteRect.y, siteRect.w, siteRect.h, 12);
    const siteBg = this.add.graphics();
    redrawSite(0x1E2E27);
    const siteLabel = this.add.text(width / 2, siteY, "🌐  Studio Website", {
      fontSize: "18px", color: "#7CFFC4", fontStyle: "bold"
    }).setOrigin(0.5);
    const siteHit = this.add.rectangle(width / 2, siteY, btnW, btnH, 0x000000, 0)
      .setInteractive({ useHandCursor: true });

    siteHit.on("pointerover", () => redrawSite(0x27402F));
    siteHit.on("pointerout",  () => redrawSite(0x1E2E27));
    siteHit.on("pointerdown", () => {
      this.sound.play("menu", { volume: gameVolume });
      window.open("https://moi14212869.github.io/onelevel/", "_blank");
    });

    this._tabContainer.add([sectionLabel, creditsBg, creditsLabel, creditsHit, siteBg, siteLabel, siteHit]);
  }

  // ── Bloc compte dynamique ───────────────────────────────
  _buildAccountBlock() {
    const { width } = this.scale;

    if (this._accountContainer) this._accountContainer.destroy();
    this._accountContainer = this.add.container(0, 0);

    const user = getCurrentUser();

    if (user && !user.isAnonymous) {
      // ── Vue connecté (compte email) ──────────────────────
      const pseudo = getPseudo() || "Player";
      const cardY = 360, cardW = 420, cardH = 150;

      const card = this.add.graphics()
        .fillStyle(UI.trackBg, 0.7).lineStyle(1, UI.success, 0.4)
        .fillRoundedRect(width / 2 - cardW / 2, cardY - cardH / 2, cardW, cardH, 14)
        .strokeRoundedRect(width / 2 - cardW / 2, cardY - cardH / 2, cardW, cardH, 14);

      const badge = this.add.text(width / 2, cardY - 48, "✅  LOGGED IN", {
        fontSize: "12px", color: "#7CFFC4", fontStyle: "bold", letterSpacing: 1
      }).setOrigin(0.5);

      const pseudoLabel = this.add.text(width / 2, cardY - 18, pseudo, {
        fontSize: "26px", color: UI.textMain, fontStyle: "bold"
      }).setOrigin(0.5);

      const infoLabel = this.add.text(width / 2, cardY + 12, "Progress saved to the cloud 🌐", {
        fontSize: "14px", color: UI.textFaint
      }).setOrigin(0.5);

      const logoutBtn = this.add.text(width / 2, cardY + 52, "LOG OUT", {
        fontSize: "16px", color: "#ffffff", fontStyle: "bold",
        backgroundColor: "#AA4400", padding: { x: 18, y: 9 }
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      logoutBtn.on("pointerover", () => logoutBtn.setStyle({ backgroundColor: "#CC5500" }));
      logoutBtn.on("pointerout",  () => logoutBtn.setStyle({ backgroundColor: "#AA4400" }));
      logoutBtn.on("pointerdown", async () => {
        this.sound.play("menu", { volume: gameVolume });
        await logout();
        applyPlayerData(DEFAULTS);
        this._buildAccountBlock();
      });

      this._accountContainer.add([card, badge, pseudoLabel, infoLabel, logoutBtn]);

    } else if (user && user.isAnonymous) {
      // ── Vue compte anonyme (pseudo localStorage) ─────────
      const pseudo = getPseudo() || "Player";
      const cardY = 300, cardW = 460, cardH = 158;

      const card = this.add.graphics()
        .fillStyle(UI.trackBg, 0.7).lineStyle(1, UI.cardBorder, 1)
        .fillRoundedRect(width / 2 - cardW / 2, cardY - cardH / 2, cardW, cardH, 14)
        .strokeRoundedRect(width / 2 - cardW / 2, cardY - cardH / 2, cardW, cardH, 14);

      const anonLabel = this.add.text(width / 2, cardY - 52, `👤  ${pseudo}`, {
        fontSize: "22px", color: "#33D6FF", fontStyle: "bold"
      }).setOrigin(0.5);

      const infoLabel = this.add.text(width / 2, cardY - 22, "Progress saved on this device 💾", {
        fontSize: "14px", color: UI.textMuted
      }).setOrigin(0.5);

      const hint = this.add.text(width / 2, cardY + 2, "Create an account to play on multiple devices.", {
        fontSize: "13px", color: UI.textFaint
      }).setOrigin(0.5);

      const linkBtn = this.add.text(width / 2 - 108, cardY + 46, "CREATE ACCOUNT", {
        fontSize: "16px", color: "#ffffff", fontStyle: "bold",
        backgroundColor: "#006633", padding: { x: 14, y: 10 }
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      linkBtn.on("pointerover", () => linkBtn.setStyle({ backgroundColor: "#008844" }));
      linkBtn.on("pointerout",  () => linkBtn.setStyle({ backgroundColor: "#006633" }));
      linkBtn.on("pointerdown", () => {
        this.sound.play("menu", { volume: gameVolume });
        this._showLinkAccountPopup();
      });

      const loginBtn = this.add.text(width / 2 + 108, cardY + 46, "LOG IN", {
        fontSize: "16px", color: "#ffffff", fontStyle: "bold",
        backgroundColor: "#007ACC", padding: { x: 14, y: 10 }
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      loginBtn.on("pointerover", () => loginBtn.setStyle({ backgroundColor: "#0099FF" }));
      loginBtn.on("pointerout",  () => loginBtn.setStyle({ backgroundColor: "#007ACC" }));
      loginBtn.on("pointerdown", () => {
        this.sound.play("menu", { volume: gameVolume });
        this._showLoginPopup();
      });

      this._accountContainer.add([card, anonLabel, infoLabel, hint, linkBtn, loginBtn]);

    } else {
      // ── Vue invité pur (fallback) ─────────────────────────
      const cardY = 300, cardW = 460, cardH = 150;

      const card = this.add.graphics()
        .fillStyle(UI.trackBg, 0.7).lineStyle(1, 0x5A4420, 1)
        .fillRoundedRect(width / 2 - cardW / 2, cardY - cardH / 2, cardW, cardH, 14)
        .strokeRoundedRect(width / 2 - cardW / 2, cardY - cardH / 2, cardW, cardH, 14);

      const guestLabel = this.add.text(width / 2, cardY - 48, "⚠  Guest mode — progress not saved", {
        fontSize: "15px", color: "#FFB454", fontStyle: "bold"
      }).setOrigin(0.5);

      const loginBtn = this.add.text(width / 2 - 108, cardY - 4, "LOG IN", {
        fontSize: "18px", color: "#ffffff", fontStyle: "bold",
        backgroundColor: "#007ACC", padding: { x: 16, y: 10 }
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      loginBtn.on("pointerover", () => loginBtn.setStyle({ backgroundColor: "#0099FF" }));
      loginBtn.on("pointerout",  () => loginBtn.setStyle({ backgroundColor: "#007ACC" }));
      loginBtn.on("pointerdown", () => {
        this.sound.play("menu", { volume: gameVolume });
        this._showLoginPopup();
      });

      const registerBtn = this.add.text(width / 2 + 108, cardY - 4, "SIGN UP", {
        fontSize: "18px", color: "#ffffff", fontStyle: "bold",
        backgroundColor: "#006633", padding: { x: 16, y: 10 }
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      registerBtn.on("pointerover", () => registerBtn.setStyle({ backgroundColor: "#008844" }));
      registerBtn.on("pointerout",  () => registerBtn.setStyle({ backgroundColor: "#006633" }));
      registerBtn.on("pointerdown", () => {
        this.sound.play("menu", { volume: gameVolume });
        this._showRegisterPopup();
      });

      const hint = this.add.text(width / 2, cardY + 44, "Créez un compte pour sauvegarder votre progression\net y accéder depuis n'importe quel appareil.", {
        fontSize: "13px", color: UI.textFaint, align: "center"
      }).setOrigin(0.5);

      this._accountContainer.add([card, guestLabel, loginBtn, registerBtn, hint]);
    }
  }

  // =========================================================
  //  POPUP CONNEXION
  // =========================================================
  _showLoginPopup() {
    const { width, height } = this.scale;
    const cx = width / 2, cy = height / 2;

    const overlay = this.add.rectangle(cx, cy, width, height, 0x000000, 0.75);
    const box     = this.add.rectangle(cx, cy, 460, 340, 0x1a1a2e).setStrokeStyle(2, 0x007ACC);
    const title   = this.add.text(cx, cy - 140, "LOG IN", {
      fontSize: "26px", color: "#007ACC", fontStyle: "bold"
    }).setOrigin(0.5);

    // ── Champ Email ──
    const emailLabel = this.add.text(cx - 190, cy - 100, "E-mail", {
      fontSize: "16px", color: "#aaaaaa"
    });
    const emailBox  = this.add.rectangle(cx, cy - 72, 360, 38, 0x000000).setStrokeStyle(1, 0x555555);
    const emailText = this.add.text(cx - 172, cy - 86, "", { fontSize: "18px", color: "#ffffff" });

    // ── Champ Mot de passe ──
    const pwLabel = this.add.text(cx - 190, cy - 30, "Password", {
      fontSize: "16px", color: "#aaaaaa"
    });
    const pwBox  = this.add.rectangle(cx, cy - 2, 360, 38, 0x000000).setStrokeStyle(1, 0x555555);
    const pwText = this.add.text(cx - 172, cy - 16, "", { fontSize: "18px", color: "#ffffff" });

    // ── Message d'erreur ──
    const errorMsg = this.add.text(cx, cy + 40, "", {
      fontSize: "15px", color: "#ff5555", align: "center"
    }).setOrigin(0.5);

    // ── Boutons ──
    const confirmBtn = this.add.text(cx - 80, cy + 95, "LOG IN", {
      fontSize: "20px", color: "#ffffff",
      backgroundColor: "#007ACC", padding: { x: 18, y: 10 }
    }).setOrigin(0.5).setInteractive();

    const cancelBtn = this.add.text(cx + 90, cy + 95, "CANCEL", {
      fontSize: "20px", color: "#ffffff",
      backgroundColor: "#444444", padding: { x: 18, y: 10 }
    }).setOrigin(0.5).setInteractive();

    const all = [overlay, box, title, emailLabel, emailBox, emailText,
                 pwLabel, pwBox, pwText, errorMsg, confirmBtn, cancelBtn];
    const destroy = () => {
      this.input.keyboard.removeAllListeners();
      all.forEach(o => o.destroy());
    };

    cancelBtn.on("pointerdown", () => { this.sound.play("menu", { volume: gameVolume }); destroy(); });

    // ── Saisie clavier ──
    let emailValue = "", pwValue = "", activeField = "email";

    // Clic pour changer de champ
    emailBox.setInteractive();
    pwBox.setInteractive();
    emailBox.on("pointerdown", () => { activeField = "email"; this._highlightField(emailBox, pwBox); });
    pwBox.on("pointerdown",    () => { activeField = "pw";    this._highlightField(pwBox, emailBox); });
    this._highlightField(emailBox, pwBox); // focus initial sur email

    this.input.keyboard.on("keydown", e => {
      if (e.key === "Tab") {
        activeField = activeField === "email" ? "pw" : "email";
        this._highlightField(
          activeField === "email" ? emailBox : pwBox,
          activeField === "email" ? pwBox    : emailBox
        );
        e.preventDefault?.();
        return;
      }
      if (e.key === "Escape") { destroy(); return; }

      if (activeField === "email") {
        if (e.key === "Backspace") emailValue = emailValue.slice(0, -1);
        else if (e.key.length === 1) emailValue += e.key;
        emailText.setText(emailValue);
      } else {
        if (e.key === "Backspace") pwValue = pwValue.slice(0, -1);
        else if (e.key.length === 1) pwValue += e.key;
        pwText.setText("•".repeat(pwValue.length));
      }

      if (e.key === "Enter") confirmBtn.emit("pointerdown");
    });

    confirmBtn.on("pointerdown", async () => {
      errorMsg.setText("Logging in…").setColor("#aaaaaa");
      try {
        await loginWithEmail(emailValue.trim(), pwValue);
        // Charger la progression depuis Firebase
        const data = await loadPlayerData();
        applyPlayerData(data);
        destroy();
        this._buildAccountBlock();
        this.sound.play("select", { volume: gameVolume });
      } catch (err) {
        errorMsg.setText(firebaseErrorMessage(err.code)).setColor("#ff5555");
      }
    });
  }

  // =========================================================
  //  POPUP INSCRIPTION
  // =========================================================
  _showRegisterPopup() {
    const { width, height } = this.scale;
    const cx = width / 2, cy = height / 2;

    const overlay = this.add.rectangle(cx, cy, width, height, 0x000000, 0.75);
    const box     = this.add.rectangle(cx, cy + 20, 460, 400, 0x1a1a2e).setStrokeStyle(2, 0x006633);
    const title   = this.add.text(cx, cy - 170, "CREATE ACCOUNT", {
      fontSize: "26px", color: "#00BB55", fontStyle: "bold"
    }).setOrigin(0.5);

    // ── Pseudo ──
    const pseudoLabel = this.add.text(cx - 190, cy - 130, "Username", { fontSize: "16px", color: "#aaaaaa" });
    const pseudoBox   = this.add.rectangle(cx, cy - 102, 360, 38, 0x000000).setStrokeStyle(1, 0x555555);
    const pseudoText  = this.add.text(cx - 172, cy - 116, "", { fontSize: "18px", color: "#ffffff" });

    // ── Email ──
    const emailLabel = this.add.text(cx - 190, cy - 58, "E-mail", { fontSize: "16px", color: "#aaaaaa" });
    const emailBox   = this.add.rectangle(cx, cy - 30, 360, 38, 0x000000).setStrokeStyle(1, 0x555555);
    const emailText  = this.add.text(cx - 172, cy - 44, "", { fontSize: "18px", color: "#ffffff" });

    // ── Mot de passe ──
    const pwLabel = this.add.text(cx - 190, cy + 14, "Password (6 chars min.)", { fontSize: "16px", color: "#aaaaaa" });
    const pwBox   = this.add.rectangle(cx, cy + 42, 360, 38, 0x000000).setStrokeStyle(1, 0x555555);
    const pwText  = this.add.text(cx - 172, cy + 28, "", { fontSize: "18px", color: "#ffffff" });

    // ── Message ──
    const errorMsg = this.add.text(cx, cy + 95, "", {
      fontSize: "15px", color: "#ff5555", align: "center", wordWrap: { width: 380 }
    }).setOrigin(0.5);

    // ── Boutons ──
    const confirmBtn = this.add.text(cx - 80, cy + 155, "SIGN UP", {
      fontSize: "20px", color: "#ffffff",
      backgroundColor: "#006633", padding: { x: 18, y: 10 }
    }).setOrigin(0.5).setInteractive();

    const cancelBtn = this.add.text(cx + 90, cy + 155, "CANCEL", {
      fontSize: "20px", color: "#ffffff",
      backgroundColor: "#444444", padding: { x: 18, y: 10 }
    }).setOrigin(0.5).setInteractive();

    const all = [overlay, box, title,
                 pseudoLabel, pseudoBox, pseudoText,
                 emailLabel, emailBox, emailText,
                 pwLabel, pwBox, pwText,
                 errorMsg, confirmBtn, cancelBtn];
    const destroy = () => {
      this.input.keyboard.removeAllListeners();
      all.forEach(o => o.destroy());
    };

    cancelBtn.on("pointerdown", () => { this.sound.play("menu", { volume: gameVolume }); destroy(); });

    // ── Saisie clavier ──
    let pseudoValue = "", emailValue = "", pwValue = "";
    let activeField = "pseudo";
    const fields = ["pseudo", "email", "pw"];

    const boxes  = { pseudo: pseudoBox, email: emailBox, pw: pwBox };
    const others = (active) => fields.filter(f => f !== active).map(f => boxes[f]);

    pseudoBox.setInteractive();
    emailBox.setInteractive();
    pwBox.setInteractive();
    pseudoBox.on("pointerdown", () => { activeField = "pseudo"; this._highlightField(pseudoBox, emailBox, pwBox); });
    emailBox.on("pointerdown",  () => { activeField = "email";  this._highlightField(emailBox, pseudoBox, pwBox); });
    pwBox.on("pointerdown",     () => { activeField = "pw";     this._highlightField(pwBox, pseudoBox, emailBox); });
    this._highlightField(pseudoBox, emailBox, pwBox);

    this.input.keyboard.on("keydown", e => {
      if (e.key === "Tab") {
        const idx = fields.indexOf(activeField);
        activeField = fields[(idx + 1) % fields.length];
        this._highlightField(boxes[activeField], ...others(activeField));
        e.preventDefault?.();
        return;
      }
      if (e.key === "Escape") { destroy(); return; }

      const isBackspace = e.key === "Backspace";
      const isChar      = e.key.length === 1;

      if (activeField === "pseudo") {
        if (isBackspace) pseudoValue = pseudoValue.slice(0, -1);
        else if (isChar && pseudoValue.length < 20) pseudoValue += e.key;
        pseudoText.setText(pseudoValue);
      } else if (activeField === "email") {
        if (isBackspace) emailValue = emailValue.slice(0, -1);
        else if (isChar) emailValue += e.key;
        emailText.setText(emailValue);
      } else {
        if (isBackspace) pwValue = pwValue.slice(0, -1);
        else if (isChar) pwValue += e.key;
        pwText.setText("•".repeat(pwValue.length));
      }

      if (e.key === "Enter") confirmBtn.emit("pointerdown");
    });

    confirmBtn.on("pointerdown", async () => {
      const pseudo = pseudoValue.trim();
      const email  = emailValue.trim();

      if (pseudo.length < 2) {
        errorMsg.setText("Username must be at least 2 characters.").setColor("#ff5555");
        return;
      }

      if (isBadPseudo(pseudo)) {
        errorMsg.setText("This username is not allowed.").setColor("#ff5555");
        return;
      }

      errorMsg.setText("Checking username…").setColor("#aaaaaa");
      confirmBtn.disableInteractive();

      try {
        const taken = await isPseudoTaken(pseudo);
        if (taken) {
          errorMsg.setText("This username is already taken, please choose another.").setColor("#ff5555");
          confirmBtn.setInteractive();
          return;
        }

        errorMsg.setText("Creating account…").setColor("#aaaaaa");
        await registerWithEmail(email, pwValue, pseudo);
        await save.pseudo(pseudo);
        const data = await loadPlayerData();
        applyPlayerData(data);
        destroy();
        this._buildAccountBlock();
        this.sound.play("select", { volume: gameVolume });
      } catch (err) {
        confirmBtn.setInteractive();
        errorMsg.setText(firebaseErrorMessage(err.code)).setColor("#ff5555");
      }
    });
  }

  // =========================================================
  //  POPUP LIER UN COMPTE EMAIL (compte anonyme → email)
  // =========================================================
  _showLinkAccountPopup() {
    const { width, height } = this.scale;
    const cx = width / 2, cy = height / 2;

    const overlay = this.add.rectangle(cx, cy, width, height, 0x000000, 0.75);
    const box     = this.add.rectangle(cx, cy + 20, 460, 420, 0x1a1a2e).setStrokeStyle(2, 0x00BB55);
    const title   = this.add.text(cx, cy - 178, "CREATE ACCOUNT", {
      fontSize: "26px", color: "#00BB55", fontStyle: "bold"
    }).setOrigin(0.5);
    const subtitle = this.add.text(cx, cy - 148, "Your progress will be kept ✅", {
      fontSize: "15px", color: "#88ff88"
    }).setOrigin(0.5);

    const savedPseudo = localStorage.getItem("jumpix_pseudo") || "";
    const pseudoLabel = this.add.text(cx - 190, cy - 115, "Username", { fontSize: "16px", color: "#aaaaaa" });
    const pseudoBox   = this.add.rectangle(cx, cy - 88, 360, 38, 0x000000).setStrokeStyle(1, 0x555555);
    const pseudoText  = this.add.text(cx - 172, cy - 102, savedPseudo, { fontSize: "18px", color: "#ffffff" });

    const emailLabel = this.add.text(cx - 190, cy - 44, "E-mail", { fontSize: "16px", color: "#aaaaaa" });
    const emailBox   = this.add.rectangle(cx, cy - 16, 360, 38, 0x000000).setStrokeStyle(1, 0x555555);
    const emailText  = this.add.text(cx - 172, cy - 30, "", { fontSize: "18px", color: "#ffffff" });

    const pwLabel = this.add.text(cx - 190, cy + 28, "Password (6 chars min.)", { fontSize: "16px", color: "#aaaaaa" });
    const pwBox   = this.add.rectangle(cx, cy + 56, 360, 38, 0x000000).setStrokeStyle(1, 0x555555);
    const pwText  = this.add.text(cx - 172, cy + 42, "", { fontSize: "18px", color: "#ffffff" });

    const errorMsg = this.add.text(cx, cy + 108, "", {
      fontSize: "15px", color: "#ff5555", align: "center", wordWrap: { width: 380 }
    }).setOrigin(0.5);

    const confirmBtn = this.add.text(cx - 80, cy + 165, "CREATE", {
      fontSize: "20px", color: "#ffffff",
      backgroundColor: "#006633", padding: { x: 18, y: 10 }
    }).setOrigin(0.5).setInteractive();

    const cancelBtn = this.add.text(cx + 90, cy + 165, "CANCEL", {
      fontSize: "20px", color: "#ffffff",
      backgroundColor: "#444444", padding: { x: 18, y: 10 }
    }).setOrigin(0.5).setInteractive();

    const all = [overlay, box, title, subtitle,
                 pseudoLabel, pseudoBox, pseudoText,
                 emailLabel, emailBox, emailText,
                 pwLabel, pwBox, pwText,
                 errorMsg, confirmBtn, cancelBtn];
    const destroy = () => {
      this.input.keyboard.removeAllListeners();
      all.forEach(o => o.destroy());
    };

    cancelBtn.on("pointerdown", () => { this.sound.play("menu", { volume: gameVolume }); destroy(); });

    let pseudoValue = savedPseudo, emailValue = "", pwValue = "";
    let activeField = savedPseudo ? "email" : "pseudo";
    const fields = ["pseudo", "email", "pw"];
    const boxes  = { pseudo: pseudoBox, email: emailBox, pw: pwBox };

    pseudoBox.setInteractive();
    emailBox.setInteractive();
    pwBox.setInteractive();
    pseudoBox.on("pointerdown", () => { activeField = "pseudo"; this._highlightField(pseudoBox, emailBox, pwBox); });
    emailBox.on("pointerdown",  () => { activeField = "email";  this._highlightField(emailBox, pseudoBox, pwBox); });
    pwBox.on("pointerdown",     () => { activeField = "pw";     this._highlightField(pwBox, pseudoBox, emailBox); });
    this._highlightField(boxes[activeField], ...fields.filter(f => f !== activeField).map(f => boxes[f]));

    this.input.keyboard.on("keydown", e => {
      if (e.key === "Tab") {
        const idx = fields.indexOf(activeField);
        activeField = fields[(idx + 1) % fields.length];
        this._highlightField(boxes[activeField], ...fields.filter(f => f !== activeField).map(f => boxes[f]));
        e.preventDefault?.();
        return;
      }
      if (e.key === "Escape") { destroy(); return; }

      if (activeField === "pseudo") {
        if (e.key === "Backspace") pseudoValue = pseudoValue.slice(0, -1);
        else if (e.key.length === 1 && pseudoValue.length < 20) pseudoValue += e.key;
        pseudoText.setText(pseudoValue);
      } else if (activeField === "email") {
        if (e.key === "Backspace") emailValue = emailValue.slice(0, -1);
        else if (e.key.length === 1) emailValue += e.key;
        emailText.setText(emailValue);
      } else {
        if (e.key === "Backspace") pwValue = pwValue.slice(0, -1);
        else if (e.key.length === 1) pwValue += e.key;
        pwText.setText("•".repeat(pwValue.length));
      }
      if (e.key === "Enter") confirmBtn.emit("pointerdown");
    });

    confirmBtn.on("pointerdown", async () => {
      const pseudo = pseudoValue.trim();
      const email  = emailValue.trim();

      if (pseudo.length < 2) {
        errorMsg.setText("Username must be at least 2 characters.").setColor("#ff5555");
        return;
      }
      if (isBadPseudo(pseudo)) {
        errorMsg.setText("This username is not allowed.").setColor("#ff5555");
        return;
      }

      errorMsg.setText("Checking username…").setColor("#aaaaaa");
      confirmBtn.disableInteractive();

      try {
        const taken = await isPseudoTaken(pseudo);
        if (taken) {
          errorMsg.setText("This username is already taken, please choose another.").setColor("#ff5555");
          confirmBtn.setInteractive();
          return;
        }

        errorMsg.setText("Creating account…").setColor("#aaaaaa");
        await linkGuestToEmail(email, pwValue, pseudo);
        localStorage.setItem("jumpix_pseudo", pseudo);
        await save.pseudo(pseudo);
        // Met à jour les entrées de classement existantes : tant que le
        // compte était anonyme, elles avaient pu être enregistrées avec
        // "Anonyme" comme pseudo (cf. saveLeaderboard avant correctif).
        await updateLeaderboardPseudo(pseudo);
        const data = await loadPlayerData();
        applyPlayerData(data);
        destroy();
        this._buildAccountBlock();
        this.sound.play("select", { volume: gameVolume });
      } catch (err) {
        confirmBtn.setInteractive();
        if (err.code === "auth/email-already-in-use") {
          errorMsg.setText("This email is already in use. Please log in instead.").setColor("#ff5555");
        } else {
          errorMsg.setText(firebaseErrorMessage(err.code)).setColor("#ff5555");
        }
      }
    });
  }

  // ── Utilitaire : highlight du champ actif ───────────────
  _highlightField(active, ...inactives) {
    active.setStrokeStyle(2, 0x00BFFF);
    inactives.forEach(b => b.setStrokeStyle(1, 0x555555));
  }

  // ── Reset compte ────────────────────────────────────────
  _showResetConfirm() {
    const { width, height } = this.scale;
    const cx = width / 2, cy = height / 2;

    const overlay = this.add.rectangle(cx, cy, width, height, 0x000000, 0.6);
    const box     = this.add.rectangle(cx, cy, 380, 190, 0x222222).setStrokeStyle(3, 0xffffff);
    const txt     = this.add.text(cx, cy - 50, "Reset all progress?\nThis cannot be undone!", {
      fontSize: "20px", color: "#ffffff", align: "center"
    }).setOrigin(0.5);

    const yes = this.add.text(cx - 60, cy + 45, "YES", {
      fontSize: "22px", backgroundColor: "#FF4444", padding: { x: 15, y: 8 }
    }).setOrigin(0.5).setInteractive();

    const no = this.add.text(cx + 60, cy + 45, "NO", {
      fontSize: "22px", backgroundColor: "#00BFFF", padding: { x: 15, y: 8 }
    }).setOrigin(0.5).setInteractive();

    no.on("pointerdown", () => [overlay, box, txt, yes, no].forEach(o => o.destroy()));
    yes.on("pointerdown", async () => {
      await resetAccount();
      applyPlayerData(DEFAULTS);
      this.scene.start("MenuScene");
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

    // ── Fond assorti au thème des Settings ───────────────────
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0A101C, 0x0A101C, 0x141C30, 0x141C30, 1);
    bg.fillRect(0, 0, width, height);
    bg.setDepth(-20);

    const glow = this.add.graphics();
    glow.fillStyle(0x00BFFF, 0.06);
    glow.fillCircle(width / 2, height / 2, width * 0.6);
    glow.setDepth(-19);

    // ── Contenu défilant, avec des types pour varier le style ──
    const L = (text, type = "name") => ({ text, type });
    const credits = [
      L("CREDITS", "title"),
      L("", "space"),
      L("A game by", "header"),
      L("OneLevel Studio", "studio"),
      L("", "gap"),

      L("Producer & Lead Programmer", "header"),
      L("Eliott MORBIDELLI", "name"),
      L("", "gap"),

      L("Visual Designer", "header"),
      L("Leonie MORBIDELLI", "name"),
      L("", "gap"),

      L("Lead Level Designer", "header"),
      L("Eliott MORBIDELLI", "name"),
      L("", "gap"),

      L("Level Designers", "header"),
      L("A. MORBIDELLI", "name"),
      L("Alix MORBIDELLI", "name"),
      L("", "gap"),

      L("QA Testers", "header"),
      L("Maxence ROOS", "name"),
      L("", "gap"),

      L("Communication", "header"),
      L("Théodore_68", "name"),
      L("", "gap"),

      L("Sound", "header"),
      L("Music :", "small"),
      L("\"8bit Music for Game\"", "smallItalic"),
      L("freesound_community", "small"),
      L("", "space"),

      L("Thanks for playing! 💙", "thanks"),
      L("", "gap"),
      L("For Inna", "dedication"),
    ];

    const STYLES = {
      title:       { fontSize: "40px", color: "#F2F5FA", fontStyle: "bold",   h: 60, letterSpacing: 3 },
      header:      { fontSize: "14px", color: "#8592A8", fontStyle: "bold",   h: 30, letterSpacing: 2 },
      studio:      { fontSize: "26px", color: "#33D6FF", fontStyle: "bold",   h: 50 },
      name:        { fontSize: "24px", color: "#F2F5FA", fontStyle: "normal", h: 44 },
      small:       { fontSize: "16px", color: "#5D6980", fontStyle: "normal", h: 26 },
      smallItalic: { fontSize: "16px", color: "#8592A8", fontStyle: "italic", h: 26 },
      thanks:      { fontSize: "26px", color: "#00D68A", fontStyle: "bold",   h: 46 },
      dedication:  { fontSize: "18px", color: "#8592A8", fontStyle: "italic", h: 40 },
      space:       { h: 24 },
      gap:         { h: 10 },
    };

    this.creditContainer = this.add.container(width / 2, height + 50);
    let offsetY = 0;
    credits.forEach(({ text, type }) => {
      const s = STYLES[type];
      if (text) {
        const t = this.add.text(0, offsetY, text, {
          fontSize: s.fontSize, color: s.color, fontStyle: s.fontStyle,
          letterSpacing: s.letterSpacing ?? 0, align: "center"
        }).setOrigin(0.5);
        this.creditContainer.add(t);
        if (type === "header") {
          // petite ligne d'accent sous les titres de section
          const uw = t.width + 20;
          this.creditContainer.add(this.add.rectangle(0, offsetY + 18, uw, 1, 0x27344A));
        }
      }
      offsetY += s.h;
    });

    // ── Fondus haut/bas pour masquer l'entrée/sortie du défilement ──
    const fadeH = 90;
    const topFade = this.add.graphics().setDepth(5);
    topFade.fillGradientStyle(0x0A101C, 0x0A101C, 0x0A101C, 0x0A101C, 1, 1, 0, 0);
    topFade.fillRect(0, 0, width, fadeH);
    const bottomFade = this.add.graphics().setDepth(5);
    bottomFade.fillGradientStyle(0x0A101C, 0x0A101C, 0x0A101C, 0x0A101C, 0, 0, 1, 1);
    bottomFade.fillRect(0, height - fadeH, width, fadeH);

    // ── Indication discrète ──────────────────────────────────
    this.add.text(width / 2, height - 22, "tap to skip", {
      fontSize: "13px", color: "#5D6980"
    }).setOrigin(0.5).setDepth(6);

    this.scrollSpeed = 50;
    this.input.once("pointerdown", () => {
      this.sound.play("menu", { volume: gv });
      this.scene.start("SettingsScene");
    });
  }

  update(time, delta) {
    this.creditContainer.y -= this.scrollSpeed * (delta / 1000);
    const last = this.creditContainer.list[this.creditContainer.list.length - 1];
    if (last.y + this.creditContainer.y < -50) this.scene.start("SettingsScene");
  }
}

// =========================================================
//                       STATS SCENE
// =========================================================

const STATS_ALL_LEVELS = [
  "Level1","Level2","Level3","Level4","Level5",
  "Level6","Level7","Level8","Level9","Level10","Level11","Level12",
  "Level13","Level14","Level15","Level16"
];

export class Stats extends Phaser.Scene {
  constructor() { super("Stats"); }

  async create() {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x3d2505);
    this.add.text(width / 2, 32, "STATISTICS", {
      fontSize: "36px", color: "#ffffff", fontStyle: "bold"
    }).setOrigin(0.5);

    let pd;
    try {
      pd = await loadPlayerData();
    } catch {
      pd = { playerCoins: 0, dead: 0, kill: 0, party: 0 };
    }

    // ── Stats générales (2 colonnes) ────────────────────────
    const statsData = [
      { label: "Coins 💰",          value: pd.playerCoins ?? 0 },
      { label: "Deaths ☠️",         value: pd.dead        ?? 0 },
      { label: "Kills 🔪",          value: pd.kill        ?? 0 },
      { label: "Parties Played 🎮", value: pd.party       ?? 0 }
    ];

    const col1X = width / 4, col2X = width * 3 / 4;
    const statStartY = 90;
    statsData.forEach((stat, i) => {
      const x = i % 2 === 0 ? col1X : col2X;
      const y = statStartY + Math.floor(i / 2) * 52;
      this.add.text(x, y,      stat.label,        { fontSize: "18px", color: "#aaaaaa" }).setOrigin(0.5);
      this.add.text(x, y + 22, String(stat.value), { fontSize: "22px", color: "#ffff00", fontStyle: "bold" }).setOrigin(0.5);
    });

    // ── Séparateur + badge compte ────────────────────────────
    this.add.rectangle(width / 2, 202, width - 40, 1, 0x555555);
    const badge = isLoggedIn()
      ? `🌐 Logged in: ${getPseudo()}`
      : "👤 Guest mode — progress not saved";
    this.add.text(width / 2, 214, badge, {
      fontSize: "14px", color: isLoggedIn() ? "#88ff88" : "#ffaa44"
    }).setOrigin(0.5);

    // ── Meilleurs rangs atteints ─────────────────────────────
    this.add.text(width / 2, 238, "🏆 Best ranks achieved", {
      fontSize: "18px", color: "#FFD700", fontStyle: "bold"
    }).setOrigin(0.5);

    if (!isLoggedIn()) {
      this.add.text(width / 2, 268, "Log in to record your ranks.", {
        fontSize: "14px", color: "#888888"
      }).setOrigin(0.5);
    } else {
      const ranks      = pd.bestRanks ?? {};
      const colCount   = 3;
      const colW       = Math.floor((width - 40) / colCount);
      const rowH       = 42;
      const gridStartY = 262;

      STATS_ALL_LEVELS.forEach((lvl, i) => {
        const col = i % colCount;
        const row = Math.floor(i / colCount);
        const cx  = 20 + col * colW + colW / 2;
        const cy  = gridStartY + row * rowH;

        const rank      = ranks[lvl];
        const rankStr   = rank === undefined ? "–"
                        : rank === 1 ? "🥇 #1"
                        : rank === 2 ? "🥈 #2"
                        : rank === 3 ? "🥉 #3"
                        : `#${rank}`;
        const rankColor = rank === undefined ? "#555555"
                        : rank <= 3  ? "#FFD700"
                        : rank <= 10 ? "#00FF99"
                        : "#ffffff";

        this.add.text(cx, cy,      lvl.replace("Level", "Lvl "), { fontSize: "13px", color: "#666666" }).setOrigin(0.5);
        this.add.text(cx, cy + 16, rankStr, { fontSize: "15px", color: rankColor, fontStyle: "bold" }).setOrigin(0.5);
      });
    }

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

  async create() {
    const { width } = this.scale;

    let pd;
    try {
      pd = await loadPlayerData();
    } catch {
      pd = {};
    }

    await checkObjectives(pd);

    this.add.text(width / 2, 60, "OBJECTIVES", { fontSize: "40px", color: "#ffffff" }).setOrigin(0.5);

    const objectives = [
      { label: "☠️ Die 1000 times",      progress: pd.dead  ?? 0, goal: 1000, skin: "000000", color: 0x000000 },
      { label: "🔪 Make 500 kills",       progress: pd.kill  ?? 0, goal:  500, skin: "FF0000", color: 0xFF0000 },
      { label: "🎮 Complete 1000 levels", progress: pd.party ?? 0, goal: 1000, skin: "A0522D", color: 0xA0522D },
      { label: "🔗 Create an account",    progress: null,           goal: null, skin: "7E7D82", color: 0x7E7D82 }
    ];

    let y = 150;
    objectives.forEach(obj => {
      const unlocked = !!(pd.skins && pd.skins[obj.skin]);

      this.add.text(100, y, obj.label, { fontSize: "22px", color: "#ffffff" });

      if (obj.goal !== null) {
        // Objectif à progression
        const percent = Math.min(obj.progress / obj.goal, 1);
        this.add.rectangle(100, y + 30, 300, 12, 0x444444).setOrigin(0);
        this.add.rectangle(100, y + 30, 300 * percent, 12, unlocked ? 0x00FF66 : 0xFFD700).setOrigin(0);
        this.add.text(420, y + 20, `${obj.progress}/${obj.goal}`, { fontSize: "18px", color: "#ffffff" });
      } else {
        // Objectif binaire (créer un compte)
        const statusTxt = unlocked ? "✅ Completed!" : "➡ Sign in or create an account";
        this.add.text(100, y + 28, statusTxt, {
          fontSize: "16px", color: unlocked ? "#00FF66" : "#aaaaaa"
        });
      }

      this.add.rectangle(600, y + 20, 40, 40, obj.color);

      if (unlocked) {
        const currentColor = pd.colorPlayer ?? colorPlayer;
        const isSelected   = currentColor === obj.color;
        const select = this.add.text(660, y + 10, isSelected ? "Selected" : "Select", {
          fontSize: "18px", color: isSelected ? "#00FF66" : "#ffffff",
          backgroundColor: "#ADD8E6", padding: { x: 10, y: 5 }
        }).setInteractive();

        select.on("pointerdown", async () => {
          this.sound.play("select", { volume: gameVolume });
          setColorPlayer(obj.color);
          pd.colorPlayer = obj.color;
          await save.color(obj.color);
          await updateLeaderboardColor(obj.color);
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

// =========================================================
//                   LEADERBOARD SCENE
// =========================================================

const ALL_LEVELS = [
  "Level1","Level2","Level3","Level4","Level5",
  "Level6","Level7","Level8","Level9","Level10","Level11","Level12",
  "Level13","Level14","Level15","Level16"
];

export class LeaderboardScene extends Phaser.Scene {
  constructor() { super("LeaderboardScene"); }

  init() {
    this.currentTab = 0;   // index dans ALL_LEVELS
    this.entries    = [];  // données chargées pour l'onglet actif
    this.loading    = true;
  }

  create() {
    const { width, height } = this.scale;

    // ── Fond ──
    this.add.rectangle(width / 2, height / 2, width, height, 0x0a0a1a);

    // ── Titre ──
    this.add.text(width / 2, 28, "🏆 LEADERBOARD", {
      fontSize: "34px", color: "#FFD700", fontStyle: "bold"
    }).setOrigin(0.5);

    // ── Retour ──
    this.add.text(10, 10, "←", {
      fontSize: "24px", color: "#ffffff",
      backgroundColor: "#00BFFF", padding: { x: 7, y: 4 }
    }).setInteractive().on("pointerdown", () => {
      this.sound.play("menu", { volume: gameVolume });
      this.scene.start("MenuScene");
    });

    // ── Onglets ──
    this.tabObjects = [];
    this._buildTabs();

    // ── Zone liste (conteneur scrollable) ──
    this.listContainer = this.add.container(0, 0);

    //scroll
    this.scrollY = 0;
this.maxScroll = 0;

this.input.on("wheel", (_, __, ___, deltaY) => {
  this._scrollLeaderboard(-deltaY);
});

this.input.on("pointermove", pointer => {
  if (pointer.isDown) {
    this._scrollLeaderboard(pointer.velocity.y * 0.02);
  }
});

    // ── Charger le premier onglet ──
    this._loadTab(0);
  }
    _scrollLeaderboard(delta) {
  if (!this.listContainer) return;

  this.scrollY += delta;
  this.scrollY = Phaser.Math.Clamp(this.scrollY, -this.maxScroll, 0);

  this.listContainer.y = this.scrollY;
}
  // ── Construction des onglets niveaux ──────────────────────
  _buildTabs() {
    const { width } = this.scale;
    const tabW  = Math.floor((width - 20) / ALL_LEVELS.length);
    const tabY  = 65;

    this.tabObjects.forEach(o => o.destroy());
    this.tabObjects = [];

    ALL_LEVELS.forEach((lvl, i) => {
      const x      = 10 + i * tabW + tabW / 2;
      const active = i === this.currentTab;

      const bg = this.add.rectangle(x, tabY, tabW - 4, 28,
        active ? 0x00BFFF : 0x223344
      ).setInteractive();

      // Avec 16 onglets, les libellés doivent rester compacts pour tenir dans la largeur.
      const label = this.add.text(x, tabY, lvl.replace("Level", ""), {
        fontSize: "13px", color: active ? "#000000" : "#aaaaaa", fontStyle: active ? "bold" : "normal"
      }).setOrigin(0.5);

      bg.on("pointerdown", () => {
        if (i !== this.currentTab) {
          this.currentTab = i;
          this._buildTabs();
          this._loadTab(i);
        }
      });
      bg.on("pointerover",  () => { if (i !== this.currentTab) bg.setFillStyle(0x335566); });
      bg.on("pointerout",   () => { if (i !== this.currentTab) bg.setFillStyle(0x223344); });

      this.tabObjects.push(bg, label);
    });
  }

  // ── Chargement + affichage d'un onglet ────────────────────
  async _loadTab(index) {
    const { width } = this.scale;

    // Vider la liste
    this.listContainer.removeAll(true);
    this.scrollY = 0;
    this.listContainer.y = 0;
    // Indicateur de chargement
    const loadTxt = this.add.text(width / 2, 300, "Loading...", {
      fontSize: "22px", color: "#888888"
    }).setOrigin(0.5);
    this.listContainer.add(loadTxt);

    try {
      const entries = await loadLeaderboard(ALL_LEVELS[index]);
      this.listContainer.removeAll(true);

      if (entries.length === 0) {
        this.listContainer.add(
          this.add.text(width / 2, 300, "No times recorded", {
            fontSize: "20px", color: "#666666"
          }).setOrigin(0.5)
        );
        return;
      }

      // En-tête colonnes
      const headerY = 105;
      this.listContainer.add([
        this.add.text(55,        headerY, "#",      { fontSize: "14px", color: "#888888" }).setOrigin(0.5),
        this.add.text(110,       headerY, "Skin",   { fontSize: "14px", color: "#888888" }).setOrigin(0.5),
        this.add.text(310,       headerY, "Player", { fontSize: "14px", color: "#888888" }).setOrigin(0, 0.5),
        this.add.text(width - 20, headerY, "Time", { fontSize: "14px", color: "#888888" }).setOrigin(1, 0.5),
      ]);
      this.add.rectangle(width / 2, headerY + 16, width - 20, 1, 0x333333);

      const rowH   = 44;
      const startY = 135;
      const myUid  = getCurrentUser()?.uid ?? null;

      entries.forEach((entry, i) => {
        const y      = startY + i * rowH;
        const isMe   = entry.uid === myUid;
        const rowCol = isMe ? "#FFD700" : (i % 2 === 0 ? "#ffffff" : "#cccccc");
        const bgCol  = isMe ? 0x2a2000 : (i % 2 === 0 ? 0x111122 : 0x0d0d1a);

        // Fond de ligne (cliquable → ouvre les stats du joueur)
        const rowBg = this.add.rectangle(width / 2, y + rowH / 2, width, rowH, bgCol)
          .setInteractive({ useHandCursor: true });
        rowBg.on("pointerover", () => rowBg.setFillStyle(isMe ? 0x3a2a00 : 0x223344));
        rowBg.on("pointerout",  () => rowBg.setFillStyle(bgCol));
        rowBg.on("pointerdown", () => {
          this.sound.play("select", { volume: gameVolume });
          this._showPlayerStatsPopup(entry);
        });
        this.listContainer.add(rowBg);

        // Rang
        const rankStr  = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
        const rankSize = i < 3 ? "20px" : "16px";
        this.listContainer.add(
          this.add.text(55, y + rowH / 2, rankStr, { fontSize: rankSize, color: rowCol }).setOrigin(0.5)
        );

        // Skin (petit carré coloré)
        const skinColor = typeof entry.colorPlayer === "number"
          ? entry.colorPlayer : parseInt(entry.colorPlayer) || 0xAA66CC;
        this.listContainer.add(
          this.add.rectangle(110, y + rowH / 2, 28, 28, skinColor)
        );

        // Pseudo
        const pseudo = entry.pseudo || "Anonymous";
        this.listContainer.add(
          this.add.text(140, y + rowH / 2, pseudo, {
            fontSize: "18px", color: isMe ? "#FFD700" : rowCol, fontStyle: isMe ? "bold" : "normal"
          }).setOrigin(0, 0.5)
        );

        // Temps
        const secs = (entry.timeMs / 1000).toFixed(2) + "s";
        this.listContainer.add(
          this.add.text(width - 20, y + rowH / 2, secs, {
            fontSize: "18px", color: i === 0 ? "#FFD700" : rowCol
          }).setOrigin(1, 0.5)
        );
      });
const contentHeight = startY + entries.length * rowH;
const visibleHeight = this.scale.height - 140;

this.maxScroll = Math.max(0, contentHeight - visibleHeight);
this.scrollY = 0;
this.listContainer.y = 0;
    } catch (err) {
      this.listContainer.removeAll(true);
      this.listContainer.add(
        this.add.text(width / 2, 300, "Loading error", {
          fontSize: "20px", color: "#ff4444"
        }).setOrigin(0.5)
      );
      console.error("Leaderboard error:", err);
    }
  }

  // ── Popup stats d'un joueur (clic sur une ligne) ──────────
  async _showPlayerStatsPopup(entry) {
    const { width, height } = this.scale;

    // Overlay + boîte
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
      .setInteractive();
    const box = this.add.rectangle(width / 2, height / 2, width - 60, 380, 0x1a1a2a)
      .setStrokeStyle(3, 0xFFD700);

    const closeBtn = this.add.text(width / 2 + (width - 60) / 2 - 24, height / 2 - 190 + 16, "✕", {
      fontSize: "22px", color: "#ffffff",
      backgroundColor: "#00BFFF", padding: { x: 8, y: 4 }
    }).setOrigin(0.5).setInteractive();

    const elements = [overlay, box, closeBtn];

    const skinColor = typeof entry.colorPlayer === "number"
      ? entry.colorPlayer : parseInt(entry.colorPlayer) || 0xAA66CC;

    elements.push(
      this.add.rectangle(width / 2 - 80, height / 2 - 160, 30, 30, skinColor)
    );
    elements.push(
      this.add.text(width / 2 - 50, height / 2 - 160, entry.pseudo || "Anonymous", {
        fontSize: "26px", color: "#FFD700", fontStyle: "bold"
      }).setOrigin(0, 0.5)
    );

    const loadTxt = this.add.text(width / 2, height / 2 - 90, "Loading...", {
      fontSize: "18px", color: "#888888"
    }).setOrigin(0.5);
    elements.push(loadTxt);

    closeBtn.on("pointerdown", () => {
      this.sound.play("menu", { volume: gameVolume });
      elements.forEach(o => o.destroy());
    });
    overlay.on("pointerdown", () => {
      this.sound.play("menu", { volume: gameVolume });
      elements.forEach(o => o.destroy());
    });

    try {
      const pd = await loadPublicPlayerStats(entry.uid);
      loadTxt.destroy();

      // ── Stats générales (mêmes que la scène Statistics) ──
      const statsData = [
        { label: "Coins 💰",          value: pd.playerCoins ?? 0 },
        { label: "Deaths ☠️",         value: pd.dead        ?? 0 },
        { label: "Kills 🔪",          value: pd.kill        ?? 0 },
        { label: "Parties Played 🎮", value: pd.party       ?? 0 }
      ];

      const col1X = width / 2 - 90, col2X = width / 2 + 90;
      const statStartY = height / 2 - 110;
      const statRowH   = 58;
      statsData.forEach((stat, i) => {
        const x = i % 2 === 0 ? col1X : col2X;
        const y = statStartY + Math.floor(i / 2) * statRowH;
        elements.push(
          this.add.text(x, y,      stat.label,        { fontSize: "16px", color: "#aaaaaa" }).setOrigin(0.5),
          this.add.text(x, y + 22, String(stat.value), { fontSize: "20px", color: "#ffff00", fontStyle: "bold" }).setOrigin(0.5)
        );
      });

      // ── Séparateur + meilleurs rangs ──
      const statsBottom = statStartY + statRowH + 30; // bas de la 2e rangée de stats
      const sepY = statsBottom + 14;
      elements.push(this.add.rectangle(width / 2, sepY, width - 100, 1, 0x555555));
      elements.push(
        this.add.text(width / 2, sepY + 26, "🏆 Best ranks achieved", {
          fontSize: "16px", color: "#FFD700", fontStyle: "bold"
        }).setOrigin(0.5)
      );

      const ranks      = pd.bestRanks ?? {};
      const colCount   = 5;
      const colW       = Math.floor((width - 100) / colCount);
      const rowH2      = 38;
      const gridStartY = sepY + 56;

      ALL_LEVELS.forEach((lvl, i) => {
        const col = i % colCount;
        const row = Math.floor(i / colCount);
        const cx  = 50 + col * colW + colW / 2;
        const cy  = gridStartY + row * rowH2;

        const rank      = ranks[lvl];
        const rankStr   = rank === undefined ? "–"
                        : rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉"
                        : `#${rank}`;
        const rankColor = rank === undefined ? "#555555"
                        : rank <= 3  ? "#FFD700"
                        : rank <= 10 ? "#00FF99"
                        : "#ffffff";

        elements.push(
          this.add.text(cx, cy,      lvl.replace("Level", "Lvl "), { fontSize: "11px", color: "#666666" }).setOrigin(0.5),
          this.add.text(cx, cy + 14, rankStr, { fontSize: "14px", color: rankColor, fontStyle: "bold" }).setOrigin(0.5)
        );
      });
    } catch (err) {
      loadTxt.setText("Loading error");
      loadTxt.setColor("#ff4444");
      console.error("Player stats error:", err);
    }
  }
}
