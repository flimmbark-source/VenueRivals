/* ============================================
   VENUE RIVALS - Portrait 1v1 Venue Battler Engine
   Parallel guest phase + shared buy phase.
   ============================================ */

const Game = (() => {
    const TOTAL_ROUNDS = 3;

    const EFFECT_LIBRARY = {
        money: { icon: '💰', text: 'Gain extra money this round.' },
        points: { icon: '⭐', text: 'Gain extra points this round.' },
        reduceDanger: { icon: '🧯', text: 'Reduce your danger immediately.' },
        jam: { icon: '🚫', text: 'Increase rival danger and reduce their danger cap.' },
        push: { icon: '↗', text: 'Force pressure on the rival house.' },
        discount: { icon: '🪙', text: 'Your next buy this phase is cheaper.' },
    };

    const GUESTS = {
        regular: { id: 'regular', name: 'Regular', visual: '🙂', pressure: 2, money: 1, points: 1, activatable: null },
        spender: { id: 'spender', name: 'Big Spender', visual: '🕴️', pressure: 3, money: 3, points: 1, activatable: null },
        influencer: { id: 'influencer', name: 'Influencer', visual: '📸', pressure: 2, money: 1, points: 2, activatable: { id: 'points', amount: 2 } },
        troublemaker: { id: 'troublemaker', name: 'Troublemaker', visual: '😈', pressure: 3, money: 1, points: 1, activatable: { id: 'jam', danger: 2, capPenalty: 1 } },
        bouncer: { id: 'bouncer', name: 'Bouncer Ally', visual: '🧱', pressure: 1, money: 1, points: 1, activatable: { id: 'reduceDanger', amount: 3 } },
        promoter: { id: 'promoter', name: 'Promoter', visual: '📣', pressure: 2, money: 2, points: 1, activatable: { id: 'money', amount: 2 } },
        inspector: { id: 'inspector', name: 'Inspector', visual: '🧾', pressure: 2, money: 1, points: 2, activatable: { id: 'push', danger: 2 } },
        vip: { id: 'vip', name: 'VIP Crew', visual: '👑', pressure: 4, money: 2, points: 3, activatable: null },
    };

    const VENUES = {
        bar: {
            id: 'bar',
            name: 'Neighborhood Bar',
            houseSize: 5,
            dangerCap: 11,
            passive: 'Happy Hour: first buy each round costs 1 less.',
            active: 'Call Security: reduce danger by 2 (once each guest phase).',
            startingDeck: ['regular', 'regular', 'spender', 'promoter', 'bouncer', 'influencer'],
            marketPool: ['regular', 'spender', 'promoter', 'bouncer', 'influencer'],
        },
        club: {
            id: 'club',
            name: 'Neon Club',
            houseSize: 6,
            dangerCap: 13,
            passive: 'Spotlight: every 3rd admitted guest gains +1 point.',
            active: 'Pulse Drop: give rival +1 danger (once each guest phase).',
            startingDeck: ['regular', 'spender', 'vip', 'promoter', 'influencer', 'troublemaker'],
            marketPool: ['spender', 'vip', 'promoter', 'influencer', 'troublemaker'],
        },
        lounge: {
            id: 'lounge',
            name: 'Velvet Lounge',
            houseSize: 4,
            dangerCap: 10,
            passive: 'Controlled Flow: close with +1 bonus point if not busted.',
            active: 'Quiet Reset: remove top guest and reduce danger by 1 (once each guest phase).',
            startingDeck: ['regular', 'bouncer', 'inspector', 'influencer', 'spender', 'troublemaker'],
            marketPool: ['bouncer', 'inspector', 'influencer', 'troublemaker', 'vip'],
        },
    };

    const MARKET_COST = {
        regular: 3,
        spender: 5,
        influencer: 5,
        troublemaker: 5,
        bouncer: 4,
        promoter: 4,
        inspector: 5,
        vip: 7,
    };

    function randomId(prefix) {
        return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
    }

    function makeGuest(id) {
        const base = GUESTS[id];
        return { ...base, instanceId: randomId(id), usedAbility: false };
    }

    function shuffle(arr) {
        const out = [...arr];
        for (let i = out.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [out[i], out[j]] = [out[j], out[i]];
        }
        return out;
    }

    function createVenueState(profileName, venueType, isRival = false) {
        const venue = VENUES[venueType] || VENUES.bar;
        const rivalName = ['Neon Pulse', 'Velvet Edge', 'Crimson Room', 'Echo Syndicate'][Math.floor(Math.random() * 4)];

        return {
            profile: {
                playerName: profileName,
                venueType,
                venueName: venue.name,
                passive: venue.passive,
                active: venue.active,
            },
            name: isRival ? rivalName : profileName,
            venue,
            totalPoints: 0,
            totalMoneySpent: 0,
            deck: shuffle(venue.startingDeck.map(makeGuest)),
            discard: [],
            roundMoney: 0,
            roundPoints: 0,
            lane: [],
            exitingGuest: null,
            admittedCount: 0,
            danger: 0,
            dangerCap: venue.dangerCap,
            closed: false,
            busted: false,
            doorGuest: null,
            phaseDone: false,
            buyDiscount: 0,
            usedVenueActive: false,
        };
    }

    function drawGuest(venueState) {
        if (!venueState.deck.length) {
            if (!venueState.discard.length) {
                venueState.deck = shuffle(venueState.venue.startingDeck.map(makeGuest));
            } else {
                venueState.deck = shuffle(venueState.discard);
                venueState.discard = [];
            }
        }
        return venueState.deck.pop() || null;
    }

    function dealDoorGuest(venueState) {
        if (venueState.closed || venueState.busted || venueState.phaseDone) return;
        if (!venueState.doorGuest) {
            venueState.doorGuest = drawGuest(venueState);
        }
    }

    function createGameState(playerName, venueType) {
        const player = createVenueState(playerName, venueType, false);
        const rivalVenueType = ['bar', 'club', 'lounge'][Math.floor(Math.random() * 3)];
        const rival = createVenueState('Rival', rivalVenueType, true);

        const state = {
            round: 1,
            phase: 'guest',
            phaseLabel: 'Guest Phase',
            player,
            rival,
            log: [],
            winner: null,
            market: {
                player: [],
                rival: [],
            },
        };

        dealDoorGuest(player);
        dealDoorGuest(rival);
        buildMarket(state);
        return state;
    }

    function getRoundSnapshot(state, who) {
        const v = who === 'player' ? state.player : state.rival;
        return {
            money: v.roundMoney,
            points: v.roundPoints,
            closed: v.closed,
            busted: v.busted,
            danger: v.danger,
            cap: v.dangerCap,
        };
    }

    function checkBust(venueState) {
        if (venueState.danger > venueState.dangerCap) {
            venueState.busted = true;
            venueState.closed = true;
            venueState.phaseDone = true;
            venueState.roundMoney = Math.floor(venueState.roundMoney * 0.2);
            venueState.roundPoints = 0;
            return true;
        }
        return false;
    }

    function applyVenuePassiveOnAdmit(venueState, guest) {
        if (venueState.venue.id === 'club' && venueState.admittedCount % 3 === 0) {
            venueState.roundPoints += 1;
            return `${venueState.name} passive Spotlight triggered (+1 point).`;
        }
        if (venueState.venue.id === 'bar' && guest.id === 'spender') {
            venueState.roundMoney += 1;
            return `${venueState.name} Bar crowd spent extra (+1 money).`;
        }
        return null;
    }

    function admitGuest(state, actor) {
        const source = actor === 'player' ? state.player : state.rival;
        if (source.closed || source.busted || !source.doorGuest) return [];

        const guest = source.doorGuest;
        source.doorGuest = null;
        source.roundMoney += guest.money;
        source.roundPoints += guest.points;
        source.danger += guest.pressure;
        source.admittedCount += 1;

        source.lane.unshift(guest);
        if (source.lane.length > source.venue.houseSize) {
            source.exitingGuest = source.lane.pop();
            source.discard.push(source.exitingGuest);
        }

        const msgs = [`${source.name} admitted ${guest.name} (+${guest.money} money, +${guest.points} points, +${guest.pressure} danger).`];
        const passiveMsg = applyVenuePassiveOnAdmit(source, guest);
        if (passiveMsg) msgs.push(passiveMsg);

        if (checkBust(source)) msgs.push(`${source.name} busted! Round points are lost.`);

        dealDoorGuest(source);
        return msgs;
    }

    function activateGuest(state, actor) {
        const source = actor === 'player' ? state.player : state.rival;
        const target = actor === 'player' ? state.rival : state.player;
        const guest = source.doorGuest;

        if (!guest || !guest.activatable || source.closed || source.busted) return [`${source.name} has no activatable door guest.`];

        const ability = guest.activatable;
        let msg = `${source.name} activated ${guest.name}.`;

        if (ability.id === 'points') {
            source.roundPoints += ability.amount;
            msg += ` +${ability.amount} points.`;
        } else if (ability.id === 'money') {
            source.roundMoney += ability.amount;
            msg += ` +${ability.amount} money.`;
        } else if (ability.id === 'reduceDanger') {
            source.danger = Math.max(0, source.danger - ability.amount);
            msg += ` Danger -${ability.amount}.`;
        } else if (ability.id === 'jam') {
            target.danger += ability.danger;
            target.dangerCap = Math.max(6, target.dangerCap - ability.capPenalty);
            msg += ` ${target.name} gets +${ability.danger} danger and -${ability.capPenalty} cap.`;
        } else if (ability.id === 'push') {
            target.danger += ability.danger;
            msg += ` ${target.name} gets +${ability.danger} danger.`;
        }

        source.doorGuest = null;
        source.discard.push({ ...guest, usedAbility: true });

        const msgs = [msg];
        if (checkBust(source)) msgs.push(`${source.name} busted after activating!`);
        if (checkBust(target)) msgs.push(`${target.name} busted from disruption!`);

        dealDoorGuest(source);
        return msgs;
    }

    function closeDoor(state, actor) {
        const source = actor === 'player' ? state.player : state.rival;
        if (source.closed) return [`${source.name} already closed.`];

        source.closed = true;
        source.phaseDone = true;
        source.doorGuest = null;

        if (source.venue.id === 'lounge' && !source.busted) {
            source.roundPoints += 1;
        }

        return [`${source.name} closed the door and locked round value.`];
    }

    function activateVenueActive(state, actor) {
        const source = actor === 'player' ? state.player : state.rival;
        const target = actor === 'player' ? state.rival : state.player;

        if (source.usedVenueActive || source.closed || source.busted) return [`${source.name} cannot use venue active now.`];
        source.usedVenueActive = true;

        if (source.venue.id === 'bar') {
            source.danger = Math.max(0, source.danger - 2);
            return [`${source.name} used Call Security (danger -2).`];
        }
        if (source.venue.id === 'club') {
            target.danger += 1;
            const msgs = [`${source.name} used Pulse Drop (${target.name} +1 danger).`];
            if (checkBust(target)) msgs.push(`${target.name} busted from Pulse Drop!`);
            return msgs;
        }
        if (source.venue.id === 'lounge') {
            if (source.lane.length) {
                const removed = source.lane.shift();
                source.discard.push(removed);
                source.danger = Math.max(0, source.danger - 1);
                return [`${source.name} used Quiet Reset, removed ${removed.name} and reduced danger.`];
            }
            return [`${source.name} tried Quiet Reset but had no guest inside.`];
        }
        return [`${source.name} has no active ability.`];
    }

    function executeAction(state, actor, actionId) {
        if (state.phase !== 'guest') return [];
        let msgs = [];
        if (actionId === 'admit') msgs = admitGuest(state, actor);
        if (actionId === 'activate') msgs = activateGuest(state, actor);
        if (actionId === 'close') msgs = closeDoor(state, actor);
        if (actionId === 'venue-active') msgs = activateVenueActive(state, actor);

        if (state.player.phaseDone && state.rival.phaseDone) {
            enterBuyPhase(state);
            msgs.push('Guest phase ended. Entering buy phase.');
        }
        return msgs;
    }

    function buildMarket(state) {
        const mk = (venue) => shuffle(venue.marketPool).slice(0, 4).map(id => ({ guestId: id, cost: MARKET_COST[id] }));
        state.market.player = mk(state.player.venue);
        state.market.rival = mk(state.rival.venue);
    }

    function enterBuyPhase(state) {
        state.phase = 'buy';
        state.phaseLabel = 'Buy Phase';
        state.player.buyDiscount = state.player.venue.id === 'bar' ? 1 : 0;
        state.rival.buyDiscount = state.rival.venue.id === 'bar' ? 1 : 0;
        buildMarket(state);
    }

    function buyGuest(state, actor, guestId) {
        if (state.phase !== 'buy') return { ok: false, message: 'Not in buy phase.' };
        const source = actor === 'player' ? state.player : state.rival;
        const marketList = actor === 'player' ? state.market.player : state.market.rival;
        const offer = marketList.find(o => o.guestId === guestId);
        if (!offer) return { ok: false, message: 'Guest unavailable.' };

        const finalCost = Math.max(1, offer.cost - source.buyDiscount);
        if (source.roundMoney < finalCost) return { ok: false, message: 'Not enough money.' };

        source.roundMoney -= finalCost;
        source.totalMoneySpent += finalCost;
        source.discard.push(makeGuest(guestId));
        source.buyDiscount = 0;

        return { ok: true, message: `${source.name} bought ${GUESTS[guestId].name} for ${finalCost}.` };
    }

    function finalizeBuyPhase(state) {
        if (state.phase !== 'buy') return;

        state.player.totalPoints += state.player.roundPoints;
        state.rival.totalPoints += state.rival.roundPoints;

        if (state.round >= TOTAL_ROUNDS) {
            state.phase = 'gameover';
            state.phaseLabel = 'Match Complete';
            state.winner = state.player.totalPoints >= state.rival.totalPoints ? 'player' : 'rival';
            return;
        }

        state.round += 1;
        state.phase = 'guest';
        state.phaseLabel = 'Guest Phase';
        resetForNewRound(state.player);
        resetForNewRound(state.rival);
        dealDoorGuest(state.player);
        dealDoorGuest(state.rival);
    }

    function resetForNewRound(venueState) {
        venueState.roundMoney = 0;
        venueState.roundPoints = 0;
        venueState.lane = [];
        venueState.exitingGuest = null;
        venueState.admittedCount = 0;
        venueState.danger = 0;
        venueState.dangerCap = venueState.venue.dangerCap;
        venueState.closed = false;
        venueState.busted = false;
        venueState.doorGuest = null;
        venueState.phaseDone = false;
        venueState.buyDiscount = 0;
        venueState.usedVenueActive = false;
    }

    function getActions(state, actor) {
        const source = actor === 'player' ? state.player : state.rival;
        if (state.phase !== 'guest' || source.phaseDone) return [];

        return [
            { id: 'admit', name: 'Admit →', enabled: !!source.doorGuest },
            { id: 'activate', name: 'Activate Guest', enabled: !!(source.doorGuest && source.doorGuest.activatable) },
            { id: 'venue-active', name: 'Use Venue Active', enabled: !source.usedVenueActive },
            { id: 'close', name: 'Close Door', enabled: true },
        ];
    }

    function getGuestData() {
        return GUESTS;
    }

    function getEffectLibrary() {
        return EFFECT_LIBRARY;
    }

    return {
        TOTAL_ROUNDS,
        VENUES,
        createGameState,
        executeAction,
        getActions,
        getRoundSnapshot,
        getGuestData,
        getEffectLibrary,
        buyGuest,
        finalizeBuyPhase,
    };
})();
