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

    function getHeatCapacity(venue, player) {
        return Game.getHeatCapacity(venue, player);
    }

    function estimateRoundValueForGuest(rival, venue, guestId) {
        const sampledDeck = [...rival.fullDeck, guestId];
        const bustPenalty = Game.BUST_PENALTY;
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

                if (heat > getHeatCapacity(venue, rival)) {
                    money = Math.floor(money * bustPenalty);
                    points = Math.floor(points * bustPenalty);
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

    function estimateRolloutFromDoorState(baseState, orderedDeck, venue, heatCap) {
        let heat = baseState.heat;
        let money = baseState.money;
        let points = baseState.points;
        const bustPenalty = Game.BUST_PENALTY;

        for (let i = 0; i < orderedDeck.length; i++) {
            const closeScore = scoreRoundValue(money, points, venue);
            const nextGuest = Game.GUESTS[orderedDeck[i]];
            const nextHeat = heat + nextGuest.heat;
            const nextMoney = money + nextGuest.money;
            const nextPoints = points + nextGuest.points;

            if (nextHeat > heatCap) {
                const bustedMoney = Math.floor(nextMoney * bustPenalty);
                const bustedPoints = Math.floor(nextPoints * bustPenalty);
                return scoreRoundValue(bustedMoney, bustedPoints, venue);
            }

            const continueScore = scoreRoundValue(nextMoney, nextPoints, venue);
            const heatPressure = nextHeat / heatCap;
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
        const arrivingGuest = Game.GUESTS[rival.arrivingGuest];
        // Close value includes the arriving guest because closeDoor still
        // moves them into the house (applyGuestImpact adds their stats).
        const closeMoney = rival.roundMoney + (arrivingGuest?.money || 0);
        const closePoints = rival.roundPoints + (arrivingGuest?.points || 0);
        const closeValue = scoreRoundValue(closeMoney, closePoints, venue);

        // If no deck remains, admitting and closing are equivalent.
        if (rival.roundDeck.length === 0) {
            return { closeValue, admitValue: closeValue };
        }

        const bustPenalty = Game.BUST_PENALTY;
        const heatCap = getHeatCapacity(venue, rival);
        let admitTotal = 0;
        for (let i = 0; i < MONTE_CARLO_RUNS; i++) {
            const orderedDeck = shuffleCopy(rival.roundDeck);

            // Simulate rolling out future guests starting from the state
            // AFTER admitting the current arriving guest.
            admitTotal += estimateRolloutFromDoorState(
                { heat: rival.heat, money: closeMoney, points: closePoints },
                orderedDeck, venue, heatCap
            );
        }

        return {
            closeValue,
            admitValue: admitTotal / MONTE_CARLO_RUNS,
        };
    }

    function estimateAbilityValue(rival, player, venue, playerVenue, guest) {
        if (!guest?.ability) return Number.NEGATIVE_INFINITY;
        // Only flash abilities can be activated at the door.
        if (guest.ability.trigger !== 'flash') return Number.NEGATIVE_INFINITY;

        // Flash abilities trigger only after the guest is admitted. If admitting this
        // guest would bust immediately, the ability cannot save the round value.
        const projectedHeat = rival.heat + guest.heat;
        const rivalHeatCap = getHeatCapacity(venue, rival);
        if (projectedHeat > rivalHeatCap) {
            return Number.NEGATIVE_INFINITY;
        }

        // Baseline: current round value (ability includes admission).
        let value = scoreRoundValue(rival.roundMoney, rival.roundPoints, venue);

        switch (guest.ability.type) {
            case 'coolHeat': {
                const headroom = rivalHeatCap - rival.heat;
                value += headroom <= 1 ? guest.ability.value * 5 : guest.ability.value * 1.5;
                break;
            }
            case 'addOpponentHeat': {
                if (!player.doorClosed && !player.busted) {
                    const projected = player.heat + guest.ability.value;
                    const playerHeatCap = getHeatCapacity(playerVenue, player);
                    const ratio = projected / playerHeatCap;
                    value += ratio * 3;
                    if (projected > playerHeatCap) value += 6;
                }
                break;
            }
            case 'scoreNow':
                value += guest.ability.value * 1.5;
                break;
            case 'queueGatecrasher': {
                if (!player.doorClosed && !player.busted) {
                    const projected = player.heat + 2;
                    const playerHeatCap = getHeatCapacity(playerVenue, player);
                    const ratio = projected / playerHeatCap;
                    value += ratio * 3;
                    if (projected > playerHeatCap) value += 6;
                }
                break;
            }
            case 'revealNext':
                value += 1.5;
                break;
            case 'stackChoice':
                // Reveal and reorder: valuable for deck control.
                value += 2;
                break;
            case 'nameDrop':
                // Reveal multiple and pick one to admit: strong selection.
                value += 3;
                break;
            case 'opponentStackChoice':
                // Reorder opponent's queue: moderate disruption.
                value += 2;
                break;
            case 'bounce':
                value += 1;
                break;
            case 'boot':
                value += 1.5;
                break;
            case 'bootAdjacent': {
                // Boot 2 adjacent guests: valuable when house is full of low-value guests.
                const houseCapacity = Game.getHouseCapacity(venue, rival);
                value += rival.house.length >= houseCapacity ? 3 : 1;
                break;
            }
            case 'clearHouse': {
                // Clear all guests: valuable for heat reset or scoring departure effects.
                const heatPressure = rival.heat / rivalHeatCap;
                value += heatPressure > 0.7 ? 3 : 0.5;
                break;
            }
            case 'setHeatZero': {
                // Set heat to 0: extremely valuable under high heat.
                const heatPressure = rival.heat / rivalHeatCap;
                value += heatPressure > 0.5 ? rival.heat * 2 : 1;
                break;
            }
            case 'scoreGuest':
                // Score a guest immediately: valuable if house has high-value guests.
                value += 2;
                break;
            case 'refreshAction':
                value += 1.5;
                break;
            case 'refreshAllActions':
                // Refresh all actions: more valuable with more used abilities.
                value += rival.house.filter(e => typeof e !== 'string' && e.abilityUsed).length * 1.5;
                break;
            case 'gainMoney':
                value += (guest.ability.value || 1) * 1.2;
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
        const rivalHeatCap = getHeatCapacity(venue, rival);
        if (rival.heat > rivalHeatCap) {
            if (!rival.arrivingAbilityUsed && guest.ability && guest.ability.type === 'coolHeat') {
                return 'ability';
            }
            return 'close';
        }

        // Never intentionally admit a guest that causes an immediate bust.
        if ((rival.heat + guest.heat) > rivalHeatCap) {
            return 'close';
        }

        // Early-round tempo: avoid closing immediately unless pressure is already high.
        const remainingHeatBuffer = rivalHeatCap - rival.heat;
        if (rival.house.length < 2 && remainingHeatBuffer >= 2) {
            return 'admit';
        }

        // Monte Carlo decision between admitting, ability usage, and banking current value.
        const values = estimateAdmitVsCloseValue(rival, venue);
        const abilityValue = rival.arrivingAbilityUsed
            ? Number.NEGATIVE_INFINITY
            : estimateAbilityValue(rival, player, venue, playerVenue, guest);

        if (abilityValue >= values.admitValue && abilityValue >= values.closeValue) {
            return 'ability';
        }

        if (values.admitValue >= values.closeValue) return 'admit';
        return 'close';
    }

    /**
     * Evaluate using a house guest's targeted flash ability.
     * Returns { action: 'houseAbility', instanceId, targetInstanceId, value } or null.
     */
    function evaluateHouseAbilities(rival, player, venue, playerVenue) {
        const houseCapacity = Game.getHouseCapacity(venue, rival);
        let best = null;

        for (let i = 0; i < rival.house.length; i++) {
            const entry = rival.house[i];
            if (typeof entry === 'string' || !entry || entry.abilityUsed) continue;
            const guestId = entry.guestId || entry;
            const guest = Game.GUESTS[guestId];
            if (!guest?.ability || guest.ability.trigger !== 'flash') continue;

            const ability = entry.copiedAbility || guest.ability;
            const targeting = ability.targeting || '';

            // For each ability type that targets a house guest, pick the best target
            if (ability.type === 'boot' && targeting === 'choice') {
                // Boot: remove a guest to free capacity or shed heat
                // Pick the lowest-value guest (lowest money+points) that isn't locked
                let bestTarget = null;
                let bestTargetValue = Infinity;
                for (let j = 0; j < rival.house.length; j++) {
                    if (j === i) continue; // don't boot self
                    const te = rival.house[j];
                    if (typeof te === 'string') continue;
                    if (te.lockUntilClose) continue;
                    const tg = Game.GUESTS[te.guestId];
                    if (!tg) continue;
                    const tv = tg.money + tg.points;
                    if (tv < bestTargetValue) {
                        bestTargetValue = tv;
                        bestTarget = te;
                    }
                }
                if (!bestTarget) continue;
                // Boot is valuable when near capacity or high heat
                const heatCap = getHeatCapacity(venue, rival);
                const heatPressure = rival.heat / heatCap;
                const capacityPressure = rival.house.length >= houseCapacity ? 3 : 0;
                const value = heatPressure * 3 + capacityPressure - bestTargetValue * 0.5;
                if (value > 0 && (!best || value > best.value)) {
                    best = { action: 'houseAbility', instanceId: entry.instanceId, targetInstanceId: bestTarget.instanceId, value };
                }
            } else if (ability.type === 'bounce' && targeting === 'choice') {
                // Bounce: return a low-value guest to queue to free capacity
                let bestTarget = null;
                let bestTargetValue = Infinity;
                for (let j = 0; j < rival.house.length; j++) {
                    if (j === i) continue;
                    const te = rival.house[j];
                    if (typeof te === 'string') continue;
                    if (te.lockUntilClose) continue;
                    const tg = Game.GUESTS[te.guestId];
                    if (!tg) continue;
                    const tv = tg.money + tg.points;
                    if (tv < bestTargetValue) {
                        bestTargetValue = tv;
                        bestTarget = te;
                    }
                }
                if (!bestTarget) continue;
                const capacityPressure = rival.house.length >= houseCapacity ? 2.5 : 0;
                const value = capacityPressure + 0.5 - bestTargetValue * 0.3;
                if (value > 0 && (!best || value > best.value)) {
                    best = { action: 'houseAbility', instanceId: entry.instanceId, targetInstanceId: bestTarget.instanceId, value };
                }
            } else if (ability.type === 'scoreGuest') {
                // Score a guest: pick the highest-value guest
                let bestTarget = null;
                let bestTargetValue = -Infinity;
                for (let j = 0; j < rival.house.length; j++) {
                    if (j === i) continue;
                    const te = rival.house[j];
                    if (typeof te === 'string') continue;
                    const tg = Game.GUESTS[te.guestId];
                    if (!tg) continue;
                    const tv = tg.points + tg.money + ((te.bonusPoints) || 0);
                    if (tv > bestTargetValue) {
                        bestTargetValue = tv;
                        bestTarget = te;
                    }
                }
                if (!bestTarget || bestTargetValue <= 0) continue;
                const value = bestTargetValue * 1.5;
                if (!best || value > best.value) {
                    best = { action: 'houseAbility', instanceId: entry.instanceId, targetInstanceId: bestTarget.instanceId, value };
                }
            } else if (ability.type === 'refreshAction') {
                // Refresh: find a used flash ability guest worth re-using
                let bestTarget = null;
                let bestTargetValue = -Infinity;
                for (let j = 0; j < rival.house.length; j++) {
                    if (j === i) continue;
                    const te = rival.house[j];
                    if (typeof te === 'string' || !te.abilityUsed) continue;
                    const tg = Game.GUESTS[te.guestId];
                    if (!tg?.ability || tg.ability.trigger !== 'flash') continue;
                    const tv = 2; // flat value for refreshing any ability
                    if (tv > bestTargetValue) {
                        bestTargetValue = tv;
                        bestTarget = te;
                    }
                }
                if (!bestTarget) continue;
                const value = bestTargetValue;
                if (!best || value > best.value) {
                    best = { action: 'houseAbility', instanceId: entry.instanceId, targetInstanceId: bestTarget.instanceId, value };
                }
            } else if (!targeting) {
                // Non-targeted house flash abilities
                let value = 0;
                if (ability.type === 'coolHeat') {
                    const heatCap = getHeatCapacity(venue, rival);
                    const headroom = heatCap - rival.heat;
                    value = headroom <= 1 ? ability.value * 4 : ability.value * 0.5;
                } else if (ability.type === 'setHeatZero') {
                    const heatCap = getHeatCapacity(venue, rival);
                    const heatPressure = rival.heat / heatCap;
                    value = heatPressure > 0.5 ? rival.heat * 2 : 0.5;
                } else if (ability.type === 'revealNext') {
                    value = 1.5;
                } else if (ability.type === 'stackChoice') {
                    value = rival.roundDeck.length >= 2 ? 2 : 0;
                } else if (ability.type === 'nameDrop') {
                    value = rival.roundDeck.length >= 2 ? 3 : 0;
                } else if (ability.type === 'opponentStackChoice') {
                    value = (!player.doorClosed && !player.busted && player.roundDeck.length >= 2) ? 2 : 0;
                } else if (ability.type === 'gainMoney') {
                    value = (ability.value || 1) * 1.2;
                } else if (ability.type === 'clearHouse') {
                    const heatCap = getHeatCapacity(venue, rival);
                    const heatPressure = rival.heat / heatCap;
                    value = heatPressure > 0.7 ? 3 : 0.5;
                } else if (ability.type === 'bootAdjacent') {
                    const houseCapacity = Game.getHouseCapacity(venue, rival);
                    value = rival.house.length >= houseCapacity ? 3 : 1;
                } else if (ability.type === 'refreshAllActions') {
                    const usedCount = rival.house.filter(e => typeof e !== 'string' && e.abilityUsed).length;
                    value = usedCount >= 2 ? usedCount * 1.5 : 0.5;
                } else if (ability.type === 'addOpponentHeat') {
                    if (!player.doorClosed && !player.busted) {
                        const playerHeatCap = getHeatCapacity(playerVenue, player);
                        const projected = player.heat + (ability.value || 1);
                        value = projected > playerHeatCap ? 6 : (projected / playerHeatCap) * 3;
                    }
                } else {
                    value = 1;
                }
                if (value > 0 && (!best || value > best.value)) {
                    best = { action: 'houseAbility', instanceId: entry.instanceId, targetInstanceId: null, value };
                }
            }
        }

        return best;
    }

    function decideGuestAction(state) {
        const rival = state.rival;
        const player = state.player;
        const venue = Game.VENUES[rival.venueId];
        const playerVenue = Game.VENUES[player.venueId];

        if (rival.doorClosed || rival.busted) return null;

        // Evaluate house abilities (targeted and non-targeted)
        const houseAbility = evaluateHouseAbilities(rival, player, venue, playerVenue);

        if (!rival.arrivingGuest) {
            // No arriving guest but house abilities might still be available
            if (houseAbility && houseAbility.value > 1) return houseAbility;
            return null;
        }

        const guest = Game.GUESTS[rival.arrivingGuest];
        const doorAction = estimateDoorSafeAction(rival, guest, venue, player, playerVenue);

        // Compare house ability value against door action
        if (houseAbility && houseAbility.value > 2) {
            // Only use house ability if it's clearly better than admitting/closing
            const values = estimateAdmitVsCloseValue(rival, venue);
            const bestDoorValue = Math.max(values.admitValue, values.closeValue);
            if (houseAbility.value + bestDoorValue * 0.9 > bestDoorValue) {
                return houseAbility;
            }
        }

        return doorAction;
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

        // Consider upgrades alongside guest purchases
        const slotCost = 3 + (rival.shopItemPurchases.slotIncrease * 2);
        const heatCost = 4 + (rival.shopItemPurchases.heatCapIncrease * 3);
        const houseCapacity = Game.getHouseCapacity(venue, rival);
        const heatCapacity = Game.getHeatCapacity(venue, rival);

        // Evaluate upgrade value heuristically
        // +1 Slot is valuable when deck is larger than current capacity
        const slotValue = rival.fullDeck.length > houseCapacity ? 6 : 2;
        // +1 Heat Cap is valuable when average heat per guest is high
        const avgHeat = rival.fullDeck.reduce((sum, id) => sum + (Game.GUESTS[id]?.heat || 0), 0) / Math.max(1, rival.fullDeck.length);
        const heatValue = avgHeat >= 1.5 ? 7 : (avgHeat >= 1 ? 4 : 2);

        // Build a unified list of all purchasable items with value/cost scores
        const candidates = [];
        for (const guestId of ranked) {
            const guest = Game.GUESTS[guestId];
            const guestValue = estimateRoundValueForGuest(rival, venue, guestId);
            candidates.push({ id: guestId, cost: guest.cost, value: guestValue / Math.max(1, guest.cost) });
        }
        if (slotCost <= budget) {
            candidates.push({ id: 'slotIncrease', cost: slotCost, value: slotValue / Math.max(1, slotCost) });
        }
        if (heatCost <= budget) {
            candidates.push({ id: 'heatCapIncrease', cost: heatCost, value: heatValue / Math.max(1, heatCost) });
        }

        // Sort by value/cost ratio descending
        candidates.sort((a, b) => b.value - a.value);

        for (const item of candidates) {
            if (item.cost <= budget && purchases.length < 4) {
                purchases.push(item.id);
                budget -= item.cost;
            }
        }

        return purchases;
    }

    return { decideGuestAction, decideBuyPhaseActions };
})();
