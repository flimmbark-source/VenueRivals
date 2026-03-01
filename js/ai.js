/* ============================================
   VENUE RIVALS - AI Opponent Behavior
   ============================================ */

const AI = (() => {
    function chooseGuestAction(state) {
        const rival = state.rival;
        const player = state.player;

        if (rival.phaseDone || state.phase !== 'guest') return null;

        const dangerLeft = rival.dangerCap - rival.danger;
        const canActivate = rival.doorGuest && rival.doorGuest.activatable;

        if (!rival.usedVenueActive && dangerLeft <= 3 && Math.random() < 0.6) return 'venue-active';
        if (canActivate && (dangerLeft <= 3 || Math.random() < 0.35)) return 'activate';
        if (dangerLeft <= 2) return 'close';
        if (player.phaseDone && dangerLeft <= 4 && Math.random() < 0.75) return 'close';
        if (Math.random() < 0.12) return 'close';
        return 'admit';
    }

    function chooseBuy(state) {
        if (state.phase !== 'buy') return null;
        const money = state.rival.roundMoney;
        const offers = [...state.market.rival].sort((a, b) => b.cost - a.cost);
        return offers.find(o => money >= Math.max(1, o.cost - state.rival.buyDiscount)) || null;
    }

    function runGuestStep(state) {
        const action = chooseGuestAction(state);
        if (!action) return [];
        return Game.executeAction(state, 'rival', action);
    }

    function runBuyPhase(state) {
        const messages = [];
        let guard = 12;
        while (guard-- > 0) {
            const choice = chooseBuy(state);
            if (!choice) break;
            const result = Game.buyGuest(state, 'rival', choice.guestId);
            if (!result.ok) break;
            messages.push(result.message);
        }
        return messages;
    }

    return {
        runGuestStep,
        runBuyPhase,
    };
})();
