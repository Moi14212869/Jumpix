// =========================================================
//               FABRIQUES D'OBJETS DE JEU
// =========================================================

import { isMobile } from "./mobile.js";

// ── Plateformes ───────────────────────────────────────────
const DEFAULT_PLATFORM_COLOR = 0xA0522D;

// Vérifie s'il existe déjà un bloc de plateforme dont le coin haut-gauche
// se trouve exactement à (blockX, blockY - 40), c'est-à-dire juste au-dessus
// du bloc situé à (blockX, blockY).
function hasPlatformAbove(scene, blockX, blockY) {
  let found = false;
  scene.platforms.children.iterate((child) => {
    if (child && child.x === blockX && child.y === blockY - 40) {
      found = true;
    }
  });
  return found;
}

// Génère (ou réutilise) la texture d'un bloc de plateforme, avec ou sans
// couche de neige, et renvoie sa clé.
function getPlatformBlockTexture(scene, color, hasSnow) {
  const tileSize = 40;
  const colorTag = color.toString(16).padStart(6, "0");
  const key = `block-${hasSnow ? "snow" : "normal"}-${colorTag}`;

  if (!scene.textures.exists(key)) {
    const gfx = scene.add.graphics();
    gfx.fillStyle(color, 1);
    gfx.fillRect(0, 0, tileSize, tileSize);
    if (hasSnow) {
      gfx.fillStyle(0xffffff, 1);
      gfx.fillRect(0, 0, tileSize, 8);
    }
    gfx.generateTexture(key, tileSize, tileSize);
    gfx.destroy();
  }

  return key;
}

export function createPlatform(scene, x, y, widthInPx, heightInPx = 40, color = DEFAULT_PLATFORM_COLOR) {
  const tileSize    = 40;
  const blocksPerRow = Math.floor(widthInPx  / tileSize);
  const blocksPerCol = Math.floor(heightInPx / tileSize);
  const isWorld2    = scene.isWorld2 === true;

  for (let row = 0; row < blocksPerCol; row++) {
    for (let col = 0; col < blocksPerRow; col++) {
      const blockX = x + col * tileSize;
      const blockY = y + row * tileSize;

      // On crée d'abord le bloc SANS neige. La décision définitive d'ajouter
      // (ou non) la couche de neige est reportée à finalizeSnowLayer(scene),
      // appelée une fois que TOUTES les plateformes du niveau ont été créées.
      // Cela évite tout problème lié à l'ordre de création des plateformes
      // dans le JSON du niveau (une plateforme créée avant celle qui la
      // recouvre ne doit pas afficher de neige, même si, au moment de sa
      // propre création, la plateforme du dessus n'existait pas encore).
      const key = getPlatformBlockTexture(scene, color, false);

      const block = scene.platforms.create(blockX, blockY, key);
      block.setOrigin(0, 0);
      block.refreshBody();

      // Un bloc n'est "candidat" à la neige que s'il est sur la rangée du
      // haut de SA plateforme, dans un niveau du World 2, avec la couleur
      // par défaut, et pas complètement en haut de l'écran.
      block.isSnowCandidate = isWorld2 && row === 0 && blockY !== 0 && color === DEFAULT_PLATFORM_COLOR;
      block.platformColor   = color;
    }
  }
}

// À appeler UNE FOIS que toutes les plateformes d'un niveau ont été créées
// (donc après tous les appels à createPlatform pour ce niveau). Parcourt les
// blocs candidats à la neige et leur applique la couche blanche seulement
// s'ils ne sont pas recouverts par une autre plateforme juste au-dessus.
export function finalizeSnowLayer(scene) {
  scene.platforms.children.iterate((block) => {
    if (!block || !block.isSnowCandidate) return;

    const isExposed = !hasPlatformAbove(scene, block.x, block.y);
    if (isExposed) {
      const key = getPlatformBlockTexture(scene, block.platformColor, true);
      block.setTexture(key);
    }

    // Le tag n'est plus utile une fois la décision prise.
    block.isSnowCandidate = false;
  });
}

