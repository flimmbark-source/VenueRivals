/* ============================================
   VENUE RIVALS - Visual Renderer
   Canvas atmosphere for title, game background,
   and game over screens. Particle system.
   ============================================ */

const Renderer = (() => {

    const COLORS = {
        skyGradTop: '#0d0a2a',
        skyGradBot: '#2a1858',
        moon: '#f0e6c0',
        playerMain: '#4cc9f0',
        playerDark: '#2a7a99',
        playerLight: '#7eddff',
        rivalMain: '#ff6e6e',
        rivalDark: '#aa3333',
        rivalLight: '#ffaaaa',
        windowLit: '#ffd166',
        windowDim: '#2a2840',
        buildingDark: '#1e1e30',
        street: '#2a2a3a',
        sidewalk: '#3a3a50',
        lampPost: '#8a8a9a',
        customerBody: '#e8d5b7',
        customerClothes: ['#ff6e6e', '#4cc9f0', '#ffd166', '#7f5af0', '#2cb67d', '#ff9a5c'],
    };

    let animFrame = 0;
    let particles = [];

    const gameFxState = {
        flashes: [],
        exhale: 0,
        collapse: 0,
        stinger: 0,
    };

    const VENUE_PALETTES = {
        'velvet-noir': { calm: ['#0f1330', '#2b1b50'], warm: ['#1a1f44', '#4b2a6b'], hot: ['#3a234f', '#6a2f59'], critical: ['#180d24', '#5b1b33'] },
        'gold-rush': { calm: ['#171b2e', '#3b2b4f'], warm: ['#2d2445', '#65412f'], hot: ['#4a2c24', '#87522d'], critical: ['#2d1a14', '#a24a22'] },
        'spotlight-pop': { calm: ['#111b34', '#2a2c58'], warm: ['#1f2e56', '#433f7e'], hot: ['#2a2b68', '#664c9d'], critical: ['#1a1637', '#76295b'] },
        'neon-haze': { calm: ['#0c1b2f', '#1a3554'], warm: ['#123054', '#245c7c'], hot: ['#173f5c', '#2d7b8a'], critical: ['#102336', '#1f6f75'] },
        'runway-glow': { calm: ['#121930', '#31224d'], warm: ['#26284d', '#59316f'], hot: ['#40285a', '#8a3c77'], critical: ['#271837', '#982f62'] },
        'grit-smoke': { calm: ['#17161f', '#2f2333'], warm: ['#2d202d', '#4c2f3a'], hot: ['#42242b', '#683431'], critical: ['#251418', '#6f1f22'] },
        'underground-static': { calm: ['#131621', '#262e3f'], warm: ['#222c42', '#364962'], hot: ['#2a3442', '#4f5f75'], critical: ['#141820', '#4a2e4f'] },
        'riot-pulse': { calm: ['#191624', '#2f2442'], warm: ['#2d2236', '#523349'], hot: ['#4a232a', '#7a2f37'], critical: ['#260f13', '#8a1f2d'] },
        neutral: { calm: ['#101a30', '#2a274b'], warm: ['#1d2a49', '#3e3b66'], hot: ['#2a2d4f', '#5d3d65'], critical: ['#181a33', '#6a2f4f'] },
    };

    // === Utility ===
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

    function drawSky(ctx, w, h) {
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, COLORS.skyGradTop);
        grad.addColorStop(1, COLORS.skyGradBot);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

    }

    function drawStars(ctx, w, h, count) {
        for (let i = 0; i < count; i++) {
            const sx = (42 * (i + 1) * 7) % w;
            const sy = (42 * (i + 1) * 3) % (h * 0.7);
            const sr = ((i % 3) + 1) * 0.5;
            const alpha = 0.3 + (Math.sin(animFrame * 0.03 + i) * 0.3 + 0.3);
            ctx.fillStyle = `rgba(255,255,255,${alpha})`;
            ctx.beginPath();
            ctx.arc(sx, sy, sr, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawMoon(ctx, x, y) {
        ctx.fillStyle = COLORS.moon;
        ctx.shadowColor = COLORS.moon;
        ctx.shadowBlur = 30;
        ctx.beginPath();
        ctx.arc(x, y, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    function drawLampPost(ctx, x, y) {
        ctx.fillStyle = COLORS.lampPost;
        ctx.fillRect(x - 2, y - 50, 4, 50);
        ctx.fillStyle = '#aaa';
        ctx.beginPath();
        ctx.moveTo(x - 6, y - 50);
        ctx.lineTo(x + 6, y - 50);
        ctx.lineTo(x + 4, y - 46);
        ctx.lineTo(x - 4, y - 46);
        ctx.closePath();
        ctx.fill();
        const glowGrad = ctx.createRadialGradient(x, y - 48, 2, x, y - 35, 30);
        glowGrad.addColorStop(0, 'rgba(255, 220, 150, 0.2)');
        glowGrad.addColorStop(1, 'rgba(255, 220, 150, 0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(x, y - 35, 30, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawBuilding(ctx, x, y, w, h, color, darkColor) {
        const bGrad = ctx.createLinearGradient(x, y - h, x, y);
        bGrad.addColorStop(0, darkColor);
        bGrad.addColorStop(1, COLORS.buildingDark);
        ctx.fillStyle = bGrad;
        roundRect(ctx, x, y - h, w, h, 4);
        ctx.fill();

        ctx.fillStyle = color;
        ctx.fillRect(x - 2, y - h - 3, w + 4, 5);

        // Windows
        const rows = 3, cols = 3;
        const winW = Math.min(18, (w - 20) / cols - 4);
        const winH = 14;
        const gapX = (w - cols * winW) / (cols + 1);
        const gapY = (h - 30 - rows * winH) / (rows + 1);
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const wx = x + gapX + c * (winW + gapX);
                const wy = y - h + 8 + gapY + r * (winH + gapY);
                const lit = Math.sin(animFrame * 0.02 + r * 3 + c * 7) > -0.3;
                ctx.fillStyle = lit ? COLORS.windowLit : COLORS.windowDim;
                if (lit) { ctx.shadowColor = COLORS.windowLit; ctx.shadowBlur = 5; }
                roundRect(ctx, wx, wy, winW, winH, 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }

        // Door
        const dw = 22, dh = 30;
        ctx.fillStyle = color;
        roundRect(ctx, x + w / 2 - dw / 2, y - dh, dw, dh, 3);
        ctx.fill();
        ctx.fillStyle = COLORS.moon;
        ctx.beginPath();
        ctx.arc(x + w / 2 + dw / 2 - 6, y - dh / 2, 2, 0, Math.PI * 2);
        ctx.fill();

        // Glow puddle
        ctx.fillStyle = `${color}22`;
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + 2, w / 2 + 5, 5, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawCustomerSprite(ctx, x, y, index, time) {
        const clothColor = COLORS.customerClothes[index % COLORS.customerClothes.length];
        const bobY = Math.sin(time * 4 + index * 2) * 2;
        const legSwing = Math.sin(time * 6 + index) * 3;

        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.ellipse(x, y + 12, 5, 2, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 2, y + 4);
        ctx.lineTo(x - 2 - legSwing, y + 11);
        ctx.moveTo(x + 2, y + 4);
        ctx.lineTo(x + 2 + legSwing, y + 11);
        ctx.stroke();

        ctx.fillStyle = clothColor;
        roundRect(ctx, x - 4, y - 4 + bobY, 8, 10, 3);
        ctx.fill();

        ctx.fillStyle = COLORS.customerBody;
        ctx.beginPath();
        ctx.arc(x, y - 8 + bobY, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(x, y - 10 + bobY, 4, Math.PI, Math.PI * 2);
        ctx.fill();
    }

    // === Title Screen ===
    function drawTitleScreen(canvas) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        drawSky(ctx, w, h);
        drawStars(ctx, w, h, 40);

        // Street
        const streetY = h - 40;
        ctx.fillStyle = COLORS.sidewalk;
        ctx.fillRect(0, streetY, w, 6);
        ctx.fillStyle = COLORS.street;
        ctx.fillRect(0, streetY + 6, w, 34);

        ctx.strokeStyle = '#4a4a5a';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 7]);
        ctx.beginPath();
        ctx.moveTo(0, streetY + 22);
        ctx.lineTo(w, streetY + 22);
        ctx.stroke();
        ctx.setLineDash([]);

        // Buildings
        drawBuilding(ctx, 30, streetY, 120, 100, COLORS.playerMain, COLORS.playerDark);
        drawBuilding(ctx, w - 150, streetY, 120, 100, COLORS.rivalMain, COLORS.rivalDark);

        // VS
        ctx.font = 'bold 24px Poppins, sans-serif';
        ctx.fillStyle = COLORS.moon;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(255, 209, 102, 0.5)';
        ctx.shadowBlur = 15;
        ctx.fillText('VS', w / 2, h / 2 - 5);
        ctx.shadowBlur = 0;

        // Walking customers
        const time = animFrame * 0.02;
        for (let i = 0; i < 4; i++) {
            const cx = ((time * 25 + i * 100) % (w + 30)) - 15;
            drawCustomerSprite(ctx, cx, streetY + 20, i, time + i);
        }

        drawLampPost(ctx, 20, streetY);
        drawLampPost(ctx, w / 2, streetY);
        drawLampPost(ctx, w - 20, streetY);

        animFrame++;
    }

    // === Game Over ===
    function drawGameOverScene(canvas, won) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, COLORS.skyGradTop);
        grad.addColorStop(1, won ? '#1a3a2a' : '#3a1a1a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);


        for (let i = 0; i < 50; i++) {
            const cx = (42 * (i + 1) * 7) % w;
            const cy = (42 * (i + 1) * 3) % h;
            if (won) {
                ctx.fillStyle = COLORS.customerClothes[i % COLORS.customerClothes.length];
                ctx.globalAlpha = 0.5 + Math.sin(animFrame * 0.05 + i) * 0.3;
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(animFrame * 0.02 + i);
                ctx.fillRect(-3, -1, 6, 2);
                ctx.restore();
            } else {
                ctx.fillStyle = `rgba(255,255,255,${0.1 + Math.random() * 0.15})`;
                ctx.beginPath();
                ctx.arc(cx, cy, 1, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;

        if (won) {
            ctx.font = '60px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const ty = h / 2 + Math.sin(animFrame * 0.03) * 4;
            ctx.fillText('\u{1F3C6}', w / 2, ty);
        } else {
            drawBuilding(ctx, w / 2 - 60, h - 15, 120, 110, COLORS.rivalMain, COLORS.rivalDark);
            ctx.font = 'bold 14px Poppins, sans-serif';
            ctx.fillStyle = COLORS.rivalMain;
            ctx.textAlign = 'center';
            ctx.fillText('CLOSED', w / 2, h / 2 - 15);
        }

        animFrame++;
    }

    // === Particle System ===
    function spawnParticle(x, y, type) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 3,
            vy: -Math.random() * 3 - 1,
            life: 1,
            decay: 0.02 + Math.random() * 0.01,
            type,
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

            if (p.life <= 0) { particles.splice(i, 1); continue; }

            ctx.globalAlpha = p.life;
            ctx.font = `${p.size}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            if (p.type === 'money') { ctx.fillStyle = '#ffd166'; ctx.fillText('$', p.x, p.y); }
            else if (p.type === 'star') { ctx.fillStyle = '#ffd166'; ctx.fillText('\u2605', p.x, p.y); }
            else if (p.type === 'bust') { ctx.fillStyle = '#ff6e6e'; ctx.fillText('\u{1F4A5}', p.x, p.y); }

            ctx.globalAlpha = 1;
        }
    }

    function getPalette(venueMood, heatBand) {
        const mood = VENUE_PALETTES[venueMood] || VENUE_PALETTES.neutral;
        if (heatBand === 'critical' || heatBand === 'bust') return mood.critical;
        if (heatBand === 'hot') return mood.hot;
        if (heatBand === 'warm') return mood.warm;
        return mood.calm;
    }

    function fitCanvas(canvas) {
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        const w = Math.floor(canvas.clientWidth * dpr);
        const h = Math.floor(canvas.clientHeight * dpr);
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
        }
        return { w, h, dpr };
    }

    function drawNoise(ctx, w, h, amount, tint) {
        const count = Math.floor((w * h) / 8000 * amount);
        ctx.save();
        ctx.fillStyle = tint;
        for (let i = 0; i < count; i++) {
            const x = (Math.random() * w) | 0;
            const y = (Math.random() * h) | 0;
            ctx.globalAlpha = Math.random() * 0.08 * amount;
            ctx.fillRect(x, y, 1 + (Math.random() * 2), 1 + (Math.random() * 2));
        }
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    function drawGameEffects(canvas, presentationState = {}, gameState = null) {
        if (!canvas) return;
        const { w, h } = fitCanvas(canvas);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, w, h);

        const heatBand = presentationState.heatBand || 'calm';
        const venueMood = presentationState.venueMood || 'neutral';
        const pressure = presentationState.pressure || 'none';
        const momentType = presentationState.momentType || 'idle';
        const rivalThreat = presentationState.rivalThreat || 'low';
        const venueId = gameState?.player?.venueId;
        const venue = (typeof Game !== 'undefined' && Game?.VENUES) ? Game.VENUES[venueId] : null;
        const heatCap = (typeof Game !== 'undefined' && Game?.getHeatCapacity && gameState?.player)
            ? Game.getHeatCapacity(venue, gameState.player)
            : (venue?.bustThreshold || 3);
        const heatRatio = Math.max(0, Math.min(1, ((gameState?.player?.heat || 0) / Math.max(1, heatCap || 3))));
        const [top, bottom] = getPalette(venueMood, heatBand);

        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, top);
        grad.addColorStop(1, bottom);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);


        const t = animFrame * 0.01;
        // slow parallax silhouettes
        for (let layer = 0; layer < 3; layer++) {
            const speed = 0.08 + layer * 0.04 + heatRatio * 0.12;
            const yBase = h * (0.66 + layer * 0.09);
            const amp = 12 + layer * 8;
            ctx.fillStyle = `rgba(8, 10, 20, ${0.2 + layer * 0.1})`;
            ctx.beginPath();
            ctx.moveTo(0, h);
            for (let x = 0; x <= w; x += 14) {
                const y = yBase + Math.sin((x * 0.015) + t * speed * 6 + layer) * amp;
                ctx.lineTo(x, y);
            }
            ctx.lineTo(w, h);
            ctx.closePath();
            ctx.fill();
        }

        // drifting dust / smoke
        const particleCount = Math.floor(18 + heatRatio * 70);
        for (let i = 0; i < particleCount; i++) {
            const phase = (animFrame * (0.2 + heatRatio * 0.6) + i * 37) * 0.01;
            const x = ((i * 131 + animFrame * (0.3 + heatRatio)) % (w + 120)) - 60;
            const y = (h * 0.15) + ((Math.sin(phase) * 0.5 + 0.5) * h * 0.8);
            const radius = 1 + ((i % 7) * 0.35) + heatRatio * 2;
            ctx.fillStyle = heatBand === 'calm' ? 'rgba(220,230,255,0.12)' : heatBand === 'warm' ? 'rgba(255,220,180,0.14)' : 'rgba(255,170,150,0.16)';
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }

        if (heatBand === 'hot' || heatBand === 'critical' || heatBand === 'bust') {
            // edge pulse + heat haze
            const pulse = 0.15 + 0.12 * Math.sin(animFrame * 0.17);
            const vignette = ctx.createRadialGradient(w * 0.5, h * 0.55, h * 0.18, w * 0.5, h * 0.55, h * 0.72);
            vignette.addColorStop(0, 'rgba(255,120,90,0)');
            vignette.addColorStop(1, `rgba(255,70,70,${pulse + heatRatio * 0.24})`);
            ctx.fillStyle = vignette;
            ctx.fillRect(0, 0, w, h);

            for (let y = 0; y < h; y += 3) {
                const wobble = Math.sin(y * 0.02 + animFrame * 0.2) * (2 + heatRatio * 4);
                ctx.fillStyle = `rgba(255,255,255,${0.01 + heatRatio * 0.03})`;
                ctx.fillRect(w * 0.1 + wobble, y, w * 0.8, 1);
            }
        }

        if (pressure !== 'none') {
            if (rivalThreat === 'high') {
                const rivalPulse = 0.08 + 0.08 * Math.sin(animFrame * 0.22);
                ctx.fillStyle = `rgba(255,88,88,${rivalPulse})`;
                ctx.fillRect(w * 0.72, 0, w * 0.28, h);
            }
            const sideAlpha = pressure === 'urgent' ? 0.22 : 0.12;
            const left = ctx.createLinearGradient(0, 0, w * 0.2, 0);
            left.addColorStop(0, `rgba(76,201,240,${sideAlpha})`);
            left.addColorStop(1, 'rgba(76,201,240,0)');
            ctx.fillStyle = left;
            ctx.fillRect(0, 0, w * 0.2, h);

            const right = ctx.createLinearGradient(w, 0, w * 0.8, 0);
            right.addColorStop(0, `rgba(255,110,110,${sideAlpha})`);
            right.addColorStop(1, 'rgba(255,110,110,0)');
            ctx.fillStyle = right;
            ctx.fillRect(w * 0.8, 0, w * 0.2, h);
        }

        if (heatBand === 'critical' || heatBand === 'bust') {
            const strobe = 0.07 + 0.08 * (Math.sin(animFrame * 0.5) * 0.5 + 0.5);
            ctx.fillStyle = `rgba(255,170,60,${strobe})`;
            ctx.fillRect(0, 0, w, h * 0.08);
            ctx.fillRect(0, h * 0.92, w, h * 0.08);
            drawNoise(ctx, w, h, 1 + heatRatio * 2, 'rgba(255,255,255,0.5)');
            gameFxState.collapse = Math.min(1, gameFxState.collapse + 0.02);
        } else {
            gameFxState.collapse = Math.max(0, gameFxState.collapse - 0.015);
        }

        // stinger / exhale / collapse flashes from gameplay events
        gameFxState.exhale *= 0.92;
        gameFxState.stinger *= 0.88;
        if (gameFxState.flashes.length) {
            for (let i = gameFxState.flashes.length - 1; i >= 0; i--) {
                const f = gameFxState.flashes[i];
                f.life -= 0.03;
                if (f.life <= 0) { gameFxState.flashes.splice(i, 1); continue; }
                ctx.fillStyle = `rgba(${f.color},${f.life * 0.25})`;
                ctx.fillRect(0, 0, w, h);
            }
        }

        if (gameFxState.stinger > 0.02) {
            ctx.fillStyle = `rgba(255,220,140,${gameFxState.stinger * 0.3})`;
            ctx.fillRect(0, 0, w, h);
        }
        if (gameFxState.exhale > 0.02) {
            ctx.fillStyle = `rgba(120,255,190,${gameFxState.exhale * 0.2})`;
            ctx.fillRect(0, 0, w, h);
        }
        if (gameFxState.collapse > 0.01) {
            ctx.fillStyle = `rgba(10,0,0,${gameFxState.collapse * 0.35})`;
            ctx.fillRect(0, 0, w, h);
        }

        if (momentType === 'rare_admit') {
            const vipCone = ctx.createRadialGradient(w * 0.52, h * 0.44, 4, w * 0.52, h * 0.44, h * 0.34);
            vipCone.addColorStop(0, 'rgba(255,245,200,0.32)');
            vipCone.addColorStop(1, 'rgba(255,245,200,0)');
            ctx.fillStyle = vipCone;
            ctx.fillRect(0, 0, w, h);
        }

        animFrame++;
    }

    function triggerGameEffect(eventName, payload = {}) {
        if (eventName === 'RARE_GUEST_ADMITTED') {
            gameFxState.stinger = Math.min(1, gameFxState.stinger + 0.85);
            gameFxState.flashes.push({ life: 0.9, color: '255,220,120' });
        } else if (eventName === 'RIVAL_SPIKE') {
            gameFxState.flashes.push({ life: 0.7, color: '255,100,100' });
        } else if (eventName === 'ROUND_BANKED') {
            gameFxState.exhale = Math.min(1, gameFxState.exhale + 0.9);
        } else if (eventName === 'ROUND_BUST') {
            gameFxState.collapse = Math.min(1, gameFxState.collapse + 0.95);
            gameFxState.flashes.push({ life: 1, color: '255,255,255' });
        } else if (eventName === 'ABILITY_USED') {
            gameFxState.flashes.push({ life: 0.45, color: payload.who === 'rival' ? '255,110,110' : '120,210,255' });
        }
    }

    function resetAnimState() {
        particles = [];
        animFrame = 0;
    }

    function getAnimFrame() { return animFrame; }

    return {
        drawTitleScreen,
        drawGameOverScene,
        spawnParticle,
        drawParticles,
        resetAnimState,
        getAnimFrame,
        drawGameEffects,
        triggerGameEffect,
        COLORS,
    };
})();
