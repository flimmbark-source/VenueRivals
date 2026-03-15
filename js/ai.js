/* ============================================
   VENUE RIVALS - AI Opponent (Hard Mode)
   Guest phase decisions and buy phase strategy
   with scoring-bonus-aware Monte Carlo,
   opponent-aware risk management, and
   synergy-driven purchasing.
   ============================================ */

const AI = (() => {
    const MONTE_CARLO_RUNS = 200;
    const ROLLOUT_CLOSE_HEAT_PRESSURE = 0.88;
    const ROLLOUT_LOW_UPSIDE_THRESHOLD = 0.5;
    const ROLLOUT_MIN_ADMITS_BEFORE_CLOSE = 2;
    const EARLY_TEMPO_PROTECTED_GUESTS = 2;
    const ADMIT_ADVANTAGE_MARGIN = 0.4;

    let lastDoorValueEstimateKey = null;
    let lastDoorValueEstimate = null;

    function scoreRoundValue(money, points, venue) {
        let total = money + points;
        if (venue.style === 'money') total += money;
        if (venue.style === 'points') total += points;
        return total;
    }

    function shuffleInPlace(list) {
        for (let i = list.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            if (j !== i) {
                const temp = list[i];
                list[i] = list[j];
                list[j] = temp;
            }
        }
    }

    function getHeatCapacity(venue, player) {
        return Game.getHeatCapacity(venue, player);
    }

    function getGuestStats(guestId) {
        const guest = Game.GUESTS[guestId];
        if (!guest) {
            return { heat: 0, money: 0, points: 0, cost: 0, ability: null, tags: [] };
        }

        return {
            heat: guest.heat,
            money: guest.money,
            points: guest.points,
            cost: guest.cost,
            ability: guest.ability || null,
            tags: guest.tags || [],
        };
    }

    function scoreRoundValueForStyle(money, points, venueStyle) {
        let total = money + points;
        if (venueStyle === 'money') total += money;
        if (venueStyle === 'points') total += points;
        return total;
    }

    // ========================================================
    // Scoring bonus estimation for Monte Carlo rollouts
    // Simulates end-of-round scoring bonuses for a given house
    // ========================================================
    function estimateScoringBonuses(house, houseCapacity, heat, roundMoney, totalMoney, venueStyle) {
        let bonusPoints = 0;
        let bonusMoney = 0;

        for (let i = 0; i < house.length; i++) {
            const guestId = house[i];
            const guest = Game.GUESTS[guestId];
            if (!guest?.ability || guest.ability.trigger !== 'scoring') continue;

            switch (guest.ability.type) {
                case 'wallflower': {
                    const emptySlots = Math.max(0, houseCapacity - house.length);
                    bonusPoints += emptySlots;
                    break;
                }
                case 'clique': {
                    const myTags = guest.tags || [];
                    if (i > 0) {
                        const neighbor = Game.GUESTS[house[i - 1]];
                        if (neighbor && myTags.some(t => (neighbor.tags || []).includes(t))) bonusPoints++;
                    }
                    if (i < house.length - 1) {
                        const neighbor = Game.GUESTS[house[i + 1]];
                        if (neighbor && myTags.some(t => (neighbor.tags || []).includes(t))) bonusPoints++;
                    }
                    break;
                }
                case 'centerOfAttention': {
                    // Index 0 = newest in the house array
                    if (i === 0) bonusPoints += (guest.ability.value || 2);
                    break;
                }
                case 'packedHouse': {
                    if (house.length >= houseCapacity && houseCapacity > 0) {
                        bonusPoints += (guest.ability.value || 4);
                    }
                    break;
                }
                case 'highRoller': {
                    bonusPoints += Math.floor(totalMoney / 2);
                    break;
                }
                case 'chaosChaser': {
                    bonusPoints += heat;
                    break;
                }
                case 'lastToLeave': {
                    // Last index = oldest
                    if (i === house.length - 1) bonusPoints += (guest.ability.value || 2);
                    break;
                }
            }
        }

        let total = bonusPoints + bonusMoney;
        if (venueStyle === 'points') total += bonusPoints;
        if (venueStyle === 'money') total += bonusMoney;
        return total;
    }

    // ========================================================
    // Enhanced Monte Carlo for buy-phase guest evaluation
    // Now includes scoring bonuses
    // ========================================================
    function estimateRoundValueForGuest(rival, venue, guestId) {
        const sampledDeck = [...rival.fullDeck, guestId];
        const guestStatsById = Object.create(null);
        for (let i = 0; i < sampledDeck.length; i++) {
            const id = sampledDeck[i];
            if (!guestStatsById[id]) guestStatsById[id] = getGuestStats(id);
        }

        const bustPenalty = Game.BUST_PENALTY;
        const venueStyle = venue.style;
        const heatCap = getHeatCapacity(venue, rival);
        const houseCapacity = Game.getHouseCapacity(venue, rival);
        let totalScore = 0;

        for (let i = 0; i < MONTE_CARLO_RUNS; i++) {
            const drawOrder = [...sampledDeck];
            shuffleInPlace(drawOrder);
            let heat = 0;
            let money = 0;
            let points = 0;
            const house = [];
            let busted = false;
            for (let j = 0; j < drawOrder.length; j++) {
                const guest = guestStatsById[drawOrder[j]];
                heat += guest.heat;
                money += guest.money;
                points += guest.points;
                house.unshift(drawOrder[j]);
                if (house.length > houseCapacity) house.pop();

                if (heat > heatCap) {
                    money = Math.floor(money * bustPenalty);
                    points = Math.floor(points * bustPenalty);
                    busted = true;
                    break;
                }
            }

            let roundScore = scoreRoundValueForStyle(money, points, venueStyle);
            if (!busted) {
                roundScore += estimateScoringBonuses(house, houseCapacity, heat, money, rival.money + money, venueStyle);
            }
            totalScore += roundScore;
        }

        return totalScore / MONTE_CARLO_RUNS;
    }

    function buildGuestScoreMap(rival, market, venue) {
        const guestScores = new Map();
        for (const guestId of market) {
            const guest = Game.GUESTS[guestId];
            const score = estimateRoundValueForGuest(rival, venue, guestId);
            guestScores.set(guestId, {
                score,
                scorePerCost: score / Math.max(1, guest.cost),
            });
        }
        return guestScores;
    }

    function rankMarketByMonteCarlo(rival, market, venue, guestScores = buildGuestScoreMap(rival, market, venue)) {
        return [...market].sort((a, b) => {
            const aGuest = Game.GUESTS[a];
            const bGuest = Game.GUESTS[b];
            const aScore = guestScores.get(a);
            const bScore = guestScores.get(b);

            const aValue = aScore?.scorePerCost ?? Number.NEGATIVE_INFINITY;
            const bValue = bScore?.scorePerCost ?? Number.NEGATIVE_INFINITY;

            if (bValue === aValue) return aGuest.cost - bGuest.cost;
            return bValue - aValue;
        });
    }

    // ========================================================
    // Enhanced rollout with scoring bonus estimation
    // ========================================================
    function estimateRolloutFromDoorState(baseState, orderedDeck, guestStatsById, venueStyle, heatCap, bustPenalty, houseCapacity, existingHouse) {
        let heat = baseState.heat;
        let money = baseState.money;
        let points = baseState.points;
        const house = existingHouse ? [...existingHouse] : [];

        for (let i = 0; i < orderedDeck.length; i++) {
            const closeScore = scoreRoundValueForStyle(money, points, venueStyle);
            const nextGuest = guestStatsById[orderedDeck[i]];
            const nextHeat = heat + nextGuest.heat;
            const nextMoney = money + nextGuest.money;
            const nextPoints = points + nextGuest.points;

            if (nextHeat > heatCap) {
                const bustedMoney = Math.floor(nextMoney * bustPenalty);
                const bustedPoints = Math.floor(nextPoints * bustPenalty);
                return scoreRoundValueForStyle(bustedMoney, bustedPoints, venueStyle);
            }

            const continueScore = scoreRoundValueForStyle(nextMoney, nextPoints, venueStyle);
            const heatPressure = nextHeat / heatCap;
            const nearEnd = i >= orderedDeck.length - 1;

            const lowUpside = (continueScore - closeScore) <= ROLLOUT_LOW_UPSIDE_THRESHOLD;
            const deepIntoRun = i >= ROLLOUT_MIN_ADMITS_BEFORE_CLOSE;
            if (heatPressure > ROLLOUT_CLOSE_HEAT_PRESSURE && lowUpside && deepIntoRun && !nearEnd) {
                // Estimate scoring bonuses at close time
                const bonus = estimateScoringBonuses(house, houseCapacity, heat, money, baseState.totalMoney + money, venueStyle);
                return closeScore + bonus;
            }

            heat = nextHeat;
            money = nextMoney;
            points = nextPoints;
            house.unshift(orderedDeck[i]);
            if (house.length > houseCapacity) house.pop();
        }

        const finalScore = scoreRoundValueForStyle(money, points, venueStyle);
        const bonus = estimateScoringBonuses(house, houseCapacity, heat, money, baseState.totalMoney + money, venueStyle);
        return finalScore + bonus;
    }

    function buildRoundDeckStats(roundDeck) {
        const guestStatsById = Object.create(null);
        for (let i = 0; i < roundDeck.length; i++) {
            const id = roundDeck[i];
            if (!guestStatsById[id]) {
                guestStatsById[id] = getGuestStats(id);
            }
        }
        return guestStatsById;
    }

    function simulateAdmitRolloutValue(rival, closeMoney, closePoints, venue, roundDeck, guestStatsById) {
        const deckBuffer = [...roundDeck];
        const bustPenalty = Game.BUST_PENALTY;
        const venueStyle = venue.style;
        const heatCap = getHeatCapacity(venue, rival);
        const houseCapacity = Game.getHouseCapacity(venue, rival);
        // Build current house as array of guest IDs for bonus estimation
        const existingHouse = rival.house.map(e => typeof e === 'string' ? e : (e?.guestId || ''));
        // Include arriving guest in house for rollout (it gets admitted before rollout)
        if (rival.arrivingGuest) {
            existingHouse.unshift(rival.arrivingGuest);
            if (existingHouse.length > houseCapacity) existingHouse.pop();
        }
        const baseState = {
            heat: rival.heat,
            money: closeMoney,
            points: closePoints,
            totalMoney: rival.money,
        };
        let admitTotal = 0;

        for (let i = 0; i < MONTE_CARLO_RUNS; i++) {
            for (let j = 0; j < roundDeck.length; j++) {
                deckBuffer[j] = roundDeck[j];
            }
            shuffleInPlace(deckBuffer);
            admitTotal += estimateRolloutFromDoorState(
                baseState,
                deckBuffer,
                guestStatsById,
                venueStyle,
                heatCap,
                bustPenalty,
                houseCapacity,
                existingHouse,
            );
        }

        return admitTotal / MONTE_CARLO_RUNS;
    }


    function buildDoorValueEstimateKey(rival, venue) {
        const deckKey = Array.isArray(rival.roundDeck) ? rival.roundDeck.join(',') : '';
        const houseKey = rival.house.map(e => typeof e === 'string' ? e : (e?.guestId || '')).join(',');
        return [
            venue?.id || rival.venueId || '',
            rival.heat,
            rival.roundMoney,
            rival.roundPoints,
            rival.guestMoney || 0,
            rival.guestPoints || 0,
            rival.arrivingGuest || '',
            rival.heatCapBonus || 0,
            rival.shopItemPurchases?.heatCapIncrease || 0,
            rival.shopItemPurchases?.slotIncrease || 0,
            rival.slotIncrease || 0,
            deckKey,
            houseKey,
        ].join('|');
    }

    function getDoorValueEstimateCached(rival, venue) {
        const key = buildDoorValueEstimateKey(rival, venue);
        if (key === lastDoorValueEstimateKey && lastDoorValueEstimate) {
            return lastDoorValueEstimate;
        }
        const nextEstimate = estimateAdmitVsCloseValue(rival, venue);
        lastDoorValueEstimateKey = key;
        lastDoorValueEstimate = nextEstimate;
        return nextEstimate;
    }

    function estimateAdmitVsCloseValue(rival, venue) {
        const arrivingGuest = getGuestStats(rival.arrivingGuest);
        const closeMoney = rival.roundMoney + arrivingGuest.money;
        const closePoints = rival.roundPoints + arrivingGuest.points;

        // Estimate scoring bonuses for close value
        const houseCapacity = Game.getHouseCapacity(venue, rival);
        const existingHouseIds = rival.house.map(e => typeof e === 'string' ? e : (e?.guestId || ''));
        const closeHouse = [rival.arrivingGuest, ...existingHouseIds].slice(0, houseCapacity);
        const closeHeat = rival.heat + arrivingGuest.heat;
        const closeBonus = estimateScoringBonuses(
            closeHouse, houseCapacity, closeHeat, closeMoney,
            rival.money + closeMoney, venue.style
        );
        const closeValue = scoreRoundValue(closeMoney, closePoints, venue) + closeBonus;

        if (rival.roundDeck.length === 0) {
            return { closeValue, admitValue: closeValue };
        }

        const roundDeck = [...rival.roundDeck];
        const guestStatsById = buildRoundDeckStats(roundDeck);
        const admitValue = simulateAdmitRolloutValue(rival, closeMoney, closePoints, venue, roundDeck, guestStatsById);

        return {
            closeValue,
            admitValue,
        };
    }

    // ========================================================
    // Opponent-aware risk adjustment
    // Returns a modifier that shifts the AI's aggressiveness:
    //   positive = play more aggressively (behind/opponent closed)
    //   negative = play more conservatively (ahead)
    // ========================================================
    function getOpponentRiskAdjustment(rival, player, venue, pointTarget) {
        const target = pointTarget || Game.POINT_TARGET || 50;
        const rivalDistToWin = Math.max(0, target - rival.points);
        const playerDistToWin = Math.max(0, target - player.points);
        let adjustment = 0;

        // If opponent has closed their door, we can play greedier
        if (player.doorClosed || player.busted) {
            adjustment += 1.5;
        }

        // If we're behind, play more aggressively
        const pointDiff = rival.points - player.points;
        if (pointDiff < -10) {
            adjustment += 2.0; // significantly behind
        } else if (pointDiff < -5) {
            adjustment += 1.0;
        } else if (pointDiff > 10) {
            adjustment -= 1.0; // significantly ahead, play safe
        } else if (pointDiff > 5) {
            adjustment -= 0.5;
        }

        // If player is close to winning, be more aggressive to try to keep up
        if (playerDistToWin <= 10 && rivalDistToWin > playerDistToWin) {
            adjustment += 1.5;
        }

        // If rival is close to winning, play safe to secure the win
        if (rivalDistToWin <= 8 && rivalDistToWin <= playerDistToWin) {
            adjustment -= 1.0;
        }

        // If opponent is near busting, less pressure on us
        if (!player.doorClosed && !player.busted) {
            const playerHeatCap = getHeatCapacity(Game.VENUES[player.venueId], player);
            const playerHeatPressure = player.heat / playerHeatCap;
            if (playerHeatPressure > 0.8) {
                adjustment += 0.5; // opponent in danger, we can afford to push
            }
        }

        return adjustment;
    }

    function estimateAbilityValue(rival, player, venue, playerVenue, guest) {
        if (!guest?.ability) return Number.NEGATIVE_INFINITY;
        if (guest.ability.trigger !== 'flash') return Number.NEGATIVE_INFINITY;

        const projectedHeat = rival.heat + guest.heat;
        const rivalHeatCap = getHeatCapacity(venue, rival);
        if (projectedHeat > rivalHeatCap) {
            return Number.NEGATIVE_INFINITY;
        }

        let value = scoreRoundValue(rival.roundMoney, rival.roundPoints, venue);

        switch (guest.ability.type) {
            case 'coolHeat': {
                const headroom = rivalHeatCap - rival.heat;
                // Much higher value when heat is critical - this extends our run
                if (headroom <= 0) value += guest.ability.value * 8;
                else if (headroom <= 1) value += guest.ability.value * 6;
                else if (headroom <= 2) value += guest.ability.value * 3;
                else value += guest.ability.value * 1.2;
                break;
            }
            case 'addOpponentHeat': {
                if (!player.doorClosed && !player.busted) {
                    const projected = player.heat + guest.ability.value;
                    const playerHeatCap = getHeatCapacity(playerVenue, player);
                    const ratio = projected / playerHeatCap;
                    value += ratio * 4;
                    if (projected > playerHeatCap) value += 8; // force opponent bust
                    // Even more valuable if opponent has high-value round
                    const oppRoundValue = player.roundMoney + player.roundPoints + player.guestMoney + player.guestPoints;
                    if (projected > playerHeatCap && oppRoundValue > 3) value += 4;
                }
                break;
            }
            case 'scoreNow':
                value += guest.ability.value * 2;
                break;
            case 'queueGatecrasher': {
                if (!player.doorClosed && !player.busted) {
                    const projected = player.heat + 1; // gatecrasher has 1 heat
                    const playerHeatCap = getHeatCapacity(playerVenue, player);
                    const ratio = projected / playerHeatCap;
                    value += ratio * 4;
                    if (projected > playerHeatCap) value += 8;
                    // Extra value if opponent still has many guests to draw
                    if (player.roundDeck && player.roundDeck.length > 2) value += 1;
                }
                break;
            }
            case 'revealNext':
                // Information is very valuable for making better close/admit decisions
                value += rival.roundDeck.length >= 1 ? 2.5 : 0.5;
                break;
            case 'stackChoice':
                value += rival.roundDeck.length >= 2 ? 3 : 0.5;
                break;
            case 'nameDrop':
                value += rival.roundDeck.length >= 2 ? 4 : 1;
                break;
            case 'opponentStackChoice':
                if (!player.doorClosed && !player.busted && player.roundDeck?.length >= 2) {
                    value += 3;
                } else {
                    value += 0.5;
                }
                break;
            case 'bounce':
                value += 1.5;
                break;
            case 'boot':
                value += 2;
                break;
            case 'bootAdjacent': {
                const houseCapacity = Game.getHouseCapacity(venue, rival);
                value += rival.house.length >= houseCapacity ? 4 : 1.5;
                break;
            }
            case 'clearHouse': {
                const heatPressure = rival.heat / rivalHeatCap;
                value += heatPressure > 0.6 ? 4 : 0.5;
                break;
            }
            case 'setHeatZero': {
                // Extremely valuable - resets the entire run potential
                value += rival.heat >= 2 ? rival.heat * 3 : 1;
                break;
            }
            case 'scoreGuest': {
                // Estimate based on best house guest value
                let bestGuestVal = 0;
                for (const he of rival.house) {
                    if (typeof he === 'string') continue;
                    const hg = Game.GUESTS[he?.guestId];
                    if (hg) bestGuestVal = Math.max(bestGuestVal, hg.points + hg.money + (he.bonusPoints || 0));
                }
                value += bestGuestVal * 1.5;
                break;
            }
            case 'refreshAction': {
                // Value depends on what abilities we could refresh
                let bestRefreshVal = 0;
                for (const he of rival.house) {
                    if (typeof he === 'string' || !he?.abilityUsed) continue;
                    const hg = Game.GUESTS[he.guestId];
                    if (hg?.ability?.trigger === 'flash') bestRefreshVal = Math.max(bestRefreshVal, 2.5);
                }
                value += bestRefreshVal;
                break;
            }
            case 'refreshAllActions': {
                const usedCount = rival.house.filter(e => typeof e !== 'string' && e.abilityUsed).length;
                value += usedCount >= 2 ? usedCount * 2 : 0.5;
                break;
            }
            case 'gainMoney':
                value += (guest.ability.value || 1) * 1.5;
                break;
        }

        return value;
    }

    /**
     * Decide what to do with the current arriving guest.
     * Returns 'admit' | 'ability' | 'close' | null
     */
    function estimateDoorSafeAction(rival, guest, venue, player, playerVenue, precomputedDoorValues = null, riskAdjustment = 0) {
        if (!guest) return 'close';

        const rivalHeatCap = getHeatCapacity(venue, rival);
        if (rival.heat > rivalHeatCap) {
            if (!rival.arrivingAbilityUsed && guest.ability && guest.ability.type === 'coolHeat') {
                return 'ability';
            }
            // Also try setHeatZero before giving up
            if (!rival.arrivingAbilityUsed && guest.ability && guest.ability.type === 'setHeatZero') {
                return 'ability';
            }
            return 'close';
        }

        // Never intentionally admit a guest that causes an immediate bust.
        if ((rival.heat + guest.heat) > rivalHeatCap) {
            // But if guest has a coolHeat or setHeatZero ability, use it instead of closing
            if (!rival.arrivingAbilityUsed && guest.ability?.trigger === 'flash') {
                if (guest.ability.type === 'coolHeat' || guest.ability.type === 'setHeatZero') {
                    return 'ability';
                }
            }
            return 'close';
        }

        // Early-round tempo: avoid closing immediately unless pressure is already high.
        const remainingHeatBuffer = rivalHeatCap - rival.heat;
        const protectedCount = Math.max(1, EARLY_TEMPO_PROTECTED_GUESTS + Math.floor(riskAdjustment * 0.5));
        if (rival.house.length < protectedCount && remainingHeatBuffer >= 1) {
            // Even in early tempo, prefer ability if it's clearly strong
            if (!rival.arrivingAbilityUsed && guest.ability?.trigger === 'flash') {
                const abilityVal = estimateAbilityValue(rival, player, venue, playerVenue, guest);
                if (abilityVal > scoreRoundValue(rival.roundMoney, rival.roundPoints, venue) + 5) {
                    return 'ability';
                }
            }
            return 'admit';
        }

        // Monte Carlo decision between admitting, ability usage, and banking current value.
        const values = precomputedDoorValues || getDoorValueEstimateCached(rival, venue);
        const abilityValue = rival.arrivingAbilityUsed
            ? Number.NEGATIVE_INFINITY
            : estimateAbilityValue(rival, player, venue, playerVenue, guest);

        if (abilityValue >= values.admitValue && abilityValue >= values.closeValue) {
            return 'ability';
        }

        // Apply risk adjustment to the admit/close decision
        const adjustedMargin = ADMIT_ADVANTAGE_MARGIN - (riskAdjustment * 0.3);
        if ((values.admitValue + adjustedMargin) >= values.closeValue) return 'admit';
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

            if (ability.type === 'boot' && targeting === 'choice') {
                let bestTarget = null;
                let bestTargetValue = Infinity;
                for (let j = 0; j < rival.house.length; j++) {
                    if (j === i) continue;
                    const te = rival.house[j];
                    if (typeof te === 'string') continue;
                    if (te.lockUntilClose) continue;
                    const tg = Game.GUESTS[te.guestId];
                    if (!tg) continue;
                    // Consider heat cost of the guest when evaluating boot value
                    const tv = tg.money + tg.points - tg.heat * 0.5;
                    if (tv < bestTargetValue) {
                        bestTargetValue = tv;
                        bestTarget = te;
                    }
                }
                if (!bestTarget) continue;
                const heatCap = getHeatCapacity(venue, rival);
                const heatPressure = rival.heat / heatCap;
                const capacityPressure = rival.house.length >= houseCapacity ? 4 : 0;
                // Booting is valuable to shed heat from high-heat guests
                const bootedGuest = Game.GUESTS[bestTarget.guestId];
                const heatRecovery = bootedGuest ? bootedGuest.heat * heatPressure * 2 : 0;
                const value = heatPressure * 3 + capacityPressure + heatRecovery - bestTargetValue * 0.3;
                if (value > 0 && (!best || value > best.value)) {
                    best = { action: 'houseAbility', instanceId: entry.instanceId, targetInstanceId: bestTarget.instanceId, value };
                }
            } else if (ability.type === 'bounce' && targeting === 'choice') {
                let bestTarget = null;
                let bestTargetValue = Infinity;
                for (let j = 0; j < rival.house.length; j++) {
                    if (j === i) continue;
                    const te = rival.house[j];
                    if (typeof te === 'string') continue;
                    if (te.lockUntilClose) continue;
                    const tg = Game.GUESTS[te.guestId];
                    if (!tg) continue;
                    // Prefer bouncing high-heat, low-value guests
                    const tv = tg.money + tg.points - tg.heat;
                    if (tv < bestTargetValue) {
                        bestTargetValue = tv;
                        bestTarget = te;
                    }
                }
                if (!bestTarget) continue;
                const heatCap = getHeatCapacity(venue, rival);
                const heatPressure = rival.heat / heatCap;
                const capacityPressure = rival.house.length >= houseCapacity ? 3 : 0;
                // Bouncing also sheds heat
                const bouncedGuest = Game.GUESTS[bestTarget.guestId];
                const heatRecovery = bouncedGuest ? bouncedGuest.heat * heatPressure * 1.5 : 0;
                const value = capacityPressure + heatRecovery + 0.5 - bestTargetValue * 0.2;
                if (value > 0 && (!best || value > best.value)) {
                    best = { action: 'houseAbility', instanceId: entry.instanceId, targetInstanceId: bestTarget.instanceId, value };
                }
            } else if (ability.type === 'scoreGuest') {
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
                // Score guest is always valuable - scores points without needing to close
                const value = bestTargetValue * 2;
                if (!best || value > best.value) {
                    best = { action: 'houseAbility', instanceId: entry.instanceId, targetInstanceId: bestTarget.instanceId, value };
                }
            } else if (ability.type === 'refreshAction') {
                let bestTarget = null;
                let bestTargetValue = -Infinity;
                for (let j = 0; j < rival.house.length; j++) {
                    if (j === i) continue;
                    const te = rival.house[j];
                    if (typeof te === 'string' || !te.abilityUsed) continue;
                    const tg = Game.GUESTS[te.guestId];
                    if (!tg?.ability || tg.ability.trigger !== 'flash') continue;
                    // Evaluate which ability is most worth refreshing
                    let tv = 2;
                    if (tg.ability.type === 'scoreGuest') tv = 4;
                    else if (tg.ability.type === 'coolHeat' || tg.ability.type === 'setHeatZero') tv = 3.5;
                    else if (tg.ability.type === 'addOpponentHeat') tv = 3;
                    else if (tg.ability.type === 'boot' || tg.ability.type === 'bootAdjacent') tv = 3;
                    else if (tg.ability.type === 'nameDrop') tv = 3.5;
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
            } else if (ability.type === 'nudge' && targeting === 'choice') {
                // Nudge: shift a guest position. Useful for scoring bonus manipulation
                // (e.g., move a centerOfAttention guest to position 0)
                let bestTarget = null;
                let bestTargetValue = -Infinity;
                for (let j = 0; j < rival.house.length; j++) {
                    if (j === i) continue;
                    const te = rival.house[j];
                    if (typeof te === 'string') continue;
                    if (te.lockUntilClose) continue;
                    const tg = Game.GUESTS[te.guestId];
                    if (!tg) continue;
                    let tv = 0;
                    // Nudge is valuable for position-dependent scoring
                    if (tg.ability?.type === 'centerOfAttention' && j !== 0) tv = 3;
                    else if (tg.ability?.type === 'lastToLeave' && j !== rival.house.length - 1) tv = 3;
                    if (tv > bestTargetValue) {
                        bestTargetValue = tv;
                        bestTarget = te;
                    }
                }
                if (!bestTarget || bestTargetValue <= 0) continue;
                if (!best || bestTargetValue > best.value) {
                    best = { action: 'houseAbility', instanceId: entry.instanceId, targetInstanceId: bestTarget.instanceId, value: bestTargetValue };
                }
            } else if (!targeting) {
                // Non-targeted house flash abilities
                let value = 0;
                if (ability.type === 'coolHeat') {
                    const heatCap = getHeatCapacity(venue, rival);
                    const headroom = heatCap - rival.heat;
                    if (headroom <= 0) value = ability.value * 6;
                    else if (headroom <= 1) value = ability.value * 5;
                    else if (headroom <= 2) value = ability.value * 2.5;
                    else value = ability.value * 0.3;
                } else if (ability.type === 'setHeatZero') {
                    const heatCap = getHeatCapacity(venue, rival);
                    const heatPressure = rival.heat / heatCap;
                    value = heatPressure > 0.5 ? rival.heat * 2.5 : 0.3;
                } else if (ability.type === 'revealNext') {
                    value = rival.roundDeck.length >= 1 ? 2 : 0;
                } else if (ability.type === 'stackChoice') {
                    value = rival.roundDeck.length >= 2 ? 2.5 : 0;
                } else if (ability.type === 'nameDrop') {
                    value = rival.roundDeck.length >= 2 ? 4 : 0;
                } else if (ability.type === 'opponentStackChoice') {
                    if (!player.doorClosed && !player.busted && player.roundDeck?.length >= 2) {
                        // Stack worst guests on top of opponent's deck
                        value = 3;
                        const playerHeatCap = getHeatCapacity(playerVenue, player);
                        if (player.heat / playerHeatCap > 0.6) value = 4; // more impactful when opponent is pressured
                    }
                } else if (ability.type === 'gainMoney') {
                    value = (ability.value || 1) * 1.5;
                } else if (ability.type === 'clearHouse') {
                    const heatCap = getHeatCapacity(venue, rival);
                    const heatPressure = rival.heat / heatCap;
                    value = heatPressure > 0.6 ? 4 : 0.3;
                } else if (ability.type === 'bootAdjacent') {
                    value = rival.house.length >= houseCapacity ? 4 : 1;
                } else if (ability.type === 'refreshAllActions') {
                    const usedCount = rival.house.filter(e => typeof e !== 'string' && e.abilityUsed).length;
                    value = usedCount >= 2 ? usedCount * 2 : 0.3;
                } else if (ability.type === 'addOpponentHeat') {
                    if (!player.doorClosed && !player.busted) {
                        const playerHeatCap = getHeatCapacity(playerVenue, player);
                        const projected = player.heat + (ability.value || 1);
                        if (projected > playerHeatCap) {
                            value = 8;
                            const oppVal = player.roundMoney + player.roundPoints + player.guestMoney + player.guestPoints;
                            if (oppVal > 3) value += 4;
                        } else {
                            value = (projected / playerHeatCap) * 4;
                        }
                    }
                } else if (ability.type === 'nudge') {
                    // Auto-target nudge: evaluate if position matters
                    value = 0.5;
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

        // Compute opponent-aware risk adjustment
        const riskAdjustment = getOpponentRiskAdjustment(rival, player, venue, state.pointTarget);

        // Evaluate house abilities (targeted and non-targeted)
        const houseAbility = evaluateHouseAbilities(rival, player, venue, playerVenue);

        if (!rival.arrivingGuest) {
            if (houseAbility && houseAbility.value > 0.8) return houseAbility;
            return null;
        }

        const guest = Game.GUESTS[rival.arrivingGuest];
        const rivalHeatCap = getHeatCapacity(venue, rival);
        const needsDoorValues = !!guest
            && rival.heat <= rivalHeatCap
            && (rival.heat + guest.heat) <= rivalHeatCap
            && !(rival.house.length < Math.max(1, EARLY_TEMPO_PROTECTED_GUESTS + Math.floor(riskAdjustment * 0.5)) && (rivalHeatCap - rival.heat) >= 1);
        const doorValues = needsDoorValues ? getDoorValueEstimateCached(rival, venue) : null;
        const doorAction = estimateDoorSafeAction(rival, guest, venue, player, playerVenue, doorValues, riskAdjustment);

        // Compare house ability value against door action with lower threshold
        if (houseAbility && houseAbility.value > 1.5) {
            const resolvedDoorValues = doorValues || getDoorValueEstimateCached(rival, venue);
            const bestDoorValue = Math.max(resolvedDoorValues.admitValue, resolvedDoorValues.closeValue);
            // Use house ability if it adds meaningful value over the current door action
            if (houseAbility.value > bestDoorValue * 0.15 + 1) {
                return houseAbility;
            }
        }

        return doorAction;
    }

    // ========================================================
    // Enhanced stack/nameDrop choice resolution
    // Consider heat, abilities, scoring synergies
    // ========================================================
    function evaluateGuestForChoice(guestId, rival, venue, player, playerVenue) {
        const guest = Game.GUESTS[guestId];
        if (!guest) return -100;
        let value = guest.money + guest.points;

        // Penalize high heat when we're already pressured
        const heatCap = getHeatCapacity(venue, rival);
        const headroom = heatCap - rival.heat;
        if (guest.heat > 0) {
            const heatPenalty = guest.heat * (headroom <= 1 ? 4 : headroom <= 2 ? 2 : 0.5);
            value -= heatPenalty;
        }

        // Bonus for low/zero heat guests
        if (guest.heat === 0) value += 1;

        // Value abilities
        if (guest.ability) {
            if (guest.ability.trigger === 'flash') {
                if (guest.ability.type === 'coolHeat') value += headroom <= 2 ? 4 : 1;
                else if (guest.ability.type === 'setHeatZero') value += headroom <= 2 ? 6 : 2;
                else if (guest.ability.type === 'scoreGuest') value += 2;
                else if (guest.ability.type === 'scoreNow') value += guest.ability.value || 1;
                else if (guest.ability.type === 'addOpponentHeat' && !player.doorClosed && !player.busted) value += 3;
                else if (guest.ability.type === 'boot' || guest.ability.type === 'bootAdjacent') value += 1.5;
                else value += 1;
            } else if (guest.ability.trigger === 'arrival') {
                if (guest.ability.type === 'scoreNow') value += guest.ability.value || 1;
                else if (guest.ability.type === 'plusOne') value += 2;
                else if (guest.ability.type === 'magnet') value += 2.5;
                else if (guest.ability.type === 'queueGatecrasher' && !player.doorClosed && !player.busted) value += 2;
                else if (guest.ability.type === 'socialClimber') value += 1;
                else value += 1;
            } else if (guest.ability.trigger === 'scoring') {
                // Estimate scoring bonus
                if (guest.ability.type === 'packedHouse') {
                    const cap = Game.getHouseCapacity(venue, rival);
                    value += (rival.house.length >= cap - 1) ? 4 : 1;
                } else if (guest.ability.type === 'chaosChaser') {
                    value += rival.heat;
                } else if (guest.ability.type === 'highRoller') {
                    value += Math.floor((rival.money + rival.roundMoney) / 2);
                } else if (guest.ability.type === 'centerOfAttention') {
                    value += 2; // will be newest
                } else {
                    value += 1.5;
                }
            } else if (guest.ability.trigger === 'departure') {
                if (guest.ability.type === 'coolHeat') value += 1;
                else if (guest.ability.type === 'scoreNow') value += guest.ability.value || 1;
                else if (guest.ability.type === 'gainMoney') value += (guest.ability.value || 1) * 0.8;
                else if (guest.ability.type === 'addOpponentHeat') value += 1.5;
                else if (guest.ability.type === 'queueGatecrasher') value += 1.5;
            }
        }

        // Gatecrasher is terrible
        if (guestId === 'gatecrasher') value = -10;

        return value;
    }

    // ========================================================
    // Synergy-aware buy phase
    // ========================================================
    function estimateGuestSynergy(guestId, rival, venue) {
        const guest = Game.GUESTS[guestId];
        if (!guest) return 0;
        let synergy = 0;

        // Count deck composition for synergy evaluation
        const deckCounts = Object.create(null);
        const tagCounts = Object.create(null);
        let totalHeat = 0;
        let abilityCount = 0;
        let scoringAbilityCount = 0;

        for (const id of rival.fullDeck) {
            deckCounts[id] = (deckCounts[id] || 0) + 1;
            const g = Game.GUESTS[id];
            if (g) {
                totalHeat += g.heat;
                if (g.ability) abilityCount++;
                if (g.ability?.trigger === 'scoring') scoringAbilityCount++;
                for (const tag of (g.tags || [])) {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                }
            }
        }

        const avgHeat = totalHeat / Math.max(1, rival.fullDeck.length);

        // Don't buy duplicates of guests we already have 2+ of
        if ((deckCounts[guestId] || 0) >= 2) synergy -= 3;

        // Scoring bonus synergies
        if (guest.ability?.trigger === 'scoring') {
            switch (guest.ability.type) {
                case 'packedHouse': {
                    // More valuable with larger house capacity
                    const cap = Game.getHouseCapacity(venue, rival);
                    if (cap >= 4) synergy += 3;
                    else synergy += 1.5;
                    break;
                }
                case 'chaosChaser':
                    // More valuable with high-heat decks
                    synergy += avgHeat >= 1.5 ? 4 : avgHeat >= 1 ? 2 : 0.5;
                    break;
                case 'highRoller':
                    // More valuable with money-generating decks
                    if (venue.style === 'money') synergy += 3;
                    else synergy += 1;
                    break;
                case 'clique':
                    // More valuable with tag-dense decks
                    if (guest.tags) {
                        for (const tag of guest.tags) {
                            synergy += (tagCounts[tag] || 0) * 0.3;
                        }
                    }
                    break;
                case 'wallflower':
                    // Less valuable with packed decks
                    synergy += rival.fullDeck.length <= 8 ? 2 : 0.5;
                    break;
            }
        }

        // Ability synergies
        if (guest.ability?.trigger === 'flash') {
            if (guest.ability.type === 'refreshAction' || guest.ability.type === 'refreshAllActions') {
                // More valuable with more flash abilities
                synergy += abilityCount * 0.3;
            }
            if (guest.ability.type === 'coolHeat' || guest.ability.type === 'setHeatZero') {
                // More valuable with high-heat decks
                synergy += avgHeat >= 1.5 ? 3 : avgHeat >= 1 ? 1.5 : 0.5;
            }
            if (guest.ability.type === 'scoreGuest') {
                // More valuable with high-value guests in deck
                synergy += 1.5;
            }
        }

        // Low heat guests are generally more valuable (enable longer runs)
        if (guest.heat === 0) synergy += 1;

        // Disruption abilities are more valuable in control style
        if (venue.style === 'control') {
            if (guest.ability?.type === 'addOpponentHeat') synergy += 2;
            if (guest.ability?.type === 'queueGatecrasher') synergy += 2;
            if (guest.ability?.type === 'opponentStackChoice') synergy += 1;
        }

        return synergy;
    }

    function decideBuyPhaseActions(state, market) {
        const rival = state.rival;
        const purchases = [];
        const venue = Game.VENUES[rival.venueId];

        const guestScores = buildGuestScoreMap(rival, market, venue);
        const ranked = rankMarketByMonteCarlo(rival, market, venue, guestScores);

        let budget = rival.money;

        const slotCost = 3 + (rival.shopItemPurchases.slotIncrease * 2);
        const heatCost = 4 + (rival.shopItemPurchases.heatCapIncrease * 3);
        const houseCapacity = Game.getHouseCapacity(venue, rival);
        const heatCapacity = Game.getHeatCapacity(venue, rival);

        // Enhanced upgrade evaluation
        const avgHeat = rival.fullDeck.reduce((sum, id) => sum + (Game.GUESTS[id]?.heat || 0), 0) / Math.max(1, rival.fullDeck.length);

        // Slot value: consider deck size vs capacity AND scoring bonuses like packedHouse
        let slotValue;
        const deckSize = rival.fullDeck.length;
        if (deckSize > houseCapacity + 2) slotValue = 10;
        else if (deckSize > houseCapacity) slotValue = 7;
        else slotValue = 3;
        // Bonus if we have packedHouse guests (bigger house = easier to fill relatively)
        const hasPackedHouse = rival.fullDeck.some(id => Game.GUESTS[id]?.ability?.type === 'packedHouse');
        if (hasPackedHouse) slotValue += 2;

        // Heat value: consider bust rate and deck composition
        let heatValue;
        const totalDeckHeat = rival.fullDeck.reduce((sum, id) => sum + (Game.GUESTS[id]?.heat || 0), 0);
        if (totalDeckHeat > heatCapacity * 1.5) heatValue = 12;
        else if (avgHeat >= 1.5) heatValue = 9;
        else if (avgHeat >= 1) heatValue = 5;
        else heatValue = 2;
        // Bonus if we have chaosChaser (higher heat = more scoring)
        const hasChaosChaser = rival.fullDeck.some(id => Game.GUESTS[id]?.ability?.type === 'chaosChaser');
        if (hasChaosChaser) heatValue += 3;

        // Build candidate list with synergy bonuses
        const candidates = [];
        for (const guestId of ranked) {
            const guest = Game.GUESTS[guestId];
            const cachedScore = guestScores.get(guestId);
            const baseValue = cachedScore?.scorePerCost ?? 0;
            const synergy = estimateGuestSynergy(guestId, rival, venue);
            candidates.push({
                id: guestId,
                cost: guest.cost,
                value: baseValue + synergy / Math.max(1, guest.cost),
            });
        }
        if (slotCost <= budget) {
            candidates.push({ id: 'slotIncrease', cost: slotCost, value: slotValue / Math.max(1, slotCost) });
        }
        if (heatCost <= budget) {
            candidates.push({ id: 'heatCapIncrease', cost: heatCost, value: heatValue / Math.max(1, heatCost) });
        }

        candidates.sort((a, b) => b.value - a.value);

        for (const item of candidates) {
            if (item.cost <= budget && purchases.length < 4) {
                purchases.push(item.id);
                budget -= item.cost;
            }
        }

        return purchases;
    }

    return { decideGuestAction, decideBuyPhaseActions, evaluateGuestForChoice };
})();
