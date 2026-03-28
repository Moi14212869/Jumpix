import { LoadingScene } from "../scenes/LoadingScene.js";
import { MenuScene } from "../scenes/MenuScene.js";
import { LevelScene } from "../scenes/LevelScene.js";
import { ShopScene } from "../scenes/ShopScene.js";
import { World1 } from "../scenes/World1.js";
import { World2 } from "../scenes/World2.js";
import { SettingsScene } from "../scenes/SettingsScene.js";
import { CreditsScene } from "../scenes/CreditsScene.js";
import { Stats } from "../scenes/Stats.js";
import { ObjectivesScene } from "../scenes/ObjectivesScene.js";
export const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#ADD8E6',
  physics: { default: 'arcade', arcade: { gravity: { y: 650 }, debug: false } },
   scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
   },
  scene: [LoadingScene, MenuScene,  LevelScene, ShopScene, World1, SettingsScene, CreditsScene, Stats, World2, ObjectivesScene]
};
