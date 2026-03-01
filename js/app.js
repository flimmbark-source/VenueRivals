/* ============================================
   VENUE RIVALS - App Controller
   Screen management, game loop, UI binding,
   guest phase, buy phase, animation
   ============================================ */

(function () {
    'use strict';

    // === State ===
    let gameState = null;
    let selectedVenueType = null;
    let currentScreen = 'title';
    let animLoopId = null;
    let aiTimerId = null;
    let currentMarket = null;
    let tooltipEl = null;
    let iconTooltipEl = null;

    // Rival names
    const RIVAL_NAMES = [
        'The Crimson Fox', 'Midnight Ember', 'Velvet Edge',
        'Neon Pulse', 'The Gilded Owl', 'Shadow & Tonic',
    ];

    // === DOM References ===
    const screens = {
        title: document.getElementById('title-screen'),
        howToPlay: document.getElementById('how-to-play-screen'),
        setup: document.getElementById('setup-screen'),
        game: document.getElementById('game-screen'),
    };

    const titleCanvas = document.getElementById('title-canvas');
    const gameoverCanvas = document.getElementById('gameover-canvas');

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
            }
            animLoopId = requestAnimationFrame(loop);
        }
        loop();
    }

    function startGameOverAnim(won) {
        function loop() {
            Renderer.drawGameOverScene(gameoverCanvas, won);
            if (currentScreen === 'game') {
                requestAnimationFrame(loop);
            }
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
        const pVenue = Game.VENUES[p.venueId];
        const rVenue = Game.VENUES[r.venueId];

        document.getElementById('hud-round-num').textContent = gameState.round;
        document.getElementById('hud-round-total').textContent = gameState.totalRounds;
        document.getElementById('hud-phase').textContent =
            gameState.phase === 'guest' ? 'GUEST PHASE' :
            gameState.phase === 'buy' ? 'BUY PHASE' : 'GAME OVER';

        document.getElementById('hud-player-pts').textContent = `You: ${p.points} pts`;
        document.getElementById('hud-rival-pts').textContent = `Rival: ${r.points} pts`;

        // Player venue
        document.getElementById('player-venue-name').textContent = p.name;
        document.getElementById('player-money').textContent = `\u{1F4B0} $${p.money + p.roundMoney}`;
        document.getElementById('player-pts-badge').textContent = `\u2B50 ${p.points + p.roundPoints}`;
        updateHeatBar('player', p.heat, pVenue.bustThreshold);

        // Rival venue
        document.getElementById('rival-venue-name').textContent = r.name;
        document.getElementById('rival-money').textContent = `\u{1F4B0} $${r.money + r.roundMoney}`;
        document.getElementById('rival-pts-badge').textContent = `\u2B50 ${r.points + r.roundPoints}`;
        updateHeatBar('rival', r.heat, rVenue.bustThreshold);
    }

    function updateHeatBar(who, heat, max) {
        const fill = document.getElementById(`${who}-heat-fill`);
        const text = document.getElementById(`${who}-heat-text`);
        const pct = Math.min(100, (heat / max) * 100);
        fill.style.width = pct + '%';
        fill.className = 'heat-fill';
        if (pct > 85) fill.classList.add('critical');
        else if (pct > 70) fill.classList.add('danger');
        else if (pct > 50) fill.classList.add('warning');
        else fill.classList.add('safe');
        text.textContent = `\u{1F525} ${heat}/${max}`;
    }

    // === Guest Slot Rendering ===
    function createGuestSlot(guestId, animate) {
        const guest = Game.GUESTS[guestId];
        const el = document.createElement('div');
        el.className = `guest-slot occupied-slot tier-${guest.tier}`;
        if (animate) el.classList.add('entering');
        el.innerHTML = `
            <span class="slot-stat slot-heat">🔥 ${guest.heat}</span>
            <span class="slot-emoji${guest.ability ? ' has-ability' : ''}">${guest.emoji}</span>
            <span class="slot-stat slot-money">${guest.money}</span>
            <span class="slot-stat slot-points">${guest.points}</span>
        `;
        el.title = `${guest.name} - ${guest.desc}`;
        el.addEventListener('click', (e) => showTooltip(e, guestId));
        return el;
    }

    function renderHouseGrid(who) {
        const player = who === 'player' ? gameState.player : gameState.rival;
        const slotsEl = document.getElementById(`${who}-slots`);
        slotsEl.innerHTML = '';
        const venue = Game.VENUES[player.venueId];

        for (let i = 0; i < venue.gridSize - player.house.length; i++) {
            const empty = document.createElement('div');
            empty.className = 'guest-slot empty-slot';
            slotsEl.appendChild(empty);
        }

        // Render oldest to newest (house[0] is newest, so reverse)
        const guests = [...player.house].reverse();
        guests.forEach((guestId) => {
            const slot = createGuestSlot(guestId, false);
            slotsEl.appendChild(slot);
        });
    }

    function renderArrivingGuest(who) {
        const player = who === 'player' ? gameState.player : gameState.rival;
        const arrivingEl = document.getElementById(`${who}-arriving`);
        arrivingEl.innerHTML = '';

        if (player.arrivingGuest && !player.doorClosed && !player.busted) {
            const guest = Game.GUESTS[player.arrivingGuest];
            const card = document.createElement('div');
            card.className = 'arriving-guest-card';
            card.innerHTML = `
                <span class="arriving-stat arriving-heat">🔥 ${guest.heat}</span>
                <button class="arriving-emoji${guest.ability ? ' has-ability' : ''}" title="${guest.name}">${guest.emoji}</button>
                <span class="arriving-stat arriving-money">${guest.money}</span>
                <span class="arriving-stat arriving-points">${guest.points}</span>
            `;
            card.title = `${guest.name}: ${guest.desc}`;

            const emojiButton = card.querySelector('.arriving-emoji');
            if (emojiButton && guest.ability) {
                const abilityMessage = `${guest.ability.name}: ${guest.ability.desc}`;
                bindAbilityTooltipInteractions(emojiButton, abilityMessage);
            }

            if (who === 'player') {
                card.addEventListener('click', () => handleAbility());
            }
            arrivingEl.appendChild(card);

            const arrow = document.createElement('button');
            arrow.className = 'entry-admit-arrow';
            arrow.innerHTML = '←';
            arrow.title = who === 'player' ? 'Admit guest' : 'Rival can admit this guest';
            if (who === 'player') {
                arrow.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleAdmit();
                });
            } else {
                arrow.disabled = true;
            }
            arrivingEl.appendChild(arrow);
        }
    }

    function updateVenueStatus(who) {
        const player = who === 'player' ? gameState.player : gameState.rival;
        const statusEl = document.getElementById(`${who}-status`);

        if (player.busted) {
            statusEl.textContent = 'BUSTED!';
            statusEl.className = 'venue-status busted';
        } else if (player.doorClosed) {
            statusEl.textContent = 'DOOR CLOSED';
            statusEl.className = 'venue-status closed';
        } else if (player.arrivingGuest) {
            const remaining = player.roundDeck.length + 1;
            statusEl.textContent = `${remaining} guest${remaining !== 1 ? 's' : ''} remaining`;
            statusEl.className = 'venue-status';
        } else {
            statusEl.textContent = '';
            statusEl.className = 'venue-status';
        }
    }

    function animateExitGuest(who, guestId) {
        const exitDoor = document.querySelector(`#${who}-area .exit-door`);
        if (!exitDoor) return;
        const ghost = createGuestSlot(guestId, false);
        ghost.classList.add('exit-ghost');
        const rect = exitDoor.getBoundingClientRect();
        ghost.style.left = `${rect.left + rect.width / 2 - 19}px`;
        ghost.style.top = `${rect.top + rect.height / 2 - 23}px`;
        document.body.appendChild(ghost);
        requestAnimationFrame(() => ghost.classList.add('leaving'));
        setTimeout(() => ghost.remove(), 380);
    }

    // === Guest Detail Panel ===
    function updateGuestDetail() {
        const detailEl = document.getElementById('guest-detail');
        const p = gameState.player;

        if (!p.arrivingGuest || p.doorClosed || p.busted) {
            detailEl.innerHTML = '<div class="guest-detail-empty">' +
                (p.busted ? 'You busted! Round over.' :
                 p.doorClosed ? 'Door closed. Waiting for rival...' :
                 'No more guests.') + '</div>';
            document.getElementById('btn-admit').disabled = true;
            document.getElementById('btn-ability').disabled = true;
            document.getElementById('btn-close-door').disabled = true;
            return;
        }

        const guest = Game.GUESTS[p.arrivingGuest];
        const venue = Game.VENUES[p.venueId];
        const wouldBust = p.heat > venue.bustThreshold;

        let abilityHTML = '';
        if (guest.ability) {
            abilityHTML = `<div class="guest-detail-ability">\u26A1 ${guest.ability.icon} ${guest.ability.name}: ${guest.ability.desc}</div>`;
        }

        detailEl.innerHTML = `
            <div class="guest-detail-content">
                <div class="guest-detail-emoji">${guest.emoji}</div>
                <div class="guest-detail-info">
                    <div class="guest-detail-name">${guest.name}</div>
                    <div class="guest-detail-desc">${guest.desc}</div>
                    <div class="guest-detail-stats">
                        <span class="stat-money">\u{1F4B0} ${guest.money}</span>
                        <span class="stat-points">\u2B50 ${guest.points}</span>
                        <span class="stat-heat${wouldBust ? ' danger' : ''}">\u{1F525} ${guest.heat}${wouldBust ? ' BUST!' : ''}</span>
                    </div>
                    ${abilityHTML}
                </div>
            </div>
        `;

        // Update buttons
        document.getElementById('btn-admit').disabled = false;
        document.getElementById('btn-ability').disabled = !guest.ability;
        document.getElementById('btn-close-door').disabled = false;
    }

    // === Tooltip ===
    function showTooltip(e, guestId) {
        removeTooltip();
        const guest = Game.GUESTS[guestId];
        const el = document.createElement('div');
        el.className = 'guest-tooltip';

        let abilityHTML = '';
        if (guest.ability) {
            abilityHTML = `<div class="tt-ability">\u26A1 ${guest.ability.icon} ${guest.ability.name}: ${guest.ability.desc}</div>`;
        }

        el.innerHTML = `
            <div class="tt-name">${guest.emoji} ${guest.name}</div>
            <div class="tt-desc">${guest.desc}</div>
            <div class="tt-stats">
                <span class="stat-money">\u{1F4B0}${guest.money}</span>
                <span class="stat-points">\u2B50${guest.points}</span>
                <span class="stat-heat">\u{1F525}${guest.heat}</span>
            </div>
            ${abilityHTML}
        `;

        document.body.appendChild(el);
        tooltipEl = el;

        // Position
        const rect = e.target.getBoundingClientRect();
        let left = rect.left + rect.width / 2 - 80;
        let top = rect.top - el.offsetHeight - 8;
        if (top < 10) top = rect.bottom + 8;
        if (left < 10) left = 10;
        if (left + el.offsetWidth > window.innerWidth - 10) {
            left = window.innerWidth - el.offsetWidth - 10;
        }
        el.style.left = left + 'px';
        el.style.top = top + 'px';

        setTimeout(removeTooltip, 2000);
    }

    function removeTooltip() {
        if (tooltipEl) {
            tooltipEl.remove();
            tooltipEl = null;
        }
    }

    function showIconTooltip(e, text, sticky = false) {
        removeIconTooltip();
        const el = document.createElement('div');
        el.className = 'effect-tooltip';
        el.textContent = text;
        document.body.appendChild(el);
        iconTooltipEl = el;

        const rect = e.target.getBoundingClientRect();
        const left = Math.min(window.innerWidth - el.offsetWidth - 10, Math.max(10, rect.left - 10));
        const top = Math.max(10, rect.top - el.offsetHeight - 8);
        el.style.left = `${left}px`;
        el.style.top = `${top}px`;

        if (!sticky) {
            setTimeout(removeIconTooltip, 1600);
        }
    }

    function removeIconTooltip() {
        if (iconTooltipEl) {
            iconTooltipEl.remove();
            iconTooltipEl = null;
        }
    }

    function bindAbilityTooltipInteractions(el, message) {
        if (!el || !message) return;

        let pressTimer = null;
        let didLongPress = false;

        el.addEventListener('mouseenter', (e) => showIconTooltip(e, message));
        el.addEventListener('mouseleave', removeIconTooltip);
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            if (didLongPress) {
                didLongPress = false;
                return;
            }
            showIconTooltip(e, message, true);
        });

        el.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            didLongPress = false;
            pressTimer = setTimeout(() => {
                showIconTooltip(e, message, true);
                didLongPress = true;
                pressTimer = null;
            }, 420);
        }, { passive: true });

        const clearPressTimer = () => {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
        };

        el.addEventListener('touchend', (e) => {
            e.stopPropagation();
            clearPressTimer();
        }, { passive: true });
        el.addEventListener('touchcancel', clearPressTimer, { passive: true });
        el.addEventListener('touchmove', clearPressTimer, { passive: true });
    }

    // === Center Feedback ===
    function showFeedback(text, type, duration) {
        const el = document.getElementById('center-feedback');
        el.innerHTML = `<div class="feedback-msg ${type || ''}">${text}</div>`;
        setTimeout(() => {
            if (el.querySelector('.feedback-msg')?.textContent === text) {
                el.innerHTML = '';
            }
        }, duration || 2000);
    }

    // === Guest Phase Actions ===
    function handleAdmit() {
        if (!gameState || gameState.phase !== 'guest') return;
        const p = gameState.player;
        if (!p.arrivingGuest || p.doorClosed || p.busted) return;

        const venue = Game.VENUES[p.venueId];
        const result = Game.admitGuest(p, venue);
        if (!result) return;

        if (result.pushedOut) {
            animateExitGuest('player', result.pushedOut);
        }
        renderHouseGrid('player');

        renderArrivingGuest('player');
        updateGuestDetail();
        updateVenueStatus('player');
        updateHUD();
        removeTooltip();
        removeIconTooltip();

        if (result.busted) {
            document.getElementById('player-area').classList.add('bust-flash');
            showFeedback('YOU BUSTED!', 'bust', 3000);
            setTimeout(() => {
                document.getElementById('player-area').classList.remove('bust-flash');
            }, 500);
        }

        checkGuestPhaseDone();
    }

    function handleAbility() {
        if (!gameState || gameState.phase !== 'guest') return;
        const p = gameState.player;
        const r = gameState.rival;
        if (!p.arrivingGuest || p.doorClosed || p.busted) return;

        const guest = Game.GUESTS[p.arrivingGuest];
        if (!guest.ability) return;

        const pVenue = Game.VENUES[p.venueId];
        const rVenue = Game.VENUES[r.venueId];
        const result = Game.activateAbility(p, r, pVenue, rVenue);
        if (!result) return;

        showFeedback(`\u26A1 ${result.ability.name}: ${result.effects.join(', ')}`, 'disruption', 2500);

        renderArrivingGuest('player');
        renderHouseGrid('rival');
        updateGuestDetail();
        updateVenueStatus('player');
        updateVenueStatus('rival');
        updateHUD();
        removeTooltip();
        removeIconTooltip();

        // Check if opponent was busted by the ability
        if (r.busted) {
            document.getElementById('rival-area').classList.add('bust-flash');
            setTimeout(() => {
                document.getElementById('rival-area').classList.remove('bust-flash');
            }, 500);
        }

        checkGuestPhaseDone();
    }

    function handleCloseDoor() {
        if (!gameState || gameState.phase !== 'guest') return;
        const p = gameState.player;
        if (p.doorClosed || p.busted) return;

        const venue = Game.VENUES[p.venueId];
        const result = Game.closeDoor(p, venue);
        if (result?.pushedOut) {
            animateExitGuest('player', result.pushedOut);
        }
        renderHouseGrid('player');
        renderArrivingGuest('player');
        updateGuestDetail();
        updateVenueStatus('player');
        updateHUD();
        removeTooltip();
        removeIconTooltip();

        showFeedback('You closed the door safely', 'money', 2000);
        checkGuestPhaseDone();
    }

    // === AI Guest Phase ===
    function startAITimer() {
        if (aiTimerId) clearInterval(aiTimerId);
        const baseDelay = 1200;
        const variance = 600;

        function aiTick() {
            if (!gameState || gameState.phase !== 'guest') {
                clearInterval(aiTimerId);
                aiTimerId = null;
                return;
            }

            const r = gameState.rival;
            if (r.phaseComplete) {
                clearInterval(aiTimerId);
                aiTimerId = null;
                checkGuestPhaseDone();
                return;
            }

            const action = AI.decideGuestAction(gameState);
            if (!action) {
                clearInterval(aiTimerId);
                aiTimerId = null;
                checkGuestPhaseDone();
                return;
            }

            executeAIAction(action);
        }

        aiTimerId = setInterval(aiTick, baseDelay + Math.random() * variance);
    }

    function executeAIAction(action) {
        const r = gameState.rival;
        const p = gameState.player;
        const rVenue = Game.VENUES[r.venueId];
        const pVenue = Game.VENUES[p.venueId];

        if (action === 'admit') {
            const result = Game.admitGuest(r, rVenue);
            if (!result) return;

            if (result.pushedOut) {
                animateExitGuest('rival', result.pushedOut);
            }
            renderHouseGrid('rival');

            if (result.busted) {
                document.getElementById('rival-area').classList.add('bust-flash');
                showFeedback(`${r.name} BUSTED!`, 'bust', 2500);
                setTimeout(() => {
                    document.getElementById('rival-area').classList.remove('bust-flash');
                }, 500);
            }
        } else if (action === 'ability') {
            const result = Game.activateAbility(r, p, rVenue, pVenue);
            if (!result) return;
            showFeedback(`${r.name}: \u26A1 ${result.ability.name}`, 'disruption', 2500);

            // Check if player was busted
            if (p.busted) {
                document.getElementById('player-area').classList.add('bust-flash');
                updateGuestDetail();
                updateVenueStatus('player');
                setTimeout(() => {
                    document.getElementById('player-area').classList.remove('bust-flash');
                }, 500);
            }

            renderHouseGrid('player');
        } else if (action === 'close') {
            const result = Game.closeDoor(r, rVenue);
            if (result?.pushedOut) {
                animateExitGuest('rival', result.pushedOut);
            }
            renderHouseGrid('rival');
            showFeedback(`${r.name} closed their door`, 'money', 2000);
        }

        renderArrivingGuest('rival');
        updateVenueStatus('rival');
        updateHUD();
    }

    // === Phase Transitions ===
    function checkGuestPhaseDone() {
        if (!gameState || gameState.phase !== 'guest') return;
        if (!Game.bothDone(gameState)) return;

        // Both players done - stop AI timer
        if (aiTimerId) { clearInterval(aiTimerId); aiTimerId = null; }

        // Small delay for last animation
        setTimeout(showRoundResults, 600);
    }

    function showRoundResults() {
        Game.endGuestPhase(gameState);
        updateHUD();

        const p = gameState.player;
        const r = gameState.rival;
        const isFinalRound = gameState.round >= gameState.totalRounds;

        let html = `<h3>Round ${gameState.round} Results</h3>`;

        // Player results
        html += `<div class="results-row"><span class="label player-color">${p.name}</span></div>`;
        html += `<div class="results-row"><span class="label">\u{1F4B0} Money earned</span><span class="value ${p.busted ? 'bust-value' : 'positive'}">+$${p.roundMoney}${p.busted ? ' (busted)' : ''}</span></div>`;
        html += `<div class="results-row"><span class="label">\u2B50 Points earned</span><span class="value ${p.busted ? 'bust-value' : 'positive'}">+${p.roundPoints}${p.busted ? ' (busted)' : ''}</span></div>`;

        html += '<div class="results-divider"></div>';

        // Rival results
        html += `<div class="results-row"><span class="label rival-color">${r.name}</span></div>`;
        html += `<div class="results-row"><span class="label">\u{1F4B0} Money earned</span><span class="value ${r.busted ? 'bust-value' : 'positive'}">+$${r.roundMoney}${r.busted ? ' (busted)' : ''}</span></div>`;
        html += `<div class="results-row"><span class="label">\u2B50 Points earned</span><span class="value ${r.busted ? 'bust-value' : 'positive'}">+${r.roundPoints}${r.busted ? ' (busted)' : ''}</span></div>`;

        document.getElementById('results-content').innerHTML = html;
        document.getElementById('btn-next-phase').textContent = isFinalRound ? 'Final Results' : 'Continue to Shop';

        // Show results panel
        document.getElementById('guest-phase-panel').style.display = 'none';
        document.getElementById('round-results-panel').style.display = '';
        document.getElementById('buy-phase-panel').style.display = 'none';
        document.getElementById('gameover-panel').style.display = 'none';
    }

    function handleNextPhase() {
        const isFinalRound = gameState.round >= gameState.totalRounds;

        if (isFinalRound) {
            Game.endBuyPhase(gameState);
            showGameOver();
        } else {
            startBuyPhase();
        }
    }

    // === Buy Phase ===
    function startBuyPhase() {
        gameState.phase = 'buy';
        updateHUD();

        // Generate markets
        const playerMarket = Game.getMarket(gameState.player.venueId);
        const rivalMarket = Game.getMarket(gameState.rival.venueId);

        // AI buys
        const aiBuys = AI.decideBuyPhaseActions(gameState, rivalMarket);
        aiBuys.forEach(guestId => Game.buyGuest(gameState.rival, guestId));

        if (aiBuys.length > 0) {
            const names = aiBuys.map(id => Game.GUESTS[id].name).join(', ');
            showFeedback(`${gameState.rival.name} bought: ${names}`, 'disruption', 3000);
        }

        currentMarket = playerMarket;
        renderShop();

        // Show buy panel
        document.getElementById('guest-phase-panel').style.display = 'none';
        document.getElementById('round-results-panel').style.display = 'none';
        document.getElementById('buy-phase-panel').style.display = '';
        document.getElementById('gameover-panel').style.display = 'none';
    }

    function renderShop() {
        const shopMoney = document.getElementById('shop-money');
        shopMoney.textContent = `\u{1F4B0} $${gameState.player.money}`;

        const grid = document.getElementById('shop-grid');
        grid.innerHTML = '';

        currentMarket.forEach(guestId => {
            const guest = Game.GUESTS[guestId];
            const canAfford = gameState.player.money >= guest.cost;

            const card = document.createElement('div');
            card.className = 'shop-card' + (canAfford ? '' : ' disabled');

            card.innerHTML = `
                <div class="shop-card-visual">
                    <span class="shop-card-stat shop-card-heat">🔥 ${guest.heat}</span>
                    <button class="shop-card-emoji${guest.ability ? ' has-ability' : ''}" title="${guest.name}">${guest.emoji}</button>
                    <span class="shop-card-stat shop-card-money">${guest.money}</span>
                    <span class="shop-card-stat shop-card-points">${guest.points}</span>
                </div>
                <div class="shop-card-name${guest.ability ? ' has-ability' : ''}">${guest.name}</div>
                <div class="shop-card-cost">$${guest.cost}</div>
            `;

            const shopEmoji = card.querySelector('.shop-card-emoji');
            if (shopEmoji && guest.ability) {
                const abilityMessage = `${guest.ability.name}: ${guest.ability.desc}`;
                bindAbilityTooltipInteractions(shopEmoji, abilityMessage);
            }

            if (canAfford) {
                card.addEventListener('click', () => {
                    if (Game.buyGuest(gameState.player, guestId)) {
                        showFeedback(`Bought ${guest.name}!`, 'money', 1500);
                        renderShop();
                        updateHUD();
                    }
                });
            }

            grid.appendChild(card);
        });
    }

    function handleDoneShopping() {
        Game.endBuyPhase(gameState);

        if (gameState.phase === 'gameover') {
            showGameOver();
        } else {
            startNewRound();
        }
    }

    // === Game Flow ===
    function startGame(name, venueType, totalRounds) {
        Renderer.resetAnimState();

        // Pick rival
        const venueKeys = Object.keys(Game.VENUES).filter(k => k !== venueType);
        const rivalVenue = venueKeys[Math.floor(Math.random() * venueKeys.length)];
        const rivalName = RIVAL_NAMES[Math.floor(Math.random() * RIVAL_NAMES.length)];

        gameState = Game.createGameState(name, venueType, rivalName, rivalVenue, totalRounds);

        switchScreen('game');
        startNewRound();
    }

    function startNewRound() {
        Game.startGuestPhase(gameState);

        showFeedback(`ROUND ${gameState.round}`, 'points', 1500);

        // Reset UI
        document.getElementById('guest-phase-panel').style.display = '';
        document.getElementById('round-results-panel').style.display = 'none';
        document.getElementById('buy-phase-panel').style.display = 'none';
        document.getElementById('gameover-panel').style.display = 'none';

        renderHouseGrid('player');
        renderHouseGrid('rival');
        renderArrivingGuest('player');
        renderArrivingGuest('rival');
        updateGuestDetail();
        updateVenueStatus('player');
        updateVenueStatus('rival');
        updateHUD();

        // Start AI
        setTimeout(() => startAITimer(), 800);
    }

    // === Game Over ===
    function showGameOver() {
        const won = gameState.winner === 'player';
        const p = gameState.player;
        const r = gameState.rival;

        document.getElementById('hud-phase').textContent = 'GAME OVER';

        const title = document.getElementById('gameover-title');
        title.textContent = won ? 'Victory!' : 'Defeated!';
        title.className = won ? 'win' : 'lose';

        document.getElementById('gameover-message').textContent = won
            ? `${p.name} dominated the scene! Congratulations!`
            : `${r.name} outscored you. Better luck next time!`;

        document.getElementById('gameover-stats').innerHTML = `
            <div class="gameover-stat-card">
                <div class="stat-label">Your Points</div>
                <div class="stat-value player-color">${p.points}</div>
            </div>
            <div class="gameover-stat-card">
                <div class="stat-label">Rival Points</div>
                <div class="stat-value rival-color">${r.points}</div>
            </div>
            <div class="gameover-stat-card">
                <div class="stat-label">Your Deck</div>
                <div class="stat-value">${p.fullDeck.length} guests</div>
            </div>
            <div class="gameover-stat-card">
                <div class="stat-label">Rival Deck</div>
                <div class="stat-value">${r.fullDeck.length} guests</div>
            </div>
        `;

        // Show game over panel
        document.getElementById('guest-phase-panel').style.display = 'none';
        document.getElementById('round-results-panel').style.display = 'none';
        document.getElementById('buy-phase-panel').style.display = 'none';
        document.getElementById('gameover-panel').style.display = '';

        startGameOverAnim(won);
    }

    // === Event Listeners ===
    function setupEventListeners() {
        // Title
        document.getElementById('btn-new-game').addEventListener('click', () => {
            switchScreen('setup');
        });
        document.getElementById('btn-how-to-play').addEventListener('click', () => {
            switchScreen('howToPlay');
        });
        document.getElementById('btn-back-to-title').addEventListener('click', () => {
            switchScreen('title');
        });

        // Setup
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
            const roundCount = parseInt(document.getElementById('round-count-input').value, 10) || Game.TOTAL_ROUNDS;
            startGame(escapeHtml(rawName), selectedVenueType, roundCount);
        });

        // Guest phase controls
        document.getElementById('btn-admit').addEventListener('click', handleAdmit);
        document.getElementById('btn-ability').addEventListener('click', handleAbility);
        document.getElementById('btn-close-door').addEventListener('click', handleCloseDoor);

        // Player door click to close
        document.getElementById('player-door').addEventListener('click', handleCloseDoor);

        // Round results
        document.getElementById('btn-next-phase').addEventListener('click', handleNextPhase);

        // Buy phase
        document.getElementById('btn-done-shopping').addEventListener('click', handleDoneShopping);

        // Game over
        document.getElementById('btn-play-again').addEventListener('click', () => {
            if (aiTimerId) { clearInterval(aiTimerId); aiTimerId = null; }
            Renderer.resetAnimState();
            gameState = null;
            currentMarket = null;
            selectedVenueType = null;
            document.querySelectorAll('.venue-type-card').forEach(c => c.classList.remove('selected'));
            document.getElementById('venue-name-input').value = '';
            document.getElementById('round-count-input').value = String(Game.TOTAL_ROUNDS);
            document.getElementById('btn-start-game').disabled = true;
            switchScreen('title');
        });

        // Remove tooltip on any click outside
        document.addEventListener('click', (e) => {
            if (tooltipEl && !e.target.closest('.guest-slot') && !e.target.closest('.guest-tooltip')) {
                removeTooltip();
            }
            if (iconTooltipEl && !e.target.closest('.arriving-emoji.has-ability') && !e.target.closest('.shop-card-emoji.has-ability') && !e.target.closest('.effect-tooltip')) {
                removeIconTooltip();
            }
        });
    }

    function checkStartEnabled() {
        const nameOk = document.getElementById('venue-name-input').value.trim().length > 0;
        document.getElementById('btn-start-game').disabled = !(nameOk && selectedVenueType);
    }

    // === Init ===
    function init() {
        setupEventListeners();
        startAnimLoop();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
