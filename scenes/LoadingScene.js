// =========================================================
//                    LOADING SCENE
// =========================================================
// Charge les assets audio, attend que Firebase ait résolu
// l'état d'authentification, puis charge la progression
// si l'utilisateur est connecté.
// =========================================================

import { gameVolume, applyPlayerData } from "../globals.js";
import { waitForAuthReady, signInAsGuest, loginWithEmail, firebaseErrorMessageEN } from "../utils/firebase.js";
import { loadPlayerData, save, isPseudoTaken } from "../utils/db.js";

export class LoadingScene extends Phaser.Scene {
  constructor() { super("LoadingScene"); }

  preload() {
    const { width, height } = this.scale;

    const loadingText = this.add.text(width / 2, height / 2 - 50, "Loading...", {
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
      loadingText.setText("Connecting...");
    });
  }

  async create() {
    this.bgm = this.sound.add("bgm", { loop: true, volume: gameVolume });
    if (!this.bgm.isPlaying) this.bgm.play();

    try {
      const user = await waitForAuthReady();

      if (user) {
        // Utilisateur déjà connecté (email ou anonyme) → charger directement
        const data = await loadPlayerData();
        applyPlayerData(data);
        this.scene.start("MenuScene");
      } else {
        // Aucune session : vérifier si un pseudo local existe déjà
        const savedPseudo = localStorage.getItem("jumpix_pseudo");
        if (savedPseudo) {
          // Pseudo connu mais session expirée → recréer un compte anonyme
          await signInAsGuest();
          // Charger/créer le document joueur AVANT d'écrire le pseudo
          // (save.pseudo utilise updateDoc, qui échoue si le doc n'existe pas).
          const data = await loadPlayerData();
          await save.pseudo(savedPseudo);
          data.pseudo = savedPseudo;
          applyPlayerData(data);
          this.scene.start("MenuScene");
        } else {
          // Première visite → afficher la popup de choix de pseudo
          this._showPseudoPopup();
        }
      }
    } catch (err) {
      console.warn("Firebase indisponible, démarrage en mode invité.", err);
      this.scene.start("MenuScene");
    }
  }

