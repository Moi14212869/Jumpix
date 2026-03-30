// =========================
// PLATEFORMES
// =========================
export function createPlatform(scene, x, y, widthInPx, heightInPx = 40, color = 0xA0522D) {
    const tileSize = 40;
    const blocksPerRow = Math.floor(widthInPx / tileSize);
    const blocksPerCol = Math.floor(heightInPx / tileSize);

    const isWorld2 = scene.isWorld2 === true;

    for (let row = 0; row < blocksPerCol; row++) {
        for (let col = 0; col < blocksPerRow; col++) {

            const gfx = scene.add.graphics();

            // Bloc principal
            gfx.fillStyle(color, 1);
            gfx.fillRect(0, 0, tileSize, tileSize);

            // ❄️ Neige
            if (isWorld2 && row === 0) {
                gfx.fillStyle(0xffffff, 1);
                gfx.fillRect(0, 0, tileSize, 8);
            }

            const key = `block-${x}-${y}-${row}-${col}-${isWorld2 ? "snow" : "normal"}`;
            gfx.generateTexture(key, tileSize, tileSize);
            gfx.destroy();

            const block = scene.platforms.create(
                x + col * tileSize,
                y + row * tileSize,
                key
            );

            block.setOrigin(0, 0);
            block.refreshBody();
        }
    }
}

// =========================
// PIQUES
// =========================
export function createRedTriangle(scene, x, y, orientation = 'up') {
    const size = 40;
    const height = Math.sqrt(3) / 2 * size;
    const key = `triangle-${x}-${y}-${orientation}`;

    const gfx = scene.add.graphics();
    gfx.fillStyle(0xFF0000, 1);
    gfx.beginPath();

    if (orientation === 'up') {
        gfx.moveTo(size / 2, 0);
        gfx.lineTo(0, height);
        gfx.lineTo(size, height);
    } else if (orientation === 'down') {
        gfx.moveTo(size / 2, height);
        gfx.lineTo(0, 0);
        gfx.lineTo(size, 0);
    } else if (orientation === 'left') {
        gfx.moveTo(0, size / 2);
        gfx.lineTo(height, 0);
        gfx.lineTo(height, size);
    } else if (orientation === 'right') {
        gfx.moveTo(height, size / 2);
        gfx.lineTo(0, 0);
        gfx.lineTo(0, size);
    }

    gfx.closePath();
    gfx.fillPath();

    if (orientation === 'left' || orientation === 'right') {
        gfx.generateTexture(key, height, size);
    } else {
        gfx.generateTexture(key, size, height);
    }

    gfx.destroy();

    const triangle = scene.spikes.create(x, y, key);

    switch (orientation) {
        case 'up': triangle.setOrigin(0.5, 1); break;
        case 'down': triangle.setOrigin(0.5, 0); break;
        case 'left': triangle.setOrigin(1, 0.5); break;
        case 'right': triangle.setOrigin(0, 0.5); break;
    }

    triangle.refreshBody();

    const body = triangle.body;
    const bodyWidth = body.width * 0.7;
    const bodyHeight = body.height * 0.7;

    body.setSize(bodyWidth, bodyHeight);
    body.setOffset(
        (body.width - bodyWidth) / 2,
        (body.height - bodyHeight) / 2
    );

    return triangle;
}

// =========================
// BOULES ROUGES
// =========================
export function createRedCircle(scene, x, y, riseAmount = 100, direction = 'up') {
    const radius = 10;

    const gfx = scene.add.graphics();
    gfx.fillStyle(0xFF0000, 1);
    gfx.fillCircle(radius, radius, radius);

    const key = `redCircle-${x}-${y}`;
    gfx.generateTexture(key, radius * 2, radius * 2);
    gfx.destroy();

    const circle = scene.physics.add.sprite(x, y, key);
    circle.setCircle(radius);
    circle.body.allowGravity = false;
    circle.body.immovable = true;

    const targetY = direction === 'up' ? y - riseAmount : y + riseAmount;

    scene.tweens.add({
        targets: circle,
        y: targetY,
        duration: 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
    });

    return circle;
}

