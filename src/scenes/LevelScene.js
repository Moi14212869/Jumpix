import {
  gameVolume,
  keyboardLayout,
  colorPlayer,
  addKill,
  addDeath,
  addParty,
  addCoins
} from "../global.js";

import {
  createPlatform,
  createRedTriangle,
  createRedCircle,
  createRedSquare,
  createBlueCircle,
  createIcePlatform,
  createSnow,
  createMobileControls
} from "../utils/gameObjects.js";

import { checkObjectives } from "../utils/objectives.js";

export class LevelScene extends Phaser.Scene {
  constructor() {
    super("LevelScene");
  }

  init(data) {
    this.levelKey = data.levelKey;
  }

  preload() {
    this.load.json(this.levelKey, `levels/${this.levelKey}.json`);
  }

  create() {
    const level = this.cache.json.get(this.levelKey);

    // --- Snow ---
    if (level.nextScene === "World2") {
      createSnow(this);
    }

    // --- States ---
    this.onIce = false;
    this.sliding = false;
    this.slideDir = 0;
    this.inheritedSlideDir = 0;
    this.transitioning = false;

    // --- Groups ---
    this.platforms = this.physics.add.staticGroup();
    this.spikes = this.physics.add.staticGroup();
    this.redCircles = this.physics.add.group();
    this.redSquares = this.physics.add.group();
    this.icePlatforms = this.physics.add.staticGroup();

    this.input.addPointer(2);
    this.cursors = this.input.keyboard.createCursorKeys();

    this.slideSound = this.sound.add("slide", { volume: gameVolume });

    // --- Keyboard ---
    this.keys = this.input.keyboard.addKeys(
      keyboardLayout === "zqsd"
        ? {
            up: Phaser.Input.Keyboard.KeyCodes.Z,
            left: Phaser.Input.Keyboard.KeyCodes.Q,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            right: Phaser.Input.Keyboard.KeyCodes.D
          }
        : {
            up: Phaser.Input.Keyboard.KeyCodes.W,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            right: Phaser.Input.Keyboard.KeyCodes.D
          }
    );

    this.jumpCount = 0;

    // --- Platforms ---
    level.platforms.forEach(p => {
      const color =
        typeof p.color === "string"
          ? parseInt(p.color)
          : p.color || 0xA0522D;

      createPlatform(this, p.x, p.y, p.w, p.h || 40, color);
    });

    // --- Spikes ---
    level.spikes.forEach(s =>
      createRedTriangle(this, s.x, s.y, s.orientation || "up")
    );

    // --- Red circles ---
    level.redCircles?.forEach(c =>
      this.redCircles.add(
        createRedCircle(this, c.x, c.y, c.rise, c.direction || "up")
      )
    );

    // --- Red squares ---
    level.redSquares?.forEach(r =>
      this.redSquares.add(
        createRedSquare(r.x, r.y, this, r.rise, r.direction)
      )
    );

    // --- Ice ---
    level.icePlatforms?.forEach(p => {
      createIcePlatform(this, p.x, p.y, p.w, p.h || 40);
    });

    // --- Player ---
    const gfx = this.add.graphics();
    gfx.fillStyle(colorPlayer, 1);
    gfx.fillRect(0, 0, 40, 40);
    gfx.generateTexture("player", 40, 40);
    gfx.destroy();

    this.player = this.physics.add.sprite(
      level.playerStart.x,
      level.playerStart.y,
      "player"
    );

    this.player.setBounce(0.2).setCollideWorldBounds(true);

    // --- Exit ---
    this.blueCircle = createBlueCircle(
      this,
      level.blueCircle.x,
      level.blueCircle.y
    );

    // --- Back button ---
    const back = this.add.text(5, 5, "←", {
      fontSize: "24px",
      backgroundColor: "#00BFFF",
      padding: { x: 7, y: 4 }
    }).setInteractive();

    back.on("pointerdown", () => {
      this.sound.play("menu", { volume: gameVolume });
      this.scene.start(level.nextScene);
    });

    // --- Collisions ---
    this.physics.add.collider(this.player, this.platforms);

    this.physics.add.collider(this.player, this.icePlatforms, () => {
      this.onIce = true;
    });

    this.physics.add.collider(this.redSquares, this.platforms);

    this.physics.add.collider(this.player, this.spikes, () => this.die());

    this.physics.add.overlap(this.player, this.redCircles, () => this.die());

    // --- Red square logic ---
    this.physics.add.overlap(this.player, this.redSquares, (player, square) => {
      const playerBottom = player.y + player.displayHeight / 2;
      const squareTop = square.y - square.displayHeight / 2;

      if (playerBottom - squareTop < 10 && player.body.velocity.y > 0) {
        addKill();
        checkObjectives();

        this.sound.play("kill", { volume: gameVolume });
        player.setVelocityY(-200);

        this.tweens.add({
          targets: square,
          scale: 0,
          duration: 300,
          onComplete: () => square.destroy()
        });

      } else {
        this.die();
      }
    });

    // --- Finish ---
    this.physics.add.overlap(this.player, this.blueCircle, () => {

      if (this.transitioning) return;
      this.transitioning = true;

      this.sound.play("victory", { volume: gameVolume });

      addParty();
      checkObjectives();

      this.player.body.enable = false;

      this.tweens.add({
        targets: this.player,
        x: this.blueCircle.x,
        y: this.blueCircle.y,
        scale: 0.3,
        angle: 720,
        duration: 800,
        onComplete: () => {
          addCoins(level.reward || 0);
          this.scene.start(level.nextScene);
        }
      });
    });

    createMobileControls(this);
  }

  die() {
    this.sound.play("dead", { volume: gameVolume });
    addDeath();
    checkObjectives();
    this.scene.restart({ levelKey: this.levelKey });
  }

  update() {
    const p = this.player;

    const left = this.cursors.left.isDown || this.keys.left.isDown || this.movingLeft;
    const right = this.cursors.right.isDown || this.keys.right.isDown || this.movingRight;

    // --- Ice movement ---
    if (p.body.touching.down && this.onIce) {

      if (!this.sliding) {
        if (left || right) {
          this.slideDir = left ? -1 : 1;
          this.sliding = true;
          this.slideSound.play();
        }
      }

      if (this.sliding) {
        p.setVelocityX(220 * this.slideDir);
      }

    } else {
      this.sliding = false;
      if (left) p.setVelocityX(-160);
      else if (right) p.setVelocityX(160);
      else p.setVelocityX(0);
    }

    this.onIce = false;

    if (p.body.touching.down) {
      this.jumpCount = 0;
    }

    if (
      Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
      Phaser.Input.Keyboard.JustDown(this.keys.up)
    ) {
      this.jumpPlayer();
    }
  }

  jumpPlayer() {
    if (this.jumpCount < 2) {
      this.player.setVelocityY(-330);

      let dir = this.player.body.velocity.x >= 0 ? 1 : -1;

      if (this.jumpCount === 1) {
        this.tweens.add({
          targets: this.player,
          angle: this.player.angle + 180 * dir,
          duration: 300
        });
      }

      this.sound.play("jump", { volume: gameVolume });
      this.jumpCount++;
    }
  }
}
