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
    let selectedGridGuest = null;
    // cache the last rendered guest detail to avoid unnecessary refreshes
    let _lastGuestDetailKey = null;
    let multiplayerSession = null;
    let multiplayerMode = 'single';
    let multiplayerRole = 'host';
    let waitingPopupEl = null;
    let waitingPopupBackdropEl = null;
    let pendingHostMatchConfig = null;
    const revealDoorIntel = { player: null, rival: null };
    const venueActors = { player: new Map(), rival: new Map() };
    let actorAnimTimer = null;
    let activePartyView = 'player';
    let swipeStartX = null;
    let playerFlashWindowInstanceId = null;

    const ACTOR_TICK_MS = 50;
    const ACTOR_MIN_SPEED = 0.65;
    const ACTOR_DISTANCE_SPEED_FACTOR = 0.065;
    const ACTOR_MAX_SPEED = 4.2;

    const MIN_DECK_SIZE = 4;
    const MAX_DECK_SIZE = 15;
    const ABLY_API_KEY = '_tDhUg.HYf2eA:VPJbNYIBgqUrolL5QzcLSyj4XRCheq3cizKtHVAtGCA';

    const VENUE_POOL_DESC = {
        velvetRoom: 'Lock stars in place and close at the right moment',
        nightMarket: 'Peek at the queue, bounce and score smart',
        backAlley: 'Push guests out, taunt opponents, stay cool',
    };

    const VENUE_STYLE_LABEL = {
        money: '\u{1F4B5}U+ Money',
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

    function showWaitingPopup(message) {
        closeWaitingPopup();
        waitingPopupBackdropEl = document.createElement('div');
        waitingPopupBackdropEl.className = 'multiplayer-popup-backdrop';
        waitingPopupEl = document.createElement('div');
        waitingPopupEl.className = 'multiplayer-popup';
        waitingPopupEl.textContent = message;
        document.body.appendChild(waitingPopupBackdropEl);
        document.body.appendChild(waitingPopupEl);
    }

    function updateWaitingPopup(message) {
        if (!waitingPopupEl) return;
        waitingPopupEl.textContent = message;
    }

    function closeWaitingPopup() {
        if (waitingPopupEl) {
            waitingPopupEl.remove();
            waitingPopupEl = null;
        }
        if (waitingPopupBackdropEl) {
            waitingPopupBackdropEl.remove();
            waitingPopupBackdropEl = null;
        }
    }

    function publishState() {
        if (!isMultiplayer() || multiplayerRole !== 'host' || !multiplayerSession || !gameState) return;
        multiplayerSession.publish('state-sync', { gameState, currentMarket });
    }

    function getLocalMarket() {
        if (!Array.isArray(currentMarket) && currentMarket && typeof currentMarket === 'object') {
            const marketForRole = multiplayerRole === 'join' ? currentMarket.rival : currentMarket.player;
            return Array.isArray(marketForRole) ? marketForRole : [];
        }
        return Array.isArray(currentMarket) ? currentMarket : [];
    }

    function syncPanelsForState() {
        if (!gameState) return;

        if (gameState.phase === 'buy') {
            document.getElementById('guest-phase-panel').style.display = 'none';
            document.getElementById('round-results-panel').style.display = 'none';
            document.getElementById('buy-phase-panel').style.display = '';
            document.getElementById('gameover-panel').style.display = 'none';
            renderShop();
            setPhoneBuyPhaseLayout(true);
            return;
        }

        if (gameState.phase === 'gameover') {
            document.getElementById('guest-phase-panel').style.display = 'none';
            document.getElementById('round-results-panel').style.display = 'none';
            document.getElementById('buy-phase-panel').style.display = 'none';
            document.getElementById('gameover-panel').style.display = '';
            setPhoneBuyPhaseLayout(false);
            return;
        }

        if (Game.bothDone(gameState)) {
            document.getElementById('guest-phase-panel').style.display = 'none';
            document.getElementById('round-results-panel').style.display = '';
            document.getElementById('buy-phase-panel').style.display = 'none';
            document.getElementById('gameover-panel').style.display = 'none';
            // If buy phase has already started (results being shown before shop opens), keep compact HUD.
            setPhoneBuyPhaseLayout(gameState.phase === 'buy');
            return;
        }

        document.getElementById('guest-phase-panel').style.display = '';
        document.getElementById('round-results-panel').style.display = 'none';
        document.getElementById('buy-phase-panel').style.display = 'none';
        document.getElementById('gameover-panel').style.display = 'none';
        setPhoneBuyPhaseLayout(false);
    }

    function setPhoneBuyPhaseLayout(isBuyPhase) {
        const phoneScreenEl = document.querySelector('#phone-hud .phone-screen');
        if (!phoneScreenEl) return;
        phoneScreenEl.classList.toggle('buy-phase-compact', !!isBuyPhase);
    }

    function mapStateToJoinPerspective(state) {
        if (!state || multiplayerRole !== 'join') return state;

        const winner = state.winner === 'player'
            ? 'rival'
            : state.winner === 'rival'
                ? 'player'
                : state.winner;

        return {
            ...state,
            player: state.rival,
            rival: state.player,
            winner,
        };
    }

    function refreshAll() {
        if (!gameState) return;
        syncSelectedGridGuest();
        syncPanelsForState();
        renderHouseGrid('player');
        renderHouseGrid('rival');
        renderArrivingGuest('player');
        renderArrivingGuest('rival');
        updateGuestDetail();
        updateVenueStatus('player');
        updateVenueStatus('rival');
        updateHUD();
        applyPartyView(false);
    }


    function applyPartyView(animate = true) {
        const track = document.getElementById('party-track');
        if (!track) return;
        track.style.transition = animate ? 'transform 0.28s ease' : 'none';
        track.style.transform = activePartyView === 'player' ? 'translateX(0%)' : 'translateX(-50%)';

        const playerBtn = document.getElementById('btn-view-player');
        const rivalBtn = document.getElementById('btn-view-rival');
        playerBtn?.classList.toggle('active', activePartyView === 'player');
        rivalBtn?.classList.toggle('active', activePartyView === 'rival');
    }

    function setPartyView(view, animate = true) {
        if (view !== 'player' && view !== 'rival') return;
        activePartyView = view;
        applyPartyView(animate);
    }

    function bindPartyCarouselInteractions() {
        const carousel = document.getElementById('party-carousel');
        if (!carousel) return;

        carousel.addEventListener('touchstart', (e) => {
            if (!e.touches?.length) return;
            swipeStartX = e.touches[0].clientX;
        }, { passive: true });

        carousel.addEventListener('touchend', (e) => {
            if (swipeStartX == null || !e.changedTouches?.length) return;
            const deltaX = e.changedTouches[0].clientX - swipeStartX;
            swipeStartX = null;
            if (Math.abs(deltaX) < 40) return;
            if (deltaX < 0) setPartyView('rival');
            else setPartyView('player');
        }, { passive: true });

        document.getElementById('btn-view-player')?.addEventListener('click', () => setPartyView('player'));
        document.getElementById('btn-view-rival')?.addEventListener('click', () => setPartyView('rival'));
    }

    function syncSelectedGridGuest() {
        if (!gameState) {
            selectedGridGuest = null;
            return;
        }
        const p = gameState.player;
        if (!p.arrivingGuest || p.doorClosed || p.busted) {
            selectedGridGuest = null;
            return;
        }
        if (!selectedGridGuest) {
            selectedGridGuest = { guestId: p.arrivingGuest, source: 'arriving' };
            return;
        }
        if (selectedGridGuest.source === 'arriving' && selectedGridGuest.guestId !== p.arrivingGuest) {
            selectedGridGuest = { guestId: p.arrivingGuest, source: 'arriving' };
            return;
        }
        if (selectedGridGuest.source === 'house') {
            const inHouse = p.house.some((entry) => {
                if (selectedGridGuest.instanceId != null && typeof entry !== 'string') {
                    return entry.instanceId === selectedGridGuest.instanceId;
                }
                return (entry.guestId || entry) === selectedGridGuest.guestId;
            });
            if (!inHouse) {
                selectedGridGuest = { guestId: p.arrivingGuest, source: 'arriving' };
            }
        }
    }


    function refreshSelectedGridSlotVisual() {
        const slotsEl = document.getElementById('player-slots');
        if (!slotsEl) return;

        slotsEl.querySelectorAll('.guest-slot.selected').forEach((slot) => slot.classList.remove('selected'));
        if (!selectedGridGuest) return;

        const occupiedSlots = slotsEl.querySelectorAll('.occupied-slot[data-guest-id]');
        occupiedSlots.forEach((slot) => {
            const sameSource = (slot.dataset.slotSource || '') === selectedGridGuest.source;
            const sameGuest = (slot.dataset.guestId || '') === selectedGridGuest.guestId;
            if (!sameSource || !sameGuest) return;

            if (selectedGridGuest.source === 'house' && selectedGridGuest.instanceId != null) {
                if ((slot.dataset.instanceId || '') !== String(selectedGridGuest.instanceId)) return;
            }
            slot.classList.add('selected');
        });
    }

    function handleRemoteEvent(evt) {
        if (!evt || !evt.type) return;

        if (evt.type === 'player-joined' && multiplayerRole === 'host' && pendingHostMatchConfig) {
            const profile = evt.payload?.profile || {};
            updateWaitingPopup('Connected!');
            setMultiplayerStatus('Connected! Starting match...');
            startGame(pendingHostMatchConfig.name, pendingHostMatchConfig.venueType, pendingHostMatchConfig.totalRounds, {
                rivalName: profile.name || 'Challenger',
                rivalVenue: profile.venueId,
                rivalDeck: profile.deck,
                rivalGuestList: profile.guestList,
            });
            multiplayerSession?.publish('match-start', {
                hostConfig: pendingHostMatchConfig,
                stateSnapshot: gameState,
                marketSnapshot: currentMarket,
            });
            pendingHostMatchConfig = null;
            setTimeout(closeWaitingPopup, 700);
            return;
        }

        if (evt.type === 'match-start' && multiplayerRole === 'join') {
            closeWaitingPopup();
            const hostConfig = evt.payload?.hostConfig;
            if (!hostConfig) return;
            const localName = document.getElementById('venue-name-input')?.value.trim() || 'My Venue';
            startGame(escapeHtml(localName), loadoutState?.venueId || hostConfig.venueType, hostConfig.totalRounds, {
                rivalName: hostConfig.name,
                rivalVenue: hostConfig.venueType,
            });

            if (evt.payload?.stateSnapshot) {
                gameState = mapStateToJoinPerspective(evt.payload.stateSnapshot);
                currentMarket = evt.payload.marketSnapshot || currentMarket;
                refreshAll();
            }

            setMultiplayerStatus('Connected!');
            return;
        }

        if (evt.type === 'state-sync' && evt.payload?.gameState) {
            const incoming = mapStateToJoinPerspective(evt.payload.gameState);
            const prevPlayerKey = gameState ? `${gameState.player.arrivingGuest || ''}|${gameState.player.doorClosed}|${gameState.player.busted}|${gameState.player.heat}|${gameState.player.roundMoney}|${gameState.player.roundPoints}|${gameState.player.house.length}` : null;
            const prevRivalKey = gameState ? `${gameState.rival.arrivingGuest || ''}|${gameState.rival.doorClosed}|${gameState.rival.busted}|${gameState.rival.heat}|${gameState.rival.house.length}` : null;
            const prevPhase = gameState ? gameState.phase : null;
            const newPlayerKey = `${incoming.player.arrivingGuest || ''}|${incoming.player.doorClosed}|${incoming.player.busted}|${incoming.player.heat}|${incoming.player.roundMoney}|${incoming.player.roundPoints}|${incoming.player.house.length}`;
            const newRivalKey = `${incoming.rival.arrivingGuest || ''}|${incoming.rival.doorClosed}|${incoming.rival.busted}|${incoming.rival.heat}|${incoming.rival.house.length}`;

            gameState = incoming;
            currentMarket = evt.payload.currentMarket || currentMarket;

            // Only sync panels if phase actually changed (can trigger layout recalcs)
            if (prevPhase !== gameState.phase) {
                syncPanelsForState();
            }

            // Only update HUD if game structure or round changed
            if (prevRivalKey !== newRivalKey || prevPhase !== gameState.phase) {
                updateHUD();
            }

            // Only re-render rival UI if their state actually changed
            if (prevRivalKey !== newRivalKey) {
                renderHouseGrid('rival');
                updateVenueStatus('rival');
            }

            // Only re-render player UI if their state actually changed
            if (prevPlayerKey !== newPlayerKey) {
                renderHouseGrid('player');
                renderArrivingGuest('player');
                updateGuestDetail();
                updateVenueStatus('player');
            }
            return;
        }

        if (multiplayerRole !== 'host') return;
        if (evt.type !== 'request-action') return;

        const action = evt.payload?.action;
        const actor = evt.payload?.actor || 'rival';
        if (action === 'admit') runAdmit(actor);
        else if (action === 'ability') runAbility(actor);
        else if (action === 'close') runCloseDoor(actor);
        else if (action === 'done-shopping') runDoneShopping(actor);
        else if (action === 'buy') runBuyGuest(actor, evt.payload?.guestId);
    }

    function getActorState(actor) {
        if (actor === 'rival') {
            return { self: gameState.rival, opponent: gameState.player, selfKey: 'rival', opponentKey: 'player' };
        }
        return { self: gameState.player, opponent: gameState.rival, selfKey: 'player', opponentKey: 'rival' };
    }

    // === HUD Update ===
    function updateHUD() {
        if (!gameState) return;
        const p = gameState.player;
        const pVenue = Game.VENUES[p.venueId];
        const includeProjectedRoundTotals =
            gameState.phase === 'guest' && gameState.guestPhaseScoredRound !== gameState.round;

        const hudRoundNumEl = document.getElementById('hud-round-num');
        const hudRoundTotalEl = document.getElementById('hud-round-total');
        const hudPhaseEl = document.getElementById('hud-phase');
        const hudPlayerPtsEl = document.getElementById('hud-player-pts');
        const playerMoneyEl = document.getElementById('player-money');

        if (!hudRoundNumEl || !hudRoundTotalEl || !hudPhaseEl || !hudPlayerPtsEl || !playerMoneyEl) {
            return;
        }

        hudRoundNumEl.textContent = gameState.round;
        hudRoundTotalEl.textContent = gameState.totalRounds;
        hudPhaseEl.textContent =
            gameState.phase === 'guest' ? 'GUEST PHASE' :
                gameState.phase === 'buy' ? 'BUY PHASE' : 'GAME OVER';

        hudPlayerPtsEl.textContent = `⭐ ${p.points + (includeProjectedRoundTotals ? p.roundPoints : 0)}`;
        playerMoneyEl.textContent = `💵 $${p.money + (includeProjectedRoundTotals ? p.roundMoney : 0)}`;

        updateHeatBar('player', p.heat, Game.getHeatCapacity(pVenue, p), p.busted);
        updateHeatBar('rival', gameState.rival.heat, Game.getHeatCapacity(Game.VENUES[gameState.rival.venueId], gameState.rival), gameState.rival.busted);
    }

    function updateHeatBar(who, heat, max, busted = false) {
        const fill = document.getElementById(`${who}-heat-fill`);
        const text = document.getElementById(`${who}-heat-text`);
        if (!fill || !text) return;
        const pct = busted ? 100 : Math.min(100, (heat / max) * 100);
        fill.style.width = pct + '%';
        fill.className = 'heat-fill';
        if (pct > 85) fill.classList.add('critical');
        else if (pct > 70) fill.classList.add('danger');
        else if (pct > 50) fill.classList.add('warning');
        else fill.classList.add('safe');
        text.textContent = `\u{1F525} ${heat}/${max}`;
    }

    function renderAbilityBadge(guest) {
        if (!guest.ability) return '';
        const icon = escapeHtml(guest.ability.icon || '');
        return `<span class="ability-icon-badge" aria-label="${escapeHtml(guest.ability.name || 'Ability')}" title="${escapeHtml(guest.ability.name || 'Ability')}">${icon}</span>`;
    }


    // === Venue Scene Actors ===
    function getHouseEntryKey(entry, index) {
        if (entry && typeof entry === 'object' && entry.instanceId != null) return `i-${entry.instanceId}`;
        const guestId = entry && typeof entry === 'object' ? entry.guestId : entry;
        return `g-${guestId}-${index}`;
    }

    function getSceneBounds(who) {
        const scene = document.getElementById(`${who}-scene`);
        if (!scene) return null;
        return {
            width: scene.clientWidth || 280,
            height: scene.clientHeight || 150,
        };
    }

    function pickBehaviorTarget(who) {
        const bounds = getSceneBounds(who);
        if (!bounds) return { x: 120, y: 80, behavior: 'hang' };
        const choices = [
            { behavior: 'dance', x: bounds.width * 0.34, y: bounds.height * 0.46 },
            { behavior: 'drink', x: bounds.width * 0.78, y: bounds.height * 0.35 },
            { behavior: 'lounge', x: bounds.width * 0.24, y: bounds.height * 0.72 },
            { behavior: 'wander', x: bounds.width * (0.42 + Math.random() * 0.36), y: bounds.height * (0.56 + Math.random() * 0.28) },
        ];
        return choices[Math.floor(Math.random() * choices.length)];
    }

    function getEntryDoorPosition(who) {
        const bounds = getSceneBounds(who) || { width: 280, height: 150 };
        return { x: bounds.width * 0.93, y: 12 };
    }

    function getExitDoorPosition(who) {
        const bounds = getSceneBounds(who) || { width: 280, height: 150 };
        return { x: 14, y: 14 };
    }

    function ensureActorLoop() {
        if (actorAnimTimer) return;
        actorAnimTimer = setInterval(stepVenueActors, ACTOR_TICK_MS);
    }

    function stopActorLoop() {
        if (!actorAnimTimer) return;
        clearInterval(actorAnimTimer);
        actorAnimTimer = null;
    }

    function clearVenueActors() {
        ['player', 'rival'].forEach((who) => {
            venueActors[who].clear();
            const layer = document.getElementById(`${who}-actors`);
            if (layer) layer.innerHTML = '';
        });
        stopActorLoop();
    }

    function syncVenueActors(who) {
        const player = who === 'player' ? gameState.player : gameState.rival;
        const layer = document.getElementById(`${who}-actors`);
        if (!layer || !player) return;
        const actors = venueActors[who];
        const wanted = new Set();

        player.house.forEach((entry, idx) => {
            const guestId = entry.guestId || entry;
            const guest = Game.GUESTS[guestId];
            if (!guest) return;
            const key = getHouseEntryKey(entry, idx);
            wanted.add(key);
            let actor = actors.get(key);

            // If this guest was the arriving-in-grid guest last frame, promote that actor into house.
            const arrivingActor = actors.get('arriving-guest');
            if (!actor && arrivingActor && arrivingActor.guestId === guestId) {
                actors.set(key, arrivingActor);
                actors.delete('arriving-guest');
                actor = arrivingActor;
                actor.state = 'active';
                actor.el.classList.remove('entering', 'exiting', 'leaving');
            }

            if (!actor) {
                const target = pickBehaviorTarget(who);
                const spawn = getEntryDoorPosition(who);
                const el = document.createElement('div');
                el.className = 'venue-actor entering';
                el.innerHTML = `<span class="actor-emoji">${guest.emoji}</span>`;
                el.title = `${guest.name} • entering`;
                layer.appendChild(el);
                actor = {
                    el,
                    x: spawn.x,
                    y: spawn.y,
                    targetX: target.x,
                    targetY: target.y,
                    behavior: target.behavior,
                    state: 'active',
                    t: Math.random() * Math.PI * 2,
                    guestName: guest.name,
                    guestId,
                };
                actors.set(key, actor);
                setTimeout(() => el.classList.remove('entering'), 320);
            } else if (actor.state === 'exiting') {
                actor.state = 'active';
                actor.el.classList.remove('exiting', 'leaving');
                const target = pickBehaviorTarget(who);
                actor.targetX = target.x;
                actor.targetY = target.y;
                actor.behavior = target.behavior;
            }

            actor.guestId = guestId;
            actor.guestName = guest.name;

            if (actor.state === 'active' && Math.random() < 0.03) {
                const target = pickBehaviorTarget(who);
                actor.targetX = target.x;
                actor.targetY = target.y;
                actor.behavior = target.behavior;
            }
            actor.el.title = `${actor.guestName} • ${actor.behavior}`;
        });

        // Arriving guest appears in venue grid before admit: show their actor immediately.
        if (player.arrivingGuest && !player.doorClosed && !player.busted) {
            wanted.add('arriving-guest');
            const guestId = player.arrivingGuest;
            const guest = Game.GUESTS[guestId];
            if (guest) {
                let arrivingActor = actors.get('arriving-guest');
                if (!arrivingActor) {
                    const target = pickBehaviorTarget(who);
                    const spawn = getEntryDoorPosition(who);
                    const el = document.createElement('div');
                    el.className = 'venue-actor entering';
                    el.innerHTML = `<span class="actor-emoji">${guest.emoji}</span>`;
                    layer.appendChild(el);
                    arrivingActor = {
                        el,
                        x: spawn.x,
                        y: spawn.y,
                        targetX: target.x,
                        targetY: target.y,
                        behavior: target.behavior,
                        state: 'active',
                        t: Math.random() * Math.PI * 2,
                        guestName: guest.name,
                        guestId,
                    };
                    actors.set('arriving-guest', arrivingActor);
                    setTimeout(() => el.classList.remove('entering'), 320);
                } else {
                    arrivingActor.guestId = guestId;
                    arrivingActor.guestName = guest.name;
                    arrivingActor.el.innerHTML = `<span class="actor-emoji">${guest.emoji}</span>`;
                    if (arrivingActor.state === 'exiting') {
                        arrivingActor.state = 'active';
                        arrivingActor.el.classList.remove('exiting', 'leaving');
                    }
                }
                arrivingActor.el.title = `${arrivingActor.guestName} • ${arrivingActor.behavior}`;
            }
        }

        for (const [key, actor] of actors.entries()) {
            if (!wanted.has(key) && actor.state !== 'exiting') {
                const exitTarget = getExitDoorPosition(who);
                actor.state = 'exiting';
                actor.behavior = 'leaving';
                actor.targetX = exitTarget.x;
                actor.targetY = exitTarget.y;
                actor.el.classList.add('exiting');
                actor.el.title = `${actor.guestName} • leaving`;
            }
        }

        ensureActorLoop();
    }

    function queueVenueActorExit(who, guestId) {
        const actors = venueActors[who];
        if (!actors || !actors.size) return false;

        const candidates = [];
        for (const [key, actor] of actors.entries()) {
            if (actor.state === 'exiting') continue;
            if (guestId && actor.guestId !== guestId) continue;
            candidates.push([key, actor]);
        }
        if (!candidates.length) return false;

        // Prefer established house actors over the transient arriving placeholder.
        candidates.sort((a, b) => {
            const aArriving = a[0] === 'arriving-guest' ? 1 : 0;
            const bArriving = b[0] === 'arriving-guest' ? 1 : 0;
            return aArriving - bArriving;
        });

        const [, actor] = candidates[0];
        const exitTarget = getExitDoorPosition(who);
        actor.state = 'exiting';
        actor.behavior = 'leaving';
        actor.targetX = exitTarget.x;
        actor.targetY = exitTarget.y;
        actor.el.classList.add('exiting');
        actor.el.title = `${actor.guestName} • leaving`;
        ensureActorLoop();
        return true;
    }

    function stepVenueActors() {
        ['player', 'rival'].forEach((who) => {
            const actors = venueActors[who];
            const bounds = getSceneBounds(who);
            if (!bounds) return;
            const removeKeys = [];

            actors.forEach((actor, key) => {
                const dx = actor.targetX - actor.x;
                const dy = actor.targetY - actor.y;
                const dist = Math.hypot(dx, dy);
                if (dist > 1) {
                    const maxSpeed = actor.state === 'exiting' ? ACTOR_MAX_SPEED + 1.2 : ACTOR_MAX_SPEED;
                    const speed = Math.min(maxSpeed, ACTOR_MIN_SPEED + dist * ACTOR_DISTANCE_SPEED_FACTOR);
                    actor.x += (dx / dist) * speed;
                    actor.y += (dy / dist) * speed;
                } else if (actor.state === 'exiting') {
                    actor.el.classList.add('leaving');
                    removeKeys.push(key);
                } else if (Math.random() < 0.025) {
                    const target = pickBehaviorTarget(who);
                    actor.targetX = target.x;
                    actor.targetY = target.y;
                    actor.behavior = target.behavior;
                    actor.el.title = `${actor.guestName} • ${target.behavior}`;
                }

                actor.t += actor.state === 'exiting' ? 0.06 : 0.18;
                const bob = actor.state === 'exiting' ? 0 : Math.sin(actor.t) * 2;
                actor.el.style.left = `${Math.max(8, Math.min(bounds.width - 22, actor.x))}px`;
                actor.el.style.top = `${Math.max(8, Math.min(bounds.height - 24, actor.y + bob))}px`;
            });

            removeKeys.forEach((key) => {
                const actor = actors.get(key);
                if (!actor) return;
                const el = actor.el;
                setTimeout(() => el.remove(), 220);
                actors.delete(key);
            });
        });

        if (!venueActors.player.size && !venueActors.rival.size) stopActorLoop();
    }


    // === Guest Slot Rendering ===
    function createGuestSlot(guestId, animate, options = {}) {
        const guest = Game.GUESTS[guestId];
        if (!guest) {
            const fallback = document.createElement('div');
            fallback.className = 'guest-slot occupied-slot tier-common';
            if (guestId != null) fallback.dataset.guestId = String(guestId);
            fallback.innerHTML = `
                <span class="slot-stat slot-heat">🔥0</span>
                <span class="slot-emoji">❓</span>
                <span class="slot-stat slot-money">0</span>
                <span class="slot-stat slot-points">0</span>
            `;
            fallback.title = 'Unknown guest';
            return fallback;
        }
        const el = document.createElement('div');
        el.className = `guest-slot occupied-slot tier-${guest.tier}`;
        el.dataset.guestId = guestId;
        if (animate) el.classList.add('entering');
        el.innerHTML = `
            <span class="slot-stat slot-heat">🔥${guest.heat}</span>
            <span class="slot-emoji${guest.ability ? ' has-ability' : ''}">${guest.emoji}</span>
            <span class="slot-stat slot-money">${guest.money}</span>
            ${renderAbilityBadge(guest)}
            <span class="slot-stat slot-points">${guest.points}</span>
        `;
        el.title = `${guest.name} - ${guest.desc}`;
        if (options.interactive !== false) {
            el.addEventListener('click', (e) => showTooltip(e, guestId));
        }
        return el;
    }

    function renderHouseGrid(who) {
        const player = who === 'player' ? gameState.player : gameState.rival;
        const slotsEl = document.getElementById(`${who}-slots`);
        slotsEl.innerHTML = '';
        const venue = Game.VENUES[player.venueId];
        const allowGridTooltip = who === 'rival';

        const houseCapacity = Game.getHouseCapacity(venue, player);
        // Count occupied slots: house + arriving guest (cap to capacity for empties)
        const occupiedCount = Math.min(player.house.length, houseCapacity) + (player.arrivingGuest ? 1 : 0);
        
        // Render empty slots for remaining capacity
        for (let i = 0; i < houseCapacity - occupiedCount; i++) {
            const empty = document.createElement('div');
            empty.className = 'guest-slot empty-slot';
            slotsEl.appendChild(empty);
        }

        // Render oldest-to-newest but only up to capacity
        let guests = [...player.house].reverse();
        if (guests.length > houseCapacity) {
            guests = guests.slice(guests.length - houseCapacity);
        }
        guests.forEach((entry) => {
            const guestId = entry.guestId || entry;
            const slot = createGuestSlot(guestId, false, { interactive: allowGridTooltip });
            if (who === 'player') {
                const instanceId = typeof entry === 'string' ? null : entry.instanceId;
                slot.dataset.slotSource = 'house';
                if (instanceId != null) slot.dataset.instanceId = String(instanceId);
                if (who === 'player' && instanceId != null && instanceId === playerFlashWindowInstanceId) slot.classList.add('just-entered');
                if (selectedGridGuest?.source === 'house' &&
                    selectedGridGuest.guestId === guestId &&
                    (selectedGridGuest.instanceId == null || selectedGridGuest.instanceId === instanceId)) {
                    slot.classList.add('selected');
                }
                slot.addEventListener('click', () => {
                    selectedGridGuest = { guestId, source: 'house', instanceId };
                    _lastGuestDetailKey = null;
                    refreshSelectedGridSlotVisual();
                    updateGuestDetail();
                });
            }
            slotsEl.appendChild(slot);
        });

        // Render arriving guest as the rightmost/newest slot
        if (player.arrivingGuest) {
            const slot = createGuestSlot(player.arrivingGuest, false, { interactive: allowGridTooltip });
            slot.classList.add('arriving-in-grid');
            if (who === 'player') {
                slot.dataset.slotSource = 'arriving';
                if (selectedGridGuest?.source === 'arriving' && selectedGridGuest.guestId === player.arrivingGuest) {
                    slot.classList.add('selected');
                }
                slot.addEventListener('click', () => {
                    selectedGridGuest = { guestId: player.arrivingGuest, source: 'arriving' };
                    _lastGuestDetailKey = null;
                    refreshSelectedGridSlotVisual();
                    updateGuestDetail();
                });
            }
            slotsEl.appendChild(slot);
        }

        syncVenueActors(who);
    }

    function renderArrivingGuest(who) {
        const arrivingEl = document.getElementById(`${who}-arriving`);
        if (!arrivingEl) return;
        // Door-side arriving card intentionally hidden; arriving guest remains visible in the guest strip/detail panel.
        arrivingEl.innerHTML = '';
        arrivingEl.dataset.renderKey = '';
    }

    function updateVenueStatus(who) {
        const player = who === 'player' ? gameState.player : gameState.rival;
        const statusEl = document.getElementById(`${who}-status`);
        if (!statusEl) return;

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
        if (Array.isArray(guestId)) {
            guestId.forEach((id) => animateExitGuest(who, id));
            return;
        }

        // Move matching venue actor to exit door before it disappears.
        // (syncVenueActors also enforces exits for removed actors as a fallback.)
        queueVenueActorExit(who, guestId);

        // Animate the grid card itself drifting left and fading out.
        let sourceSlot = guestId ? document.querySelector(`#${who}-slots .occupied-slot[data-guest-id="${guestId}"]`) : null;
        if (!sourceSlot) sourceSlot = document.querySelector(`#${who}-slots .occupied-slot`);
        if (!sourceSlot) return;

        const resolvedGuestId = guestId || sourceSlot.dataset.guestId;
        if (!resolvedGuestId || !Game.GUESTS[resolvedGuestId]) return;

        const ghost = createGuestSlot(resolvedGuestId, false);
        ghost.classList.add('exit-ghost');

        const sourceRect = sourceSlot.getBoundingClientRect();
        ghost.style.left = `${sourceRect.left}px`;
        ghost.style.top = `${sourceRect.top}px`;
        document.body.appendChild(ghost);

        requestAnimationFrame(() => {
            ghost.style.transform = 'translate(-56px, 0)';
            ghost.classList.add('leaving');
        });

        setTimeout(() => ghost.remove(), 380);
    }

    function getPlayerFlashWindowEntry() {
        if (!gameState || playerFlashWindowInstanceId == null) return null;
        return gameState.player.house.find((entry) => typeof entry !== 'string' && entry.instanceId === playerFlashWindowInstanceId) || null;
    }

    function isPlayerFlashAvailable() {
        const entry = getPlayerFlashWindowEntry();
        if (!entry) return false;
        const guest = Game.GUESTS[entry.guestId];
        return !!(guest?.ability && !entry.abilityUsed && !gameState.player.doorClosed && !gameState.player.busted);
    }

    // === Guest Detail Panel ===
    function updateGuestDetail() {
        const detailEl = document.getElementById('guest-detail');
        const p = gameState.player;
        syncSelectedGridGuest();
        const selectedGuestId = selectedGridGuest?.guestId || p.arrivingGuest;
        const selectedGuestSource = selectedGridGuest?.source || 'arriving';
        refreshSelectedGridSlotVisual();
        // Avoid re-rendering if player's arriving state and visible stats haven't changed
        const key = `${p.arrivingGuest || ''}|${p.doorClosed}|${p.busted}|${p.heat}|${p.roundMoney}|${p.roundPoints}|${selectedGuestId || ''}|${selectedGuestSource}`;
        if (key === _lastGuestDetailKey) return;
        _lastGuestDetailKey = key;

        if (!p.arrivingGuest || p.doorClosed || p.busted) {
            const emptyText = p.busted ? 'You busted! Round over.' :
                p.doorClosed ? 'Door closed. Waiting for rival...' :
                'No more guests.';
            const curEmpty = detailEl.querySelector('.guest-detail-empty');
            if (curEmpty && curEmpty.textContent === emptyText) {
                document.getElementById('btn-admit').disabled = true;
                document.getElementById('btn-ability').disabled = true;
                document.getElementById('btn-close-door').disabled = true;
                return;
            }
            detailEl.innerHTML = '<div class="guest-detail-empty">' + emptyText + '</div>';
            document.getElementById('btn-admit').disabled = true;
            document.getElementById('btn-ability').disabled = true;
            document.getElementById('btn-close-door').disabled = true;
            return;
        }

        const guest = Game.GUESTS[selectedGuestId];
        const venue = Game.VENUES[p.venueId];
        const wouldBust = p.heat > Game.getHeatCapacity(venue, p);
        let selectedHouseEntry = null;
        if (selectedGuestSource === 'house') {
            selectedHouseEntry = p.house.find((entry) => {
                if (selectedGridGuest?.instanceId != null && typeof entry !== 'string') {
                    return entry.instanceId === selectedGridGuest.instanceId;
                }
                return (entry.guestId || entry) === selectedGuestId;
            }) || null;
        }
        const canUseSelectedAbility = isPlayerFlashAvailable();

        let abilityHTML = '';
        if (guest.ability) {
            abilityHTML = `<div class="guest-detail-ability">\u26A1 ${guest.ability.icon} ${guest.ability.name}: ${guest.ability.desc}</div>`;
        }

        // If DOM already shows the same guest info, skip replacing innerHTML
        const existingName = detailEl.querySelector('.guest-detail-name')?.textContent;
        const existingMoney = detailEl.querySelector('.stat-money')?.textContent;
        const existingPoints = detailEl.querySelector('.stat-points')?.textContent;
        const existingHeat = detailEl.querySelector('.stat-heat')?.textContent || detailEl.querySelector('.stat-heat.danger')?.textContent;
        const expectedMoney = `\u{1F4B5} ${guest.money}`;
        const expectedPoints = `\u2B50 ${guest.points}`;
        const expectedHeat = `\u{1F525} ${guest.heat}${wouldBust ? ' BUST!' : ''}`;
        if (existingName === guest.name && existingMoney === expectedMoney && existingPoints === expectedPoints && existingHeat === expectedHeat) {
            document.getElementById('btn-admit').disabled = false;
            document.getElementById('btn-ability').disabled = !canUseSelectedAbility;
            document.getElementById('btn-close-door').disabled = false;
            return;
        }

        detailEl.innerHTML = `
            <div class="guest-detail-content">
                <div class="guest-detail-emoji">${guest.emoji}</div>
                <div class="guest-detail-info">
                    <div class="guest-detail-name">${guest.name}</div>
                    <div class="guest-detail-stats">
                        <span class="stat-money">\u{1F4B5} ${guest.money}</span>
                        <span class="stat-points">\u2B50 ${guest.points}</span>
                        <span class="stat-heat${wouldBust ? ' danger' : ''}">\u{1F525} ${guest.heat}${wouldBust ? ' BUST!' : ''}</span>
                    </div>
                    ${abilityHTML}
                    ${isPlayerFlashAvailable() ? '<div class="flash-available">FLASH AVAILABLE</div>' : ''}
                </div>
            </div>
        `;

        // Update buttons
        document.getElementById('btn-admit').disabled = false;
        document.getElementById('btn-ability').disabled = !canUseSelectedAbility;
        document.getElementById('btn-close-door').disabled = false;
    }

    // === Tooltip ===
    function showTooltipForTarget(target, guestId) {
        if (!target) return;
        removeTooltip();
        const guest = Game.GUESTS[guestId];
        const el = document.createElement('div');
        el.className = 'guest-tooltip';

        let abilityHTML = '';
        if (guest.ability) {
            abilityHTML = `<div class="tt-ability">${guest.ability.icon} ${guest.ability.name}: ${guest.ability.desc}</div>`;
        }

        el.innerHTML = `
            <div class="tt-name">${guest.emoji} ${guest.name}</div>
            <div class="tt-stats">
                <span class="stat-money">💵${guest.money}</span>
                <span class="stat-points">⭐${guest.points}</span>
                <span class="stat-heat">🔥${guest.heat}</span>
            </div>
            ${abilityHTML}
        `;

        document.body.appendChild(el);
        tooltipEl = el;

        // Position
        const rect = target.getBoundingClientRect();
        let left = rect.left + rect.width / 2 - 80;
        let top = rect.top - el.offsetHeight - 8;
        if (top < 10) top = rect.bottom + 8;
        if (left < 10) left = 10;
        if (left + el.offsetWidth > window.innerWidth - 10) {
            left = window.innerWidth - el.offsetWidth - 10;
        }
        el.style.left = left + 'px';
        el.style.top = top + 'px';

        // Dismiss on click anywhere outside the tooltip
        // Defer listener attachment to allow current click to finish
        setTimeout(() => {
            const dismissTooltip = (clickEvent) => {
                if (tooltipEl && !el.contains(clickEvent.target)) {
                    removeTooltip();
                    document.removeEventListener('click', dismissTooltip);
                }
            };
            document.addEventListener('click', dismissTooltip);
        }, 0);
    }

        function showTooltip(e, guestId) {
        e.stopPropagation();
        showTooltipForTarget(e.currentTarget || e.target, guestId);
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

        const target = e?.currentTarget || e?.target;
        if (!target) return;
        const rect = target.getBoundingClientRect();
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


    function bindGuestTooltipHoldInteractions(el, guestId) {
        if (!el || !guestId) return;

        let pressTimer = null;
        let didLongPress = false;

        const clearPressTimer = () => {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
        };

        const onPressStart = (e) => {
            if (e.target.closest('.slot-emoji.has-ability')) return;
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            didLongPress = false;
            clearPressTimer();
            pressTimer = setTimeout(() => {
                showTooltipForTarget(el, guestId);
                didLongPress = true;
                pressTimer = null;
            }, 420);
        };

        el.addEventListener('pointerdown', onPressStart);
        el.addEventListener('pointerup', clearPressTimer);
        el.addEventListener('pointercancel', clearPressTimer);
        el.addEventListener('pointerleave', clearPressTimer);

        // Swallow the click that fires after a long-press so it doesn't buy immediately.
        el.addEventListener('click', (e) => {
            if (!didLongPress) return;
            e.preventDefault();
            e.stopPropagation();
            didLongPress = false;
        }, true);
    }

    function bindAbilityTooltipInteractions(el, message) {
        if (!el || !message) return;

        let pressTimer = null;
        let didLongPress = false;

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

    function getQueuedGuestPreview(player, count) {
        if (!player || !Array.isArray(player.roundDeck) || count <= 0) return [];
        const previewCount = Math.min(count, player.roundDeck.length);
        const ids = [];
        for (let i = player.roundDeck.length - 1; i >= player.roundDeck.length - previewCount; i--) {
            ids.push(player.roundDeck[i]);
        }
        return ids;
    }

    function clearRevealDoorIntel(who = null) {
        if (who) {
            revealDoorIntel[who] = null;
            renderRevealDoorIntel(who);
            return;
        }
        revealDoorIntel.player = null;
        revealDoorIntel.rival = null;
        renderRevealDoorIntel('player');
        renderRevealDoorIntel('rival');
    }

    function setRevealDoorIntel(who, guestIds) {
        const ids = Array.isArray(guestIds) ? guestIds.filter(Boolean) : [];
        if (!ids.length) {
            clearRevealDoorIntel(who);
            return;
        }
        revealDoorIntel[who] = {
            count: ids.length,
            index: 0,
        };
        renderRevealDoorIntel(who);
    }

    function renderRevealDoorIntel(who) {
        if (!gameState) return;
        const doorEl = document.getElementById(`${who}-door`);
        if (!doorEl) return;

        const player = who === 'player' ? gameState.player : gameState.rival;
        const intel = revealDoorIntel[who];

        const existing = doorEl.querySelector('.reveal-door-overlay');
        if (existing) existing.remove();

        if (!intel) return;

        const queued = getQueuedGuestPreview(player, intel.count);
        if (!queued.length) {
            clearRevealDoorIntel(who);
            return;
        }

        intel.index = intel.index % queued.length;
        const shownIndex = intel.index;
        const guestId = queued[shownIndex];
        const guest = Game.GUESTS[guestId];
        if (!guest) return;

        const overlay = document.createElement('button');
        overlay.type = 'button';
        overlay.className = 'reveal-door-overlay';
        overlay.title = `${guest.name} (${shownIndex + 1}/${queued.length})`;

        const card = createGuestSlot(guestId, false, { interactive: false });
        card.classList.add('reveal-door-card');

        const idx = document.createElement('span');
        idx.className = 'reveal-door-index';
        idx.textContent = `${shownIndex + 1}/${queued.length}`;

        overlay.appendChild(card);
        overlay.appendChild(idx);

        overlay.addEventListener('click', (e) => {
            e.stopPropagation();
            if (queued.length <= 1) return;
            intel.index = (intel.index + 1) % queued.length;
            renderRevealDoorIntel(who);
        });

        doorEl.appendChild(overlay);
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
    function runAdmit(actor = 'player') {
        if (!gameState || gameState.phase !== 'guest') return;
        const { self, opponent, selfKey } = getActorState(actor);
        if (!self.arrivingGuest || self.doorClosed || self.busted) return;

        const venue = Game.VENUES[self.venueId];
        // Snapshot player's visible state so we can avoid unnecessary re-renders
        const playerSnapshot = {
            arrivingGuest: gameState.player.arrivingGuest,
            doorClosed: gameState.player.doorClosed,
            busted: gameState.player.busted,
            heat: gameState.player.heat,
            roundMoney: gameState.player.roundMoney,
            roundPoints: gameState.player.roundPoints,
        };
        const result = Game.admitGuest(self, venue, opponent, Game.VENUES[opponent.venueId]);
        if (!result) return;
        if (selfKey === 'player') {
            playerFlashWindowInstanceId = typeof self.house[0] === 'object' ? self.house[0].instanceId : null;
        }

        if (result.pushedOut && result.pushedOut.length) {
            result.pushedOut.forEach(id => animateExitGuest(selfKey, id));
        }
        if (result.pendingOut) {
            animateExitGuest(selfKey, result.pendingOut);
        }
        renderHouseGrid(selfKey);
        renderArrivingGuest(selfKey);
        // Only refresh player detail if the action was by the player, or
        // if the opponent's action changed the player's visible state.
        if (selfKey === 'player' || JSON.stringify(playerSnapshot) !== JSON.stringify({
            arrivingGuest: gameState.player.arrivingGuest,
            doorClosed: gameState.player.doorClosed,
            busted: gameState.player.busted,
            heat: gameState.player.heat,
            roundMoney: gameState.player.roundMoney,
            roundPoints: gameState.player.roundPoints,
        })) updateGuestDetail();
        updateVenueStatus(selfKey);
        updateHUD();
        removeTooltip();
        removeIconTooltip();

        if (result.busted) {
            document.getElementById(`${selfKey}-area`).classList.add('bust-flash');
            showFeedback('YOU BUSTED!', 'bust', 3000);
            setTimeout(() => {
                document.getElementById(`${selfKey}-area`).classList.remove('bust-flash');
            }, 500);
        }

        checkGuestPhaseDone();
        publishState();
    }

    function handleAdmit() {
        if (isMultiplayer() && multiplayerRole === 'join') {
            multiplayerSession?.publish('request-action', { action: 'admit', actor: 'rival' });
            return;
        }
        runAdmit('player');
    }

    function runAbility(actor = 'player') {
        if (!gameState || gameState.phase !== 'guest') return;
        const { self, opponent, selfKey, opponentKey } = getActorState(actor);
        if (self.doorClosed || self.busted) return;

        const selfVenue = Game.VENUES[self.venueId];
        const opponentVenue = Game.VENUES[opponent.venueId];
        // Snapshot player's visible state
        const playerSnapshot = {
            arrivingGuest: gameState.player.arrivingGuest,
            doorClosed: gameState.player.doorClosed,
            busted: gameState.player.busted,
            heat: gameState.player.heat,
            roundMoney: gameState.player.roundMoney,
            roundPoints: gameState.player.roundPoints,
        };
        const flashEntry = selfKey === 'player' ? getPlayerFlashWindowEntry() : null;
        const selectedForAbility = selfKey === 'player'
            ? (flashEntry ? { source: 'house', guestId: flashEntry.guestId, instanceId: flashEntry.instanceId } : null)
            : null;
        const result = Game.activateAbility(self, opponent, selfVenue, opponentVenue, selectedForAbility);
        if (!result) return;

        showFeedback(`${result.ability.name}: ${result.effects.join(', ')}`, 'disruption', 2500);
        if (result.revealedGuests) setRevealDoorIntel(selfKey, result.revealedGuests);

        if (result.pushedOut) {
            animateExitGuest(selfKey, result.pushedOut);
        }
        if (result.pendingOut) {
            animateExitGuest(selfKey, result.pendingOut);
        }

        renderHouseGrid(selfKey);
        renderHouseGrid(opponentKey);
        renderArrivingGuest(selfKey);
        // Only re-render the opponent's arriving area if the player's visible arriving state changed
        if (selfKey === 'player' || JSON.stringify(playerSnapshot) !== JSON.stringify({
            arrivingGuest: gameState.player.arrivingGuest,
            doorClosed: gameState.player.doorClosed,
            busted: gameState.player.busted,
            heat: gameState.player.heat,
            roundMoney: gameState.player.roundMoney,
            roundPoints: gameState.player.roundPoints,
        })) renderArrivingGuest(opponentKey);
        if (selfKey === 'player' || JSON.stringify(playerSnapshot) !== JSON.stringify({
            arrivingGuest: gameState.player.arrivingGuest,
            doorClosed: gameState.player.doorClosed,
            busted: gameState.player.busted,
            heat: gameState.player.heat,
            roundMoney: gameState.player.roundMoney,
            roundPoints: gameState.player.roundPoints,
        })) updateGuestDetail();
        updateVenueStatus(selfKey);
        updateVenueStatus(opponentKey);
        updateHUD();
        removeTooltip();
        removeIconTooltip();

        if (opponent.busted) {
            document.getElementById(`${opponentKey}-area`).classList.add('bust-flash');
            setTimeout(() => {
                document.getElementById(`${opponentKey}-area`).classList.remove('bust-flash');
            }, 500);
        }

        checkGuestPhaseDone();
        publishState();
    }

    function handleAbility() {
        if (isMultiplayer() && multiplayerRole === 'join') {
            multiplayerSession?.publish('request-action', { action: 'ability', actor: 'rival' });
            return;
        }
        runAbility('player');
    }

    function runCloseDoor(actor = 'player') {
        if (!gameState || gameState.phase !== 'guest') return;
        const { self, opponent, selfKey } = getActorState(actor);
        if (self.doorClosed || self.busted) return;

        const venue = Game.VENUES[self.venueId];
        const playerSnapshot = {
            arrivingGuest: gameState.player.arrivingGuest,
            doorClosed: gameState.player.doorClosed,
            busted: gameState.player.busted,
            heat: gameState.player.heat,
            roundMoney: gameState.player.roundMoney,
            roundPoints: gameState.player.roundPoints,
        };
        const result = Game.closeDoor(self, venue, opponent);
        if (selfKey === 'player') playerFlashWindowInstanceId = null;
        if (result?.pushedOut && result.pushedOut.length) {
            result.pushedOut.forEach(id => animateExitGuest(selfKey, id));
        }
        renderHouseGrid(selfKey);
        renderArrivingGuest(selfKey);
        if (selfKey === 'player' || JSON.stringify(playerSnapshot) !== JSON.stringify({
            arrivingGuest: gameState.player.arrivingGuest,
            doorClosed: gameState.player.doorClosed,
            busted: gameState.player.busted,
            heat: gameState.player.heat,
            roundMoney: gameState.player.roundMoney,
            roundPoints: gameState.player.roundPoints,
        })) updateGuestDetail();
        updateVenueStatus(selfKey);
        updateHUD();
        removeTooltip();
        removeIconTooltip();

        showFeedback('You closed the door safely', 'money', 2000);
        checkGuestPhaseDone();
        publishState();
    }

    function handleCloseDoor() {
        if (isMultiplayer() && multiplayerRole === 'join') {
            multiplayerSession?.publish('request-action', { action: 'close', actor: 'rival' });
            return;
        }
        runCloseDoor('player');
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
                // Defensive fallback: if rival still has an active turn, bank safely.
                if (!r.phaseComplete && !r.doorClosed && !r.busted) {
                    executeAIAction('close');
                    return;
                }
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
        const playerSnapshot = {
            arrivingGuest: gameState.player.arrivingGuest,
            doorClosed: gameState.player.doorClosed,
            busted: gameState.player.busted,
            heat: gameState.player.heat,
            roundMoney: gameState.player.roundMoney,
            roundPoints: gameState.player.roundPoints,
        };
        const rivalHouseSnapshot = gameState.rival.house.length;

        if (action === 'admit') {
            const result = Game.admitGuest(r, rVenue, gameState.player, Game.VENUES[gameState.player.venueId]);
            if (!result) return;

            if (result.pushedOut && result.pushedOut.length) {
                result.pushedOut.forEach(id => animateExitGuest('rival', id));
            }
            if (result.pendingOut) {
                animateExitGuest('rival', result.pendingOut);
            }
            // Only re-render rival grid if their house visibly changed
            if (gameState.rival.house.length !== rivalHouseSnapshot) {
                renderHouseGrid('rival');
            }

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
            if (result.revealedGuests) setRevealDoorIntel('rival', result.revealedGuests);
            if (result.pushedOut) {
                animateExitGuest('rival', result.pushedOut);
            }
            if (result.pendingOut) {
                animateExitGuest('rival', result.pendingOut);
            }

            // Check if player was busted
            if (p.busted) {
                document.getElementById('player-area').classList.add('bust-flash');
                updateGuestDetail();
                updateVenueStatus('player');
                setTimeout(() => {
                    document.getElementById('player-area').classList.remove('bust-flash');
                }, 500);
            }

            // Only re-render player grid if their visible state actually changed
            if (JSON.stringify(playerSnapshot) !== JSON.stringify({
                arrivingGuest: gameState.player.arrivingGuest,
                doorClosed: gameState.player.doorClosed,
                busted: gameState.player.busted,
                heat: gameState.player.heat,
                roundMoney: gameState.player.roundMoney,
                roundPoints: gameState.player.roundPoints,
            })) renderHouseGrid('player');
            // Only re-render rival grid if their house visibly changed
            if (gameState.rival.house.length !== rivalHouseSnapshot) {
                renderHouseGrid('rival');
            }
        } else if (action === 'close') {
            const result = Game.closeDoor(r, rVenue, gameState.player);
            if (result?.pushedOut) {
                animateExitGuest('rival', result.pushedOut);
            }
            // Only re-render if house changed
            if (gameState.rival.house.length !== rivalHouseSnapshot) {
                renderHouseGrid('rival');
            }
            showFeedback(`${r.name} closed their door`, 'money', 2000);
        }

        renderArrivingGuest('rival');
        // Only update player's arriving area if their visible arriving state changed
        if (JSON.stringify(playerSnapshot) !== JSON.stringify({
            arrivingGuest: gameState.player.arrivingGuest,
            doorClosed: gameState.player.doorClosed,
            busted: gameState.player.busted,
            heat: gameState.player.heat,
            roundMoney: gameState.player.roundMoney,
            roundPoints: gameState.player.roundPoints,
        })) renderArrivingGuest('player');
        updateVenueStatus('rival');
        // Refresh player UI only if their visible state changed
        updateVenueStatus('player');
        if (JSON.stringify(playerSnapshot) !== JSON.stringify({
            arrivingGuest: gameState.player.arrivingGuest,
            doorClosed: gameState.player.doorClosed,
            busted: gameState.player.busted,
            heat: gameState.player.heat,
            roundMoney: gameState.player.roundMoney,
            roundPoints: gameState.player.roundPoints,
        })) updateGuestDetail();
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
        html += `<div class="results-row"><span class="label">\u{1F4B5} Money earned</span><span class="value ${p.busted ? 'bust-value' : 'positive'}">+$${p.roundMoney}${p.busted ? ' (busted)' : ''}</span></div>`;
        html += `<div class="results-row"><span class="label">\u2B50 Points earned</span><span class="value ${p.busted ? 'bust-value' : 'positive'}">+${p.roundPoints}${p.busted ? ' (busted)' : ''}</span></div>`;

        html += '<div class="results-divider"></div>';

        // Rival results
        html += `<div class="results-row"><span class="label rival-color">${r.name}</span></div>`;
        html += `<div class="results-row"><span class="label">\u{1F4B5} Money earned</span><span class="value ${r.busted ? 'bust-value' : 'positive'}">+$${r.roundMoney}${r.busted ? ' (busted)' : ''}</span></div>`;
        html += `<div class="results-row"><span class="label">\u2B50 Points earned</span><span class="value ${r.busted ? 'bust-value' : 'positive'}">+${r.roundPoints}${r.busted ? ' (busted)' : ''}</span></div>`;

        document.getElementById('results-content').innerHTML = html;
        document.getElementById('btn-next-phase').textContent = isFinalRound ? 'Final Results' : 'Continue to Shop';

        // Show results panel
        document.getElementById('guest-phase-panel').style.display = 'none';
        document.getElementById('round-results-panel').style.display = '';
        document.getElementById('buy-phase-panel').style.display = 'none';
        document.getElementById('gameover-panel').style.display = 'none';

        if (!isFinalRound) {
            // Enter buy phase immediately when results appear, but keep results visible
            // until player confirms and opens the shop panel.
            startBuyPhase({ deferPanel: true });
            setPhoneBuyPhaseLayout(true);
        }

        publishState();
    }

    function handleNextPhase() {
        const isFinalRound = gameState.round >= gameState.totalRounds;

        if (isFinalRound) {
            Game.endBuyPhase(gameState);
            showGameOver();
        } else {
            showBuyPanel();
        }
    }

    // === Buy Phase ===
    function startBuyPhase(options = {}) {
        const deferPanel = !!options.deferPanel;
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

        currentMarket = isMultiplayer()
            ? { player: playerMarket, rival: rivalMarket }
            : playerMarket;
        renderShop();

        if (!deferPanel) {
            showBuyPanel();
        }
    }

    function showBuyPanel() {
        document.getElementById('guest-phase-panel').style.display = 'none';
        document.getElementById('round-results-panel').style.display = 'none';
        document.getElementById('buy-phase-panel').style.display = '';
        document.getElementById('gameover-panel').style.display = 'none';
        setPhoneBuyPhaseLayout(true);
    }

    function renderShopCard(guestId, cost, canAfford, container) {
        const guest = Game.GUESTS[guestId];

        const wrapper = document.createElement('div');
        wrapper.className = 'shop-card-wrapper' + (canAfford ? '' : ' disabled');

        const costLabel = document.createElement('div');
        costLabel.className = 'shop-card-cost';
        costLabel.textContent = '$' + cost;
        wrapper.appendChild(costLabel);

        const slot = createGuestSlot(guestId, false, { interactive: false });
        slot.removeAttribute('title');
        wrapper.appendChild(slot);

        if (guest.isShopItem) {
            const nameLabel = document.createElement('div');
            nameLabel.className = 'shop-card-name';
            nameLabel.textContent = guest.name;
            slot.appendChild(nameLabel);
        }

        bindGuestTooltipHoldInteractions(wrapper, guestId);

        const slotEmoji = slot.querySelector('.slot-emoji');
        if (slotEmoji && guest.ability) {
            const abilityMessage = `${guest.ability.name}: ${guest.ability.desc}`;
            bindAbilityTooltipInteractions(slotEmoji, abilityMessage);
        }

        if (canAfford) {
            wrapper.addEventListener('click', () => {
                if (isMultiplayer() && multiplayerRole === 'join') {
                    multiplayerSession?.publish('request-action', { action: 'buy', actor: 'rival', guestId });
                    showFeedback(`Bought ${guest.name}!`, 'money', 1500);
                    return;
                }
                if (Game.buyGuest(gameState.player, guestId)) {
                    showFeedback(`Bought ${guest.name}!`, 'money', 1500);
                    renderShop();
                    updateHUD();
                    publishState();
                }
            });
        }

        container.appendChild(wrapper);
    }

    function renderShop() {
        const shopMoney = document.getElementById('shop-money');
        const shopPlayer = gameState.player;
        shopMoney.textContent = `\u{1F4B5} $${shopPlayer.money}`;

        const grid = document.getElementById('shop-grid');
        grid.innerHTML = '';
        const upgradesPanel = document.getElementById('shop-upgrades');
        upgradesPanel.innerHTML = '';

        const readOnlyShop = false;

        // Sort guest cards by cost (cheapest first)
        const market = getLocalMarket().slice();
        market.sort((a, b) => Game.GUESTS[a].cost - Game.GUESTS[b].cost);

        // Render guest cards in the main grid
        market.forEach(guestId => {
            const guest = Game.GUESTS[guestId];
            const cost = guest.cost;
            const canAfford = !readOnlyShop && shopPlayer.money >= cost;
            renderShopCard(guestId, cost, canAfford, grid);
        });

        // Render upgrade items in the sidebar
        const upgradeLabel = document.createElement('div');
        upgradeLabel.className = 'shop-upgrades-label';
        upgradeLabel.textContent = 'UPGRADES';

        ['slotIncrease', 'heatCapIncrease'].forEach(guestId => {
            const guest = Game.GUESTS[guestId];
            let cost = guest.cost;
            if (guestId === 'slotIncrease') {
                cost = 3 + (shopPlayer.shopItemPurchases.slotIncrease * 2);
            } else if (guestId === 'heatCapIncrease') {
                cost = 4 + (shopPlayer.shopItemPurchases.heatCapIncrease * 3);
            }
            const canAfford = !readOnlyShop && shopPlayer.money >= cost;
            renderShopCard(guestId, cost, canAfford, upgradesPanel);
        });
        upgradesPanel.appendChild(upgradeLabel);
    }

    function runDoneShopping(actor = 'player') {
        if (actor === 'rival' && isMultiplayer()) {
            gameState.rival.phaseComplete = true;
            publishState();
            return;
        }

        Game.endBuyPhase(gameState);
        setPhoneBuyPhaseLayout(false);

        if (gameState.phase === 'gameover') {
            showGameOver();
        } else {
            startNewRound();
        }
        publishState();
    }

    function runBuyGuest(actor, guestId) {
        if (!gameState || gameState.phase !== 'buy' || !guestId) return;
        const { self } = getActorState(actor);
        if (Game.buyGuest(self, guestId)) {
            updateHUD();
            publishState();
        }
    }

    function handleDoneShopping() {
        if (isMultiplayer() && multiplayerRole === 'join') {
            multiplayerSession?.publish('request-action', { action: 'done-shopping', actor: 'rival' });
            showFeedback('Waiting for host to continue…', 'points', 1500);
            return;
        }

        runDoneShopping('player');
    }

    // === Game Flow ===
    function startGame(name, venueType, totalRounds, options = {}) {
        Renderer.resetAnimState();

        // Pick rival
        const venueKeys = Object.keys(Game.VENUES).filter(k => k !== venueType);
        const rivalVenue = options.rivalVenue || venueKeys[Math.floor(Math.random() * venueKeys.length)];
        const rivalName = options.rivalName || RIVAL_NAMES[Math.floor(Math.random() * RIVAL_NAMES.length)];

        gameState = Game.createGameState(name, venueType, rivalName, rivalVenue, totalRounds);
        clearVenueActors();

        // Override player deck with the loadout deck
        if (loadoutState) {
            gameState.player.fullDeck = [...loadoutState.deck];
            gameState.player.guestList = [...loadoutState.guestList];
        }
        if (options.rivalDeck?.length) gameState.rival.fullDeck = [...options.rivalDeck];
        if (options.rivalGuestList?.length) gameState.rival.guestList = [...options.rivalGuestList];

        switchScreen('game');
        startNewRound();
    }

    function startNewRound() {
        Game.startGuestPhase(gameState);
        clearRevealDoorIntel();
        playerFlashWindowInstanceId = null;
        setPhoneBuyPhaseLayout(false);

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
        setPartyView('player', false);

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

    function getAllDecks() {
        return Object.entries(Game.DECKS);
    }

    function getDefaultDeckId() {
        const decks = getAllDecks();
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
        const defaultDeckId = getDefaultDeckId();
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
        const venueNameEl = document.getElementById('loadout-venue-name');
        if (venueNameEl) venueNameEl.textContent = venue.name;
        const body = document.getElementById('loadout-venue-body');
        body.innerHTML = `
            <div class="loadout-venue-icon">${venue.emoji}</div>
            <div class="loadout-venue-name">${venue.name}</div>
            <div class="loadout-venue-desc">${venue.desc}</div>
            <div class="loadout-venue-stats">
                <span class="stat-tag">Slots: ${Math.max(0, venue.gridSize)}</span>
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

        const deckNameEl = document.getElementById('loadout-deck-name');
        if (deckNameEl) deckNameEl.textContent = deckName;

        body.innerHTML = `
            <div class="loadout-deck-preview-grid" id="loadout-deck-preview-grid"></div>
            ${!valid ? `<div class="loadout-deck-warning">Need at least ${MIN_DECK_SIZE} cards</div>` : ''}
        `;
        renderLoadoutGuestCards('loadout-deck-preview-grid', loadoutState.deck);
    }

    function renderLoadoutGuestList() {
        const body = document.getElementById('loadout-guest-list-body');
        const count = loadoutState.guestList.length;
        const valid = count >= MIN_DECK_SIZE;
        const selectedList = Game.GUEST_LISTS[loadoutState.selectedGuestListId];
        const guestListName = selectedList ? selectedList.name : 'Custom Guest List';

        const guestListNameEl = document.getElementById('loadout-guest-list-name');
        if (guestListNameEl) guestListNameEl.textContent = guestListName;

        body.innerHTML = `
            <div class="loadout-deck-preview-grid" id="loadout-guest-list-preview-grid"></div>
            ${!valid ? `<div class="loadout-deck-warning">Need at least ${MIN_DECK_SIZE} cards</div>` : ''}
        `;
                renderLoadoutGuestCards('loadout-guest-list-preview-grid', loadoutState.guestList);
    }

    function renderLoadoutGuestCards(containerId, guests) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';
        guests.forEach((guestId) => {
            const slot = createGuestSlot(guestId, false, { interactive: false });
            slot.classList.add('loadout-preview-card');
            container.appendChild(slot);
        });
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
                        <span class="stat-tag">Slots: ${Math.max(0, venue.gridSize)}</span>
                        <span class="stat-tag">Bust: ${venue.bustThreshold}</span>
                        <span class="stat-tag">${VENUE_STYLE_LABEL[venue.style]}</span>
                    </div>
                    <div class="venue-select-pool">${VENUE_POOL_DESC[id]}</div>
                </div>
            `;

            card.addEventListener('click', () => {
                if (id !== loadoutState.venueId) {
                    loadoutState.venueId = id;
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
        const decks = getAllDecks();

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
        const wrapper = document.createElement('div');
        wrapper.className = 'deck-manage-card';

        const nameEl = document.createElement('div');
        nameEl.className = 'deck-card-name' + (guest.ability ? ' has-ability' : '');
        nameEl.textContent = guest.name;
        wrapper.appendChild(nameEl);

        const slot = createGuestSlot(guestId, false, { interactive: false });
        wrapper.appendChild(slot);

        return wrapper;
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
        const multiplayerFields = document.getElementById('multiplayer-fields');
        const roundsInput = document.getElementById('round-count-input');

        function syncModeSettings() {
            const selectedMode = modeInput?.value || 'single';
            const multiplayerSelected = selectedMode === 'host' || selectedMode === 'join';
            if (multiplayerFields) multiplayerFields.style.display = multiplayerSelected ? '' : 'none';
            if (roundsInput) roundsInput.disabled = selectedMode === 'join';
        }

        modeInput?.addEventListener('change', syncModeSettings);
        syncModeSettings();

        document.getElementById('btn-start-game').addEventListener('click', async () => {
            const rawName = document.getElementById('venue-name-input').value.trim() || 'My Venue';
            const roundCount = parseInt(document.getElementById('round-count-input').value, 10) || Game.TOTAL_ROUNDS;
            const selectedMode = modeInput?.value || 'single';
            multiplayerMode = selectedMode === 'single' ? 'single' : 'multiplayer';
            multiplayerRole = selectedMode === 'join' ? 'join' : 'host';

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
                    pendingHostMatchConfig = {
                        name: escapeHtml(rawName),
                        venueType: loadoutState.venueId,
                        totalRounds: roundCount,
                    };
                    showWaitingPopup('Waiting');
                    setMultiplayerStatus('Waiting for another player...');
                } else {
                    setMultiplayerStatus('Connected. Waiting for host…');
                    multiplayerSession.publish('player-joined', {
                        profile: {
                            name: escapeHtml(rawName),
                            venueId: loadoutState.venueId,
                            deck: [...(loadoutState?.deck || [])],
                            guestList: [...(loadoutState?.guestList || [])],
                        },
                    });
                }
            } catch (err) {
                setMultiplayerStatus(err?.message || 'Unable to connect to Ably.');
            }
        });

        bindPartyCarouselInteractions();

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
            clearVenueActors();
            gameState = null;
            currentMarket = null;
            if (multiplayerSession) { multiplayerSession.close(); multiplayerSession = null; }
            closeWaitingPopup();
            pendingHostMatchConfig = null;
            multiplayerMode = 'single';
            document.getElementById('venue-name-input').value = '';
            document.getElementById('round-count-input').value = String(Game.TOTAL_ROUNDS);
            const modeSelect = document.getElementById('game-mode-input');
            if (modeSelect) modeSelect.value = 'single';
            const roundSelect = document.getElementById('round-count-input');
            if (roundSelect) roundSelect.disabled = false;
            const multiplayerFields = document.getElementById('multiplayer-fields');
            if (multiplayerFields) multiplayerFields.style.display = 'none';
            setPartyView('player', false);
            initLoadout();
            switchScreen('title');
        });

        // Remove tooltip on any click outside
        document.addEventListener('click', (e) => {
            if (tooltipEl && !e.target.closest('.guest-slot') && !e.target.closest('.shop-card-wrapper') && !e.target.closest('.guest-tooltip')) {
            }
            if (iconTooltipEl && !e.target.closest('.arriving-emoji.has-ability') && !e.target.closest('.slot-emoji.has-ability') && !e.target.closest('.effect-tooltip')) {
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
        applyPartyView(false);
        startAnimLoop();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
