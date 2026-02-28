/* ============================================
   VENUE RIVALS - Visual Renderer
   All canvas drawing: venues, street, customers,
   animations, title screen, game over effects
   ============================================ */

const Renderer = (() => {

    // Color palette
    const COLORS = {
        sky: '#1a1040',
        skyGradTop: '#0d0a2a',
        skyGradBot: '#2a1858',
        stars: '#ffffff',
        moon: '#f0e6c0',
        street: '#2a2a3a',
        sidewalk: '#3a3a50',
        sidewalkLine: '#4a4a60',
        buildingDark: '#1e1e30',
        windowLit: '#ffd166',
        windowDim: '#2a2840',
        playerMain: '#4cc9f0',
        playerDark: '#2a7a99',
        playerLight: '#7eddff',
        playerGlow: 'rgba(76, 201, 240, 0.15)',
        rivalMain: '#ff6e6e',
        rivalDark: '#aa3333',
        rivalLight: '#ffaaaa',
        rivalGlow: 'rgba(255, 110, 110, 0.15)',
        doorPlayer: '#3ab5d9',
        doorRival: '#e05555',
        neonPlayer: '#4cc9f0',
        neonRival: '#ff6e6e',
        customerBody: '#e8d5b7',
        customerClothes: ['#ff6e6e', '#4cc9f0', '#ffd166', '#7f5af0', '#2cb67d', '#ff9a5c'],
        grassGreen: '#1a4a2a',
        treeTrunk: '#5a3a20',
        treeLeaves: '#2a7a3a',
        lampPost: '#8a8a9a',
        lampGlow: 'rgba(255, 220, 150, 0.3)',
    };

    // Customer animation state
    let customers = [];
    let animFrame = 0;
    let particles = [];

    function drawTitleScreen(canvas) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        // Sky
        const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
        skyGrad.addColorStop(0, COLORS.skyGradTop);
        skyGrad.addColorStop(1, COLORS.skyGradBot);
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, h);

        // Stars
        const starSeed = 42;
        for (let i = 0; i < 40; i++) {
            const sx = ((starSeed * (i + 1) * 7) % w);
            const sy = ((starSeed * (i + 1) * 3) % (h * 0.6));
            const sr = ((i % 3) + 1) * 0.5;
            const alpha = 0.3 + (Math.sin(animFrame * 0.03 + i) * 0.3 + 0.3);
            ctx.fillStyle = `rgba(255,255,255,${alpha})`;
            ctx.beginPath();
            ctx.arc(sx, sy, sr, 0, Math.PI * 2);
            ctx.fill();
        }

        // Street
        ctx.fillStyle = COLORS.street;
        ctx.fillRect(0, h - 50, w, 50);
        ctx.fillStyle = COLORS.sidewalk;
        ctx.fillRect(0, h - 55, w, 8);

        // Dashed line on street
        ctx.strokeStyle = '#4a4a5a';
        ctx.lineWidth = 2;
        ctx.setLineDash([12, 8]);
        ctx.beginPath();
        ctx.moveTo(0, h - 25);
        ctx.lineTo(w, h - 25);
        ctx.stroke();
        ctx.setLineDash([]);

        // Player venue (left)
        drawBuilding(ctx, 60, h - 55, 180, 130, 'player', 3, true);

        // Rival venue (right)
        drawBuilding(ctx, w - 240, h - 55, 180, 130, 'rival', 3, true);

        // VS text in middle
        ctx.font = 'bold 28px Poppins, sans-serif';
        ctx.fillStyle = COLORS.moon;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(255, 209, 102, 0.5)';
        ctx.shadowBlur = 20;
        ctx.fillText('VS', w / 2, h / 2 - 10);
        ctx.shadowBlur = 0;

        // Animated customers walking
        const time = animFrame * 0.02;
        for (let i = 0; i < 5; i++) {
            const cx = ((time * 30 + i * 120) % (w + 40)) - 20;
            const cy = h - 40;
            drawCustomerSprite(ctx, cx, cy, i, time + i);
        }

        // Lamp posts
        drawLampPost(ctx, 30, h - 55);
        drawLampPost(ctx, w / 2, h - 55);
        drawLampPost(ctx, w - 30, h - 55);

        animFrame++;
    }

    function drawBuilding(ctx, x, y, w, h, owner, level, showNeon) {
        const isPlayer = owner === 'player';
        const main = isPlayer ? COLORS.playerMain : COLORS.rivalMain;
        const dark = isPlayer ? COLORS.playerDark : COLORS.rivalDark;
        const light = isPlayer ? COLORS.playerLight : COLORS.rivalLight;
        const glow = isPlayer ? COLORS.playerGlow : COLORS.rivalGlow;
        const doorColor = isPlayer ? COLORS.doorPlayer : COLORS.doorRival;
        const neonColor = isPlayer ? COLORS.neonPlayer : COLORS.neonRival;

        // Building glow
        if (showNeon) {
            ctx.shadowColor = main;
            ctx.shadowBlur = 25;
        }

        // Main building body
        const bGrad = ctx.createLinearGradient(x, y - h, x, y);
        bGrad.addColorStop(0, dark);
        bGrad.addColorStop(1, COLORS.buildingDark);
        ctx.fillStyle = bGrad;
        roundRect(ctx, x, y - h, w, h, 4);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Roof decoration based on level
        ctx.fillStyle = main;
        ctx.fillRect(x - 3, y - h - 4, w + 6, 6);
        if (level >= 2) {
            // Peaked roof accent
            ctx.beginPath();
            ctx.moveTo(x + w / 2 - 25, y - h - 4);
            ctx.lineTo(x + w / 2, y - h - 18);
            ctx.lineTo(x + w / 2 + 25, y - h - 4);
            ctx.fillStyle = dark;
            ctx.fill();
            ctx.strokeStyle = main;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        if (level >= 3) {
            // Flag or antenna
            ctx.strokeStyle = main;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x + w / 2, y - h - 18);
            ctx.lineTo(x + w / 2, y - h - 35);
            ctx.stroke();
            ctx.fillStyle = light;
            ctx.beginPath();
            ctx.moveTo(x + w / 2, y - h - 35);
            ctx.lineTo(x + w / 2 + 12, y - h - 30);
            ctx.lineTo(x + w / 2, y - h - 25);
            ctx.fill();
        }

        // Windows
        const rows = Math.min(level + 1, 4);
        const cols = 3;
        const winW = 22;
        const winH = 18;
        const winGapX = (w - cols * winW) / (cols + 1);
        const winGapY = (h - 40 - rows * winH) / (rows + 1);
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const wx = x + winGapX + c * (winW + winGapX);
                const wy = y - h + 10 + winGapY + r * (winH + winGapY);
                const lit = Math.sin(animFrame * 0.02 + r * 3 + c * 7) > -0.3;
                ctx.fillStyle = lit ? COLORS.windowLit : COLORS.windowDim;
                if (lit) {
                    ctx.shadowColor = COLORS.windowLit;
                    ctx.shadowBlur = 6;
                }
                roundRect(ctx, wx, wy, winW, winH, 2);
                ctx.fill();
                ctx.shadowBlur = 0;

                // Window cross
                ctx.strokeStyle = dark;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(wx + winW / 2, wy);
                ctx.lineTo(wx + winW / 2, wy + winH);
                ctx.moveTo(wx, wy + winH / 2);
                ctx.lineTo(wx + winW, wy + winH / 2);
                ctx.stroke();
            }
        }

        // Door
        const doorW = 28;
        const doorH = 38;
        const doorX = x + w / 2 - doorW / 2;
        const doorY = y - doorH;

        ctx.fillStyle = doorColor;
        roundRect(ctx, doorX, doorY, doorW, doorH, 3);
        ctx.fill();

        // Door handle
        ctx.fillStyle = COLORS.moon;
        ctx.beginPath();
        ctx.arc(doorX + doorW - 7, doorY + doorH / 2, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Awning
        ctx.fillStyle = main;
        ctx.beginPath();
        ctx.moveTo(x + 10, y - doorH - 8);
        ctx.lineTo(x + w - 10, y - doorH - 8);
        ctx.lineTo(x + w - 5, y - doorH + 5);
        ctx.lineTo(x + 5, y - doorH + 5);
        ctx.closePath();
        ctx.fill();

        // Awning stripes
        ctx.strokeStyle = light;
        ctx.lineWidth = 1;
        const stripes = 6;
        for (let s = 1; s < stripes; s++) {
            const sx = x + 10 + (w - 20) / stripes * s;
            ctx.beginPath();
            ctx.moveTo(sx, y - doorH - 8);
            ctx.lineTo(sx + 1, y - doorH + 5);
            ctx.stroke();
        }

        // Neon sign
        if (showNeon) {
            const neonAlpha = 0.6 + Math.sin(animFrame * 0.05) * 0.3;
            ctx.shadowColor = neonColor;
            ctx.shadowBlur = 15;
            ctx.strokeStyle = neonColor;
            ctx.globalAlpha = neonAlpha;
            ctx.lineWidth = 2;
            roundRect(ctx, x + 15, y - h + 6, w - 30, 16, 3);
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;

            ctx.font = 'bold 9px Poppins, sans-serif';
            ctx.fillStyle = neonColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('OPEN', x + w / 2, y - h + 14);
        }

        // Ground glow puddle
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + 3, w / 2 + 10, 8, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawCustomerSprite(ctx, x, y, index, time) {
        const clothColor = COLORS.customerClothes[index % COLORS.customerClothes.length];
        const bobY = Math.sin(time * 4 + index * 2) * 2;
        const legSwing = Math.sin(time * 6 + index) * 4;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(x, y + 14, 6, 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Legs
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 2, y + 5);
        ctx.lineTo(x - 2 - legSwing, y + 13);
        ctx.moveTo(x + 2, y + 5);
        ctx.lineTo(x + 2 + legSwing, y + 13);
        ctx.stroke();

        // Body
        ctx.fillStyle = clothColor;
        roundRect(ctx, x - 5, y - 5 + bobY, 10, 12, 3);
        ctx.fill();

        // Head
        ctx.fillStyle = COLORS.customerBody;
        ctx.beginPath();
        ctx.arc(x, y - 10 + bobY, 5, 0, Math.PI * 2);
        ctx.fill();

        // Hair
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(x, y - 12 + bobY, 5, Math.PI, Math.PI * 2);
        ctx.fill();
    }

    function drawLampPost(ctx, x, y) {
        // Pole
        ctx.fillStyle = COLORS.lampPost;
        ctx.fillRect(x - 2, y - 60, 4, 60);

        // Lamp head
        ctx.fillStyle = '#aaa';
        ctx.beginPath();
        ctx.moveTo(x - 8, y - 60);
        ctx.lineTo(x + 8, y - 60);
        ctx.lineTo(x + 5, y - 55);
        ctx.lineTo(x - 5, y - 55);
        ctx.closePath();
        ctx.fill();

        // Glow
        const glowGrad = ctx.createRadialGradient(x, y - 57, 2, x, y - 40, 40);
        glowGrad.addColorStop(0, 'rgba(255, 220, 150, 0.25)');
        glowGrad.addColorStop(1, 'rgba(255, 220, 150, 0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(x, y - 40, 40, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawGameScene(canvas, gameState) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        // Sky gradient
        const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.65);
        skyGrad.addColorStop(0, COLORS.skyGradTop);
        skyGrad.addColorStop(1, COLORS.skyGradBot);
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, h * 0.65);

        // Stars
        for (let i = 0; i < 50; i++) {
            const sx = (42 * (i + 1) * 7) % w;
            const sy = (42 * (i + 1) * 3) % (h * 0.5);
            const sr = ((i % 3) + 1) * 0.4;
            const alpha = 0.2 + Math.sin(animFrame * 0.02 + i) * 0.2 + 0.2;
            ctx.fillStyle = `rgba(255,255,255,${alpha})`;
            ctx.beginPath();
            ctx.arc(sx, sy, sr, 0, Math.PI * 2);
            ctx.fill();
        }

        // Moon
        ctx.fillStyle = COLORS.moon;
        ctx.shadowColor = COLORS.moon;
        ctx.shadowBlur = 30;
        ctx.beginPath();
        ctx.arc(w - 80, 50, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Background buildings silhouettes
        ctx.fillStyle = '#15132a';
        for (let i = 0; i < 8; i++) {
            const bx = i * 120 - 20;
            const bh = 60 + (i * 37 % 80);
            const bw = 80 + (i * 23 % 40);
            ctx.fillRect(bx, h * 0.65 - bh - 45, bw, bh + 45);
        }

        // Street and sidewalk
        const streetY = h * 0.65;
        ctx.fillStyle = COLORS.sidewalk;
        ctx.fillRect(0, streetY, w, 15);

        // Sidewalk lines
        ctx.strokeStyle = COLORS.sidewalkLine;
        ctx.lineWidth = 1;
        for (let i = 0; i < w; i += 30) {
            ctx.beginPath();
            ctx.moveTo(i, streetY);
            ctx.lineTo(i, streetY + 15);
            ctx.stroke();
        }

        ctx.fillStyle = COLORS.street;
        ctx.fillRect(0, streetY + 15, w, h - streetY - 15);

        // Road line
        ctx.strokeStyle = '#4a4a5a';
        ctx.lineWidth = 2;
        ctx.setLineDash([15, 10]);
        ctx.beginPath();
        ctx.moveTo(0, streetY + 15 + (h - streetY - 15) / 2);
        ctx.lineTo(w, streetY + 15 + (h - streetY - 15) / 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Lamp posts
        drawLampPost(ctx, 40, streetY);
        drawLampPost(ctx, w / 2, streetY);
        drawLampPost(ctx, w - 40, streetY);

        // Calculate building positions
        const buildW = 200;
        const buildH = 160;
        const playerBuildX = 70;
        const rivalBuildX = w - 70 - buildW;
        const buildY = streetY;

        // Player venue
        const playerLevel = getVenueLevel(gameState.player);
        drawBuilding(ctx, playerBuildX, buildY, buildW, buildH + playerLevel * 15, 'player', playerLevel, true);

        // Venue name above building
        ctx.font = 'bold 13px Poppins, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = COLORS.playerMain;
        ctx.shadowColor = COLORS.playerMain;
        ctx.shadowBlur = 8;
        ctx.fillText(gameState.player.name, playerBuildX + buildW / 2, buildY - buildH - playerLevel * 15 - 20);
        ctx.shadowBlur = 0;

        // Rival venue
        const rivalLevel = getVenueLevel(gameState.rival);
        drawBuilding(ctx, rivalBuildX, buildY, buildW, buildH + rivalLevel * 15, 'rival', rivalLevel, true);

        ctx.fillStyle = COLORS.rivalMain;
        ctx.shadowColor = COLORS.rivalMain;
        ctx.shadowBlur = 8;
        ctx.fillText(gameState.rival.name, rivalBuildX + buildW / 2, buildY - buildH - rivalLevel * 15 - 20);
        ctx.shadowBlur = 0;

        // Decorations based on upgrades
        if (gameState.player.upgrades.includes('outdoor_seating')) {
            drawOutdoorSeating(ctx, playerBuildX - 10, buildY, 'player');
        }
        if (gameState.rival.upgrades.includes('outdoor_seating')) {
            drawOutdoorSeating(ctx, rivalBuildX + buildW - 30, buildY, 'rival');
        }
        if (gameState.player.upgrades.includes('live_music')) {
            drawMusicNotes(ctx, playerBuildX + buildW / 2, buildY - buildH - 10, 'player');
        }
        if (gameState.rival.upgrades.includes('live_music')) {
            drawMusicNotes(ctx, rivalBuildX + buildW / 2, buildY - buildH - 10, 'rival');
        }

        // Animated customers
        drawAnimatedCustomers(ctx, gameState, streetY, playerBuildX, rivalBuildX, buildW, w);

        // Particles (money, stars, etc.)
        drawParticles(ctx);

        animFrame++;
    }

    function drawOutdoorSeating(ctx, x, y, owner) {
        const color = owner === 'player' ? COLORS.playerDark : COLORS.rivalDark;
        // Table
        ctx.fillStyle = '#5a4a3a';
        ctx.fillRect(x + 5, y - 15, 20, 2);
        ctx.fillRect(x + 13, y - 13, 4, 13);
        // Umbrella
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x + 15, y - 22, 14, Math.PI, Math.PI * 2);
        ctx.fill();
        // Pole
        ctx.fillStyle = '#888';
        ctx.fillRect(x + 14, y - 22, 2, 8);
    }

    function drawMusicNotes(ctx, x, y, owner) {
        const color = owner === 'player' ? COLORS.playerLight : COLORS.rivalLight;
        const t = animFrame * 0.03;
        for (let i = 0; i < 3; i++) {
            const nx = x + Math.sin(t + i * 2) * 15;
            const ny = y - 20 - ((t * 10 + i * 15) % 40);
            const alpha = 1 - ((t * 10 + i * 15) % 40) / 40;
            ctx.font = '12px serif';
            ctx.fillStyle = color;
            ctx.globalAlpha = alpha;
            ctx.textAlign = 'center';
            ctx.fillText(i % 2 === 0 ? '\u266A' : '\u266B', nx, ny);
        }
        ctx.globalAlpha = 1;
    }

    function drawAnimatedCustomers(ctx, gameState, streetY, playerX, rivalX, buildW, canvasW) {
        const time = animFrame * 0.015;

        // Draw waiting customers in the middle
        const midX = canvasW / 2;
        const customerY = streetY + 30;

        // Show customers going to player venue
        for (let i = 0; i < Math.min(gameState.lastRoundPlayerCustomers || 0, 8); i++) {
            const progress = Math.min(1, (animFrame - (gameState.lastActionFrame || 0)) / 60 + i * 0.1);
            const cx = midX + (playerX + buildW / 2 - midX) * easeInOut(Math.min(1, progress));
            const cy = customerY - Math.sin(progress * Math.PI) * 15;
            if (progress < 1) {
                drawCustomerSprite(ctx, cx, cy, i, time);
            }
        }

        // Show customers going to rival venue
        for (let i = 0; i < Math.min(gameState.lastRoundRivalCustomers || 0, 8); i++) {
            const progress = Math.min(1, (animFrame - (gameState.lastActionFrame || 0)) / 60 + i * 0.1);
            const cx = midX + (rivalX + buildW / 2 - midX) * easeInOut(Math.min(1, progress));
            const cy = customerY - Math.sin(progress * Math.PI) * 15;
            if (progress < 1) {
                drawCustomerSprite(ctx, cx, cy, i + 10, time);
            }
        }

        // Ambient wandering people
        for (let i = 0; i < 3; i++) {
            const wx = ((time * 20 + i * 200) % (canvasW + 60)) - 30;
            const wy = streetY + 50 + i * 15;
            drawCustomerSprite(ctx, wx, wy, i + 20, time);
        }
    }

    function getVenueLevel(venue) {
        const upgradeCount = venue.upgrades.length;
        if (upgradeCount >= 6) return 4;
        if (upgradeCount >= 4) return 3;
        if (upgradeCount >= 2) return 2;
        return 1;
    }

    // Particle system
    function spawnParticle(x, y, type) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 3,
            vy: -Math.random() * 3 - 1,
            life: 1,
            decay: 0.02 + Math.random() * 0.01,
            type, // 'money', 'star', 'heart'
            size: 10 + Math.random() * 6,
        });
    }

    function drawParticles(ctx) {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.05;
            p.life -= p.decay;

            if (p.life <= 0) {
                particles.splice(i, 1);
                continue;
            }

            ctx.globalAlpha = p.life;
            ctx.font = `${p.size}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            if (p.type === 'money') {
                ctx.fillStyle = '#ffd166';
                ctx.fillText('$', p.x, p.y);
            } else if (p.type === 'star') {
                ctx.fillStyle = '#ffd166';
                ctx.fillText('\u2605', p.x, p.y);
            } else if (p.type === 'heart') {
                ctx.fillStyle = '#ff6e6e';
                ctx.fillText('\u2665', p.x, p.y);
            }

            ctx.globalAlpha = 1;
        }
    }

    // Venue preview icons for setup screen
    function drawVenuePreview(canvas, type) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        const colors = {
            bar: { main: '#c9884c', dark: '#8a5a2a', accent: '#ffd166' },
            club: { main: '#7f5af0', dark: '#5a3ab0', accent: '#ff6e6e' },
            lounge: { main: '#2cb67d', dark: '#1a7a4a', accent: '#4cc9f0' },
        };

        const c = colors[type];

        // Building
        const bx = 20, by = h - 15, bw = 80, bh = 80;
        ctx.fillStyle = c.dark;
        roundRect(ctx, bx, by - bh, bw, bh, 4);
        ctx.fill();

        // Roof
        ctx.fillStyle = c.main;
        ctx.fillRect(bx - 3, by - bh - 4, bw + 6, 6);

        // Type-specific decorations
        if (type === 'bar') {
            // Beer mug icon
            ctx.font = '24px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('\uD83C\uDF7A', bx + bw / 2, by - bh / 2);
        } else if (type === 'club') {
            // Disco ball / music
            ctx.font = '24px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('\uD83C\uDF89', bx + bw / 2, by - bh / 2);
        } else if (type === 'lounge') {
            // Cocktail
            ctx.font = '24px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('\uD83C\uDF78', bx + bw / 2, by - bh / 2);
        }

        // Windows
        for (let r = 0; r < 2; r++) {
            for (let col = 0; col < 2; col++) {
                ctx.fillStyle = c.accent;
                ctx.globalAlpha = 0.7;
                roundRect(ctx, bx + 10 + col * 35, by - bh + 10 + r * 25, 18, 14, 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;

        // Door
        ctx.fillStyle = c.main;
        roundRect(ctx, bx + bw / 2 - 10, by - 26, 20, 26, 2);
        ctx.fill();

        // Ground
        ctx.fillStyle = '#2a2a3a';
        ctx.fillRect(0, by, w, 15);
    }

    function drawGameOverScene(canvas, won) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        // Background
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, COLORS.skyGradTop);
        grad.addColorStop(1, won ? '#1a3a2a' : '#3a1a1a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Stars / confetti
        for (let i = 0; i < 60; i++) {
            const cx = (42 * (i + 1) * 7) % w;
            const cy = (42 * (i + 1) * 3) % h;
            if (won) {
                // Confetti
                ctx.fillStyle = COLORS.customerClothes[i % COLORS.customerClothes.length];
                ctx.globalAlpha = 0.5 + Math.sin(animFrame * 0.05 + i) * 0.3;
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(animFrame * 0.02 + i);
                ctx.fillRect(-3, -1, 6, 2);
                ctx.restore();
            } else {
                ctx.fillStyle = `rgba(255,255,255,${0.1 + Math.random() * 0.2})`;
                ctx.beginPath();
                ctx.arc(cx, cy, 1, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;

        // Trophy or closed sign
        if (won) {
            ctx.font = '80px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const trophyY = h / 2 + Math.sin(animFrame * 0.03) * 5;
            ctx.fillText('\uD83C\uDFC6', w / 2, trophyY);
        } else {
            // Sad building
            drawBuilding(ctx, w / 2 - 80, h - 20, 160, 140, 'rival', 1, false);
            ctx.font = 'bold 16px Poppins, sans-serif';
            ctx.fillStyle = COLORS.rivalMain;
            ctx.textAlign = 'center';
            ctx.fillText('CLOSED', w / 2, h / 2 - 20);
        }

        animFrame++;
    }

    // Utility: rounded rectangle
    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    function easeInOut(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    function resetAnimState() {
        particles = [];
        animFrame = 0;
    }

    function getAnimFrame() {
        return animFrame;
    }

    return {
        drawTitleScreen,
        drawGameScene,
        drawVenuePreview,
        drawGameOverScene,
        spawnParticle,
        resetAnimState,
        getAnimFrame,
        COLORS,
        getVenueLevel,
    };
})();
