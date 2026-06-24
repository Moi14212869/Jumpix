// =========================================================
//              MINIGAME SCENE — DUEL LOCAL 2 JOUEURS
// =========================================================
// Mini-jeu multijoueur local : Joueur 1 (ZQSD ou WASD selon
// les paramètres) contre Joueur 2 (flèches directionnelles).
// Chacun contrôle un carré 40x40 avec double saut, comme dans
// les niveaux classiques. Atterrir sur la tête de l'adversaire
// marque un point. Score libre, affiché à gauche (J1) et à
// droite (J2). Un écran de sélection de map précède la partie.
// =========================================================

import { gameVolume, keyboardLayout, colorPlayer } from "../globals.js";
import { createPlatform } from "../utils/gameObjects.js";

const PLAYER_SIZE   = 40;
const JUMP_VELOCITY = -330;
const MOVE_SPEED    = 160;
const P2_COLOR      = 0xFF4444; // couleur fixe du joueur "flèches", contrastée avec les skins

export class MinigameScene extends Phaser.Scene {
  constructor() { super("MinigameScene"); }

  init() {
    this.mapChoice = null; // "empty" | "platforms" — choisi sur l'écran de sélection
    this.score1 = 0;
    this.score2 = 0;
  }

  create() {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0xADD8E6);

