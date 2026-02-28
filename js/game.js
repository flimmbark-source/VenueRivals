/* ============================================
   VENUE RIVALS - Parallel Push-Your-Luck Engine
   Shared live rounds, close door or bust,
   real-time disruption between both players.
   ============================================ */

const Game = (() => {
    const TOTAL_ROUNDS = 3;
    const STARTING_LIMIT = 21;
    const STARTING_HAND_SIZE = 18;

    const GUEST_POOL = [
        { name: 'Regular', pressure: 2, ability: 'none' },
        { name: 'Big Spender', pressure: 4, ability: 'none' },
        { name: 'Influencer', pressure: 3, ability: 'boost' },
        { name: 'Troublemaker', pressure: 3, ability: 'jam' },
        { name: 'VIP Entourage', pressure: 5, ability: 'crowd' },
        { name: 'Security Ally', pressure: 2, ability: 'stabilize' },
    ];

    function makeDeck() {
        const deck = [];
        for (let i = 0; i < STARTING_HAND_SIZE; i++) {
            const card = GUEST_POOL[Math.floor(Math.random() * GUEST_POOL.length)];
            deck.push({ ...card, id: `${card.name}-${i}-${Math.random().toString(36).slice(2, 7)}` });
        }
        return deck;
    }

    function createVenue(name, type) {
        return {
            name,
            type,
            totalScore: 0,
            roundsWon: 0,
            upgrades: [],
            deck: makeDeck(),
            drawIndex: 0,
            current: {
                occupancy: 0,
                limit: STARTING_LIMIT,
                closed: false,
                busted: false,
                admitted: [],
                pendingAbilities: [],
                doorGuest: null,
                banked: 0,
            },
        };
    }

    function createGameState(playerName, playerType) {
        const rivalNames = ['Neon Pulse', 'Velvet Edge', 'The Crimson Fox', 'Shadow & Tonic'];
        const state = {
            round: 1,
            phase: 'live',
            player: createVenue(playerName, playerType),
            rival: createVenue(rivalNames[Math.floor(Math.random() * rivalNames.length)], 'rival'),
            lastRoundPlayerCustomers: 0,
            lastRoundRivalCustomers: 0,
            log: [],
            winner: null,
            lastActionFrame: 0,
        };

        dealDoorGuest(state.player);
        dealDoorGuest(state.rival);
        return state;
    }

    function drawGuest(venue) {
        if (venue.drawIndex >= venue.deck.length) {
            venue.deck = venue.deck.concat(makeDeck());
        }
        const guest = venue.deck[venue.drawIndex];
        venue.drawIndex += 1;
        return { ...guest };
    }


    function dealDoorGuest(venue) {
        if (venue.current.closed || venue.current.busted) return null;
        venue.current.doorGuest = drawGuest(venue);
        return venue.current.doorGuest;
    }

    function maybeBust(venue) {
        if (venue.current.occupancy > venue.current.limit) {
            venue.current.busted = true;
            venue.current.closed = true;
            venue.current.banked = 0;
            return true;
        }
        return false;
    }

    function admitGuest(venue) {
        if (venue.current.closed) return null;
        const guest = venue.current.doorGuest || dealDoorGuest(venue);
        if (!guest) return null;

        venue.current.admitted.push(guest);
        venue.current.occupancy += guest.pressure;
        venue.current.doorGuest = null;

        if (guest.ability !== 'none') {
            venue.current.pendingAbilities.push(guest);
        }

        maybeBust(venue);
        if (!venue.current.closed) {
            dealDoorGuest(venue);
        }

        return guest;
    }

    function applyAbility(source, target, guest) {
        if (!guest) return null;
        if (source.current.closed && source.current.busted) return null;

        let text = '';
        if (guest.ability === 'boost') {
            source.current.occupancy = Math.max(0, source.current.occupancy - 2);
            text = `${source.name} used Influencer to smooth flow (-2 pressure).`;
        } else if (guest.ability === 'jam') {
            target.current.limit = Math.max(10, target.current.limit - 1);
            text = `${source.name} sent a Troublemaker. ${target.name}'s limit -1.`;
        } else if (guest.ability === 'crowd') {
            target.current.occupancy += 2;
            text = `${source.name}'s entourage spills over. ${target.name} +2 pressure.`;
        } else if (guest.ability === 'stabilize') {
            source.current.limit += 1;
            text = `${source.name} added extra security. Limit +1.`;
        }

        maybeBust(source);
        maybeBust(target);
        return text;
    }

    function closeDoor(venue) {
        venue.current.closed = true;
        venue.current.doorGuest = null;
        if (!venue.current.busted) {
            venue.current.banked = venue.current.occupancy;
        }
    }

    function executeAction(state, actor, actionId) {
        const source = actor === 'player' ? state.player : state.rival;
        const target = actor === 'player' ? state.rival : state.player;
        const msgs = [];

        if (source.current.closed) return msgs;

        if (actionId === 'admit') {
            const guest = admitGuest(source);
            if (guest) msgs.push(`${source.name} admitted ${guest.name} (+${guest.pressure} pressure).`);
        } else if (actionId === 'ability') {
            const guest = source.current.pendingAbilities.shift();
            if (!guest) {
                msgs.push(`${source.name} had no guest ability ready.`);
            } else {
                const result = applyAbility(source, target, guest);
                if (result) msgs.push(result);
            }
        } else if (actionId === 'close') {
            closeDoor(source);
            msgs.push(`${source.name} closed the door and locked the round.`);
        }

        if (source.current.busted) msgs.push(`${source.name} busted and loses this round.`);
        if (target.current.busted) msgs.push(`${target.name} busted under pressure.`);

        if (state.player.current.closed && state.rival.current.closed) {
            resolveRound(state, msgs);
        }

        return msgs;
    }

    function resolveRound(state, msgs) {
        const pRound = state.player.current.busted ? 0 : state.player.current.banked;
        const rRound = state.rival.current.busted ? 0 : state.rival.current.banked;

        state.player.totalScore += pRound;
        state.rival.totalScore += rRound;
        state.lastRoundPlayerCustomers = pRound;
        state.lastRoundRivalCustomers = rRound;

        if (pRound > rRound) state.player.roundsWon += 1;
        if (rRound > pRound) state.rival.roundsWon += 1;

        msgs.push(`Round ${state.round} result: You ${pRound} - Rival ${rRound}.`);

        if (state.round >= TOTAL_ROUNDS) {
            state.phase = 'gameover';
            state.winner = state.player.totalScore >= state.rival.totalScore ? 'player' : 'rival';
            return;
        }

        state.round += 1;
        resetRoundState(state.player);
        resetRoundState(state.rival);
        dealDoorGuest(state.player);
        dealDoorGuest(state.rival);
    }

    function resetRoundState(venue) {
        venue.current = {
            occupancy: 0,
            limit: STARTING_LIMIT,
            closed: false,
            busted: false,
            admitted: [],
            pendingAbilities: [],
            doorGuest: null,
            banked: 0,
        };
    }

    function getAvailableActions(state) {
        const c = state.player.current;
        if (state.phase === 'gameover' || c.closed) return [];

        return [
            {
                id: 'admit',
                name: 'Admit Guest',
                icon: '🚪',
                description: c.doorGuest ? `Let in ${c.doorGuest.name} (+${c.doorGuest.pressure})` : 'Draw from your deck and add pressure.',
                enabled: true,
            },
            { id: 'ability', name: 'Activate Ability', icon: '⚡', description: 'Use one admitted guest effect.', enabled: c.pendingAbilities.length > 0 },
            { id: 'close', name: 'Close Door', icon: '🔒', description: 'Bank this round safely.', enabled: true },
        ];
    }

    function getCustomerPool(state) {
        return Math.max(0, state.player.current.limit - state.player.current.occupancy);
    }

    return {
        createGameState,
        executeAction,
        getAvailableActions,
        getCustomerPool,
        TOTAL_ROUNDS,
    };
})();
