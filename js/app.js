/* ============================================
   VENUE RIVALS - App Controller
   Screen management, UI binding, game loop,
   animation loop, event handling
   ============================================ */

(function () {
    'use strict';

    // === State ===
    let gameState = null;
    let selectedVenueType = null;
    let currentScreen = 'title';
    let animLoopId = null;

    // === DOM References ===
    const screens = {
        title: document.getElementById('title-screen'),
        howToPlay: document.getElementById('how-to-play-screen'),
        setup: document.getElementById('setup-screen'),
        game: document.getElementById('game-screen'),
        gameover: document.getElementById('gameover-screen'),
    };

    const titleCanvas = document.getElementById('title-canvas');
    const gameCanvas = document.getElementById('game-canvas');
    const gameoverCanvas = document.getElementById('gameover-canvas');

    // HUD elements
    const hud = {
        playerName: document.getElementById('hud-player-name'),
        playerMoney: document.getElementById('hud-player-money'),
        playerRep: document.getElementById('hud-player-rep'),
        playerCustomers: document.getElementById('hud-player-customers'),
        playerEarningsFill: document.getElementById('player-earnings-fill'),
        playerEarningsLabel: document.getElementById('player-earnings-label'),
        rivalName: document.getElementById('hud-rival-name'),
        rivalMoney: document.getElementById('hud-rival-money'),
        rivalRep: document.getElementById('hud-rival-rep'),
        rivalCustomers: document.getElementById('hud-rival-customers'),
        rivalEarningsFill: document.getElementById('rival-earnings-fill'),
        rivalEarningsLabel: document.getElementById('rival-earnings-label'),
        turnNumber: document.getElementById('turn-number'),
        customerPool: document.getElementById('customer-pool-count'),
    };

    // Panels
    const actionPanel = document.getElementById('action-panel');
    const actionGrid = document.getElementById('action-grid');
    const eventPanel = document.getElementById('event-panel');
    const eventContent = document.getElementById('event-content');
    const btnContinue = document.getElementById('btn-continue');
    const logEntries = document.getElementById('log-entries');

    // === Screen Management ===
    function switchScreen(name) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        screens[name].classList.add('active');
        currentScreen = name;
    }

    // === Animation Loop ===
    function startAnimLoop() {
        cancelAnimationFrame(animLoopId);
        function loop() {
            if (currentScreen === 'title') {
                Renderer.drawTitleScreen(titleCanvas);
            } else if (currentScreen === 'game' && gameState) {
                Renderer.drawGameScene(gameCanvas, gameState);
            } else if (currentScreen === 'gameover') {
                Renderer.drawGameOverScene(gameoverCanvas, gameState && gameState.winner === 'player');
            }
            animLoopId = requestAnimationFrame(loop);
        }
        loop();
    }

    // === Utility ===
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // === HUD Update ===
    function updateHUD() {
        if (!gameState) return;

        const p = gameState.player;
        const r = gameState.rival;

        hud.playerName.textContent = p.name;
        hud.playerMoney.textContent = Math.round(p.money);
        hud.playerRep.textContent = Math.round(p.reputation);
        hud.playerCustomers.textContent = gameState.lastRoundPlayerCustomers;

        const pPct = Math.min(100, (p.totalEarnings / Game.WIN_EARNINGS) * 100);
        hud.playerEarningsFill.style.width = pPct + '%';
        hud.playerEarningsLabel.textContent = `$${Math.round(p.totalEarnings)} / $${Game.WIN_EARNINGS}`;

        hud.rivalName.textContent = r.name;
        hud.rivalMoney.textContent = Math.round(r.money);
        hud.rivalRep.textContent = Math.round(r.reputation);
        hud.rivalCustomers.textContent = gameState.lastRoundRivalCustomers;

        const rPct = Math.min(100, (r.totalEarnings / Game.WIN_EARNINGS) * 100);
        hud.rivalEarningsFill.style.width = rPct + '%';
        hud.rivalEarningsLabel.textContent = `$${Math.round(r.totalEarnings)} / $${Game.WIN_EARNINGS}`;

        hud.turnNumber.textContent = gameState.turn;
        hud.turnNumber.classList.add('pulse');
        setTimeout(() => hud.turnNumber.classList.remove('pulse'), 500);

        hud.customerPool.textContent = Game.getCustomerPool(gameState);
    }

    // === Game Log ===
    function addLogEntry(text) {
        if (!gameState) return;
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.innerHTML = `<span class="log-turn">T${gameState.turn}</span> ${text}`;
        logEntries.prepend(entry);

        // Keep log manageable
        while (logEntries.children.length > 50) {
            logEntries.removeChild(logEntries.lastChild);
        }
    }

    // === Action Panel ===
    function showActions() {
        actionPanel.style.display = '';
        eventPanel.style.display = 'none';

        const guest = gameState.player.currentGuest;
        const actions = Game.getRoundActions(gameState);
        actionGrid.innerHTML = '';

        if (guest) {
            const guestCard = document.createElement('div');
            guestCard.className = 'action-card';
            guestCard.innerHTML = `
                <span class="action-card-icon">${guest.icon}</span>
                <div class="action-card-name">Round Guest: ${guest.name}</div>
                <div class="action-card-desc">Admit bonus: ${guest.admitRep >= 0 ? '+' : ''}${guest.admitRep} reputation</div>
                <div class="action-card-desc">Ability: ${guest.abilityName} — ${guest.abilityText}</div>
            `;
            actionGrid.appendChild(guestCard);
        }

        actions.forEach(action => {
            const card = document.createElement('div');
            card.className = 'action-card' + (action.enabled ? '' : ' disabled');
            card.innerHTML = `
                <span class="action-card-icon">${action.icon}</span>
                <div class="action-card-name">${action.name}</div>
                <div class="action-card-desc">${action.description}</div>
            `;

            if (action.enabled) {
                card.addEventListener('click', () => executeRound(action.id));
            }

            actionGrid.appendChild(card);
        });
    }

    // === Execute Round ===
    function executeRound(playerActionId) {
        const rivalAction = AI.chooseRoundAction(gameState);

        gameState.lastActionFrame = Renderer.getAnimFrame();
        const results = Game.playRound(gameState, playerActionId, rivalAction);

        showResolution(results);
    }

    // === Resolution Display ===
    function showResolution(results) {
        actionPanel.style.display = 'none';
        eventPanel.style.display = '';

        let html = '';

        // Show round actions, events, and resolution
        results.messages.forEach(msg => {
            if (msg.type === 'actionSummary') {
                html += `<h3>Simultaneous Actions</h3>`;
                msg.details.forEach(d => {
                    const cls = d.includes(gameState.player.name) ? 'highlight-player' : 'highlight-rival';
                    html += `<p class="${cls}">${d}</p>`;
                    addLogEntry(d);
                });
                html += '<hr style="border-color: #333; margin: 12px 0;">';
            }
            if (msg.type === 'event') {
                html += `<h3>\u26A1 ${msg.title}</h3>`;
                html += `<p>${msg.desc}</p>`;
                msg.details.forEach(d => {
                    const cls = d.who === 'player' ? 'highlight-player' :
                                d.who === 'rival' ? 'highlight-rival' : 'highlight-gold';
                    html += `<p class="${cls}">${d.text}</p>`;
                });
                html += '<hr style="border-color: #333; margin: 12px 0;">';
            }
            if (msg.type === 'resolution') {
                html += `<h3>Tonight's Results</h3>`;
                html += `<p><span class="highlight-gold">${msg.pool} customers</span> visited the block.</p>`;
                html += `<p><span class="highlight-player">${gameState.player.name}</span> attracted <strong>${msg.playerCustomers}</strong> customers</p>`;
                html += `<p style="font-size:0.85rem">Revenue: <span class="highlight-green">+$${msg.playerRevenue}</span> | Costs: -$${msg.playerCosts} | Net: <strong>${msg.playerProfit >= 0 ? '+' : ''}$${msg.playerProfit}</strong></p>`;
                html += `<p><span class="highlight-rival">${gameState.rival.name}</span> attracted <strong>${msg.rivalCustomers}</strong> customers</p>`;
                html += `<p style="font-size:0.85rem">Revenue: <span class="highlight-green">+$${msg.rivalRevenue}</span> | Costs: -$${msg.rivalCosts} | Net: <strong>${msg.rivalProfit >= 0 ? '+' : ''}$${msg.rivalProfit}</strong></p>`;

                // Log it
                addLogEntry(`${msg.playerCustomers}/${msg.pool} customers \u2192 you (+$${msg.playerRevenue}), rival (+$${msg.rivalRevenue})`);

                // Spawn money particles
                for (let i = 0; i < Math.min(msg.playerCustomers, 5); i++) {
                    Renderer.spawnParticle(180 + Math.random() * 40, 200, 'money');
                }
            }
        });

        eventContent.innerHTML = html;
        updateHUD();

        // Check game over
        if (gameState.phase === 'gameover') {
            btnContinue.textContent = 'See Results';
            btnContinue.onclick = () => showGameOver();
        } else {
            btnContinue.textContent = 'Next Turn';
            btnContinue.onclick = () => {
                showActions();
                updateHUD();
            };
        }
    }

    // === Game Over ===
    function showGameOver() {
        switchScreen('gameover');

        const won = gameState.winner === 'player';
        const title = document.getElementById('gameover-title');
        const message = document.getElementById('gameover-message');
        const stats = document.getElementById('gameover-stats');

        title.textContent = won ? 'Victory!' : 'Defeated!';
        title.className = won ? 'win' : 'lose';

        if (won) {
            if (gameState.rival.money < -100) {
                message.textContent = `${gameState.rival.name} went bankrupt! Your venue reigns supreme on the block.`;
            } else {
                message.textContent = `${gameState.player.name} became the most successful venue! Congratulations!`;
            }
        } else {
            if (gameState.player.money < -100) {
                message.textContent = `You ran out of money. ${gameState.rival.name} takes over the block.`;
            } else {
                message.textContent = `${gameState.rival.name} outperformed you this time. Better luck next time!`;
            }
        }

        stats.innerHTML = `
            <div class="gameover-stat-card">
                <div class="stat-label">Your Earnings</div>
                <div class="stat-value">$${Math.round(gameState.player.totalEarnings)}</div>
            </div>
            <div class="gameover-stat-card">
                <div class="stat-label">Rival Earnings</div>
                <div class="stat-value">$${Math.round(gameState.rival.totalEarnings)}</div>
            </div>
            <div class="gameover-stat-card">
                <div class="stat-label">Turns Played</div>
                <div class="stat-value">${gameState.turn}</div>
            </div>
            <div class="gameover-stat-card">
                <div class="stat-label">Your Upgrades</div>
                <div class="stat-value">${gameState.player.upgrades.length}</div>
            </div>
        `;
    }

    // === Event Listeners ===
    function setupEventListeners() {
        // Title screen
        document.getElementById('btn-new-game').addEventListener('click', () => {
            switchScreen('setup');
            drawSetupPreviews();
        });

        document.getElementById('btn-how-to-play').addEventListener('click', () => {
            switchScreen('howToPlay');
        });

        document.getElementById('btn-back-to-title').addEventListener('click', () => {
            switchScreen('title');
        });

        // Setup screen
        document.querySelectorAll('.venue-type-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.venue-type-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                selectedVenueType = card.dataset.type;
                checkStartEnabled();
            });
        });

        document.getElementById('venue-name-input').addEventListener('input', checkStartEnabled);

        document.getElementById('btn-start-game').addEventListener('click', () => {
            const rawName = document.getElementById('venue-name-input').value.trim() || 'My Venue';
            startGame(escapeHtml(rawName), selectedVenueType);
        });

        // Game over
        document.getElementById('btn-play-again').addEventListener('click', () => {
            Renderer.resetAnimState();
            switchScreen('title');
        });
    }

    function checkStartEnabled() {
        const nameOk = document.getElementById('venue-name-input').value.trim().length > 0;
        document.getElementById('btn-start-game').disabled = !(nameOk && selectedVenueType);
    }

    function drawSetupPreviews() {
        document.querySelectorAll('.venue-preview').forEach(canvas => {
            Renderer.drawVenuePreview(canvas, canvas.dataset.venue);
        });
    }

    // === Start Game ===
    function startGame(name, type) {
        Renderer.resetAnimState();
        gameState = Game.createGameState(name, type);
        logEntries.innerHTML = '';
        addLogEntry(`Welcome to ${gameState.player.name}! Your rival: ${gameState.rival.name}`);
        addLogEntry('Each round both venues reveal one guest card and choose simultaneously.');

        switchScreen('game');
        updateHUD();
        showActions();
    }

    // === Canvas Resize ===
    function resizeGameCanvas() {
        if (!gameCanvas) return;
        const container = gameCanvas.parentElement;
        if (!container) return;

        // Keep aspect ratio but fit container
        const maxW = Math.min(container.clientWidth - 16, 900);
        const maxH = Math.min(container.clientHeight - 16, 400);
        const aspect = 900 / 400;

        let w = maxW;
        let h = w / aspect;
        if (h > maxH) {
            h = maxH;
            w = h * aspect;
        }

        gameCanvas.style.width = w + 'px';
        gameCanvas.style.height = h + 'px';
    }

    // === Init ===
    function init() {
        setupEventListeners();
        startAnimLoop();
        resizeGameCanvas();

        window.addEventListener('resize', resizeGameCanvas);

        // High DPI canvas support
        [titleCanvas, gameCanvas, gameoverCanvas].forEach(canvas => {
            if (!canvas) return;
            const dpr = window.devicePixelRatio || 1;
            const rect = canvas.getBoundingClientRect();
            // Keep fixed internal resolution for consistent rendering
        });
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
