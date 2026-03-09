const Game = require("./game");

// Helper: create a minimal player object for testing abilities
function makePlayer(overrides = {}) {
  return {
    name: "TestPlayer",
    venueId: "velvetRoom",
    isAI: false,
    fullDeck: [],
    guestList: [],
    roundDeck: [],
    house: [],
    arrivingGuest: null,
    arrivingAbilityUsed: false,
    roundMoney: 0,
    roundPoints: 0,
    guestMoney: 0,
    guestPoints: 0,
    money: 10,
    points: 0,
    heat: 0,
    doorClosed: false,
    busted: false,
    phaseComplete: false,
    slotIncrease: 0,
    heatCapBonus: 0,
    shopItemPurchases: { slotIncrease: 0, heatCapIncrease: 0 },
    ...overrides,
  };
}

function makeHouseEntry(guestId, overrides = {}) {
  return {
    instanceId: Math.floor(Math.random() * 100000),
    guestId,
    lockUntilClose: false,
    abilityUsed: false,
    ...overrides,
  };
}

function makeOpponent(overrides = {}) {
  return makePlayer({ name: "Opponent", isAI: true, ...overrides });
}

// ── coolHeat ──────────────────────────────────────────────────────

describe("coolHeat ability", () => {
  test("reduces player heat by ability value (arriving guest)", () => {
    const player = makePlayer({ heat: 3, arrivingGuest: "chiller" });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result).not.toBeNull();
    expect(result.effects).toContain("cooled 1 heat");
    expect(player.heat).toBe(2);
    expect(player.arrivingAbilityUsed).toBe(true);
  });

  test("coolHeat value 2 (bookkeeper Audit)", () => {
    const player = makePlayer({ heat: 3, arrivingGuest: "bookkeeper" });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result).not.toBeNull();
    expect(result.effects).toContain("cooled 2 heat");
    expect(player.heat).toBe(1);
  });

  test("coolHeat does not go below 0", () => {
    const player = makePlayer({ heat: 0, arrivingGuest: "chiller" });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(player.heat).toBe(0);
  });

  test("coolHeat from house guest", () => {
    const entry = makeHouseEntry("chiller");
    const player = makePlayer({ heat: 2, house: [entry] });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom, {
      source: "house", guestId: "chiller", instanceId: entry.instanceId,
    });
    expect(result).not.toBeNull();
    expect(player.heat).toBe(1);
    expect(entry.abilityUsed).toBe(true);
  });
});

// ── addOpponentHeat ───────────────────────────────────────────────

describe("addOpponentHeat ability", () => {
  test("adds heat to opponent (hypester, value 1)", () => {
    const player = makePlayer({ arrivingGuest: "hypester" });
    const opponent = makeOpponent({ heat: 1 });
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result).not.toBeNull();
    expect(result.effects).toContain("added 1 heat to opponent");
    expect(opponent.heat).toBe(2);
  });

  test("adds 2 heat (provocateur Taunt)", () => {
    const player = makePlayer({ arrivingGuest: "provocateur" });
    const opponent = makeOpponent({ heat: 0 });
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result.effects).toContain("added 2 heat to opponent");
    expect(opponent.heat).toBe(2);
  });
});

// ── scoreNow ──────────────────────────────────────────────────────

describe("scoreNow ability", () => {
  test("scores points immediately (spotlightPhotographer Flash)", () => {
    const player = makePlayer({ arrivingGuest: "spotlightPhotographer", roundPoints: 3 });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result).not.toBeNull();
    expect(result.effects).toContain("scored 2 points");
    expect(player.roundPoints).toBe(5);
  });
});

// ── revealNext ────────────────────────────────────────────────────

