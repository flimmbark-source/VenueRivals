/* ============================================
   VENUE RIVALS - Portrait Match App Controller
   ============================================ */

(function () {
    'use strict';

    let gameState = null;
    let currentScreen = 'title';
    let selectedVenueType = null;
    let animLoopId = null;
    let rivalTimer = null;

    const screens = {
        title: document.getElementById('title-screen'),
        howToPlay: document.getElementById('how-to-play-screen'),
        setup: document.getElementById('setup-screen'),
        game: document.getElementById('game-screen'),
        gameover: document.getElementById('gameover-screen'),
    };

    const titleCanvas = document.getElementById('title-canvas');
    const gameoverCanvas = document.getElementById('gameover-canvas');

    const ui = {
        roundLabel: document.getElementById('round-number'),
        phaseLabel: document.getElementById('phase-label'),
        pName: document.getElementById('player-name'),
        rName: document.getElementById('rival-name'),
        pPoints: document.getElementById('player-points'),
        rPoints: document.getElementById('rival-points'),
        pMoney: document.getElementById('player-money'),
        rMoney: document.getElementById('rival-money'),
        centerFeed: document.getElementById('center-feed'),
        rivalBoard: document.getElementById('rival-board'),
        playerBoard: document.getElementById('player-board'),
        playerDoor: document.getElementById('player-door-card'),
        rivalDoor: document.getElementById('rival-door-card'),
        playerActions: document.getElementById('player-actions'),
        buyPanel: document.getElementById('buy-panel'),
        buyCards: document.getElementById('buy-cards'),
        buySummary: document.getElementById('buy-summary'),
        btnReady: document.getElementById('btn-ready-next-round'),
        logEntries: document.getElementById('log-entries'),
        tooltip: document.getElementById('icon-tooltip'),
    };

    function switchScreen(name) {
        Object.values(screens).forEach(el => el.classList.remove('active'));
        screens[name].classList.add('active');
        currentScreen = name;
    }

    function startAnimLoop() {
        cancelAnimationFrame(animLoopId);
        function loop() {
            if (currentScreen === 'title') Renderer.drawTitleScreen(titleCanvas);
            if (currentScreen === 'gameover') Renderer.drawGameOverScene(gameoverCanvas, gameState && gameState.winner === 'player');
            animLoopId = requestAnimationFrame(loop);
        }
        loop();
    }

    function addLogEntry(text) {
        if (!gameState) return;
        const div = document.createElement('div');
        div.className = 'log-entry';
        div.innerHTML = `<span class="log-turn">R${gameState.round}</span> ${text}`;
        ui.logEntries.prepend(div);
        while (ui.logEntries.children.length > 80) ui.logEntries.removeChild(ui.logEntries.lastChild);
    }

    function renderIcons(guest) {
        if (!guest) return '';
        const effects = [];
        effects.push({ icon: '⚠️', text: `Adds ${guest.pressure} danger when admitted.` });
        effects.push({ icon: '💵', text: `Gains ${guest.money} money when admitted.` });
        effects.push({ icon: '⭐', text: `Gains ${guest.points} points when admitted.` });
        if (guest.activatable) {
            const effect = Game.getEffectLibrary()[guest.activatable.id];
            effects.push({ icon: effect.icon, text: effect.text });
        }
        return effects.map(e => `<button class="effect-icon" data-tip="${e.text}">${e.icon}</button>`).join('');
    }

    function guestCard(guest, atDoor = false) {
        if (!guest) return `<div class="guest-card empty">${atDoor ? 'Door closed' : 'Empty slot'}</div>`;
        return `
            <div class="guest-card ${atDoor ? 'door' : ''}">
                <div class="guest-visual">${guest.visual}</div>
                <div class="guest-text">
                    <div class="guest-name">${guest.name}</div>
                    <div class="guest-icons">${renderIcons(guest)}</div>
                </div>
            </div>
        `;
    }

    function laneSlots(venueState) {
        const slots = [];
        for (let i = 0; i < venueState.venue.houseSize; i++) {
            const guest = venueState.lane[i];
            slots.push(`<div class="lane-slot">${guest ? guestCard(guest) : '<div class="guest-card empty">Empty</div>'}</div>`);
        }
        return slots.join('');
    }

    function renderVenueBoard(venueState, isPlayer) {
        const status = venueState.busted ? '<span class="status busted">BUSTED</span>' : (venueState.closed ? '<span class="status closed">Closed</span>' : '<span class="status live">Live</span>');
        return `
            <div class="board-head ${isPlayer ? 'player' : 'rival'}">
                <div>
                    <div class="board-name">${venueState.name}</div>
                    <div class="board-sub">${venueState.venue.name}</div>
                </div>
                ${status}
            </div>
            <div class="board-metrics">
                <span>Danger ${venueState.danger}/${venueState.dangerCap}</span>
                <span>Round 💵 ${venueState.roundMoney}</span>
                <span>Round ⭐ ${venueState.roundPoints}</span>
            </div>
            <div class="house-row">
                <button class="door-btn ${isPlayer ? 'player' : 'rival'}" ${isPlayer ? 'id="player-close-door"' : ''}>🚪 Entry</button>
                <div class="lane-grid">${laneSlots(venueState)}</div>
                <div class="exit-door">Exit ➜ ${venueState.exitingGuest ? venueState.exitingGuest.visual : ''}</div>
            </div>
        `;
    }

    function bindTooltipIcons() {
        document.querySelectorAll('.effect-icon').forEach(btn => {
            const show = (ev) => {
                ui.tooltip.textContent = btn.dataset.tip;
                ui.tooltip.style.display = 'block';
                ui.tooltip.style.left = `${ev.clientX}px`;
                ui.tooltip.style.top = `${ev.clientY - 28}px`;
            };
            btn.addEventListener('mouseenter', show);
            btn.addEventListener('mousemove', show);
            btn.addEventListener('mouseleave', () => { ui.tooltip.style.display = 'none'; });
            btn.addEventListener('touchstart', (ev) => {
                const t = ev.touches[0];
                show({ clientX: t.clientX, clientY: t.clientY });
                setTimeout(() => { ui.tooltip.style.display = 'none'; }, 1200);
            }, { passive: true });
        });
    }

    function renderDoorCards() {
        ui.playerDoor.innerHTML = guestCard(gameState.player.doorGuest, true);
        ui.rivalDoor.innerHTML = guestCard(gameState.rival.doorGuest, true);

        if (gameState.phase === 'guest' && !gameState.player.phaseDone) {
            ui.playerDoor.classList.add('clickable');
            ui.playerDoor.onclick = () => doAction('activate');
        } else {
            ui.playerDoor.classList.remove('clickable');
            ui.playerDoor.onclick = null;
        }
    }

    function renderActions() {
        ui.playerActions.innerHTML = '';
        const actions = Game.getActions(gameState, 'player');

        actions.forEach(a => {
            const btn = document.createElement('button');
            btn.className = 'action-btn';
            btn.disabled = !a.enabled;
            btn.textContent = a.name;
            btn.addEventListener('click', () => doAction(a.id));
            ui.playerActions.appendChild(btn);
        });
    }

    function renderBuy() {
        const inBuy = gameState.phase === 'buy';
        ui.buyPanel.style.display = inBuy ? 'block' : 'none';
        if (!inBuy) return;

        ui.buySummary.innerHTML = `
            <strong>Buy Phase:</strong> Spend 💵 money earned this round. Purchases go to future rounds only.<br>
            Money: <span class="highlight-gold">${gameState.player.roundMoney}</span> | Points banked after buy: <span class="highlight-player">${gameState.player.roundPoints}</span>
        `;

        ui.buyCards.innerHTML = '';
        gameState.market.player.forEach(offer => {
            const guest = Game.getGuestData()[offer.guestId];
            const cost = Math.max(1, offer.cost - gameState.player.buyDiscount);
            const card = document.createElement('button');
            card.className = 'buy-card';
            card.disabled = gameState.player.roundMoney < cost;
            card.innerHTML = `
                <div class="buy-top">${guest.visual} ${guest.name}</div>
                <div class="buy-mid">Cost: ${cost} 💵</div>
                <div class="buy-foot">+${guest.money} money / +${guest.points} points / +${guest.pressure} danger</div>
            `;
            card.onclick = () => {
                const res = Game.buyGuest(gameState, 'player', offer.guestId);
                if (res.ok) addLogEntry(`<span class="highlight-player">[You]</span> ${res.message}`);
                renderAll();
            };
            ui.buyCards.appendChild(card);
        });
    }

    function renderHUD() {
        ui.roundLabel.textContent = gameState.round;
        ui.phaseLabel.textContent = gameState.phaseLabel;
        ui.pName.textContent = gameState.player.name;
        ui.rName.textContent = gameState.rival.name;
        ui.pPoints.textContent = gameState.player.totalPoints;
        ui.rPoints.textContent = gameState.rival.totalPoints;
        ui.pMoney.textContent = gameState.player.roundMoney;
        ui.rMoney.textContent = gameState.rival.roundMoney;
    }

    function renderAll() {
        if (!gameState) return;
        renderHUD();
        ui.rivalBoard.innerHTML = renderVenueBoard(gameState.rival, false);
        ui.playerBoard.innerHTML = renderVenueBoard(gameState.player, true);
        renderDoorCards();
        renderActions();
        renderBuy();
        bindTooltipIcons();

        const closeBtn = document.getElementById('player-close-door');
        if (closeBtn) closeBtn.onclick = () => doAction('close');

        if (gameState.phase === 'gameover') {
            showGameOver();
        }
    }

    function doAction(actionId) {
        const msgs = Game.executeAction(gameState, 'player', actionId);
        msgs.forEach(m => addLogEntry(`<span class="highlight-player">[You]</span> ${m}`));
        renderAll();
        maybeHandlePhaseTransitions();
    }

    function runRivalTick() {
        if (!gameState || gameState.phase !== 'guest') return;
        const msgs = AI.runGuestStep(gameState);
        msgs.forEach(m => addLogEntry(`<span class="highlight-rival">[Rival]</span> ${m}`));
        renderAll();
        maybeHandlePhaseTransitions();
    }

    function maybeHandlePhaseTransitions() {
        if (gameState.phase === 'buy') {
            const msgs = AI.runBuyPhase(gameState);
            msgs.forEach(m => addLogEntry(`<span class="highlight-rival">[Rival]</span> ${m}`));
            ui.btnReady.style.display = 'inline-flex';
        } else {
            ui.btnReady.style.display = 'none';
        }

        if (gameState.phase === 'gameover') {
            stopRivalTimer();
            switchScreen('gameover');
        }
    }

    function stopRivalTimer() {
        if (rivalTimer) clearInterval(rivalTimer);
        rivalTimer = null;
    }

    function startRivalTimer() {
        stopRivalTimer();
        rivalTimer = setInterval(runRivalTick, 1300);
    }

    function showGameOver() {
        const won = gameState.winner === 'player';
        switchScreen('gameover');
        document.getElementById('gameover-title').textContent = won ? 'Victory!' : 'Defeated';
        document.getElementById('gameover-message').textContent = `${gameState.player.totalPoints} - ${gameState.rival.totalPoints} final points after ${Game.TOTAL_ROUNDS} rounds.`;
        document.getElementById('gameover-stats').innerHTML = `
            <div class="gameover-stat-card"><div class="stat-label">Your Points</div><div class="stat-value">${gameState.player.totalPoints}</div></div>
            <div class="gameover-stat-card"><div class="stat-label">Rival Points</div><div class="stat-value">${gameState.rival.totalPoints}</div></div>
            <div class="gameover-stat-card"><div class="stat-label">Your Spend</div><div class="stat-value">${gameState.player.totalMoneySpent}</div></div>
            <div class="gameover-stat-card"><div class="stat-label">Rival Spend</div><div class="stat-value">${gameState.rival.totalMoneySpent}</div></div>
        `;
    }

    function startGame(name, venueType) {
        gameState = Game.createGameState(name, venueType);
        ui.logEntries.innerHTML = '';
        addLogEntry('Parallel guest phase started. Admit, activate, or close your door.');
        addLogEntry(`Profile loaded: ${gameState.player.profile.venueName} | Passive: ${gameState.player.profile.passive}`);

        switchScreen('game');
        startRivalTimer();
        renderAll();
    }

    function bindEvents() {
        document.getElementById('btn-new-game').onclick = () => switchScreen('setup');
        document.getElementById('btn-how-to-play').onclick = () => switchScreen('howToPlay');
        document.getElementById('btn-back-to-title').onclick = () => switchScreen('title');

        document.querySelectorAll('.venue-type-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.venue-type-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                selectedVenueType = card.dataset.type;
                checkStartEnabled();
            });
        });

        const input = document.getElementById('venue-name-input');
        input.addEventListener('input', checkStartEnabled);

        document.getElementById('btn-start-game').onclick = () => {
            const name = input.value.trim() || 'House';
            startGame(name, selectedVenueType || 'bar');
        };

        document.getElementById('btn-play-again').onclick = () => {
            stopRivalTimer();
            switchScreen('title');
        };

        ui.btnReady.onclick = () => {
            Game.finalizeBuyPhase(gameState);
            if (gameState.phase === 'guest') {
                addLogEntry(`<span class="highlight-gold">Round ${gameState.round} begins. Shared guest phase is live.</span>`);
            }
            renderAll();
            maybeHandlePhaseTransitions();
        };
    }

    function checkStartEnabled() {
        const hasName = document.getElementById('venue-name-input').value.trim().length > 0;
        document.getElementById('btn-start-game').disabled = !(hasName && selectedVenueType);
    }

    function init() {
        bindEvents();

        document.querySelectorAll('.venue-preview').forEach(canvas => {
            Renderer.drawVenuePreview(canvas, canvas.dataset.venue);
        });
        startAnimLoop();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
