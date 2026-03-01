/* ============================================
   VENUE RIVALS - Core Game Engine
   Push-your-luck 1v1 competitive venue battler
   Guests, venues, deck management, phases
   ============================================ */

const Game = (() => {

    const TOTAL_ROUNDS = 3;
    const BUST_PENALTY = 0.25; // keep 25% of earnings when busted

    // === Guest Definitions ===
    const GUESTS = {
        // Common tier
        regular:     { name: 'Regular',     emoji: '\u{1F60A}', heat: 2, money: 1, points: 1, cost: 2, desc: 'A reliable patron',     tier: 'common' },
        tipper:      { name: 'Tipper',      emoji: '\u{1F4B5}', heat: 3, money: 3, points: 0, cost: 3, desc: 'Generous with cash',    tier: 'common' },
        fan:         { name: 'Fan',         emoji: '\u{1F929}', heat: 3, money: 0, points: 3, cost: 3, desc: 'Loves the vibe',        tier: 'common' },
        wallflower:  { name: 'Wallflower',  emoji: '\u{1F338}', heat: 1, money: 1, points: 1, cost: 2, desc: 'Quiet but pleasant',    tier: 'common' },

        // Uncommon tier
        vip:         { name: 'VIP',         emoji: '\u{1F451}', heat: 4, money: 2, points: 4, cost: 5, desc: 'High-value guest',      tier: 'uncommon' },
        performer:   { name: 'Performer',   emoji: '\u{1F3A4}', heat: 3, money: 1, points: 5, cost: 5, desc: 'Draws a crowd',        tier: 'uncommon' },
        promoter:    { name: 'Promoter',    emoji: '\u{1F4E2}', heat: 5, money: 5, points: 1, cost: 5, desc: 'Brings business',      tier: 'uncommon' },
        bouncer:     { name: 'Bouncer',     emoji: '\u{1F6E1}', heat: 0, money: 0, points: 0, cost: 4, desc: 'Keeps things calm',    tier: 'uncommon',
                       ability: { name: 'Cool Down', desc: 'Remove 3 heat', icon: '\u2744', type: 'reduceHeat', value: 3 } },
        hustler:     { name: 'Hustler',     emoji: '\u{1F3B2}', heat: 4, money: 4, points: 0, cost: 4, desc: 'Always working angles', tier: 'uncommon' },
        socialite:   { name: 'Socialite',   emoji: '\u{1F483}', heat: 2, money: 2, points: 3, cost: 4, desc: 'Knows everyone',       tier: 'uncommon' },
        hypeman:     { name: 'Hype Man',    emoji: '\u{1F4E3}', heat: 3, money: 0, points: 2, cost: 4, desc: 'Gets the crowd going', tier: 'uncommon',
                       ability: { name: 'Hype Up', desc: '+2 bonus points', icon: '\u2B50', type: 'bonusPoints', value: 2 } },
        concierge:   { name: 'Concierge',   emoji: '\u{1F3A9}', heat: 0, money: 1, points: 1, cost: 4, desc: 'Keeps order',         tier: 'uncommon',
                       ability: { name: 'Manage', desc: 'Remove 2 heat', icon: '\u2744', type: 'reduceHeat', value: 2 } },

        // Rare tier
        celebrity:   { name: 'Celebrity',   emoji: '\u{1F31F}', heat: 6, money: 3, points: 8, cost: 8, desc: 'The biggest name',         tier: 'rare' },
        influencer:  { name: 'Influencer',  emoji: '\u{1F4F1}', heat: 4, money: 4, points: 4, cost: 7, desc: 'Trending tonight',         tier: 'rare' },
        instigator:  { name: 'Instigator',  emoji: '\u{1F608}', heat: 2, money: 2, points: 2, cost: 6, desc: 'Causes trouble elsewhere', tier: 'rare',
                       ability: { name: 'Provoke', desc: '+4 heat to opponent', icon: '\u{1F525}', type: 'addOpponentHeat', value: 4 } },
        inspector:   { name: 'Inspector',   emoji: '\u{1F50D}', heat: 0, money: 0, points: 0, cost: 6, desc: 'Official business',        tier: 'rare',
                       ability: { name: 'Inspect', desc: '-5 your heat, +3 opponent', icon: '\u{1F4CB}', type: 'inspect', selfReduce: 5, oppAdd: 3 } },
        dj:          { name: 'DJ',          emoji: '\u{1F3A7}', heat: 3, money: 2, points: 6, cost: 7, desc: 'Drops the beat',           tier: 'rare' },
        investor:    { name: 'Investor',    emoji: '\u{1F48E}', heat: 5, money: 7, points: 0, cost: 7, desc: 'Deep pockets',             tier: 'rare' },
    };

    // === Venue Definitions ===
    const VENUES = {
        underground: {
            name: 'The Underground',
            emoji: '\u{1F37A}',
            gridSize: 5,
            bustThreshold: 6,
            desc: 'Gritty bar. Larger grid, money-focused.',
            style: 'money',
            color: '#c9884c',
            startingDeck: ['regular','regular','regular','tipper','tipper','hustler','bouncer','promoter'],
            market: ['tipper','hustler','promoter','bouncer','investor','instigator','regular'],
        },
        spotlight: {
            name: 'The Spotlight',
            emoji: '\u{1F3AD}',
            gridSize: 4,
            bustThreshold: 5,
            desc: 'Flashy club. Smaller grid, points-focused.',
            style: 'points',
            color: '#7f5af0',
            startingDeck: ['regular','regular','regular','fan','fan','performer','hypeman','tipper'],
            market: ['fan','performer','hypeman','vip','dj','celebrity','regular'],
        },
        velvet: {
            name: 'The Velvet Room',
            emoji: '\u{1F378}',
            gridSize: 6,
            bustThreshold: 7,
            desc: 'Upscale lounge. Biggest grid, control-focused.',
            style: 'control',
            color: '#2cb67d',
            startingDeck: ['regular','regular','regular','wallflower','wallflower','socialite','concierge','vip'],
            market: ['wallflower','socialite','concierge','vip','influencer','inspector','regular'],
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
    function createGameState(playerName, playerVenue, rivalName, rivalVenue) {
        return {
            round: 1,
            phase: 'guest',
            player: createPlayer(playerName, playerVenue, false),
            rival: createPlayer(rivalName, rivalVenue, true),
            winner: null,
        };
    }

    // === Guest Phase ===
    function startGuestPhase(state) {
        state.phase = 'guest';
        [state.player, state.rival].forEach(p => {
            p.roundDeck = shuffle(p.fullDeck);
            p.house = [];
            p.arrivingGuest = null;
            p.roundMoney = 0;
            p.roundPoints = 0;
            p.heat = 0;
            p.doorClosed = false;
            p.busted = false;
            p.phaseComplete = false;
        });
        drawNextGuest(state.player);
        drawNextGuest(state.rival);
    }

    function drawNextGuest(player) {
        if (player.roundDeck.length === 0) {
            player.arrivingGuest = null;
            player.phaseComplete = true;
            player.doorClosed = true;
            return false;
        }
        player.arrivingGuest = player.roundDeck.pop();
        return true;
    }

    function admitGuest(player, venue) {
        if (!player.arrivingGuest || player.doorClosed || player.busted) return null;

        const guestId = player.arrivingGuest;
        const guest = GUESTS[guestId];
        const result = { admitted: guestId, pushedOut: null, busted: false };

        // Add to front of house (newest first)
        player.house.unshift(guestId);

        // Push-out if over capacity
        if (player.house.length > venue.gridSize) {
            result.pushedOut = player.house.pop();
        }

        // Apply effects
        player.heat += guest.heat;
        player.roundMoney += guest.money;
        player.roundPoints += guest.points;

        // Check bust
        if (player.heat > venue.bustThreshold) {
            result.busted = true;
            player.busted = true;
            player.phaseComplete = true;
            player.roundMoney = Math.floor(player.roundMoney * BUST_PENALTY);
            player.roundPoints = Math.floor(player.roundPoints * BUST_PENALTY);
        }

        player.arrivingGuest = null;
        if (!result.busted) {
            drawNextGuest(player);
        }

        return result;
    }

    function activateAbility(player, opponent, playerVenue, opponentVenue) {
        if (!player.arrivingGuest || player.doorClosed || player.busted) return null;

        const guestId = player.arrivingGuest;
        const guest = GUESTS[guestId];
        if (!guest.ability) return null;

        const result = { activated: guestId, ability: guest.ability, effects: [] };

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
                    opponent.busted = true;
                    opponent.phaseComplete = true;
                    opponent.roundMoney = Math.floor(opponent.roundMoney * BUST_PENALTY);
                    opponent.roundPoints = Math.floor(opponent.roundPoints * BUST_PENALTY);
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
                    opponent.busted = true;
                    opponent.phaseComplete = true;
                    opponent.roundMoney = Math.floor(opponent.roundMoney * BUST_PENALTY);
                    opponent.roundPoints = Math.floor(opponent.roundPoints * BUST_PENALTY);
                    result.effects.push('Opponent busted!');
                }
                break;
            }
        }

        // Guest consumed without entering house
        player.arrivingGuest = null;
        drawNextGuest(player);
        return result;
    }

    function closeDoor(player) {
        if (player.doorClosed || player.busted) return false;
        player.doorClosed = true;
        player.phaseComplete = true;
        player.arrivingGuest = null;
        return true;
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
        if (state.round >= TOTAL_ROUNDS) {
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
        TOTAL_ROUNDS,
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
