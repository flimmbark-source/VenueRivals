/* ============================================
   VENUE RIVALS - AI Opponent
   Guest phase decisions and buy phase strategy
   ============================================ */

const AI = (() => {

    /**
     * Decide what to do with the current arriving guest.
     * Returns 'admit' | 'ability' | 'close' | null
     */
    function decideGuestAction(state) {
        const rival = state.rival;
        const player = state.player;
        const venue = Game.VENUES[rival.venueId];

        if (!rival.arrivingGuest || rival.doorClosed || rival.busted) return null;

        const guest = Game.GUESTS[rival.arrivingGuest];
        // Arriving guest already contributes while at the door.
        const heatAfterAdmit = rival.heat;
        const heatRatio = rival.heat / venue.bustThreshold;
        const heatRatioAfter = heatAfterAdmit / venue.bustThreshold;

        // Would bust if admitted
        if (heatAfterAdmit > venue.bustThreshold) {
            // Try defensive ability first
            if (guest.ability && (guest.ability.type === 'reduceHeat' || guest.ability.type === 'inspect')) {
                return 'ability';
            }
            return 'close';
        }

        // Offensive ability: if opponent is vulnerable, use it
        if (guest.ability && (guest.ability.type === 'addOpponentHeat' || guest.ability.type === 'inspect')) {
            if (!player.doorClosed && !player.busted) {
                const playerVenue = Game.VENUES[player.venueId];
                const playerHeatRatio = player.heat / playerVenue.bustThreshold;
                if (playerHeatRatio > 0.55) {
                    return 'ability';
                }
            }
        }

        // Defensive ability when heat is getting high
        if (guest.ability && guest.ability.type === 'reduceHeat' && heatRatio > 0.55) {
            return 'ability';
        }

        // Very dangerous zone - close unless guest is highly valuable
        if (heatRatioAfter > 0.9) {
            if (guest.money + guest.points >= 6) {
                return Math.random() < 0.4 ? 'admit' : 'close';
            }
            return 'close';
        }

        // Dangerous zone with decent earnings banked
        if (heatRatioAfter > 0.75 && rival.roundMoney + rival.roundPoints > 10) {
            if (Math.random() < 0.35) return 'close';
        }

        // Moderate risk zone
        if (heatRatioAfter > 0.65 && rival.roundMoney + rival.roundPoints > 15) {
            if (Math.random() < 0.2) return 'close';
        }

        // Default: admit
        return 'admit';
    }

    /**
     * AI buy phase: buy guests from the market.
     * Returns array of guestIds to buy.
     */
    function decideBuyPhaseActions(state, market) {
        const rival = state.rival;
        const purchases = [];
        const venue = Game.VENUES[rival.venueId];

        // Sort market by value heuristic
        const ranked = [...market].sort((a, b) => {
            const ga = Game.GUESTS[a];
            const gb = Game.GUESTS[b];
            let aScore = ga.money + ga.points;
            let bScore = gb.money + gb.points;
            if (ga.ability) aScore += 2;
            if (gb.ability) bScore += 2;
            // Prefer venue-aligned guests
            if (venue.style === 'money') { aScore += ga.money; bScore += gb.money; }
            if (venue.style === 'points') { aScore += ga.points; bScore += gb.points; }
            return bScore - aScore;
        });

        let budget = rival.money;
        for (const guestId of ranked) {
            const guest = Game.GUESTS[guestId];
            if (guest.cost <= budget && purchases.length < 3) {
                purchases.push(guestId);
                budget -= guest.cost;
            }
        }

        return purchases;
    }

    return { decideGuestAction, decideBuyPhaseActions };
})();
