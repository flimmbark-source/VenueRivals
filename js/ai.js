/* ============================================
   VENUE RIVALS - AI Opponent
   Picks one simultaneous guest action per round
   ============================================ */

const AI = (() => {
    function chooseRoundAction(state) {
        const rival = state.rival;
        const guest = rival.currentGuest;
        if (!guest) return 'close';

        const behind = rival.totalEarnings < state.player.totalEarnings;
        const overcrowded = rival.houseOccupancy >= rival.maxOccupancy;

        if (guest.ability.type === 'forceClose' || guest.ability.type === 'disruptAttraction') {
            return 'ability';
        }

        if (overcrowded && Math.random() < 0.6) {
            return 'close';
        }

        if (behind && (guest.ability.type === 'revBonus' || guest.ability.type === 'attraction' || guest.ability.type === 'bonusCustomers')) {
            return 'ability';
        }

        if (guest.admitRep >= 1 && rival.houseOccupancy < rival.maxOccupancy + 1) {
            return 'admit';
        }

        return Math.random() < 0.5 ? 'ability' : 'admit';
    }

    return { chooseRoundAction };
})();
