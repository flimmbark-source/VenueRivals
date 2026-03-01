/* ============================================
   VENUE RIVALS - AI Opponent
   Guest phase decisions and buy phase strategy
   ============================================ */

const AI = (() => {

    /**
     * Decide what to do with the current arriving guest.
     * Returns 'admit' | 'ability' | 'close' | null
     */
    function estimateDoorSafeAction(rival, guest, venue, player, playerVenue) {
        if (!guest) return 'close';

        // Already over threshold while this guest is at the door.
        if (rival.heat > venue.bustThreshold) {
            if (guest.ability && (guest.ability.type === 'reduceHeat' || guest.ability.type === 'inspect')) {
                return 'ability';
            }
            return 'close';
        }

        // If next draw likely busts, prefer stabilizing / banking.
        const avgHeat = 3;
        const projectedAfterNextDraw = rival.heat + avgHeat;

        if (projectedAfterNextDraw > venue.bustThreshold) {
            if (guest.ability && guest.ability.type === 'reduceHeat') return 'ability';
            if (rival.roundMoney + rival.roundPoints > 7) return 'close';
        }

        // Offensive pressure if player is vulnerable.
        if (guest.ability && (guest.ability.type === 'addOpponentHeat' || guest.ability.type === 'inspect')) {
            if (!player.doorClosed && !player.busted) {
                const playerHeatRatio = player.heat / playerVenue.bustThreshold;
                if (playerHeatRatio > 0.5) return 'ability';
            }
        }

        // Protective use of heat-reduction abilities if near threshold.
        if (guest.ability && guest.ability.type === 'reduceHeat' && rival.heat / venue.bustThreshold > 0.7) {
            return 'ability';
        }

        return 'admit';
    }

    function decideGuestAction(state) {
        const rival = state.rival;
        const player = state.player;
        const venue = Game.VENUES[rival.venueId];
        const playerVenue = Game.VENUES[player.venueId];

        if (!rival.arrivingGuest || rival.doorClosed || rival.busted) return null;

        const guest = Game.GUESTS[rival.arrivingGuest];
        return estimateDoorSafeAction(rival, guest, venue, player, playerVenue);
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
