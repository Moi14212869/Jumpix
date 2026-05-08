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
import { save, resetAccount, loadPlayerData, isLoggedIn, getPseudo, DEFAULTS } from "../utils/db.js";
import {
  registerWithEmail, loginWithEmail, logout, firebaseErrorMessage
} from "../utils/firebase.js";

export class SettingsScene extends Phaser.Scene {
  constructor() { super("SettingsScene"); }

  create() {
    const { width } = this.scale;

    this.add.text(width / 2, 50, "Settings", {
      fontSize: "40px", color: "#ffffff"
    }).setOrigin(0.5);

    // ── Volume ──────────────────────────────────────────────
    this.add.text(width / 2, 110, "Volume", { fontSize: "22px", color: "#aaaaaa" }).setOrigin(0.5);
    this.add.rectangle(width / 2, 145, 300, 8, 0x555555);
    const knob = this.add.circle(width / 2 - 150 + gameVolume * 300, 145, 11, 0xffffff)
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

    // ── Clavier ZQSD / WASD ─────────────────────────────────
    const keyboardBtn = this.add.text(width / 2, 190, "", {
      fontSize: "20px", color: "#ffffff",
      backgroundColor: "#00BFFF", padding: { x: 18, y: 8 }
    }).setOrigin(0.5).setInteractive();

    const updateKeyboardBtn = () =>
      keyboardBtn.setText(`Clavier : ${keyboardLayout.toUpperCase()}`);
    updateKeyboardBtn();

    keyboardBtn.on("pointerover",  () => {
      keyboardBtn.setStyle({ backgroundColor: "#00FFFF", color: "#000000" });
    });
    keyboardBtn.on("pointerout",   () => {
      keyboardBtn.setStyle({ backgroundColor: "#00BFFF", color: "#ffffff" });
    });
    keyboardBtn.on("pointerdown",  () => {
      const newLayout = keyboardLayout === "zqsd" ? "wasd" : "zqsd";
      setKeyboardLayout(newLayout);
      save.keyboard(newLayout);
      this.sound.play("menu", { volume: gameVolume });
      updateKeyboardBtn();
    });

    // ── Séparateur ──────────────────────────────────────────
    this.add.rectangle(width / 2, 225, 500, 1, 0x444444);

    // ── Bloc compte (connecté ou non) ───────────────────────
    this._buildAccountBlock();

    // ── Boutons bas de page ─────────────────────────────────
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
    const back = this.add.text(5, 5, "←", {
      fontSize: "24px", color: "#ffffff",
      backgroundColor: "#00BFFF", padding: { x: 7, y: 4 }
    }).setInteractive();
    back.on("pointerdown", () => {
      this.sound.play("menu", { volume: gameVolume });
      this.scene.start("MenuScene");
    });
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

      errorMsg.setText("Création du compte…").setColor("#aaaaaa");
      try {
        await registerWithEmail(email, pwValue, pseudo);
        // Créer le document Firestore avec les défauts
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
export class Stats extends Phaser.Scene {
  constructor() { super("Stats"); }

  async create() {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x3d2505);
    this.add.text(width / 2, 60, "STATISTICS", {
      fontSize: "40px", color: "#ffffff", fontStyle: "bold"
    }).setOrigin(0.5);

    let pd;
    try {
      pd = await loadPlayerData();
    } catch {
      pd = { playerCoins: 0, dead: 0, kill: 0, party: 0 };
    }

    const statsData = [
      { label: "Coins 💰",          value: pd.playerCoins ?? 0 },
      { label: "Deaths ☠️",         value: pd.dead        ?? 0 },
      { label: "Kills 🔪",          value: pd.kill        ?? 0 },
      { label: "Parties Played 🎮", value: pd.party       ?? 0 }
    ];

    let startY = 150;
    statsData.forEach(stat => {
      this.add.text(width / 2, startY, `${stat.label} : ${stat.value}`, {
        fontSize: "28px", color: "#ffff00"
      }).setOrigin(0.5);
      startY += 60;
    });

    // Badge compte
    const badge = isLoggedIn()
      ? `🌐 Connecté : ${getPseudo()}`
      : "👤 Mode invité — progression non sauvegardée";
    this.add.text(width / 2, startY + 20, badge, {
      fontSize: "16px", color: isLoggedIn() ? "#88ff88" : "#ffaa44"
    }).setOrigin(0.5);

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
