/* ============================================
   VENUE RIVALS - Prototype App Controller
   ============================================ */

(function () {
    'use strict';

    let gameState = null;
    let selectedProfile = null;
    let loopId = null;
    let lastTs = 0;

    const screens = {
        title: document.getElementById('title-screen'),
        how: document.getElementById('how-to-play-screen'),
        setup: document.getElementById('setup-screen'),
        game: document.getElementById('game-screen'),
        gameover: document.getElementById('gameover-screen'),
    };

    const ui = {
        roundLabel: document.getElementById('ui-round'),
        timerLabel: document.getElementById('ui-timer'),
        phaseLabel: document.getElementById('ui-phase'),
        pScore: document.getElementById('ui-player-score'),
        rScore: document.getElementById('ui-rival-score'),
        pCap: document.getElementById('ui-player-capacity'),
        rCap: document.getElementById('ui-rival-capacity'),
        pOcc: document.getElementById('ui-player-occupancy'),
        rOcc: document.getElementById('ui-rival-occupancy'),
        pPanel: document.getElementById('player-slots'),
        rPanel: document.getElementById('rival-slots'),
        offer: document.getElementById('offer-row'),
        activeBtn: document.getElementById('btn-active'),
        activeMeta: document.getElementById('active-meta'),
        feed: document.getElementById('event-feed'),
        shopPanel: document.getElementById('shop-panel'),
        shopTimer: document.getElementById('shop-timer'),
        gameoverTitle: document.getElementById('gameover-title'),
        gameoverMsg: document.getElementById('gameover-message'),
        gameoverStats: document.getElementById('gameover-stats'),
    };

    function switchScreen(name) {
        Object.values(screens).forEach((s) => s.classList.remove('active'));
        screens[name].classList.add('active');
    }

    function sec(n) {
        const s = Math.max(0, Math.ceil(n));
        const m = Math.floor(s / 60);
        const r = s % 60;
        return `${m}:${String(r).padStart(2, '0')}`;
    }

    function slotHtml(guest) {
        if (!guest) return '<div class="slot empty">—</div>';
        return `<div class="slot filled role-${guest.role}"><div>${guest.icon}</div><small>${guest.name}</small></div>`;
    }

    function renderBoard(side) {
        const p = gameState.players[side];
        const root = side === 'player' ? ui.pPanel : ui.rPanel;
        root.innerHTML = p.slots.map(slotHtml).join('');
    }

    function renderOffer() {
        const p = gameState.players.player;
        ui.offer.innerHTML = '';
        p.offer.forEach((id, i) => {
            const g = Game.GUESTS[id];
            const can = g && (p.capacity >= g.cost || p.statuses.freeNextAdmit);
            const card = document.createElement('button');
            card.className = `offer-card ${can ? '' : 'disabled'}`;
            card.innerHTML = `<div class="offer-icon">${g.icon}</div><div class="offer-name">${g.name}</div><div class="offer-meta">${g.role} • cost ${g.cost}</div>`;
            card.disabled = !can || gameState.phase !== 'live';
            card.addEventListener('click', () => Game.admitFromOffer(gameState, 'player', i));
            ui.offer.appendChild(card);
        });
    }

    function renderFeed() {
        ui.feed.innerHTML = gameState.notifications
            .slice(0, 7)
            .map((n) => `<div class="feed-item ${n.kind}">${n.text}</div>`)
            .join('');
    }

    function renderHUD() {
        const p = gameState.players.player;
        const r = gameState.players.rival;

        ui.roundLabel.textContent = `${gameState.round} / ${Game.TOTAL_ROUNDS}`;
        ui.timerLabel.textContent = sec(gameState.phase === 'shop' ? gameState.shopTimer : gameState.timer);
        ui.phaseLabel.textContent = gameState.phase === 'shop' ? 'Shop / Loadout' : 'Live Round';
        ui.pScore.textContent = Math.round(p.totalScore);
        ui.rScore.textContent = Math.round(r.totalScore);
        ui.pCap.textContent = `${p.capacity.toFixed(0)} / ${p.capacityMax}`;
        ui.rCap.textContent = `${r.capacity.toFixed(0)} / ${r.capacityMax}`;
        ui.pOcc.textContent = `${Game.countGuests(p)} / ${p.maxOccupancy}`;
        ui.rOcc.textContent = `${Game.countGuests(r)} / ${r.maxOccupancy}`;

        const active = Game.ACTIVES[p.activeId];
        ui.activeBtn.textContent = `Active: ${active.name}`;
        ui.activeBtn.disabled = gameState.phase !== 'live' || p.activeCooldownLeft > 0;
        ui.activeMeta.textContent = p.activeCooldownLeft > 0 ? `Cooldown: ${Math.ceil(p.activeCooldownLeft)}s` : active.desc;

        ui.shopPanel.style.display = gameState.phase === 'shop' ? '' : 'none';
        ui.shopTimer.textContent = sec(gameState.shopTimer || 0);

        renderBoard('player');
        renderBoard('rival');
        renderOffer();
        renderFeed();
    }

    function endMatch() {
        const p = gameState.players.player;
        const r = gameState.players.rival;
        switchScreen('gameover');

        if (gameState.winner === 'tie') {
            ui.gameoverTitle.textContent = 'Draw';
            ui.gameoverMsg.textContent = 'Both venues ended with the same score after 3 rounds.';
        } else if (gameState.winner === 'player') {
            ui.gameoverTitle.textContent = 'You Win!';
            ui.gameoverMsg.textContent = 'Your venue outscored the rival in this simultaneous match.';
        } else {
            ui.gameoverTitle.textContent = 'You Lose';
            ui.gameoverMsg.textContent = 'The rival edged you out this time.';
        }

        ui.gameoverStats.innerHTML = `
            <div class="gameover-stat-card"><div class="stat-label">Your Score</div><div class="stat-value">${Math.round(p.totalScore)}</div></div>
            <div class="gameover-stat-card"><div class="stat-label">Rival Score</div><div class="stat-value">${Math.round(r.totalScore)}</div></div>
            <div class="gameover-stat-card"><div class="stat-label">Your Profile</div><div class="stat-value">${p.profileName}</div></div>
            <div class="gameover-stat-card"><div class="stat-label">Rival Profile</div><div class="stat-value">${r.profileName}</div></div>
        `;
    }

    function gameLoop(ts) {
        if (!gameState) return;
        if (!lastTs) lastTs = ts;
        const dt = Math.min(0.25, (ts - lastTs) / 1000);
        lastTs = ts;

        Game.tick(gameState, dt);
        AI.tick(gameState, dt);
        renderHUD();

        if (gameState.phase === 'gameover') {
            cancelAnimationFrame(loopId);
            loopId = null;
            endMatch();
            return;
        }
        loopId = requestAnimationFrame(gameLoop);
    }

    function drawProfileOptions() {
        const root = document.getElementById('profile-grid');
        root.innerHTML = '';
        Object.values(Game.PROFILES).forEach((profile) => {
            const house = Game.HOUSES[profile.houseId];
            const passive = Game.PASSIVES[profile.passiveId];
            const active = Game.ACTIVES[profile.activeId];

            const el = document.createElement('div');
            el.className = 'venue-type-card';
            el.dataset.profile = profile.id;
            el.innerHTML = `
                <h3>${profile.name}</h3>
                <p><strong>House:</strong> ${house.name}</p>
                <p>${house.trait}</p>
                <p><strong>Passive:</strong> ${passive.name}</p>
                <p><strong>Active:</strong> ${active.name}</p>
            `;

            el.addEventListener('click', () => {
                document.querySelectorAll('#profile-grid .venue-type-card').forEach((c) => c.classList.remove('selected'));
                el.classList.add('selected');
                selectedProfile = profile.id;
                document.getElementById('btn-start-game').disabled = false;
            });

            root.appendChild(el);
        });
    }

    function startGame() {
        const name = (document.getElementById('venue-name-input').value || 'My Venue').trim();
        gameState = Game.createMatchState(name, selectedProfile || 'tempo_hustle');
        Game.notify(gameState, 'Simultaneous match start: both sides play in real time.', 'neutral');
        switchScreen('game');
        lastTs = 0;
        cancelAnimationFrame(loopId);
        loopId = requestAnimationFrame(gameLoop);
    }

    function init() {
        document.getElementById('btn-new-game').addEventListener('click', () => {
            drawProfileOptions();
            switchScreen('setup');
        });
        document.getElementById('btn-how-to-play').addEventListener('click', () => switchScreen('how'));
        document.getElementById('btn-back-to-title').addEventListener('click', () => switchScreen('title'));
        document.getElementById('btn-start-game').addEventListener('click', startGame);
        document.getElementById('btn-play-again').addEventListener('click', () => switchScreen('title'));

        ui.activeBtn.addEventListener('click', () => {
            if (gameState) Game.useActive(gameState, 'player');
        });

        switchScreen('title');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
