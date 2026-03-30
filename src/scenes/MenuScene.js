import { gameVolume, playerCoins } from "../global.js";
import { createButton } from "../utils/ui.js";

export class MenuScene extends Phaser.Scene {
    constructor() {
        super("MenuScene");
    }

    create() {
        const { width, height } = this.scale;

        // --- Fond ---
        this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);

        // --- Titre ---
        this.add.text(width / 2, 120, "Jumpix", {
            fontSize: "50px",
            color: "#ffffff",
            fontStyle: "bold"
        }).setOrigin(0.5);

        // --- Coins ---
        this.coinText = this.add.text(width - 20, 20, `💰 ${playerCoins}`, {
            fontSize: "28px",
            color: "#ffff00",
            fontStyle: "bold"
        }).setOrigin(1, 0);

        // --- Boutons ---
        const buttons = [
            { label: "➡ Play !!", scene: "World1" },
            { label: "Shop 🛒", scene: "ShopScene" },
            { label: "🏆 Objectives", scene: "ObjectivesScene" },
            { label: "Statistics", scene: "Stats" },
            { label: "Credits", scene: "CreditsScene" }
        ];

        let startY = 240;

        buttons.forEach((btn, i) => {
            createButton(
                this,
                width / 2,
                startY,
                320,
                60,
                btn.label,
                () => {
                    this.sound.play("select", { volume: gameVolume });
                    this.scene.start(btn.scene);
                },
                i
            );
            startY += 80;
        });

        // --- Settings ⚙ ---
        createButton(
            this,
            40,
            40,
            60,
            50,
            "⚙",
            () => {
                this.sound.play("menu", { volume: gameVolume });
                this.scene.start("SettingsScene");
            }
        );
    }
}
