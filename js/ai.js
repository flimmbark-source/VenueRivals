/* ============================================
   VENUE RIVALS - AI Opponent
   Guest phase decisions and buy phase strategy
   ============================================ */

const AI = (() => {
    const MONTE_CARLO_RUNS = 120;

    function scoreRoundValue(money, points, venue) {
        let total = money + points;
        if (venue.style === 'money') total += money;
        if (venue.style === 'points') total += points;
        return total;
    }

    function shuffleCopy(list) {
        const result = [...list];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }

    function estimateRoundValueForGuest(rival, venue, guestId) {
        const sampledDeck = [...rival.fullDeck, guestId];
        let totalScore = 0;

        for (let i = 0; i < MONTE_CARLO_RUNS; i++) {
            const drawOrder = shuffleCopy(sampledDeck);
            let heat = 0;
            let money = 0;
            let points = 0;
            let activeGuests = 0;

            for (let j = 0; j < drawOrder.length; j++) {
                const guest = Game.GUESTS[drawOrder[j]];
                heat += guest.heat;
                money += guest.money;
                points += guest.points;

                if (heat > venue.bustThreshold) {
                    money = Math.floor(money * 0.25);
                    points = Math.floor(points * 0.25);
                    break;
                }

                activeGuests += 1;
                if (activeGuests >= venue.gridSize) break;
            }

            totalScore += scoreRoundValue(money, points, venue);
        }

        return totalScore / MONTE_CARLO_RUNS;
    }

    function rankMarketByMonteCarlo(rival, market, venue) {
        return [...market].sort((a, b) => {
            const aGuest = Game.GUESTS[a];
            const bGuest = Game.GUESTS[b];

            const aValue = estimateRoundValueForGuest(rival, venue, a) / Math.max(1, aGuest.cost);
            const bValue = estimateRoundValueForGuest(rival, venue, b) / Math.max(1, bGuest.cost);

            if (bValue === aValue) return aGuest.cost - bGuest.cost;
            return bValue - aValue;
        });
    }

    function estimateRolloutFromDoorState(baseState, orderedDeck, venue) {
        let heat = baseState.heat;
        let money = baseState.money;
        let points = baseState.points;

        for (let i = 0; i < orderedDeck.length; i++) {
            const closeScore = scoreRoundValue(money, points, venue);
            const nextGuest = Game.GUESTS[orderedDeck[i]];
            const nextHeat = heat + nextGuest.heat;
            const nextMoney = money + nextGuest.money;
            const nextPoints = points + nextGuest.points;

            if (nextHeat > venue.bustThreshold) {
                const bustedMoney = Math.floor(nextMoney * 0.25);
                const bustedPoints = Math.floor(nextPoints * 0.25);
                return scoreRoundValue(bustedMoney, bustedPoints, venue);
            }

            const continueScore = scoreRoundValue(nextMoney, nextPoints, venue);
            const heatPressure = nextHeat / venue.bustThreshold;
            const nearEnd = i >= orderedDeck.length - 1;

            // Rollout policy: close when pressure is high and extending appears marginal.
            if (heatPressure > 0.8 && (continueScore - closeScore) <= 2 && !nearEnd) {
                return closeScore;
            }

            heat = nextHeat;
            money = nextMoney;
            points = nextPoints;
        }

        return scoreRoundValue(money, points, venue);
    }

    function estimateAdmitVsCloseValue(rival, venue) {
        const closeValue = scoreRoundValue(rival.roundMoney, rival.roundPoints, venue);

        // If no deck remains, admitting and closing are equivalent.
        if (rival.roundDeck.length === 0) {
            return { closeValue, admitValue: closeValue };
        }

        let admitTotal = 0;
        for (let i = 0; i < MONTE_CARLO_RUNS; i++) {
            const orderedDeck = shuffleCopy(rival.roundDeck);

            const nextGuest = Game.GUESTS[orderedDeck[0]];
            let heat = rival.heat + nextGuest.heat;
            let money = rival.roundMoney + nextGuest.money;
            let points = rival.roundPoints + nextGuest.points;

            if (heat > venue.bustThreshold) {
                money = Math.floor(money * 0.25);
                points = Math.floor(points * 0.25);
                admitTotal += scoreRoundValue(money, points, venue);
                continue;
            }

            const remainder = orderedDeck.slice(1);
            admitTotal += estimateRolloutFromDoorState({ heat, money, points }, remainder, venue);
        }

        return {
            closeValue,
            admitValue: admitTotal / MONTE_CARLO_RUNS,
        };
    }

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

        // Keep tactical ability usage first.
        if (guest.ability && (guest.ability.type === 'addOpponentHeat' || guest.ability.type === 'inspect')) {
            if (!player.doorClosed && !player.busted) {
                const playerHeatRatio = player.heat / playerVenue.bustThreshold;
                if (playerHeatRatio > 0.5) return 'ability';
            }
        }

        if (guest.ability && guest.ability.type === 'reduceHeat' && rival.heat / venue.bustThreshold > 0.7) {
            return 'ability';
        }

        // Monte Carlo decision between admitting and banking current value.
        const values = estimateAdmitVsCloseValue(rival, venue);
        if (values.admitValue >= values.closeValue) return 'admit';
        return 'close';
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

        // Sort market by Monte Carlo estimate of next-round performance.
        const ranked = rankMarketByMonteCarlo(rival, market, venue);

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
