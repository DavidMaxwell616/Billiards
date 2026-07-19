import { ballTypes, getBallPalette } from "./config.js";
export class GameScene extends Phaser.Scene {
    constructor() {
        super("GameScene");

        this.ballRadius = 16;
        this.acceleration = 900;
        this.maxSpeed = 1050;
        this.tableFriction = .8;
        this.ballStopSpeed = 5;
        this.restitution = 0.82;
        this.ballCollisionRestitution = 0.96;

        this.cueTipPadding = 7;
        this.maxCuePullback = 140;
        this.maxShotSpeed = this.maxSpeed;
        this.cueAngle = 0;
        this.cuePullback = 0;
        this.shotPower = 0;
        this.cueState = "hidden";
        this.cueStrikeTween = null;

        this.ballTextureSize = this.ballRadius * 2;
        this.balls = [];
        this.rackOrder = [];
        this.selectedBall = null;
        this.rerackPending = false;
        this.isScratchSequence = false;
        this.scratchTween = null;

        this.players = {
            player: { name: "PLAYER", group: null, score: 0 },
            computer: { name: "COMPUTER", group: null, score: 0 }
        };
        this.currentTurn = "player";
        this.shotInProgress = false;
        this.shotPocketed = [];
        this.cueBallScratched = false;
        this.firstContactBall = null;
        this.gameOver = false;
        this.aiShotTimer = null;
        this.gameOverPhase = null;
        this.gameOverTimers = [];
    }

    preload() {
        this.load.image(
            "pool table",
            "assets/images/pool-table-background.png"
        );
        this.load.image(
            "cue stick",
            "assets/images/cue-stick-generated.png"
        );

    }

    create() {
        this.createTextures();
        this.createArena();
        this.createBalls();
        this.createCueStick();
        this.createControls();
        this.createHud();

        this.scale.on("resize", this.resize, this);
    }

    createTextures() {
        // Each ball needs its own texture because its marking rolls independently.
        const size = this.ballTextureSize;
        for (const ballType of ballTypes) {
            const texture = this.textures.createCanvas(
                `ball-${ballType.index}`,
                size,
                size
            );
            const ballState = {
                type: ballType,
                texture,
                context: texture.context,
                spotVector: { x: 0, y: 0, z: 1 },
                stripeNormal: { x: 0, y: 1, z: 0 },
                rotationScale: 1,
                rotationPause: 0,
                surfaceX: 0,
                surfaceY: 0
            };
            this.randomizeBallOrientation(ballState);
            this.balls.push(ballState);
            this.redrawBallTexture(ballState);
        }

        // Soft oval shadow
        const r = this.ballRadius;
        const shadowWidth = Math.round(r * 2.44);
        const shadowHeight = Math.round(r * 1.39);
        const shadowCenterX = shadowWidth / 2;
        const shadowCenterY = shadowHeight / 2;
        const shadow = this.textures.createCanvas(
            "shadow",
            shadowWidth,
            shadowHeight
        );
        const sctx = shadow.context;
        const shadowGradient = sctx.createRadialGradient(
            shadowCenterX,
            shadowCenterY,
            r * 0.087,
            shadowCenterX,
            shadowCenterY,
            shadowWidth * 0.464
        );
        shadowGradient.addColorStop(0, "rgba(0,0,0,0.42)");
        shadowGradient.addColorStop(1, "rgba(0,0,0,0)");
        sctx.fillStyle = shadowGradient;
        sctx.fillRect(0, 0, shadowWidth, shadowHeight);
        shadow.refresh();

        // Static studio-style highlights, kept separate from the rotating surface.
        const shine = this.textures.createCanvas("shine", size, size);
        const hctx = shine.context;
        const cx = r;
        const cy = r;
        hctx.save();
        hctx.beginPath();
        hctx.arc(cx, cy, r * 0.935, 0, Math.PI * 2);
        hctx.clip();

        // Broad, faint sheen across the upper dome.
        const domeSheen = hctx.createLinearGradient(0, cy - r, 0, cy + r * 0.1);
        domeSheen.addColorStop(0, "rgba(255,255,255,0.34)");
        domeSheen.addColorStop(0.48, "rgba(255,255,255,0.08)");
        domeSheen.addColorStop(1, "rgba(255,255,255,0)");
        hctx.fillStyle = domeSheen;
        hctx.fillRect(0, 0, size, size);

        // Bright oblong reflection in the upper-left, matching the reference.
        hctx.save();
        hctx.translate(cx - r * 0.3, cy - r * 0.34);
        hctx.rotate(-0.58);
        hctx.shadowColor = "rgba(255,255,255,0.7)";
        hctx.shadowBlur = 4;
        const mainGloss = hctx.createLinearGradient(
            -r * 0.3,
            -r * 0.08,
            r * 0.3,
            r * 0.08
        );
        mainGloss.addColorStop(0, "rgba(255,255,255,0.28)");
        mainGloss.addColorStop(0.35, "rgba(255,255,255,0.88)");
        mainGloss.addColorStop(1, "rgba(255,255,255,0.48)");
        hctx.fillStyle = mainGloss;
        hctx.beginPath();
        hctx.ellipse(0, 0, r * 0.3, r * 0.115, 0, 0, Math.PI * 2);
        hctx.fill();
        hctx.restore();

        // Smaller reflected glint beside the main studio light.
        const glint = hctx.createRadialGradient(
            cx - r * 0.53,
            cy - r * 0.05,
            0,
            cx - r * 0.53,
            cy - r * 0.05,
            r * 0.12
        );
        glint.addColorStop(0, "rgba(255,255,255,0.32)");
        glint.addColorStop(1, "rgba(255,255,255,0)");
        hctx.fillStyle = glint;
        hctx.fillRect(0, 0, size, size);

        // Slim curved reflections along the polished right and lower rim.
        hctx.lineCap = "round";
        hctx.lineWidth = 3;
        hctx.strokeStyle = "rgba(255,255,255,0.16)";
        hctx.beginPath();
        hctx.arc(cx, cy, r * 0.82, -0.42, 0.92);
        hctx.stroke();
        hctx.lineWidth = 2;
        hctx.strokeStyle = "rgba(255,255,255,0.1)";
        hctx.beginPath();
        hctx.arc(cx, cy, r * 0.76, 0.72, 2.2);
        hctx.stroke();

        hctx.restore();
        shine.refresh();
    }

    randomizeBallOrientation(ballState) {
        // Shoemake's method produces an even random rotation over a sphere.
        const u1 = Math.random();
        const u2 = Math.random();
        const u3 = Math.random();
        const qx = Math.sqrt(1 - u1) * Math.sin(Math.PI * 2 * u2);
        const qy = Math.sqrt(1 - u1) * Math.cos(Math.PI * 2 * u2);
        const qz = Math.sqrt(u1) * Math.sin(Math.PI * 2 * u3);
        const qw = Math.sqrt(u1) * Math.cos(Math.PI * 2 * u3);
        const rotate = vector => {
            const dot = qx * vector.x + qy * vector.y + qz * vector.z;
            const crossX = qy * vector.z - qz * vector.y;
            const crossY = qz * vector.x - qx * vector.z;
            const crossZ = qx * vector.y - qy * vector.x;

            return {
                x: 2 * dot * qx + (2 * qw * qw - 1) * vector.x + 2 * qw * crossX,
                y: 2 * dot * qy + (2 * qw * qw - 1) * vector.y + 2 * qw * crossY,
                z: 2 * dot * qz + (2 * qw * qw - 1) * vector.z + 2 * qw * crossZ
            };
        };

        ballState.spotVector = rotate({ x: 0, y: 0, z: 1 });
        ballState.stripeNormal = rotate({ x: 0, y: 1, z: 0 });
    }



