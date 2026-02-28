/* ============================================
   VENUE RIVALS - Core Game Engine
   Turns, resources, customers, upgrades,
   events, win/loss conditions
   ============================================ */

const Game = (() => {

    // === Game Constants ===
    const WIN_EARNINGS = 10000;
    const STARTING_MONEY = 500;
    const STARTING_REP = 10;
    const BASE_CUSTOMERS_PER_TURN = 10;
    const MAX_TURNS = 50;
    const STAFF_WAGE = 15; // per staff per turn
    const BASE_REVENUE_PER_CUSTOMER = 12;
    const PROMO_COST = 80;
    const PROMO_BOOST = 15; // temporary reputation boost

    // === Venue Type Bonuses ===
    const VENUE_TYPES = {
        bar: {
            name: 'Bar',
            repBonus: 5,        // starts with +5 rep
            revenueMod: 0.9,    // slightly less revenue per customer
            costMod: 0.8,       // lower operating costs
            customerMod: 1.05,  // slightly more loyal customers
        },
        club: {
            name: 'Club',
            repBonus: 0,
            revenueMod: 1.2,    // high revenue per customer
            costMod: 1.2,       // high operating costs
            customerMod: 0.95,
        },
        lounge: {
            name: 'Lounge',
            repBonus: 3,
            revenueMod: 1.1,
            costMod: 1.0,
            customerMod: 1.0,
        },
    };

    // === Upgrade Definitions ===
    const UPGRADES = {
        better_decor: {
            name: 'Better Decor',
            icon: '\uD83C\uDFA8',
            description: 'Stylish interior, +8 reputation',
            cost: 200,
            effect: { reputation: 8, quality: 1 },
        },
        live_music: {
            name: 'Live Music',
            icon: '\uD83C\uDFB5',
            description: 'Live performances, +12 rep, +$3/customer',
            cost: 350,
            effect: { reputation: 12, revenuePerCustomer: 3 },
            requires: [],
        },
        premium_drinks: {
            name: 'Premium Drinks',
            icon: '\uD83C\uDF79',
            description: 'Top-shelf selection, +$5/customer',
            cost: 250,
            effect: { revenuePerCustomer: 5 },
        },
        outdoor_seating: {
            name: 'Outdoor Seating',
            icon: '\u2602\uFE0F',
            description: 'Patio area, +5 rep, +15% customers',
            cost: 300,
            effect: { reputation: 5, customerAttraction: 0.15 },
        },
        vip_section: {
            name: 'VIP Section',
            icon: '\u2B50',
            description: 'Exclusive area, +$8/customer, +10 rep',
            cost: 500,
            effect: { revenuePerCustomer: 8, reputation: 10 },
            requires: ['better_decor'],
        },
        sound_system: {
            name: 'Sound System',
            icon: '\uD83D\uDD0A',
            description: 'Professional audio, +7 rep, +$2/customer',
            cost: 200,
            effect: { reputation: 7, revenuePerCustomer: 2 },
        },
        kitchen: {
            name: 'Kitchen',
            icon: '\uD83C\uDF73',
            description: 'Food menu, +20% customers, +$4/customer',
            cost: 400,
            effect: { customerAttraction: 0.2, revenuePerCustomer: 4 },
        },
        neon_sign: {
            name: 'Neon Sign',
            icon: '\uD83D\uDCA1',
            description: 'Eye-catching signage, +10 rep',
            cost: 150,
            effect: { reputation: 10 },
        },
    };

    // === Random Event Pool ===
    const EVENTS = [
        {
            name: 'Health Inspection',
            description: 'A surprise health inspection! Venues with Kitchen upgrade pass easily.',
            effect: (state) => {
                const msgs = [];
                [state.player, state.rival].forEach((v, i) => {
                    const label = i === 0 ? 'player' : 'rival';
                    if (v.upgrades.includes('kitchen')) {
                        v.reputation += 5;
                        msgs.push({ who: label, text: `${v.name} passed with flying colors! +5 rep` });
                    } else {
                        v.reputation = Math.max(0, v.reputation - 8);
                        msgs.push({ who: label, text: `${v.name} got cited for violations. -8 rep` });
                    }
                });
                return msgs;
            },
        },
        {
            name: 'Local Festival',
            description: 'A street festival brings extra foot traffic!',
            effect: (state) => {
                state.bonusCustomers = (state.bonusCustomers || 0) + 8;
                return [{ who: 'neutral', text: '+8 bonus customers tonight!' }];
            },
        },
        {
            name: 'Celebrity Visit',
            description: 'A local celebrity is looking for a night out!',
            effect: (state) => {
                const msgs = [];
                const pScore = state.player.reputation + (state.player.upgrades.includes('vip_section') ? 20 : 0);
                const rScore = state.rival.reputation + (state.rival.upgrades.includes('vip_section') ? 20 : 0);
                if (pScore >= rScore) {
                    state.player.reputation += 15;
                    state.player.money += 100;
                    msgs.push({ who: 'player', text: `${state.player.name} hosted the celebrity! +15 rep, +$100` });
                } else {
                    state.rival.reputation += 15;
                    state.rival.money += 100;
                    msgs.push({ who: 'rival', text: `${state.rival.name} hosted the celebrity! +15 rep, +$100` });
                }
                return msgs;
            },
        },
        {
            name: 'Bad Weather',
            description: 'Rain keeps customers away tonight.',
            effect: (state) => {
                state.bonusCustomers = (state.bonusCustomers || 0) - 4;
                const msgs = [{ who: 'neutral', text: '-4 customers tonight due to rain.' }];
                // Outdoor seating penalty
                [state.player, state.rival].forEach((v, i) => {
                    if (v.upgrades.includes('outdoor_seating')) {
                        v.reputation = Math.max(0, v.reputation - 3);
                        msgs.push({ who: i === 0 ? 'player' : 'rival', text: `${v.name}'s outdoor seating is unusable. -3 rep` });
                    }
                });
                return msgs;
            },
        },
        {
            name: 'Food Critic Review',
            description: 'A famous food critic visits the block!',
            effect: (state) => {
                const msgs = [];
                [state.player, state.rival].forEach((v, i) => {
                    const label = i === 0 ? 'player' : 'rival';
                    const qualityScore = v.reputation + (v.upgrades.includes('premium_drinks') ? 10 : 0) + (v.upgrades.includes('kitchen') ? 15 : 0);
                    if (qualityScore > 30) {
                        v.reputation += 10;
                        msgs.push({ who: label, text: `${v.name} got a glowing review! +10 rep` });
                    } else {
                        v.reputation = Math.max(0, v.reputation - 5);
                        msgs.push({ who: label, text: `${v.name} got a lukewarm review. -5 rep` });
                    }
                });
                return msgs;
            },
        },
        {
            name: 'Power Outage',
            description: 'A brief power outage hits the block!',
            effect: (state) => {
                const msgs = [];
                [state.player, state.rival].forEach((v, i) => {
                    const label = i === 0 ? 'player' : 'rival';
                    if (v.upgrades.includes('sound_system') || v.upgrades.includes('live_music')) {
                        v.reputation = Math.max(0, v.reputation - 5);
                        msgs.push({ who: label, text: `${v.name}'s equipment was disrupted. -5 rep` });
                    } else {
                        msgs.push({ who: label, text: `${v.name} was mostly unaffected.` });
                    }
                });
                return msgs;
            },
        },
    ];

    // === Game State Factory ===
    function createVenue(name, type) {
        const typeData = VENUE_TYPES[type] || VENUE_TYPES.bar;
        return {
            name: name,
            type: type,
            money: STARTING_MONEY,
            reputation: STARTING_REP + typeData.repBonus,
            totalEarnings: 0,
            staff: 1,
            upgrades: [],
            promoActive: false,
            promoTurnsLeft: 0,
        };
    }

    function createGameState(playerName, playerType) {
        // AI picks a random different type
        const types = ['bar', 'club', 'lounge'];
        const rivalType = types.filter(t => t !== playerType)[Math.floor(Math.random() * 2)];

        const rivalNames = [
            'The Crimson Fox', 'Midnight Ember', 'Velvet Edge',
            'Neon Pulse', 'The Gilded Owl', 'Shadow & Tonic',
        ];
        const rivalName = rivalNames[Math.floor(Math.random() * rivalNames.length)];

        return {
            turn: 1,
            phase: 'action', // 'action', 'resolution', 'event', 'gameover'
            player: createVenue(playerName, playerType),
            rival: createVenue(rivalName, rivalType),
            bonusCustomers: 0,
            lastRoundPlayerCustomers: 0,
            lastRoundRivalCustomers: 0,
            lastActionFrame: 0,
            log: [],
            winner: null,
        };
    }

    // === Turn Resolution ===
    function getCustomerPool(state) {
        const base = BASE_CUSTOMERS_PER_TURN + Math.floor(state.turn / 5) * 2;
        return Math.max(2, base + (state.bonusCustomers || 0));
    }

    function getAttractionScore(venue) {
        const typeData = VENUE_TYPES[venue.type];
        let score = venue.reputation * typeData.customerMod;

        // Upgrade bonuses
        venue.upgrades.forEach(id => {
            const upg = UPGRADES[id];
            if (upg && upg.effect.customerAttraction) {
                score *= (1 + upg.effect.customerAttraction);
            }
        });

        // Staff bonus
        score += (venue.staff - 1) * 3;

        // Promo bonus
        if (venue.promoActive) {
            score += PROMO_BOOST;
        }

        // Happy hour: +20% customer attraction
        if (venue._happyHourActive) {
            score *= 1.2;
        }

        return Math.max(1, score);
    }

    function getRevenuePerCustomer(venue) {
        const typeData = VENUE_TYPES[venue.type];
        let rev = BASE_REVENUE_PER_CUSTOMER * typeData.revenueMod;

        venue.upgrades.forEach(id => {
            const upg = UPGRADES[id];
            if (upg && upg.effect.revenuePerCustomer) {
                rev += upg.effect.revenuePerCustomer;
            }
        });

        // Happy hour reduces revenue by 30%
        if (venue._happyHourActive) {
            rev *= 0.7;
        }

        return rev;
    }

    function getOperatingCosts(venue) {
        const typeData = VENUE_TYPES[venue.type];
        return Math.round(venue.staff * STAFF_WAGE * typeData.costMod);
    }

    function resolveCustomers(state) {
        const pool = getCustomerPool(state);
        const pScore = getAttractionScore(state.player);
        const rScore = getAttractionScore(state.rival);
        const total = pScore + rScore;

        // Distribute customers proportionally with some randomness
        const pRatio = pScore / total;
        let pCustomers = 0;
        for (let i = 0; i < pool; i++) {
            const roll = Math.random();
            // Add some noise (±10%) so it's not purely deterministic
            const threshold = pRatio + (Math.random() - 0.5) * 0.1;
            if (roll < threshold) {
                pCustomers++;
            }
        }
        const rCustomers = pool - pCustomers;

        return { playerCustomers: pCustomers, rivalCustomers: rCustomers, totalPool: pool };
    }

    function resolveTurn(state) {
        const results = { messages: [], event: null };

        // Random event (30% chance after turn 3)
        state.bonusCustomers = 0;
        if (state.turn > 3 && Math.random() < 0.3) {
            const event = EVENTS[Math.floor(Math.random() * EVENTS.length)];
            results.event = event;
            const eventMsgs = event.effect(state);
            results.messages.push({ type: 'event', title: event.name, desc: event.description, details: eventMsgs });
        }

        // Customer distribution
        const cust = resolveCustomers(state);
        state.lastRoundPlayerCustomers = cust.playerCustomers;
        state.lastRoundRivalCustomers = cust.rivalCustomers;

        // Player revenue
        const pRevPerCust = getRevenuePerCustomer(state.player);
        const pRevenue = Math.round(cust.playerCustomers * pRevPerCust);
        const pCosts = getOperatingCosts(state.player);
        const pProfit = pRevenue - pCosts;
        state.player.money += pProfit;
        state.player.totalEarnings += Math.max(0, pRevenue);

        // Reputation drift (+1 per 3 customers)
        state.player.reputation += Math.floor(cust.playerCustomers / 3);
        // Natural reputation decay
        state.player.reputation = Math.max(1, state.player.reputation - 1);

        // Rival revenue
        const rRevPerCust = getRevenuePerCustomer(state.rival);
        const rRevenue = Math.round(cust.rivalCustomers * rRevPerCust);
        const rCosts = getOperatingCosts(state.rival);
        const rProfit = rRevenue - rCosts;
        state.rival.money += rProfit;
        state.rival.totalEarnings += Math.max(0, rRevenue);

        state.rival.reputation += Math.floor(cust.rivalCustomers / 3);
        state.rival.reputation = Math.max(1, state.rival.reputation - 1);

        // Handle promos
        [state.player, state.rival].forEach(v => {
            if (v.promoActive) {
                v.promoTurnsLeft--;
                if (v.promoTurnsLeft <= 0) {
                    v.promoActive = false;
                }
            }
        });

        results.messages.push({
            type: 'resolution',
            pool: cust.totalPool,
            playerCustomers: cust.playerCustomers,
            rivalCustomers: cust.rivalCustomers,
            playerRevenue: pRevenue,
            playerCosts: pCosts,
            playerProfit: pProfit,
            rivalRevenue: rRevenue,
            rivalCosts: rCosts,
            rivalProfit: rProfit,
        });

        // Check win/loss
        if (state.player.totalEarnings >= WIN_EARNINGS) {
            state.winner = 'player';
            state.phase = 'gameover';
        } else if (state.rival.totalEarnings >= WIN_EARNINGS) {
            state.winner = 'rival';
            state.phase = 'gameover';
        } else if (state.player.money < -100) {
            state.winner = 'rival';
            state.phase = 'gameover';
        } else if (state.rival.money < -100) {
            state.winner = 'player';
            state.phase = 'gameover';
        } else if (state.turn >= MAX_TURNS) {
            // Whoever has more total earnings wins
            state.winner = state.player.totalEarnings >= state.rival.totalEarnings ? 'player' : 'rival';
            state.phase = 'gameover';
        }

        return results;
    }

    // === Actions ===
    function getAvailableActions(state) {
        const v = state.player;
        const actions = [];

        // 1. Upgrade venue
        actions.push({
            id: 'upgrade',
            name: 'Upgrade',
            icon: '\uD83D\uDD27',
            description: 'Invest in your venue',
            cost: null, // varies
            enabled: Object.keys(UPGRADES).some(id =>
                !v.upgrades.includes(id) && v.money >= UPGRADES[id].cost &&
                (!UPGRADES[id].requires || UPGRADES[id].requires.every(r => v.upgrades.includes(r)))
            ),
        });

        // 2. Hire staff
        const hireCost = 50 + v.staff * 25;
        actions.push({
            id: 'hire',
            name: 'Hire Staff',
            icon: '\uD83D\uDC64',
            description: `Improve service quality (+3 attraction)`,
            cost: hireCost,
            enabled: v.money >= hireCost && v.staff < 6,
        });

        // 3. Run promotion
        actions.push({
            id: 'promo',
            name: 'Promotion',
            icon: '\uD83D\uDCE3',
            description: `Marketing blitz (+${PROMO_BOOST} rep for 2 turns)`,
            cost: PROMO_COST,
            enabled: v.money >= PROMO_COST && !v.promoActive,
        });

        // 4. Lower prices (sacrifice revenue for more customers)
        actions.push({
            id: 'happy_hour',
            name: 'Happy Hour',
            icon: '\uD83C\uDF7B',
            description: 'Discount night: +20% customers, -30% revenue this turn',
            cost: 0,
            enabled: true,
            special: true,
        });

        // 5. Save / do nothing
        actions.push({
            id: 'save',
            name: 'Save Cash',
            icon: '\uD83D\uDCB0',
            description: 'Conserve resources, slight rep boost',
            cost: 0,
            enabled: true,
        });

        return actions;
    }

    function getAvailableUpgrades(state) {
        const v = state.player;
        return Object.entries(UPGRADES).map(([id, upg]) => {
            const owned = v.upgrades.includes(id);
            const canAfford = v.money >= upg.cost;
            const reqsMet = !upg.requires || upg.requires.every(r => v.upgrades.includes(r));
            return {
                id,
                ...upg,
                owned,
                enabled: !owned && canAfford && reqsMet,
            };
        });
    }

    function executeAction(state, actionId, upgradeId) {
        const v = state.player;
        const msg = [];

        switch (actionId) {
            case 'upgrade':
                if (upgradeId && UPGRADES[upgradeId]) {
                    const upg = UPGRADES[upgradeId];
                    v.money -= upg.cost;
                    v.upgrades.push(upgradeId);
                    if (upg.effect.reputation) {
                        v.reputation += upg.effect.reputation;
                    }
                    msg.push(`Installed ${upg.name} (-$${upg.cost})`);
                }
                break;

            case 'hire':
                const cost = 50 + v.staff * 25;
                v.money -= cost;
                v.staff++;
                msg.push(`Hired new staff member (-$${cost}). Staff: ${v.staff}`);
                break;

            case 'promo':
                v.money -= PROMO_COST;
                v.promoActive = true;
                v.promoTurnsLeft = 2;
                msg.push(`Launched promotion campaign (-$${PROMO_COST})`);
                break;

            case 'happy_hour':
                // Temporary effect applied during resolution
                v._happyHour = true;
                msg.push('Happy Hour announced! Discounts tonight.');
                break;

            case 'save':
                v.reputation += 2;
                msg.push('Saved cash and focused on service. +2 reputation.');
                break;
        }

        return msg;
    }

    function advanceTurn(state) {
        // Apply happy hour effects before resolution (both player and rival)
        [state.player, state.rival].forEach(v => {
            if (v._happyHour) {
                v._happyHourActive = true;
            }
        });

        const results = resolveTurn(state);

        // Remove happy hour effects after resolution
        [state.player, state.rival].forEach(v => {
            if (v._happyHourActive) {
                delete v._happyHourActive;
                delete v._happyHour;
            }
        });

        if (state.phase !== 'gameover') {
            state.turn++;
        }

        return results;
    }

    return {
        createGameState,
        getCustomerPool,
        getAvailableActions,
        getAvailableUpgrades,
        executeAction,
        advanceTurn,
        resolveTurn,
        getAttractionScore,
        getRevenuePerCustomer,
        getOperatingCosts,
        UPGRADES,
        VENUE_TYPES,
        WIN_EARNINGS,
    };
})();
