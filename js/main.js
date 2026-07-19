import { GameScene } from "./GameScene.js";
import { SplashScene } from "./SplashScene.js";


const config = {
    type: Phaser.AUTO,
    parent: "game",
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: "#10151c",
    physics: {
        default: "arcade",
        arcade: {
            debug: false
        }
    },
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [SplashScene, GameScene]
};

new Phaser.Game(config);
