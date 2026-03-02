/* ============================================
   VENUE RIVALS - Core Game Engine
   ============================================ */

const Game = (() => {
    const DEFAULT_TOTAL_ROUNDS = 3;
    const BUST_PENALTY = 0.25;
    const TAGS = ['VIP', 'Performer', 'Scout', 'Broker', 'Outlaw'];

    let nextInstanceId = 1;

    const GUESTS = {
        standIn: { name: 'Stand-In', emoji: '🎭', heat: 2, money: 1, points: 2, cost: 3, venue: 'Neutral', tags: ['Performer'], desc: 'Enter: Choose a Tag. Resident: Counts as 2 of chosen Tag.', tier: 'common', enter: { type: 'chooseTag', target: 'self' }, resident: { type: 'doubleChosenTag' } },
        usher: { name: 'Usher', emoji: '🧤', heat: 1, money: 1, points: 2, cost: 3, venue: 'Neutral', tags: ['VIP'], desc: 'Enter: Pull another guest. Flash: Lock that guest.', tier: 'common', enter: { type: 'pullAnotherGuest' }, ability: { name: 'Flash', icon: '⚡', desc: 'Admit then lock the pulled guest', trigger: 'flash', type: 'pullThenLock' } },
        rovingCritic: { name: 'Roving Critic', emoji: '🧐', heat: 2, money: 0, points: 3, cost: 4, venue: 'Neutral', tags: ['VIP'], desc: 'Enter: Mark the Leftmost. Close: +2 if marked guest is still inside.', tier: 'uncommon', enter: { type: 'markLeftmost' }, close: { type: 'criticBonus' } },
        floorRunner: { name: 'Floor Runner', emoji: '🏃', heat: 2, money: 1, points: 1, cost: 3, venue: 'Neutral', tags: ['Scout'], desc: 'Flash: Push the Leftmost. Exit: +1 Point.', tier: 'common', ability: { name: 'Flash', icon: '⚡', desc: 'Admit then push leftmost', trigger: 'flash', type: 'pushLeftmost' }, exit: { points: 1 } },
        bookkeeper: { name: 'Bookkeeper', emoji: '📒', heat: 1, money: 2, points: 1, cost: 3, venue: 'Neutral', tags: ['Broker'], desc: 'Close: Stash your Rightmost. Close: +1 Money.', tier: 'common', close: { type: 'bookkeeperClose' } },
        partyPromoter: { name: 'Party Promoter', emoji: '📣', heat: 3, money: 2, points: 1, cost: 4, venue: 'Neutral', tags: ['Broker'], desc: 'Enter: Choose a Tag. Close: Chosen tag costs 1 less.', tier: 'uncommon', enter: { type: 'chooseTag', target: 'self' }, close: { type: 'promoterDiscount' } },
        regular: { name: 'Regular', emoji: '🙂', heat: 0, money: 0, points: 1, cost: 2, venue: 'Neutral', tags: ['VIP'], desc: 'Reliable VIP body that keeps your close points stable.', tier: 'common' },
        tipper: { name: 'Tipper', emoji: '💵', heat: 0, money: 1, points: 0, cost: 2, venue: 'Neutral', tags: ['Broker'], desc: 'Steady early cash to support round 1 buys.', tier: 'common' },
        hypeFriend: { name: 'Hype Friend', emoji: '🙌', heat: 1, money: 0, points: 2, cost: 3, venue: 'Neutral', tags: ['Performer'], desc: 'Low-risk performer that introduces heat pressure.', tier: 'common' },
        bigSpender: { name: 'Big Spender', emoji: '🛍️', heat: 2, money: 2, points: 0, cost: 4, venue: 'Neutral', tags: ['VIP'], desc: 'Big money now, but enough heat to force tough closes.', tier: 'uncommon' },
        celebrity: { name: 'Celebrity', emoji: '🎬', heat: 2, money: 0, points: 4, cost: 5, venue: 'Neutral', tags: ['VIP', 'Performer'], desc: 'Huge close points if you can time a safe close around the heat.', tier: 'rare' },

        headliner: { name: 'Headliner', emoji: '🌟', heat: 3, money: 1, points: 5, cost: 6, venue: 'Velvet Room', tags: ['VIP', 'Performer'], desc: 'Resident: Adjacent guests are Locked. Close: +3 if still inside.', tier: 'rare', resident: { type: 'lockAdjacent' }, close: { type: 'selfStillInside', points: 3 } },
        champagneHost: { name: 'Champagne Host', emoji: '🥂', heat: 2, money: 2, points: 3, cost: 5, venue: 'Velvet Room', tags: ['VIP'], desc: 'Enter: Pull a VIP or Performer. Close: +2 if Exact Full.', tier: 'uncommon', enter: { type: 'pullByTag', tags: ['VIP', 'Performer'] }, close: { type: 'exactFull', points: 2 } },
        velvetBouncer: { name: 'Velvet Bouncer', emoji: '🛡️', heat: 1, money: 1, points: 1, cost: 4, venue: 'Velvet Room', tags: ['VIP'], desc: 'Flash: Lock another guest. Exit: +2 Money.', tier: 'uncommon', ability: { name: 'Flash', icon: '⚡', desc: 'Admit then lock another guest', trigger: 'flash', type: 'lockAnother' }, exit: { money: 2 } },
        spotlightPhotographer: { name: 'Spotlight Photographer', emoji: '📸', heat: 2, money: 1, points: 4, cost: 5, venue: 'Velvet Room', tags: ['Performer'], desc: 'Enter: Mark another guest. Close: +1 per marked guest still inside.', tier: 'uncommon', enter: { type: 'markAnother' }, close: { type: 'photographerMarks' } },

        galleryScout: { name: 'Gallery Scout', emoji: '🔭', heat: 1, money: 2, points: 1, cost: 4, venue: 'Night Market', tags: ['Scout'], desc: 'Flash: Reveal 2. Queue 1, Stash 1.', tier: 'common', ability: { name: 'Flash', icon: '⚡', desc: 'Look at 2: keep 1, stash 1', trigger: 'flash', type: 'scoutQueue' } },
        trendBroker: { name: 'Trend Broker', emoji: '📈', heat: 2, money: 3, points: 1, cost: 5, venue: 'Night Market', tags: ['Broker'], desc: 'Enter: Choose a Tag. Close: +2 Money if chosen tag is Most Common.', tier: 'uncommon', enter: { type: 'chooseTag', target: 'self' }, close: { type: 'trendBroker' } },
        curioDealer: { name: 'Curio Dealer', emoji: '🗃️', heat: 1, money: 3, points: 0, cost: 4, venue: 'Night Market', tags: ['Broker'], desc: 'Enter: Stash the Leftmost. Close: +1 Money per Stashed guest.', tier: 'common', enter: { type: 'stashLeftmost' }, close: { type: 'moneyPerStash' } },
        stylist: { name: 'Stylist', emoji: '🧵', heat: 2, money: 1, points: 3, cost: 4, venue: 'Night Market', tags: ['Scout', 'Broker'], desc: 'Enter: Choose a Tag. Resident: Adjacent guests have chosen Tag.', tier: 'uncommon', enter: { type: 'chooseTag', target: 'self' }, resident: { type: 'grantAdjacentTag' } },

        gateRunner: { name: 'Gate Runner', emoji: '🚨', heat: 1, money: 1, points: 2, cost: 4, venue: 'Back Alley', tags: ['Outlaw'], desc: 'Enter: Opponent queues a Gatecrasher. Exit: +1 Point.', tier: 'common', enter: { type: 'queueGatecrasher' }, exit: { points: 1 } },
        wheelman: { name: 'Wheelman', emoji: '🚗', heat: 1, money: 3, points: 1, cost: 4, venue: 'Back Alley', tags: ['Outlaw'], desc: 'Flash: Push another guest. Exit: +2 Money.', tier: 'common', ability: { name: 'Flash', icon: '⚡', desc: 'Admit then push another guest', trigger: 'flash', type: 'pushAnother' }, exit: { money: 2 } },
        fence: { name: 'Fence', emoji: '🧰', heat: 1, money: 3, points: 0, cost: 4, venue: 'Back Alley', tags: ['Outlaw', 'Broker'], desc: 'Resident: +1 Money when another Outlaw exits. Exit: Stash this.', tier: 'common', resident: { type: 'outlawExitMoney' }, exit: { stashSelf: true } },
        provocateur: { name: 'Provocateur', emoji: '😈', heat: 1, money: 1, points: 3, cost: 5, venue: 'Back Alley', tags: ['Outlaw'], desc: 'Enter: If opponent above Safe Capacity, gain complaint. Close: +1 per opponent complaint.', tier: 'uncommon', enter: { type: 'complaintIfOpponentOver' }, close: { type: 'pointsPerOpponentComplaints' } },

        gatecrasher: { name: 'Gatecrasher', emoji: '💥', heat: 2, money: 0, points: 0, cost: 99, venue: 'Trouble', tags: ['Outlaw'], desc: 'A forced trouble guest.', tier: 'common' },
    };

    const VENUES = {
        velvetRoom: { name: 'Velvet Room', emoji: '🥂', gridSize: 5, bustThreshold: 6, desc: 'Protect the star and close on exact-full snapshots.', style: 'points', color: '#c9884c', startingDeck: ['usher','rovingCritic','headliner','champagneHost','velvetBouncer','spotlightPhotographer','standIn','floorRunner'], market: ['headliner','champagneHost','velvetBouncer','spotlightPhotographer','usher','rovingCritic','partyPromoter'] },
        nightMarket: { name: 'Night Market', emoji: '🏮', gridSize: 4, bustThreshold: 5, desc: 'Queue sculpting, stash economy, and tag-majority builds.', style: 'money', color: '#7f5af0', startingDeck: ['galleryScout','trendBroker','curioDealer','stylist','standIn','bookkeeper','partyPromoter','usher'], market: ['galleryScout','trendBroker','curioDealer','stylist','standIn','bookkeeper','partyPromoter'] },
        backAlley: { name: 'Back Alley', emoji: '🕳️', gridSize: 6, bustThreshold: 7, desc: 'Intentional exits, outlaw cash-outs, and opponent heat pressure.', style: 'control', color: '#2cb67d', startingDeck: ['gateRunner','wheelman','fence','provocateur','floorRunner','usher','bookkeeper','partyPromoter'], market: ['gateRunner','wheelman','fence','provocateur','floorRunner','bookkeeper','standIn'] },
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
        standardPlayerStatOnly: {
            name: 'Standard Player Deck (Stat-only)',
            venueId: 'velvetRoom',
            description: 'A 12-card fundamentals deck: safe points, early money, and manageable push-your-luck heat.',
            guests: ['regular', 'regular', 'regular', 'tipper', 'tipper', 'hypeFriend', 'hypeFriend', 'bigSpender', 'bigSpender', 'celebrity'],
        },
        velvetClassic: { name: 'Velvet Standard', venueId: 'velvetRoom', description: 'Balanced VIP lineup with strong close potential.', guests: [...VENUES.velvetRoom.startingDeck] },
        marketCore: { name: 'Market Standard', venueId: 'nightMarket', description: 'Flexible economy core built for steady scaling.', guests: [...VENUES.nightMarket.startingDeck] },
        alleyPressure: { name: 'Alley Standard', venueId: 'backAlley', description: 'Control-heavy trouble package with strong tempo.', guests: [...VENUES.backAlley.startingDeck] },
    };

    function shuffle(arr) { const a=[...arr]; for (let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
    function createHouseGuest(guestId){ return { instanceId: nextInstanceId++, guestId, chosenTag: null, marked: false, lockUntilClose: false }; }
    function getGuestId(entry){ return typeof entry === 'string' ? entry : entry.guestId; }

    function createPlayer(name, venueId, isAI) {
        const venue = VENUES[venueId];
        return { name, venueId, isAI, fullDeck:[...venue.startingDeck], guestList:[...venue.startingDeck], roundDeck:[], house:[], arrivingGuest:null, roundMoney:0, roundPoints:0, money:0, points:0, heat:0, doorClosed:false, busted:false, phaseComplete:false, stashCount:0, complaintTokens:0, buyDiscountTag:null };
    }
    function createGameState(playerName, playerVenue, rivalName, rivalVenue, totalRounds = DEFAULT_TOTAL_ROUNDS) {
        return { round:1, totalRounds, phase:'guest', player:createPlayer(playerName, playerVenue, false), rival:createPlayer(rivalName, rivalVenue, true), winner:null };
    }

    function startGuestPhase(state) {
        state.phase = 'guest';
        [state.player, state.rival].forEach((p) => {
            const equippedDeck = p.fullDeck?.length ? p.fullDeck : p.guestList;
            p.roundDeck = shuffle(equippedDeck || []);
            p.house = [];
            p.arrivingGuest = null;
            p.roundMoney = 0;
            p.roundPoints = 0;
            p.heat = 0;
            p.doorClosed = false;
            p.busted = false;
            p.phaseComplete = false;
            p.stashCount = 0;
            p.buyDiscountTag = null;
        });
        drawNextGuest(state.player, VENUES[state.player.venueId]);
        drawNextGuest(state.rival, VENUES[state.rival.venueId]);
    }

    function drawNextGuest(player, venue, skipBustCheck=false) {
        if (player.roundDeck.length===0){ player.arrivingGuest=null; player.phaseComplete=true; player.doorClosed=true; return false; }
        player.arrivingGuest = player.roundDeck.pop();
        const guest = GUESTS[player.arrivingGuest];
        player.heat += guest.heat; player.roundMoney += guest.money; player.roundPoints += guest.points;
        if (!skipBustCheck && venue && player.heat > venue.bustThreshold) applyBustState(player);
        return true;
    }

    function applyBustState(player){ player.busted=true; player.phaseComplete=true; player.roundMoney=Math.floor(player.roundMoney*BUST_PENALTY); player.roundPoints=Math.floor(player.roundPoints*BUST_PENALTY); }

    function getLockedIndexes(player) {
        const locked = new Set();
        player.house.forEach((entry, idx) => {
            if (entry.lockUntilClose) locked.add(idx);
            if (GUESTS[getGuestId(entry)].resident?.type === 'lockAdjacent') {
                if (idx > 0) locked.add(idx - 1);
                if (idx < player.house.length - 1) locked.add(idx + 1);
            }
        });
        return locked;
    }

    function moveArrivingGuestIntoHouse(player, venue) {
        if (!player.arrivingGuest) return null;
        let pushedOut = null;
        player.house.unshift(createHouseGuest(player.arrivingGuest));
        if (player.house.length > venue.gridSize) pushedOut = player.house.pop();
        return pushedOut;
    }

    function getEffectiveTagsForEntry(player, index) {
        const entry = player.house[index];
        if (!entry) return [];
        const tags = new Set(GUESTS[getGuestId(entry)].tags || []);
        if (entry.chosenTag) tags.add(entry.chosenTag);
        player.house.forEach((other, otherIdx) => {
            if (otherIdx === index) return;
            const resident = GUESTS[getGuestId(other)].resident;
            if (resident?.type === 'grantAdjacentTag' && other.chosenTag && Math.abs(otherIdx - index) === 1) tags.add(other.chosenTag);
        });
        return [...tags];
    }

    function chooseBestTag(player) {
        const counts = Object.fromEntries(TAGS.map(t => [t, 0]));
        player.house.forEach((_, idx) => getEffectiveTagsForEntry(player, idx).forEach(t => { counts[t] += 1; }));
        return TAGS.slice().sort((a,b)=>counts[b]-counts[a] || TAGS.indexOf(a)-TAGS.indexOf(b))[0];
    }

    function processExit(sourcePlayer, exitingEntry) {
        if (!exitingEntry) return;
        const guestId = getGuestId(exitingEntry);
        const guest = GUESTS[guestId];
        if (guest.exit?.money) sourcePlayer.roundMoney += guest.exit.money;
        if (guest.exit?.points) sourcePlayer.roundPoints += guest.exit.points;
        if (guest.exit?.stashSelf) sourcePlayer.stashCount += 1;

        if ((guest.tags || []).includes('Outlaw')) {
            sourcePlayer.house.forEach((entry) => {
                const g = GUESTS[getGuestId(entry)];
                if (g.resident?.type === 'outlawExitMoney' && getGuestId(entry) !== guestId) sourcePlayer.roundMoney += 1;
            });
        }
    }

    function pushLeftmost(player) {
        const idx = player.house.length - 1;
        const locked = getLockedIndexes(player);
        if (idx < 0 || locked.has(idx)) return null;
        const exiting = player.house.splice(idx, 1)[0];
        processExit(player, exiting);
        return exiting;
    }

    function pullGuestOneStep(player, predicate = () => true) {
        const locked = getLockedIndexes(player);
        for (let i = player.house.length - 1; i >= 1; i--) {
            if (locked.has(i) || locked.has(i - 1)) continue;
            if (!predicate(player.house[i])) continue;
            const [entry] = player.house.splice(i, 1);
            player.house.splice(i - 1, 0, entry);
            return i - 1;
        }
        return null;
    }

    function resolveEnterEffects(player, opponent, guestEntry, opponentVenue) {
        const guest = GUESTS[getGuestId(guestEntry)];
        const effect = guest.enter;
        const effects = [];
        if (!effect) return effects;
        switch (effect.type) {
            case 'chooseTag': guestEntry.chosenTag = chooseBestTag(player); effects.push(`chose ${guestEntry.chosenTag}`); break;
            case 'pullAnotherGuest': { const idx = pullGuestOneStep(player); if (idx !== null) effects.push('pulled a guest'); break; }
            case 'markLeftmost': if (player.house.length){ player.house[player.house.length-1].marked = true; effects.push('marked leftmost'); } break;
            case 'pullByTag': { const idx = pullGuestOneStep(player, (entry) => getEffectiveTagsForEntry(player, player.house.indexOf(entry)).some(t => effect.tags.includes(t))); if (idx !== null) effects.push('pulled VIP/Performer'); break; }
            case 'markAnother': if (player.house.length > 1) { player.house[1].marked = true; effects.push('marked another guest'); } break;
            case 'stashLeftmost': if (player.house.length) { const locked = getLockedIndexes(player); const i = player.house.length-1; if (!locked.has(i)) { player.house.splice(i,1); player.stashCount += 1; effects.push('stashed leftmost'); } } break;
            case 'queueGatecrasher': opponent.roundDeck.push('gatecrasher'); effects.push('queued gatecrasher'); break;
            case 'complaintIfOpponentOver': if (opponent.heat > opponentVenue.bustThreshold) { opponent.complaintTokens += 1; effects.push('opponent gained complaint'); } break;
        }
        return effects;
    }

    function admitGuest(player, venue, opponent = null, opponentVenue = null) {
        if (!player.arrivingGuest || player.doorClosed || player.busted) return null;
        const guestId = player.arrivingGuest;
        const result = { admitted: guestId, pushedOut: null, busted: false, effects: [] };
        const pushed = moveArrivingGuestIntoHouse(player, venue);
        if (pushed) { processExit(player, pushed); result.pushedOut = getGuestId(pushed); }
        result.effects.push(...resolveEnterEffects(player, opponent || player, player.house[0], opponentVenue || venue));
        if (player.heat > venue.bustThreshold) { result.busted = true; applyBustState(player); }
        player.arrivingGuest = null;
        if (!result.busted) { drawNextGuest(player, venue); if (player.busted) result.busted = true; }
        return result;
    }

    function activateAbility(player, opponent, playerVenue, opponentVenue) {
        if (!player.arrivingGuest || player.doorClosed || player.busted) return null;
        const guest = GUESTS[player.arrivingGuest];
        if (!guest.ability || guest.ability.trigger !== 'flash') return null;

        const admitted = admitGuest(player, playerVenue, opponent, opponentVenue);
        if (!admitted) return null;
        const result = { activated: guest.name, ability: guest.ability, effects: [...(admitted.effects || [])], pushedOut: admitted.pushedOut, busted: admitted.busted };
        const source = player.house[0];

        switch (guest.ability.type) {
            case 'pullThenLock': {
                const idx = pullGuestOneStep(player); if (idx !== null) { player.house[idx].lockUntilClose = true; result.effects.push('pulled and locked a guest'); }
                break;
            }
            case 'pushLeftmost': {
                const exiting = pushLeftmost(player); if (exiting) result.effects.push('pushed leftmost');
                break;
            }
            case 'lockAnother': {
                if (player.house.length > 1) { player.house[1].lockUntilClose = true; result.effects.push('locked another guest'); }
                break;
            }
            case 'scoutQueue': {
                const revealed = [];
                if (player.roundDeck.length) revealed.push(player.roundDeck.pop());
                if (player.roundDeck.length) revealed.push(player.roundDeck.pop());
                if (revealed.length) {
                    const keep = revealed[0];
                    const stash = revealed.slice(1);
                    player.roundDeck.push(keep);
                    player.stashCount += stash.length;
                    result.effects.push(`queued ${GUESTS[keep].name}, stashed ${stash.length}`);
                }
                break;
            }
            case 'pushAnother': {
                const locked = getLockedIndexes(player);
                let pushed = false;
                for (let i = player.house.length - 1; i >= 1; i--) {
                    if (locked.has(i)) continue;
                    const exiting = player.house.splice(i,1)[0];
                    processExit(player, exiting);
                    pushed = true;
                    break;
                }
                if (pushed) result.effects.push('pushed another guest');
                break;
            }
        }

        if (source && player.house[0] !== source) {
            // no-op; source moved due to effects is allowed
        }
        return result;
    }

    function applyCloseEffects(player, opponent, venue) {
        if (player.busted) return;
        player.house.forEach((entry, idx) => {
            const guest = GUESTS[getGuestId(entry)];
            const close = guest.close;
            if (!close) return;
            switch (close.type) {
                case 'criticBonus': if (player.house.some(g => g.marked)) player.roundPoints += 2; break;
                case 'bookkeeperClose': if (player.house.length) { player.house.shift(); player.stashCount += 1; } player.roundMoney += 1; break;
                case 'promoterDiscount': if (entry.chosenTag) player.buyDiscountTag = entry.chosenTag; break;
                case 'selfStillInside': player.roundPoints += close.points; break;
                case 'exactFull': if (player.house.length === venue.gridSize) player.roundPoints += close.points; break;
                case 'photographerMarks': player.roundPoints += player.house.filter(g => g.marked).length; break;
                case 'trendBroker': {
                    if (!entry.chosenTag) break;
                    const counts = Object.fromEntries(TAGS.map(t => [t, 0]));
                    player.house.forEach((h, hIdx) => {
                        const tags = new Set(getEffectiveTagsForEntry(player, hIdx));
                        if (GUESTS[getGuestId(h)].resident?.type === 'doubleChosenTag' && h.chosenTag) counts[h.chosenTag] += 1;
                        tags.forEach(t => counts[t] += 1);
                    });
                    const max = Math.max(...Object.values(counts));
                    if (counts[entry.chosenTag] === max && max > 0) player.roundMoney += 2;
                    break;
                }
                case 'moneyPerStash': player.roundMoney += player.stashCount; break;
                case 'pointsPerOpponentComplaints': player.roundPoints += opponent.complaintTokens; break;
            }
        });
    }

    function closeDoor(player, venue, opponent = null) {
        if (player.doorClosed || player.busted) return false;
        const pushed = moveArrivingGuestIntoHouse(player, venue);
        if (pushed) processExit(player, pushed);
        player.doorClosed = true; player.phaseComplete = true; player.arrivingGuest = null;
        return { closed: true, pushedOut: pushed ? getGuestId(pushed) : null };
    }

    function bothDone(state){ return state.player.phaseComplete && state.rival.phaseComplete; }
    function endGuestPhase(state){ applyCloseEffects(state.player, state.rival, VENUES[state.player.venueId]); applyCloseEffects(state.rival, state.player, VENUES[state.rival.venueId]); [state.player,state.rival].forEach(p=>{ p.money += p.roundMoney; p.points += p.roundPoints; }); }
    function getMarket(venueId){ return shuffle([...VENUES[venueId].market]).slice(0,5); }
    function buyGuest(player, guestId) { const guest=GUESTS[guestId]; if (!guest) return false; const hasTagDiscount = player.buyDiscountTag && (guest.tags||[]).includes(player.buyDiscountTag); const cost = Math.max(0, guest.cost - (hasTagDiscount ? 1 : 0)); if (player.money < cost) return false; player.money -= cost; player.fullDeck.push(guestId); return true; }
    function endBuyPhase(state){ if (state.round>=state.totalRounds){ state.phase='gameover'; state.winner=state.player.points===state.rival.points ? (state.player.money>=state.rival.money?'player':'rival') : (state.player.points>state.rival.points?'player':'rival'); } else { state.round++; state.phase='guest'; } }

    return { GUESTS, VENUES, GUEST_LISTS, DECKS, TAGS, TOTAL_ROUNDS: DEFAULT_TOTAL_ROUNDS, BUST_PENALTY, shuffle, createGameState, startGuestPhase, drawNextGuest, admitGuest, activateAbility, closeDoor, bothDone, endGuestPhase, getMarket, buyGuest, endBuyPhase };
})();
