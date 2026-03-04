/* ============================================
   VENUE RIVALS - Top-Down Integration
   Hooks to integrate topdown adapter with existing app.js
   ============================================ */

(function() {
    'use strict';

    // Wait for DOM and other scripts to load
    document.addEventListener('DOMContentLoaded', function() {
        // Initialize the top-down adapter
        TopDownAdapter.initialize();

        // Hook into game screen display
        const originalGameScreen = document.getElementById('game-screen');
        if (originalGameScreen) {
            const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.attributeName === 'class') {
                        const classList = originalGameScreen.classList;
                        if (classList.contains('active')) {
                            onGameScreenActive();
                        } else {
                            onGameScreenInactive();
                        }
                    }
                });
            });

            observer.observe(originalGameScreen, {
                attributes: true,
                attributeFilter: ['class']
            });
        }

        // Intercept the render loop to sync with venue scene
        setupGameLoopIntercept();
    });

    function onGameScreenActive() {
        // Game screen just became active
        console.log('Game screen activated - initializing venue scene');
    }

    function onGameScreenInactive() {
        // Game screen deactivated
        TopDownAdapter.stopScene();
    }

    function setupGameLoopIntercept() {
        // We'll hook into the game's rendering by monitoring key elements
        // and syncing the venue scene whenever the game state updates

        // Monitor the player area for changes
        const observeGameState = setInterval(function() {
            const gameScreen = document.getElementById('game-screen');
            if (!gameScreen || !gameScreen.classList.contains('active')) {
                return;
            }

            // Check if we have a game state we can access
            // The actual integration will happen via events dispatched by app.js
            syncVenueSceneIfNeeded();
        }, 100);
    }

    function syncVenueSceneIfNeeded() {
        // This will be called by the main app when state changes
        // For now, just a placeholder
    }

    // Expose global hook for app.js to call
    window.TopDown = {
        startGame: function(gameState) {
            const venueId = gameState.player.venueId;
            TopDownAdapter.startScene(venueId);
            TopDownAdapter.updateHUD(gameState);
        },

        updateGame: function(gameState) {
            TopDownAdapter.syncGuestsFromState(gameState.player);
            TopDownAdapter.updateHUD(gameState);

            // Update guest focus panel if there's an arriving guest
            if (gameState.phase === 'guest' && gameState.player.arrivingGuest) {
                const guest = Game.GUESTS[gameState.player.arrivingGuest];
                const canAdmit = !gameState.player.doorClosed && !gameState.player.busted;
                const canUseAbility = canAdmit && guest.ability && guest.ability.trigger === 'flash';
                const canClose = !gameState.player.doorClosed && !gameState.player.busted;

                TopDownAdapter.showGuestFocusPanel(guest, canAdmit, canUseAbility, canClose);
            } else {
                TopDownAdapter.hideGuestFocusPanel();
            }

            // Show/hide overlays based on phase
            if (gameState.phase === 'guest') {
                TopDownAdapter.hideOverlay('buy-phase-panel');
                TopDownAdapter.hideOverlay('gameover-panel');
            }
        },

        showBuyPhase: function() {
            TopDownAdapter.hideGuestFocusPanel();
            TopDownAdapter.showOverlay('buy-phase-panel');
        },

        showResults: function() {
            TopDownAdapter.hideGuestFocusPanel();
            TopDownAdapter.showOverlay('round-results-panel');
        },

        hideResults: function() {
            TopDownAdapter.hideOverlay('round-results-panel');
        },

        showGameOver: function() {
            TopDownAdapter.hideGuestFocusPanel();
            TopDownAdapter.showOverlay('gameover-panel');
        },

        stopGame: function() {
            TopDownAdapter.stopScene();
            TopDownAdapter.hideGuestFocusPanel();
        }
    };

})();
