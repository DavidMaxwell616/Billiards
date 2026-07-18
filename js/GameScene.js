import { ballTypes, getBallPalette } from "./config.js";
export class GameScene extends Phaser.Scene {
    constructor() {
        super("GameScene");

        this.ballRadius = 16;
        this.acceleration = 900;
        this.maxSpeed = 540;
        this.drag = 500;
        this.restitution = 0.82;
        this.ballCollisionRestitution = 0.96;

        this.ballTextureSize = this.ballRadius * 2;
        this.balls = [];
        this.rackOrder = [];
        this.selectedBall = null;
        this.score = 0;
        this.rerackPending = false;
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

    pocketBall(ballImage) {
        const ballState = this.balls.find(candidate => candidate.image === ballImage);
        if (!ballState || ballState.pocketed) return;

        if (ballState.type.index === 0) {
            const footSpot = this.getFootSpotPosition();
            ballImage.setPosition(footSpot.x, footSpot.y);
            ballImage.setVelocity(0, 0);
            ballImage.setAcceleration(0, 0);
            ballImage.body.reset(footSpot.x, footSpot.y);
            ballState.spotVector = { x: 0, y: 0, z: 1 };
            ballState.stripeNormal = { x: 0, y: 1, z: 0 };
            ballState.rotationScale = 1;
            ballState.rotationPause = 0;
            ballState.surfaceX = 0;
            ballState.surfaceY = 0;
            ballState.shadow.setPosition(
                footSpot.x + this.ballRadius * 0.217,
                footSpot.y + this.ballRadius * 0.37
            );
            ballState.shine.setPosition(footSpot.x, footSpot.y);
            this.redrawBallTexture(ballState);
            return;
        }

        ballState.pocketed = true;
        ballState.shadow.destroy();
        ballState.shine.destroy();
        ballImage.destroy();
        ballState.image = null;
        ballState.shadow = null;
        ballState.shine = null;

        this.score += 1;
        this.scoreText?.setText(`Score: ${this.score}`);

        this.rerackPending = this.balls
            .filter(candidate => candidate.type.index !== 0)
            .every(candidate => candidate.pocketed);

        if (this.selectedBall === ballState) {
            this.selectedBall = this.balls.find(candidate => !candidate.pocketed)
                || null;
        }
    }

    checkHoleCollisions() {
        const lipTolerance = this.ballRadius * 0.3;

        for (const ballState of this.balls) {
            if (ballState.pocketed || !ballState.image) continue;

            for (const hole of this.holes) {
                const captureDistance = hole.radius
                    + this.ballRadius
                    + lipTolerance;
                const offsetX = ballState.image.x - hole.x;
                const offsetY = ballState.image.y - hole.y;
                const distanceSquared = offsetX * offsetX + offsetY * offsetY;

                if (distanceSquared <= captureDistance * captureDistance) {
                    this.pocketBall(ballState.image, hole);
                    break;
                }
            }
        }
    }

    rerackObjectBalls() {
        this.randomizeRackOrder();
        const bounds = this.getTableBounds();

        this.balls.forEach(ballState => {
            if (ballState.type.index === 0) return;

            const position = this.getBallStartPosition(ballState.type.index);
            if (!ballState.image) {
                this.createBallGameObjects(ballState, position, bounds);
            } else {
                ballState.image.setPosition(position.x, position.y);
                ballState.image.setVelocity(0, 0);
                ballState.image.setAcceleration(0, 0);
            }

            ballState.spotVector = { x: 0, y: 0, z: 1 };
            ballState.stripeNormal = { x: 0, y: 1, z: 0 };
            ballState.rotationScale = 1;
            ballState.rotationPause = 0;
            ballState.surfaceX = 0;
            ballState.surfaceY = 0;
            this.redrawBallTexture(ballState);
        });

        this.rerackPending = false;
    }

    resetBalls() {
        this.randomizeRackOrder();
        const bounds = this.getTableBounds();

        this.balls.forEach(ballState => {
            const position = this.getBallStartPosition(ballState.type.index);

            if (!ballState.image) {
                this.createBallGameObjects(ballState, position, bounds);
            } else {
                ballState.image.setPosition(position.x, position.y);
                ballState.image.setVelocity(0, 0);
                ballState.image.setAcceleration(0, 0);
            }

            ballState.spotVector = { x: 0, y: 0, z: 1 };
            ballState.stripeNormal = { x: 0, y: 1, z: 0 };
            ballState.rotationScale = 1;
            ballState.rotationPause = 0;
            ballState.surfaceX = 0;
            ballState.surfaceY = 0;
            this.redrawBallTexture(ballState);
        });

        this.score = 0;
        this.rerackPending = false;
        this.scoreText?.setText("Score: 0");
        this.selectedBall = this.balls[0];
    }

    reduceRotationOnWallHit(body) {
        const ballState = this.balls.find(candidate => candidate.image === body.gameObject);
        if (ballState) {
            ballState.rotationScale = 0;
            ballState.rotationPause = 0.14;
        }
    }

    createControls() {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.keys = this.input.keyboard.addKeys({
            W: Phaser.Input.Keyboard.KeyCodes.W,
            A: Phaser.Input.Keyboard.KeyCodes.A,
            S: Phaser.Input.Keyboard.KeyCodes.S,
            D: Phaser.Input.Keyboard.KeyCodes.D,
            SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE,
            R: Phaser.Input.Keyboard.KeyCodes.R
        });

        this.input.on("pointerdown", pointer => {
            const clickedBall = this.balls.find(ballState =>
                !ballState.pocketed &&
                Phaser.Math.Distance.Between(
                    pointer.worldX,
                    pointer.worldY,
                    ballState.image.x,
                    ballState.image.y
                ) <= this.ballRadius
            );

            if (clickedBall) {
                this.selectedBall = clickedBall;
                return;
            }

            if (!this.selectedBall?.image) return;
            const selectedImage = this.selectedBall.image;
            const direction = new Phaser.Math.Vector2(
                pointer.worldX - selectedImage.x,
                pointer.worldY - selectedImage.y
            );

            if (direction.lengthSq() > 0) {
                direction.normalize().scale(430);
                selectedImage.setVelocity(direction.x, direction.y);
            }
        });
    }

    createHud() {
        this.title = this.add.text(34, 30, "BILLIARD BALL RACK", {
            fontFamily: "Arial",
            fontSize: "24px",
            fontStyle: "bold",
            color: "#ffffff",
            stroke: "#14202a",
            strokeThickness: 5
        }).setDepth(10);

        this.instructions = this.add.text(
            34,
            64,
            "Click a ball: select  •  Click empty space: launch  •  WASD/arrows: push  •  R: reset",
            {
                fontFamily: "Arial",
                fontSize: "15px",
                color: "#d6e8f2",
                stroke: "#14202a",
                strokeThickness: 4
            }
        ).setDepth(10);

        this.speedText = this.add.text(34, 91, "", {
            fontFamily: "monospace",
            fontSize: "15px",
            color: "#ffda83",
            stroke: "#14202a",
            strokeThickness: 4
        }).setDepth(10);

        this.scoreText = this.add.text(34, 118, "Score: 0", {
            fontFamily: "monospace",
            fontSize: "17px",
            fontStyle: "bold",
            color: "#ffffff",
            stroke: "#14202a",
            strokeThickness: 4
        }).setDepth(10);
    }

    update(time, delta) {
        const dt = delta / 1000;

        if (Phaser.Input.Keyboard.JustDown(this.keys.R)) {
            this.resetBalls();
        }

        this.checkHoleCollisions();
        if (this.rerackPending) {
            this.rerackObjectBalls();
        }

        if (!this.selectedBall?.image) {
            this.selectedBall = this.balls.find(ballState => !ballState.pocketed)
                || null;
        }
        if (!this.selectedBall) {
            this.speedText.setText("No balls remaining");
            return;
        }

        const selectedImage = this.selectedBall.image;
        const body = selectedImage.body;

        let inputX = 0;
        let inputY = 0;

        if (this.cursors.left.isDown || this.keys.A.isDown) inputX -= 1;
        if (this.cursors.right.isDown || this.keys.D.isDown) inputX += 1;
        if (this.cursors.up.isDown || this.keys.W.isDown) inputY -= 1;
        if (this.cursors.down.isDown || this.keys.S.isDown) inputY += 1;

        const input = new Phaser.Math.Vector2(inputX, inputY);

        if (input.lengthSq() > 0) {
            input.normalize();
            selectedImage.setAcceleration(
                input.x * this.acceleration,
                input.y * this.acceleration
            );
            selectedImage.setDrag(this.drag * 0.35, this.drag * 0.35);
        } else {
            selectedImage.setAcceleration(0, 0);
            selectedImage.setDrag(this.drag, this.drag);
        }

        if (this.keys.SPACE.isDown) {
            selectedImage.setAcceleration(0, 0);
            selectedImage.setDrag(1500, 1500);
        }

        this.balls.forEach(ballState => {
            if (ballState.pocketed || !ballState.image) return;
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

        const velocity = body.velocity;
        const speed = velocity.length();

        this.speedText.setText(
            `Selected: ${this.selectedBall.type.index}   Speed: ${speed.toFixed(0)} px/s`
        );
    }

    resize(gameSize) {
        const width = gameSize.width;
        const height = gameSize.height;

        this.floor.setPosition(width / 2, height / 2);
        this.floor.setDisplaySize(width, height);
        this.layoutTableHoles(width, height);
        this.drawTableSpots();
        this.updateWorldBounds(width, height);

        const bounds = this.getTableBounds(width, height);
        this.balls.forEach(ballState => {
            if (!ballState.image?.body) return;

            ballState.image.body.setBoundsRectangle(bounds);
            this.constrainBallToScreen(ballState, width, height);
        });
    }
}