export function createIcePlatform(scene, x, y, widthInPx, heightInPx = 40) {
  const tileSize    = 40;
  const blocksPerRow = Math.floor(widthInPx  / tileSize);
  const blocksPerCol = Math.floor(heightInPx / tileSize);

  for (let row = 0; row < blocksPerCol; row++) {
    for (let col = 0; col < blocksPerRow; col++) {
      const gfx = scene.add.graphics();
      gfx.fillStyle(0x9EE7FF, 1);
      gfx.fillRect(0, 0, tileSize, tileSize);
      gfx.fillStyle(0xFFFFFF, 0.5);
      gfx.fillRect(0, 0, tileSize, 6);

      const key = `ice-${x}-${y}-${row}-${col}`;
      gfx.generateTexture(key, tileSize, tileSize);
      gfx.destroy();

      const block = scene.icePlatforms.create(x + col * tileSize, y + row * tileSize, key);
      block.setOrigin(0, 0);
      block.refreshBody();
    }
  }
}

// ── Piques ────────────────────────────────────────────────
export function createRedTriangle(scene, x, y, orientation = "up") {
  const size   = 40;
  const height = Math.sqrt(3) / 2 * size;
  const key    = `triangle-${x}-${y}-${orientation}`;

  const gfx = scene.add.graphics();
  gfx.fillStyle(0xFF0000, 1);
  gfx.beginPath();

  if      (orientation === "up")    { gfx.moveTo(size / 2, 0);      gfx.lineTo(0, height);  gfx.lineTo(size, height); }
  else if (orientation === "down")  { gfx.moveTo(size / 2, height); gfx.lineTo(0, 0);       gfx.lineTo(size, 0); }
  else if (orientation === "left")  { gfx.moveTo(0, size / 2);      gfx.lineTo(height, 0);  gfx.lineTo(height, size); }
  else if (orientation === "right") { gfx.moveTo(height, size / 2); gfx.lineTo(0, 0);       gfx.lineTo(0, size); }

  gfx.closePath();
  gfx.fillPath();

  if (orientation === "left" || orientation === "right") {
    gfx.generateTexture(key, height, size);
  } else {
    gfx.generateTexture(key, size, height);
  }

  gfx.destroy();

  const triangle = scene.spikes.create(x, y, key);

  const origins = {
    up: [0.5, 1],
    down: [0.5, 0],
    left: [1, 0.5],
    right: [0, 0.5]
  };

  triangle.setOrigin(...origins[orientation]);
  triangle.refreshBody();

  const body = triangle.body;

  // dimensions originales
  const originalW = body.width;
  const originalH = body.height;

  // hitbox réduite
  const bw = originalW * 0.5;
  const bh = originalH * 0.5;

  body.setSize(bw, bh);
  body.setOffset((originalW - bw) / 2, (originalH - bh) / 2);

  return triangle;
}

// ── Lave ──────────────────────────────────────────────────
// Bloc statique 40x40. Contrairement aux plateformes, il est toujours
// mortel au contact (voir le collider ajouté dans LevelScene). L'origine
// est (0,0) — comme les plateformes — donc (x, y) désigne le coin
// haut-gauche du bloc.
//
// Pour donner une impression de lave vivante sans repeindre un Graphics
// à chaque frame (coûteux si le niveau contient plusieurs blocs), on
// pré-génère quelques images fixes où la croûte et les bulles sont
// légèrement décalées, puis on les enchaîne avec une animation Phaser
// classique (comme un sprite-sheet, mais avec des textures séparées).
const LAVA_FRAME_COUNT = 16;