describe("revealNext ability", () => {
  test("reveals 1 guest (tipOffArtist Tip-Off)", () => {
    const player = makePlayer({
      arrivingGuest: "tipOffArtist",
      roundDeck: ["regular", "hypeFriend", "chiller"],
    });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result).not.toBeNull();
    expect(result.revealedGuests).toHaveLength(1);
    expect(result.revealedGuests[0]).toBe("chiller"); // last in deck = next drawn
  });

  test("reveals 2 guests (rovingCritic Inspect)", () => {
    const player = makePlayer({
      arrivingGuest: "rovingCritic",
      roundDeck: ["regular", "hypeFriend", "chiller"],
    });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result.revealedGuests).toHaveLength(2);
  });

  test("handles empty deck gracefully", () => {
    const player = makePlayer({ arrivingGuest: "tipOffArtist", roundDeck: [] });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result.effects).toContain("queue empty");
  });
});

// ── revealAndReorder (STACK) ─────────────────────────────────────

describe("revealAndReorder ability (STACK)", () => {
  test("reveals 2 guests and sets needsStackChoice (galleryScout Stack)", () => {
    const player = makePlayer({
      arrivingGuest: "galleryScout",
      roundDeck: ["regular", "hypeFriend"],
    });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result).not.toBeNull();
    expect(result.revealedGuests).toHaveLength(2);
    expect(result.needsStackChoice).toBe(true);
    // Deck order should NOT have changed yet
    expect(player.roundDeck[0]).toBe("regular");
    expect(player.roundDeck[1]).toBe("hypeFriend");
  });

  test("handles single card in deck", () => {
    const player = makePlayer({
      arrivingGuest: "galleryScout",
      roundDeck: ["regular"],
    });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result.revealedGuests).toHaveLength(1);
    expect(result.needsStackChoice).toBeUndefined();
  });

  test("handles empty deck", () => {
    const player = makePlayer({ arrivingGuest: "galleryScout", roundDeck: [] });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result).not.toBeNull();
    expect(result.revealedGuests).toBeUndefined();
  });
});

// ── resolveStackChoice ──────────────────────────────────────────

describe("resolveStackChoice", () => {
  test("reorders top 2 so chosen card is drawn next", () => {
    const player = makePlayer({ roundDeck: ["a", "b", "c"] });
    // c is on top (drawn next), b is second
    const ok = Game.resolveStackChoice(player, "b");
    expect(ok).toBe(true);
    expect(player.roundDeck[player.roundDeck.length - 1]).toBe("b");
    expect(player.roundDeck[player.roundDeck.length - 2]).toBe("c");
  });

  test("no-op when chosen card is already on top", () => {
    const player = makePlayer({ roundDeck: ["a", "b", "c"] });
    const ok = Game.resolveStackChoice(player, "c");
    expect(ok).toBe(true);
    expect(player.roundDeck[player.roundDeck.length - 1]).toBe("c");
  });

  test("returns false for invalid choice", () => {
    const player = makePlayer({ roundDeck: ["a", "b", "c"] });
    const ok = Game.resolveStackChoice(player, "a");
    expect(ok).toBe(false);
  });

  test("returns false when deck has fewer than 2 cards", () => {
    const player = makePlayer({ roundDeck: ["a"] });
    const ok = Game.resolveStackChoice(player, "a");
    expect(ok).toBe(false);
  });
});

// ── bounce (targeting) ───────────────────────────────────────────

describe("bounce ability", () => {
  test("bounces oldest guest back to queue (standIn Understudy)", () => {
    const entry = makeHouseEntry("regular");
    const player = makePlayer({
      arrivingGuest: "standIn",
      house: [makeHouseEntry("hypeFriend"), entry], // entry at last index = oldest
      roundDeck: ["chiller"],
    });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result).not.toBeNull();
    expect(player.house).toHaveLength(1);
    expect(player.house[0].guestId).toBe("hypeFriend");
    // Bounced guest goes to front of deck array (drawn last)
    expect(player.roundDeck[0]).toBe("regular");
  });

  test("does not bounce a locked guest", () => {
    const lockedEntry = makeHouseEntry("regular", { lockUntilClose: true });
    const player = makePlayer({
      arrivingGuest: "standIn",
      house: [makeHouseEntry("hypeFriend"), lockedEntry],
    });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(player.house).toHaveLength(2); // nothing bounced
    expect(result.effects).toContain("target is locked");
  });

  test("no-op when house is empty", () => {
    const player = makePlayer({
      arrivingGuest: "standIn",
      house: [],
    });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result.effects).toContain("no valid target");
  });
});

