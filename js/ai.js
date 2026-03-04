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

            // Rollout policy: only close under very high pressure after we've
            // already seen a couple of extra guests and further upside is tiny.
            // This keeps the AI from banking too early every round.
            const lowUpside = (continueScore - closeScore) <= 1;
            const deepIntoRun = i >= 1;
            if (heatPressure > 0.85 && lowUpside && deepIntoRun && !nearEnd) {
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

    function estimateAbilityValue(rival, player, venue, playerVenue, guest) {
        if (!guest?.ability) return Number.NEGATIVE_INFINITY;

        // Flash abilities trigger only after the guest is admitted. If admitting this
        // guest would bust immediately, the ability cannot save the round value.
        const projectedHeat = rival.heat + guest.heat;
        if (projectedHeat > venue.bustThreshold) {
            return Number.NEGATIVE_INFINITY;
        }

        // Baseline: current round value (ability includes admission).
        let value = scoreRoundValue(rival.roundMoney, rival.roundPoints, venue);

        switch (guest.ability.type) {
            case 'coolHeat': {
                // More valuable when close to busting.
                const headroom = venue.bustThreshold - rival.heat;
                value += headroom <= 1 ? guest.ability.value * 5 : guest.ability.value * 1.5;
                break;
            }
            case 'addOpponentHeat': {
                if (!player.doorClosed && !player.busted) {
                    const projected = player.heat + guest.ability.value;
                    const ratio = projected / playerVenue.bustThreshold;
                    value += ratio * 3;
                    if (projected > playerVenue.bustThreshold) value += 6;
                }
                break;
            }
            case 'scoreNow':
                value += guest.ability.value * 1.5;
                break;
            case 'queueGatecrasher': {
                if (!player.doorClosed && !player.busted) {
                    const projected = player.heat + 2;
                    const ratio = projected / playerVenue.bustThreshold;
                    value += ratio * 3;
                    if (projected > playerVenue.bustThreshold) value += 6;
                }
                break;
            }
            case 'revealNext':
            case 'revealAndReorder':
                value += 1.5;
                break;
            case 'pullForward':
            case 'bounceLeftmost':
                value += 1;
                break;
            case 'pushLeftmost':
            case 'pushAnother':
                value += 1.5;
                break;
            case 'lockAnother':
            case 'lockAdjacent':
                value += 2;
                break;
            case 'gainMoney':
                value += guest.ability.value * 1.2;
                break;
            case 'stealMoney':
                value += guest.ability.value * 2;
                break;
            case 'discardNext':
                value += 1.5;
                break;
            case 'scorePerGuest':
                value += rival.house.length * guest.ability.value * 1.2;
                break;
            case 'boostAdjacent':
                value += rival.house.length > 0 ? guest.ability.value * 1.5 : 0;
                break;
        }

        return value;
    }

    /**
     * Decide what to do with the current arriving guest.
     * Returns 'admit' | 'ability' | 'close' | null
     */
    function estimateDoorSafeAction(rival, guest, venue, player, playerVenue) {
        if (!guest) return 'close';

        // Already over threshold while this guest is at the door.
        if (rival.heat > venue.bustThreshold) {
            if (guest.ability && guest.ability.type === 'coolHeat') {
                return 'ability';
            }
            return 'close';
        }

        // Never intentionally admit a guest that causes an immediate bust.
        if ((rival.heat + guest.heat) > venue.bustThreshold) {
            return 'close';
        }

        // Early-round tempo: avoid closing immediately unless pressure is already high.
        const remainingHeatBuffer = venue.bustThreshold - rival.heat;
        if (rival.house.length < 2 && remainingHeatBuffer >= 2) {
            return 'admit';
        }

        // Monte Carlo decision between admitting, ability usage, and banking current value.
        const values = estimateAdmitVsCloseValue(rival, venue);
        const abilityValue = estimateAbilityValue(rival, player, venue, playerVenue, guest);

        if (abilityValue >= values.admitValue && abilityValue >= values.closeValue) {
            return 'ability';
        }

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
