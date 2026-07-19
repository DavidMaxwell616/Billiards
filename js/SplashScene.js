export class SplashScene extends Phaser.Scene {
    constructor() {
        super("SplashScene");
        this.isStarting = false;
    }

    preload() {
        this.load.image(
            "pool hall splash",
            "assets/images/pool-hall-splash.png"
        );
    }

    create() {
        this.background = this.add.image(
            this.scale.width / 2,
            this.scale.height / 2,
            "pool hall splash"
        );
        this.shade = this.add.rectangle(
            this.scale.width / 2,
            this.scale.height / 2,
            this.scale.width,
            this.scale.height,
            0x020507,
            0.2
        );

        this.title = this.add.text(
            this.scale.width / 2,
            this.scale.height * 0.13,
            "ROBOSHARK",
            {
                fontFamily: "Arial Black, Arial, sans-serif",
                fontSize: "72px",
                fontStyle: "bold",
                color: "#f4ead6",
                stroke: "#080b0d",
                strokeThickness: 10,
                shadow: {
                    offsetX: 0,
                    offsetY: 5,
                    color: "#000000",
                    blur: 12,
                    fill: true
                }
            }
        ).setOrigin(0.5);

        this.subtitle = this.add.text(
            this.scale.width / 2,
            this.scale.height * 0.23,
            "HUMAN  VS  MACHINE",
            {
                fontFamily: "Arial, sans-serif",
                fontSize: "24px",
                fontStyle: "bold",
                color: "#75d9e8",
                letterSpacing: 7,
                stroke: "#071014",
                strokeThickness: 5
            }
        ).setOrigin(0.5);

        this.startButton = this.add.text(
            this.scale.width / 2,
            this.scale.height * 0.86,
            "CLICK TO BREAK",
            {
                fontFamily: "Arial, sans-serif",
                fontSize: "24px",
                fontStyle: "bold",
                color: "#fff3d1",
                backgroundColor: "rgba(4, 12, 15, 0.78)",
                padding: { x: 30, y: 15 },
                stroke: "#162329",
                strokeThickness: 2
            }
        )
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        this.tweens.add({
            targets: this.startButton,
            alpha: 0.58,
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
        });

        this.startButton.on("pointerover", () => this.startButton.setScale(1.04));
        this.startButton.on("pointerout", () => this.startButton.setScale(1));
        this.startButton.on("pointerdown", () => this.startGame());
        this.input.keyboard.on("keydown-ENTER", this.startGame, this);
        this.input.keyboard.on("keydown-SPACE", this.startGame, this);
        this.scale.on("resize", this.resize, this);
        this.events.once("shutdown", () => {
            this.scale.off("resize", this.resize, this);
            this.input.keyboard.off("keydown-ENTER", this.startGame, this);
            this.input.keyboard.off("keydown-SPACE", this.startGame, this);
        });

        this.resize({ width: this.scale.width, height: this.scale.height });
        this.cameras.main.fadeIn(500, 0, 0, 0);
    }

    startGame() {
        if (this.isStarting) return;
        this.isStarting = true;
        this.startButton.disableInteractive().setText("RACKING THE TABLE...");
        this.cameras.main.fadeOut(450, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => {
            this.scene.start("GameScene");
        });
    }

    resize(gameSize) {
        const width = gameSize.width;
        const height = gameSize.height;
        const source = this.background.texture.getSourceImage();
        const coverScale = Math.max(width / source.width, height / source.height);

        this.background
            .setPosition(width / 2, height / 2)
            .setScale(coverScale);
        this.shade
            .setPosition(width / 2, height / 2)
            .setSize(width, height);
        this.title
            .setPosition(width / 2, height * 0.13)
            .setFontSize(Phaser.Math.Clamp(width * 0.047, 42, 76));
        this.subtitle
            .setPosition(width / 2, height * 0.23)
            .setFontSize(Phaser.Math.Clamp(width * 0.016, 15, 26));
        this.startButton
            .setPosition(width / 2, height * 0.86)
            .setFontSize(Phaser.Math.Clamp(width * 0.016, 17, 25));
    }
}
