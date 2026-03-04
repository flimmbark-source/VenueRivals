/* ============================================
   VENUE RIVALS - Top-Down Hooks
   Monkey patches to integrate with existing app.js
   ============================================ */

(function() {
    'use strict';

    let lastGameState = null;
    let isTopDownActive = false;

    // Wait for everything to load
    window.addEventListener('load', function() {
        console.log('Top-down hooks initializing...');

        // Initialize adapter
        if (typeof TopDownAdapter !== 'undefined') {
            TopDownAdapter.initialize();
        }

        // Hook into screen transitions
        hookScreenTransitions();

        // Hook into game state changes
        hookGameStateUpdates();

        // Start monitoring
        startMonitoring();
    });

    function hookScreenTransitions() {
        const gameScreen = document.getElementById('game-screen');
        if (!gameScreen) return;

        // Use MutationObserver to detect when game screen becomes active
        const observer = new MutationObserver(function(mutations) {
            const isActive = gameScreen.classList.contains('active');

            if (isActive && !isTopDownActive) {
                onGameScreenActivated();
            } else if (!isActive && isTopDownActive) {
                onGameScreenDeactivated();
            }
        });

        observer.observe(gameScreen, {
            attributes: true,
            attributeFilter: ['class']
        });
    }

    function onGameScreenActivated() {
        console.log('Game screen activated');
        isTopDownActive = true;

        // Give the game a moment to initialize
        setTimeout(function() {
            // Try to access game state from global scope if exposed
            if (window.gameState || window.App?.gameState) {
                const gs = window.gameState || window.App.gameState;
                startTopDownGame(gs);
            }
        }, 100);
    }

    function onGameScreenDeactivated() {
        console.log('Game screen deactivated');
        isTopDownActive = false;
        if (typeof TopDownAdapter !== 'undefined') {
            TopDownAdapter.stopScene();
        }
    }

    function startTopDownGame(gameState) {
        if (!gameState || !gameState.player) return;

        console.log('Starting top-down game for venue:', gameState.player.venueId);

        if (typeof TopDownAdapter !== 'undefined') {
            TopDownAdapter.startScene(gameState.player.venueId);
            TopDownAdapter.updateHUD(gameState);
            lastGameState = gameState;
        }
    }

    function hookGameStateUpdates() {
        // Since we can't easily modify app.js, we'll poll for changes
        // This is not ideal but works for the prototype
    }

    function startMonitoring() {
        setInterval(function() {
            if (!isTopDownActive) return;

            // Try to get current game state
            const gameState = window.gameState || window.App?.gameState;
            if (!gameState) return;

            // Check if this is the first time seeing this state
            if (!lastGameState) {
                startTopDownGame(gameState);
                return;
            }

            // Update scene
            if (typeof TopDownAdapter !== 'undefined') {
                TopDownAdapter.syncGuestsFromState(gameState.player);
                TopDownAdapter.updateHUD(gameState);

                // Handle guest focus panel
                if (gameState.phase === 'guest' && gameState.player.arrivingGuest &&
                    !gameState.player.doorClosed && !gameState.player.busted) {
                    const guest = Game.GUESTS[gameState.player.arrivingGuest];
                    if (guest) {
                        const canAdmit = true;
                        const canUseAbility = guest.ability && guest.ability.trigger === 'flash';
                        const canClose = true;

                        TopDownAdapter.showGuestFocusPanel(guest, canAdmit, canUseAbility, canClose);
                    }
                } else if (gameState.player.doorClosed || gameState.player.busted || gameState.player.phaseComplete) {
                    TopDownAdapter.hideGuestFocusPanel();
                }
            }

            lastGameState = gameState;
        }, 50); // Poll every 50ms
    }

    // Expose global access point
    window.TopDownHooks = {
        updateGameState: function(gameState) {
            if (!isTopDownActive) return;
            lastGameState = gameState;

            if (typeof TopDownAdapter !== 'undefined') {
                TopDownAdapter.syncGuestsFromState(gameState.player);
                TopDownAdapter.updateHUD(gameState);
            }
        }
    };

})();
