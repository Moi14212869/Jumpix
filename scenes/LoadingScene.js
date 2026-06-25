// =========================================================
//                    LOADING SCENE
// =========================================================
// Charge les assets audio, attend que Firebase ait résolu
// l'état d'authentification, puis charge la progression
// si l'utilisateur est connecté.
// =========================================================

import { gameVolume, applyPlayerData } from "../globals.js";
import { waitForAuthReady }            from "../utils/firebase.js";
import { signInAsGuest }               from "../utils/firebase.js";
import { loadPlayerData, save, isPseudoTaken } from "../utils/db.js";

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
          await save.pseudo(savedPseudo);
          const data = await loadPlayerData();
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
  //  POPUP PSEUDO (première visite)
  // =========================================================
  _showPseudoPopup() {
    const { width, height } = this.scale;
    const cx = width / 2, cy = height / 2;

    // Fond semi-opaque
    this.add.rectangle(cx, cy, width, height, 0x000000, 0.85);

    // Boîte centrale
    this.add.rectangle(cx, cy, 480, 310, 0x1a1a2e).setStrokeStyle(3, 0x00BFFF);

    this.add.text(cx, cy - 120, "Bienvenue sur Jumpix ! 🎮", {
      fontSize: "26px", color: "#00BFFF", fontStyle: "bold"
    }).setOrigin(0.5);

    this.add.text(cx, cy - 78, "Choisis ton pseudo pour jouer :", {
      fontSize: "18px", color: "#cccccc"
    }).setOrigin(0.5);

    // Champ de saisie
    const inputBox  = this.add.rectangle(cx, cy - 28, 340, 44, 0x000000)
      .setStrokeStyle(2, 0x00BFFF).setInteractive();
    const inputText = this.add.text(cx - 162, cy - 44, "", {
      fontSize: "22px", color: "#ffffff"
    });
    const cursor = this.add.text(cx - 162, cy - 44, "|", {
      fontSize: "22px", color: "#00BFFF"
    });

    // Clignotement du curseur
    this.time.addEvent({
      delay: 500, loop: true,
      callback: () => { cursor.setVisible(!cursor.visible); }
    });

    const errorMsg = this.add.text(cx, cy + 22, "", {
      fontSize: "15px", color: "#ff5555", align: "center", wordWrap: { width: 400 }
    }).setOrigin(0.5);

    const confirmBtn = this.add.text(cx, cy + 75, "JOUER  ▶", {
      fontSize: "24px", color: "#000000",
      backgroundColor: "#00BFFF", padding: { x: 28, y: 12 }
    }).setOrigin(0.5).setInteractive();

    const hint = this.add.text(cx, cy + 130, "Tu pourras lier un compte email plus tard\npour jouer sur plusieurs appareils.", {
      fontSize: "13px", color: "#666666", align: "center"
    }).setOrigin(0.5);

    // ── Saisie clavier ──────────────────────────────────────
    let pseudoValue = "";

    const updateDisplay = () => {
      inputText.setText(pseudoValue);
      // Déplace le curseur après le texte
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
        errorMsg.setText("Le pseudo doit faire au moins 2 caractères.");
        return;
      }
      if (isBad(pseudo)) {
        errorMsg.setText("Ce pseudo n'est pas autorisé.");
        return;
      }

      confirmBtn.disableInteractive();
      confirmBtn.setText("Vérification...");
      errorMsg.setText("").setColor("#aaaaaa");

      try {
        const taken = await isPseudoTaken(pseudo);
        if (taken) {
          errorMsg.setText("Ce pseudo est déjà pris, choisis-en un autre.").setColor("#ff5555");
          confirmBtn.setInteractive();
          confirmBtn.setText("JOUER  ▶");
          return;
        }

        // Connexion anonyme Firebase (uid permanent pour ce navigateur)
        await signInAsGuest();
        // Stocker le pseudo en localStorage ET dans Firestore
        localStorage.setItem("jumpix_pseudo", pseudo);
        await save.pseudo(pseudo);

        const data = await loadPlayerData();
        applyPlayerData(data);
        this.scene.start("MenuScene");
      } catch (err) {
        console.error("Guest sign-in failed:", err);
        errorMsg.setText("Erreur réseau. Vérifiez votre connexion.").setColor("#ff5555");
        confirmBtn.setInteractive();
        confirmBtn.setText("JOUER  ▶");
      }
    });
  }
}
