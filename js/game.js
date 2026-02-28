/* ============================================
   VENUE RIVALS - Core Game Engine
   Deck-based simultaneous round system
   ============================================ */

const Game = (() => {
    const WIN_EARNINGS = 10000;
    const STARTING_MONEY = 500;
    const STARTING_REP = 10;
    const BASE_CUSTOMERS_PER_TURN = 10;
    const MAX_TURNS = 3;
    const STAFF_WAGE = 15;
    const BASE_REVENUE_PER_CUSTOMER = 12;

    const VENUE_TYPES = {
        bar: { name: 'Bar', repBonus: 5, revenueMod: 0.9, costMod: 0.8, customerMod: 1.05, maxOccupancy: 6 },
        club: { name: 'Club', repBonus: 0, revenueMod: 1.2, costMod: 1.2, customerMod: 0.95, maxOccupancy: 7 },
        lounge: { name: 'Lounge', repBonus: 3, revenueMod: 1.1, costMod: 1.0, customerMod: 1.0, maxOccupancy: 9 },
    };

    const UPGRADES = {};

    const GUEST_POOL = [
        { id: 'performer', name: 'Performer', icon: '🎤', admitRep: 2, abilityName: 'Headline Show', abilityText: '+8 attraction this round', ability: { type: 'attraction', amount: 8 } },
        { id: 'vip', name: 'VIP', icon: '⭐', admitRep: 1, abilityName: 'Bottle Service', abilityText: '+6 revenue per customer this round', ability: { type: 'revBonus', amount: 6 } },
        { id: 'instigator', name: 'Instigator', icon: '🔥', admitRep: 0, abilityName: 'Cause a Scene', abilityText: 'Rival -7 attraction this round', ability: { type: 'disruptAttraction', amount: 7 } },
        { id: 'gatecrasher', name: 'Gatecrasher', icon: '🚨', admitRep: -1, abilityName: 'Bounce to Rival', abilityText: 'Rival loses 2 reputation', ability: { type: 'repDamage', amount: 2 } },
        { id: 'promoter', name: 'Promoter', icon: '📣', admitRep: 1, abilityName: 'Street Flyering', abilityText: '+5 attraction and +1 reputation', ability: { type: 'combo', attraction: 5, rep: 1 } },
        { id: 'inspector', name: 'Inspector', icon: '🕵️', admitRep: 0, abilityName: 'Spot Check', abilityText: 'Rival closes house this round', ability: { type: 'forceClose' } },
        { id: 'socialite', name: 'Socialite', icon: '💎', admitRep: 2, abilityName: 'Network Buzz', abilityText: '+3 attraction and +$40', ability: { type: 'attractionCash', attraction: 3, cash: 40 } },
        { id: 'regular', name: 'Regular', icon: '🙂', admitRep: 1, abilityName: 'Loyal Crowd', abilityText: '+4 attraction', ability: { type: 'attraction', amount: 4 } },
        { id: 'critic', name: 'Critic', icon: '📝', admitRep: 0, abilityName: 'Glowing Review', abilityText: '+4 reputation', ability: { type: 'repBoost', amount: 4 } },
        { id: 'tourists', name: 'Tourists', icon: '🧳', admitRep: 1, abilityName: 'Group Booking', abilityText: '+3 customers this round', ability: { type: 'bonusCustomers', amount: 3 } },
        { id: 'bartender', name: 'Star Bartender', icon: '🍸', admitRep: 1, abilityName: 'Premium Menu', abilityText: '+4 revenue per customer', ability: { type: 'revBonus', amount: 4 } },
        { id: 'bouncer', name: 'Bouncer', icon: '🛡️', admitRep: 0, abilityName: 'Control the Door', abilityText: 'No overcrowd penalty this round', ability: { type: 'preventOvercrowd' } },
    ];

    const EVENTS = [
        {
            name: 'Local Festival',
            description: 'A street festival brings extra foot traffic!',
            effect: (state) => {
                state.bonusCustomers = (state.bonusCustomers || 0) + 5;
                return [{ who: 'neutral', text: '+5 bonus customers tonight!' }];
            },
        },
        {
            name: 'Bad Weather',
            description: 'Rain keeps some guests at home.',
            effect: (state) => {
                state.bonusCustomers = (state.bonusCustomers || 0) - 3;
                return [{ who: 'neutral', text: '-3 customers tonight due to rain.' }];
            },
        },
    ];

    function shuffle(list) {
        const deck = [...list];
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }

    function drawGuest(venue) {
        if (!venue.guestDeck.length) {
            venue.guestDeck = shuffle(venue.guestDiscard);
            venue.guestDiscard = [];
        }
        venue.currentGuest = venue.guestDeck.shift() || null;
    }

    function createVenue(name, type) {
        const typeData = VENUE_TYPES[type] || VENUE_TYPES.bar;
        return {
            name,
            type,
            money: STARTING_MONEY,
            reputation: STARTING_REP + typeData.repBonus,
            totalEarnings: 0,
            staff: 1,
            upgrades: [],
            promoActive: false,
            promoTurnsLeft: 0,
            maxOccupancy: typeData.maxOccupancy,
            houseOccupancy: 0,
            guestDeck: shuffle(GUEST_POOL),
            guestDiscard: [],
            currentGuest: null,
            houseClosed: false,
            roundAttractionBonus: 0,
            roundRevenueBonus: 0,
            ignoreOvercrowdPenalty: false,
        };
    }

    function createGameState(playerName, playerType) {
        const types = ['bar', 'club', 'lounge'];
        const rivalType = types.filter(t => t !== playerType)[Math.floor(Math.random() * 2)];
        const rivalNames = ['The Crimson Fox', 'Midnight Ember', 'Velvet Edge', 'Neon Pulse'];
        const state = {
            turn: 1,
            phase: 'action',
            player: createVenue(playerName, playerType),
            rival: createVenue(rivalNames[Math.floor(Math.random() * rivalNames.length)], rivalType),
            bonusCustomers: 0,
            lastRoundPlayerCustomers: 0,
            lastRoundRivalCustomers: 0,
            lastActionFrame: 0,
            winner: null,
        };
        drawGuest(state.player);
        drawGuest(state.rival);
        return state;
    }

    function getCustomerPool(state) {
        return Math.max(4, BASE_CUSTOMERS_PER_TURN + (state.bonusCustomers || 0));
    }

    function getAttractionScore(venue) {
        if (venue.houseClosed) return 0;
        const typeData = VENUE_TYPES[venue.type];
        let score = venue.reputation * typeData.customerMod + venue.roundAttractionBonus;
        score += Math.min(venue.houseOccupancy, venue.maxOccupancy);
        return Math.max(0, score);
    }

    function getRevenuePerCustomer(venue) {
        const typeData = VENUE_TYPES[venue.type];
        return BASE_REVENUE_PER_CUSTOMER * typeData.revenueMod + venue.roundRevenueBonus;
    }

    function getOperatingCosts(venue) {
        const typeData = VENUE_TYPES[venue.type];
        return Math.round(venue.staff * STAFF_WAGE * typeData.costMod);
    }

    function resetRoundModifiers(venue) {
        venue.houseClosed = false;
        venue.roundAttractionBonus = 0;
        venue.roundRevenueBonus = 0;
        venue.ignoreOvercrowdPenalty = false;
    }

    function applyGuestAbility(state, actor, target, guest, log) {
        const ability = guest.ability;
        switch (ability.type) {
            case 'attraction':
                actor.roundAttractionBonus += ability.amount;
                log.push(`${actor.name} used ${guest.abilityName}: +${ability.amount} attraction.`);
                break;
            case 'revBonus':
                actor.roundRevenueBonus += ability.amount;
                log.push(`${actor.name} used ${guest.abilityName}: +$${ability.amount}/customer.`);
                break;
            case 'disruptAttraction':
                target.roundAttractionBonus -= ability.amount;
                log.push(`${actor.name} used ${guest.abilityName}: ${target.name} -${ability.amount} attraction.`);
                break;
            case 'repDamage':
                target.reputation = Math.max(1, target.reputation - ability.amount);
                log.push(`${actor.name} sent trouble to ${target.name}: -${ability.amount} reputation.`);
                break;
            case 'combo':
                actor.roundAttractionBonus += ability.attraction;
                actor.reputation += ability.rep;
                log.push(`${actor.name} built buzz: +${ability.attraction} attraction, +${ability.rep} reputation.`);
                break;
            case 'forceClose':
                target.houseClosed = true;
                log.push(`${actor.name} triggered inspections. ${target.name} closed for the round.`);
                break;
            case 'attractionCash':
                actor.roundAttractionBonus += ability.attraction;
                actor.money += ability.cash;
                log.push(`${actor.name} cashed in: +${ability.attraction} attraction and +$${ability.cash}.`);
                break;
            case 'repBoost':
                actor.reputation += ability.amount;
                log.push(`${actor.name} gained +${ability.amount} reputation.`);
                break;
            case 'bonusCustomers':
                state.bonusCustomers += ability.amount;
                log.push(`${actor.name} secured a group booking (+${ability.amount} customers this round).`);
                break;
            case 'preventOvercrowd':
                actor.ignoreOvercrowdPenalty = true;
                log.push(`${actor.name} is protected from overcrowd penalties this round.`);
                break;
        }
    }

    function executeRoundAction(state, side, actionId) {
        const actor = state[side];
        const target = side === 'player' ? state.rival : state.player;
        const guest = actor.currentGuest;
        const msg = [];
        if (!guest) return msg;

        if (actionId === 'admit') {
            actor.houseOccupancy = Math.min(actor.maxOccupancy + 2, actor.houseOccupancy + 1);
            actor.reputation = Math.max(1, actor.reputation + guest.admitRep);
            msg.push(`${actor.name} admitted ${guest.name}. Occupancy ${actor.houseOccupancy}/${actor.maxOccupancy}.`);
        } else if (actionId === 'ability') {
            applyGuestAbility(state, actor, target, guest, msg);
        } else if (actionId === 'close') {
            actor.houseClosed = true;
            actor.houseOccupancy = Math.max(0, actor.houseOccupancy - 1);
            actor.reputation += 1;
            msg.push(`${actor.name} closed the house this round to reset pressure.`);
        }

        actor.guestDiscard.push(guest);
        actor.currentGuest = null;
        return msg;
    }

    function resolveCustomers(state) {
        const pool = getCustomerPool(state);
        const pScore = getAttractionScore(state.player);
        const rScore = getAttractionScore(state.rival);
        const total = Math.max(1, pScore + rScore);
        let pCustomers = Math.round((pScore / total) * pool);
        pCustomers = Math.max(0, Math.min(pool, pCustomers));
        const rCustomers = pool - pCustomers;
        return { playerCustomers: pCustomers, rivalCustomers: rCustomers, totalPool: pool };
    }

    function applyOvercrowd(venue) {
        if (venue.ignoreOvercrowdPenalty) return;
        if (venue.houseOccupancy > venue.maxOccupancy) {
            venue.reputation = Math.max(1, venue.reputation - 3);
        }
    }

    function resolveTurn(state) {
        const results = { messages: [] };
        state.bonusCustomers = 0;

        if (state.turn > 1 && Math.random() < 0.25) {
            const event = EVENTS[Math.floor(Math.random() * EVENTS.length)];
            const details = event.effect(state);
            results.messages.push({ type: 'event', title: event.name, desc: event.description, details });
        }

        const cust = resolveCustomers(state);
        state.lastRoundPlayerCustomers = cust.playerCustomers;
        state.lastRoundRivalCustomers = cust.rivalCustomers;

        const pRevenue = Math.round(cust.playerCustomers * getRevenuePerCustomer(state.player));
        const rRevenue = Math.round(cust.rivalCustomers * getRevenuePerCustomer(state.rival));
        const pCosts = getOperatingCosts(state.player);
        const rCosts = getOperatingCosts(state.rival);
        const pProfit = pRevenue - pCosts;
        const rProfit = rRevenue - rCosts;

        state.player.money += pProfit;
        state.rival.money += rProfit;
        state.player.totalEarnings += Math.max(0, pRevenue);
        state.rival.totalEarnings += Math.max(0, rRevenue);

        state.player.reputation = Math.max(1, state.player.reputation + Math.floor(cust.playerCustomers / 3) - 1);
        state.rival.reputation = Math.max(1, state.rival.reputation + Math.floor(cust.rivalCustomers / 3) - 1);

        applyOvercrowd(state.player);
        applyOvercrowd(state.rival);

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

        if (state.turn >= MAX_TURNS || state.player.money < -100 || state.rival.money < -100) {
            state.phase = 'gameover';
            state.winner = state.player.totalEarnings >= state.rival.totalEarnings ? 'player' : 'rival';
        }

        return results;
    }

    function playRound(state, playerAction, rivalAction) {
        resetRoundModifiers(state.player);
        resetRoundModifiers(state.rival);

        const actionLog = [
            ...executeRoundAction(state, 'player', playerAction),
            ...executeRoundAction(state, 'rival', rivalAction),
        ];

        const results = resolveTurn(state);
        results.messages.unshift({ type: 'actionSummary', details: actionLog });

        if (state.phase !== 'gameover') {
            state.turn += 1;
            drawGuest(state.player);
            drawGuest(state.rival);
        }

        return results;
    }

    function getRoundActions(state) {
        const g = state.player.currentGuest;
        if (!g) return [];
        return [
            { id: 'ability', name: `Use Ability: ${g.abilityName}`, icon: '✨', description: g.abilityText, enabled: true },
            { id: 'admit', name: `Admit ${g.name}`, icon: '🚪', description: `Increase occupancy by 1 and adjust reputation by ${g.admitRep >= 0 ? '+' : ''}${g.admitRep}.`, enabled: true },
            { id: 'close', name: 'Close House', icon: '🔒', description: 'Take no guest this round. Reduce occupancy by 1 and gain +1 reputation.', enabled: true },
        ];
    }

    return {
        createGameState,
        getCustomerPool,
        getAttractionScore,
        getRevenuePerCustomer,
        getOperatingCosts,
        getRoundActions,
        playRound,
        resolveTurn,
        UPGRADES,
        VENUE_TYPES,
        WIN_EARNINGS,
    };
})();