function buildLavaFrames(scene) {
  const size = 40;
  const frameKeys = [];

  // Bulles de lave : position de base + un décalage sinusoïdal propre
  // à chacune, pour qu'elles ne bougent pas toutes en même temps.
  const bubbles = [
    { bx: 10, by: 22, r: 4,   phase: 0.0 },
    { bx: 29, by: 14, r: 3,   phase: 2.1 },
    { bx: 19, by: 31, r: 3.5, phase: 4.2 },
    { bx: 33, by: 27, r: 2,   phase: 1.3 },
  ];

  for (let i = 0; i < LAVA_FRAME_COUNT; i++) {
    const key = `lava-block-f${i}`;
    if (scene.textures.exists(key)) { frameKeys.push(key); continue; }

    const t = (i / LAVA_FRAME_COUNT) * Math.PI * 2; // position dans le cycle (boucle parfaite)
    const gfx = scene.add.graphics();

    // Base sombre, craquelée par endroits
    gfx.fillStyle(0x8B1A00, 1);
    gfx.fillRect(0, 0, size, size);
    gfx.fillStyle(0x6E1200, 0.7);
    gfx.fillTriangle(4, size, 16, 20, 24, size);
    gfx.fillTriangle(26, size, 34, 18, 40, size);

    // Croûte incandescente : bord irrégulier et mouvant plutôt qu'une
    // bande rectiligne, pour un rendu plus organique.
    const CRUST_SAMPLES = 9;
    const crustPoints = [];
    for (let s = 0; s <= CRUST_SAMPLES; s++) {
      const sx = (s / CRUST_SAMPLES) * size;
      const h = 6
        + Math.sin(sx * 0.35 + t) * 2.2
        + Math.sin(sx * 0.13 - t * 1.6 + 1.7) * 1.4;
      crustPoints.push({ x: sx, y: Math.max(2, h) });
    }

    gfx.fillStyle(0xFF4500, 1);
    gfx.beginPath();
    gfx.moveTo(0, 0);
    crustPoints.forEach(p => gfx.lineTo(p.x, p.y));
    gfx.lineTo(size, 0);
    gfx.closePath();
    gfx.fillPath();

    // Liseré plus clair sur la crête pour accentuer le relief
    gfx.lineStyle(1, 0xFF7A00, 0.8);
    gfx.beginPath();
    crustPoints.forEach((p, i) => i === 0 ? gfx.moveTo(p.x, p.y) : gfx.lineTo(p.x, p.y));
    gfx.strokePath();

    // Bulles qui remontent et respirent (rayon + luminosité qui varient)
    bubbles.forEach(b => {
      const wobbleY = Math.sin(t + b.phase) * 2.5;
      const wobbleX = Math.cos(t + b.phase) * 1.2;
      const pulse   = (Math.sin(t + b.phase) + 1) / 2; // 0..1
      const r       = b.r * (0.8 + pulse * 0.4);

      gfx.fillStyle(0xFFA500, 0.85 + pulse * 0.15);
      gfx.fillCircle(b.bx + wobbleX, b.by + wobbleY, r);
      gfx.fillStyle(0xFFFF66, 0.7 + pulse * 0.3);
      gfx.fillCircle(b.bx + wobbleX, b.by + wobbleY, r * 0.4);
    });

    gfx.generateTexture(key, size, size);
    gfx.destroy();
    frameKeys.push(key);
  }

  return frameKeys;
}

function ensureLavaAnimation(scene) {
  if (scene.anims.exists("lava-bubble")) return;
  const frameKeys = buildLavaFrames(scene);
  scene.anims.create({
    key: "lava-bubble",
    frames: frameKeys.map(key => ({ key })),
    frameRate: 10,
    repeat: -1
  });
}

function getLavaBubbleParticleTexture(scene) {
  const key = "lava-bubble-particle";
  if (!scene.textures.exists(key)) {
    const gfx = scene.add.graphics();
    gfx.fillStyle(0xFFA500, 1);
    gfx.fillCircle(3, 3, 3);
    gfx.fillStyle(0xFFFF66, 0.85);
    gfx.fillCircle(3, 3, 1.3);
    gfx.generateTexture(key, 6, 6);
    gfx.destroy();
  }
  return key;
}

export function createLavaBlock(scene, x, y) {
  ensureLavaAnimation(scene);

  const block = scene.lavaBlocks.create(x, y, "lava-block-f0");
  block.setOrigin(0, 0);
  block.refreshBody();
  block.play("lava-bubble");
  // Décale le point de départ de l'animation au hasard pour que plusieurs
  // blocs de lave côte à côte ne pulsent pas tous en même temps.
  block.anims.setProgress(Math.random());

  // ── Bulles décoratives qui s'échappent de temps en temps ──
  // Purement visuel (pas de collision) : une petite bulle orange qui
  // s'élève depuis la surface et s'estompe, à intervalle irrégulier,
  // pour donner l'impression que la lave "crache" de temps en temps.
  const size      = 40;
  const bubbleKey = getLavaBubbleParticleTexture(scene);
  const emitter = scene.add.particles(0, 0, bubbleKey, {
    x:        { min: x + 6, max: x + size - 6 },
    y:        y + 2,
    lifespan: { min: 500, max: 900 },
    speedY:   { min: -55, max: -95 },
    speedX:   { min: -12, max: 12 },
    scale:    { start: 1, end: 0 },
    alpha:    { start: 0.9, end: 0 },
    quantity: 1,
    emitting: false, // pas de flux continu, on déclenche nous-mêmes chaque bulle
  });

  const scheduleNextBubble = () => {
    const delay = Phaser.Math.Between(600, 2400); // intervalle irrégulier
    scene.time.delayedCall(delay, () => {
      if (!block.active) { emitter.destroy(); return; } // bloc détruit entretemps
      emitter.explode(1);
      scheduleNextBubble();
    });
  };
  scheduleNextBubble();

  return block;
}

