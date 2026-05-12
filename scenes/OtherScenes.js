// =========================================================
//                     SETTINGS SCENE
// =========================================================

import {
  gameVolume, keyboardLayout, colorPlayer,
  setGameVolume, setKeyboardLayout,
  setPlayerCoins, setDead, setKill, setParty, setColorPlayer,
  applyPlayerData
} from "../globals.js";
import { hashText }    from "../utils/helpers.js";
import { openDevMenu } from "../utils/devMenu.js";
import { DEV_PASSWORD_HASH } from "../globals.js";
import { save, resetAccount, loadPlayerData, isLoggedIn, getPseudo, DEFAULTS, updateLeaderboardColor, loadLeaderboard,
  sendFriendRequest, acceptFriendRequest, declineFriendRequest, removeFriend,
  loadFriendProfile, setBlockFriendRequests, getBlockFriendRequests, findPlayerByPseudo
} from "../utils/db.js";
import {
  registerWithEmail, loginWithEmail, logout, firebaseErrorMessage, getCurrentUser
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

export class SettingsScene extends Phaser.Scene {
  constructor() { super("SettingsScene"); }

  create() {
    const { width } = this.scale;

    this.add.text(width / 2, 36, "Settings", {
      fontSize: "36px", color: "#ffffff"
    }).setOrigin(0.5);

    // ── Onglets ─────────────────────────────────────────────
    const TABS = ["Général", "Gameplay"];
    this._activeTab = 0;
    this._tabContainer = null;

    const TAB_Y = 75;
    const TAB_W = 160, TAB_H = 34;
    const totalTabW = TABS.length * TAB_W + (TABS.length - 1) * 8;
    const tabStartX = width / 2 - totalTabW / 2;

    this._tabBgs = [];
    this._tabLabels = [];

    TABS.forEach((label, i) => {
      const tx = tabStartX + i * (TAB_W + 8) + TAB_W / 2;
      const bg = this.add.rectangle(tx, TAB_Y, TAB_W, TAB_H, 0x223344)
        .setStrokeStyle(1, 0x00BFFF).setInteractive();
      const txt = this.add.text(tx, TAB_Y, label, {
        fontSize: "17px", color: "#aaaaaa"
      }).setOrigin(0.5);

      bg.on("pointerover",  () => { if (i !== this._activeTab) bg.setFillStyle(0x335566); });
      bg.on("pointerout",   () => { if (i !== this._activeTab) bg.setFillStyle(0x223344); });
      bg.on("pointerdown",  () => {
        if (i === this._activeTab) return;
        this.sound.play("menu", { volume: gameVolume });
        this._activeTab = i;
        this._refreshTabs();
        this._buildTabContent();
      });

      this._tabBgs.push(bg);
      this._tabLabels.push(txt);
    });

    // ── Ligne sous les onglets ───────────────────────────────
    this.add.rectangle(width / 2, TAB_Y + TAB_H / 2 + 1, width - 40, 1, 0x444444);

    // ── Contenu dynamique ────────────────────────────────────
    this._tabContainer = this.add.container(0, 0);
    this._refreshTabs();
    this._buildTabContent();

    // ── Bloc compte (commun aux deux onglets) ────────────────
    this._buildAccountBlock();

    // ── Toggle blocage demandes d'ami ───────────────────────
    if (isLoggedIn()) {
      const blockBtn = this.add.text(400, 455, "\uD83D\uDD13 Demandes d'ami : autoris\u00e9es", {
        fontSize: "15px", color: "#ffffff",
        backgroundColor: "#226622", padding: { x: 14, y: 6 }
      }).setOrigin(0.5).setInteractive();

      let blockActive = false;

      const updateBlockBtn = () => {
        blockBtn.setText(blockActive
          ? "\uD83D\uDD12 Demandes d'ami : bloqu\u00e9es"
          : "\uD83D\uDD13 Demandes d'ami : autoris\u00e9es");
        blockBtn.setStyle({ backgroundColor: blockActive ? "#882222" : "#226622" });
      };

      getBlockFriendRequests().then(val => {
        blockActive = val;
        updateBlockBtn();
      });

      blockBtn.on("pointerdown", async () => {
        blockActive = !blockActive;
        updateBlockBtn();
        await setBlockFriendRequests(blockActive);
      });
    }

    const resetBtn = this.add.text(220, 530, "RESET ACCOUNT", {
      fontSize: "18px", color: "#ffffff",
      backgroundColor: "#FF4444", padding: { x: 14, y: 8 }
    }).setOrigin(0.5).setInteractive();
    resetBtn.on("pointerdown", () => {
      this.sound.play("menu", { volume: gameVolume });
      this._showResetConfirm();
    });

    const devBtn = this.add.text(580, 530, "DEV MENU", {
      fontSize: "18px", color: "#ffffff",
      backgroundColor: "#4444AA", padding: { x: 14, y: 8 }
    }).setOrigin(0.5).setInteractive();
    devBtn.on("pointerdown", () => {
      this.sound.play("menu", { volume: gameVolume });
      this._showPasswordPopup();
    });

    // ── Retour ──────────────────────────────────────────────
    const back = this.add.text(5, 5, "\u2190", {
      fontSize: "24px", color: "#ffffff",
      backgroundColor: "#00BFFF", padding: { x: 7, y: 4 }
    }).setInteractive();
    back.on("pointerdown", () => {
      this.sound.play("menu", { volume: gameVolume });
      this.scene.start("MenuScene");
    });
  }

  // ── Met à jour l'apparence des onglets ───────────────────
  _refreshTabs() {
    this._tabBgs.forEach((bg, i) => {
      const active = i === this._activeTab;
      bg.setFillStyle(active ? 0x00BFFF : 0x223344);
    });
    this._tabLabels.forEach((txt, i) => {
      txt.setStyle({ color: i === this._activeTab ? "#000000" : "#aaaaaa",
                     fontStyle: i === this._activeTab ? "bold" : "normal" });
    });
  }

  // ── Construit le contenu de l'onglet actif ───────────────
  _buildTabContent() {
    if (this._tabContainer) this._tabContainer.removeAll(true);

    if (this._activeTab === 0) {
      this._buildTabGeneral();
    } else {
      this._buildTabGameplay();
    }
  }

  // ── Onglet "Général" : volume + clavier ──────────────────
  _buildTabGeneral() {
    const { width } = this.scale;
    const startY = 130;

    // Volume
    const volLabel = this.add.text(width / 2, startY, "Volume", {
      fontSize: "22px", color: "#aaaaaa"
    }).setOrigin(0.5);
    const track = this.add.rectangle(width / 2, startY + 35, 300, 8, 0x555555);
    const knob = this.add.circle(width / 2 - 150 + gameVolume * 300, startY + 35, 11, 0xffffff)
      .setInteractive({ draggable: true });
    this.input.setDraggable(knob);
    this.input.on("drag", (pointer, obj, dragX) => {
      const minX = width / 2 - 150, maxX = width / 2 + 150;
      obj.x = Phaser.Math.Clamp(dragX, minX, maxX);
      const newVol = Phaser.Math.Clamp((obj.x - minX) / 300, 0, 1);
      setGameVolume(newVol);
      this.sound.volume = newVol;
      save.volume(newVol);
    });

    // Clavier
    const keyboardBtn = this.add.text(width / 2, startY + 90, "", {
      fontSize: "20px", color: "#ffffff",
      backgroundColor: "#00BFFF", padding: { x: 18, y: 8 }
    }).setOrigin(0.5).setInteractive();

    const updateKeyboardBtn = () =>
      keyboardBtn.setText(`Clavier : ${keyboardLayout.toUpperCase()}`);
    updateKeyboardBtn();

    keyboardBtn.on("pointerover",  () => keyboardBtn.setStyle({ backgroundColor: "#00FFFF", color: "#000000" }));
    keyboardBtn.on("pointerout",   () => keyboardBtn.setStyle({ backgroundColor: "#00BFFF", color: "#ffffff" }));
    keyboardBtn.on("pointerdown",  () => {
      const newLayout = keyboardLayout === "zqsd" ? "wasd" : "zqsd";
      setKeyboardLayout(newLayout);
      save.keyboard(newLayout);
      this.sound.play("menu", { volume: gameVolume });
      updateKeyboardBtn();
    });

    this._tabContainer.add([volLabel, track, knob, keyboardBtn]);
  }

  // ── Onglet "Gameplay" : tutoriel ─────────────────────────
  _buildTabGameplay() {
    const { width } = this.scale;
    const startY = 130;

    const LS_TUTO = "jumpix_doubleJumpTutorialSeen";
    let tutoHidden = localStorage.getItem(LS_TUTO) === "true";

    // Titre de section
    const sectionLabel = this.add.text(width / 2, startY, "Tutoriels", {
      fontSize: "20px", color: "#aaaaaa"
    }).setOrigin(0.5);

    // Ligne descriptive
    const desc = this.add.text(width / 2, startY + 36, "Double saut (Level 1)", {
      fontSize: "16px", color: "#888888"
    }).setOrigin(0.5);

    // Toggle bouton
    const tutoBtn = this.add.text(width / 2, startY + 80, "", {
      fontSize: "18px", color: "#ffffff",
      backgroundColor: "#00BFFF", padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setInteractive();

    const updateTutoBtn = () => {
      tutoBtn.setText(tutoHidden ? "Activer" : "D\u00e9sactiver");
      tutoBtn.setStyle({ backgroundColor: tutoHidden ? "#226622" : "#882222" });
    };
    updateTutoBtn();

    tutoBtn.on("pointerdown", () => {
      tutoHidden = !tutoHidden;
      if (tutoHidden) localStorage.setItem(LS_TUTO, "true");
      else            localStorage.removeItem(LS_TUTO);
      this.sound.play("menu", { volume: gameVolume });
      updateTutoBtn();
    });

    this._tabContainer.add([sectionLabel, desc, tutoBtn]);
  }

  // ── Bloc compte dynamique ───────────────────────────────
  _buildAccountBlock() {
    const { width } = this.scale;

    // Conteneur pour pouvoir tout supprimer lors d'un refresh
    if (this._accountContainer) this._accountContainer.destroy();
    this._accountContainer = this.add.container(0, 0);

    if (isLoggedIn()) {
      // ── Vue connecté ──
      const pseudo = getPseudo() || "Joueur";

      const connectedLabel = this.add.text(width / 2, 255, "✅ Connecté en tant que", {
        fontSize: "18px", color: "#aaaaaa"
      }).setOrigin(0.5);

      const pseudoLabel = this.add.text(width / 2, 285, pseudo, {
        fontSize: "28px", color: "#00FF99", fontStyle: "bold"
      }).setOrigin(0.5);

      const infoLabel = this.add.text(width / 2, 318, "Votre progression est sauvegardée 🌐", {
        fontSize: "16px", color: "#88ff88"
      }).setOrigin(0.5);

      const logoutBtn = this.add.text(width / 2, 365, "SE DÉCONNECTER", {
        fontSize: "20px", color: "#ffffff",
        backgroundColor: "#AA4400", padding: { x: 20, y: 10 }
      }).setOrigin(0.5).setInteractive();

      logoutBtn.on("pointerover", () => logoutBtn.setStyle({ backgroundColor: "#CC5500" }));
      logoutBtn.on("pointerout",  () => logoutBtn.setStyle({ backgroundColor: "#AA4400" }));
      logoutBtn.on("pointerdown", async () => {
        this.sound.play("menu", { volume: gameVolume });
        await logout();
        // Remettre les globals aux défauts (invité)
        applyPlayerData(DEFAULTS);
        this._buildAccountBlock(); // rafraîchir l'affichage
      });

      this._accountContainer.add([connectedLabel, pseudoLabel, infoLabel, logoutBtn]);

    } else {
      // ── Vue invité ──
      const guestLabel = this.add.text(width / 2, 250, "Mode invité — progression non sauvegardée", {
        fontSize: "16px", color: "#ffaa44"
      }).setOrigin(0.5);

      // Bouton Connexion
      const loginBtn = this.add.text(width / 2 - 110, 295, "SE CONNECTER", {
        fontSize: "20px", color: "#ffffff",
        backgroundColor: "#007ACC", padding: { x: 16, y: 10 }
      }).setOrigin(0.5).setInteractive();
      loginBtn.on("pointerover", () => loginBtn.setStyle({ backgroundColor: "#0099FF" }));
      loginBtn.on("pointerout",  () => loginBtn.setStyle({ backgroundColor: "#007ACC" }));
      loginBtn.on("pointerdown", () => {
        this.sound.play("menu", { volume: gameVolume });
        this._showLoginPopup();
      });

      // Bouton Inscription
      const registerBtn = this.add.text(width / 2 + 110, 295, "S'INSCRIRE", {
        fontSize: "20px", color: "#ffffff",
        backgroundColor: "#006633", padding: { x: 16, y: 10 }
      }).setOrigin(0.5).setInteractive();
      registerBtn.on("pointerover", () => registerBtn.setStyle({ backgroundColor: "#008844" }));
      registerBtn.on("pointerout",  () => registerBtn.setStyle({ backgroundColor: "#006633" }));
      registerBtn.on("pointerdown", () => {
        this.sound.play("menu", { volume: gameVolume });
        this._showRegisterPopup();
      });

      const hint = this.add.text(width / 2, 350, "Créez un compte pour sauvegarder votre progression\net y accéder depuis n'importe quel appareil.", {
        fontSize: "15px", color: "#888888", align: "center"
      }).setOrigin(0.5);

      this._accountContainer.add([guestLabel, loginBtn, registerBtn, hint]);
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
    const title   = this.add.text(cx, cy - 140, "SE CONNECTER", {
      fontSize: "26px", color: "#007ACC", fontStyle: "bold"
    }).setOrigin(0.5);

    // ── Champ Email ──
    const emailLabel = this.add.text(cx - 190, cy - 100, "E-mail", {
      fontSize: "16px", color: "#aaaaaa"
    });
    const emailBox  = this.add.rectangle(cx, cy - 72, 360, 38, 0x000000).setStrokeStyle(1, 0x555555);
    const emailText = this.add.text(cx - 172, cy - 86, "", { fontSize: "18px", color: "#ffffff" });

    // ── Champ Mot de passe ──
    const pwLabel = this.add.text(cx - 190, cy - 30, "Mot de passe", {
      fontSize: "16px", color: "#aaaaaa"
    });
    const pwBox  = this.add.rectangle(cx, cy - 2, 360, 38, 0x000000).setStrokeStyle(1, 0x555555);
    const pwText = this.add.text(cx - 172, cy - 16, "", { fontSize: "18px", color: "#ffffff" });

    // ── Message d'erreur ──
    const errorMsg = this.add.text(cx, cy + 40, "", {
      fontSize: "15px", color: "#ff5555", align: "center"
    }).setOrigin(0.5);

    // ── Boutons ──
    const confirmBtn = this.add.text(cx - 80, cy + 95, "CONNEXION", {
      fontSize: "20px", color: "#ffffff",
      backgroundColor: "#007ACC", padding: { x: 18, y: 10 }
    }).setOrigin(0.5).setInteractive();

    const cancelBtn = this.add.text(cx + 90, cy + 95, "ANNULER", {
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
      errorMsg.setText("Connexion en cours…").setColor("#aaaaaa");
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
    const title   = this.add.text(cx, cy - 170, "CRÉER UN COMPTE", {
      fontSize: "26px", color: "#00BB55", fontStyle: "bold"
    }).setOrigin(0.5);

    // ── Pseudo ──
    const pseudoLabel = this.add.text(cx - 190, cy - 130, "Pseudo", { fontSize: "16px", color: "#aaaaaa" });
    const pseudoBox   = this.add.rectangle(cx, cy - 102, 360, 38, 0x000000).setStrokeStyle(1, 0x555555);
    const pseudoText  = this.add.text(cx - 172, cy - 116, "", { fontSize: "18px", color: "#ffffff" });

    // ── Email ──
    const emailLabel = this.add.text(cx - 190, cy - 58, "E-mail", { fontSize: "16px", color: "#aaaaaa" });
    const emailBox   = this.add.rectangle(cx, cy - 30, 360, 38, 0x000000).setStrokeStyle(1, 0x555555);
    const emailText  = this.add.text(cx - 172, cy - 44, "", { fontSize: "18px", color: "#ffffff" });

    // ── Mot de passe ──
    const pwLabel = this.add.text(cx - 190, cy + 14, "Mot de passe (6 car. min.)", { fontSize: "16px", color: "#aaaaaa" });
    const pwBox   = this.add.rectangle(cx, cy + 42, 360, 38, 0x000000).setStrokeStyle(1, 0x555555);
    const pwText  = this.add.text(cx - 172, cy + 28, "", { fontSize: "18px", color: "#ffffff" });

    // ── Message ──
    const errorMsg = this.add.text(cx, cy + 95, "", {
      fontSize: "15px", color: "#ff5555", align: "center", wordWrap: { width: 380 }
    }).setOrigin(0.5);

    // ── Boutons ──
    const confirmBtn = this.add.text(cx - 80, cy + 155, "S'INSCRIRE", {
      fontSize: "20px", color: "#ffffff",
      backgroundColor: "#006633", padding: { x: 18, y: 10 }
    }).setOrigin(0.5).setInteractive();

    const cancelBtn = this.add.text(cx + 90, cy + 155, "ANNULER", {
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
        errorMsg.setText("Le pseudo doit faire au moins 2 caractères.").setColor("#ff5555");
        return;
      }

      if (isBadPseudo(pseudo)) {
        errorMsg.setText("Ce pseudo n'est pas autorisé.").setColor("#ff5555");
        return;
      }

      errorMsg.setText("Création du compte…").setColor("#aaaaaa");
      try {
        await registerWithEmail(email, pwValue, pseudo);
        // CORRECTION : sauvegarder le pseudo EN PREMIER dans Firestore
        // pour que findPlayerByPseudo puisse le retrouver immédiatement.
        await save.pseudo(pseudo);
        // Ensuite charger la progression (le document contiendra déjà le pseudo)
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

  // ── Mot de passe dev ────────────────────────────────────
  _showPasswordPopup() {
    const { width, height } = this.scale;
    const cx = width / 2, cy = height / 2;

    const overlay  = this.add.rectangle(cx, cy, width, height, 0x000000, 0.7);
    const box      = this.add.rectangle(cx, cy, 400, 240, 0x222222).setStrokeStyle(3, 0xffffff);
    const title    = this.add.text(cx, cy - 80, "DEV PASSWORD", { fontSize: "24px", color: "#ffffff" }).setOrigin(0.5);
    let inputText  = "";
    const input    = this.add.text(cx, cy - 30, "••••••", {
      fontSize: "26px", color: "#00ffcc",
      backgroundColor: "#000000", padding: { x: 15, y: 8 }
    }).setOrigin(0.5);
    const info     = this.add.text(cx, cy + 15, "", { fontSize: "18px", color: "#ff5555" }).setOrigin(0.5);

    const closeBtn = this.add.text(cx, cy + 65, "CANCEL", {
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

    this.input.keyboard.on("keydown", async event => {
      if (event.key === "Backspace")    inputText = inputText.slice(0, -1);
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
      "Sound", "Music : \"8bit Music for Game\" - freesound_community",
      "Thanks for playing!", "", "For Inna"
    ];

    this.creditContainer = this.add.container(width / 2, height + 50);
    let offsetY = 0;
    credits.forEach(line => {
      const text = this.add.text(0, offsetY, line, {
        fontSize: "28px", color: "#ffffff"
      }).setOrigin(0.5);
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

const STATS_ALL_LEVELS = [
  "Level1","Level2","Level3","Level4","Level5",
  "Level6","Level7","Level8","Level9", "Level10"
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
      ? `🌐 Connecté : ${getPseudo()}`
      : "👤 Mode invité — progression non sauvegardée";
    this.add.text(width / 2, 214, badge, {
      fontSize: "14px", color: isLoggedIn() ? "#88ff88" : "#ffaa44"
    }).setOrigin(0.5);

    // ── Meilleurs rangs atteints ─────────────────────────────
    this.add.text(width / 2, 238, "🏆 Meilleurs rangs atteints", {
      fontSize: "18px", color: "#FFD700", fontStyle: "bold"
    }).setOrigin(0.5);

    if (!isLoggedIn()) {
      this.add.text(width / 2, 268, "Connectez-vous pour enregistrer vos rangs.", {
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
      { label: "🎮 Complete 1000 levels", progress: pd.party ?? 0, goal: 1000, skin: "A0522D", color: 0xA0522D }
    ];

    let y = 150;
    objectives.forEach(obj => {
      const unlocked = !!(pd.skins && pd.skins[obj.skin]);
      const percent  = Math.min(obj.progress / obj.goal, 1);

      this.add.text(100, y, obj.label, { fontSize: "22px", color: "#ffffff" });
      this.add.rectangle(100, y + 30, 300, 12, 0x444444).setOrigin(0);
      this.add.rectangle(100, y + 30, 300 * percent, 12, unlocked ? 0x00FF66 : 0xFFD700).setOrigin(0);
      this.add.text(420, y + 20, `${obj.progress}/${obj.goal}`, { fontSize: "18px", color: "#ffffff" });
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
  "Level6","Level7","Level8","Level9", "Level10"
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

    // ── Charger le premier onglet ──
    this._loadTab(0);
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

      const label = this.add.text(x, tabY, lvl.replace("Level", "Lvl "), {
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

    // Indicateur de chargement
    const loadTxt = this.add.text(width / 2, 300, "Chargement...", {
      fontSize: "22px", color: "#888888"
    }).setOrigin(0.5);
    this.listContainer.add(loadTxt);

    try {
      const entries = await loadLeaderboard(ALL_LEVELS[index]);
      this.listContainer.removeAll(true);

      if (entries.length === 0) {
        this.listContainer.add(
          this.add.text(width / 2, 300, "Aucun temps enregistré", {
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
        this.add.text(310,       headerY, "Joueur", { fontSize: "14px", color: "#888888" }).setOrigin(0, 0.5),
        this.add.text(width - 20, headerY, "Temps", { fontSize: "14px", color: "#888888" }).setOrigin(1, 0.5),
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

        // Fond de ligne
        const rowBg = this.add.rectangle(width / 2, y + rowH / 2, width, rowH, bgCol);
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
        const pseudo = entry.pseudo || "Anonyme";
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

    } catch (err) {
      this.listContainer.removeAll(true);
      this.listContainer.add(
        this.add.text(width / 2, 300, "Erreur de chargement", {
          fontSize: "20px", color: "#ff4444"
        }).setOrigin(0.5)
      );
      console.error("Leaderboard error:", err);
    }
  }
}

// =========================================================
//                     FRIENDS SCENE
// =========================================================
// Trois onglets :
//   0 – Amis & demandes reçues
//   1 – Classement entre amis (par niveau)
// =========================================================
const FRIENDS_LEVELS = [
  "Level1","Level2","Level3","Level4","Level5",
  "Level6","Level7","Level8","Level9"
];

export class FriendsScene extends Phaser.Scene {
  constructor() { super("FriendsScene"); }

  init() {
    this.activeTab      = "friends"; // "friends" | "leaderboard"
    this.lbLevel        = 0;         // index dans FRIENDS_LEVELS pour le classement
  }

  async create() {
    const { width, height } = this.scale;

    // ── Fond ────────────────────────────────────────────────
    this.add.rectangle(width / 2, height / 2, width, height, 0x0d1b2a);

    // ── Retour ──────────────────────────────────────────────
    this.add.text(8, 8, "←", {
      fontSize: "24px", color: "#ffffff",
      backgroundColor: "#00BFFF", padding: { x: 7, y: 4 }
    }).setInteractive().on("pointerdown", () => {
      this.sound.play("menu", { volume: gameVolume });
      this.scene.start("MenuScene");
    });

    if (!isLoggedIn()) {
      this.add.text(width / 2, height / 2, "Connectez-vous pour utiliser les amis.", {
        fontSize: "20px", color: "#ffaa44"
      }).setOrigin(0.5);
      return;
    }

    // ── Onglets principaux ───────────────────────────────────
    this._mainTabObjs = [];
    this._buildMainTabs(width);

    // ── Conteneur de contenu ─────────────────────────────────
    this._contentContainer = this.add.container(0, 0);

    // ── Charger les données amis ─────────────────────────────
    let pd;
    try { pd = await loadPlayerData(); }
    catch { pd = {}; }
    this._pd = pd;

    this._showTab(this.activeTab);
  }

  // =========================================================
  //  ONGLETS PRINCIPAUX
  // =========================================================
  _buildMainTabs(width) {
    (this._mainTabObjs || []).forEach(o => o.destroy());
    this._mainTabObjs = [];

    const tabs = [
      { key: "friends",     label: "👥 Amis"       },
      { key: "leaderboard", label: "🏆 Classement"  },
    ];
    const tw = Math.floor((width - 20) / tabs.length);

    tabs.forEach((t, i) => {
      const x      = 10 + i * tw + tw / 2;
      const active = this.activeTab === t.key;
      const bg = this.add.rectangle(x, 28, tw - 6, 32, active ? 0x00BFFF : 0x1a2e44).setInteractive();
      const lbl = this.add.text(x, 28, t.label, {
        fontSize: "15px", color: active ? "#000000" : "#aaaaaa", fontStyle: active ? "bold" : "normal"
      }).setOrigin(0.5);
      bg.on("pointerdown", () => {
        if (this.activeTab !== t.key) {
          this.activeTab = t.key;
          this._buildMainTabs(width);
          this._showTab(t.key);
        }
      });
      bg.on("pointerover",  () => { if (!active) bg.setFillStyle(0x2a4466); });
      bg.on("pointerout",   () => { if (!active) bg.setFillStyle(0x1a2e44); });
      this._mainTabObjs.push(bg, lbl);
    });
  }

  _showTab(key) {
    (this._lbTabObjs || []).forEach(o => o.destroy());
    this._lbTabObjs = [];
    if (this._lbListContainer) { this._lbListContainer.destroy(); this._lbListContainer = null; }
    this._contentContainer.removeAll(true);
    if (key === "friends")     this._buildFriendsTab();
    if (key === "leaderboard") this._buildLeaderboardTab();
  }

  // =========================================================
  //  ONGLET AMIS
  // =========================================================
  _buildFriendsTab() {
    const { width, height } = this.scale;
    const pd = this._pd || {};

    // ── Barre de recherche ───────────────────────────────────
    const searchLabel = this.add.text(width / 2, 66, "Ajouter un ami par pseudo :", {
      fontSize: "15px", color: "#aaaaaa"
    }).setOrigin(0.5);

    const inputBox = this.add.rectangle(width / 2 - 65, 92, 270, 34, 0x111111)
      .setStrokeStyle(1, 0x555555).setOrigin(0.5).setInteractive();

    this._inputText  = this.add.text(width / 2 - 195, 79, "", { fontSize: "17px", color: "#ffffff" });
    this._inputValue = "";
    this._inputFocused = false;

    inputBox.on("pointerdown", () => {
      this._inputFocused = true;
      inputBox.setStrokeStyle(2, 0x00BFFF);
    });

    this.input.keyboard.removeAllListeners("keydown");
    this.input.keyboard.on("keydown", e => {
      if (!this._inputFocused) return;
      if (e.key === "Backspace") this._inputValue = this._inputValue.slice(0, -1);
      else if (e.key.length === 1 && this._inputValue.length < 24) this._inputValue += e.key;
      else if (e.key === "Enter") sendBtn.emit("pointerdown");
      this._inputText.setText(this._inputValue);
    });

    this._feedbackText = this.add.text(width / 2, 118, "", {
      fontSize: "13px", color: "#aaaaaa"
    }).setOrigin(0.5);

    const sendBtn = this.add.text(width / 2 + 110, 92, "Envoyer ➤", {
      fontSize: "14px", color: "#ffffff",
      backgroundColor: "#226688", padding: { x: 10, y: 7 }
    }).setOrigin(0.5).setInteractive();
    sendBtn.on("pointerover", () => sendBtn.setStyle({ backgroundColor: "#2288AA" }));
    sendBtn.on("pointerout",  () => sendBtn.setStyle({ backgroundColor: "#226688" }));
    sendBtn.on("pointerdown", async () => {
      this._inputFocused = false;
      inputBox.setStrokeStyle(1, 0x555555);
      const pseudo = this._inputValue.trim();
      if (!pseudo) return;
      this._setFeedback("Recherche…", "#aaaaaa");
      const result = await findPlayerByPseudo(pseudo);
      if (!result) { this._setFeedback("❌ Joueur introuvable.", "#ff5555"); return; }
      const res = await sendFriendRequest(result.uid, result.pseudo);
      if (res.ok)                              this._setFeedback("✅ Demande envoyée !", "#00FF99");
      else if (res.error === "self")           this._setFeedback("❌ C'est vous !", "#ff5555");
      else if (res.error === "already_friends") this._setFeedback("✅ Déjà ami.", "#00FF99");
      else if (res.error === "already_sent")   this._setFeedback("⏳ Demande déjà envoyée.", "#ffaa44");
      else if (res.error === "blocked")        this._setFeedback("🔒 Ce joueur n'accepte pas les demandes.", "#ffaa44");
      else                                     this._setFeedback("❌ Erreur.", "#ff5555");
    });

    this.add.rectangle(width / 2, 132, width - 20, 1, 0x333333);

    this._contentContainer.add([searchLabel, inputBox, this._inputText, this._feedbackText, sendBtn]);

    // ── Demandes reçues ──────────────────────────────────────
    const requests = pd.friendRequests ? Object.entries(pd.friendRequests).filter(([, r]) => r.status === "pending") : [];
    const friends  = pd.friends        ? Object.entries(pd.friends) : [];

    let y = 144;

    if (requests.length > 0) {
      const reqTitle = this.add.text(14, y, `📩 Demandes reçues (${requests.length})`, {
        fontSize: "15px", color: "#FFD700", fontStyle: "bold"
      });
      this._contentContainer.add(reqTitle);
      y += 24;

      requests.forEach(([fromUid, req]) => {
        // Fond de ligne coloré (orange doux)
        const rowBg = this.add.rectangle(width / 2, y + 17, width - 10, 34, 0x1f1200);
        this._contentContainer.add(rowBg);

        // Skin
        const skinColor = typeof req.colorPlayer === "number"
          ? req.colorPlayer : parseInt(req.colorPlayer) || 0xAA66CC;
        this._contentContainer.add(this.add.rectangle(26, y + 17, 22, 22, skinColor));

        // Pseudo
        this._contentContainer.add(this.add.text(42, y + 7, req.pseudo || "Anonyme", {
          fontSize: "15px", color: "#ffffff"
        }));

        // Bouton Accepter
        const acceptBtn = this.add.text(width - 170, y + 5, "✅ Accepter", {
          fontSize: "13px", color: "#ffffff",
          backgroundColor: "#1a5c1a", padding: { x: 7, y: 4 }
        }).setInteractive();
        acceptBtn.on("pointerover", () => acceptBtn.setStyle({ backgroundColor: "#226622" }));
        acceptBtn.on("pointerout",  () => acceptBtn.setStyle({ backgroundColor: "#1a5c1a" }));
        acceptBtn.on("pointerdown", async () => {
          this.sound.play("select", { volume: gameVolume });
          await acceptFriendRequest(fromUid, req.pseudo, req.colorPlayer);
          this._pd = await loadPlayerData();
          this._showTab("friends");
        });
        this._contentContainer.add(acceptBtn);

        // Bouton Refuser
        const declineBtn = this.add.text(width - 70, y + 5, "❌ Refuser", {
          fontSize: "13px", color: "#ffffff",
          backgroundColor: "#5c1a1a", padding: { x: 7, y: 4 }
        }).setInteractive();
        declineBtn.on("pointerover", () => declineBtn.setStyle({ backgroundColor: "#882222" }));
        declineBtn.on("pointerout",  () => declineBtn.setStyle({ backgroundColor: "#5c1a1a" }));
        declineBtn.on("pointerdown", async () => {
          this.sound.play("menu", { volume: gameVolume });
          await declineFriendRequest(fromUid);
          this._pd = await loadPlayerData();
          this._showTab("friends");
        });
        this._contentContainer.add(declineBtn);

        y += 38;
      });

      // Séparateur
      this._contentContainer.add(this.add.rectangle(width / 2, y + 4, width - 20, 1, 0x2a2a2a));
      y += 12;
    }

    // ── Liste des amis ───────────────────────────────────────
    const friendTitle = this.add.text(14, y, friends.length > 0
      ? `👥 Mes amis (${friends.length})`
      : "👥 Aucun ami pour l'instant", {
      fontSize: "15px", color: "#aaaaaa", fontStyle: "bold"
    });
    this._contentContainer.add(friendTitle);
    y += 24;

    friends.forEach(([friendUid, info]) => {
      const skinColor = typeof info.colorPlayer === "number"
        ? info.colorPlayer : parseInt(info.colorPlayer) || 0xAA66CC;

      const rowBg = this.add.rectangle(width / 2, y + 17, width - 10, 34, 0x111122).setInteractive();
      rowBg.on("pointerover",  () => rowBg.setFillStyle(0x1a2244));
      rowBg.on("pointerout",   () => rowBg.setFillStyle(0x111122));
      rowBg.on("pointerdown",  () => {
        this.sound.play("select", { volume: gameVolume });
        this._showFriendProfile(friendUid, info.pseudo || "Anonyme", skinColor, width, height);
      });
      this._contentContainer.add(rowBg);

      this._contentContainer.add(this.add.rectangle(26, y + 17, 22, 22, skinColor));

      const pseudoTxt = this.add.text(42, y + 7, info.pseudo || "Anonyme", {
        fontSize: "15px", color: "#ffffff"
      }).setInteractive();
      pseudoTxt.on("pointerdown", () => {
        this.sound.play("select", { volume: gameVolume });
        this._showFriendProfile(friendUid, info.pseudo || "Anonyme", skinColor, width, height);
      });
      this._contentContainer.add(pseudoTxt);

      const removeBtn = this.add.text(width - 14, y + 7, "✖", {
        fontSize: "13px", color: "#ff6666",
        backgroundColor: "#330000", padding: { x: 5, y: 3 }
      }).setOrigin(1, 0).setInteractive();
      removeBtn.on("pointerdown", async () => {
        this.sound.play("menu", { volume: gameVolume });
        await removeFriend(friendUid);
        this._pd = await loadPlayerData();
        this._showTab("friends");
      });
      this._contentContainer.add(removeBtn);

      y += 38;
    });
  }

  _setFeedback(msg, color) {
    if (this._feedbackText) this._feedbackText.setText(msg).setColor(color);
  }

  // =========================================================
  //  ONGLET CLASSEMENT ENTRE AMIS
  // =========================================================
  _buildLeaderboardTab() {
    const { width, height } = this.scale;

    // Titre
    this._contentContainer.add(
      this.add.text(width / 2, 58, "🏆 Classement entre amis", {
        fontSize: "20px", color: "#FFD700", fontStyle: "bold"
      }).setOrigin(0.5)
    );

    // ── Onglets de niveau ────────────────────────────────────
    this._lbTabObjs = [];
    this._lbListContainer = this.add.container(0, 0);
    this._contentContainer.add(this._lbListContainer);

    this._buildLbTabs(width);
    this._loadFriendsLeaderboard(this.lbLevel);
  }

  _buildLbTabs(width) {
    (this._lbTabObjs || []).forEach(o => o.destroy());
    this._lbTabObjs = [];

    const tw   = Math.floor((width - 20) / FRIENDS_LEVELS.length);
    const tabY = 86;

    FRIENDS_LEVELS.forEach((lvl, i) => {
      const x      = 10 + i * tw + tw / 2;
      const active = i === this.lbLevel;

      const bg = this.add.rectangle(x, tabY, tw - 4, 24, active ? 0x00BFFF : 0x223344).setInteractive();
      const lbl = this.add.text(x, tabY, lvl.replace("Level", "Lvl "), {
        fontSize: "12px", color: active ? "#000000" : "#aaaaaa", fontStyle: active ? "bold" : "normal"
      }).setOrigin(0.5);

      bg.on("pointerdown", () => {
        if (i !== this.lbLevel) {
          this.lbLevel = i;
          this._buildLbTabs(width);
          this._loadFriendsLeaderboard(i);
        }
      });
      bg.on("pointerover",  () => { if (i !== this.lbLevel) bg.setFillStyle(0x335566); });
      bg.on("pointerout",   () => { if (i !== this.lbLevel) bg.setFillStyle(0x223344); });

      this._lbTabObjs.push(bg, lbl);
    });
  }

  async _loadFriendsLeaderboard(index) {
    const { width } = this.scale;
    this._lbListContainer.removeAll(true);

    const loadTxt = this.add.text(width / 2, 300, "Chargement…", {
      fontSize: "18px", color: "#888888"
    }).setOrigin(0.5);
    this._lbListContainer.add(loadTxt);

    try {
      const pd      = this._pd || {};
      const friends = pd.friends ? Object.entries(pd.friends) : [];
      const myUid   = getCurrentUser()?.uid ?? null;

      // Récupérer toutes les entrées du leaderboard global pour ce niveau
      const allEntries = await loadLeaderboard(FRIENDS_LEVELS[index]);

      // Filtrer : garder seulement moi + mes amis
      const friendUids = new Set([myUid, ...friends.map(([uid]) => uid)]);
      const filtered   = allEntries.filter(e => friendUids.has(e.uid));

      this._lbListContainer.removeAll(true);

      if (filtered.length === 0) {
        this._lbListContainer.add(
          this.add.text(width / 2, 300,
            friends.length === 0
              ? "Ajoutez des amis pour voir le classement."
              : "Aucun temps enregistré parmi vos amis.", {
            fontSize: "17px", color: "#666666", align: "center", wordWrap: { width: width - 40 }
          }).setOrigin(0.5)
        );
        return;
      }

      // Colonnes header
      const headerY = 108;
      this._lbListContainer.add([
        this.add.text(50,         headerY, "#",       { fontSize: "13px", color: "#888888" }).setOrigin(0.5),
        this.add.text(100,        headerY, "Skin",    { fontSize: "13px", color: "#888888" }).setOrigin(0.5),
        this.add.text(130,        headerY, "Joueur",  { fontSize: "13px", color: "#888888" }).setOrigin(0, 0.5),
        this.add.text(width - 16, headerY, "Temps",  { fontSize: "13px", color: "#888888" }).setOrigin(1, 0.5),
      ]);
      this._lbListContainer.add(
        this.add.rectangle(width / 2, headerY + 14, width - 16, 1, 0x333333)
      );

      const rowH   = 42;
      const startY = 130;

      filtered.forEach((entry, i) => {
        const y      = startY + i * rowH;
        const isMe   = entry.uid === myUid;
        const rowCol = isMe ? "#FFD700" : (i % 2 === 0 ? "#ffffff" : "#cccccc");
        const bgCol  = isMe ? 0x2a2000  : (i % 2 === 0 ? 0x111122  : 0x0d0d1a);

        this._lbListContainer.add(
          this.add.rectangle(width / 2, y + rowH / 2, width, rowH, bgCol)
        );

        // Rang
        const rankStr  = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
        this._lbListContainer.add(
          this.add.text(50, y + rowH / 2, rankStr, {
            fontSize: i < 3 ? "18px" : "15px", color: rowCol
          }).setOrigin(0.5)
        );

        // Skin
        const skinColor = typeof entry.colorPlayer === "number"
          ? entry.colorPlayer : parseInt(entry.colorPlayer) || 0xAA66CC;
        this._lbListContainer.add(this.add.rectangle(100, y + rowH / 2, 24, 24, skinColor));

        // Pseudo
        this._lbListContainer.add(
          this.add.text(118, y + rowH / 2, entry.pseudo || "Anonyme", {
            fontSize: "16px", color: isMe ? "#FFD700" : rowCol,
            fontStyle: isMe ? "bold" : "normal"
          }).setOrigin(0, 0.5)
        );

        // Temps
        this._lbListContainer.add(
          this.add.text(width - 16, y + rowH / 2, (entry.timeMs / 1000).toFixed(2) + "s", {
            fontSize: "16px", color: i === 0 ? "#FFD700" : rowCol
          }).setOrigin(1, 0.5)
        );
      });

    } catch (err) {
      this._lbListContainer.removeAll(true);
      this._lbListContainer.add(
        this.add.text(width / 2, 300, "Erreur de chargement.", {
          fontSize: "18px", color: "#ff4444"
        }).setOrigin(0.5)
      );
      console.error("Friends leaderboard error:", err);
    }
  }

  // =========================================================
  //  POPUP PROFIL AMI
  // =========================================================
  async _showFriendProfile(uid, pseudo, skinColor, width, height) {
    const cx = width / 2, cy = height / 2;

    const overlay = this.add.rectangle(cx, cy, width, height, 0x000000, 0.75).setDepth(50);
    const box     = this.add.rectangle(cx, cy, 560, 420, 0x0d1b2a)
      .setStrokeStyle(2, 0x00BFFF).setDepth(51);

    const loadTxt = this.add.text(cx, cy, "Chargement…", {
      fontSize: "18px", color: "#888888"
    }).setOrigin(0.5).setDepth(52);

    let profile;
    try { profile = await loadFriendProfile(uid); }
    catch { profile = null; }

    loadTxt.destroy();

    const all = [overlay, box];
    const d   = obj => { all.push(obj); return obj; };

    if (!profile) {
      d(this.add.text(cx, cy, "Profil indisponible.", {
        fontSize: "18px", color: "#ff5555"
      }).setOrigin(0.5).setDepth(52));
      const closeBtn = d(this.add.text(cx, cy + 60, "Fermer", {
        fontSize: "18px", color: "#ffffff",
        backgroundColor: "#444444", padding: { x: 18, y: 8 }
      }).setOrigin(0.5).setInteractive().setDepth(52));
      closeBtn.on("pointerdown", () => all.forEach(o => o.destroy()));
      return;
    }

    // En-tête
    d(this.add.rectangle(cx - 200, cy - 155, 36, 36, skinColor).setDepth(52));
    d(this.add.text(cx - 178, cy - 168, pseudo, {
      fontSize: "26px", color: "#ffffff", fontStyle: "bold"
    }).setDepth(52));

    d(this.add.rectangle(cx, cy - 127, 500, 1, 0x333333).setDepth(52));

    const statsRows = [
      { label: "Coins 💰",          value: profile.playerCoins },
      { label: "Deaths ☠️",         value: profile.dead        },
      { label: "Kills 🔪",          value: profile.kill        },
      { label: "Parties Played 🎮", value: profile.party       }
    ];
    let sy = cy - 108;
    statsRows.forEach(row => {
      d(this.add.text(cx - 220, sy, row.label, { fontSize: "17px", color: "#aaaaaa" }).setDepth(52));
      d(this.add.text(cx + 220, sy, String(row.value), {
        fontSize: "17px", color: "#ffff00"
      }).setOrigin(1, 0).setDepth(52));
      sy += 32;
    });

    d(this.add.rectangle(cx, sy + 2, 500, 1, 0x333333).setDepth(52));
    sy += 14;

    d(this.add.text(cx, sy, "⏱ Meilleurs temps", {
      fontSize: "15px", color: "#FFD700", fontStyle: "bold"
    }).setOrigin(0.5).setDepth(52));
    sy += 22;

    const colCount = 3;
    const colW = Math.floor(500 / colCount);
    FRIENDS_LEVELS.forEach((lvl, i) => {
      const col  = i % colCount;
      const row  = Math.floor(i / colCount);
      const lx   = cx - 240 + col * colW + colW / 2;
      const ly   = sy + row * 34;
      const ms   = profile.bestTimes[lvl];
      const timeStr = ms !== undefined ? `${(ms / 1000).toFixed(2)}s` : "–";
      d(this.add.text(lx, ly, lvl.replace("Level", "Lvl "), {
        fontSize: "12px", color: "#888888"
      }).setOrigin(0.5).setDepth(52));
      d(this.add.text(lx, ly + 14, timeStr, {
        fontSize: "14px", color: ms !== undefined ? "#00FF99" : "#555555", fontStyle: "bold"
      }).setOrigin(0.5).setDepth(52));
    });

    const closeBtn = this.add.text(cx, cy + 175, "Fermer", {
      fontSize: "18px", color: "#ffffff",
      backgroundColor: "#444444", padding: { x: 22, y: 8 }
    }).setOrigin(0.5).setInteractive().setDepth(52);
    closeBtn.on("pointerover", () => closeBtn.setStyle({ backgroundColor: "#666666" }));
    closeBtn.on("pointerout",  () => closeBtn.setStyle({ backgroundColor: "#444444" }));
    closeBtn.on("pointerdown", () => {
      this.sound.play("menu", { volume: gameVolume });
      all.forEach(o => o.destroy());
      closeBtn.destroy();
    });
  }
}