  // =========================================================
  //  PSEUDO POPUP (first visit)
  // =========================================================
  _showPseudoPopup() {
    const { width, height } = this.scale;
    const cx = width / 2, cy = height / 2;

    // Semi-transparent background
    this.add.rectangle(cx, cy, width, height, 0x000000, 0.85);

    // Main box (taller to fit the login button below)
    this.add.rectangle(cx, cy, 480, 380, 0x1a1a2e).setStrokeStyle(3, 0x00BFFF);

    this.add.text(cx, cy - 155, "Welcome to Jumpix! 🎮", {
      fontSize: "26px", color: "#00BFFF", fontStyle: "bold"
    }).setOrigin(0.5);

    this.add.text(cx, cy - 113, "Choose your username to play:", {
      fontSize: "18px", color: "#cccccc"
    }).setOrigin(0.5);

    // Text input field
    const inputBox  = this.add.rectangle(cx, cy - 63, 340, 44, 0x000000)
      .setStrokeStyle(2, 0x00BFFF).setInteractive();
    const inputText = this.add.text(cx - 162, cy - 79, "", {
      fontSize: "22px", color: "#ffffff"
    });
    const cursor = this.add.text(cx - 162, cy - 79, "|", {
      fontSize: "22px", color: "#00BFFF"
    });

    // Blinking cursor
    this.time.addEvent({
      delay: 500, loop: true,
      callback: () => { cursor.setVisible(!cursor.visible); }
    });

    const errorMsg = this.add.text(cx, cy - 13, "", {
      fontSize: "15px", color: "#ff5555", align: "center", wordWrap: { width: 400 }
    }).setOrigin(0.5);

    const confirmBtn = this.add.text(cx, cy + 38, "PLAY  ▶", {
      fontSize: "24px", color: "#000000",
      backgroundColor: "#00BFFF", padding: { x: 28, y: 12 }
    }).setOrigin(0.5).setInteractive();

    const hint = this.add.text(cx, cy + 90, "You can link an email account later\nto play across multiple devices.", {
      fontSize: "13px", color: "#666666", align: "center"
    }).setOrigin(0.5);

    // ── Divider ──
    this.add.rectangle(cx, cy + 122, 380, 1, 0x444444);
    this.add.text(cx, cy + 122, "or", {
      fontSize: "13px", color: "#888888", backgroundColor: "#1a1a2e", padding: { x: 8, y: 0 }
    }).setOrigin(0.5);

    // ── Log in button (for players who already have an account) ──
    const loginBtn = this.add.text(cx, cy + 158, "LOG IN", {
      fontSize: "18px", color: "#ffffff",
      backgroundColor: "#007ACC", padding: { x: 20, y: 8 }
    }).setOrigin(0.5).setInteractive();

    loginBtn.on("pointerover", () => loginBtn.setStyle({ backgroundColor: "#0099FF" }));
    loginBtn.on("pointerout",  () => loginBtn.setStyle({ backgroundColor: "#007ACC" }));
    loginBtn.on("pointerdown", () => {
      this.sound.play("menu", { volume: gameVolume });
      this._showLoginPopup();
    });

    // ── Keyboard input ──────────────────────────────────────
    let pseudoValue = "";

    const updateDisplay = () => {
      inputText.setText(pseudoValue);
      // Move cursor right after the text
      cursor.x = inputText.x + inputText.width + 2;
      cursor.y = inputText.y;
    };

    this.input.keyboard.on("keydown", e => {
      if (e.key === "Backspace") {
        pseudoValue = pseudoValue.slice(0, -1);
      } else if (e.key.length === 1 && pseudoValue.length < 20) {
        pseudoValue += e.key;
      } else if (e.key === "Enter") {
        confirmBtn.emit("pointerdown");
        return;
      }
      updateDisplay();
      errorMsg.setText("");
    });

    // ── Validation ──────────────────────────────────────────
    const BAD_WORDS = [
      "putain","merde","connard","connasse","salope","pute","batard","bâtard",
      "enculé","enculer","encule","nique","niquer","fdp","ntm",
      "fuck","shit","bitch","asshole","bastard","cunt","dick","cock","pussy",
      "faggot","fag","nigger","nigga","whore","slut","retard","kys","rape",
      "nazi","hitler","f4ck","sh1t","b1tch","@ss","n1gg",
    ];
    const isBad = v => {
      const n = v.toLowerCase().replace(/[àáâ]/g,"a").replace(/[èéê]/g,"e")
                               .replace(/[ìíî]/g,"i").replace(/[òóô]/g,"o")
                               .replace(/[ùúû]/g,"u").replace(/ç/g,"c")
                               .replace(/[^a-z0-9]/g,"");
      return BAD_WORDS.some(w => n.includes(w.toLowerCase().replace(/[^a-z0-9]/g,"")));
    };

    confirmBtn.on("pointerover", () => confirmBtn.setStyle({ backgroundColor: "#00DDFF" }));
    confirmBtn.on("pointerout",  () => confirmBtn.setStyle({ backgroundColor: "#00BFFF" }));

    confirmBtn.on("pointerdown", async () => {
      const pseudo = pseudoValue.trim();

      if (pseudo.length < 2) {
        errorMsg.setText("Username must be at least 2 characters long.");
        return;
      }
      if (isBad(pseudo)) {
        errorMsg.setText("This username is not allowed.");
        return;
      }

      confirmBtn.disableInteractive();
      confirmBtn.setText("Checking...");
      errorMsg.setText("").setColor("#aaaaaa");

      // Firestore's security rules require an authenticated request, so we
      // must sign in (anonymously) BEFORE querying isPseudoTaken() — otherwise
      // that read is rejected and surfaces as a generic network error.
      let signedInAnon = false;
      try {
        await signInAsGuest();
        signedInAnon = true;

        const taken = await isPseudoTaken(pseudo);
        if (taken) {
          errorMsg.setText("This username is already taken, please choose another one.").setColor("#ff5555");
          confirmBtn.setInteractive();
          confirmBtn.setText("PLAY  ▶");
          return;
        }

        // The player document doesn't exist yet for a brand-new anonymous
        // account — loadPlayerData() creates it (via setDoc) on first read.
        // save.pseudo() uses updateDoc(), which fails if the doc doesn't
        // exist yet, so we must load/create the doc FIRST, then save the
        // username into it.
        const data = await loadPlayerData();

        // Store the username in localStorage AND in Firestore
        localStorage.setItem("jumpix_pseudo", pseudo);
        await save.pseudo(pseudo);
        data.pseudo = pseudo;

        applyPlayerData(data);
        this.scene.start("MenuScene");
      } catch (err) {
        console.error("Guest sign-in failed:", err);
        errorMsg.setText("Network error. Please check your connection.").setColor("#ff5555");
        confirmBtn.setInteractive();
        confirmBtn.setText("PLAY  ▶");
      }
    });
  }