// ── Ennemis mobiles ───────────────────────────────────────
export function createRedCircle(scene, x, y, riseAmount = 100, direction = "up") {
  const radius = 10;
  const gfx    = scene.add.graphics();
  gfx.fillStyle(0xFF0000, 1);
  gfx.fillCircle(radius, radius, radius);
  const key = `redCircle-${x}-${y}`;
  gfx.generateTexture(key, radius * 2, radius * 2);
  gfx.destroy();

  const circle = scene.physics.add.sprite(x, y, key);
  circle.setCircle(radius);
  circle.setOrigin(0.5);
  circle.body.moves         = false;
  circle.body.allowGravity  = false;
  circle.body.immovable     = true;

  scene.tweens.add({
    targets: circle,
    y: direction === "up" ? y - riseAmount : y + riseAmount,
    duration: 2000, yoyo: true, repeat: -1, ease: "Sine.easeInOut"
  });

  return circle;
}

export function createRedSquare(x, y, scene, distance = 100, direction = "right") {
  const size = 40;
  const gfx  = scene.add.graphics();
  gfx.fillStyle(0xFF0000, 1);
  gfx.fillRect(0, 0, size, size);
  const key = `redSquare-${x}-${y}-${direction}`;
  gfx.generateTexture(key, size, size);
  gfx.destroy();

  const square = scene.physics.add.sprite(x, y, key);
  square.setSize(size, size);
  square.setOrigin(0.5);
  square.body.allowGravity = false;
  square.body.immovable    = true;

  const targetX = direction === "right" ? x + distance
                : direction === "left"  ? x - distance
                : x;

  scene.tweens.add({
    targets: square, x: targetX,
    duration: 2000, yoyo: true, repeat: -1, ease: "Sine.easeInOut"
  });

  return square;
}

// ── Sortie (cercle bleu) ──────────────────────────────────
export function createBlueCircle(scene, x, y) {
  const radius = 20;
  const gfx    = scene.add.graphics();
  gfx.fillStyle(0x0000FF, 1);
  gfx.fillCircle(radius, radius, radius);
  const key = `blueCircle-${x}-${y}`;
  gfx.generateTexture(key, radius * 2, radius * 2);
  gfx.destroy();

  const circle = scene.physics.add.sprite(x, y, key);
  circle.setCircle(radius);
  circle.setOrigin(0.5);
  circle.body.allowGravity = false;

  scene.tweens.add({
    targets: circle, y: circle.y - 5,
    duration: 800, yoyo: true, repeat: -1, ease: "Sine.easeInOut"
  });

  return circle;
}