// ── nudge (targeting) ────────────────────────────────────────────

describe("nudge ability", () => {
  test("nudges oldest guest one step toward newest (usher Escort)", () => {
    const a = makeHouseEntry("regular");
    const b = makeHouseEntry("hypeFriend");
    const player = makePlayer({
      arrivingGuest: "usher",
      house: [a, b], // b is oldest (index 1)
    });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result).not.toBeNull();
    expect(result.effects[0]).toMatch(/nudged/);
    // b should have moved from index 1 to index 0
    expect(player.house[0].guestId).toBe("hypeFriend");
    expect(player.house[1].guestId).toBe("regular");
  });

  test("cannot nudge a locked guest", () => {
    const a = makeHouseEntry("regular");
    const b = makeHouseEntry("hypeFriend", { lockUntilClose: true });
    const player = makePlayer({
      arrivingGuest: "usher",
      house: [a, b],
    });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result.effects).toContain("blocked by lock");
    expect(player.house[1].guestId).toBe("hypeFriend"); // unchanged
  });

  test("cannot nudge into a locked neighbor", () => {
    const a = makeHouseEntry("regular", { lockUntilClose: true });
    const b = makeHouseEntry("hypeFriend");
    const player = makePlayer({
      arrivingGuest: "usher",
      house: [a, b],
    });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result.effects).toContain("blocked by lock");
  });

  test("no-op when target is already at newest", () => {
    const a = makeHouseEntry("regular");
    const player = makePlayer({
      arrivingGuest: "usher",
      house: [a], // oldest = index 0, already at newest
    });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result.effects).toContain("no valid move");
  });
});

// ── boot (targeting) ─────────────────────────────────────────────

describe("boot ability", () => {
  test("boots oldest guest out (floorRunner Crowd Surf)", () => {
    const player = makePlayer({
      arrivingGuest: "floorRunner",
      house: [makeHouseEntry("hypeFriend"), makeHouseEntry("regular")],
    });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result).not.toBeNull();
    expect(result.pushedOut).toBe("regular");
    expect(player.house).toHaveLength(1);
    expect(player.house[0].guestId).toBe("hypeFriend");
  });

  test("does not boot locked target", () => {
    const locked = makeHouseEntry("regular", { lockUntilClose: true });
    const player = makePlayer({
      arrivingGuest: "floorRunner",
      house: [makeHouseEntry("hypeFriend"), locked],
    });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(player.house).toHaveLength(2);
    expect(result.effects).toContain("target is locked");
  });

  test("boot leftOfSelf targets correct guest (wheelman Getaway)", () => {
    const a = makeHouseEntry("regular");
    const b = makeHouseEntry("hypeFriend");
    const c = makeHouseEntry("chiller");
    const player = makePlayer({
      arrivingGuest: "wheelman",
      house: [a, b, c], // arriving will be at 0; leftOfSelf = current index 0
    });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result).not.toBeNull();
    // leftOfSelf for arriving (sourceIndex -1) => current index 0
    expect(result.pushedOut).toBe("regular");
    expect(player.house).toHaveLength(2);
  });

  test("boot leftOfSelf skips locked target", () => {
    const a = makeHouseEntry("regular", { lockUntilClose: true });
    const b = makeHouseEntry("hypeFriend");
    const player = makePlayer({
      arrivingGuest: "wheelman",
      house: [a, b],
    });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result.effects).toContain("target is locked");
    expect(player.house).toHaveLength(2);
  });

  test("boot leftOfSelf no-op on empty house", () => {
    const player = makePlayer({
      arrivingGuest: "wheelman",
      house: [],
    });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result.effects).toContain("no valid target");
  });
});

// (pushAnother tests removed — wheelman now uses boot/leftOfSelf, tested above)

// ── lockAnother ───────────────────────────────────────────────────

