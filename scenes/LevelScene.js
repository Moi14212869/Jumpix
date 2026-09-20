// =========================================================
//                      LEVEL SCENE
// =========================================================

import {
  gameVolume, keyboardLayout, colorPlayer, playerCoins,
  dead, kill, party,
  setDead, setKill, setParty, setPlayerCoins,
  markLevelCompleted, bestTimes, updateBestTime,
  bestRanks, updateBestRank,
} from "../globals.js";
import { checkObjectives }   from "../utils/helpers.js";
import { save, saveLeaderboard } from "../utils/db.js";
import { isMobile } from "../utils/mobile.js";
import {
  createPlatform, createIcePlatform, createRedTriangle,
  createRedCircle, createRedSquare, createBlueCircle,
  createSnow, createMobileControls, createSnowstorm,
  finalizeSnowLayer, createLavaBlock, createExitPortalSpiral
} from "../utils/gameObjects.js";


export class LevelScene extends Phaser.Scene {
  constructor() { super("LevelScene"); }

  init(data) { this.levelKey = data.levelKey; }

  preload() {
    // Si le JSON est déjà dans le cache (ex : niveau éditeur injecté en mémoire),
    // on ne tente pas de le charger depuis le disque — ce qui provoquerait une erreur 404.
    if (!this.cache.json.has(this.levelKey)) {
      this.load.json(this.levelKey, `levels/${this.levelKey}.json`);
    }
  }