  // =========================================================
  //  LOG IN POPUP (existing email account)
  // =========================================================
  _showLoginPopup() {
    const { width, height } = this.scale;
    const cx = width / 2, cy = height / 2;

    const overlay = this.add.rectangle(cx, cy, width, height, 0x000000, 0.85);
    const box     = this.add.rectangle(cx, cy, 460, 340, 0x1a1a2e).setStrokeStyle(2, 0x007ACC);
    const title   = this.add.text(cx, cy - 140, "LOG IN", {
      fontSize: "26px", color: "#007ACC", fontStyle: "bold"
    }).setOrigin(0.5);

    // ── Email field ──
    const emailLabel = this.add.text(cx - 190, cy - 100, "Email", {
      fontSize: "16px", color: "#aaaaaa"
    });
    const emailBox  = this.add.rectangle(cx, cy - 72, 360, 38, 0x000000).setStrokeStyle(1, 0x555555);
    const emailText = this.add.text(cx - 172, cy - 86, "", { fontSize: "18px", color: "#ffffff" });

    // ── Password field ──
    const pwLabel = this.add.text(cx - 190, cy - 30, "Password", {
      fontSize: "16px", color: "#aaaaaa"
    });
    const pwBox  = this.add.rectangle(cx, cy - 2, 360, 38, 0x000000).setStrokeStyle(1, 0x555555);
    const pwText = this.add.text(cx - 172, cy - 16, "", { fontSize: "18px", color: "#ffffff" });

    // ── Error message ──
    const errorMsg = this.add.text(cx, cy + 40, "", {
      fontSize: "15px", color: "#ff5555", align: "center", wordWrap: { width: 400 }
    }).setOrigin(0.5);

    // ── Buttons ──
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

    // ── Keyboard input ──
    let emailValue = "", pwValue = "", activeField = "email";

    emailBox.setInteractive();
    pwBox.setInteractive();
    emailBox.on("pointerdown", () => { activeField = "email"; this._highlightField(emailBox, pwBox); });
    pwBox.on("pointerdown",    () => { activeField = "pw";    this._highlightField(pwBox, emailBox); });
    this._highlightField(emailBox, pwBox); // initial focus on email

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
        const data = await loadPlayerData();
        applyPlayerData(data);
        destroy();
        this.sound.play("select", { volume: gameVolume });
        this.scene.start("MenuScene");
      } catch (err) {
        errorMsg.setText(firebaseErrorMessageEN(err.code)).setColor("#ff5555");
      }
    });
  }

  // ── Highlights the currently active input field ──────────
  _highlightField(active, ...inactives) {
    active.setStrokeStyle(2, 0x00BFFF);
    inactives.forEach(box => box.setStrokeStyle(1, 0x555555));
  }
}
