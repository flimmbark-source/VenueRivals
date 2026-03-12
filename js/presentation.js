(function (global) {
    'use strict';

    const EVENTS = Object.freeze({
        HEAT_CHANGED: 'HEAT_CHANGED',
        BUST_WARNING: 'BUST_WARNING',
        GUEST_ADMITTED: 'GUEST_ADMITTED',
        RARE_GUEST_ADMITTED: 'RARE_GUEST_ADMITTED',
        ABILITY_USED: 'ABILITY_USED',
        ROUND_BANKED: 'ROUND_BANKED',
        ROUND_BUST: 'ROUND_BUST',
        RIVAL_SPIKE: 'RIVAL_SPIKE',
    });

    function createEventBus() {
        const listeners = new Map();
        return {
            on(eventName, handler) {
                if (!listeners.has(eventName)) listeners.set(eventName, new Set());
                listeners.get(eventName).add(handler);
                return () => listeners.get(eventName)?.delete(handler);
            },
            emit(eventName, payload = {}) {
                const handlers = listeners.get(eventName);
                if (!handlers) return;
                handlers.forEach((handler) => {
                    try {
                        handler(payload);
                    } catch (_) {
                        // Ignore handler errors so one visual effect doesn't break the bus.
                    }
                });
            },
        };
    }

    function getHeatBand(heat, heatCap, busted) {
        if (busted) return 'bust';
        const cap = Math.max(1, heatCap || 1);
        const ratio = Math.max(0, heat || 0) / cap;
        if (ratio >= 0.95) return 'critical';
        if (ratio >= 0.7) return 'hot';
        if (ratio >= 0.35) return 'warm';
        return 'calm';
    }

    function getRivalThreat(gameState) {
        if (!gameState?.player || !gameState?.rival) return 'low';
        const target = Math.max(1, gameState.pointTarget || 50);
        const playerProgress = gameState.player.points / target;
        const rivalProgress = gameState.rival.points / target;
        const rivalLead = gameState.rival.points - gameState.player.points;

        if (rivalProgress >= 0.8 || rivalLead >= 8 || gameState.player.busted) return 'high';
        if (rivalProgress >= 0.5 || playerProgress < rivalProgress || rivalLead >= 3) return 'medium';
        return 'low';
    }

    function getPressure(heatBand, rivalThreat) {
        if (heatBand === 'critical' || heatBand === 'bust' || rivalThreat === 'high') return 'urgent';
        if (heatBand === 'hot' || rivalThreat === 'medium') return 'rising';
        return 'none';
    }

    function getVenueMood(venueId) {
        if (!venueId) return 'neutral';
        const map = {
            velvetRoom: 'velvet-noir',
            champagneCountdown: 'gold-rush',
            headlinerAfterparty: 'spotlight-pop',
            nightMarket: 'neon-haze',
            trendsetterMixer: 'runway-glow',
            backAlley: 'grit-smoke',
            blackMarketBash: 'underground-static',
            riotNight: 'riot-pulse',
        };
        return map[venueId] || 'neutral';
    }

    function derivePresentationState({ gameState, momentHint, previousState }) {
        const prev = previousState || null;
        if (!gameState?.player || !gameState?.rival) {
            return {
                heatBand: 'calm',
                momentType: momentHint || prev?.momentType || 'idle',
                pressure: 'none',
                venueMood: 'neutral',
                rivalThreat: 'low',
            };
        }

        const player = gameState.player;
        const venue = global.Game?.VENUES?.[player.venueId];
        const heatCap = global.Game?.getHeatCapacity ? global.Game.getHeatCapacity(venue, player) : 3;
        const heatBand = getHeatBand(player.heat, heatCap, player.busted);
        const rivalThreat = getRivalThreat(gameState);

        const fallbackMoment = gameState.phase === 'buy'
            ? 'shop'
            : gameState.phase === 'gameover'
                ? (gameState.winner === 'player' ? 'win' : 'loss')
                : 'idle';

        return {
            heatBand,
            momentType: momentHint || fallbackMoment,
            pressure: getPressure(heatBand, rivalThreat),
            venueMood: getVenueMood(player.venueId),
            rivalThreat,
        };
    }

    const api = {
        EVENTS,
        createEventBus,
        derivePresentationState,
    };

    global.Presentation = api;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
}(typeof window !== 'undefined' ? window : globalThis));
