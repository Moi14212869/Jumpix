// =========================================================
//                      LEVEL SCENE
// =========================================================

import {
  gameVolume, keyboardLayout, colorPlayer, playerCoins,
  dead, kill, party,
  setDead, setKill, setParty, setPlayerCoins
} from "../globals.js";
import { checkObjectives }   from "../utils/helpers.js";
import { save }              from "../utils/db.js";
import {
  createPlatform, createIcePlatform, createRedTriangle,
  createRedCircle, createRedSquare, createBlueCircle,
  createSnow, createMobileControls
} from "../utils/gameObjects.js";

export class LevelScene extends Phaser.Scene {
  constructor() { super("LevelScene"); }

  init(data) { this.levelKey = data.levelKey; }

  preload() {
    this.load.json(this.levelKey, `levels/${this.levelKey}.json`);
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

    // ── Groupes physiques ──
    this.platforms    = this.physics.add.staticGroup();
    this.spikes       = this.physics.add.staticGroup();
    this.redCircles   = this.physics.add.group();
    this.redSquares   = this.physics.add.group();
    this.icePlatforms = this.physics.add.staticGroup();

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

    // ── Construction du niveau ──
    level.platforms.forEach(p => {
      const color = typeof p.color === "string" ? parseInt(p.color) : (p.color || 0xA0522D);
      createPlatform(this, p.x, p.y, p.w, p.h || 40, color);
    });

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

    // ── Bouton retour ──
    const backButton = this.add.text(5, 5, "←", {
      fontSize: "24px", color: "#ffffff",
      backgroundColor: "#00BFFF", padding: { x: 7, y: 4 }
    }).setInteractive();
    backButton.on("pointerdown", () => {
      this.sound.play("menu", { volume: gameVolume });
      this.scene.start(level.nextScene);
    });

    // ── Collisions ──
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.player, this.icePlatforms,
      () => { this.onIce = true; }, null, this
    );
    this.physics.add.collider(this.redSquares, this.platforms);
    this.physics.add.collider(this.player, this.spikes, () => this.die());
    this.physics.add.overlap(this.player, this.redCircles, () => this.die());

    this.physics.add.overlap(this.player, this.redSquares, (player, square) => {
      const verticalDiff = (player.y + player.displayHeight / 2) - (square.y - square.displayHeight / 2);

      if (verticalDiff < 10 && player.body.velocity.y > 0) {
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
          this.scene.start(level.nextScene);
        }
      });
    }, null, this);

    createMobileControls(this);
  }

  // ── Mort ──────────────────────────────────────────────
  die() {
    this.sound.play("dead", { volume: gameVolume });
    const newDead = dead + 1;
    setDead(newDead);
    save.dead(newDead);
    checkObjectives({ dead: newDead });
    this.scene.restart({ levelKey: this.levelKey });
  }

  // ── Update ────────────────────────────────────────────
  update() {
    const p     = this.player;
    const up    = this.cursors.up.isDown    || this.keys.up.isDown;
    const left  = this.cursors.left.isDown  || this.keys.left.isDown  || this.movingLeft;
    const right = this.cursors.right.isDown || this.keys.right.isDown || this.movingRight;

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

    if (
      Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
      Phaser.Input.Keyboard.JustDown(this.keys.up)
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
