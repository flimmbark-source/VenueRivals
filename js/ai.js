/* ============================================
   VENUE RIVALS - Rival Simulation (fake multiplayer)
   ============================================ */

const AI = (() => {
    let thinkTimer = 0;

    function tick(state, dt) {
        if (state.phase !== 'live') return;
        thinkTimer += dt;
        if (thinkTimer < 1) return;
        thinkTimer = 0;

        const p = state.players.rival;
        if (p.activeCooldownLeft <= 0 && Math.random() < 0.2) {
            Game.useActive(state, 'rival');
        }

        const affordable = p.offer
            .map((id, i) => ({ id, i, card: Game.GUESTS[id] }))
            .filter((x) => x.card && x.card.cost <= p.capacity);

        if (!affordable.length) return;

        affordable.sort((a, b) => {
            const av = a.card.pulseScore + (a.card.role === 'disruptor' ? 3 : 0) + (a.card.role === 'score' ? 2 : 0);
            const bv = b.card.pulseScore + (b.card.role === 'disruptor' ? 3 : 0) + (b.card.role === 'score' ? 2 : 0);
            return bv - av;
        });

        const pick = affordable[0];
        Game.admitFromOffer(state, 'rival', pick.i);
    }

    return { tick };
})();
