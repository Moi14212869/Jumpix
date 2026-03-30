import { gameVolume } from "../global.js";

export class CreditsScene extends Phaser.Scene {
    constructor() {
        super("CreditsScene");
    }

    create() {
        const { width, height } = this.scale;

        // --- Fond (optionnel mais plus propre visuellement) ---
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000);

        // --- Contenu des crédits ---
        const credits = [
            "Credits",
            "",
            "A game by",
            "OneLevel Studio",
            "",
            "Producer & Lead Programmer",
            "Eliott MORBIDELLI",
            "",
            "Visual Designer",
            "Leonie MORBIDELLI",
            "",
            "Lead Level Designer",
            "Eliott MORBIDELLI",
            "",
            "Level Designers",
            "A. MORBIDELLI",
            "Alix MORBIDELLI",
            "",
            "QA Testers",
            "Maxence ROOS",
            "",
            "Thanks for playing!"
        ];

        // --- Container ---
        this.creditContainer = this.add.container(width / 2, height + 50);

        let offsetY = 0;

        credits.forEach((line, index) => {

            const style = {
                fontSize: index === 0 ? "36px" : "26px",
                color: index === 0 ? "#ffff00" : "#ffffff",
                fontStyle: index === 0 ? "bold" : "normal"
            };

            const text = this.add.text(0, offsetY, line, style)
                .setOrigin(0.5);

            this.creditContainer.add(text);

            offsetY += 45;
        });

        // --- Vitesse ---
        this.scrollSpeed = 50;

        // --- Click pour quitter ---
        this.input.once("pointerdown", () => {
            this.sound.play("menu", { volume: gameVolume });
            this.scene.start("MenuScene");
        });
    }

    update(time, delta) {
        // Scroll vers le haut
        this.creditContainer.y -= this.scrollSpeed * (delta / 1000);

        // Fin → retour menu
        const last = this.creditContainer.list[this.creditContainer.list.length - 1];

        if (last.y + this.creditContainer.y < -50) {
            this.scene.start("MenuScene");
        }
    }
}