// ── Particules en spirale autour de la sortie ─────────────
// Effet purement visuel : un halo de petites particules bleues qui
// tournent en continu autour du portail, avec un rayon qui oscille
// pour donner une impression de spirale vivante (aucune interaction
// physique avec le joueur, c'est le cercle bleu lui-même qui déclenche
// la sortie).
export function createExitPortalSpiral(scene, x, y) {
  const key = "portal-spark";

  if (!scene.textures.exists(key)) {
    const gfx = scene.add.graphics();
    gfx.fillStyle(0x0000FF, 1);
    gfx.fillCircle(3, 3, 3);
    gfx.fillStyle(0x9999FF, 0.9);
    gfx.fillCircle(3, 3, 1.3);
    gfx.generateTexture(key, 6, 6);
    gfx.destroy();
  }

  const PARTICLE_COUNT = 10;
  const MIN_RADIUS = 14;
  const MAX_RADIUS = 34;
  const particles = [];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const sprite = scene.add.image(x, y, key);
    particles.push({
      sprite,
      baseAngle:    (i / PARTICLE_COUNT) * Math.PI * 2,
      speed:        1.2 + (i % 3) * 0.2,   // vitesses légèrement différentes → effet de spirale
      radiusOffset: (i % 4) * 5,           // rayons échelonnés
      phase:        Math.random() * Math.PI * 2,
    });
  }

  // Un seul minuteur pilote toutes les particules pour rester léger.
  const timer = scene.time.addEvent({
    delay: 16,
    loop: true,
    callback: () => {
      const t = scene.time.now / 1000;
      particles.forEach(p => {
        const angle  = p.baseAngle + t * p.speed;
        const pulse  = (Math.sin(t * 0.9 + p.phase) + 1) / 2; // 0..1
        const radius = MIN_RADIUS + p.radiusOffset + pulse * (MAX_RADIUS - MIN_RADIUS - p.radiusOffset);
        p.sprite.x = x + Math.cos(angle) * radius;
        p.sprite.y = y + Math.sin(angle) * radius * 0.6; // légèrement aplati pour un effet de profondeur
        p.sprite.setAlpha(0.35 + pulse * 0.65);
        p.sprite.setScale(0.6 + pulse * 0.8);
      });
    }
  });

  // Nettoyage si la scène est stoppée/redémarrée avant la fin (ex : mort
  // ou "retry" sur un niveau contenant plusieurs sorties, s'il y en a).
  scene.events.once("shutdown", () => {
    timer.remove();
    particles.forEach(p => p.sprite.destroy());
  });

  return particles.map(p => p.sprite);
}

// ── Effets visuels ────────────────────────────────────────
export function createSnow(scene) {
  if (!scene.textures.exists("snowflake")) {
    const gfx = scene.add.graphics();
    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle(2, 2, 2);
    gfx.generateTexture("snowflake", 4, 4);
    gfx.destroy();
  }

  const particles = scene.add.particles(0, 0, "snowflake", {
    x: { min: 0, max: scene.scale.width }, y: -10,
    lifespan: 6000,
    speedY: { min: 30, max: 80 }, speedX: { min: -20, max: 20 },
    scale: { start: 1, end: 0.5 },
    quantity: 4, frequency: 100, blendMode: "NORMAL"
  });

  particles.setDepth(-10);
  particles.setScrollFactor(0);
}

