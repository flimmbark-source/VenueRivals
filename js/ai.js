/* ============================================
   VENUE RIVALS - AI Opponent
   Parallel round decisions for rival venue.
   ============================================ */

const AI = (() => {
    function chooseAction(state) {
        const rival = state.rival.current;
        const player = state.player.current;

        if (rival.closed) return null;
        if (rival.pendingAbilities.length > 0 && Math.random() < 0.5) return 'ability';

        const safeMargin = rival.limit - rival.occupancy;
        const playerClosed = player.closed;

        if (safeMargin <= 2) return 'close';
        if (playerClosed && safeMargin <= 4 && Math.random() < 0.7) return 'close';
        if (rival.occupancy >= rival.limit - 1 && Math.random() < 0.8) return 'close';

        return 'admit';
    }

    function takeParallelStep(state) {
        const action = chooseAction(state);
        if (!action) return [];
        return Game.executeAction(state, 'rival', action);
    }

    return { takeParallelStep };
})();