    // const rackMatrix = generateBilliardMatrix();
    // console.log(rackMatrix); // Outputs a 5x5 array containing coordinate objects


    drawProjectedStripe(ctx, ballState, palette, cx, cy, r, size) {
        const image = ctx.getImageData(0, 0, size, size);
        const pixels = image.data;
        const normal = ballState.stripeNormal;
        const colorValue = Number.parseInt(palette[1].slice(1), 16);
        const stripeColor = {
            r: (colorValue >> 16) & 255,
            g: (colorValue >> 8) & 255,
            b: colorValue & 255
        };
        const halfWidth = 0.4;
        const feather = 0.035;
        const visibleRadius = r * 0.957;

        for (let py = 0; py < size; py++) {
            const y = (py - cy) / visibleRadius;

            for (let px = 0; px < size; px++) {
                const x = (px - cx) / visibleRadius;
                const radiusSquared = x * x + y * y;
                if (radiusSquared > 1) continue;

                // Reconstruct the visible hemisphere and test whether this
                // surface point lies inside the rotating spherical band.
                const z = Math.sqrt(1 - radiusSquared);
                const distance = Math.abs(
                    normal.x * x + normal.y * y + normal.z * z
                );
                const coverage = Phaser.Math.Clamp(
                    (halfWidth + feather - distance) / feather,
                    0,
                    1
                );
                if (coverage <= 0) continue;

                const offset = (py * size + px) * 4;
                const brightness = (
                    pixels[offset] + pixels[offset + 1] + pixels[offset + 2]
                ) / (3 * 220);
                const shade = Phaser.Math.Clamp(brightness, 0.25, 1.2);
                const red = Math.min(255, stripeColor.r * shade);
                const green = Math.min(255, stripeColor.g * shade);
                const blue = Math.min(255, stripeColor.b * shade);

                pixels[offset] += (red - pixels[offset]) * coverage;
                pixels[offset + 1] += (green - pixels[offset + 1]) * coverage;
                pixels[offset + 2] += (blue - pixels[offset + 2]) * coverage;
            }
        }

        ctx.putImageData(image, 0, 0);
    }

    redrawBallTexture(ballState) {
        const ctx = ballState.context;
        const size = this.ballTextureSize;
        const r = this.ballRadius;
        const cx = r;
        const cy = r;
        const palette = getBallPalette(ballState.type.color);

        ctx.clearRect(0, 0, size, size);

        // Clip the artwork to the visible sphere.
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.957, 0, Math.PI * 2);
        ctx.clip();

        // Base color and spherical shading stay fixed in screen space.
        const gradient = ctx.createRadialGradient(
            cx - r * 0.34,
            cy - r * 0.38,
            r * 0.08,
            cx,
            cy,
            r
        );

        const spherePalette = ballState.type.type === "stripe"
            ? getBallPalette("white")
            : palette;
        gradient.addColorStop(0, spherePalette[0]);
        gradient.addColorStop(0.46, spherePalette[1]);
        gradient.addColorStop(1, spherePalette[2]);

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        if (ballState.type.type === "stripe") {
            this.drawProjectedStripe(ctx, ballState, palette, cx, cy, r, size);
        }

