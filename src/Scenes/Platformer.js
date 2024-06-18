class Platformer extends Phaser.Scene {
    constructor() {
        super("platformerScene");
    }

    init() {
        // variables and settings
        this.ACCELERATION = 2000;
        this.DRAG = 300;    // DRAG < ACCELERATION = icy slide
        this.physics.world.gravity.y = 1500;
        this.JUMP_VELOCITY = -700;
        this.PARTICLE_VELOCITY = 50;
        this.SCALE = 2.0;
        this.MAX_JUMPS = 2; // double jump
        this.DASH_VELOCITY = 200;
        this.DASH_DURATION = 200; // duration of dash in milliseconds
        this.DASH_COOLDOWN = 500; // cooldown period in milliseconds
        this.ENEMY_RANGE = 200; // range within which the enemy will start shooting
        this.ENEMY_FIRE_RATE_NORMAL = 1000; // normal fire rate in ms
        this.ENEMY_FIRE_RATE_FAST = 500; // fast fire rate in ms
    }

    create() {
        this.jumps = 0;
        this.dashing = false;
        this.dashTime = 0;
        this.facing = 'right'; // initial facing direction
    
        // Initialize player health
        this.playerHealth = 100;
    
        // Track if the player is on a lava tile
        this.onLava = false;
    
        // Create a new tilemap game object
        this.map = this.add.tilemap("platformer-level-1");
    
        // Add a tileset to the map
        this.tileset = this.map.addTilesetImage("kenny_tilemap_packed", "tilemap_tiles");
    
        // Create a layer
        this.groundLayer = this.map.createLayer("Ground-n-Platforms", this.tileset, 0, 0);
    
        // Make it collidable
        this.groundLayer.setCollisionByProperty({ collides: true });
    
        // Find coins in the "Objects" layer in Phaser
        this.coins = this.map.createFromObjects("Objects", {
            name: "coin",
            key: "tilemap_sheet",
            frame: 151
        });
    
        // Convert coins to Arcade Physics sprites
        this.physics.world.enable(this.coins, Phaser.Physics.Arcade.STATIC_BODY);
    
        // Create a Phaser group out of the array this.coins
        this.coinGroup = this.add.group(this.coins);
    
        // Set up player avatar
        my.sprite.player = this.physics.add.sprite(30, 345, "platformer_characters", "tile_0000.png");
        my.sprite.player.setCollideWorldBounds(true);
    
        // Enable collision handling
        this.physics.add.collider(my.sprite.player, this.groundLayer, this.handleGroundCollision, null, this);
    
        // Handle collision detection with coins
        this.physics.add.overlap(my.sprite.player, this.coinGroup, (obj1, obj2) => {
            obj2.destroy(); // remove coin on overlap
        });
    
        // Create a group for bullets
        this.bullets = this.physics.add.group({
            defaultKey: 'heart_bullet',
            maxSize: 10
        });
    
        // Handle collision between bullets and ground layer
        this.physics.add.collider(this.bullets, this.groundLayer, this.handleBulletCollision, null, this);
    
        // Create a group for enemies
        this.enemies = this.physics.add.group();
    
        // Randomly spawn multiple enemies on the map
        this.spawnEnemies(4); // for example, spawn 5 enemies
    
        // Enable collision between enemies and ground layer
        this.physics.add.collider(this.enemies, this.groundLayer);
    
        // Handle collision between player's bullets and enemies
        this.physics.add.overlap(this.bullets, this.enemies, this.handleBulletHitEnemy, null, this);
    
        // Add collider between player and enemy bullets
        this.physics.add.overlap(my.sprite.player, this.enemyBullets, this.handlePlayerHit, null, this);
    
        // Create a group for dash enemies
        this.dashEnemies = this.physics.add.group();
    
        // Randomly spawn dash enemies on the map
        this.spawnDashEnemies(2); // for example, spawn 3 dash enemies
    
        // Enable collision between dash enemies and ground layer
        this.physics.add.collider(this.dashEnemies, this.groundLayer);
    
        this.physics.add.overlap(this.bullets, this.dashEnemies, this.handleBulletHitEnemy, null, this);
    
        // Handle collision between dash enemies and the player
        this.physics.add.collider(my.sprite.player, this.dashEnemies, this.handleDashEnemy, null, this);
    
        // Set up Phaser-provided cursor key input
        cursors = this.input.keyboard.createCursorKeys();
        this.spacebar = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    
        this.rKey = this.input.keyboard.addKey('R');
    
        // Debug key listener (assigned to D key)
        this.input.keyboard.on('keydown-D', () => {
            this.physics.world.drawDebug = !this.physics.world.drawDebug;
            this.physics.world.debugGraphic.clear();
        }, this);
    
        // Movement VFX
        my.vfx.walking = this.add.particles(0, 0, "kenny-particles", {
            frame: ['smoke_03.png', 'smoke_09.png'],
            scale: { start: 0.03, end: 0.1 },
            lifespan: 350,
            alpha: { start: 1, end: 0.1 },
        });
    
        my.vfx.walking.stop();
    
        // Camera setup
        const mapWidth = this.map.widthInPixels;
        const mapHeight = this.map.heightInPixels;
        this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);
        this.cameras.main.startFollow(my.sprite.player, true, 0.25, 0.25);
        this.cameras.main.setDeadzone(50, 50);
        this.cameras.main.setZoom(this.SCALE);
    
        // Dash key setup
        this.dashKey = this.input.keyboard.addKey('SHIFT');
    
        // Create a text object for the health display
        this.healthText = this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2, `HP: ${this.playerHealth}`, {
            fontFamily: 'Arial',
            fontSize: '20px',
            fill: '#ffffff'
        }).setScrollFactor(0).setOrigin(1, 0); // Fix text to the camera
    
        // Timer to apply damage while on lava
        this.lavaDamageTimer = this.time.addEvent({
            delay: 1000,
            callback: this.applyLavaDamage,
            callbackScope: this,
            loop: true,
            paused: true
        });
    }
    

    handleGroundCollision(player, tile) {
        // Check if the tile has the isLava property
        if (tile.properties.isLava) {
            // Start the lava damage timer if not already started
            if (!this.onLava) {
                this.onLava = true;
                this.lavaDamageTimer.paused = false;
            }
        } else {
            // Stop the lava damage timer if the player is no longer on lava
            if (this.onLava) {
                this.onLava = false;
                this.lavaDamageTimer.paused = true;
            }
        }
    }

    handleBulletCollision(bullet, tile) {
        bullet.setActive(false);
        bullet.setVisible(false);
        bullet.destroy();
    }

    handleBulletHitEnemy(enemy, bullet) {
        bullet.destroy();  // Destroy the bullet
        enemy.setActive(false);  // Deactivate the enemy
        enemy.setVisible(false); // Hide the enemy

        // Stop the enemy's shoot timer
        if (enemy.shootTimer) {
            enemy.shootTimer.remove(false);
        }
        this.checkForVictory();
    }

    handlePlayerHit(player, bullet) {
        bullet.destroy();
        // Reduce player health by 10 when hit by a bullet
        this.playerHealth -= 10;
        this.healthText.setText(`HP: ${this.playerHealth}`);
        if (this.playerHealth <= 0) {
            // If player health drops to 0 or below, restart the scene
            this.scene.restart();
        }
    }

    applyLavaDamage() {
        if (this.onLava) {
            // Reduce player health by 10 when on lava
            this.playerHealth -= 10;
            this.healthText.setText(`HP: ${this.playerHealth}`);
            if (this.playerHealth <= 0) {
                // If player health drops to 0 or below, restart the scene
                this.scene.restart();
            }
        }
    }

    fireBullet() {
        const bullet = this.bullets.get(my.sprite.player.x, my.sprite.player.y);

        if (bullet) {
            bullet.setActive(true);
            bullet.setVisible(true);
            bullet.body.allowGravity = false; // Disable gravity for the bullet

            // Set bullet velocity
            const speed = 300;
            bullet.body.velocity.x = this.facing === 'left' ? -speed : speed;
            bullet.body.velocity.y = 0;
        }
    }

    enemyShoot(enemy) {
        if (!enemy.active) return; // Exit if the enemy is not active

        const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, my.sprite.player.x, my.sprite.player.y);

        if (distance < this.ENEMY_RANGE) {
            const bullet = this.enemyBullets.get(enemy.x, enemy.y);

            if (bullet) {
                bullet.setActive(true);
                bullet.setVisible(true);
                bullet.body.allowGravity = false;

                const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, my.sprite.player.x, my.sprite.player.y);
                this.physics.velocityFromRotation(angle, 300, bullet.body.velocity);
            }
        }
    }

    spawnEnemies(numberOfEnemies) {
        for (let i = 0; i < numberOfEnemies; i++) {
            const x = Phaser.Math.Between(100, this.map.widthInPixels - 100);
            const y = Phaser.Math.Between(100, this.map.heightInPixels - 100);

            const enemy = this.enemies.create(x, y, "enemy_ship");
            enemy.setScale(0.25);
            enemy.setCollideWorldBounds(true);
            enemy.setImmovable(false);
            enemy.body.setGravityY(this.physics.world.gravity.y);

            // Randomly assign a fire rate
            enemy.fireRate = Phaser.Math.Between(0, 1) ? this.ENEMY_FIRE_RATE_NORMAL : this.ENEMY_FIRE_RATE_FAST;
        }

        // Create a group for enemy bullets
        this.enemyBullets = this.physics.add.group({
            defaultKey: 'heart_bullet',
            maxSize: 10
        });

        // Handle collision between enemy bullets and ground layer
        this.physics.add.collider(this.enemyBullets, this.groundLayer, this.handleBulletCollision, null, this);

        // Set a timer for each enemy based on its fire rate
        this.enemies.getChildren().forEach(enemy => {
            enemy.shootTimer = this.time.addEvent({
                delay: enemy.fireRate,
                callback: () => this.enemyShoot(enemy),
                callbackScope: this,
                loop: true
            });
        });
    }

    spawnDashEnemies(numberOfEnemies) {
        for (let i = 0; i < numberOfEnemies; i++) {
            const x = Phaser.Math.Between(100, this.map.widthInPixels - 100);
            const y = Phaser.Math.Between(100, this.map.heightInPixels - 100);
    
            const enemy = this.dashEnemies.create(x, y, "enemy_shipP");
            enemy.setScale(0.25);
            enemy.setCollideWorldBounds(true);
            enemy.setImmovable(false);
            enemy.body.setGravityY(this.physics.world.gravity.y);
            enemy.collided = false;
        }
    }
    
    handleDashEnemy(player, enemy) {
        // Reduce player health by 20 when hit by a dash enemy
        if (!enemy.collided) {
            // Reduce player health by 20 when hit by a dash enemy
            this.playerHealth -= 20;
            this.healthText.setText(`HP: ${this.playerHealth}`);
            if (this.playerHealth <= 0) {
                // If player health drops to 0 or below, restart the scene
                this.scene.restart();
            }
            // Set the 'collided' property to true to prevent repeated damage
            enemy.collided = true;
            enemy.body.velocity.x = 0;
            enemy.body.velocity.y = 0;
        }
    }
    
    updateDashEnemies() {
        this.dashEnemies.getChildren().forEach(enemy => {
            const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, my.sprite.player.x, my.sprite.player.y);
    
            if (distance < this.ENEMY_RANGE) {
                const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, my.sprite.player.x, my.sprite.player.y);
                // Set velocity based on the direction the enemy is facing
                const dashVelocity = 300; // Adjust this value as needed
                enemy.body.velocity.x = Math.cos(angle) * dashVelocity;
                enemy.body.velocity.y = Math.sin(angle) * dashVelocity;
            }
        });
    }

    checkForVictory() {
        if (this.enemies.countActive(true) === 0 && this.dashEnemies.countActive(true) === 0) {
            this.scene.start('victoryScene');
        }
    }
    
    

    update(time, delta) {
        // left/right movement
        this.updateDashEnemies();
        if (cursors.left.isDown) {
            my.sprite.player.body.setAccelerationX(-this.ACCELERATION);
            my.sprite.player.setFlip(true, false); // flip the sprite to the left
            this.facing = 'left';
            if (my.sprite.player.body.onFloor()) {
                my.vfx.walking.emitParticle(this.PARTICLE_VELOCITY, my.sprite.player.x + (my.sprite.player.width * 0.5), my.sprite.player.y + my.sprite.player.height);
            }
        } else if (cursors.right.isDown) {
            my.sprite.player.body.setAccelerationX(this.ACCELERATION);
            my.sprite.player.resetFlip(); // use the original sprite facing direction
            this.facing = 'right';
            if (my.sprite.player.body.onFloor()) {
                my.vfx.walking.emitParticle(this.PARTICLE_VELOCITY, my.sprite.player.x + (my.sprite.player.width * 0.5), my.sprite.player.y + my.sprite.player.height);
            }
        } else {
            // set acceleration to 0 so DRAG will take over
            my.sprite.player.body.setAccelerationX(0);
            // stop movement at very low speeds
            if (Math.abs(my.sprite.player.body.velocity.x) < 10) {
                my.sprite.player.body.setVelocityX(0);
            }
        }
    
        // jump logic
        if (Phaser.Input.Keyboard.JustDown(cursors.up)) {
            if (my.sprite.player.body.onFloor() || (this.jumps < this.MAX_JUMPS && !this.doubleJumped)) {
                this.doubleJumped = !my.sprite.player.body.onFloor(); // If the player is in the air, it's a double jump
                my.sprite.player.body.setVelocityY(this.JUMP_VELOCITY);
                this.jumps++;
            }
        }
    
        // reset jumps when player is on the ground
        if (my.sprite.player.body.onFloor()) {
            this.jumps = 0;
            this.doubleJumped = false; // Reset double jump flag when player lands
        }
    
        // bullet firing mechanism
        if (Phaser.Input.Keyboard.JustDown(this.spacebar)) {
            this.fireBullet();
        }
    
        // check for dash input
        if (Phaser.Input.Keyboard.JustDown(this.dashKey) && !this.dashing) {
            this.dashing = true;
            this.dashTime = this.time.now + this.DASH_DURATION;
            my.sprite.player.body.maxVelocity.x = this.DASH_VELOCITY;
            my.sprite.player.body.velocity.x = this.facing === 'left' ? -this.DASH_VELOCITY : this.DASH_VELOCITY;
            my.sprite.player.body.setAccelerationX(0);
            my.sprite.player.body.setDrag(0);
    
            // Create particles for the dash
            const dashParticles = this.add.particles('kenny-particles', 'smoke_03.png', {
                x: my.sprite.player.x,
                y: my.sprite.player.y,
                lifespan: 300,
                speed: { min: 400, max: 600 },
                scale: { start: 0.5, end: 0 },
                alpha: { start: 1, end: 0 },
                blendMode: 'ADD'
            });
    
            // Stop the particles after the dash duration
            this.time.delayedCall(this.DASH_DURATION, () => {
                dashParticles.destroy();
            });
        }
    
        // reset from dashing
        if (this.dashing && this.time.now > this.dashTime) {
            this.dashing = false;
            my.sprite.player.body.maxVelocity.x = this.ACCELERATION;
            my.sprite.player.body.setDrag(this.DRAG);
        }
    
        // allow the player to reset the scene
        if (this.rKey.isDown) {
            this.scene.restart();
        }
        this.checkForVictory();
    }
    
    
    
}