// ── Tempête de neige (colonne de 1 bloc de large, hauteur configurable) ──────
// La zone est invisible en jeu (zone physique pure) mais remplie de particules
// tourbillonnantes blanches et bleu clair. Le joueur qui la touche est éjecté
// vers le haut avec une forte vélocité.
export function createSnowstorm(scene, x, y, heightInPx = 80) {
  const WIDTH       = 40;   // toujours 1 bloc de large (40px)
  const LAUNCH_VY   = -600; // force d'éjection verticale
  const PARTICLE_W  = 6;
  const PARTICLE_H  = 6;

  // ── Texture particule flocon ──────────────────────────────
  const keyWhite = "snowstorm-particle-white";
  const keyBlue  = "snowstorm-particle-blue";

  if (!scene.textures.exists(keyWhite)) {
    const g = scene.add.graphics();
    g.fillStyle(0xffffff, 1);
    // Flocon stylisé : croix simple
    g.fillRect(2, 0, 2, 6);
    g.fillRect(0, 2, 6, 2);
    g.generateTexture(keyWhite, PARTICLE_W, PARTICLE_H);
    g.destroy();
  }
  if (!scene.textures.exists(keyBlue)) {
    const g = scene.add.graphics();
    g.fillStyle(0x9EE7FF, 1);
    g.fillRect(2, 0, 2, 6);
    g.fillRect(0, 2, 6, 2);
    g.generateTexture(keyBlue, PARTICLE_W, PARTICLE_H);
    g.destroy();
  }

  // ── Zone physique (rectangle statique invisible) ──────────
  const zone = scene.physics.add.staticImage(x + WIDTH / 2, y + heightInPx / 2, "__blank__");

  // Crée une texture transparente unique si elle n'existe pas encore
  if (!scene.textures.exists("__blank__")) {
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0);
    g.fillRect(0, 0, 1, 1);
    g.generateTexture("__blank__", 1, 1);
    g.destroy();
  }

  zone.setDisplaySize(WIDTH, heightInPx);
  zone.body.setSize(WIDTH, heightInPx);
  zone.refreshBody();
  zone.setVisible(false);
  // Tag pour l'identifier lors de l'overlap dans LevelScene
  zone.isSnowstorm = true;

  // ── Particules tourbillonnantes ───────────────────────────
  // Émetteur centré sur la zone, les particules tourbillonnent à l'intérieur
  const cx = x + WIDTH / 2;
  const cy = y + heightInPx / 2;

  const emitter = scene.add.particles(cx, cy, keyWhite, {
    x:        { min: -WIDTH / 2 + 4,       max: WIDTH / 2 - 4 },
    y:        { min: -heightInPx / 2 + 4,  max: heightInPx / 2 - 4 },
    lifespan: 1200,
    speedX:   { min: -60, max: 60 },
    speedY:   { min: -80, max: -20 },
    scale:    { start: 1, end: 0.3 },
    alpha:    { start: 0.9, end: 0 },
    rotate:   { min: 0, max: 360 },
    quantity:  12,
    frequency: 30,
    blendMode: "NORMAL",
  });

  const emitter2 = scene.add.particles(cx, cy, keyBlue, {
    x:        { min: -WIDTH / 2 + 2,       max: WIDTH / 2 - 2 },
    y:        { min: -heightInPx / 2 + 2,  max: heightInPx / 2 - 2 },
    lifespan: 900,
    speedX:   { min: -80, max: 80 },
    speedY:   { min: -50, max: 50 },
    scale:    { start: 0.8, end: 0.1 },
    alpha:    { start: 0.7, end: 0 },
    rotate:   { min: 0, max: 360 },
    quantity:  8,
    frequency: 35,
    blendMode: "ADD",
  });

  emitter.setDepth(1);
  emitter2.setDepth(1);

  // ── Contour visuel subtil de la colonne ───────────────────
  const border = scene.add.graphics();
  border.lineStyle(1, 0x9EE7FF, 0.35);
  border.strokeRect(x, y, WIDTH, heightInPx);
  // Fond légèrement teinté
  border.fillStyle(0x9EE7FF, 0.07);
  border.fillRect(x, y, WIDTH, heightInPx);
  border.setDepth(0);

  return zone;
}

