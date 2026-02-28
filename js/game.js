/* ============================================
   VENUE RIVALS - Simultaneous Real-Time Prototype Engine
   Tune content values in HOUSES / GUESTS / PASSIVES / ACTIVES / PROFILES.
   ============================================ */

const Game = (() => {
    const ROUND_DURATION_S = 90;
    const SHOP_DURATION_S = 18;
    const TOTAL_ROUNDS = 3;
    const BOARD_SLOTS = 8;
    const OFFER_SIZE = 3;
    const CAPACITY_REGEN_INTERVAL_S = 2;
    const SCORE_PULSE_INTERVAL_S = 1;

    const HOUSES = {
        packed_loft: { id: 'packed_loft', name: 'Packed Loft', maxOccupancy: 6, regenMod: 0.85, trait: 'Fast turn-cap regen, lower occupancy.' },
        grand_manor: { id: 'grand_manor', name: 'Grand Manor', maxOccupancy: 8, regenMod: 1.2, trait: 'Higher occupancy, slower tempo.' },
        riot_venue: { id: 'riot_venue', name: 'Riot Venue', maxOccupancy: 7, regenMod: 1.0, trait: 'Balanced with disruption bias.' },
    };

    const GUESTS = {
        performer: { id: 'performer', name: 'Performer', icon: '🎤', role: 'score', trait: 'performer', cost: 1, pulseScore: 4, onAdmit: [{ type: 'score', amount: 8 }] },
        promoter: { id: 'promoter', name: 'Promoter', icon: '📣', role: 'economy', trait: 'support', cost: 1, pulseScore: 2, onAdmit: [{ type: 'capacity', amount: 1 }] },
        bouncer: { id: 'bouncer', name: 'Bouncer', icon: '🛡️', role: 'stabilizer', trait: 'security', cost: 1, pulseScore: 1, onAdmit: [{ type: 'status_self', status: 'overflowGuard', duration: 8 }] },
        gatecrasher: { id: 'gatecrasher', name: 'Gatecrasher', icon: '🚨', role: 'disruptor', trait: 'chaos', cost: 2, pulseScore: -1, onAdmit: [{ type: 'disrupt', effect: 'send_gatecrasher' }] },
        inspector: { id: 'inspector', name: 'Inspector', icon: '🕵️', role: 'disruptor', trait: 'control', cost: 2, pulseScore: 1, onAdmit: [{ type: 'disrupt', effect: 'capacity_burn', amount: 2 }] },
        socialite: { id: 'socialite', name: 'Socialite', icon: '💎', role: 'score', trait: 'vip', cost: 2, pulseScore: 5, onAdmit: [{ type: 'score', amount: 10 }] },
        organizer: { id: 'organizer', name: 'Organizer', icon: '📋', role: 'rearranger', trait: 'support', cost: 1, pulseScore: 2, onAdmit: [{ type: 'rearrange_compress' }] },
        instigator: { id: 'instigator', name: 'Instigator', icon: '🔥', role: 'disruptor', trait: 'chaos', cost: 2, pulseScore: 1, onAdmit: [{ type: 'disrupt', effect: 'regen_slow', duration: 6 }] },
        vip: { id: 'vip', name: 'VIP', icon: '⭐', role: 'finisher', trait: 'vip', cost: 2, pulseScore: 6, onAdmit: [{ type: 'adjacency_bonus', trait: 'vip', score: 12 }] },
        stabilizer: { id: 'stabilizer', name: 'Stabilizer', icon: '🧯', role: 'stabilizer', trait: 'security', cost: 1, pulseScore: 2, onAdmit: [{ type: 'clear_negative_status' }] },
        bartender: { id: 'bartender', name: 'Bartender', icon: '🍸', role: 'economy', trait: 'service', cost: 1, pulseScore: 3, onAdmit: [{ type: 'score', amount: 5 }] },
        mover: { id: 'mover', name: 'Floor Manager', icon: '↔️', role: 'rearranger', trait: 'control', cost: 1, pulseScore: 2, onAdmit: [{ type: 'rearrange_swap_edges' }] },
        regular: { id: 'regular', name: 'Regular', icon: '🙂', role: 'score', trait: 'service', cost: 1, pulseScore: 3, onAdmit: [] },
        hypecrew: { id: 'hypecrew', name: 'Hype Crew', icon: '🥁', role: 'score', trait: 'performer', cost: 1, pulseScore: 3, onAdmit: [{ type: 'adjacency_bonus', trait: 'performer', score: 8 }] },
        clogger: { id: 'clogger', name: 'Clogger', icon: '🧱', role: 'bad', trait: 'clutter', cost: 1, pulseScore: -2, onAdmit: [] },
    };

    const PASSIVES = {
        showrunner: { id: 'showrunner', name: 'Showrunner', desc: 'Admit 3 performers in a round: send Gatecrasher.', trigger: 'performer_chain' },
        exact_fill: { id: 'exact_fill', name: 'Exact Fill', desc: 'End round at exactly max occupancy: +60 score.', trigger: 'round_end_exact' },
        stabilizer_reflect: { id: 'stabilizer_reflect', name: 'Stabilizer Reflex', desc: 'First overflow each round: reflect next disruption.', trigger: 'first_overflow_reflect' },
        trait_sprint: { id: 'trait_sprint', name: 'Trait Sprint', desc: 'Admit 3 different traits in 10s: +40 score.', trigger: 'trait_sprint' },
        crowd_clock: { id: 'crowd_clock', name: 'Crowd Clock', desc: 'Every 5 admits this match: +30 score.', trigger: 'admit_count' },
        anti_clutter: { id: 'anti_clutter', name: 'Anti-Clutter', desc: 'If clutter is ejected by overflow: +20 score.', trigger: 'clutter_eject' },
        opener_bonus: { id: 'opener_bonus', name: 'Opener Bonus', desc: 'First admission each round gains +15 score.', trigger: 'first_admit' },
    };

    const ACTIVES = {
        overclock: { id: 'overclock', name: 'Overclock', desc: '+2 Turn Capacity instantly.', cooldown: 25, effect: { type: 'capacity', amount: 2 } },
        clearout: { id: 'clearout', name: 'Clear Out', desc: 'Eject rightmost guest from your house.', cooldown: 24, effect: { type: 'eject_rightmost' } },
        jam_signal: { id: 'jam_signal', name: 'Jam Signal', desc: 'Opponent regen slowed for 6s.', cooldown: 30, effect: { type: 'disrupt', effect: 'regen_slow', duration: 6 } },
        floor_shift: { id: 'floor_shift', name: 'Floor Shift', desc: 'Swap your edge guests.', cooldown: 20, effect: { type: 'rearrange_swap_edges' } },
        free_entry: { id: 'free_entry', name: 'Free Entry', desc: 'Next admitted guest is free.', cooldown: 22, effect: { type: 'status_self', status: 'freeNextAdmit', duration: 20 } },
    };

    const PROFILES = {
        tempo_hustle: {
            id: 'tempo_hustle',
            name: 'Tempo Hustle',
            houseId: 'packed_loft',
            passiveId: 'showrunner',
            activeId: 'overclock',
            deck: ['performer', 'performer', 'hypecrew', 'promoter', 'organizer', 'instigator', 'regular', 'bartender', 'vip', 'mover', 'gatecrasher', 'stabilizer'],
        },
        manor_engine: {
            id: 'manor_engine',
            name: 'Manor Engine',
            houseId: 'grand_manor',
            passiveId: 'exact_fill',
            activeId: 'free_entry',
            deck: ['socialite', 'vip', 'performer', 'regular', 'bartender', 'organizer', 'stabilizer', 'bouncer', 'promoter', 'inspector', 'mover', 'hypecrew'],
        },
        riot_control: {
            id: 'riot_control',
            name: 'Riot Control',
            houseId: 'riot_venue',
            passiveId: 'stabilizer_reflect',
            activeId: 'jam_signal',
            deck: ['instigator', 'gatecrasher', 'inspector', 'mover', 'organizer', 'bouncer', 'clogger', 'regular', 'promoter', 'socialite', 'stabilizer', 'performer'],
        },
    };

    const clone = (o) => JSON.parse(JSON.stringify(o));
    const shuffle = (arr) => {
        const deck = [...arr];
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    };

    function createPlayer(name, profileId, side, isAI = false) {
        const profile = PROFILES[profileId];
        const house = HOUSES[profile.houseId];
        return {
            side,
            isAI,
            name,
            profileId,
            profileName: profile.name,
            houseId: house.id,
            houseName: house.name,
            houseTrait: house.trait,
            passiveId: profile.passiveId,
            activeId: profile.activeId,
            capacity: 2,
            capacityMax: 5,
            regenTimer: 0,
            slots: Array(BOARD_SLOTS).fill(null),
            draw: shuffle(profile.deck),
            discard: [],
            offer: [],
            totalScore: 0,
            roundScore: 0,
            statuses: {},
            activeCooldownLeft: 0,
            metrics: {
                admitsRound: 0,
                admitsMatch: 0,
                performerRound: 0,
                traitsWindow: [],
                firstAdmitDone: false,
                firstOverflowDone: false,
            },
        };
    }

    function createMatchState(playerName, playerProfileId, rivalProfileId) {
        const rivalId = rivalProfileId || Object.keys(PROFILES).filter((id) => id !== playerProfileId)[Math.floor(Math.random() * 2)];
        const state = {
            phase: 'live',
            round: 1,
            timer: ROUND_DURATION_S,
            shopTimer: SHOP_DURATION_S,
            tickClock: 0,
            notifications: [],
            winner: null,
            players: {
                player: createPlayer(playerName, playerProfileId, 'player', false),
                rival: createPlayer('Rival Venue', rivalId, 'rival', true),
            },
        };

        refillOffer(state.players.player);
        refillOffer(state.players.rival);
        return state;
    }

    function drawGuest(player) {
        if (!player.draw.length) {
            player.draw = shuffle(player.discard);
            player.discard = [];
        }
        return player.draw.shift() || null;
    }

    function refillOffer(player) {
        while (player.offer.length < OFFER_SIZE) {
            const id = drawGuest(player);
            if (!id) break;
            player.offer.push(id);
        }
    }

    function notify(state, text, kind = 'neutral') {
        state.notifications.unshift({ text, kind, ttl: 4 });
        if (state.notifications.length > 12) state.notifications.pop();
    }

    function countGuests(player) {
        return player.slots.filter(Boolean).length;
    }

    function compressSlots(player) {
        const filled = player.slots.filter(Boolean);
        while (filled.length < BOARD_SLOTS) filled.push(null);
        player.slots = filled;
    }

    function removeRightmost(player) {
        for (let i = BOARD_SLOTS - 1; i >= 0; i--) {
            if (player.slots[i]) {
                const removed = player.slots[i];
                player.slots[i] = null;
                compressSlots(player);
                player.discard.push(removed.id);
                return removed;
            }
        }
        return null;
    }

    function addScore(state, side, amount, reason) {
        const p = state.players[side];
        p.roundScore += amount;
        p.totalScore += amount;
        if (Math.abs(amount) >= 10) {
            const sign = amount >= 0 ? '+' : '';
            notify(state, `${p.name}: ${sign}${amount} ${reason}`, side);
        }
    }

    function applyDisruption(state, fromSide, effect, amount = 0, duration = 0) {
        const toSide = fromSide === 'player' ? 'rival' : 'player';
        const from = state.players[fromSide];
        const to = state.players[toSide];

        if (to.statuses.reflectNextDisruption) {
            delete to.statuses.reflectNextDisruption;
            notify(state, `${to.name} reflected disruption!`, toSide);
            return applyDisruption(state, toSide, effect, amount, duration);
        }

        if (effect === 'capacity_burn') {
            to.capacity = Math.max(0, to.capacity - (amount || 1));
            notify(state, `${from.name} burned ${to.name}'s capacity`, fromSide);
        } else if (effect === 'regen_slow') {
            to.statuses.regenSlow = Math.max(to.statuses.regenSlow || 0, duration || 4);
            notify(state, `${from.name} slowed ${to.name}'s regen`, fromSide);
        } else if (effect === 'send_gatecrasher') {
            to.offer.unshift('clogger');
            to.offer = to.offer.slice(0, OFFER_SIZE);
            notify(state, `Gatecrasher sent to ${to.name}`, fromSide);
        } else if (effect === 'silence_pulse') {
            to.statuses.silenced = Math.max(to.statuses.silenced || 0, duration || 4);
            notify(state, `${to.name} slot bonuses silenced`, fromSide);
        } else if (effect === 'push_overflow') {
            const removed = removeRightmost(to);
            if (removed) notify(state, `${to.name} was pushed: ${GUESTS[removed.id].name} ejected`, fromSide);
        }
    }

    function applyEffect(state, side, effect) {
        const player = state.players[side];
        if (effect.type === 'score') {
            addScore(state, side, effect.amount, 'from guest');
        } else if (effect.type === 'capacity') {
            player.capacity = Math.min(player.capacityMax, player.capacity + effect.amount);
        } else if (effect.type === 'disrupt') {
            applyDisruption(state, side, effect.effect, effect.amount, effect.duration);
        } else if (effect.type === 'status_self') {
            player.statuses[effect.status] = Math.max(player.statuses[effect.status] || 0, effect.duration || 1);
        } else if (effect.type === 'rearrange_compress') {
            compressSlots(player);
        } else if (effect.type === 'rearrange_swap_edges') {
            const left = player.slots[0];
            const rightIndex = player.slots.map((g, i) => (g ? i : -1)).filter((n) => n >= 0).pop();
            if (rightIndex !== undefined && rightIndex > 0) {
                player.slots[0] = player.slots[rightIndex];
                player.slots[rightIndex] = left;
                notify(state, `${player.name} shifted floor positions`, side);
            }
        } else if (effect.type === 'adjacency_bonus') {
            const idx = player.slots.findIndex((x) => x && x.id === effect.sourceId);
            if (idx >= 0) {
                const left = player.slots[idx - 1];
                const right = player.slots[idx + 1];
                if ((left && left.trait === effect.trait) || (right && right.trait === effect.trait)) {
                    addScore(state, side, effect.score, 'adjacency combo');
                }
            }
        } else if (effect.type === 'clear_negative_status') {
            delete player.statuses.regenSlow;
            delete player.statuses.silenced;
        } else if (effect.type === 'eject_rightmost') {
            removeRightmost(player);
        }
    }

    function onAdmitPassiveChecks(state, side, guest) {
        const p = state.players[side];
        const passive = PASSIVES[p.passiveId];
        p.metrics.admitsRound += 1;
        p.metrics.admitsMatch += 1;

        if (!p.metrics.firstAdmitDone) {
            p.metrics.firstAdmitDone = true;
            if (passive.trigger === 'first_admit') addScore(state, side, 15, 'first admit passive');
        }

        if (guest.trait === 'performer') p.metrics.performerRound += 1;
        p.metrics.traitsWindow.push({ t: state.tickClock, trait: guest.trait });
        p.metrics.traitsWindow = p.metrics.traitsWindow.filter((x) => state.tickClock - x.t <= 10);

        if (passive.trigger === 'performer_chain' && p.metrics.performerRound >= 3) {
            p.metrics.performerRound = -99;
            applyDisruption(state, side, 'send_gatecrasher');
            notify(state, `${p.name} passive: Showrunner triggered`, side);
        }

        if (passive.trigger === 'trait_sprint') {
            const uniq = new Set(p.metrics.traitsWindow.map((x) => x.trait));
            if (uniq.size >= 3) {
                p.metrics.traitsWindow = [];
                addScore(state, side, 40, 'Trait Sprint');
            }
        }

        if (passive.trigger === 'admit_count' && p.metrics.admitsMatch % 5 === 0) {
            addScore(state, side, 30, 'Crowd Clock');
        }
    }

    function resolveOverflow(state, side) {
        const p = state.players[side];
        const occupancy = countGuests(p);
        if (occupancy <= p.maxOccupancy) return;
        if (p.statuses.overflowGuard) {
            notify(state, `${p.name} blocked overflow with security`, side);
            delete p.statuses.overflowGuard;
            return;
        }

        const removed = removeRightmost(p);
        notify(state, `Overflow! ${p.name} ejected ${removed ? GUESTS[removed.id].name : 'a guest'}`, side);

        const passive = PASSIVES[p.passiveId];
        if (passive.trigger === 'first_overflow_reflect' && !p.metrics.firstOverflowDone) {
            p.metrics.firstOverflowDone = true;
            p.statuses.reflectNextDisruption = 999;
            notify(state, `${p.name} prepared disruption reflect`, side);
        }
        if (passive.trigger === 'clutter_eject' && removed && removed.trait === 'clutter') {
            addScore(state, side, 20, 'Anti-Clutter');
        }
    }

    function admitFromOffer(state, side, index) {
        const p = state.players[side];
        if (state.phase !== 'live') return false;
        const guestId = p.offer[index];
        if (!guestId) return false;

        const baseCost = GUESTS[guestId].cost;
        const effectiveCost = p.statuses.freeNextAdmit ? 0 : baseCost;
        if (p.capacity < effectiveCost) return false;

        p.capacity -= effectiveCost;
        delete p.statuses.freeNextAdmit;

        const guest = clone(GUESTS[guestId]);
        p.offer.splice(index, 1);
        refillOffer(p);

        const slot = p.slots.findIndex((x) => x === null);
        if (slot >= 0) p.slots[slot] = guest;
        else {
            p.slots[BOARD_SLOTS - 1] = guest;
            compressSlots(p);
        }

        addScore(state, side, 5, 'admission');
        onAdmitPassiveChecks(state, side, guest);

        guest.onAdmit.forEach((eff) => {
            const payload = { ...eff };
            if (payload.type === 'adjacency_bonus') payload.sourceId = guest.id;
            applyEffect(state, side, payload);
        });

        resolveOverflow(state, side);
        return true;
    }

    function useActive(state, side) {
        const p = state.players[side];
        if (state.phase !== 'live' || p.activeCooldownLeft > 0) return false;
        const active = ACTIVES[p.activeId];
        applyEffect(state, side, active.effect);
        p.activeCooldownLeft = active.cooldown;
        notify(state, `${p.name} used ${active.name}`, side);
        return true;
    }

    function tickStatuses(player, dt) {
        Object.keys(player.statuses).forEach((k) => {
            player.statuses[k] -= dt;
            if (player.statuses[k] <= 0) delete player.statuses[k];
        });
        if (player.activeCooldownLeft > 0) player.activeCooldownLeft = Math.max(0, player.activeCooldownLeft - dt);
    }

    function tickCapacity(player, dt) {
        const regenFactor = player.statuses.regenSlow ? 1.7 : 1;
        player.regenTimer += dt;
        const interval = CAPACITY_REGEN_INTERVAL_S * HOUSES[player.houseId].regenMod * regenFactor;
        while (player.regenTimer >= interval) {
            player.regenTimer -= interval;
            player.capacity = Math.min(player.capacityMax, player.capacity + 1);
        }
    }

    function scorePulse(state, side) {
        const p = state.players[side];
        let pulse = 0;
        p.slots.forEach((g, i) => {
            if (!g) return;
            let val = g.pulseScore;
            const left = p.slots[i - 1];
            const right = p.slots[i + 1];
            if ((left && left.trait === g.trait) || (right && right.trait === g.trait)) val += 1;
            if (g.trait === 'vip' && countGuests(p) >= Math.min(p.maxOccupancy, BOARD_SLOTS)) val += 2;
            pulse += val;
        });
        if (p.statuses.silenced) pulse = Math.floor(pulse * 0.5);
        if (pulse !== 0) addScore(state, side, pulse, 'pulse');
    }

    function endRound(state) {
        const applyRoundEndPassive = (side) => {
            const p = state.players[side];
            const passive = PASSIVES[p.passiveId];
            if (passive.trigger === 'round_end_exact' && countGuests(p) === p.maxOccupancy) {
                addScore(state, side, 60, 'Exact Fill');
            }
        };

        applyRoundEndPassive('player');
        applyRoundEndPassive('rival');

        if (state.round >= TOTAL_ROUNDS) {
            state.phase = 'gameover';
            const p = state.players.player.totalScore;
            const r = state.players.rival.totalScore;
            state.winner = p === r ? 'tie' : (p > r ? 'player' : 'rival');
            return;
        }

        state.phase = 'shop';
        state.shopTimer = SHOP_DURATION_S;
    }

    function startNextRound(state) {
        state.round += 1;
        state.phase = 'live';
        state.timer = ROUND_DURATION_S;

        ['player', 'rival'].forEach((side) => {
            const p = state.players[side];
            p.capacity = 2;
            p.regenTimer = 0;
            p.roundScore = 0;
            p.statuses = {};
            p.metrics.admitsRound = 0;
            p.metrics.performerRound = 0;
            p.metrics.traitsWindow = [];
            p.metrics.firstAdmitDone = false;
            p.metrics.firstOverflowDone = false;
            refillOffer(p);
        });
        notify(state, `Round ${state.round} started`, 'neutral');
    }

    function tick(state, dt) {
        state.tickClock += dt;
        state.notifications.forEach((n) => (n.ttl -= dt));
        state.notifications = state.notifications.filter((n) => n.ttl > 0);

        if (state.phase === 'shop') {
            state.shopTimer -= dt;
            if (state.shopTimer <= 0) startNextRound(state);
            return;
        }
        if (state.phase !== 'live') return;

        state.timer -= dt;
        ['player', 'rival'].forEach((side) => {
            tickStatuses(state.players[side], dt);
            tickCapacity(state.players[side], dt);
        });

        const pulseBefore = Math.floor((state.timer + dt) / SCORE_PULSE_INTERVAL_S);
        const pulseNow = Math.floor(Math.max(0, state.timer) / SCORE_PULSE_INTERVAL_S);
        if (pulseNow < pulseBefore) {
            scorePulse(state, 'player');
            scorePulse(state, 'rival');
        }

        if (state.timer <= 0) endRound(state);
    }

    return {
        ROUND_DURATION_S,
        SHOP_DURATION_S,
        TOTAL_ROUNDS,
        BOARD_SLOTS,
        HOUSES,
        GUESTS,
        PASSIVES,
        ACTIVES,
        PROFILES,
        createMatchState,
        tick,
        admitFromOffer,
        useActive,
        countGuests,
        refillOffer,
        notify,
    };
})();
