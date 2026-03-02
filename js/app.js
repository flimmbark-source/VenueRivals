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
    let guestAbilityPopupEl = null;
    let guestAbilityPopupBackdropEl = null;
    let loadoutState = null;
    let multiplayerSession = null;
    let multiplayerMode = 'single';
    let multiplayerRole = 'host';

    const MIN_DECK_SIZE = 4;
    const MAX_DECK_SIZE = 15;
    const ABLY_API_KEY = '_tDhUg.HYf2eA:VPJbNYIBgqUrolL5QzcLSyj4XRCheq3cizKtHVAtGCA';

    const VENUE_POOL_DESC = {
        velvetRoom: 'Protect-and-close stars with lane locks',
        nightMarket: 'Queue sculpting, stash economy, and tags',
        backAlley: 'Outlaw exits, pressure, and complaint traps',
    };

    const VENUE_STYLE_LABEL = {
        money: '\u{1F4B0} Money',
        points: '\u2B50 Points',
        control: '\u{1F6E1} Control',
    };

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

    function isMultiplayer() {
        return multiplayerMode === 'multiplayer';
    }

    function setMultiplayerStatus(text) {
        const el = document.getElementById('multiplayer-status');
        if (el) el.textContent = text;
    }

    function publishState() {
        if (!isMultiplayer() || multiplayerRole !== 'host' || !multiplayerSession || !gameState) return;
        multiplayerSession.publish('state-sync', { gameState, currentMarket });
    }

    function refreshAll() {
        if (!gameState) return;
        renderHouseGrid('player');
        renderHouseGrid('rival');
        renderArrivingGuest('player');
        renderArrivingGuest('rival');
        updateGuestDetail();
        updateVenueStatus('player');
        updateVenueStatus('rival');
        updateHUD();
    }

    function handleRemoteEvent(evt) {
        if (!evt || !evt.type) return;

        if (evt.type === 'state-sync' && evt.payload?.gameState) {
            gameState = evt.payload.gameState;
            currentMarket = evt.payload.currentMarket || currentMarket;
            refreshAll();
            return;
        }

        if (multiplayerRole !== 'host') return;
        if (evt.type !== 'request-action') return;

        const action = evt.payload?.action;
        if (action === 'admit') handleAdmit();
        else if (action === 'ability') handleAbility();
        else if (action === 'close') handleCloseDoor();
        else if (action === 'done-shopping') handleDoneShopping();
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
        guests.forEach((entry) => {
            const guestId = entry.guestId || entry;
            const slot = createGuestSlot(guestId, false);
            slotsEl.appendChild(slot);
        });
    }

    function renderArrivingGuest(who) {
        const player = who === 'player' ? gameState.player : gameState.rival;
        const arrivingEl = document.getElementById(`${who}-arriving`);
        const arrivingKey = `${player.arrivingGuest || 'none'}:${player.doorClosed ? 'closed' : 'open'}:${player.busted ? 'busted' : 'active'}`;

        // Avoid re-building identical DOM every tick so the door card does not visually refresh.
        if (arrivingEl.dataset.renderKey === arrivingKey) {
            return;
        }

        arrivingEl.dataset.renderKey = arrivingKey;
        arrivingEl.innerHTML = '';

        if (player.arrivingGuest && !player.doorClosed) {
            const guest = Game.GUESTS[player.arrivingGuest];
            const card = document.createElement('div');
            card.className = `arriving-guest-card${player.busted ? ' busted' : ''}`;
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

            if (who === 'player' && !player.busted) {
                card.addEventListener('click', () => handleAbility());
            }
            arrivingEl.appendChild(card);

            if (!player.busted) {
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
            statusEl.textContent = '';
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
        if (isMultiplayer() && multiplayerRole === 'join') {
            multiplayerSession?.publish('request-action', { action: 'admit' });
            return;
        }
        if (!gameState || gameState.phase !== 'guest') return;
        const p = gameState.player;
        if (!p.arrivingGuest || p.doorClosed || p.busted) return;

        const venue = Game.VENUES[p.venueId];
        const result = Game.admitGuest(p, venue, gameState.rival, Game.VENUES[gameState.rival.venueId]);
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
        publishState();
    }

    function handleAbility() {
        if (isMultiplayer() && multiplayerRole === 'join') {
            multiplayerSession?.publish('request-action', { action: 'ability' });
            return;
        }
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

        renderHouseGrid('player');
        renderHouseGrid('rival');
        renderArrivingGuest('player');
        renderArrivingGuest('rival');
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
        publishState();
    }

    function handleCloseDoor() {
        if (isMultiplayer() && multiplayerRole === 'join') {
            multiplayerSession?.publish('request-action', { action: 'close' });
            return;
        }
        if (!gameState || gameState.phase !== 'guest') return;
        const p = gameState.player;
        if (p.doorClosed || p.busted) return;

        const venue = Game.VENUES[p.venueId];
        const result = Game.closeDoor(p, venue, gameState.rival);
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
        publishState();
    }

    // === AI Guest Phase ===
    function startAITimer() {
        if (isMultiplayer()) return;
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
            const result = Game.admitGuest(r, rVenue, gameState.player, Game.VENUES[gameState.player.venueId]);
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
            renderHouseGrid('rival');
        } else if (action === 'close') {
            const result = Game.closeDoor(r, rVenue, gameState.player);
            if (result?.pushedOut) {
                animateExitGuest('rival', result.pushedOut);
            }
            renderHouseGrid('rival');
            showFeedback(`${r.name} closed their door`, 'money', 2000);
        }

        renderArrivingGuest('rival');
        renderArrivingGuest('player');
        updateVenueStatus('rival');
        // AI abilities can change player heat/bust state as well, so always refresh player UI.
        updateVenueStatus('player');
        updateGuestDetail();
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
        publishState();
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
        publishState();
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

        if (!isMultiplayer()) {
            const aiBuys = AI.decideBuyPhaseActions(gameState, rivalMarket);
            aiBuys.forEach(guestId => Game.buyGuest(gameState.rival, guestId));

            if (aiBuys.length > 0) {
                const names = aiBuys.map(id => Game.GUESTS[id].name).join(', ');
                showFeedback(`${gameState.rival.name} bought: ${names}`, 'disruption', 3000);
            }
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

        const readOnlyShop = isMultiplayer() && multiplayerRole === 'join';
        currentMarket.forEach(guestId => {
            const guest = Game.GUESTS[guestId];
            const canAfford = !readOnlyShop && gameState.player.money >= guest.cost;

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
        if (isMultiplayer() && multiplayerRole === 'join') {
            multiplayerSession?.publish('request-action', { action: 'done-shopping' });
            showFeedback('Waiting for host to continue…', 'points', 1500);
            return;
        }

        Game.endBuyPhase(gameState);

        if (gameState.phase === 'gameover') {
            showGameOver();
        } else {
            startNewRound();
        }
        publishState();
    }

    // === Game Flow ===
    function startGame(name, venueType, totalRounds) {
        Renderer.resetAnimState();

        // Pick rival
        const venueKeys = Object.keys(Game.VENUES).filter(k => k !== venueType);
        const rivalVenue = venueKeys[Math.floor(Math.random() * venueKeys.length)];
        const rivalName = RIVAL_NAMES[Math.floor(Math.random() * RIVAL_NAMES.length)];

        gameState = Game.createGameState(name, venueType, rivalName, rivalVenue, totalRounds);

        // Override player deck with the loadout deck
        if (loadoutState) {
            gameState.player.fullDeck = [...loadoutState.deck];
            gameState.player.guestList = [...loadoutState.guestList];
        }

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
        publishState();
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

    // === Loadout Management ===
    function getGuestListsForVenue(venueId) {
        return Object.entries(Game.GUEST_LISTS).filter(([, list]) => list.venueId === venueId);
    }

    function getDecksForVenue(venueId) {
        return Object.entries(Game.DECKS).filter(([, deck]) => deck.venueId === venueId);
    }

    function getDefaultDeckId(venueId) {
        const decks = getDecksForVenue(venueId);
        return decks.length ? decks[0][0] : null;
    }

    function applyDeck(deckId) {
        const deck = Game.DECKS[deckId];
        if (!deck) return;
        loadoutState.selectedDeckId = deckId;
        loadoutState.previewDeckId = deckId;
        loadoutState.deck = [...deck.guests];
    }

    function getDefaultGuestListId(venueId) {
        const lists = getGuestListsForVenue(venueId);
        return lists.length ? lists[0][0] : null;
    }

    function applyGuestList(listId) {
        const list = Game.GUEST_LISTS[listId];
        if (!list) return;
        loadoutState.selectedGuestListId = listId;
        loadoutState.previewGuestListId = listId;
        loadoutState.guestList = [...list.guests];
    }

    function initLoadout() {
        const defaultVenue = 'velvetRoom';
        const defaultDeckId = getDefaultDeckId(defaultVenue);
        const defaultGuestListId = getDefaultGuestListId(defaultVenue);
        loadoutState = {
            venueId: defaultVenue,
            deck: defaultDeckId ? [...Game.DECKS[defaultDeckId].guests] : [...Game.VENUES[defaultVenue].startingDeck],
            inventory: [...Game.VENUES[defaultVenue].market],
            selectedDeckId: defaultDeckId,
            previewDeckId: defaultDeckId,
            selectedGuestListId: defaultGuestListId,
            previewGuestListId: defaultGuestListId,
            guestList: defaultGuestListId ? [...Game.GUEST_LISTS[defaultGuestListId].guests] : [...Game.VENUES[defaultVenue].startingDeck],
        };
        selectedVenueType = defaultVenue;
        renderLoadout();
    }

    function renderLoadout() {
        renderLoadoutVenue();
        renderLoadoutDeck();
        renderLoadoutGuestList();
        checkStartEnabled();
    }

    function renderLoadoutVenue() {
        const venue = Game.VENUES[loadoutState.venueId];
        const body = document.getElementById('loadout-venue-body');
        body.innerHTML = `
            <div class="loadout-venue-icon">${venue.emoji}</div>
            <div class="loadout-venue-name">${venue.name}</div>
            <div class="loadout-venue-desc">${venue.desc}</div>
            <div class="loadout-venue-stats">
                <span class="stat-tag">Grid: ${venue.gridSize}</span>
                <span class="stat-tag">Bust: ${venue.bustThreshold}</span>
                <span class="stat-tag">${VENUE_STYLE_LABEL[venue.style]}</span>
            </div>
            <div class="loadout-venue-pool">${VENUE_POOL_DESC[loadoutState.venueId]}</div>
        `;
    }

    function renderLoadoutDeck() {
        const body = document.getElementById('loadout-deck-body');
        const count = loadoutState.deck.length;
        const valid = count >= MIN_DECK_SIZE;
        const selectedDeck = Game.DECKS[loadoutState.selectedDeckId];
        const deckName = selectedDeck ? selectedDeck.name : `${count} card${count !== 1 ? 's' : ''}`;

        const emojis = loadoutState.deck.map(id => Game.GUESTS[id].emoji).join('');

        body.innerHTML = `
            <div class="loadout-deck-count ${valid ? '' : 'invalid'}">${deckName}</div>
            <div class="loadout-deck-preview">${emojis}</div>
            ${!valid ? `<div class="loadout-deck-warning">Need at least ${MIN_DECK_SIZE} cards</div>` : ''}
        `;
    }

    function renderLoadoutGuestList() {
        const body = document.getElementById('loadout-guest-list-body');
        const count = loadoutState.guestList.length;
        const valid = count >= MIN_DECK_SIZE;
        const selectedList = Game.GUEST_LISTS[loadoutState.selectedGuestListId];
        const guestListName = selectedList ? selectedList.name : 'Custom Guest List';
        const emojis = loadoutState.guestList.map(id => Game.GUESTS[id].emoji).join('');

        body.innerHTML = `
            <div class="loadout-deck-count ${valid ? '' : 'invalid'}">${guestListName}</div>
            <div class="loadout-deck-preview">${emojis}</div>
            ${!valid ? `<div class="loadout-deck-warning">Need at least ${MIN_DECK_SIZE} cards</div>` : ''}
        `;
    }

    function openVenueSelect() {
        const overlay = document.getElementById('venue-select-overlay');
        const grid = document.getElementById('venue-select-grid');

        grid.innerHTML = '';
        Object.entries(Game.VENUES).forEach(([id, venue]) => {
            const isEquipped = id === loadoutState.venueId;
            const card = document.createElement('div');
            card.className = 'venue-type-card' + (isEquipped ? ' selected' : '');
            card.dataset.type = id;
            card.innerHTML = `
                <div class="venue-type-emoji">${venue.emoji}</div>
                <div>
                    <h3>${venue.name}${isEquipped ? ' <span class="equipped-badge">EQUIPPED</span>' : ''}</h3>
                    <p>${venue.desc}</p>
                    <div class="venue-stats-preview">
                        <span class="stat-tag">Grid: ${venue.gridSize}</span>
                        <span class="stat-tag">Bust: ${venue.bustThreshold}</span>
                        <span class="stat-tag">${VENUE_STYLE_LABEL[venue.style]}</span>
                    </div>
                    <div class="venue-select-pool">${VENUE_POOL_DESC[id]}</div>
                </div>
            `;

            card.addEventListener('click', () => {
                if (id !== loadoutState.venueId) {
                    loadoutState.venueId = id;
                    applyDeck(getDefaultDeckId(id));
                    loadoutState.inventory = [...venue.market];
                    applyGuestList(getDefaultGuestListId(id));
                    selectedVenueType = id;
                }
                closeVenueSelect();
                renderLoadout();
            });

            grid.appendChild(card);
        });

        overlay.style.display = '';
    }

    function closeVenueSelect() {
        document.getElementById('venue-select-overlay').style.display = 'none';
    }

    function openDeckManage() {
        document.getElementById('deck-manage-overlay').style.display = '';
        renderDeckManage();
    }

    function closeDeckManage() {
        document.getElementById('deck-manage-overlay').style.display = 'none';
        renderLoadout();
    }

    function openGuestListManage() {
        document.getElementById('guest-list-manage-overlay').style.display = '';
        renderGuestListManage();
    }

    function closeGuestListManage() {
        document.getElementById('guest-list-manage-overlay').style.display = 'none';
        renderLoadout();
    }

    function renderDeckManage() {
        const presetsGrid = document.getElementById('deck-presets-grid');
        const badge = document.getElementById('deck-size-badge');
        const decks = getDecksForVenue(loadoutState.venueId);

        badge.textContent = `${decks.length} presets`;
        badge.className = 'deck-size-badge';

        presetsGrid.innerHTML = '';
        decks.forEach(([id, deck]) => {
            const card = document.createElement('div');
            const selected = id === loadoutState.selectedDeckId;
            card.className = 'venue-type-card' + (selected ? ' selected' : '');
            const emojis = deck.guests.map(g => Game.GUESTS[g].emoji).join('');
            card.innerHTML = `
                <div class="guest-list-card-leading">
                    ${selected ? '<span class="equipped-badge">EQUIPPED</span>' : ''}
                    <div class="venue-type-emoji">🃏</div>
                </div>
                <div>
                    <h3>${deck.name}</h3>
                    <p>${deck.description}</p>
                    <div class="venue-stats-preview">
                        <span class="stat-tag">${deck.guests.length} guests</span>
                        <span class="guest-list-card-emojis">${emojis}</span>
                    </div>
                </div>
            `;
            card.addEventListener('click', () => {
                applyDeck(id);
                renderDeckManage();
                checkStartEnabled();
            });
            presetsGrid.appendChild(card);
        });

        renderDeckPreview(loadoutState.selectedDeckId);
    }

    function createDeckManageCard(guestId) {
        const guest = Game.GUESTS[guestId];
        const card = document.createElement('div');
        card.className = 'deck-manage-card tier-' + guest.tier;

        card.innerHTML = `
            <div class="deck-card-visual">
                <span class="deck-card-stat deck-card-heat">🔥 ${guest.heat}</span>
                <span class="deck-card-emoji${guest.ability ? ' has-ability' : ''}">${guest.emoji}</span>
                <span class="deck-card-stat deck-card-money">${guest.money}</span>
                <span class="deck-card-stat deck-card-points">${guest.points}</span>
            </div>
            <div class="deck-card-name${guest.ability ? ' has-ability' : ''}">${guest.name}</div>
            ${guest.ability ? '<div class="deck-card-ability">⚡ ' + guest.ability.name + '</div>' : ''}
        `;

        return card;
    }

    function renderGuestListPreview(listId) {
        const previewGrid = document.getElementById('guest-list-preview-grid');
        const previewEmpty = document.getElementById('guest-list-preview-empty');
        const list = Game.GUEST_LISTS[listId];

        previewGrid.innerHTML = '';
        if (!list) {
            previewEmpty.style.display = '';
            return;
        }

        previewEmpty.style.display = 'none';
        list.guests.forEach((guestId) => {
            const card = createDeckManageCard(guestId);
            card.addEventListener('click', () => showGuestAbilityPopup(guestId));
            previewGrid.appendChild(card);
        });
    }

    function renderDeckPreview(deckId) {
        const previewGrid = document.getElementById('deck-preview-grid');
        const previewEmpty = document.getElementById('deck-preview-empty');
        const deck = Game.DECKS[deckId];

        previewGrid.innerHTML = '';
        if (!deck) {
            previewEmpty.style.display = '';
            return;
        }

        previewEmpty.style.display = 'none';
        deck.guests.forEach((guestId) => {
            const card = createDeckManageCard(guestId);
            card.addEventListener('click', () => showGuestAbilityPopup(guestId));
            previewGrid.appendChild(card);
        });
    }

    function closeGuestAbilityPopup() {
        if (guestAbilityPopupEl) {
            guestAbilityPopupEl.remove();
            guestAbilityPopupEl = null;
        }
        if (guestAbilityPopupBackdropEl) {
            guestAbilityPopupBackdropEl.remove();
            guestAbilityPopupBackdropEl = null;
        }
    }

    function showGuestAbilityPopup(guestId) {
        const guest = Game.GUESTS[guestId];
        if (!guest) return;

        closeGuestAbilityPopup();

        guestAbilityPopupBackdropEl = document.createElement('button');
        guestAbilityPopupBackdropEl.type = 'button';
        guestAbilityPopupBackdropEl.className = 'guest-ability-popup-backdrop';
        guestAbilityPopupBackdropEl.setAttribute('aria-label', 'Close guest ability popup');
        guestAbilityPopupBackdropEl.addEventListener('click', closeGuestAbilityPopup);

        guestAbilityPopupEl = document.createElement('div');
        guestAbilityPopupEl.className = 'guest-ability-popup';

        const abilityHtml = guest.ability
            ? `<div class="guest-ability-popup-title">${guest.ability.icon} ${guest.ability.name}</div>
               <div class="guest-ability-popup-desc">${guest.ability.desc}</div>`
            : '<div class="guest-ability-popup-desc">No special ability.</div>';

        guestAbilityPopupEl.innerHTML = `
            <button type="button" class="guest-ability-popup-close" aria-label="Close">✕</button>
            <div class="guest-ability-popup-name">${guest.emoji} ${guest.name}</div>
            ${abilityHtml}
        `;

        const closeBtn = guestAbilityPopupEl.querySelector('.guest-ability-popup-close');
        if (closeBtn) closeBtn.addEventListener('click', closeGuestAbilityPopup);

        document.body.appendChild(guestAbilityPopupBackdropEl);
        document.body.appendChild(guestAbilityPopupEl);
    }

    function renderGuestListManage() {
        const presetsGrid = document.getElementById('guest-list-presets-grid');
        const badge = document.getElementById('guest-list-size-badge');
        const lists = getGuestListsForVenue(loadoutState.venueId);

        badge.textContent = `${lists.length} presets`;
        badge.className = 'deck-size-badge';

        presetsGrid.innerHTML = '';
        lists.forEach(([id, list]) => {
            const card = document.createElement('div');
            const selected = id === loadoutState.selectedGuestListId;
            card.className = 'venue-type-card' + (selected ? ' selected' : '');
            const emojis = list.guests.map(g => Game.GUESTS[g].emoji).join('');
            card.innerHTML = `
                <div class="guest-list-card-leading">
                    ${selected ? '<span class="equipped-badge">EQUIPPED</span>' : ''}
                    <div class="venue-type-emoji">📜</div>
                </div>
                <div>
                    <h3>${list.name}</h3>
                    <p>${list.description}</p>
                    <div class="venue-stats-preview">
                        <span class="stat-tag">${list.guests.length} guests</span>
                        <span class="guest-list-card-emojis">${emojis}</span>
                    </div>
                </div>
            `;
            card.addEventListener('click', () => {
                applyGuestList(id);
                renderGuestListManage();
                checkStartEnabled();
            });
            presetsGrid.appendChild(card);
        });

        renderGuestListPreview(loadoutState.selectedGuestListId);
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

        // Setup / Loadout
        document.getElementById('loadout-venue-card').addEventListener('click', openVenueSelect);
        document.getElementById('loadout-deck-card').addEventListener('click', openDeckManage);
        document.getElementById('loadout-guest-list-card').addEventListener('click', openGuestListManage);
        document.getElementById('btn-close-venue-select').addEventListener('click', closeVenueSelect);
        document.getElementById('btn-close-deck-manage').addEventListener('click', closeDeckManage);
        document.getElementById('btn-close-guest-list-manage').addEventListener('click', closeGuestListManage);

        // Close overlays on background click
        document.getElementById('venue-select-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeVenueSelect();
        });
        document.getElementById('deck-manage-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeDeckManage();
        });
        document.getElementById('guest-list-manage-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeGuestListManage();
        });

        document.getElementById('venue-name-input').addEventListener('input', checkStartEnabled);

        const modeInput = document.getElementById('game-mode-input');
        const roleInput = document.getElementById('multiplayer-role-input');
        const multiplayerFields = document.getElementById('multiplayer-fields');
        modeInput?.addEventListener('change', () => {
            multiplayerFields.style.display = modeInput.value === 'multiplayer' ? '' : 'none';
        });

        document.getElementById('btn-start-game').addEventListener('click', async () => {
            const rawName = document.getElementById('venue-name-input').value.trim() || 'My Venue';
            const roundCount = parseInt(document.getElementById('round-count-input').value, 10) || Game.TOTAL_ROUNDS;
            multiplayerMode = modeInput?.value || 'single';
            multiplayerRole = roleInput?.value || 'host';

            if (!isMultiplayer()) {
                startGame(escapeHtml(rawName), loadoutState.venueId, roundCount);
                return;
            }

            const roomCode = document.getElementById('room-code-input').value.trim();
            if (!roomCode) {
                setMultiplayerStatus('Room code is required.');
                return;
            }

            try {
                setMultiplayerStatus('Connecting to Ably…');
                multiplayerSession = await Multiplayer.createSession({
                    apiKey: ABLY_API_KEY,
                    roomCode,
                    role: multiplayerRole,
                    onEvent: handleRemoteEvent,
                });
                setMultiplayerStatus('Connected.');

                if (multiplayerRole === 'host') {
                    startGame(escapeHtml(rawName), loadoutState.venueId, roundCount);
                } else {
                    switchScreen('game');
                    setMultiplayerStatus('Connected. Waiting for host…');
                }
            } catch (err) {
                setMultiplayerStatus(err?.message || 'Unable to connect to Ably.');
            }
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
            if (multiplayerSession) { multiplayerSession.close(); multiplayerSession = null; }
            multiplayerMode = 'single';
            document.getElementById('venue-name-input').value = '';
            document.getElementById('round-count-input').value = String(Game.TOTAL_ROUNDS);
            initLoadout();
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

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && guestAbilityPopupEl) {
                closeGuestAbilityPopup();
            }
        });
    }

    function checkStartEnabled() {
        const nameOk = document.getElementById('venue-name-input').value.trim().length > 0;
        const deckOk = loadoutState && loadoutState.deck.length >= MIN_DECK_SIZE;
        const guestListOk = loadoutState && loadoutState.guestList.length >= MIN_DECK_SIZE;
        document.getElementById('btn-start-game').disabled = !(nameOk && deckOk && guestListOk);
    }

    // === Init ===
    function init() {
        initLoadout();
        setupEventListeners();
        startAnimLoop();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
