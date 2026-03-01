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
        COLORS,
    };
})();
