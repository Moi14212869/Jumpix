export function createButton(scene, x, y, width, height, label, callback, index = 0) {

    const bg = scene.add.rectangle(x, y + 50, width, height, 0x00BFFF, 0.5)
        .setOrigin(0.5)
        .setStrokeStyle(2, 0xffffff)
        .setInteractive();

    const text = scene.add.text(x, y + 50, label, {
        fontSize: "28px",
        color: "#ffffff",
        fontStyle: "bold"
    }).setOrigin(0.5);

    scene.tweens.add({
        targets: [bg, text],
        y: y,
        alpha: { from: 0, to: 1 },
        duration: 700,
        delay: index * 100,
        ease: "Back.easeOut"
    });

    [bg, text].forEach(obj => {

        obj.on("pointerover", () => {
            bg.setFillStyle(0x00BFFF, 0.9);
            text.setStyle({ color: "#00FFFF" });
            scene.tweens.add({ targets: [bg, text], scale: 1.05, duration: 150 });
        });

        obj.on("pointerout", () => {
            bg.setFillStyle(0x00BFFF, 0.5);
            text.setStyle({ color: "#ffffff" });
            scene.tweens.add({ targets: [bg, text], scale: 1, duration: 150 });
        });

        obj.on("pointerdown", () => {
            callback();
            scene.tweens.add({
                targets: [bg, text],
                scale: 0.95,
                duration: 50,
                yoyo: true
            });
        });
    });

    return { bg, text };
}