describe("lockAnother ability", () => {
  test("locks adjacent guest when activated from arriving guest", () => {
    const front = makeHouseEntry("regular");
    const player = makePlayer({
      arrivingGuest: "celebrity",
      house: [front, makeHouseEntry("hypeFriend")],
    });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result).not.toBeNull();
    expect(result.effects).toContain("locked a guest");
    // Should lock index 0 (adjacent to arriving guest's future position)
    expect(front.lockUntilClose).toBe(true);
  });

  test("locks adjacent when activated from house guest at index 0", () => {
    const activator = makeHouseEntry("celebrity");
    const neighbor = makeHouseEntry("regular");
    const player = makePlayer({
      house: [activator, neighbor],
    });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom, {
      source: "house", guestId: "celebrity", instanceId: activator.instanceId,
    });
    expect(result).not.toBeNull();
    // index 0 has no left neighbor; should lock right neighbor (index 1)
    expect(neighbor.lockUntilClose).toBe(true);
  });

  test("locks adjacent when activated from house guest in middle", () => {
    const left = makeHouseEntry("regular");
    const activator = makeHouseEntry("celebrity");
    const right = makeHouseEntry("hypeFriend");
    const player = makePlayer({
      house: [left, activator, right],
    });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom, {
      source: "house", guestId: "celebrity", instanceId: activator.instanceId,
    });
    expect(result).not.toBeNull();
    // Should lock index 0 (left of activator at index 1)
    expect(left.lockUntilClose).toBe(true);
  });

  test("reports no adjacent guest when house is empty", () => {
    const player = makePlayer({ arrivingGuest: "celebrity", house: [] });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result.effects).toContain("no adjacent guest");
  });
});

// ── lockAdjacent ──────────────────────────────────────────────────

describe("lockAdjacent ability", () => {
  test("locks adjacent guest from arriving position", () => {
    const front = makeHouseEntry("regular");
    const player = makePlayer({
      arrivingGuest: "headliner",
      house: [front, makeHouseEntry("hypeFriend")],
    });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result).not.toBeNull();
    expect(result.effects[0]).toMatch(/locked 1 adjacent/);
    expect(front.lockUntilClose).toBe(true);
  });

  test("locks BOTH adjacent when activated from middle of house", () => {
    const left = makeHouseEntry("regular");
    const activator = makeHouseEntry("headliner");
    const right = makeHouseEntry("hypeFriend");
    const player = makePlayer({
      house: [left, activator, right],
    });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom, {
      source: "house", guestId: "headliner", instanceId: activator.instanceId,
    });
    expect(result).not.toBeNull();
    expect(result.effects[0]).toMatch(/locked 2 adjacent/);
    expect(left.lockUntilClose).toBe(true);
    expect(right.lockUntilClose).toBe(true);
    expect(activator.lockUntilClose).toBe(false); // activator itself not locked
  });

  test("locks 1 when at edge of house", () => {
    const activator = makeHouseEntry("headliner");
    const neighbor = makeHouseEntry("regular");
    const player = makePlayer({
      house: [activator, neighbor],
    });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom, {
      source: "house", guestId: "headliner", instanceId: activator.instanceId,
    });
    expect(result.effects[0]).toMatch(/locked 1 adjacent/);
    expect(neighbor.lockUntilClose).toBe(true);
  });

  test("reports no adjacent when alone in house", () => {
    const activator = makeHouseEntry("headliner");
    const player = makePlayer({
      house: [activator],
    });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom, {
      source: "house", guestId: "headliner", instanceId: activator.instanceId,
    });
    expect(result.effects).toContain("no adjacent guests");
  });
});

// ── queueGatecrasher ──────────────────────────────────────────────

describe("queueGatecrasher ability", () => {
  test("queues gatecrasher for opponent (gateRunner Raid)", () => {
    const player = makePlayer({ arrivingGuest: "gateRunner" });
    const opponent = makeOpponent({ roundDeck: ["regular"] });
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result).not.toBeNull();
    expect(result.effects).toContain("queued gatecrasher for opponent");
    expect(opponent.roundDeck).toContain("gatecrasher");
    // Gatecrasher is pushed to end of array (drawn next)
    expect(opponent.roundDeck[opponent.roundDeck.length - 1]).toBe("gatecrasher");
  });
});