        // Draw the white spot only while it is on the visible hemisphere.
        const spot = ballState.spotVector;
        if (ballState.type.index !== 0 && spot.z > 0) {
            const spotRadius = r * 0.52;
            const radialScale = Math.max(0.08, spot.z);
            const radialRadius = spotRadius * radialScale;
            const radialAngle = Math.atan2(spot.y, spot.x);
            const spotX = cx + spot.x * r * 0.913;
            const spotY = cy + spot.y * r * 0.913;
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.ellipse(
                spotX,
                spotY,
                radialRadius,
                spotRadius,
                radialAngle,
                0,
                Math.PI * 2
            );
            ctx.fill();

            // Apply the spot's foreshortening to its number as well.
            ctx.save();
            ctx.translate(spotX, spotY);
            ctx.rotate(radialAngle);
            ctx.scale(radialScale, 1);
            ctx.rotate(-radialAngle);
            ctx.fillStyle = "#050505";
            ctx.font = `bold ${spotRadius * 1.25}px Arial, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(ballState.type.index), 0, 1);
            ctx.restore();
        }

        ctx.restore();

        ballState.texture.refresh();
    }

    rotateBallSurface(ballState, velocity, speed, dt) {
        // The rolling axis is perpendicular to travel, so a spot at the top
        // initially moves across the ball parallel to its velocity.
        const axisX = -velocity.y / speed;
        const axisY = velocity.x / speed;
        const angle = speed * dt / this.ballRadius;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const oneMinusCos = 1 - cos;
        const rotateVector = vector => {
            const dot = axisX * vector.x + axisY * vector.y;
            const x = vector.x * cos
                + axisY * vector.z * sin
                + axisX * dot * oneMinusCos;
            const y = vector.y * cos
                - axisX * vector.z * sin
                + axisY * dot * oneMinusCos;
            const z = vector.z * cos
                + (axisX * vector.y - axisY * vector.x) * sin;
            const length = Math.hypot(x, y, z);

            return {
                x: x / length,
                y: y / length,
                z: z / length
            };
        };

        ballState.spotVector = rotateVector(ballState.spotVector);
        ballState.stripeNormal = rotateVector(ballState.stripeNormal);
    }

    createArena() {
        const width = this.scale.width;
        const height = this.scale.height;

        this.updateWorldBounds(width, height);

        this.floor = this.add.image(
            width / 2,
            height / 2,
            "pool table"
        ).setDisplaySize(width, height);

        this.createTableHoles();
        this.tableSpots = this.add.graphics().setDepth(0.5);
        this.drawTableSpots();
    }

    getHoleLayout(width = this.scale.width, height = this.scale.height) {
        const left = width * 0.052;
        const center = width / 2;
        const right = width * 0.948;
        const top = height * 0.08;
        const bottom = height * 0.92;
        const imageScale = Math.min(width / 1536, height / 1024);
        const radius = Math.max(this.ballRadius * 1.25, imageScale * 50);

        return {
            radius,
            positions: [
                { name: "top-left", x: left, y: top },
                { name: "top-center", x: center, y: top },
                { name: "top-right", x: right, y: top },
                { name: "bottom-left", x: left, y: bottom },
                { name: "bottom-center", x: center, y: bottom },
                { name: "bottom-right", x: right, y: bottom }
            ]
        };
    }

    createTableHoles() {
        const layout = this.getHoleLayout();
        this.holes = layout.positions.map(position => {
            const hole = this.add.circle(
                position.x,
                position.y,
                layout.radius,
                0x030303,
                0.96
            )
                .setName(`hole-${position.name}`)
                .setStrokeStyle(2, 0x17100c, 0.9)
                .setDepth(0.75);
            this.physics.add.existing(hole, true);
            hole.body.setCircle(layout.radius);
            return hole;
        });
    }

    layoutTableHoles(width, height) {
        const layout = this.getHoleLayout(width, height);

        this.holes.forEach((hole, index) => {
            const position = layout.positions[index];
            hole.setPosition(position.x, position.y);
            hole.setRadius(layout.radius);
            hole.body.setCircle(layout.radius);
            hole.body.reset(position.x, position.y);
        });
    }

    getTableBounds(width = this.scale.width, height = this.scale.height) {
        const railX = width * 0.065;
        const railY = height * 0.105;

        return new Phaser.Geom.Rectangle(
            railX,
            railY,
            Math.max(1, width - railX * 2),
            Math.max(1, height - railY * 2)
        );
    }

    updateWorldBounds(width, height) {
        const bounds = this.getTableBounds(width, height);
        this.physics.world.setBounds(
            bounds.x,
            bounds.y,
            bounds.width,
            bounds.height
        );
    }

    drawTableSpots() {
        const footSpot = this.getFootSpotPosition();
        const opposingFootSpot = this.getOpposingFootSpotPosition();
        const spotRadius = Math.max(2.5, this.ballRadius * 0.14);

        this.tableSpots.clear();
        this.tableSpots.fillStyle(0xffffff, 0.95);
        this.tableSpots.fillCircle(footSpot.x, footSpot.y, spotRadius);
        this.tableSpots.fillCircle(
            opposingFootSpot.x,
            opposingFootSpot.y,
            spotRadius
        );
    }

    getFootSpotPosition(width = this.scale.width, height = this.scale.height) {
        const bounds = this.getTableBounds(width, height);

        return {
            x: bounds.right - bounds.width / 4,
            y: bounds.centerY
        };
    }

    getOpposingFootSpotPosition(
        width = this.scale.width,
        height = this.scale.height
    ) {
        const bounds = this.getTableBounds(width, height);

        return {
            x: bounds.left + bounds.width / 4,
            y: bounds.centerY
        };
    }

    constrainBallToScreen(ballState, width = this.scale.width, height = this.scale.height) {
        const bounds = this.getTableBounds(width, height);
        const radius = this.ballRadius;
        const minX = bounds.left + radius;
        const maxX = bounds.right - radius;
        const minY = bounds.top + radius;
        const maxY = bounds.bottom - radius;
        const safeX = maxX >= minX
            ? Phaser.Math.Clamp(ballState.image.x, minX, maxX)
            : width / 2;
        const safeY = maxY >= minY
            ? Phaser.Math.Clamp(ballState.image.y, minY, maxY)
            : height / 2;

        if (ballState.image.x !== safeX || ballState.image.y !== safeY) {
            const body = ballState.image.body;
            let bounced = false;

            if (ballState.image.x < minX && body.velocity.x < 0) {
                body.velocity.x = Math.abs(body.velocity.x) * this.restitution;
                bounced = true;
            } else if (ballState.image.x > maxX && body.velocity.x > 0) {
                body.velocity.x = -Math.abs(body.velocity.x) * this.restitution;
                bounced = true;
            }

            if (ballState.image.y < minY && body.velocity.y < 0) {
                body.velocity.y = Math.abs(body.velocity.y) * this.restitution;
                bounced = true;
            } else if (ballState.image.y > maxY && body.velocity.y > 0) {
                body.velocity.y = -Math.abs(body.velocity.y) * this.restitution;
                bounced = true;
            }

            ballState.image.setPosition(safeX, safeY);
            body.updateFromGameObject();

            if (bounced) {
                this.reduceRotationOnWallHit(body);
            }
        }
    }

    getBallStartPosition(ballIndex) {
        if (ballIndex === 0) {
            return this.getFootSpotPosition();
        }

        const bounds = this.getTableBounds();
        const verticalSpacing = this.ballRadius * 2;
        const horizontalSpacing = Math.sqrt(3) * this.ballRadius;
        const pointX = this.getOpposingFootSpotPosition().x;
        const rackSlots = [];

        // Build columns 5, 4, 3, 2, 1 from left to right so the triangle
        // points right. The center of the three-ball column is the rack center.
        for (let column = 0; column < 5; column++) {
            const ballCount = 5 - column;
            const x = pointX - (4 - column) * horizontalSpacing;

            for (let row = 0; row < ballCount; row++) {
                rackSlots.push({
                    x,
                    y: bounds.centerY
                        + (row - (ballCount - 1) / 2) * verticalSpacing,
                    isCenter: column === 2 && row === 1
                });
            }
        }

        for (let slotIndex = 0; slotIndex < rackSlots.length; slotIndex++) {
            if (this.rackOrder[slotIndex] === ballIndex) {
                const slot = rackSlots[slotIndex];
                return { x: slot.x, y: slot.y };
            }
        }

        return { x: bounds.centerX, y: bounds.centerY };
    }

    randomizeRackOrder() {
        const shuffledIndexes = ballTypes
            .map(ballType => ballType.index)
            .filter(index => index !== 0 && index !== 8);
        Phaser.Utils.Array.Shuffle(shuffledIndexes);

        let shuffledIndex = 0;
        this.rackOrder = [];

        // Slot 10 is the center of the three-ball column.
        for (let slotIndex = 0; slotIndex < 15; slotIndex++) {
            this.rackOrder.push(
                slotIndex === 10 ? 8 : shuffledIndexes[shuffledIndex++]
            );
        }
    }

    createBallGameObjects(ballState, position, bounds) {
        ballState.pocketed = false;
        ballState.pocketing = false;
        ballState.pocketTween = null;
        ballState.shadow = this.add.image(
            position.x + this.ballRadius * 0.217,
            position.y + this.ballRadius * 0.37,
            "shadow"
        ).setDepth(1);

        ballState.image = this.physics.add.image(
            position.x,
            position.y,
            `ball-${ballState.type.index}`
        )
            .setDepth(2)
            .setCircle(this.ballRadius * 0.935)
            .setBounce(this.ballCollisionRestitution)
            .setMass(1)
            .setImmovable(false)
            .setPushable(true)
            .setCollideWorldBounds(true, this.restitution, this.restitution)
            .setMaxVelocity(this.maxSpeed, this.maxSpeed);
        ballState.image.body.setBoundsRectangle(bounds);
        ballState.image.body.onWorldBounds = true;
        this.ballGroup.add(ballState.image);
        this.constrainBallToScreen(ballState);

        ballState.shine = this.add.image(position.x, position.y, "shine")
            .setDepth(3);
    }

    createBalls() {
        this.randomizeRackOrder();
        this.ballGroup = this.physics.add.group();
        this.physics.world.on("worldbounds", this.reduceRotationOnWallHit, this);
        this.events.once("shutdown", () => {
            this.physics.world.off(
                "worldbounds",
                this.reduceRotationOnWallHit,
                this
            );
        });
        const bounds = this.getTableBounds();

        this.balls.forEach(ballState => {
            const position = this.getBallStartPosition(ballState.type.index);
            this.createBallGameObjects(ballState, position, bounds);
        });

        this.physics.add.collider(
            this.ballGroup,
            this.ballGroup,
            this.applyCollisionMomentum,
            this.prepareCollisionMomentum,
            this
        );
        this.physics.add.overlap(
            this.ballGroup,
            this.holes,
            this.pocketBall,
            null,
            this
        );
        this.selectedBall = this.balls[0];
    }

    prepareCollisionMomentum(firstBall, secondBall) {
        this.pendingCollisionMomentum = null;
        const normalX = secondBall.x - firstBall.x;
        const normalY = secondBall.y - firstBall.y;
        const distance = Math.hypot(normalX, normalY);
        if (distance === 0) return true;

        const unitX = normalX / distance;
        const unitY = normalY / distance;
        const relativeX = secondBall.body.velocity.x - firstBall.body.velocity.x;
        const relativeY = secondBall.body.velocity.y - firstBall.body.velocity.y;
        const relativeNormalSpeed = relativeX * unitX + relativeY * unitY;

        if (relativeNormalSpeed >= 0) return true;

        const inverseMassA = 1 / firstBall.body.mass;
        const inverseMassB = 1 / secondBall.body.mass;
        const impulse = -(
            (1 + this.ballCollisionRestitution) * relativeNormalSpeed
        ) / (inverseMassA + inverseMassB);

        this.pendingCollisionMomentum = {
            firstBall,
            secondBall,
            firstVelocity: {
                x: firstBall.body.velocity.x - impulse * inverseMassA * unitX,
                y: firstBall.body.velocity.y - impulse * inverseMassA * unitY
            },
            secondVelocity: {
                x: secondBall.body.velocity.x + impulse * inverseMassB * unitX,
                y: secondBall.body.velocity.y + impulse * inverseMassB * unitY
            }
        };

        return true;
    }

    applyCollisionMomentum(firstBall, secondBall) {
        if (this.shotInProgress && this.firstContactBall === null) {
            const firstState = this.balls.find(candidate => candidate.image === firstBall);
            const secondState = this.balls.find(candidate => candidate.image === secondBall);
            if (firstState?.type.index === 0 && secondState?.type.index !== 0) {
                this.firstContactBall = secondState.type.index;
            } else if (secondState?.type.index === 0 && firstState?.type.index !== 0) {
                this.firstContactBall = firstState.type.index;
            }
        }

        const collision = this.pendingCollisionMomentum;
        if (!collision) return;

        const sameOrder = collision.firstBall === firstBall
            && collision.secondBall === secondBall;
        const reverseOrder = collision.firstBall === secondBall
            && collision.secondBall === firstBall;
        if (!sameOrder && !reverseOrder) return;

        collision.firstBall.setVelocity(
            collision.firstVelocity.x,
            collision.firstVelocity.y
        );
        collision.secondBall.setVelocity(
            collision.secondVelocity.x,
            collision.secondVelocity.y
        );
        this.pendingCollisionMomentum = null;
    }

    pocketBall(ballImage, hole) {
        const ballState = this.balls.find(candidate => candidate.image === ballImage);
        if (!ballState || !hole || ballState.pocketed || ballState.pocketing) return;

        ballState.pocketing = true;
        this.resetCueStick();
        ballImage.setVelocity(0, 0);
        ballImage.setAcceleration(0, 0);
        ballImage.body.enable = false;

        const visualLayers = [ballState.shadow, ballImage, ballState.shine];
        ballState.pocketTween = this.tweens.chain({
            tweens: [
                {
                    targets: visualLayers,
                    x: hole.x,
                    y: hole.y,
                    scaleX: 0.72,
                    scaleY: 0.72,
                    duration: 160,
                    ease: "Sine.easeIn"
                },
                {
                    targets: visualLayers,
                    x: hole.x,
                    y: hole.y,
                    scaleX: 0.08,
                    scaleY: 0.08,
                    alpha: 0,
                    duration: 220,
                    ease: "Quad.easeIn",
                    onComplete: () => {
                        // Resolve the live center again in case the table resized.
                        visualLayers.forEach(layer => layer.setPosition(hole.x, hole.y));
                        ballState.pocketTween = null;
                        this.finishPocketingBall(ballState);
                    }
                }
            ]
        });
    }

    finishPocketingBall(ballState) {
        const ballImage = ballState.image;
        if (!ballImage || !ballState.pocketing) return;

        if (ballState.type.index === 0) {
            if (this.shotInProgress) this.cueBallScratched = true;
            const footSpot = this.getFootSpotPosition();
            ballState.pocketing = false;
            ballImage
                .setScale(1)
                .setAlpha(1)
                .setPosition(footSpot.x, footSpot.y);
            ballState.shadow
                .setScale(1)
                .setAlpha(1)
                .setPosition(
                    footSpot.x + this.ballRadius * 0.217,
                    footSpot.y + this.ballRadius * 0.37
                );
            ballState.shine
                .setScale(1)
                .setAlpha(1)
                .setPosition(footSpot.x, footSpot.y);
            ballImage.body.enable = true;
            ballImage.body.reset(footSpot.x, footSpot.y);
            ballImage.setCollideWorldBounds(true, this.restitution, this.restitution);
            this.randomizeBallOrientation(ballState);
            ballState.rotationScale = 1;
            ballState.rotationPause = 0;
            ballState.surfaceX = 0;
            ballState.surfaceY = 0;
            this.redrawBallTexture(ballState);
            return;
        }

        ballState.pocketing = false;
        ballState.pocketed = true;
        ballState.shadow.destroy();
        ballState.shine.destroy();
        ballImage.destroy();
        ballState.image = null;
        ballState.shadow = null;
        ballState.shine = null;

        if (this.shotInProgress) this.recordPocketedBall(ballState.type.index);

        if (this.selectedBall === ballState) {
            this.selectedBall = this.balls.find(candidate => !candidate.pocketed)
                || null;
        }

    }

    cancelPocketingAnimation(ballState) {
        if (ballState.pocketTween) {
            ballState.pocketTween.stop();
            ballState.pocketTween = null;
        }
        if (!ballState.image) return;

        ballState.pocketing = false;
        ballState.image.body.enable = true;
        [ballState.shadow, ballState.image, ballState.shine].forEach(layer => {
            layer?.setScale(1).setAlpha(1);
        });
    }

    startScratchSequence() {
        if (this.isScratchSequence) return;

        this.isScratchSequence = true;
        this.resetCueStick();
        this.balls.forEach(ballState => {
            if (!ballState.image) return;
            ballState.image.setVelocity(0, 0);
            ballState.image.setAcceleration(0, 0);
        });

        this.scratchText
            .setPosition(this.scale.width / 2, this.scale.height / 2)
            .setVisible(true)
            .setAlpha(0);
        this.scratchTween = this.tweens.add({
            targets: this.scratchText,
            alpha: 1,
            duration: 250,
            yoyo: true,
            repeat: 4,
            onComplete: () => {
                this.scratchText.setVisible(false).setAlpha(0);
                this.scratchTween = null;
                this.isScratchSequence = false;
                this.rerackObjectBalls();
            }
        });
    }

    checkHoleCollisions() {
        if (this.isScratchSequence) return;
        const lipTolerance = this.ballRadius * 0.3;

        for (const ballState of this.balls) {
            if (ballState.pocketed || ballState.pocketing || !ballState.image) continue;

            for (const hole of this.holes) {
                const captureDistance = hole.radius
                    + this.ballRadius
                    + lipTolerance;
                const offsetX = ballState.image.x - hole.x;
                const offsetY = ballState.image.y - hole.y;
                const distanceSquared = offsetX * offsetX + offsetY * offsetY;

                if (distanceSquared <= captureDistance * captureDistance) {
                    this.pocketBall(ballState.image, hole);
                    if (this.isScratchSequence) return;
                    break;
                }
            }
        }
    }

    rerackObjectBalls() {
        this.resetCueStick();
        this.randomizeRackOrder();
        const bounds = this.getTableBounds();
        const cueBall = this.balls.find(ballState => ballState.type.index === 0);
        const footSpot = this.getFootSpotPosition();

        if (cueBall?.image) {
            cueBall.image.setPosition(footSpot.x, footSpot.y);
            cueBall.image.setVelocity(0, 0);
            cueBall.image.setAcceleration(0, 0);
            cueBall.image.body.reset(footSpot.x, footSpot.y);
            this.randomizeBallOrientation(cueBall);
            cueBall.rotationScale = 1;
            cueBall.rotationPause = 0;
            cueBall.surfaceX = 0;
            cueBall.surfaceY = 0;
            cueBall.shadow.setPosition(
                footSpot.x + this.ballRadius * 0.217,
                footSpot.y + this.ballRadius * 0.37
            );
            cueBall.shine.setPosition(footSpot.x, footSpot.y);
            this.redrawBallTexture(cueBall);
        }

        this.balls.forEach(ballState => {
            if (ballState.type.index === 0) return;

            const position = this.getBallStartPosition(ballState.type.index);
            if (!ballState.image) {
                this.createBallGameObjects(ballState, position, bounds);
            } else {
                ballState.image.setPosition(position.x, position.y);
                ballState.image.setVelocity(0, 0);
                ballState.image.setAcceleration(0, 0);
                ballState.image.body.enable = true;
                ballState.image.body.reset(position.x, position.y);
            }

            this.randomizeBallOrientation(ballState);
            ballState.rotationScale = 1;
            ballState.rotationPause = 0;
            ballState.surfaceX = 0;
            ballState.surfaceY = 0;
            this.redrawBallTexture(ballState);
        });

        this.rerackPending = false;
    }

    resetBalls() {
        this.resetCueStick();
        this.gameOverTimers.forEach(timer => timer.remove(false));
        this.gameOverTimers = [];
        this.gameOverPhase = null;
        if (this.aiShotTimer) {
            this.aiShotTimer.remove(false);
            this.aiShotTimer = null;
        }
        if (this.scratchTween) {
            this.scratchTween.stop();
            this.scratchTween = null;
        }
        this.isScratchSequence = false;
        this.gameOver = false;
        this.scratchText?.setText("SCRATCH").setVisible(false).setAlpha(0);
        this.randomizeRackOrder();
        const bounds = this.getTableBounds();

        this.balls.forEach(ballState => {
            this.cancelPocketingAnimation(ballState);
            const position = this.getBallStartPosition(ballState.type.index);

            if (!ballState.image) {
                this.createBallGameObjects(ballState, position, bounds);
            } else {
                ballState.image.setPosition(position.x, position.y);
                ballState.image.setVelocity(0, 0);
                ballState.image.setAcceleration(0, 0);
                ballState.image.body.enable = true;
                ballState.image.body.reset(position.x, position.y);
            }

            this.randomizeBallOrientation(ballState);
            ballState.rotationScale = 1;
            ballState.rotationPause = 0;
            ballState.surfaceX = 0;
            ballState.surfaceY = 0;
            this.redrawBallTexture(ballState);
        });

        this.players.player.group = null;
        this.players.player.score = 0;
        this.players.computer.group = null;
        this.players.computer.score = 0;
        this.currentTurn = "player";
        this.shotInProgress = false;
        this.shotPocketed = [];
        this.cueBallScratched = false;
        this.firstContactBall = null;
        this.rerackPending = false;
        this.updateScoreHud();
        this.selectedBall = this.balls[0];
    }

    reduceRotationOnWallHit(body) {
        const ballState = this.balls.find(candidate => candidate.image === body.gameObject);
        if (ballState) {
            ballState.rotationScale = 0;
            ballState.rotationPause = 0.14;
        }
    }

    getCueBall() {
        return this.balls.find(ballState => ballState.type.index === 0);
    }

    getBallGroup(ballIndex) {
        if (ballIndex >= 1 && ballIndex <= 7) return "solid";
        if (ballIndex >= 9 && ballIndex <= 15) return "stripe";
        return null;
    }

    getOpponent(turn = this.currentTurn) {
        return turn === "player" ? "computer" : "player";
    }

    beginTrackedShot() {
        this.shotInProgress = true;
        this.shotPocketed = [];
        this.cueBallScratched = false;
        this.firstContactBall = null;
    }

    recordPocketedBall(ballIndex) {
        this.shotPocketed.push(ballIndex);
        if (ballIndex === 8) return;

        const group = this.getBallGroup(ballIndex);
        const shooter = this.players[this.currentTurn];
        const opponent = this.players[this.getOpponent()];
        if (!shooter.group && group) {
            shooter.group = group;
            opponent.group = group === "solid" ? "stripe" : "solid";
        }

        const ownerKey = Object.keys(this.players).find(
            key => this.players[key].group === group
        );
        if (ownerKey) this.players[ownerKey].score += 1;
        this.updateScoreHud();
    }

    resolveCompletedShot() {
        const shooterKey = this.currentTurn;
        const opponentKey = this.getOpponent(shooterKey);
        const shooter = this.players[shooterKey];
        const legalFirstContact = shooter.group
            ? shooter.score >= 7
                ? this.firstContactBall === 8
                : this.getBallGroup(this.firstContactBall) === shooter.group
            : this.firstContactBall !== null && this.firstContactBall !== 8;

        if (this.shotPocketed.includes(8)) {
            const legalEight = shooter.group
                && shooter.score >= 7
                && legalFirstContact
                && !this.cueBallScratched;
            this.endGame(legalEight ? shooterKey : opponentKey);
            return;
        }

        const pocketedOwnBall = this.shotPocketed.some(
            index => this.getBallGroup(index) === shooter.group
        );
        if (this.cueBallScratched || !legalFirstContact || !pocketedOwnBall) {
            this.currentTurn = opponentKey;
        }

        this.shotInProgress = false;
        this.shotPocketed = [];
        this.cueBallScratched = false;
        this.firstContactBall = null;
        this.updateScoreHud();
    }

    endGame(winnerKey) {
        this.gameOver = true;
        this.gameOverPhase = "winner";
        this.shotInProgress = false;
        if (this.aiShotTimer) {
            this.aiShotTimer.remove(false);
            this.aiShotTimer = null;
        }
        this.resetCueStick();
        this.balls.forEach(ballState => {
            if (!ballState.image?.body?.enable) return;
            ballState.image.setVelocity(0, 0).setAcceleration(0, 0);
        });
        this.scratchText
            .setText(`${this.players[winnerKey].name} WINS`)
            .setFontSize(Phaser.Math.Clamp(this.scale.width * 0.063, 48, 96))
            .setPosition(this.scale.width / 2, this.scale.height / 2)
            .setVisible(true)
            .setAlpha(1);
        const gameOverTimer = this.time.delayedCall(5000, () => {
            this.gameOverPhase = "game-over";
            this.scratchText
                .setText("GAME OVER")
                .setFontSize(Phaser.Math.Clamp(this.scale.width * 0.063, 48, 96));
        });
        const restartTimer = this.time.delayedCall(10000, () => {
            this.gameOverPhase = "restart";
            this.scratchText
                .setText("PRESS R TO RE-RACK")
                .setFontSize(Phaser.Math.Clamp(this.scale.width * 0.045, 32, 64));
        });
        this.gameOverTimers = [gameOverTimer, restartTimer];
        this.updateScoreHud();
    }

    areBallsStopped() {
        return this.balls.every(ballState =>
            !ballState.pocketing
            && (!ballState.image || ballState.image.body.velocity.lengthSq() < 9)
        );
    }

    applyTableFriction(ballState, dt) {
        const velocity = ballState.image.body.velocity;
        const speed = velocity.length();
        if (speed === 0) return;

        // Proportional resistance preserves small collision impulses in a
        // packed rack instead of subtracting the impulse away in one frame.
        const nextSpeed = speed * Math.exp(-this.tableFriction * dt);
        if (nextSpeed <= this.ballStopSpeed) {
            ballState.image.setVelocity(0, 0);
            return;
        }

        velocity.scale(nextSpeed / speed);
    }

    createCueStick() {
        this.trajectoryGuide = this.add.graphics()
            .setDepth(1.5)
            .setVisible(false);
        this.cueStick = this.add.image(0, 0, "cue stick")
            // The source artwork points right, so its right edge is the tip.
            .setOrigin(1, 0.5)
            .setDepth(4)
            .setVisible(false);
        this.layoutCueStick();
    }

    layoutCueStick() {
        if (!this.cueStick) return;

        const width = Phaser.Math.Clamp(this.scale.width * 0.34, 330, 520);
        const aspectRatio = this.cueStick.texture.getSourceImage().height
            / this.cueStick.texture.getSourceImage().width;
        this.cueStick.setDisplaySize(width, width * aspectRatio);
    }

    updateCueAngle(pointer = this.input.activePointer) {
        const cueBall = this.getCueBall();
        if (!cueBall?.image || this.cueState !== "aiming") return;

        const deltaX = pointer.worldX - cueBall.image.x;
        const deltaY = pointer.worldY - cueBall.image.y;
        if (deltaX !== 0 || deltaY !== 0) {
            this.cueAngle = Math.atan2(deltaY, deltaX);
        }
    }

    renderCueStick() {
        const cueBall = this.getCueBall();
        if (!cueBall?.image || !this.cueStick?.visible) return;

        const minimumDistance = this.ballRadius + this.cueTipPadding;
        const distance = minimumDistance + this.cuePullback;
        this.cueStick
            .setPosition(
                cueBall.image.x - Math.cos(this.cueAngle) * distance,
                cueBall.image.y - Math.sin(this.cueAngle) * distance
            )
            .setRotation(this.cueAngle);
        this.renderTrajectoryGuide();
    }

    getTrajectoryDistance(cueBall, directionX, directionY) {
        const bounds = this.getTableBounds();
        const radius = this.ballRadius;
        const minX = bounds.left + radius;
        const maxX = bounds.right - radius;
        const minY = bounds.top + radius;
        const maxY = bounds.bottom - radius;
        const wallDistanceX = directionX > 0
            ? (maxX - cueBall.x) / directionX
            : directionX < 0
                ? (minX - cueBall.x) / directionX
                : Number.POSITIVE_INFINITY;
        const wallDistanceY = directionY > 0
            ? (maxY - cueBall.y) / directionY
            : directionY < 0
                ? (minY - cueBall.y) / directionY
                : Number.POSITIVE_INFINITY;
        let nearestDistance = Math.min(wallDistanceX, wallDistanceY);
        let targetBall = null;
        const collisionRadius = this.ballRadius * 2 * 0.935;
        const collisionRadiusSquared = collisionRadius * collisionRadius;

        for (const ballState of this.balls) {
            if (
                ballState.type.index === 0
                || ballState.pocketed
                || ballState.pocketing
                || !ballState.image
            ) continue;

            const offsetX = ballState.image.x - cueBall.x;
            const offsetY = ballState.image.y - cueBall.y;
            const projectedDistance = offsetX * directionX + offsetY * directionY;
            if (projectedDistance <= 0) continue;

            const perpendicularDistanceSquared = offsetX * offsetX
                + offsetY * offsetY
                - projectedDistance * projectedDistance;
            if (perpendicularDistanceSquared > collisionRadiusSquared) continue;

            const entryDistance = projectedDistance - Math.sqrt(
                collisionRadiusSquared - perpendicularDistanceSquared
            );
            if (entryDistance >= 0 && entryDistance < nearestDistance) {
                nearestDistance = entryDistance;
                targetBall = ballState;
            }
        }

        return {
            distance: Math.max(radius, nearestDistance),
            targetBall
        };
    }

    getTargetTrajectoryDistance(targetBall, directionX, directionY) {
        const bounds = this.getTableBounds();
        const radius = this.ballRadius;
        const minX = bounds.left + radius;
        const maxX = bounds.right - radius;
        const minY = bounds.top + radius;
        const maxY = bounds.bottom - radius;
        const wallDistanceX = directionX > 0
            ? (maxX - targetBall.image.x) / directionX
            : directionX < 0
                ? (minX - targetBall.image.x) / directionX
                : Number.POSITIVE_INFINITY;
        const wallDistanceY = directionY > 0
            ? (maxY - targetBall.image.y) / directionY
            : directionY < 0
                ? (minY - targetBall.image.y) / directionY
                : Number.POSITIVE_INFINITY;
        const wallDistance = Math.min(wallDistanceX, wallDistanceY);
        let obstacleDistance = Number.POSITIVE_INFINITY;
        const collisionRadius = radius * 2 * 0.935;
        const collisionRadiusSquared = collisionRadius * collisionRadius;

        for (const ballState of this.balls) {
            if (
                ballState.type.index === 0
                || ballState === targetBall
                || ballState.pocketed
                || ballState.pocketing
                || !ballState.image
            ) continue;

            const offsetX = ballState.image.x - targetBall.image.x;
            const offsetY = ballState.image.y - targetBall.image.y;
            const projectedDistance = offsetX * directionX + offsetY * directionY;
            if (projectedDistance <= 0) continue;
            const perpendicularDistanceSquared = offsetX * offsetX
                + offsetY * offsetY
                - projectedDistance * projectedDistance;
            if (perpendicularDistanceSquared > collisionRadiusSquared) continue;

            const entryDistance = projectedDistance - Math.sqrt(
                collisionRadiusSquared - perpendicularDistanceSquared
            );
            if (entryDistance >= 0) {
                obstacleDistance = Math.min(obstacleDistance, entryDistance);
            }
        }

        let endDistance = Math.min(wallDistance, obstacleDistance);
        let pocketDistance = Number.POSITIVE_INFINITY;
        for (const hole of this.holes) {
            const offsetX = hole.x - targetBall.image.x;
            const offsetY = hole.y - targetBall.image.y;
            const projectedDistance = offsetX * directionX + offsetY * directionY;
            if (projectedDistance <= 0 || projectedDistance >= obstacleDistance) continue;

            const perpendicularDistanceSquared = offsetX * offsetX
                + offsetY * offsetY
                - projectedDistance * projectedDistance;
            const captureWidth = Math.max(radius, hole.radius * 0.72);
            if (
                perpendicularDistanceSquared <= captureWidth * captureWidth
                && projectedDistance <= wallDistance + hole.radius * 1.5
            ) {
                pocketDistance = Math.min(pocketDistance, projectedDistance);
            }
        }
        if (Number.isFinite(pocketDistance)) endDistance = pocketDistance;

        return Math.max(radius, endDistance);
    }

    renderTrajectoryGuide() {
        const cueBall = this.getCueBall();
        const guide = this.trajectoryGuide;
        guide.clear();
        if (
            !cueBall?.image
            || (this.cueState !== "aiming" && this.cueState !== "pulling")
        ) {
            guide.setVisible(false);
            return;
        }

        const directionX = Math.cos(this.cueAngle);
        const directionY = Math.sin(this.cueAngle);
        const trajectory = this.getTrajectoryDistance(
            cueBall.image,
            directionX,
            directionY
        );
        const endDistance = trajectory.distance;
        const startDistance = this.ballRadius + 7;
        const dotSpacing = 14;

        guide.fillStyle(0xffffff, 0.82);
        for (
            let distance = startDistance;
            distance < endDistance - 3;
            distance += dotSpacing
        ) {
            guide.fillCircle(
                cueBall.image.x + directionX * distance,
                cueBall.image.y + directionY * distance,
                2.2
            );
        }

        if (trajectory.targetBall?.image) {
            const impactX = cueBall.image.x + directionX * endDistance;
            const impactY = cueBall.image.y + directionY * endDistance;
            const targetDirection = new Phaser.Math.Vector2(
                trajectory.targetBall.image.x - impactX,
                trajectory.targetBall.image.y - impactY
            );
            if (targetDirection.lengthSq() > 0) {
                targetDirection.normalize();
                const targetDistance = this.getTargetTrajectoryDistance(
                    trajectory.targetBall,
                    targetDirection.x,
                    targetDirection.y
                );
                guide.fillStyle(0x78e7ff, 0.9);
                for (
                    let distance = startDistance;
                    distance < targetDistance - 3;
                    distance += dotSpacing
                ) {
                    guide.fillCircle(
                        trajectory.targetBall.image.x + targetDirection.x * distance,
                        trajectory.targetBall.image.y + targetDirection.y * distance,
                        2.35
                    );
                }
            }
        }
        guide.setVisible(true);
    }

    beginCuePullback(pointer) {
        if (
            this.currentTurn !== "player"
            || this.gameOver
            || this.cueState !== "aiming"
            || !this.areBallsStopped()
        ) return;

        this.updateCueAngle(pointer);
        this.cueState = "pulling";
        this.pullStart = { x: pointer.worldX, y: pointer.worldY };
        this.cuePullback = 0;
        this.shotPower = 0;
    }

    updateCuePullback(pointer) {
        if (this.cueState !== "pulling") return;

        const dragX = pointer.worldX - this.pullStart.x;
        const dragY = pointer.worldY - this.pullStart.y;
        const directionX = Math.cos(this.cueAngle);
        const directionY = Math.sin(this.cueAngle);
        const backwardDistance = -(dragX * directionX + dragY * directionY);

        this.cuePullback = Phaser.Math.Clamp(
            backwardDistance,
            0,
            this.maxCuePullback
        );
        this.shotPower = this.cuePullback / this.maxCuePullback;
        this.renderCueStick();
    }

    releaseCue() {
        if (
            this.currentTurn !== "player"
            || this.gameOver
            || this.cueState !== "pulling"
        ) return;
        if (this.shotPower <= 0) {
            this.cueState = "aiming";
            return;
        }

        const angle = this.cueAngle;
        const power = this.shotPower;
        this.beginTrackedShot();
        this.strikeCue(angle, power);
    }

    strikeCue(angle, power) {
        this.cueState = "striking";
        this.trajectoryGuide.clear().setVisible(false);
        this.cueStrikeTween = this.tweens.add({
            targets: this,
            // Travel through the aiming padding so the tip reaches the ball.
            cuePullback: -this.cueTipPadding,
            duration: 90,
            ease: "Quad.easeIn",
            onUpdate: () => this.renderCueStick(),
            onComplete: () => {
                this.cueStrikeTween = null;
                this.cueStick.setVisible(false);
                this.cueState = "hidden";
                this.cuePullback = 0;
                this.shotPower = 0;

                const cueBall = this.getCueBall();
                if (!cueBall?.image) return;
                cueBall.image.setVelocity(
                    Math.cos(angle) * power * this.maxShotSpeed,
                    Math.sin(angle) * power * this.maxShotSpeed
                );
            }
        });
    }

    resetCueStick() {
        if (this.cueStrikeTween) {
            this.cueStrikeTween.stop();
            this.cueStrikeTween = null;
        }
        this.cuePullback = 0;
        this.shotPower = 0;
        this.cueState = "hidden";
        this.cueStick?.setVisible(false);
        this.trajectoryGuide?.clear().setVisible(false);
    }

    isPathClear(start, end, ignoredIndexes) {
        const segmentX = end.x - start.x;
        const segmentY = end.y - start.y;
        const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;
        if (segmentLengthSquared === 0) return false;
        const clearance = this.ballRadius * 1.9;

        return this.balls.every(ballState => {
            if (
                ignoredIndexes.includes(ballState.type.index)
                || ballState.pocketed
                || ballState.pocketing
                || !ballState.image
            ) return true;

            const projection = Phaser.Math.Clamp((
                (ballState.image.x - start.x) * segmentX
                + (ballState.image.y - start.y) * segmentY
            ) / segmentLengthSquared, 0, 1);
            const nearestX = start.x + segmentX * projection;
            const nearestY = start.y + segmentY * projection;
            return Phaser.Math.Distance.Squared(
                nearestX,
                nearestY,
                ballState.image.x,
                ballState.image.y
            ) > clearance * clearance;
        });
    }

    chooseComputerShot() {
        const cueBall = this.getCueBall()?.image;
        if (!cueBall) return null;

        const computer = this.players.computer;
        const targetGroup = computer.group;
        let targets = this.balls.filter(ballState => {
            if (ballState.pocketed || ballState.pocketing || !ballState.image) return false;
            if (!targetGroup) return this.getBallGroup(ballState.type.index) !== null;
            if (computer.score >= 7) return ballState.type.index === 8;
            return this.getBallGroup(ballState.type.index) === targetGroup;
        });

        if (targets.length === 0) {
            targets = this.balls.filter(ballState =>
                ballState.type.index === 8 && !ballState.pocketed && ballState.image
            );
        }

        let bestShot = null;
        for (const target of targets) {
            for (const hole of this.holes) {
                const pocketVector = new Phaser.Math.Vector2(
                    hole.x - target.image.x,
                    hole.y - target.image.y
                );
                const targetToHoleDistance = pocketVector.length();
                if (targetToHoleDistance === 0) continue;
                pocketVector.normalize();

                const ghostBall = {
                    x: target.image.x - pocketVector.x * this.ballRadius * 2,
                    y: target.image.y - pocketVector.y * this.ballRadius * 2
                };
                if (!this.isPathClear(cueBall, ghostBall, [0, target.type.index])) continue;
                if (!this.isPathClear(
                    target.image,
                    { x: hole.x, y: hole.y },
                    [0, target.type.index]
                )) continue;

                const cueToGhostDistance = Phaser.Math.Distance.Between(
                    cueBall.x,
                    cueBall.y,
                    ghostBall.x,
                    ghostBall.y
                );
                const score = cueToGhostDistance + targetToHoleDistance * 0.7;
                if (!bestShot || score < bestShot.score) {
                    bestShot = { target, hole, ghostBall, score };
                }
            }
        }

        if (!bestShot && targets.length > 0) {
            const target = targets.reduce((nearest, candidate) =>
                Phaser.Math.Distance.Squared(cueBall.x, cueBall.y, candidate.image.x, candidate.image.y)
                    < Phaser.Math.Distance.Squared(cueBall.x, cueBall.y, nearest.image.x, nearest.image.y)
                    ? candidate
                    : nearest
            );
            bestShot = {
                target,
                ghostBall: { x: target.image.x, y: target.image.y },
                score: Phaser.Math.Distance.Between(
                    cueBall.x,
                    cueBall.y,
                    target.image.x,
                    target.image.y
                )
            };
        }

        if (!bestShot) return null;
        const angle = Math.atan2(
            bestShot.ghostBall.y - cueBall.y,
            bestShot.ghostBall.x - cueBall.x
        ) + Phaser.Math.FloatBetween(-0.012, 0.012);
        const power = Phaser.Math.Clamp(0.5 + bestShot.score / 1800, 0.5, 0.92);
        return { angle, power };
    }

    scheduleComputerShot() {
        if (this.aiShotTimer || this.gameOver || this.currentTurn !== "computer") return;
        this.aiShotTimer = this.time.delayedCall(650, () => {
            this.aiShotTimer = null;
            this.executeComputerShot();
        });
    }

    executeComputerShot() {
        if (
            this.gameOver
            || this.currentTurn !== "computer"
            || this.shotInProgress
            || !this.areBallsStopped()
        ) return;

        const shot = this.chooseComputerShot();
        if (!shot) return;
        this.cueAngle = shot.angle;
        this.shotPower = shot.power;
        this.cuePullback = shot.power * this.maxCuePullback;
        this.cueState = "pulling";
        this.cueStick.setVisible(true);
        this.renderCueStick();

        this.aiShotTimer = this.time.delayedCall(450, () => {
            this.aiShotTimer = null;
            if (this.gameOver || this.currentTurn !== "computer") return;
            this.beginTrackedShot();
            this.strikeCue(shot.angle, shot.power);
        });
    }

    createControls() {
        this.keys = this.input.keyboard.addKeys({
            R: Phaser.Input.Keyboard.KeyCodes.R
        });

        this.input.on("pointerdown", pointer => {
            if (this.isScratchSequence || !pointer.leftButtonDown()) return;
            this.beginCuePullback(pointer);
        });
        this.input.on("pointermove", pointer => {
            if (this.currentTurn !== "player" || this.gameOver) return;
            if (this.cueState === "pulling") {
                this.updateCuePullback(pointer);
            } else {
                this.updateCueAngle(pointer);
            }
        });
        this.input.on("pointerup", pointer => {
            if (pointer.button === 0) this.releaseCue();
        });
    }

    createHud() {


        this.playerScoreText = this.add.text(this.scale.width * .15, 10, "", {
            fontFamily: "monospace",
            fontSize: "18px",
            fontStyle: "bold",
            color: "#ffffff",
            stroke: "#14202a",
            strokeThickness: 4
        }).setDepth(10);

        this.computerScoreText = this.add.text(
            this.scale.width * .85,
            10,
            "",
            {
                fontFamily: "monospace",
                fontSize: "18px",
                fontStyle: "bold",
                color: "#ffffff",
                stroke: "#14202a",
                strokeThickness: 4
            }
        ).setOrigin(1, 0).setDepth(10);



        this.scratchText = this.add.text(
            this.scale.width / 2,
            this.scale.height / 2,
            "SCRATCH",
            {
                fontFamily: "Arial Black, Arial, sans-serif",
                fontSize: "96px",
                fontStyle: "bold",
                color: "#ff2020",
                stroke: "#ffffff",
                strokeThickness: 8
            }
        )
            .setOrigin(0.5)
            .setDepth(100)
            .setVisible(false)
            .setAlpha(0);

        this.updateScoreHud();
    }

    updateScoreHud() {
        if (!this.playerScoreText || !this.computerScoreText) return;
        const groupLabel = player => player.group
            ? `${player.group.toUpperCase()}S`
            : "OPEN";
        const playerTurn = this.currentTurn === "player" && !this.gameOver
            ? "▶ "
            : "";
        const computerTurn = this.currentTurn === "computer" && !this.gameOver
            ? "▶ "
            : "";
        this.playerScoreText.setText(
            `${playerTurn}PLAYER  ${this.players.player.score}/7  ${groupLabel(this.players.player)}`
        );
        this.computerScoreText.setText(
            `${computerTurn}COMPUTER  ${this.players.computer.score}/7  ${groupLabel(this.players.computer)}`
        );
    }

    update(time, delta) {
        const dt = delta / 1000;

        if (
            Phaser.Input.Keyboard.JustDown(this.keys.R)
            && (!this.gameOver || this.gameOverPhase === "restart")
        ) {
            this.resetBalls();
        }

        if (this.gameOver) {
            return;
        }

        this.checkHoleCollisions();
        if (this.isScratchSequence) {
            this.scratchText.setText("Game over");
            return;
        }
        if (this.rerackPending) {
            this.rerackObjectBalls();
        }

        const cueBall = this.getCueBall();
        if (!cueBall?.image) {
            return;
        }

        this.balls.forEach(ballState => {
            if (ballState.pocketed || ballState.pocketing || !ballState.image) return;
            this.applyTableFriction(ballState, dt);
            const velocity = ballState.image.body.velocity;
            const speed = velocity.length();

            this.constrainBallToScreen(ballState);
            if (ballState.rotationPause > 0) {
                ballState.rotationPause = Math.max(
                    0,
                    ballState.rotationPause - dt
                );
                ballState.rotationScale = 0;
            } else {
                ballState.rotationScale = Phaser.Math.Linear(
                    ballState.rotationScale,
                    1,
                    Math.min(1, dt * 2.5)
                );
            }

            if (speed > 0.5 && ballState.rotationScale > 0) {
                ballState.surfaceX -= velocity.x * dt;
                ballState.surfaceY -= velocity.y * dt;
                this.rotateBallSurface(
                    ballState,
                    velocity,
                    speed,
                    dt * ballState.rotationScale
                );
                this.redrawBallTexture(ballState);
            }

            const speedRatio = Phaser.Math.Clamp(speed / this.maxSpeed, 0, 1);
            ballState.shadow.setPosition(
                ballState.image.x + this.ballRadius * 0.217 + velocity.x * 0.006,
                ballState.image.y + this.ballRadius * 0.37 + velocity.y * 0.006
            );
            ballState.shadow.setScale(
                1 + speedRatio * 0.12,
                1 - speedRatio * 0.06
            );
            ballState.shadow.setAlpha(0.9 - speedRatio * 0.15);
            ballState.shine.setPosition(ballState.image.x, ballState.image.y);
        });

        const velocity = cueBall.image.body.velocity;
        const speed = velocity.length();
        const ballsStopped = this.areBallsStopped();

        if (
            this.shotInProgress
            && this.cueState === "hidden"
            && ballsStopped
        ) {
            this.resolveCompletedShot();
            if (this.gameOver) return;
        }

        if (
            !this.shotInProgress
            && this.currentTurn === "player"
            && this.cueState === "hidden"
            && ballsStopped
        ) {
            this.cueState = "aiming";
            this.cueStick.setVisible(true);
            this.updateCueAngle();
        } else if (this.cueState === "aiming" && !ballsStopped) {
            this.resetCueStick();
        }

        if (
            !this.shotInProgress
            && this.currentTurn === "computer"
            && ballsStopped
        ) {
            if (this.cueState === "aiming") this.resetCueStick();
            this.scheduleComputerShot();
        }

        if (this.cueState === "aiming" && this.currentTurn === "player") {
            this.updateCueAngle();
        }
        if (this.cueState === "aiming" || this.cueState === "pulling") {
            this.renderCueStick();
        }

    }

    resize(gameSize) {
        const width = gameSize.width;
        const height = gameSize.height;

        this.floor.setPosition(width / 2, height / 2);
        this.floor.setDisplaySize(width, height);
        this.title?.setPosition(width / 2, 30);
        this.computerScoreText?.setPosition(width - 34, 28);
        this.layoutCueStick();
        this.scratchText?.setPosition(width / 2, height / 2);
        if (this.gameOver && this.scratchText) {
            const fontScale = this.gameOverPhase === "restart" ? 0.045 : 0.063;
            const maxSize = this.gameOverPhase === "restart" ? 64 : 96;
            this.scratchText.setFontSize(
                Phaser.Math.Clamp(width * fontScale, 32, maxSize)
            );
        }
        this.layoutTableHoles(width, height);
        this.drawTableSpots();
        this.updateWorldBounds(width, height);

        const bounds = this.getTableBounds(width, height);
        this.balls.forEach(ballState => {
            if (ballState.pocketing || !ballState.image?.body) return;

            ballState.image.body.setBoundsRectangle(bounds);
            this.constrainBallToScreen(ballState, width, height);
        });
    }
}