    this._showMapSelect();
  }

  // =========================================================
  //  ÉCRAN DE SÉLECTION DE MAP
  // =========================================================
  _showMapSelect() {
    const { width, height } = this.scale;
    const cx = width / 2, cy = height / 2;

    const elements = [];

    elements.push(
      this.add.text(cx, cy - 160, "⚔ DUEL LOCAL", {
        fontSize: "40px", color: "#ffffff", fontStyle: "bold"
      }).setOrigin(0.5)
    );
    elements.push(
      this.add.text(cx, cy - 110, "Choisis une map", {
        fontSize: "22px", color: "#cccccc"
      }).setOrigin(0.5)
    );

    // ── Aperçu "map vide" ──
    const previewW = 260, previewH = 130;
    const emptyX = cx - 170, platX = cx + 170;
    const previewY = cy - 10;

    const emptyBox = this.add.rectangle(emptyX, previewY, previewW, previewH, 0x1a1a2a)
      .setStrokeStyle(2, 0x00BFFF).setInteractive({ useHandCursor: true });
    elements.push(this.add.rectangle(emptyX, previewY + previewH / 2 - 14, previewW - 30, 14, 0xA0522D));
    elements.push(emptyBox);
    elements.push(
      this.add.text(emptyX, previewY + previewH / 2 + 20, "Map vide", {
        fontSize: "18px", color: "#ffffff", fontStyle: "bold"
      }).setOrigin(0.5)
    );

    // ── Aperçu "map avec plateformes" ──
    const platBox = this.add.rectangle(platX, previewY, previewW, previewH, 0x1a1a2a)
      .setStrokeStyle(2, 0x00BFFF).setInteractive({ useHandCursor: true });
    elements.push(this.add.rectangle(platX, previewY + previewH / 2 - 14, previewW - 30, 14, 0xA0522D));
    elements.push(this.add.rectangle(platX - 70, previewY + 5, 70, 10, 0xA0522D));
    elements.push(this.add.rectangle(platX + 60, previewY - 25, 70, 10, 0xA0522D));
    elements.push(platBox);
    elements.push(
      this.add.text(platX, previewY + previewH / 2 + 20, "Map avec plateformes", {
        fontSize: "16px", color: "#ffffff", fontStyle: "bold"
      }).setOrigin(0.5)
    );

    [emptyBox, platBox].forEach(box => {
      box.on("pointerover", () => box.setStrokeStyle(3, 0x00FFFF));
      box.on("pointerout",  () => box.setStrokeStyle(2, 0x00BFFF));
    });

    emptyBox.on("pointerdown", () => {
      this.sound.play("select", { volume: gameVolume });
      this.mapChoice = "empty";
      elements.forEach(o => o.destroy());
      this._startMatch();
    });
    platBox.on("pointerdown", () => {
      this.sound.play("select", { volume: gameVolume });
      this.mapChoice = "platforms";
      elements.forEach(o => o.destroy());
      this._startMatch();
    });

    // ── Retour menu ──
    const back = this.add.text(5, 5, "←", {
      fontSize: "24px", color: "#ffffff",
      backgroundColor: "#00BFFF", padding: { x: 7, y: 4 }
    }).setInteractive();
    back.on("pointerdown", () => {
      this.sound.play("menu", { volume: gameVolume });
      this.scene.start("MenuScene");
    });
    elements.push(back);
  }

  // =========================================================
  //  DÉMARRAGE DE LA PARTIE
  // =========================================================
  _startMatch() {
    const { width, height } = this.scale;

    // ── Groupes physiques ──
    this.platforms = this.physics.add.staticGroup();

    // ── Décor ──
    const groundY = height - 20;
    createPlatform(this, 0, groundY, width, 40, 0xA0522D);

    if (this.mapChoice === "platforms") {
      createPlatform(this, 100, height - 180, 160, 40, 0xA0522D);
      createPlatform(this, width - 260, height - 180, 160, 40, 0xA0522D);
      createPlatform(this, width / 2 - 80, height - 320, 160, 40, 0xA0522D);
    }

    // ── Points de départ ──
    this.start1 = { x: width * 0.25, y: groundY - 100 };
    this.start2 = { x: width * 0.75, y: groundY - 100 };

    // ── Textures joueurs ──
    const makePlayerTexture = (key, color) => {
      const gfx = this.add.graphics();
      gfx.fillStyle(color, 1);
      gfx.fillRect(0, 0, PLAYER_SIZE, PLAYER_SIZE);
      gfx.generateTexture(key, PLAYER_SIZE, PLAYER_SIZE);
      gfx.destroy();
    };
    makePlayerTexture("mg-player1", colorPlayer);
    makePlayerTexture("mg-player2", P2_COLOR);

    // ── Joueur 1 (ZQSD/WASD) ──
    this.player1 = this.physics.add.sprite(this.start1.x, this.start1.y, "mg-player1");
    this.player1.setBounce(0.2).setCollideWorldBounds(true);
    this.player1.jumpCount = 0;

    // ── Joueur 2 (flèches) ──
    this.player2 = this.physics.add.sprite(this.start2.x, this.start2.y, "mg-player2");
    this.player2.setBounce(0.2).setCollideWorldBounds(true);
    this.player2.jumpCount = 0;

    // ── Contrôles ──
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys1 = this.input.keyboard.addKeys(
      keyboardLayout === "zqsd"
        ? { up: Phaser.Input.Keyboard.KeyCodes.Z, left: Phaser.Input.Keyboard.KeyCodes.Q,
            down: Phaser.Input.Keyboard.KeyCodes.S, right: Phaser.Input.Keyboard.KeyCodes.D }
        : { up: Phaser.Input.Keyboard.KeyCodes.W, left: Phaser.Input.Keyboard.KeyCodes.A,
            down: Phaser.Input.Keyboard.KeyCodes.S, right: Phaser.Input.Keyboard.KeyCodes.D }
    );

    // ── Collisions avec le décor ──
    this.physics.add.collider(this.player1, this.platforms);
    this.physics.add.collider(this.player2, this.platforms);

    // ── Détection "atterrissage sur la tête" ──
    this.physics.add.overlap(this.player1, this.player2, () => this._handleStomp(), null, this);

    // ── UI : scores ──
    this.score1Text = this.add.text(20, 20, `${this.score1}`, {
      fontSize: "42px", color: "#ffffff", fontStyle: "bold"
    }).setOrigin(0, 0).setScrollFactor(0).setDepth(10);
    this._tintText(this.score1Text, colorPlayer);

    this.score2Text = this.add.text(width - 20, 20, `${this.score2}`, {
      fontSize: "42px", color: "#ffffff", fontStyle: "bold"
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(10);
    this._tintText(this.score2Text, P2_COLOR);

    this.add.text(20, 70, "J1 (clavier)", {
      fontSize: "13px", color: "#888888"
    }).setOrigin(0, 0).setScrollFactor(0).setDepth(10);
    this.add.text(width - 20, 70, "J2 (flèches)", {
      fontSize: "13px", color: "#888888"
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(10);

    // ── Bouton retour menu ──
    const back = this.add.text(width / 2, 20, "← Menu", {
      fontSize: "16px", color: "#ffffff",
      backgroundColor: "#00BFFF", padding: { x: 10, y: 5 }
    }).setOrigin(0.5, 0).setInteractive().setScrollFactor(0).setDepth(10);
    back.on("pointerdown", () => {
      this.sound.play("menu", { volume: gameVolume });
      this.scene.start("MenuScene");
    });
  }

  // ── Colore le texte de score (approx via couleur hex) ────
  _tintText(textObj, colorInt) {
    const hex = "#" + colorInt.toString(16).padStart(6, "0");
    textObj.setColor(hex);
  }

  // ── Logique de duel : qui écrase qui ? ────────────────────
  _handleStomp() {
    if (this._resolvingStomp) return; // évite double-déclenchement le même frame

    const p1 = this.player1, p2 = this.player2;

    const p1OnTopOfP2 =
      p1.body.velocity.y > 0 &&
      (p1.y + p1.displayHeight / 2) <= (p2.y - p2.displayHeight / 2) + 14;

    const p2OnTopOfP1 =
      p2.body.velocity.y > 0 &&
      (p2.y + p2.displayHeight / 2) <= (p1.y - p1.displayHeight / 2) + 14;

    if (p1OnTopOfP2 && !p2OnTopOfP1) {
      this._scorePoint(1);
    } else if (p2OnTopOfP1 && !p1OnTopOfP2) {
      this._scorePoint(2);
    }
    // Si ambigu (collision latérale, ou les deux conditions à la fois) → pas de point
  }

  _scorePoint(winner) {
    this._resolvingStomp = true;

    if (winner === 1) {
      this.score1++;
      this.score1Text.setText(`${this.score1}`);
    } else {
      this.score2++;
      this.score2Text.setText(`${this.score2}`);
    }

    this.sound.play("kill", { volume: gameVolume });

    // Petit effet de victoire : bounce du gagnant avant le reset
    const winnerSprite = winner === 1 ? this.player1 : this.player2;
    winnerSprite.setVelocityY(-250);

    this.time.delayedCall(350, () => this._resetRound());
  }

  // ── Remet les deux joueurs à leur position de départ ──────
  _resetRound() {
    this.player1.setPosition(this.start1.x, this.start1.y);
    this.player1.setVelocity(0, 0);
    this.player1.angle = 0;
    this.player1.jumpCount = 0;

    this.player2.setPosition(this.start2.x, this.start2.y);
    this.player2.setVelocity(0, 0);
    this.player2.angle = 0;
    this.player2.jumpCount = 0;

    this._resolvingStomp = false;
  }

  // ── Saut / double saut générique ──────────────────────────
  _jump(player) {
    if (player.jumpCount >= 2) return;

    player.setVelocityY(JUMP_VELOCITY);

    const dir = player.body.velocity.x > 0 ? 1
              : player.body.velocity.x < 0 ? -1 : 1;

    if (player.jumpCount === 1) {
      this.tweens.add({
        targets: player,
        angle: (player.angle + 180 * dir) % 360,
        duration: 300, ease: "Cubic.easeOut"
      });
    }

    this.sound.play("jump", { volume: gameVolume });
    player.jumpCount++;
  }

  // ── Update ─────────────────────────────────────────────────
  update() {
    if (!this.player1 || !this.player2) return; // écran de sélection encore affiché

    const p1 = this.player1, p2 = this.player2;

    // Reset du compteur de sauts au contact du sol/plateforme
    if (p1.body.touching.down) p1.jumpCount = 0;
    if (p2.body.touching.down) p2.jumpCount = 0;

    // ── Joueur 1 : ZQSD/WASD ──
    const left1  = this.keys1.left.isDown;
    const right1 = this.keys1.right.isDown;
    if (left1)       p1.setVelocityX(-MOVE_SPEED);
    else if (right1) p1.setVelocityX(MOVE_SPEED);
    else              p1.setVelocityX(0);

    if (Phaser.Input.Keyboard.JustDown(this.keys1.up)) this._jump(p1);

    // ── Joueur 2 : flèches ──
    const left2  = this.cursors.left.isDown;
    const right2 = this.cursors.right.isDown;
    if (left2)       p2.setVelocityX(-MOVE_SPEED);
    else if (right2) p2.setVelocityX(MOVE_SPEED);
    else              p2.setVelocityX(0);

    if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) this._jump(p2);
  }
}