// ── Volcan (cône fixe + colonne de fumée montante, hauteur configurable) ──
// Le volcan lui-même est purement décoratif (pas de corps physique : il est
// censé être posé sur une plateforme déjà solide). Le cratère émet une
// colonne de fumée qui monte vers le ciel — contrairement à la tempête de
// neige, dont la colonne descend depuis le point d'ancrage, la fumée part
// du sommet du cône et s'élève. Le joueur qui entre dans la fumée est
// éjecté vers le haut exactement comme avec createSnowstorm().
// (x, y) = centre du cratère, au sommet du cône.
export function createVolcano(scene, x, y, smokeHeightInPx = 120) {
  const CONE_W    = 140;  // largeur de la base du cône
  const CONE_H    = 100;  // hauteur du cône (cratère → base)
  const SMOKE_W   = 40;   // largeur de la colonne de fumée (1 bloc), centrée sur le cratère

  const craterX = x;
  const craterY = y;

  // ── Corps du volcan (dessin statique, non solide) ──────────
  const gfx = scene.add.graphics();

  // Cône principal
  gfx.fillStyle(0x4A3728, 1);
  gfx.beginPath();
  gfx.moveTo(craterX, craterY);
  gfx.lineTo(craterX - CONE_W / 2, craterY + CONE_H);
  gfx.lineTo(craterX + CONE_W / 2, craterY + CONE_H);
  gfx.closePath();
  gfx.fillPath();

  // Ombrage du flanc droit
  gfx.fillStyle(0x2E2018, 0.55);
  gfx.beginPath();
  gfx.moveTo(craterX, craterY);
  gfx.lineTo(craterX, craterY + CONE_H);
  gfx.lineTo(craterX + CONE_W / 2, craterY + CONE_H);
  gfx.closePath();
  gfx.fillPath();

  // Coulée de lave sur le flanc gauche
  gfx.fillStyle(0xFF4500, 0.85);
  gfx.beginPath();
  gfx.moveTo(craterX - 6, craterY + 10);
  gfx.lineTo(craterX - CONE_W * 0.22, craterY + CONE_H);
  gfx.lineTo(craterX - CONE_W * 0.1, craterY + CONE_H);
  gfx.closePath();
  gfx.fillPath();

  // Cratère (bouche du volcan)
  gfx.fillStyle(0xFF6A00, 1);
  gfx.fillEllipse(craterX, craterY, 34, 12);
  gfx.fillStyle(0xFFD700, 0.9);
  gfx.fillEllipse(craterX, craterY, 16, 6);

  gfx.setDepth(0);

  // ── Zone physique de la colonne de fumée (invisible, statique) ──
  if (!scene.textures.exists("__blank__")) {
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0);
    g.fillRect(0, 0, 1, 1);
    g.generateTexture("__blank__", 1, 1);
    g.destroy();
  }

  // La fumée part du cratère et monte : le haut de la zone est donc
  // au-dessus de craterY, contrairement à la tempête de neige qui descend.
  const zoneTop = craterY - smokeHeightInPx;
  const zone = scene.physics.add.staticImage(craterX, zoneTop + smokeHeightInPx / 2, "__blank__");
  zone.setDisplaySize(SMOKE_W, smokeHeightInPx);
  zone.body.setSize(SMOKE_W, smokeHeightInPx);
  zone.refreshBody();
  zone.setVisible(false);
  // Tag pour l'identifier lors de l'overlap dans LevelScene
  zone.isVolcano = true;

  // ── Particules de fumée ─────────────────────────────────────
  const keySmokeDark  = "volcano-smoke-dark";
  const keySmokeLight = "volcano-smoke-light";

  if (!scene.textures.exists(keySmokeDark)) {
    const g = scene.add.graphics();
    g.fillStyle(0x4d4d4d, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture(keySmokeDark, 8, 8);
    g.destroy();
  }
  if (!scene.textures.exists(keySmokeLight)) {
    const g = scene.add.graphics();
    g.fillStyle(0xAAAAAA, 1);
    g.fillCircle(3, 3, 3);
    g.generateTexture(keySmokeLight, 6, 6);
    g.destroy();
  }

  // Vitesse moyenne de montée : la fumée doit traverser toute la hauteur
  // réglable avant de disparaître, quelle que soit cette hauteur.
  const avgSpeed   = 55; // px/s
  const lifespanMs = (smokeHeightInPx / avgSpeed) * 1000;

  const emitter = scene.add.particles(craterX, craterY, keySmokeDark, {
    x:        { min: -SMOKE_W / 2 + 4, max: SMOKE_W / 2 - 4 },
    y:        0,
    lifespan: lifespanMs,
    speedY:   { min: -avgSpeed * 0.7, max: -avgSpeed * 1.3 },
    speedX:   { min: -15, max: 15 },
    scale:    { start: 0.6, end: 1.9 },
    alpha:    { start: 0.75, end: 0 },
    quantity:  2,
    frequency: 90,
    blendMode: "NORMAL",
  });

  const emitter2 = scene.add.particles(craterX, craterY, keySmokeLight, {
    x:        { min: -SMOKE_W / 2 + 2, max: SMOKE_W / 2 - 2 },
    y:        0,
    lifespan: lifespanMs * 0.8,
    speedY:   { min: -avgSpeed * 0.9, max: -avgSpeed * 1.5 },
    speedX:   { min: -25, max: 25 },
    scale:    { start: 0.4, end: 1.3 },
    alpha:    { start: 0.55, end: 0 },
    quantity:  2,
    frequency: 110,
    blendMode: "NORMAL",
  });

  emitter.setDepth(1);
  emitter2.setDepth(1);

  return zone;
}

