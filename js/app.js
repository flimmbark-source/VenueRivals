/* ============================================
   VENUE RIVALS - App Controller
   Shared live-round push-your-luck flow.
   ============================================ */

(function () {
    'use strict';

    let gameState = null;
    let selectedVenueType = null;
    let currentScreen = 'title';
    let animLoopId = null;

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

    const actionPanel = document.getElementById('action-panel');
    const actionGrid = document.getElementById('action-grid');
    const eventPanel = document.getElementById('event-panel');
    const eventContent = document.getElementById('event-content');
    const btnContinue = document.getElementById('btn-continue');
    const logEntries = document.getElementById('log-entries');

    function switchScreen(name) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        screens[name].classList.add('active');
        currentScreen = name;
    }

    function startAnimLoop() {
        cancelAnimationFrame(animLoopId);
        function loop() {
            if (currentScreen === 'title') Renderer.drawTitleScreen(titleCanvas);
            else if (currentScreen === 'game' && gameState) Renderer.drawGameScene(gameCanvas, gameState);
            else if (currentScreen === 'gameover') Renderer.drawGameOverScene(gameoverCanvas, gameState && gameState.winner === 'player');
            animLoopId = requestAnimationFrame(loop);
        }
        loop();
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function updateHUD() {
        if (!gameState) return;
        const p = gameState.player;
        const r = gameState.rival;

        hud.playerName.textContent = p.name;
        hud.playerMoney.textContent = p.totalScore;
        hud.playerRep.textContent = p.current.limit;
        hud.playerCustomers.textContent = p.current.occupancy;
        hud.playerEarningsFill.style.width = `${Math.min(100, (p.totalScore / 60) * 100)}%`;
        hud.playerEarningsLabel.textContent = `${p.totalScore} pts`;

        hud.rivalName.textContent = r.name;
        hud.rivalMoney.textContent = r.totalScore;
        hud.rivalRep.textContent = r.current.limit;
        hud.rivalCustomers.textContent = r.current.occupancy;
        hud.rivalEarningsFill.style.width = `${Math.min(100, (r.totalScore / 60) * 100)}%`;
        hud.rivalEarningsLabel.textContent = `${r.totalScore} pts`;

        hud.turnNumber.textContent = gameState.round;
        hud.customerPool.textContent = Game.getCustomerPool(gameState);
    }

    function addLogEntry(text) {
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.innerHTML = `<span class="log-turn">R${gameState.round}</span> ${text}`;
        logEntries.prepend(entry);
        while (logEntries.children.length > 50) logEntries.removeChild(logEntries.lastChild);
    }

    function showActions() {
        actionPanel.style.display = gameState.phase === 'gameover' ? 'none' : '';
        eventPanel.style.display = '';
        actionGrid.innerHTML = '';

        Game.getAvailableActions(gameState).forEach(action => {
            const card = document.createElement('div');
            card.className = 'action-card' + (action.enabled ? '' : ' disabled');
            card.innerHTML = `
                <span class="action-card-icon">${action.icon}</span>
                <div class="action-card-name">${action.name}</div>
                <div class="action-card-desc">${action.description}</div>
            `;
            if (action.enabled) card.addEventListener('click', () => executePlayerAction(action.id));
            actionGrid.appendChild(card);
        });
    }

    function executePlayerAction(actionId) {
        Game.executeAction(gameState, 'player', actionId).forEach(m => addLogEntry(`<span class="highlight-player">[You]</span> ${m}`));
        AI.takeParallelStep(gameState).forEach(m => addLogEntry(`<span class="highlight-rival">[Rival]</span> ${m}`));
        renderLiveState();
        showActions();
    }

    function renderGuestCard(guest, label) {
        if (!guest) return '<div class="guest-card empty">No guest at door</div>';
        const ability = guest.ability === 'none' ? 'No ability' : guest.ability;
        return `
            <div class="guest-card">
                <div class="guest-label">${label}</div>
                <div class="guest-name">${guest.name}</div>
                <div class="guest-meta">Pressure +${guest.pressure}</div>
                <div class="guest-meta">Ability: ${ability}</div>
            </div>
        `;
    }

    function renderAdmittedList(admitted) {
        if (!admitted.length) return '<div class="guest-card empty">No admitted guests yet</div>';
        return admitted.map(g => `
            <div class="guest-chip">
                <span>${g.name}</span>
                <span>+${g.pressure}</span>
            </div>
        `).join('');
    }

    function renderLiveState() {
        const p = gameState.player.current;
        const r = gameState.rival.current;
        eventContent.innerHTML = `
            <h3>Round ${gameState.round} - Shared Live Phase</h3>
            <p><span class="highlight-player">You</span>: ${p.occupancy}/${p.limit} pressure ${p.closed ? '(Closed)' : ''} ${p.busted ? ' - BUSTED' : ''}</p>
            <p><span class="highlight-rival">${gameState.rival.name}</span>: ${r.occupancy}/${r.limit} pressure ${r.closed ? '(Closed)' : ''} ${r.busted ? ' - BUSTED' : ''}</p>
            <p>Last scored round: You ${gameState.lastRoundPlayerCustomers} - Rival ${gameState.lastRoundRivalCustomers}</p>

            <div class="guest-zone-grid">
                <div class="guest-zone">
                    <h4>Your Door Guest</h4>
                    ${renderGuestCard(p.doorGuest, 'At Door')}
                </div>
                <div class="guest-zone">
                    <h4>${gameState.rival.name} Door Guest</h4>
                    ${renderGuestCard(r.doorGuest, 'At Door')}
                </div>
            </div>

            <div class="guest-zone-grid">
                <div class="guest-zone">
                    <h4>Your Admitted Guests</h4>
                    <div class="guest-chip-list">
                        ${renderAdmittedList(p.admitted)}
                    </div>
                </div>
                <div class="guest-zone">
                    <h4>${gameState.rival.name} Admitted Guests</h4>
                    <div class="guest-chip-list">
                        ${renderAdmittedList(r.admitted)}
                    </div>
                </div>
            </div>
        `;
        updateHUD();

        if (gameState.phase === 'gameover') {
            btnContinue.textContent = 'See Results';
            btnContinue.onclick = showGameOver;
        } else {
            btnContinue.textContent = 'Continue Live Round';
            btnContinue.onclick = () => {
                showActions();
                updateHUD();
            };
        }
    }

    function showGameOver() {
        switchScreen('gameover');
        const won = gameState.winner === 'player';
        document.getElementById('gameover-title').textContent = won ? 'Victory!' : 'Defeated!';
        document.getElementById('gameover-message').textContent = won
            ? `${gameState.player.name} wins the 3-round showdown.`
            : `${gameState.rival.name} wins the 3-round showdown.`;
        document.getElementById('gameover-stats').innerHTML = `
            <div class="gameover-stat-card"><div class="stat-label">Your Score</div><div class="stat-value">${gameState.player.totalScore}</div></div>
            <div class="gameover-stat-card"><div class="stat-label">Rival Score</div><div class="stat-value">${gameState.rival.totalScore}</div></div>
            <div class="gameover-stat-card"><div class="stat-label">Rounds</div><div class="stat-value">${Game.TOTAL_ROUNDS}</div></div>
            <div class="gameover-stat-card"><div class="stat-label">Rounds Won</div><div class="stat-value">${gameState.player.roundsWon}</div></div>
        `;
    }

    function setupEventListeners() {
        document.getElementById('btn-new-game').addEventListener('click', () => switchScreen('setup'));
        document.getElementById('btn-how-to-play').addEventListener('click', () => switchScreen('howToPlay'));
        document.getElementById('btn-back-to-title').addEventListener('click', () => switchScreen('title'));

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

        document.getElementById('btn-play-again').addEventListener('click', () => {
            Renderer.resetAnimState();
            switchScreen('title');
        });
    }

    function checkStartEnabled() {
        const nameOk = document.getElementById('venue-name-input').value.trim().length > 0;
        document.getElementById('btn-start-game').disabled = !(nameOk && selectedVenueType);
    }

    function startGame(name, type) {
        Renderer.resetAnimState();
        gameState = Game.createGameState(name, type);
        logEntries.innerHTML = '';
        addLogEntry(`Shared rounds started. Admit, activate, close, or bust.`);
        switchScreen('game');
        showActions();
        renderLiveState();
    }

    function init() {
        setupEventListeners();
        startAnimLoop();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
