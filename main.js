// =========================================================
//                     MAIN — POINT D'ENTRÉE
// =========================================================
import { LoadingScene }      from "./scenes/LoadingScene.js";
import { MenuScene }         from "./scenes/MenuScene.js";
import { LevelScene }        from "./scenes/LevelScene.js";
import { ShopScene }         from "./scenes/ShopScene.js";
import { World1, World2 }    from "./scenes/WorldScenes.js";
import { LevelEditorScene }  from "./scenes/LevelEditorScene.js";
import {
  SettingsScene,
  CreditsScene,
  Stats,
  ObjectivesScene,
  LeaderboardScene,
  FriendsScene
} from "./scenes/OtherScenes.js";

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: "#ADD8E6",
  physics: {
    default: "arcade",
    arcade: { gravity: { y: 650 }, debug: false }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [
    LoadingScene,
    MenuScene,
    LevelScene,
    ShopScene,
    World1,
    SettingsScene,
    CreditsScene,
    Stats,
    World2,
    ObjectivesScene,
    LeaderboardScene,
    FriendsScene,
    LevelEditorScene,
  ]
};

new Phaser.Game(config);