// ── Pavé tactile générique ────────────────────────────────
// buttons : [{ id, dir: "left" | "right" | "up", x, y, size }]  (coordonnées jeu)
// options : { onPress(id)  → appelé quand un doigt se pose sur un bouton,
//             onFrame(state) → appelé à chaque frame, state[id] = bouton tenu ?,
//             depth }
//
// Les boutons ne sont PAS des objets interactifs Phaser : à chaque frame on
// regarde où se trouvent tous les doigts posés sur l'écran. Du coup :
//  - on peut glisser le doigt d'un bouton à l'autre sans le lever ;
//  - un bouton ne reste jamais "coincé" si le doigt est relevé ailleurs ;
//  - ils ne bloquent pas les boutons Phaser situés en dessous.
// Retourne null si l'appareil n'est pas un mobile (rien n'est affiché).
export function createTouchPad(scene, buttons, { onPress, onFrame, depth = 12 } = {}) {
  if (!isMobile()) return null;

  const IDLE_ALPHA = 0.45, DOWN_ALPHA = 0.9, HIT_PAD = 6;
  const pointers = scene.input.manager.pointers;
  const state    = {};
  let visible    = true;

  const items = buttons.map(b => {
    const g = scene.add.graphics().setScrollFactor(0).setDepth(depth).setAlpha(IDLE_ALPHA);
    g.fillStyle(0x00BFFF, 1).fillRoundedRect(b.x, b.y, b.size, b.size, 16);
    g.lineStyle(3, 0xFFFFFF, 1).strokeRoundedRect(b.x, b.y, b.size, b.size, 16);

    // Flèche dessinée à la main (pas de dépendance à une police)
    const cx = b.x + b.size / 2, cy = b.y + b.size / 2, r = b.size * 0.2;
    g.fillStyle(0xFFFFFF, 1);
    if (b.dir === "left")       g.fillTriangle(cx - r, cy, cx + r, cy - r * 1.3, cx + r, cy + r * 1.3);
    else if (b.dir === "right") g.fillTriangle(cx + r, cy, cx - r, cy - r * 1.3, cx - r, cy + r * 1.3);
    else                        g.fillTriangle(cx, cy - r, cx - r * 1.3, cy + r, cx + r * 1.3, cy + r);

    state[b.id] = false;
    return { ...b, g, down: false };
  });

  const inside = (it, p) =>
    p.x >= it.x - HIT_PAD && p.x <= it.x + it.size + HIT_PAD &&
    p.y >= it.y - HIT_PAD && p.y <= it.y + it.size + HIT_PAD;

  const update = () => {
    items.forEach(it => {
      const down = visible && pointers.some(p => p && p.isDown && inside(it, p));
      if (down && !it.down) onPress?.(it.id);
      it.down = down;
      state[it.id] = down;
      it.g.setAlpha(down ? DOWN_ALPHA : IDLE_ALPHA);
    });
    onFrame?.(state);
  };

  // Les listeners de scene.events survivent à un scene.restart() :
  // on les retire explicitement à la fermeture de la scène.
  scene.events.on("update", update);
  const destroy = () => {
    scene.events.off("update", update);
    scene.events.off("shutdown", destroy);
    items.forEach(it => it.g.destroy());
  };
  scene.events.once("shutdown", destroy);

  return {
    state,
    setVisible(v) {
      visible = v;
      items.forEach(it => it.g.setVisible(v));
    },
    destroy
  };
}

// ── Contrôles mobiles d'un niveau (◀ ▶ à gauche, ⬆ à droite) ──
// Alimente scene.movingLeft / scene.movingRight (lus par LevelScene.update)
// et déclenche scene.jumpPlayer() sur le bouton de saut.
// Retourne le pavé (pour pouvoir le masquer) ou null hors mobile.
export function createMobileControls(scene) {
  if (!isMobile()) return null;

  scene.movingLeft  = false;
  scene.movingRight = false;

  const { width, height } = scene.scale;
  const S = 84, GAP = 14, M = 14, Y = height - S - M;

  return createTouchPad(scene, [
    { id: "left",  dir: "left",  x: M,               y: Y, size: S },
    { id: "right", dir: "right", x: M + S + GAP,     y: Y, size: S },
    { id: "jump",  dir: "up",    x: width - M - S,   y: Y, size: S },
  ], {
    onPress: id => {
      // On ne saute pas ici : ce callback tourne AVANT scene.update(), qui
      // remet jumpCount à 0 au contact du sol. Le saut aurait alors été
      // "gratuit" (3 sauts au lieu de 2). On le met en file d'attente ; il est
      // exécuté dans update(), au même endroit que le saut clavier.
      // Pas de saut pendant l'animation de victoire / d'enfoncement dans la lave.
      if (id === "jump" && !scene.transitioning && !scene.dyingInLava) scene.mobileJumpQueued = true;
    },
    onFrame: s => {
      scene.movingLeft  = s.left;
      scene.movingRight = s.right;
    }
  });
}