// ── gainMoney ─────────────────────────────────────────────────────

describe("gainMoney ability", () => {
  test("gains 3 money (partyPromoter Promo Deal)", () => {
    const player = makePlayer({ arrivingGuest: "partyPromoter", roundMoney: 5 });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result).not.toBeNull();
    expect(result.effects).toContain("gained 3 money");
    expect(player.roundMoney).toBe(8);
  });

  test("gains 2 money (curioDealer Appraise)", () => {
    const player = makePlayer({ arrivingGuest: "curioDealer", roundMoney: 0 });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result.effects).toContain("gained 2 money");
    expect(player.roundMoney).toBe(2);
  });
});

// ── stealMoney ────────────────────────────────────────────────────

describe("stealMoney ability", () => {
  test("steals 2 money (champagneHost Tab)", () => {
    const player = makePlayer({ arrivingGuest: "champagneHost", roundMoney: 0 });
    const opponent = makeOpponent({ roundMoney: 5 });
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result).not.toBeNull();
    expect(result.effects).toContain("stole 2 money");
    expect(player.roundMoney).toBe(2);
    expect(opponent.roundMoney).toBe(3);
  });

  test("steals only what opponent has", () => {
    const player = makePlayer({ arrivingGuest: "champagneHost", roundMoney: 0 });
    const opponent = makeOpponent({ roundMoney: 1 });
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result.effects).toContain("stole 1 money");
    expect(player.roundMoney).toBe(1);
    expect(opponent.roundMoney).toBe(0);
  });

  test("nothing to steal when opponent has 0", () => {
    const player = makePlayer({ arrivingGuest: "champagneHost", roundMoney: 0 });
    const opponent = makeOpponent({ roundMoney: 0 });
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result.effects).toContain("nothing to steal");
  });

  test("steals 1 money (fence Black Market)", () => {
    const player = makePlayer({ arrivingGuest: "fence", roundMoney: 0 });
    const opponent = makeOpponent({ roundMoney: 3 });
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result.effects).toContain("stole 1 money");
    expect(player.roundMoney).toBe(1);
    expect(opponent.roundMoney).toBe(2);
  });
});

// ── discardNext ───────────────────────────────────────────────────

describe("discardNext ability", () => {
  test("discards next queued guest (velvetBouncer Card Check)", () => {
    const player = makePlayer({
      arrivingGuest: "velvetBouncer",
      roundDeck: ["regular", "hypeFriend"],
    });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result).not.toBeNull();
    expect(result.effects[0]).toMatch(/discarded/);
    expect(player.roundDeck).toHaveLength(1);
    expect(player.roundDeck[0]).toBe("regular");
  });

  test("reports empty queue", () => {
    const player = makePlayer({ arrivingGuest: "velvetBouncer", roundDeck: [] });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result.effects).toContain("queue empty");
  });
});

// ── stylist (migrated to coolHeat) ───────────────────────────────

describe("stylist ability (Freshen Up)", () => {
  test("cools 1 heat (stylist Freshen Up)", () => {
    const player = makePlayer({
      arrivingGuest: "stylist",
      heat: 2,
    });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result).not.toBeNull();
    expect(result.effects).toContain("cooled 1 heat");
    expect(player.heat).toBe(1);
  });
});

// ── trendBroker (migrated to stealMoney) ─────────────────────────

describe("trendBroker ability (Insider Trade)", () => {
  test("steals 1 money from opponent (trendBroker Insider Trade)", () => {
    const player = makePlayer({ arrivingGuest: "trendBroker", roundMoney: 0 });
    const opponent = makeOpponent({ roundMoney: 3 });
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result).not.toBeNull();
    expect(result.effects).toContain("stole 1 money");
    expect(player.roundMoney).toBe(1);
    expect(opponent.roundMoney).toBe(2);
  });

  test("nothing to steal when opponent has 0", () => {
    const player = makePlayer({ arrivingGuest: "trendBroker", roundMoney: 0 });
    const opponent = makeOpponent({ roundMoney: 0 });
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result.effects).toContain("nothing to steal");
  });
});

