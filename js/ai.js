/* ============================================
   VENUE RIVALS - AI Opponent
   Strategic decision-making for rival venue
   ============================================ */

const AI = (() => {

    function takeTurn(state) {
        const rival = state.rival;
        const player = state.player;
        const msgs = [];

        // AI strategy based on game phase
        const earlyGame = state.turn <= 8;
        const midGame = state.turn > 8 && state.turn <= 20;
        const lateGame = state.turn > 20;

        // Evaluate situation
        const isWinning = rival.totalEarnings > player.totalEarnings;
        const isBehind = rival.totalEarnings < player.totalEarnings - 500;
        const isRich = rival.money > 400;
        const isPoor = rival.money < 150;

        // Get available upgrades the AI can afford
        const availableUpgrades = Object.entries(Game.UPGRADES)
            .filter(([id, upg]) => {
                if (rival.upgrades.includes(id)) return false;
                if (rival.money < upg.cost) return false;
                if (upg.requires && !upg.requires.every(r => rival.upgrades.includes(r))) return false;
                return true;
            })
            .map(([id, upg]) => ({ id, ...upg }));

        // Priority 1: If very poor, save money
        if (isPoor && !earlyGame) {
            rival.reputation += 2;
            msgs.push(`${rival.name} is laying low and saving cash.`);
            return msgs;
        }

        // Priority 2: Run promo if behind and can afford it
        if (isBehind && !rival.promoActive && rival.money >= 80 && Math.random() < 0.5) {
            rival.money -= 80;
            rival.promoActive = true;
            rival.promoTurnsLeft = 2;
            msgs.push(`${rival.name} launched a marketing blitz!`);
            return msgs;
        }

        // Priority 3: Buy upgrades strategically
        if (availableUpgrades.length > 0 && isRich) {
            // Prioritize upgrades based on game phase
            let bestUpgrade = null;

            if (earlyGame) {
                // Prioritize cheap reputation boosters
                bestUpgrade = availableUpgrades
                    .filter(u => u.cost <= 250)
                    .sort((a, b) => {
                        const aRep = (a.effect.reputation || 0);
                        const bRep = (b.effect.reputation || 0);
                        return bRep - aRep;
                    })[0];
            } else if (midGame) {
                // Prioritize customer and revenue upgrades
                bestUpgrade = availableUpgrades
                    .sort((a, b) => {
                        const aVal = (a.effect.revenuePerCustomer || 0) * 5 +
                                     (a.effect.reputation || 0) +
                                     (a.effect.customerAttraction || 0) * 30;
                        const bVal = (b.effect.revenuePerCustomer || 0) * 5 +
                                     (b.effect.reputation || 0) +
                                     (b.effect.customerAttraction || 0) * 30;
                        return bVal - aVal;
                    })[0];
            } else {
                // Late game: go for the most expensive/powerful
                bestUpgrade = availableUpgrades
                    .sort((a, b) => b.cost - a.cost)[0];
            }

            if (bestUpgrade) {
                rival.money -= bestUpgrade.cost;
                rival.upgrades.push(bestUpgrade.id);
                if (bestUpgrade.effect.reputation) {
                    rival.reputation += bestUpgrade.effect.reputation;
                }
                msgs.push(`${rival.name} installed ${bestUpgrade.name}!`);
                return msgs;
            }
        }

        // Priority 4: Hire staff if understaffed
        const hireCost = 50 + rival.staff * 25;
        if (rival.staff < 3 && rival.money >= hireCost && Math.random() < 0.6) {
            rival.money -= hireCost;
            rival.staff++;
            msgs.push(`${rival.name} hired new staff.`);
            return msgs;
        }

        // Priority 5: Promo if not active
        if (!rival.promoActive && rival.money >= 80 && Math.random() < 0.35) {
            rival.money -= 80;
            rival.promoActive = true;
            rival.promoTurnsLeft = 2;
            msgs.push(`${rival.name} launched a promotion.`);
            return msgs;
        }

        // Priority 6: Happy hour if losing customers
        const pAttraction = Game.getAttractionScore(player);
        const rAttraction = Game.getAttractionScore(rival);
        if (rAttraction < pAttraction * 0.7 && Math.random() < 0.4) {
            rival._happyHour = true; // Handled temporarily in advanceTurn
            msgs.push(`${rival.name} is running Happy Hour specials!`);
            return msgs;
        }

        // Default: save
        rival.reputation += 2;
        msgs.push(`${rival.name} focused on daily operations.`);
        return msgs;
    }

    return { takeTurn };
})();
