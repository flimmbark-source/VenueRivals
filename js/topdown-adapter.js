/* ============================================
   VENUE RIVALS - Top-Down Adapter
   Bridges existing game logic with venue scene
   ============================================ */

const TopDownAdapter = (() => {
    let venueScene = null;
    let canvas = null;
    let ctx = null;
    let animationFrameId = null;

    function initialize() {
        canvas = document.getElementById('venue-canvas');
        if (!canvas) {
            console.error('Venue canvas not found');
            return false;
        }

        ctx = canvas.getContext('2d');
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        return true;
    }

    function resizeCanvas() {
        if (!canvas) return;
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        if (venueScene) {
            venueScene.canvasWidth = canvas.width;
            venueScene.canvasHeight = canvas.height;
        }
    }

    function startScene(venueId) {
        if (!canvas) return;
        venueScene = new VenueScene.Scene(venueId, canvas.width, canvas.height);
        startRenderLoop();
    }

    function stopScene() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        if (venueScene) {
            venueScene.clearAllGuests();
            venueScene = null;
        }
    }

    function startRenderLoop() {
        function render() {
            if (!venueScene || !ctx) return;

            venueScene.update();
            venueScene.draw(ctx);

            animationFrameId = requestAnimationFrame(render);
        }
        render();
    }

    function syncGuestsFromState(player) {
        if (!venueScene) return;

        const stateInstanceIds = new Set();

        for (const entry of player.house) {
            if (typeof entry === 'string') continue;
            stateInstanceIds.add(entry.instanceId);

            const existingActor = venueScene.actors.find(a => a.instanceId === entry.instanceId);
            if (!existingActor) {
                const guestId = typeof entry === 'string' ? entry : entry.guestId;
                venueScene.addGuest(entry.instanceId, guestId);
            }
        }

        for (let i = venueScene.actors.length - 1; i >= 0; i--) {
            const actor = venueScene.actors[i];
            if (!stateInstanceIds.has(actor.instanceId)) {
                venueScene.removeGuest(actor.instanceId);
            }
        }
    }

    function updateHUD(gameState) {
        const player = gameState.player;
        const venue = Game.VENUES[player.venueId];

        document.getElementById('hud-round-num').textContent = gameState.round;
        document.getElementById('hud-round-total').textContent = gameState.totalRounds;

        const phaseText = gameState.phase === 'guest' ? 'GUEST PHASE' : 'BUY PHASE';
        document.getElementById('hud-phase').textContent = phaseText;

        const venueName = player.name || venue.name;
        document.getElementById('player-venue-name').textContent = venueName;

        const heatCap = Game.getHeatCapacity(venue, player);
        const heatPct = Math.min(100, (player.heat / heatCap) * 100);
        const heatBar = document.getElementById('player-heat-bar');
        if (heatBar) {
            heatBar.style.width = heatPct + '%';

            if (heatPct > 90) heatBar.style.background = '#ff3333';
            else if (heatPct > 70) heatBar.style.background = '#ff6e6e';
            else if (heatPct > 50) heatBar.style.background = '#ffd166';
            else heatBar.style.background = '#2cb67d';
        }

        document.getElementById('player-heat-text').textContent = `${player.heat}/${heatCap}`;
        document.getElementById('player-money').textContent = `$${player.money}`;
        document.getElementById('player-pts-badge').textContent = player.points;
        document.getElementById('player-guest-count').textContent = player.house.length;
    }

    function showGuestFocusPanel(guest, canAdmit, canUseAbility, canClose) {
        const panel = document.getElementById('guest-focus-panel');
        if (!panel) return;

        document.getElementById('focus-guest-portrait').textContent = guest.emoji;
        document.getElementById('focus-guest-name').textContent = guest.name;
        document.getElementById('focus-heat').textContent = guest.heat;
        document.getElementById('focus-money').textContent = guest.money;
        document.getElementById('focus-points').textContent = guest.points;

        const abilityEl = document.getElementById('focus-guest-ability');
        if (guest.ability && guest.ability.trigger === 'flash') {
            abilityEl.textContent = `${guest.ability.icon || ''} ${guest.ability.name}: ${guest.ability.desc}`;
            abilityEl.style.display = 'inline-block';
        } else {
            abilityEl.style.display = 'none';
        }

        const btnAdmit = document.getElementById('btn-admit');
        const btnAbility = document.getElementById('btn-ability');
        const btnClose = document.getElementById('btn-close-door');

        if (btnAdmit) btnAdmit.disabled = !canAdmit;
        if (btnAbility) {
            btnAbility.disabled = !canUseAbility;
            btnAbility.style.display = guest.ability ? '' : 'none';
        }
        if (btnClose) btnClose.disabled = !canClose;

        panel.style.display = '';
    }

    function hideGuestFocusPanel() {
        const panel = document.getElementById('guest-focus-panel');
        if (panel) {
            panel.style.display = 'none';
        }
    }

    function showOverlay(overlayId) {
        const overlay = document.getElementById(overlayId);
        if (overlay) {
            overlay.style.display = 'flex';
        }
    }

    function hideOverlay(overlayId) {
        const overlay = document.getElementById(overlayId);
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    return {
        initialize,
        startScene,
        stopScene,
        syncGuestsFromState,
        updateHUD,
        showGuestFocusPanel,
        hideGuestFocusPanel,
        showOverlay,
        hideOverlay,
        resizeCanvas
    };
})();
