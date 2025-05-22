// JavaScript for game logic will go here 

document.addEventListener('DOMContentLoaded', () => {
    const gameArea = document.querySelector('.cyberpunk-bg');
    const platformContainer = document.getElementById('platform-container');

    // Add rain container
    const rainContainer = document.createElement('div');
    rainContainer.className = 'rain-container';
    gameArea.appendChild(rainContainer);

    // Rain properties
    const numberOfRaindrops = 100;
    
    // Create initial raindrops
    function createRaindrops() {
        for (let i = 0; i < numberOfRaindrops; i++) {
            const raindrop = document.createElement('div');
            raindrop.className = 'raindrop';
            
            // Random horizontal position
            raindrop.style.left = `${Math.random() * 100}%`;
            
            // Random animation delay (negative to start mid-animation)
            const delay = -(Math.random() * 2);
            raindrop.style.animationDelay = `${delay}s`;
            
            rainContainer.appendChild(raindrop);
        }
    }

    createRaindrops();

    const gameHeight = gameArea.clientHeight;
    const gameWidth = gameArea.clientWidth;

    // Platform properties
    const platformHeight = 20;
    const platformMinWidth = 100;
    const platformMaxWidth = 190;
    const minPlatformGapX = 70;
    const maxPlatformGapX = 160;

    const level0_Y = gameHeight - 50 - platformHeight;
    const level1_Y = gameHeight - 140 - platformHeight;
    const level2_Y = gameHeight - 250 - platformHeight;
    const platformLevelsY = [level0_Y, level1_Y, level2_Y];

    let platforms = [];
    let enemies = [];
    let currentX = 0;

    const enemyHeight = 30;
    const enemyWidth = 30;
    const enemySpeed = 0.75;

    // Fixed initial platform configurations
    // Properties: startX (optional, otherwise uses currentX + gap), level, width, hasEnemy, enemyVariation (if hasEnemy)
    const fixedPlatformsConfig = [
        { startX: 50, level: 0, width: 200, hasEnemy: false }, // Player start platform (P1)
        { gap: 100, level: 1, width: 120, hasEnemy: true, enemyVariation: 'enemy-blinky' }, // P2
        { gap: 120, level: 0, width: 150, hasEnemy: false }, // P3 (must be false due to P2 having enemy)
        { gap: 90, level: 1, width: 100, hasEnemy: true, enemyVariation: 'enemy-pinky' }, // P4
        { gap: 110, level: 0, width: 180, hasEnemy: false },  // P5 (must be false due to P4 having enemy)
        { gap: 100, level: 1, width: 130, hasEnemy: true, enemyVariation: 'enemy-blinky' } // P6 (can have enemy as P5 doesn't)
    ];

    const player = document.getElementById('player');

    // Player properties
    let playerWorldX = 50; // Player's X position in the game world
    let playerY = 0; 
    const playerWidth = 40;
    const playerHeight = 40;
    const playerSpeed = 4;
    const jumpStrength = 14;
    const gravity = 0.6;
    const deathFallGravityFactor = 0.6; // Pac-Man falls at 60% of normal gravity when dead
    let velocityY = 0;
    let isJumping = false;
    let isAttacking = false;
    let canAttack = true;
    let playerDirection = 'right';
    let projectiles = [];
    const projectileSpeed = 8;
    const projectileWidth = 20;
    const projectileHeight = 20;

    // Camera properties
    let cameraOffsetX = 0;
    const playerScreenAnchorX = gameWidth * 0.3; // Player tries to stay around this X on screen once scrolling starts

    const keys = {
        ArrowUp: false, ArrowLeft: false, ArrowRight: false, Space: false
    };

    // Need to define currentPlatformId and playerIsAlive globally or pass them around
    // Let's add them globally for now:
    let currentPlatformId = null; // ID of the platform player is currently on
    let playerIsAlive = true;

    // Power-up system
    let enemiesDefeated = 0;
    let hasBubblePowerUp = false;
    let isBubbleActive = false;
    let bubbleElement = null;
    
    // Create power-up indicator
    const powerUpIndicator = document.createElement('div');
    powerUpIndicator.id = 'power-up-indicator';
    document.body.appendChild(powerUpIndicator);
    updatePowerUpIndicator();

    function createPlatformElement(x, y, width, idPrefix = 'platform') {
        const platform = document.createElement('div');
        platform.classList.add('platform');
        platform.style.width = `${width}px`;
        platform.style.height = `${platformHeight}px`;
        platform.style.bottom = `${gameHeight - y - platformHeight}px`;
        platformContainer.appendChild(platform);
        const platformObj = { x, y, width, height: platformHeight, element: platform, id: `${idPrefix}-${platforms.length}` };
        updatePlatformVisualPosition(platformObj);
        return platformObj;
    }

    function createEnemyElement(platform, variation) {
        const enemy = document.createElement('div');
        enemy.classList.add('enemy');
        enemy.classList.add(variation);

        const leftEye = document.createElement('div');
        leftEye.classList.add('eye', 'left');
        const rightEye = document.createElement('div');
        rightEye.classList.add('eye', 'right');
        const leftPupil = document.createElement('div');
        leftPupil.classList.add('pupil');
        const rightPupil = document.createElement('div');
        rightPupil.classList.add('pupil');
        leftEye.appendChild(leftPupil);
        rightEye.appendChild(rightPupil);
        enemy.appendChild(leftEye);
        enemy.appendChild(rightEye);

        let enemyX;
        const platformRightmostX = platform.x + platform.width - enemyWidth - 5; // -5 for a small margin from the absolute edge

        // Always place at the rightmost part
        enemyX = platformRightmostX;
        
        // Ensure enemyX is not less than platform.x (in case platform is very narrow, though less likely with wider platforms)
        enemyX = Math.max(platform.x + 5, enemyX);

        const enemyY = platform.y - enemyHeight;
        enemy.style.bottom = `${gameHeight - enemyY - enemyHeight}px`;
        platformContainer.appendChild(enemy);
        const enemyObj = {
            x: enemyX,
            y: enemyY,
            element: enemy,
            onPlatformId: platform.id,
            type: variation,
            state: 'idle', // Initial state
            speed: enemySpeed,
            directionX: 0, // -1 for left, 1 for right, 0 for still
            platformDetails: platform // Keep a reference to the platform it's on
        };
        updateEnemyVisualPosition(enemyObj);
        return enemyObj;
    }

    function generateInitialPlatforms() {
        let lastLevel = 0;
        let previousPlatformHadEnemy = false;

        // 1. Generate Fixed Platforms
        fixedPlatformsConfig.forEach((config, index) => {
            if (config.startX) {
                currentX = config.startX;
            } else {
                currentX += config.gap || 0;
            }
            const platformY = platformLevelsY[config.level];
            const newPlatform = createPlatformElement(currentX, platformY, config.width, `fixed-platform-${index}`);
            platforms.push(newPlatform);

            if (config.hasEnemy) {
                if (previousPlatformHadEnemy) {
                    console.warn(`Rule violation in fixed config: Platform ${index} wants an enemy, but previous one had one.`);
                    // Overriding config to enforce the rule for fixed setup consistency
                } else {
                    const enemyVariation = config.enemyVariation || (Math.random() < 0.5 ? 'enemy-blinky' : 'enemy-pinky');
                    const newEnemy = createEnemyElement(newPlatform, enemyVariation);
                    enemies.push(newEnemy);
                    previousPlatformHadEnemy = true;
                }
            } else {
                previousPlatformHadEnemy = false;
            }
            
            currentX += newPlatform.width;
            lastLevel = config.level;
        });

        // 2. Generate Random Platforms (starting after fixed ones)
        while (currentX < gameWidth * 2) { // Fill about 2 screen widths total (including fixed)
            const gap = Math.random() * (maxPlatformGapX - minPlatformGapX) + minPlatformGapX;
            currentX += gap;

            const platformWidth = Math.random() * (platformMaxWidth - platformMinWidth) + platformMinWidth;
            
            let nextRandomLevel;
            if (lastLevel === 0) {
                nextRandomLevel = Math.random() < 0.7 ? 0 : 1;
            } else {
                const rand = Math.random();
                if (rand < 0.4) nextRandomLevel = 0;
                else if (rand < 0.8) nextRandomLevel = 1;
                else nextRandomLevel = 2;
            }

            const newPlatformY = platformLevelsY[nextRandomLevel];
            const newPlatform = createPlatformElement(currentX, newPlatformY, platformWidth, 'random-platform');
            platforms.push(newPlatform);

            // Enemy spawning for random platforms with the new rule
            const spawnChance = 0.4; // 40% chance if allowed
            if (!previousPlatformHadEnemy && Math.random() < spawnChance && newPlatform.width > enemyWidth * 1.5) {
                const randomVariation = Math.random() < 0.5 ? 'enemy-blinky' : 'enemy-pinky';
                const newEnemy = createEnemyElement(newPlatform, randomVariation);
                enemies.push(newEnemy);
                previousPlatformHadEnemy = true;
            } else {
                previousPlatformHadEnemy = false;
            }
            
            currentX += newPlatform.width;
            lastLevel = nextRandomLevel;
        }

        // After platforms/enemies are created in generateInitialPlatforms, loop through them to set initial visual pos:
        platforms.forEach(updatePlatformVisualPosition);
        enemies.forEach(updateEnemyVisualPosition);
    }

    function setPlayerInitialPosition() {
        const firstPlatform = platforms[0];
        if (firstPlatform) {
            playerWorldX = firstPlatform.x + (firstPlatform.width / 2) - (playerWidth / 2);
            playerY = firstPlatform.y - playerHeight;
        } else {
            playerWorldX = 50;
            playerY = level0_Y - playerHeight;
        }
        // Initial camera offset to center the player somewhat if starting far left
        // cameraOffsetX = Math.max(0, playerWorldX - playerScreenAnchorX);
        updatePlayerVisualPosition();
        // player.classList.remove('mouth-closed'); // Mouth is now closed by default
        updatePlayerDirectionClass();
    }

    function updatePlayerDirectionClass() {
        if (playerDirection === 'left') {
            player.classList.add('facing-left');
            player.classList.remove('facing-right');
            // For Pac-Man mouth, we need to adjust the ::before transform if it faces left
            // This assumes the ::before is naturally for right-facing. 
            // We can flip the whole player or adjust the mouth.
            // Flipping the player is simpler if visual style allows:
            // player.style.transform = 'scaleX(-1)'; 
            // Or adjust mouth directly (more complex if mouth is not symmetrical)
            // For now, CSS handles eye via .facing-left for ::after
        } else {
            player.classList.add('facing-right');
            player.classList.remove('facing-left');
            // player.style.transform = 'scaleX(1)';
        }
    }

    function updatePlayerVisualPosition() {
        player.style.left = `${playerWorldX - cameraOffsetX}px`;
        player.style.bottom = `${gameHeight - playerY - playerHeight}px`;
    }
    
    function updatePlatformVisualPosition(platform) {
        platform.element.style.left = `${platform.x - cameraOffsetX}px`;
    }

    function updateEnemyVisualPosition(enemy) {
        enemy.element.style.left = `${enemy.x - cameraOffsetX}px`;
    }

    function gameLoop() {
        // 1. Handle Horizontal Movement & Camera
        if (playerIsAlive) { // Only allow movement if alive
            const oldPlayerWorldX = playerWorldX;
            if (keys.ArrowLeft) {
                playerWorldX -= playerSpeed;
                playerDirection = 'left';
            }
            if (keys.ArrowRight) {
                playerWorldX += playerSpeed;
                playerDirection = 'right';
            }
            playerWorldX = Math.max(0, playerWorldX);
            updatePlayerDirectionClass();
        }
        // Update Camera based on player's world position
        // If player moves past the screen anchor, scroll the camera
        const desiredCameraX = playerWorldX - playerScreenAnchorX;
        if (desiredCameraX > cameraOffsetX) {
            // Gradually move camera if desired is ahead (scrolling right)
            cameraOffsetX += (desiredCameraX - cameraOffsetX) * 0.1; // Adjust 0.1 for smoother/faster camera follow
        }
        // For scrolling left, camera should ideally not go beyond 0, or player should be pushed
        if (playerWorldX - cameraOffsetX < playerScreenAnchorX * 0.5 && cameraOffsetX > 0) { // If player is too far left on screen
            cameraOffsetX = Math.max(0, playerWorldX - (playerScreenAnchorX * 0.5));
        }
        cameraOffsetX = Math.max(0, cameraOffsetX); // Camera doesn't go into negative X

        // 2. Handle Jumping
        if (playerIsAlive && keys.ArrowUp && !isJumping) { // Only allow jump if alive
            velocityY = -jumpStrength; // Negative because Y increases downwards in typical physics, but our Y is from top
            isJumping = true;
        }

        // 3. Apply Physics (Gravity) - this applies even if player is not alive
        console.log(`Loop Top - playerY: ${playerY.toFixed(2)}, velocityY: ${velocityY.toFixed(2)}, isJumping: ${isJumping}`); // LOGGING
        playerY += velocityY;
        if (playerIsAlive) {
            velocityY += gravity;
        } else {
            velocityY += gravity * deathFallGravityFactor; // Slower fall when dead
        }

        // 4. Collision Detection with Platforms
        if (playerIsAlive) {
            let onPlatformThisFrame = false;
            let newCurrentPlatformId = null;
            platforms.forEach(platform => {
                if (playerWorldX < platform.x + platform.width && playerWorldX + playerWidth > platform.x) {
                    if (velocityY >= 0 && (playerY + playerHeight) >= platform.y && (playerY + playerHeight) <= platform.y + velocityY + platform.height / 2) {
                        playerY = platform.y - playerHeight;
                        velocityY = 0;
                        isJumping = false;
                        onPlatformThisFrame = true;
                        newCurrentPlatformId = platform.id;
                    }
                }
            });
            if (playerY + playerHeight > gameHeight && velocityY >= 0) { // Check velocityY to ensure it's not from the knockback up
                playerY = gameHeight - playerHeight;
                velocityY = 0;
                isJumping = false;
                onPlatformThisFrame = true;
                newCurrentPlatformId = 'ground';
            }
            currentPlatformId = newCurrentPlatformId;
            isJumping = !onPlatformThisFrame;
        } else {
            // Player is not alive, just let them fall
            // No platform collision, they just pass through everything
            currentPlatformId = null; // Dead player isn't on any platform
            isJumping = true; // Keep in falling state
        }

        // 5. Dynamic Platform and Enemy Generation
        const generationThreshold = cameraOffsetX + gameWidth + 200; // Generate when this point is near currentX
        if (currentX < generationThreshold) {
            generateMoreContent(); // New function to add more platforms/enemies
        }

        // 6. Content Culling (Remove off-screen elements to the left)
        const cullThreshold = cameraOffsetX - gameWidth; // Elements whose right edge is past this are culled
        platforms = platforms.filter(platform => {
            if (platform.x + platform.width < cullThreshold) {
                platform.element.remove();
                return false; // Remove from array
            }
            return true;
        });
        enemies = enemies.filter(enemy => {
            if (enemy.x + enemyWidth < cullThreshold) { // Assuming enemyWidth is defined globally
                enemy.element.remove();
                return false;
            }
            return true;
        });

        // Update Projectiles
        projectiles.forEach((proj, projIndex) => {
            proj.x += proj.directionX * projectileSpeed;
            updateProjectileVisualPosition(proj);

            // Projectile-Enemy Collision
            enemies.forEach((enemy, enemyIndex) => {
                if (!proj.element || !enemy.element) return; // Skip if already removed

                // Simple AABB collision for projectile and enemy
                // Projectile world coordinates: proj.x, proj.y
                // Enemy world coordinates: enemy.x, enemy.y (enemy.y is top of enemy)
                if (
                    proj.x < enemy.x + enemyWidth &&
                    proj.x + projectileWidth > enemy.x &&
                    proj.y < enemy.y + enemyHeight &&
                    proj.y + projectileHeight > enemy.y
                ) {
                    console.log('Projectile hit enemy!', enemy.type);
                    enemy.element.remove();
                    enemies.splice(enemyIndex, 1);
                    proj.element.remove();
                    projectiles.splice(projIndex, 1);
                    handleEnemyDefeat();
                    return; // Projectile is gone, stop checking it against other enemies
                }
            });

            // Cull projectiles that go off-screen (e.g., beyond camera view + some buffer)
            const projectileCullLeft = cameraOffsetX - projectileWidth - 100; // Left of screen
            const projectileCullRight = cameraOffsetX + gameWidth + 100;    // Right of screen
            if (proj.x < projectileCullLeft || proj.x > projectileCullRight) {
                if (proj.element) proj.element.remove();
                projectiles.splice(projIndex, 1);
            }
        });

        // 7. Update Visual Positions of All Elements (player, platforms, enemies - projectiles updated above)
        updatePlayerVisualPosition();
        platforms.forEach(updatePlatformVisualPosition);
        enemies.forEach(updateEnemyVisualPosition);
        // Projectiles are updated within their own loop for now

        // Update background buildings scroll (parallax)
        const buildingsElement = document.querySelector('.buildings');
        if (buildingsElement) {
            const buildingScrollSpeed = 0.3;
            let buildingX = - (cameraOffsetX * buildingScrollSpeed);
            const oneSetWidth = buildingsElement.scrollWidth / 2; // scrollWidth reflects actual rendered width
             if (oneSetWidth > 0 && (buildingsElement.style.width === '200%' || buildingsElement.style.width === '400%' || buildingsElement.style.width === '500%') ) { // only apply modulo if it's meant to loop
                 // Ensure oneSetWidth corresponds to one visual block of buildings if it's repeating
                 // If style.width is 200%, then offsetWidth is 2*gameWidth, oneSet is gameWidth.
                 // If style.width is (N * 100)%, then oneSetWidth should be offsetWidth / N.
                 // The current setup of buildings (manually in HTML) might not be perfectly N*gameWidth.
                 // For a robust loop with any number of building divs, we need to define total width of one repeating block.
                 // Let's assume the current building setup in HTML forms one repeating block
                 // and css width: 200% means we have two such blocks for the loop. 
                 // Then we scroll and when buildingX < - oneSetWidth, we reset buildingX.
                 // This needs careful coordination with the actual content of .buildings
                 // A simpler modulo for continuous scroll with a fixed-width CSS for buildings
                 // buildingX = buildingX % oneSetWidth; // This makes it jump back.
                 // For smoother, we need to append/prepend or have enough width.
                 // With style.width=200%, this should work if oneSetWidth is effectively one screen width of buildings
                 const totalBuildingStripWidth = buildingsElement.scrollWidth; // e.g. if CSS width is 200%, this is 2*screenWidth
                 const singleBuildingBlockWidth = totalBuildingStripWidth / 2; // Width of one repeating unit
                 if (singleBuildingBlockWidth > 0) {
                    buildingX = buildingX % singleBuildingBlockWidth;
                 }
             }
            buildingsElement.style.left = `${buildingX}px`;
        }

        // 8. Handle Attack Collision (already calls getBoundingClientRect, which uses visual positions)
        if (isAttacking) { // Only check when actively attacking
             // checkEnemyCollision(); // Called from handleAttack already
        }

        // Update enemy AI / Logic
        enemies.forEach(enemy => updateEnemyLogic(enemy));

        // Check for player-enemy collision if player is alive and not currently attacking
        if (playerIsAlive && !isAttacking) {
            checkEnemyCollision(); 
        }

        // Check for game restart condition if player is dead and off-screen
        if (!playerIsAlive && (playerY > gameHeight + playerHeight * 2)) { // playerY is top, check if fully off bottom
            restartGame();
            // No need to requestAnimationFrame here as restartGame might re-initialize things that gameLoop depends on.
            // The gameLoop() call at the end of restartGame() or its own initialization will pick it up if needed.
            // Or, more simply, the gameLoop just continues after restartGame reinitializes state.
        }

        // Update bubble position if active
        if (isBubbleActive) {
            updateBubblePosition();
        }

        requestAnimationFrame(gameLoop);
    }

    let previousPlatformHadEnemy = false; // This needs to be accessible by generateMoreContent
    let lastGeneratedLevel = 0;     // This also needs to be accessible

    function generateMoreContent() {
        const platformsToGenerate = 5; // Generate a few platforms at a time
        for (let i = 0; i < platformsToGenerate; i++) {
            if (currentX > cameraOffsetX + gameWidth * 2) break; // Don't generate too far ahead

            const gap = Math.random() * (maxPlatformGapX - minPlatformGapX) + minPlatformGapX;
            currentX += gap;
            const platformWidth = Math.random() * (platformMaxWidth - platformMinWidth) + platformMinWidth;

            let nextRandomLevel;
            if (lastGeneratedLevel === 0) {
                nextRandomLevel = Math.random() < 0.7 ? 0 : 1;
            } else {
                const rand = Math.random();
                if (rand < 0.4) nextRandomLevel = 0;
                else if (rand < 0.8) nextRandomLevel = 1;
                else nextRandomLevel = 2;
            }
            const newPlatformY = platformLevelsY[nextRandomLevel];
            const newPlatform = createPlatformElement(currentX, newPlatformY, platformWidth, 'dynamic-platform');
            platforms.push(newPlatform);

            const spawnChance = 0.4;
            if (!previousPlatformHadEnemy && Math.random() < spawnChance && newPlatform.width > enemyWidth * 1.5) {
                const randomVariation = Math.random() < 0.5 ? 'enemy-blinky' : 'enemy-pinky';
                const newEnemy = createEnemyElement(newPlatform, randomVariation);
                enemies.push(newEnemy);
                previousPlatformHadEnemy = true;
            } else {
                previousPlatformHadEnemy = false;
            }
            currentX += newPlatform.width;
            lastGeneratedLevel = nextRandomLevel;
        }
    }

    // Initialize generation state variables from fixed platforms
    if (platforms.length > 0) {
        const lastFixedPlatform = fixedPlatformsConfig[fixedPlatformsConfig.length -1];
        previousPlatformHadEnemy = lastFixedPlatform.hasEnemy;
        lastGeneratedLevel = lastFixedPlatform.level;
    }

    // Ensure setPlayerInitialPosition is called after platforms are created
    generateInitialPlatforms();
    setPlayerInitialPosition(); 
    gameLoop(); // Start the game loop!

    // Event Listeners for key presses
    window.addEventListener('keydown', (e) => {
        if (keys.hasOwnProperty(e.code)) {
            keys[e.code] = true;
        }
        if (e.code === 'KeyX') {
            activateBubble();
        }
    });

    window.addEventListener('keyup', (e) => {
        if (keys.hasOwnProperty(e.code)) {
            keys[e.code] = false;
        }
        if (e.code === 'Space') {
            if (!isAttacking && canAttack) {
                handleAttack();
            }
        }
    });

    function handleAttack() {
        if (!canAttack || !playerIsAlive) return;

        canAttack = false; // Start cooldown
        player.classList.add('is-firing'); // Re-enable mouth opening animation

        console.log(Date.now(), 'Fire Projectile (Mouth anim ENABLED)'); // Updated log
        // console.log(`Before Fire - playerY: ${playerY.toFixed(2)}, velocityY: ${velocityY.toFixed(2)}`); // LOGGING - Can be removed if dip is fixed or kept for now

        // Determine projectile start position and direction
        let projStartX = playerWorldX + (playerWidth / 2) - (projectileWidth / 2);
        let projStartY = playerY + (playerHeight / 2) - (projectileHeight / 2);
        let projDirectionX = (playerDirection === 'left' ? -1 : 1);

        if (playerDirection === 'right') {
            projStartX = playerWorldX + playerWidth - projectileWidth / 2; // Fire from right edge
        } else {
            projStartX = playerWorldX - projectileWidth / 2; // Fire from left edge
        }

        createProjectile(projStartX, projStartY, projDirectionX);
        
        // console.log(`After Fire - playerY: ${playerY.toFixed(2)}, velocityY: ${velocityY.toFixed(2)}`); // LOGGING - Can be removed if dip is fixed or kept for now

        const firingAnimationDuration = 100; 
        setTimeout(() => { 
            player.classList.remove('is-firing'); // Re-enable mouth closing after firing animation
            // console.log(Date.now(), 'Firing animation ended / Mouth Closed');
        }, firingAnimationDuration);

        const attackCooldown = 400; 
        setTimeout(() => {
            canAttack = true;
            console.log(Date.now(), 'Can attack (fire projectile) again');
        }, attackCooldown);
    }

    function createProjectile(x, y, directionX) {
        const projectile = document.createElement('div');
        projectile.classList.add('projectile');
        projectile.style.bottom = `${gameHeight - y - projectileHeight}px`; // Initial position from world Y
        
        const projObj = {
            x: x, // World X
            y: y, // World Y (top of projectile)
            width: projectileWidth,
            height: projectileHeight,
            directionX: directionX,
            element: projectile
        };
        updateProjectileVisualPosition(projObj); // Set initial visual left
        projectiles.push(projObj);
        platformContainer.appendChild(projectile); // Append to same container as platforms/enemies
    }

    function updateProjectileVisualPosition(projectile) {
        projectile.element.style.left = `${projectile.x - cameraOffsetX}px`;
        // projectile.element.style.bottom remains fixed based on its initial Y, or could be updated if projectiles have Y movement
    }

    function checkEnemyCollision() {
        if (!playerIsAlive) return;

        const playerRect = player.getBoundingClientRect();
        
        enemies.forEach((enemy, index) => {
            if (!enemy.element) return;

            const enemyRect = enemy.element.getBoundingClientRect();

            if (
                playerRect.left < enemyRect.right &&
                playerRect.right > enemyRect.left &&
                playerRect.top < enemyRect.bottom &&
                playerRect.bottom > enemyRect.top
            ) {
                if (isBubbleActive) {
                    // Kill the enemy instead of the player
                    console.log('Bubble shield destroyed enemy!');
                    enemy.element.remove();
                    enemies.splice(index, 1);
                    // Deactivate bubble after killing enemy
                    isBubbleActive = false;
                    if (bubbleElement) {
                        bubbleElement.remove();
                        bubbleElement = null;
                    }
                } else {
                    // Normal collision - player dies
                    console.log('Player directly hit by enemy and is vulnerable!', enemy.type);
                    handlePlayerDeath();
                }
                return;
            }
        });
    }
    
    // --- Enemy Logic Section ---
    function updateEnemyLogic(enemy) {
        if (!enemy.element || !playerIsAlive) {
            enemy.directionX = 0; // Stop if no element or player dead
            return;
        }

        // Determine if the player is currently on THIS enemy's specific platform
        const playerIsOnThisEnemysPlatform = (currentPlatformId === enemy.platformDetails.id);

        if (playerIsOnThisEnemysPlatform) {
            // Player IS on this enemy's platform
            if (enemy.state !== 'chasing') {
                console.log(`Enemy ${enemy.type} (P_ID: ${enemy.platformDetails.id}) SPOTTED PLAYER. Player on P_ID: ${currentPlatformId}. Chasing.`);
                enemy.state = 'chasing';
            }
            // Chase logic
            if (playerWorldX + (playerWidth / 2) < enemy.x + (enemyWidth / 2)) {
                enemy.directionX = -1; // Player is to the left
            } else {
                enemy.directionX = 1;  // Player is to the right
            }
            enemy.x += enemy.directionX * enemy.speed;

            // Keep enemy on its platform boundaries
            enemy.x = Math.max(enemy.platformDetails.x, enemy.x);
            enemy.x = Math.min(enemy.platformDetails.x + enemy.platformDetails.width - enemyWidth, enemy.x);

        } else {
            // Player is NOT on this enemy's platform
            if (enemy.state === 'chasing') {
                console.log(`Enemy ${enemy.type} (P_ID: ${enemy.platformDetails.id}) LOST PLAYER. Player on P_ID: ${currentPlatformId || 'None'}. Idling.`);
                enemy.state = 'idle';
                enemy.directionX = 0; // Stop movement
            } else if (enemy.state === 'idle') {
                enemy.directionX = 0; // Ensure idle enemies are not moving
            }
        }
    }
    // --- End Enemy Logic Section ---

    function handlePlayerDeath() {
        if (!playerIsAlive) return;
        playerIsAlive = false;
        
        player.style.backgroundColor = '#555'; // Indicate death visually
        player.classList.add('mouth-closed'); // Close mouth on death
        // player.style.transform = 'rotate(180deg)'; // Optional: flip Pac-Man on death

        // Apply a small upward knockback, then let gravity take over
        velocityY = -jumpStrength / 2; // A little hop up
        isJumping = true; // To ensure gravity affects him fully

        console.log("GAME OVER - Pac-Man is falling...");
        // No longer using setTimeout here for restart; gameLoop will handle it.
    }

    function restartGame() {
        console.log("Restarting game...");
        // 1. Reset Player State
        playerIsAlive = true;
        playerWorldX = 50; // Or use setPlayerInitialPosition which depends on platforms
        playerY = 0;
        velocityY = 0;
        isJumping = false;
        isAttacking = false;
        canAttack = true;
        playerDirection = 'right';
        player.style.backgroundColor = '#ffd700'; // Reset color
        currentPlatformId = null;

        // 2. Reset Camera
        cameraOffsetX = 0;

        // 3. Clear existing dynamic elements (platforms, enemies)
        platforms.forEach(p => { if (p.element) p.element.remove(); });
        enemies.forEach(e => { if (e.element) e.element.remove(); });
        platforms = [];
        enemies = [];

        // 4. Reset generation state
        currentX = 0;
        previousPlatformHadEnemy = false;
        lastGeneratedLevel = 0;

        // 5. Regenerate initial world and set player position
        generateInitialPlatforms(); // This will also call updateVisualPosition for new elements
        setPlayerInitialPosition(); // This calls updatePlayerVisualPosition
        
        // Ensure all visuals are updated after reset
        platforms.forEach(updatePlatformVisualPosition);
        enemies.forEach(updateEnemyVisualPosition);
        updatePlayerVisualPosition();
        const buildingsElement = document.querySelector('.buildings');
        if (buildingsElement) buildingsElement.style.left = '0px';

        // Game loop is already running, it will pick up the new state
        console.log("Game Restarted!");
    }

    function updatePowerUpIndicator() {
        if (hasBubblePowerUp) {
            powerUpIndicator.textContent = 'Bubble Shield Ready! (Press X)';
            powerUpIndicator.style.display = 'block';
        } else {
            powerUpIndicator.textContent = `Enemies Defeated: ${enemiesDefeated}/3`;
            powerUpIndicator.style.display = 'block';
        }
    }

    function createBubble() {
        if (bubbleElement) {
            bubbleElement.remove();
        }
        bubbleElement = document.createElement('div');
        bubbleElement.className = 'bubble';
        platformContainer.appendChild(bubbleElement);
        updateBubblePosition();
    }

    function updateBubblePosition() {
        if (bubbleElement) {
            bubbleElement.style.left = `${playerWorldX - 10 - cameraOffsetX}px`; // Center around player
            bubbleElement.style.bottom = `${gameHeight - playerY - playerHeight + 10}px`;
        }
    }

    function activateBubble() {
        if (hasBubblePowerUp && !isBubbleActive) {
            console.log('Activating bubble shield!');
            isBubbleActive = true;
            hasBubblePowerUp = false;
            createBubble();
            
            // Deactivate bubble after 5 seconds
            setTimeout(() => {
                console.log('Bubble shield expired!');
                isBubbleActive = false;
                if (bubbleElement) {
                    bubbleElement.remove();
                    bubbleElement = null;
                }
                updatePowerUpIndicator();
            }, 5000);
        }
    }

    function handleEnemyDefeat() {
        enemiesDefeated++;
        console.log(`Enemies defeated: ${enemiesDefeated}`);
        
        if (enemiesDefeated >= 3 && !hasBubblePowerUp && !isBubbleActive) {
            console.log('Bubble shield power-up unlocked!');
            hasBubblePowerUp = true;
            enemiesDefeated = 0; // Reset counter
        }
        
        updatePowerUpIndicator();
    }
}); 