  create() {
    const level = this.cache.json.get(this.levelKey);

    if (level.nextScene === "World2") createSnow(this);

    this.onIce             = false;
    this.sliding           = false;
    this.slideDir          = 0;
    this.inheritedSlideDir = 0;
    this.isWorld2          = (level.nextScene === "World2");
    this.transitioning     = false;
    this.dyingInLava       = false;   // true pendant l'enfoncement dans la lave (3s)
    this.startTime         = null;   // ⏱ démarre à la première action du joueur
    this.finalTime         = null;   // ⏱ figé au contact du cercle bleu

    // ── Groupes physiques ──
    this.platforms    = this.physics.add.staticGroup();
    this.spikes       = this.physics.add.staticGroup();
    this.redCircles   = this.physics.add.group();
    this.redSquares   = this.physics.add.group();
    this.icePlatforms = this.physics.add.staticGroup();
    this.snowstorms   = this.physics.add.staticGroup();
    this.lavaBlocks   = this.physics.add.staticGroup();

    this.input.addPointer(2);
    this.cursors    = this.input.keyboard.createCursorKeys();
    this.slideSound = this.sound.add("slide", { volume: gameVolume });

    this.keys = this.input.keyboard.addKeys(
      keyboardLayout === "zqsd"
        ? { up: Phaser.Input.Keyboard.KeyCodes.Z, left: Phaser.Input.Keyboard.KeyCodes.Q,
            down: Phaser.Input.Keyboard.KeyCodes.S, right: Phaser.Input.Keyboard.KeyCodes.D }
        : { up: Phaser.Input.Keyboard.KeyCodes.W, left: Phaser.Input.Keyboard.KeyCodes.A,
            down: Phaser.Input.Keyboard.KeyCodes.S, right: Phaser.Input.Keyboard.KeyCodes.D }
    );

    this.jumpCount = 0;
    this.mobileJumpQueued = false;

    // ── Construction du niveau ──
    level.platforms.forEach(p => {
      const color = typeof p.color === "string" ? parseInt(p.color) : (p.color || 0xA0522D);
      createPlatform(this, p.x, p.y, p.w, p.h || 40, color);
    });

    // Une fois TOUTES les plateformes du niveau créées, on décide, bloc par
    // bloc, si la couche de neige doit s'afficher (rangée du haut, non
    // recouverte par une autre plateforme). Doit rester après la boucle
    // ci-dessus, quel que soit l'ordre des plateformes dans le JSON.
    finalizeSnowLayer(this);

    level.spikes.forEach(s =>
      createRedTriangle(this, s.x, s.y, s.orientation || "up")
    );

    if (level.redCircles) {
      level.redCircles.forEach(c =>
        this.redCircles.add(createRedCircle(this, c.x, c.y, c.rise, c.direction || "up"))
      );
    }

    if (level.redSquares) {
      level.redSquares.forEach(r =>
        this.redSquares.add(createRedSquare(r.x, r.y, this, r.rise, r.direction))
      );
    }

    if (level.icePlatforms) {
      level.icePlatforms.forEach(p =>
        createIcePlatform(this, p.x, p.y, p.w, p.h || 40)
      );
    }

    if (level.snowstorms) {
      level.snowstorms.forEach(s => {
        const zone = createSnowstorm(this, s.x, s.y, s.h || 80);
        this.snowstorms.add(zone);
      });
    }

    if (level.lavaBlocks) {
      level.lavaBlocks.forEach(l => createLavaBlock(this, l.x, l.y));
    }

    // ── Joueur ──
    const size = 40;
    const gfx  = this.add.graphics();
    gfx.fillStyle(colorPlayer, 1);
    gfx.fillRect(0, 0, size, size);
    gfx.generateTexture("player", size, size);
    gfx.destroy();

    this.player = this.physics.add.sprite(level.playerStart.x, level.playerStart.y, "player");
    this.player.setBounce(0.2).setCollideWorldBounds(true);

    // ── Sortie ──
    this.blueCircle = createBlueCircle(this, level.blueCircle.x, level.blueCircle.y);
    createExitPortalSpiral(this, level.blueCircle.x, level.blueCircle.y);

    // ── Bouton retour ──
    const backButton = this.add.text(5, 5, "←", {
      fontSize: "24px", color: "#ffffff",
      backgroundColor: "#00BFFF", padding: { x: 7, y: 4 }
    }).setInteractive();
    backButton.on("pointerdown", () => {
      this.sound.play("menu", { volume: gameVolume });
      this.scene.start(level.nextScene);
    });

    // ── Chrono affiché en haut à droite ──
    this.chronoText = this.add.text(795, 5, "0.00s", {
      fontSize: "22px", color: "#ffffff",
      backgroundColor: "#00000066", padding: { x: 6, y: 3 }
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(10);

    // ── Collisions ──
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.player, this.icePlatforms,
      () => { this.onIce = true; }, null, this
    );
    this.physics.add.collider(this.redSquares, this.platforms);
    this.physics.add.collider(this.player, this.spikes, () => this.die());
    this.physics.add.collider(this.player, this.lavaBlocks, () => this.sinkInLava());
    this.physics.add.overlap(this.player, this.redCircles, () => this.die());

    // ── Tempêtes de neige : éjection vers le haut ──
    this.physics.add.overlap(this.player, this.snowstorms, (player) => {
      // Lance le joueur vers le haut avec une impulsion puissante
      player.setVelocityY(-600);
      // Réinitialise le compteur de sauts (l'éjection compte comme un rebond)
      this.jumpCount = 0;
      // Son de saut pour le feedback
      this.sound.play("jump", { volume: gameVolume });
    }, null, this);

    // Collision avec les carrés rouges : on utilise un vrai collider (avec séparation
    // physique) plutôt qu'un simple overlap. Avec overlap(), la détection ne se faisait
    // qu'une fois par frame *après* que le joueur ait déjà pénétré dans le carré — et un
    // seuil fixe de 10px pour dire "atterrissage" ne suffisait plus dès que le joueur
    // tombait vite (après un double saut, ou une longue chute qui accélère la vélocité) :
    // en un seul pas de physique, le joueur pouvait s'enfoncer de bien plus de 10px avant
    // que la vérification ne se déclenche, ce qui faisait basculer par erreur sur la
    // branche "collision latérale" → mort, alors qu'il s'agissait bien d'un atterrissage.
    // Le collider calcule une vraie séparation et expose body.touching, qui reste fiable
    // quelle que soit la vitesse du joueur.
    this.physics.add.collider(this.player, this.redSquares, (player, square) => {
      if (player.body.touching.down && !player.body.touching.left && !player.body.touching.right) {
        // Saut sur le carré — enregistre un kill
        const newKill = kill + 1;
        setKill(newKill);
        save.kill(newKill);
        checkObjectives({ kill: newKill });

        this.sound.play("kill", { volume: gameVolume });
        player.setVelocityY(-200);
        this.tweens.add({
          targets: square, scaleX: 0, scaleY: 0,
          duration: 300, ease: "Cubic.easeIn",
          onComplete: () => square.destroy()
        });
      } else {
        this.die();
      }
    }, null, this);

    this.physics.add.overlap(this.player, this.blueCircle, () => {
      if (this.transitioning) return;
      this.transitioning = true;

      // ⏱ Figer le chrono au moment du contact
      this.finalTime = (this.startTime !== null)
        ? Math.floor(this.time.now - this.startTime)
        : null;

      this.sound.play("victory", { volume: gameVolume });

      const newParty = party + 1;
      setParty(newParty);
      save.party(newParty);
      checkObjectives({ party: newParty });

      this.player.body.enable = false;

      this.tweens.add({
        targets: this.player,
        x: this.blueCircle.x, y: this.blueCircle.y,
        scale: 0.3, angle: 720, duration: 800, ease: "Cubic.easeInOut",
        onComplete: async () => {
          const reward    = level.reward || 0;
          const newCoins  = playerCoins + reward;
          setPlayerCoins(newCoins);
          if (reward > 0) await save.coins(newCoins);

          // Marquer ce niveau comme terminé (pas pour les niveaux éditeur)
          if (this.levelKey !== "__editorLevel__") {
            markLevelCompleted(this.levelKey);
            await save.level(this.levelKey);
          }

          // ⏱ Meilleur temps (pas pour les niveaux éditeur)
          const elapsed = this.finalTime;
          let isNewRecord = false;
          if (elapsed !== null && this.levelKey !== "__editorLevel__") {
            const prev = bestTimes[this.levelKey];
            if (prev === undefined || elapsed < prev) {
              isNewRecord = true;
              updateBestTime(this.levelKey, elapsed);
              await save.bestTime(this.levelKey, elapsed);
              const rank = await saveLeaderboard(this.levelKey, elapsed);
              if (rank !== null) {
                const prevRank = bestRanks[this.levelKey];
                if (prevRank === undefined || rank < prevRank) {
                  updateBestRank(this.levelKey, rank);
                  await save.bestRank(this.levelKey, rank);
                }
              }
            }
          }

          this._showVictoryScreen(level, elapsed, isNewRecord);
        }
      });
    }, null, this);

    // Boutons tactiles (uniquement sur mobile : renvoie null sur PC)
    this.mobileControls = createMobileControls(this);

    // ── Tutoriel double saut (Level1 uniquement) ──
    if (this.levelKey === "Level1") {
      this._showDoubleJumpTutorial();
    }
  }

  // ── Tutoriel double saut ───────────────────────────────
  _showDoubleJumpTutorial() {
    const LS_KEY = "jumpix_doubleJumpTutorialSeen";
    if (localStorage.getItem(LS_KEY) === "true") return;

    const { width, height } = this.scale;
    const cx = width / 2, cy = height / 2;
    const W = 460, H = 370;
    const x0 = cx - W / 2, y0 = cy - H / 2;
    const DEPTH = 30;
    this._tutorialOpen = true;

    // Fond semi-transparent
    const overlay = this.add.rectangle(cx, cy, width, height, 0x000000, 0.55)
      .setScrollFactor(0).setDepth(DEPTH).setInteractive();
    overlay.on("pointerdown", () => {});

    // Boîte
    const box = this.add.graphics().setScrollFactor(0).setDepth(DEPTH);
    box.fillStyle(0x1a1a2e, 1);
    box.fillRoundedRect(x0, y0, W, H, 16);
    box.lineStyle(2, 0x00bfff, 1);
    box.strokeRoundedRect(x0, y0, W, H, 16);

    // Titre
    this.add.text(cx, y0 + 26, "Double saut", {
      fontSize: "22px", color: "#00BFFF", fontStyle: "bold"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH + 1);

    // Illustration (Phaser Graphics)
    const ilY = y0 + 58;
    const ilH = 175;
    const peakX = cx - 55;
    const peakY = ilY + 10;
    const groundY = ilY + ilH - 8;

    const g = this.add.graphics().setScrollFactor(0).setDepth(DEPTH + 1);

    const arc1 = [];
    for (let t = 0; t <= 1; t += 0.05)
      arc1.push({ x: cx - 120 + t * 120, y: groundY - Math.sin(t * Math.PI) * ilH });
    const arc2 = [];
    for (let t = 0; t <= 1; t += 0.05)
      arc2.push({ x: peakX + t * 135, y: peakY - Math.sin(t * Math.PI) * 68 + t * (groundY - peakY) });

    const pSq = this.add.rectangle(cx - 120, groundY - 9, 18, 18, 0xaa66cc)
      .setScrollFactor(0).setDepth(DEPTH + 2);

    let phase = 1, ti = 0;
    const animTimer = this.time.addEvent({
      delay: 16, loop: true, callback: () => {
        ti += phase === 1 ? 0.007 : 0.009;
        if (ti >= 1) { phase = phase === 1 ? 2 : 1; ti = 0; }
        const pts = phase === 1 ? arc1 : arc2;
        const idx = Math.min(Math.floor(ti * (pts.length - 1)), pts.length - 2);
        const a = pts[idx], b = pts[idx + 1], f = (ti * (pts.length - 1)) - idx;
        pSq.x = a.x + (b.x - a.x) * f;
        pSq.y = a.y + (b.y - a.y) * f - 9;
        g.clear();
        g.fillStyle(0x4a4a6a, 1);
        g.fillRect(x0 + 20, groundY, W - 40, 10);
        g.lineStyle(2, 0x888888, 0.5);
        g.beginPath();
        arc1.forEach((p, i) => i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y));
        g.strokePath();
        g.lineStyle(3, 0x00ff99, 0.9);
        g.beginPath();
        arc2.forEach((p, i) => i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y));
        g.strokePath();
        const hr = 10 + 8 * Math.abs(Math.sin(Date.now() * 0.003));
        g.fillStyle(0x00bfff, 0.15);
        g.fillCircle(peakX, peakY, hr);
        g.lineStyle(1.5, 0x00bfff, 0.8);
        g.strokeCircle(peakX, peakY, hr);
      }
    });

    this.add.text(peakX, peakY - 26, "appuie ici !", {
      fontSize: "12px", color: "#00bfff"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH + 2);
    this.add.text(peakX + 80, peakY + 20, "2e saut →", {
      fontSize: "12px", color: "#00ff99"
    }).setScrollFactor(0).setDepth(DEPTH + 2);

    this.add.text(cx, y0 + H - 108, "Attends le sommet du 1er saut,\npuis appuie ⬆ une 2e fois !", {
      fontSize: "15px", color: "#ffffff", align: "center", lineSpacing: 6
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH + 1);

    let dontShow = false;
    const cbBg = this.add.rectangle(x0 + 30, y0 + H - 38, 18, 18, 0x333355)
      .setStrokeStyle(1.5, 0x00bfff).setScrollFactor(0).setDepth(DEPTH + 1).setInteractive();
    const cbMark = this.add.text(x0 + 30, y0 + H - 38, "✓", {
      fontSize: "14px", color: "#00ff99"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH + 2).setAlpha(0);
    this.add.text(x0 + 44, y0 + H - 38, "Ne plus me montrer", {
      fontSize: "13px", color: "#aaaaaa"
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(DEPTH + 1);
    cbBg.on("pointerdown", () => {
      dontShow = !dontShow;
      cbMark.setAlpha(dontShow ? 1 : 0);
      cbBg.setFillStyle(dontShow ? 0x004433 : 0x333355);
      if (dontShow) localStorage.setItem(LS_KEY, "true");
      else          localStorage.removeItem(LS_KEY);
    });

    const closeBtn = this.add.text(x0 + W - 14, y0 + 14, "✕", {
      fontSize: "18px", color: "#ffffff",
      backgroundColor: "#333355", padding: { x: 6, y: 3 }
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(DEPTH + 2).setInteractive();
    closeBtn.on("pointerover", () => closeBtn.setStyle({ color: "#00bfff" }));
    closeBtn.on("pointerout",  () => closeBtn.setStyle({ color: "#ffffff" }));
    closeBtn.on("pointerdown", () => {
      this._tutorialOpen = false;
      animTimer.remove();
      this.children.list
        .filter(c => c.depth >= DEPTH)
        .forEach(c => c.destroy());
    });
  }

  // ── Écran de victoire ─────────────────────────────────
  _showVictoryScreen(level, elapsed, isNewRecord) {
    const { width, height } = this.scale;
    const cx = width / 2, cy = height / 2;

    this.mobileControls?.setVisible(false);

    this.add.rectangle(cx, cy, width, height, 0x000000, 0.65).setScrollFactor(0).setDepth(20);

    this.add.text(cx, cy - 110, "✅ NIVEAU TERMINÉ !", {
      fontSize: "36px", color: "#FFD700", fontStyle: "bold"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(21);

    if (elapsed !== null) {
      const timeStr = (elapsed / 1000).toFixed(2) + "s";
      const recordStr = isNewRecord ? "  🏆 Nouveau record !" : "";
      this.add.text(cx, cy - 55, `⏱ ${timeStr}${recordStr}`, {
        fontSize: "24px", color: isNewRecord ? "#00FF99" : "#ffffff"
      }).setOrigin(0.5).setScrollFactor(0).setDepth(21);
    }

    const hintLabel = isMobile()
      ? "Appuie sur Rejouer pour recommencer"
      : "Appuie sur n'importe quelle touche pour rejouer";
    const hint = this.add.text(cx, cy - 10, hintLabel, {
      fontSize: "16px", color: "#aaaaaa"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(21);

    this.tweens.add({
      targets: hint, alpha: 0, duration: 600,
      yoyo: true, repeat: -1, ease: "Sine.easeInOut"
    });

    const replayBtn = this.add.text(cx - 90, cy + 55, "🔄 Rejouer", {
      fontSize: "26px", color: "#ffffff",
      backgroundColor: "#00BFFF", padding: { x: 18, y: 10 }
    }).setOrigin(0.5).setInteractive().setScrollFactor(0).setDepth(21);

    replayBtn.on("pointerover", () => replayBtn.setStyle({ backgroundColor: "#00DFFF" }));
    replayBtn.on("pointerout",  () => replayBtn.setStyle({ backgroundColor: "#00BFFF" }));
    replayBtn.on("pointerdown", () => {
      this.sound.play("select", { volume: gameVolume });
      this._doReplay();
    });

    const quitBtn = this.add.text(cx + 90, cy + 55, "🚪 Quitter", {
      fontSize: "26px", color: "#ffffff",
      backgroundColor: "#444444", padding: { x: 18, y: 10 }
    }).setOrigin(0.5).setInteractive().setScrollFactor(0).setDepth(21);

    quitBtn.on("pointerover", () => quitBtn.setStyle({ backgroundColor: "#666666" }));
    quitBtn.on("pointerout",  () => quitBtn.setStyle({ backgroundColor: "#444444" }));
    quitBtn.on("pointerdown", () => {
      this.sound.play("menu", { volume: gameVolume });
      this.scene.start(level.nextScene);
    });

    this.input.keyboard.once("keydown", () => this._doReplay());
  }

  _doReplay() {
    this.scene.restart({ levelKey: this.levelKey });
  }

  // ── Mort ──────────────────────────────────────────────
  die() {
    this.sound.play("dead", { volume: gameVolume });
    this._recordDeath();
  }

  // ── Mort par lave : le joueur s'enfonce dedans pendant 3s ──
  // avant que la mort ne soit réellement comptabilisée. Pendant ce temps,
  // les contrôles et la physique du joueur sont coupés (même principe que
  // la séquence de victoire : body.enable = false, puis un tween pilote
  // la position à la main).
  sinkInLava() {
    if (this.dyingInLava || this.transitioning) return;
    this.dyingInLava = true;

    this.player.body.enable = false;
    this.sound.play("lava", { volume: gameVolume });

    this.tweens.add({
      targets: this.player,
      y: this.player.y + 46,  // s'enfonce dans le bloc, un peu plus qu'un bloc entier
      angle: 20,
      alpha: 0.15,
      duration: 1500,
      ease: "Sine.easeIn",
      onComplete: () => this._recordDeath()
    });
  }

  // Comptabilise la mort et relance le niveau. Séparé de die() car
  // sinkInLava() joue déjà le son "lava" et ne doit pas rejouer "dead".
  _recordDeath() {
    const newDead = dead + 1;
    setDead(newDead);
    save.dead(newDead);
    checkObjectives({ dead: newDead });
    this.scene.restart({ levelKey: this.levelKey });
  }

  // ── Update ────────────────────────────────────────────
  update() {
    const p     = this.player;
    const up    = this.cursors.up.isDown    || this.keys.up.isDown || !!this.mobileControls?.state.jump;
    const left  = this.cursors.left.isDown  || this.keys.left.isDown  || this.movingLeft;
    const right = this.cursors.right.isDown || this.keys.right.isDown || this.movingRight;

    // ⏱ Démarrer le chrono à la première action
    if (this.startTime === null && (left || right || up)) {
      this.startTime = this.time.now;
    }

    if (this.transitioning && this.finalTime !== null) {
      this.chronoText.setText((this.finalTime / 1000).toFixed(2) + "s");
    } else if (this.startTime !== null) {
      const elapsed = (this.time.now - this.startTime) / 1000;
      this.chronoText.setText(elapsed.toFixed(2) + "s");
    } else {
      this.chronoText.setText("–");
    }

    if (p.body.touching.down && this.onIce) {
      if (!this.sliding) {
        if (left || right) {
          this.sliding  = true;
          this.slideDir = left ? -1 : 1;
        } else if (this.inheritedSlideDir !== 0) {
          this.sliding  = true;
          this.slideDir = this.inheritedSlideDir;
        }
        if (this.sliding) this.slideSound.play();
      }
      if (this.sliding) p.setVelocityX(220 * this.slideDir);
    } else {
      this.sliding  = false;
      this.slideDir = 0;
      if      (left)  p.setVelocityX(-160);
      else if (right) p.setVelocityX(160);
      else            p.setVelocityX(0);
    }

    this.onIce = false;

    if (p.body.touching.down) this.jumpCount = 0;

    // Saut demandé par le bouton tactile (mis en file par createMobileControls)
    const mobileJump = this.mobileJumpQueued;
    this.mobileJumpQueued = false;

    if (
      Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
      Phaser.Input.Keyboard.JustDown(this.keys.up) ||
      mobileJump
    ) {
      this.jumpPlayer();
    }
  }

  // ── Saut / double saut ────────────────────────────────
  jumpPlayer() {
    if (this.jumpCount >= 2) return;

    this.player.setVelocityY(-330);

    const dir = this.player.body.velocity.x > 0 ? 1
              : this.player.body.velocity.x < 0 ? -1 : 1;

    if (this.jumpCount === 1) {
      this.tweens.add({
        targets: this.player,
        angle: (this.player.angle + 180 * dir) % 360,
        duration: 300, ease: "Cubic.easeOut"
      });
    }

    if (this.onIce) {
      const left  = this.cursors.left.isDown  || this.keys.left.isDown  || this.movingLeft;
      const right = this.cursors.right.isDown || this.keys.right.isDown || this.movingRight;
      this.inheritedSlideDir = left ? -1 : right ? 1 : this.slideDir;
    }

    this.sound.play("jump", { volume: gameVolume });
    this.jumpCount++;
  }
}