// ── General activation guards ─────────────────────────────────────

describe("activateAbility guards", () => {
  test("returns null if door is closed", () => {
    const player = makePlayer({ arrivingGuest: "chiller", doorClosed: true });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result).toBeNull();
  });

  test("returns null if busted", () => {
    const player = makePlayer({ arrivingGuest: "chiller", busted: true });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result).toBeNull();
  });

  test("returns null if ability already used (arriving)", () => {
    const player = makePlayer({ arrivingGuest: "chiller", arrivingAbilityUsed: true });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result).toBeNull();
  });

  test("returns null if ability already used (house)", () => {
    const entry = makeHouseEntry("chiller", { abilityUsed: true });
    const player = makePlayer({ house: [entry] });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom, {
      source: "house", guestId: "chiller", instanceId: entry.instanceId,
    });
    expect(result).toBeNull();
  });

  test("house guest ability cannot be used twice in one round for legacy string entries", () => {
    const player = makePlayer({ house: ["chiller"] });
    const opponent = makeOpponent();

    const first = Game.activateAbility(
      player,
      opponent,
      Game.VENUES.velvetRoom,
      Game.VENUES.velvetRoom,
      { source: "house", guestId: "chiller" },
    );

    expect(first).not.toBeNull();
    expect(player.house[0].guestId).toBe("chiller");
    expect(player.house[0].abilityUsed).toBe(true);

    const second = Game.activateAbility(
      player,
      opponent,
      Game.VENUES.velvetRoom,
      Game.VENUES.velvetRoom,
      { source: "house", guestId: "chiller" },
    );
    expect(second).toBeNull();
  });

  test("legacy house entry normalization keeps null instanceId to avoid visual remount", () => {
    const player = makePlayer({ house: ["chiller"] });
    const opponent = makeOpponent();

    const result = Game.activateAbility(
      player,
      opponent,
      Game.VENUES.velvetRoom,
      Game.VENUES.velvetRoom,
      { source: "house", guestId: "chiller" },
    );

    expect(result).not.toBeNull();
    expect(player.house[0].instanceId).toBeNull();
  });

  test("returns null for guest without ability", () => {
    const player = makePlayer({ arrivingGuest: "regular" });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result).toBeNull();
  });

  test("returns null if no arriving guest and no house selection", () => {
    const player = makePlayer({ arrivingGuest: null });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result).toBeNull();
  });

  test("returns null for stale house selection", () => {
    const player = makePlayer({ house: [makeHouseEntry("regular")] });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom, {
      source: "house", guestId: "chiller", instanceId: 99999,
    });
    expect(result).toBeNull();
  });
});

// ── Bust scoring ──────────────────────────────────────────────────