// =========================
// CARRES ROUGES
// =========================
export function createRedSquare(x, y, scene, distance = 100, direction = 'right') {
    const size = 40;

    const gfx = scene.add.graphics();
    gfx.fillStyle(0xFF0000, 1);
    gfx.fillRect(0, 0, size, size);

    const key = `redSquare-${x}-${y}-${direction}`;
    gfx.generateTexture(key, size, size);
    gfx.destroy();

    const square = scene.physics.add.sprite(x, y, key);
    square.body.allowGravity = false;
    square.body.immovable = true;

    let targetX = x + (direction === 'left' ? -distance : distance);

    scene.tweens.add({
        targets: square,
        x: targetX,
        duration: 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
    });

    return square;
}

// =========================
// SORTIE (BLEU)
// =========================
export function createBlueCircle(scene, x, y) {
    const radius = 20;

    const gfx = scene.add.graphics();
    gfx.fillStyle(0x0000FF, 1);
    gfx.fillCircle(radius, radius, radius);

    const key = `blueCircle-${x}-${y}`;
    gfx.generateTexture(key, radius * 2, radius * 2);
    gfx.destroy();

    const circle = scene.physics.add.sprite(x, y, key);
    circle.setCircle(radius);
    circle.body.allowGravity = false;

    scene.tweens.add({
        targets: circle,
        y: circle.y - 5,
        duration: 800,
        yoyo: true,
        repeat: -1
    });

    return circle;
}

// =========================
// GLACE
// =========================
export function createIcePlatform(scene, x, y, widthInPx, heightInPx = 40) {
    const tileSize = 40;

    const rows = Math.floor(heightInPx / tileSize);
    const cols = Math.floor(widthInPx / tileSize);

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {

            const gfx = scene.add.graphics();

            gfx.fillStyle(0x9EE7FF, 1);
            gfx.fillRect(0, 0, tileSize, tileSize);

            gfx.fillStyle(0xFFFFFF, 0.5);
            gfx.fillRect(0, 0, tileSize, 6);

            const key = `ice-${x}-${y}-${r}-${c}`;
            gfx.generateTexture(key, tileSize, tileSize);
            gfx.destroy();

            const block = scene.icePlatforms.create(
                x + c * tileSize,
                y + r * tileSize,
                key
            );

            block.setOrigin(0, 0);
            block.refreshBody();
        }
    }
}

// =========================
// NEIGE
// =========================
export function createSnow(scene) {
    if (!scene.textures.exists("snowflake")) {
        const gfx = scene.add.graphics();
        gfx.fillStyle(0xffffff, 1);
        gfx.fillCircle(2, 2, 2);
        gfx.generateTexture("snowflake", 4, 4);
        gfx.destroy();
    }

    const particles = scene.add.particles(0, 0, "snowflake", {
        x: { min: 0, max: scene.scale.width },
        y: -10,
        lifespan: 6000,
        speedY: { min: 30, max: 80 },
        speedX: { min: -20, max: 20 },
        quantity: 4,
        frequency: 100
    });

    particles.setDepth(-10);
    particles.setScrollFactor(0);
}

// =========================
// MOBILE
// =========================
export function createMobileControls(scene) {
    if (!scene.sys.game.device.input.touch) return;

    scene.movingLeft = false;
    scene.movingRight = false;

    const createButtons = () => {
        const { width, height } = scene.scale;

        if (scene.leftBtn) {
            scene.leftBtn.destroy();
            scene.rightBtn.destroy();
            scene.jumpBtn.destroy();
        }

        const size = Math.max(48, width * 0.08);
        const margin = width * 0.05;

        const style = {
            fontSize: `${size}px`,
            color: "#ffffff",
            backgroundColor: "#00BFFF",
            padding: { x: size * 0.4, y: size * 0.25 }
        };

        scene.leftBtn = scene.add.text(margin, height - size * 2, "◀", style).setInteractive();
        scene.rightBtn = scene.add.text(margin + size * 1.4, height - size * 2, "▶", style).setInteractive();
        scene.jumpBtn = scene.add.text(width - margin - size, height - size * 2, "⬆", style).setInteractive();

        scene.leftBtn.on('pointerdown', () => scene.movingLeft = true);
        scene.leftBtn.on('pointerup', () => scene.movingLeft = false);
        scene.leftBtn.on('pointerout', () => scene.movingLeft = false);

        scene.rightBtn.on('pointerdown', () => scene.movingRight = true);
        scene.rightBtn.on('pointerup', () => scene.movingRight = false);
        scene.rightBtn.on('pointerout', () => scene.movingRight = false);

        scene.jumpBtn.on('pointerdown', () => scene.jumpPlayer());
    };

    createButtons();
    scene.scale.on('resize', createButtons);
}
