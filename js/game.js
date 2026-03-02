/* ============================================
   VENUE RIVALS - Core Game Engine
   Push-your-luck 1v1 competitive venue battler
   Guests, venues, deck management, phases
   ============================================ */

const Game = (() => {

    const DEFAULT_TOTAL_ROUNDS = 3;
    const BUST_PENALTY = 0.25; // keep 25% of earnings when busted

    // === Guest Definitions ===
    const GUESTS = {
        // Neutral / shared
        standIn:            { name: 'Stand-In', emoji: '🎭', heat: 2, money: 1, points: 2, cost: 3, desc: 'Tag bridge that stabilizes your build.', tier: 'common' },
        usher:              { name: 'Usher', emoji: '🧤', heat: 1, money: 1, points: 2, cost: 3, desc: 'Rescues key guests from the exit edge.', tier: 'common' },
        rovingCritic:       { name: 'Roving Critic', emoji: '🧐', heat: 2, money: 0, points: 3, cost: 4, desc: 'Marks endangered guests for payoff.', tier: 'uncommon' },
        floorRunner:        { name: 'Floor Runner', emoji: '🏃', heat: 2, money: 1, points: 1, cost: 3, desc: 'Starts intentional cash-out exits.', tier: 'common' },
        bookkeeper:         { name: 'Bookkeeper', emoji: '📒', heat: 1, money: 2, points: 1, cost: 3, desc: 'Converts close timing into economy.', tier: 'common' },
        partyPromoter:      { name: 'Party Promoter', emoji: '📣', heat: 3, money: 2, points: 1, cost: 4, desc: 'Shapes your buy phase by chosen tag.', tier: 'uncommon' },

        // Velvet Room
        headliner:          { name: 'Headliner', emoji: '🌟', heat: 3, money: 1, points: 5, cost: 6, desc: 'Protected star with big close payoff.', tier: 'rare' },
        champagneHost:      { name: 'Champagne Host', emoji: '🥂', heat: 2, money: 2, points: 3, cost: 5, desc: 'Exact-full closer for VIP lines.', tier: 'uncommon' },
        velvetBouncer:      { name: 'Velvet Bouncer', emoji: '🛡️', heat: 1, money: 1, points: 1, cost: 4, desc: 'Bodyguard support that later cashes out.', tier: 'uncommon', ability: { name: 'Guard', desc: 'Remove 2 heat', icon: '❄', type: 'reduceHeat', value: 2 } },
        spotlightPhotographer: { name: 'Spotlight Photographer', emoji: '📸', heat: 2, money: 1, points: 4, cost: 5, desc: 'Turns preserved marks into points.', tier: 'uncommon' },

        // Night Market
        galleryScout:       { name: 'Gallery Scout', emoji: '🔭', heat: 1, money: 2, points: 1, cost: 4, desc: 'Queue sculpting plus stash setup.', tier: 'common' },
        trendBroker:        { name: 'Trend Broker', emoji: '📈', heat: 2, money: 3, points: 1, cost: 5, desc: 'Rewards Most Common Tag planning.', tier: 'uncommon' },
        curioDealer:        { name: 'Curio Dealer', emoji: '🗃️', heat: 1, money: 3, points: 0, cost: 4, desc: 'Converts left-edge risk into economy.', tier: 'common' },
        stylist:            { name: 'Stylist', emoji: '🧵', heat: 2, money: 1, points: 3, cost: 4, desc: 'Bends adjacent tags into your plan.', tier: 'uncommon' },

        // Back Alley (trouble 1)
        gateRunner:         { name: 'Gate Runner', emoji: '🚨', heat: 1, money: 1, points: 2, cost: 4, desc: 'Queues Gatecrasher pressure on entry.', tier: 'common' },
        wheelman:           { name: 'Wheelman', emoji: '🚗', heat: 1, money: 3, points: 1, cost: 4, desc: 'General shove engine and cash-out body.', tier: 'common' },
        fence:              { name: 'Fence', emoji: '🧰', heat: 1, money: 3, points: 0, cost: 4, desc: 'Outlaw exit economy anchor.', tier: 'common' },
        provocateur:        { name: 'Provocateur', emoji: '😈', heat: 1, money: 1, points: 3, cost: 5, desc: 'Punishes opponents for overextending.', tier: 'uncommon' },
    };

    // === Venue Definitions ===
    const VENUES = {
        velvetRoom: {
            name: 'Velvet Room',
            emoji: '🥂',
            gridSize: 5,
            bustThreshold: 6,
            desc: 'Protect the star and close on exact-full snapshots.',
            style: 'points',
            color: '#c9884c',
            startingDeck: ['usher', 'rovingCritic', 'headliner', 'champagneHost', 'velvetBouncer', 'spotlightPhotographer', 'standIn', 'floorRunner'],
            market: ['headliner', 'champagneHost', 'velvetBouncer', 'spotlightPhotographer', 'usher', 'rovingCritic', 'partyPromoter'],
        },
        nightMarket: {
            name: 'Night Market',
            emoji: '🏮',
            gridSize: 4,
            bustThreshold: 5,
            desc: 'Queue sculpting, stash economy, and tag-majority builds.',
            style: 'money',
            color: '#7f5af0',
            startingDeck: ['galleryScout', 'trendBroker', 'curioDealer', 'stylist', 'standIn', 'bookkeeper', 'partyPromoter', 'usher'],
            market: ['galleryScout', 'trendBroker', 'curioDealer', 'stylist', 'standIn', 'bookkeeper', 'partyPromoter'],
        },
        backAlley: {
            name: 'Back Alley',
            emoji: '🕳️',
            gridSize: 6,
            bustThreshold: 7,
            desc: 'Intentional exits, outlaw cash-outs, and opponent heat pressure.',
            style: 'control',
            color: '#2cb67d',
            startingDeck: ['gateRunner', 'wheelman', 'fence', 'provocateur', 'floorRunner', 'usher', 'bookkeeper', 'partyPromoter'],
            market: ['gateRunner', 'wheelman', 'fence', 'provocateur', 'floorRunner', 'bookkeeper', 'standIn'],
        },
    };

    const GUEST_LISTS = {
        rescueMarkedStar: {
            name: 'Red Carpet Gala',
            venueId: 'velvetRoom',
            description: 'An elegant spotlight gala where marked VIPs must be protected until the final curtain call.',
            guests: ['rovingCritic', 'usher', 'headliner', 'velvetBouncer', 'champagneHost', 'spotlightPhotographer', 'standIn', 'partyPromoter'],
        },
        exactFullVelvetSnap: {
            name: 'Champagne Countdown',
            venueId: 'velvetRoom',
            description: 'A packed-house party that peaks at the perfect moment—close right as every seat is full.',
            guests: ['champagneHost', 'headliner', 'standIn', 'usher', 'spotlightPhotographer', 'velvetBouncer', 'rovingCritic', 'bookkeeper'],
        },
        protectStarSpendBouncer: {
            name: 'Headliner Afterparty',
            venueId: 'velvetRoom',
            description: 'Keep the star safe while the crew cycles through the lane to keep the party profitable.',
            guests: ['headliner', 'velvetBouncer', 'floorRunner', 'usher', 'spotlightPhotographer', 'champagneHost', 'rovingCritic', 'standIn'],
        },
        leftEdgeEconomy: {
            name: 'Bazaar Night',
            venueId: 'nightMarket',
            description: 'A curated market soirée where every close call gets turned into tomorrow\'s shopping leverage.',
            guests: ['curioDealer', 'galleryScout', 'bookkeeper', 'partyPromoter', 'trendBroker', 'stylist', 'standIn', 'floorRunner'],
        },
        brokerStack: {
            name: 'Trendsetter Mixer',
            venueId: 'nightMarket',
            description: 'A fashion-forward mixer focused on one social vibe and doubling down on the hottest tag.',
            guests: ['trendBroker', 'stylist', 'standIn', 'partyPromoter', 'bookkeeper', 'galleryScout', 'curioDealer', 'usher'],
        },
        cashOutHitAndRun: {
            name: 'Smuggler\'s Run',
            venueId: 'backAlley',
            description: 'A high-velocity outlaw party—cause chaos fast, cash out, and keep moving.',
            guests: ['gateRunner', 'wheelman', 'floorRunner', 'fence', 'provocateur', 'bookkeeper', 'usher', 'partyPromoter'],
        },
        fenceRegister: {
            name: 'Black Market Bash',
            venueId: 'backAlley',
            description: 'A gritty underground bash where one fixer stays inside while the rest rotate out for profit.',
            guests: ['fence', 'gateRunner', 'wheelman', 'floorRunner', 'provocateur', 'bookkeeper', 'standIn', 'usher'],
        },
        complaintTrap: {
            name: 'Riot Night',
            venueId: 'backAlley',
            description: 'A volatile street party built to overload rivals with trouble, complaints, and panic closes.',
            guests: ['gateRunner', 'provocateur', 'wheelman', 'fence', 'floorRunner', 'partyPromoter', 'standIn', 'bookkeeper'],
        },
    };

    const DECKS = {
        velvetClassic: {
            name: 'Velvet Standard',
            venueId: 'velvetRoom',
            description: 'Balanced VIP lineup with strong close potential.',
            guests: [...VENUES.velvetRoom.startingDeck],
        },
        marketCore: {
            name: 'Market Standard',
            venueId: 'nightMarket',
            description: 'Flexible economy core built for steady scaling.',
            guests: [...VENUES.nightMarket.startingDeck],
        },
        alleyPressure: {
            name: 'Alley Standard',
            venueId: 'backAlley',
            description: 'Control-heavy trouble package with strong tempo.',
            guests: [...VENUES.backAlley.startingDeck],
        },
    };

    // === Utilities ===
    function shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    // === Player Factory ===
    function createPlayer(name, venueId, isAI) {
        const venue = VENUES[venueId];
        return {
            name,
            venueId,
            isAI,
            fullDeck: [...venue.startingDeck],
            guestList: [...venue.startingDeck],
            roundDeck: [],
            house: [],
            arrivingGuest: null,
            roundMoney: 0,
            roundPoints: 0,
            money: 0,
            points: 0,
            heat: 0,
            doorClosed: false,
            busted: false,
            phaseComplete: false,
        };
    }

    // === Game State Factory ===
    function createGameState(playerName, playerVenue, rivalName, rivalVenue, totalRounds = DEFAULT_TOTAL_ROUNDS) {
        return {
            round: 1,
            totalRounds,
            phase: 'guest',
            player: createPlayer(playerName, playerVenue, false),
            rival: createPlayer(rivalName, rivalVenue, true),
            winner: null,
        };
    }

    // === Guest Phase ===
    function startGuestPhase(state) {
        state.phase = 'guest';
        const combinedGuestList = [
            ...(state.player.guestList || state.player.fullDeck),
            ...(state.rival.guestList || state.rival.fullDeck),
        ];

        [state.player, state.rival].forEach(p => {
            p.roundDeck = shuffle(combinedGuestList);
            p.house = [];
            p.arrivingGuest = null;
            p.roundMoney = 0;
            p.roundPoints = 0;
            p.heat = 0;
            p.doorClosed = false;
            p.busted = false;
            p.phaseComplete = false;
        });
        drawNextGuest(state.player, VENUES[state.player.venueId]);
        drawNextGuest(state.rival, VENUES[state.rival.venueId]);
    }

    function drawNextGuest(player, venue, skipBustCheck = false) {
        if (player.roundDeck.length === 0) {
            player.arrivingGuest = null;
            player.phaseComplete = true;
            player.doorClosed = true;
            return false;
        }
        player.arrivingGuest = player.roundDeck.pop();
        const guest = GUESTS[player.arrivingGuest];

        // Door slot is part of the party: arriving guest immediately contributes
        player.heat += guest.heat;
        player.roundMoney += guest.money;
        player.roundPoints += guest.points;

        // Any time heat is over capacity, player immediately busts.
        if (!skipBustCheck && venue && player.heat > venue.bustThreshold) {
            applyBustState(player);
        }
        return true;
    }

    function moveArrivingGuestIntoHouse(player, venue) {
        if (!player.arrivingGuest) return null;
        let pushedOut = null;
        player.house.unshift(player.arrivingGuest);
        if (player.house.length > venue.gridSize) {
            pushedOut = player.house.pop();
        }
        return pushedOut;
    }

    function applyBustState(player) {
        player.busted = true;
        player.phaseComplete = true;
        player.roundMoney = Math.floor(player.roundMoney * BUST_PENALTY);
        player.roundPoints = Math.floor(player.roundPoints * BUST_PENALTY);
    }

    function admitGuest(player, venue) {
        if (!player.arrivingGuest || player.doorClosed || player.busted) return null;

        const guestId = player.arrivingGuest;
        const result = { admitted: guestId, pushedOut: null, busted: false };

        // Guest is already contributing from the door; admit moves them into lane.
        result.pushedOut = moveArrivingGuestIntoHouse(player, venue);

        // Check bust
        if (player.heat > venue.bustThreshold) {
            result.busted = true;
            applyBustState(player);
        }

        player.arrivingGuest = null;
        if (!result.busted) {
            drawNextGuest(player, venue);
            if (player.busted) {
                result.busted = true;
            }
        }

        return result;
    }

    function activateAbility(player, opponent, playerVenue, opponentVenue) {
        if (!player.arrivingGuest || player.doorClosed || player.busted) return null;

        const guestId = player.arrivingGuest;
        const guest = GUESTS[guestId];
        if (!guest.ability) return null;

        const result = { activated: guestId, ability: guest.ability, effects: [] };

        // Activating consumes this guest instead of keeping them in party.
        player.heat -= guest.heat;
        player.roundMoney -= guest.money;
        player.roundPoints -= guest.points;

        const shouldDeferBustCheck = guest.ability.type === 'reduceHeat' || guest.ability.type === 'inspect';

        // Guest consumed without entering house
        player.arrivingGuest = null;
        drawNextGuest(player, playerVenue, shouldDeferBustCheck);

        switch (guest.ability.type) {
            case 'reduceHeat': {
                const reduced = Math.min(player.heat, guest.ability.value);
                player.heat -= reduced;
                result.effects.push(`-${reduced} heat`);
                break;
            }
            case 'bonusPoints': {
                player.roundPoints += guest.ability.value;
                result.effects.push(`+${guest.ability.value} bonus points`);
                break;
            }
            case 'addOpponentHeat': {
                opponent.heat += guest.ability.value;
                result.effects.push(`+${guest.ability.value} heat to opponent`);
                if (!opponent.doorClosed && !opponent.busted && opponent.heat > opponentVenue.bustThreshold) {
                    applyBustState(opponent);
                    result.effects.push('Opponent busted!');
                }
                break;
            }
            case 'inspect': {
                const selfReduced = Math.min(player.heat, guest.ability.selfReduce);
                player.heat -= selfReduced;
                opponent.heat += guest.ability.oppAdd;
                result.effects.push(`-${selfReduced} heat, +${guest.ability.oppAdd} to opponent`);
                if (!opponent.doorClosed && !opponent.busted && opponent.heat > opponentVenue.bustThreshold) {
                    applyBustState(opponent);
                    result.effects.push('Opponent busted!');
                }
                break;
            }
        }

        if (shouldDeferBustCheck && !player.doorClosed && !player.busted && player.heat > playerVenue.bustThreshold) {
            applyBustState(player);
            result.effects.push('You busted!');
        }

        return result;
    }

    function closeDoor(player, venue) {
        if (player.doorClosed || player.busted) return false;
        const pushedOut = moveArrivingGuestIntoHouse(player, venue);
        player.doorClosed = true;
        player.phaseComplete = true;
        player.arrivingGuest = null;
        return { closed: true, pushedOut };
    }

    function bothDone(state) {
        return state.player.phaseComplete && state.rival.phaseComplete;
    }

    function endGuestPhase(state) {
        [state.player, state.rival].forEach(p => {
            p.money += p.roundMoney;
            p.points += p.roundPoints;
        });
    }

    // === Buy Phase ===
    function getMarket(venueId) {
        const venue = VENUES[venueId];
        return shuffle([...venue.market]).slice(0, 5);
    }

    function buyGuest(player, guestId) {
        const guest = GUESTS[guestId];
        if (!guest || player.money < guest.cost) return false;
        player.money -= guest.cost;
        player.fullDeck.push(guestId);
        return true;
    }

    function endBuyPhase(state) {
        if (state.round >= state.totalRounds) {
            state.phase = 'gameover';
            if (state.player.points > state.rival.points) {
                state.winner = 'player';
            } else if (state.rival.points > state.player.points) {
                state.winner = 'rival';
            } else {
                // Tiebreaker: more money wins
                state.winner = state.player.money >= state.rival.money ? 'player' : 'rival';
            }
        } else {
            state.round++;
            state.phase = 'guest';
        }
    }

    return {
        GUESTS,
        VENUES,
        GUEST_LISTS,
        DECKS,
        TOTAL_ROUNDS: DEFAULT_TOTAL_ROUNDS,
        BUST_PENALTY,
        shuffle,
        createGameState,
        startGuestPhase,
        drawNextGuest,
        admitGuest,
        activateAbility,
        closeDoor,
        bothDone,
        endGuestPhase,
        getMarket,
        buyGuest,
        endBuyPhase,
    };
})();