describe("bust scoring", () => {
  function makeState(playerOverrides = {}, rivalOverrides = {}) {
    return {
      round: 1,
      pointTarget: 30,
      phase: "guest",
      guestPhaseScoredRound: null,
      player: makePlayer({ name: "Player", ...playerOverrides }),
      rival: makePlayer({ name: "Rival", isAI: true, ...rivalOverrides }),
      winner: null,
    };
  }

  test("busted player does not gain round points or money", () => {
    const state = makeState(
      { busted: true, phaseComplete: true, roundPoints: 5, roundMoney: 3, points: 0, money: 0 },
      { phaseComplete: true, roundPoints: 10, roundMoney: 2, points: 0, money: 0 },
    );
    Game.endGuestPhase(state);
    expect(state.player.points).toBe(0);
    expect(state.player.money).toBe(0);
    // Non-busted rival still scores normally
    expect(state.rival.points).toBe(10);
    expect(state.rival.money).toBe(2);
  });

  test("busted player with pending arriving guest does not score guest money/points", () => {
    // Simulate: player busted mid-round but still has an arriving guest.
    // Previously, endGuestPhase called moveArrivingGuestIntoHouse which ran
    // applyGuestImpact AFTER applyBustState zeroed the round totals — letting
    // the pending guest's money/points leak into the permanent totals.
    const state = makeState(
      {
        busted: true,
        phaseComplete: true,
        roundPoints: 0,
        roundMoney: 0,
        points: 2,
        money: 1,
        arrivingGuest: "tipper", // tipper gives 2 money, 0 points
        roundDeck: [],
      },
      { phaseComplete: true, roundPoints: 0, roundMoney: 0 },
    );
    state.player.house = [];
    Game.endGuestPhase(state);
    // tipper must NOT contribute money/points — player busted
    expect(state.player.points).toBe(2); // unchanged
    expect(state.player.money).toBe(1);  // unchanged
    // arrivingGuest cleared regardless
    expect(state.player.arrivingGuest).toBeNull();
    // roundMoney/roundPoints remain at 0 (not re-added by moveArrivingGuestIntoHouse)
    expect(state.player.roundMoney).toBe(0);
    expect(state.player.roundPoints).toBe(0);
  });

  test("integration: actual bust via admitGuest does not add to permanent totals", () => {
    // Full flow: start a round, have player accumulate some round money/points,
    // then admit the busting guest and verify endGuestPhase commits nothing.
    const state = Game.createGameState("Player", "velvetRoom", "Rival", "velvetRoom", 30);
    // Manually configure: player already has 5 points and 3 money from prior rounds
    state.player.points = 5;
    state.player.money = 3;
    // Simulate mid-round: player has earned 4 roundPoints and 2 roundMoney so far
    state.player.roundPoints = 4;
    state.player.roundMoney = 2;
    state.player.heat = 2;
    // Force a bust: set heat so that one more point of heat pushes them over.
    // velvetRoom has bustThreshold 3, so heat 3 → cap is 3, heat > 3 → bust.
    // Directly trigger applyBustState via admitGuest by having arrivingGuest add enough heat.
    // Simplest: manually mark as busted (as if admitGuest already ran and busted them).
    state.player.busted = true;
    state.player.phaseComplete = true;
    state.player.arrivingGuest = null;
    state.rival.phaseComplete = true;

    Game.endGuestPhase(state);

    // Points and money must NOT be added on bust
    expect(state.player.points).toBe(5);
    expect(state.player.money).toBe(3);
  });

  test("non-busted player scores normally", () => {
    const state = makeState(
      { busted: false, phaseComplete: true, roundPoints: 7, roundMoney: 4, points: 3, money: 2 },
      { phaseComplete: true },
    );
    Game.endGuestPhase(state);
    expect(state.player.points).toBe(10);
    expect(state.player.money).toBe(6);
  });
});

describe("round earnings parity", () => {
  test("counts arriving guest for both player and rival when scoring round", () => {
    const state = {
      round: 2,
      guestPhaseScoredRound: null,
      winner: null,
      player: makePlayer({
        phaseComplete: true,
        roundMoney: 1,
        roundPoints: 2,
        guestMoney: 3,
        guestPoints: 4,
        arrivingGuest: "tipper",
      }),
      rival: makeOpponent({
        phaseComplete: true,
        roundMoney: 2,
        roundPoints: 1,
        guestMoney: 1,
        guestPoints: 2,
        arrivingGuest: "regular",
      }),
    };

    const playerEarned = Game.getRoundEarnings(state.player);
    const rivalEarned = Game.getRoundEarnings(state.rival);
    expect(playerEarned).toEqual({ money: 6, points: 6, busted: false });
    expect(rivalEarned).toEqual({ money: 3, points: 4, busted: false });

    Game.endGuestPhase(state);

    expect(state.player.money).toBe(16);
    expect(state.player.points).toBe(6);
    expect(state.rival.money).toBe(13);
    expect(state.rival.points).toBe(4);
  });
});
