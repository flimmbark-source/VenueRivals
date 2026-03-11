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

// ── revealNext (Door Watcher: PEEK 1) ─────────────────────────────

describe("revealNext ability", () => {
  test("reveals 1 guest (doorWatcher Check the Line)", () => {
    const player = makePlayer({
      arrivingGuest: "doorWatcher",
      roundDeck: ["familiarFace", "loudFriend", "bottleBringer"],
    });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result).not.toBeNull();
    expect(result.revealedGuests).toHaveLength(1);
    expect(result.revealedGuests[0]).toBe("bottleBringer");
  });

  test("handles empty deck gracefully", () => {
    const player = makePlayer({ arrivingGuest: "doorWatcher", roundDeck: [] });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result.effects).toContain("queue empty");
  });
});

// ── stackChoice (Window Watcher: CURATE) ──────────────────────────

describe("stackChoice ability", () => {
  test("reveals 2 guests and sets needsStackChoice (windowWatcher Curate)", () => {
    const player = makePlayer({
      arrivingGuest: "windowWatcher",
      roundDeck: ["familiarFace", "loudFriend"],
    });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result).not.toBeNull();
    expect(result.revealedGuests).toHaveLength(2);
    expect(result.needsStackChoice).toBe(true);
  });

  test("handles single card in deck", () => {
    const player = makePlayer({
      arrivingGuest: "windowWatcher",
      roundDeck: ["familiarFace"],
    });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result.revealedGuests).toHaveLength(1);
    expect(result.needsStackChoice).toBeUndefined();
  });

  test("handles empty deck", () => {
    const player = makePlayer({ arrivingGuest: "windowWatcher", roundDeck: [] });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result).not.toBeNull();
    expect(result.revealedGuests).toBeUndefined();
  });
});

// ── resolveStackChoice ────────────────────────────────────────────

describe("resolveStackChoice", () => {
  test("reorders top 2 so chosen card is drawn next", () => {
    const player = makePlayer({ roundDeck: ["a", "b", "c"] });
    const ok = Game.resolveStackChoice(player, "b");
    expect(ok).toBe(true);
    expect(player.roundDeck[player.roundDeck.length - 1]).toBe("b");
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

// ── bounce with choice targeting (Porch Buddy) ───────────────────

describe("bounce ability (choice targeting)", () => {
  test("returns needsTargetChoice when no target provided", () => {
    const entry = makeHouseEntry("familiarFace");
    const activator = makeHouseEntry("porchBuddy");
    const player = makePlayer({ house: [activator, entry] });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom, {
      source: "house", guestId: "porchBuddy", instanceId: activator.instanceId,
    });
    expect(result).not.toBeNull();
    expect(result.needsTargetChoice).toBe(true);
    expect(activator.abilityUsed).toBe(false); // Not marked used yet
  });

  test("bounces target when targetInstanceId provided", () => {
    const target = makeHouseEntry("familiarFace");
    const activator = makeHouseEntry("porchBuddy");
    const player = makePlayer({
      house: [activator, target],
      roundDeck: ["bottleBringer"],
    });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom, {
      source: "house", guestId: "porchBuddy", instanceId: activator.instanceId,
      targetInstanceId: target.instanceId,
    });
    expect(result).not.toBeNull();
    expect(player.house).toHaveLength(1);
    expect(player.roundDeck[0]).toBe("familiarFace");
    expect(activator.abilityUsed).toBe(true);
  });

  test("no-op when house is empty", () => {
    const player = makePlayer({ arrivingGuest: "porchBuddy", house: [] });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result.effects).toContain("no valid target");
  });
});

// ── boot with choice targeting (Fed-Up Roommate) ─────────────────

describe("boot ability (choice targeting)", () => {
  test("returns needsTargetChoice when no target provided", () => {
    const entry = makeHouseEntry("familiarFace");
    const activator = makeHouseEntry("fedUpRoommate");
    const player = makePlayer({ house: [activator, entry] });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom, {
      source: "house", guestId: "fedUpRoommate", instanceId: activator.instanceId,
    });
    expect(result).not.toBeNull();
    expect(result.needsTargetChoice).toBe(true);
  });

  test("boots target when targetInstanceId provided", () => {
    const target = makeHouseEntry("familiarFace");
    const activator = makeHouseEntry("fedUpRoommate");
    const player = makePlayer({ house: [activator, target] });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom, {
      source: "house", guestId: "fedUpRoommate", instanceId: activator.instanceId,
      targetInstanceId: target.instanceId,
    });
    expect(result).not.toBeNull();
    expect(result.pushedOut).toBe("familiarFace");
    expect(player.house).toHaveLength(1);
  });
});

// ── clearHouse (Reset Host: LAST CALL) ───────────────────────────

describe("clearHouse ability", () => {
  test("clears all guests from house", () => {
    const activator = makeHouseEntry("resetHost");
    const player = makePlayer({
      house: [activator, makeHouseEntry("familiarFace"), makeHouseEntry("loudFriend")],
    });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom, {
      source: "house", guestId: "resetHost", instanceId: activator.instanceId,
    });
    expect(result).not.toBeNull();
    expect(player.house).toHaveLength(0);
    expect(result.effects[0]).toMatch(/cleared 3 guests/);
  });

  test("handles already empty house", () => {
    const player = makePlayer({ arrivingGuest: "resetHost", house: [] });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result.effects).toContain("house already empty");
  });
});

// ── scoreGuest (Story Poster: SNAPSHOT / Party Photographer) ─────

describe("scoreGuest ability", () => {
  test("returns needsTargetChoice when no target", () => {
    const activator = makeHouseEntry("storyPoster");
    const target = makeHouseEntry("familiarFace");
    const player = makePlayer({ house: [activator, target] });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom, {
      source: "house", guestId: "storyPoster", instanceId: activator.instanceId,
    });
    expect(result.needsTargetChoice).toBe(true);
  });

  test("scores target guest's points and money", () => {
    const activator = makeHouseEntry("storyPoster");
    const target = makeHouseEntry("loudFriend"); // loudFriend has 1 point, 1 money
    const player = makePlayer({ house: [activator, target], roundPoints: 0, roundMoney: 0 });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom, {
      source: "house", guestId: "storyPoster", instanceId: activator.instanceId,
      targetInstanceId: target.instanceId,
    });
    expect(player.roundPoints).toBe(1); // loudFriend's base points
    expect(player.roundMoney).toBe(1); // loudFriend's base money
    expect(result.effects[0]).toMatch(/scored 1 points and 1 money from Loud Friend/);
  });
});

// ── refreshAction (Dance Captain: SECOND WIND) ──────────────────

describe("refreshAction ability", () => {
  test("refreshes a used action", () => {
    const activator = makeHouseEntry("danceCaptain");
    const target = makeHouseEntry("doorWatcher", { abilityUsed: true });
    const player = makePlayer({ house: [activator, target] });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom, {
      source: "house", guestId: "danceCaptain", instanceId: activator.instanceId,
      targetInstanceId: target.instanceId,
    });
    expect(target.abilityUsed).toBe(false);
    expect(result.effects[0]).toMatch(/refreshed/);
  });
});

// ── refreshAllActions (Hype Squad: HYPE CREW) ───────────────────

describe("refreshAllActions ability", () => {
  test("refreshes all other used actions", () => {
    const activator = makeHouseEntry("hypeSquad");
    const a = makeHouseEntry("doorWatcher", { abilityUsed: true });
    const b = makeHouseEntry("windowWatcher", { abilityUsed: true });
    const player = makePlayer({ house: [activator, a, b] });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom, {
      source: "house", guestId: "hypeSquad", instanceId: activator.instanceId,
    });
    expect(a.abilityUsed).toBe(false);
    expect(b.abilityUsed).toBe(false);
    expect(result.effects[0]).toMatch(/refreshed 2 actions/);
  });

  test("does not refresh self", () => {
    const activator = makeHouseEntry("hypeSquad", { abilityUsed: false });
    const player = makePlayer({ house: [activator] });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom, {
      source: "house", guestId: "hypeSquad", instanceId: activator.instanceId,
    });
    expect(result.effects).toContain("no actions to refresh");
  });
});

// ── opponentStackChoice (Rumor Queen: RUMOR MILL) ────────────────

describe("opponentStackChoice ability", () => {
  test("reveals opponent's top 2 guests", () => {
    const activator = makeHouseEntry("rumorQueen");
    const player = makePlayer({ house: [activator] });
    const opponent = makeOpponent({ roundDeck: ["familiarFace", "loudFriend"] });
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom, {
      source: "house", guestId: "rumorQueen", instanceId: activator.instanceId,
    });
    expect(result).not.toBeNull();
    expect(result.revealedGuests).toHaveLength(2);
    expect(result.needsOpponentStackChoice).toBe(true);
  });

  test("handles empty opponent queue", () => {
    const activator = makeHouseEntry("rumorQueen");
    const player = makePlayer({ house: [activator] });
    const opponent = makeOpponent({ roundDeck: [] });
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom, {
      source: "house", guestId: "rumorQueen", instanceId: activator.instanceId,
    });
    expect(result.effects).toContain("opponent's queue is empty");
  });
});

// ── setHeatZero (Counselor) ──────────────────────────────────────

describe("setHeatZero ability", () => {
  test("sets heat to 0", () => {
    const activator = makeHouseEntry("counselor");
    const player = makePlayer({ heat: 5, house: [activator] });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom, {
      source: "house", guestId: "counselor", instanceId: activator.instanceId,
    });
    expect(player.heat).toBe(0);
    expect(result.effects).toContain("cooled 5 heat");
  });
});

// ── bootAdjacent (Cupid) ─────────────────────────────────────────

describe("bootAdjacent ability", () => {
  test("boots both adjacent guests", () => {
    const left = makeHouseEntry("familiarFace");
    const activator = makeHouseEntry("cupid");
    const right = makeHouseEntry("loudFriend");
    const player = makePlayer({ house: [left, activator, right] });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom, {
      source: "house", guestId: "cupid", instanceId: activator.instanceId,
    });
    expect(player.house).toHaveLength(1);
    expect(player.house[0].guestId).toBe("cupid");
    expect(result.effects[0]).toMatch(/booted 2 adjacent/);
  });

  test("boots 1 when at edge", () => {
    const activator = makeHouseEntry("cupid");
    const neighbor = makeHouseEntry("familiarFace");
    const player = makePlayer({ house: [activator, neighbor] });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom, {
      source: "house", guestId: "cupid", instanceId: activator.instanceId,
    });
    expect(player.house).toHaveLength(1);
    expect(result.effects[0]).toMatch(/booted 1 adjacent/);
  });
});

// ── nameDrop (VIP Wrangler: VIP LIST as action) ──────────────────

describe("nameDrop ability (action)", () => {
  test("reveals 3 guests and sets needsNameDropChoice", () => {
    const player = makePlayer({
      arrivingGuest: "vipWrangler",
      roundDeck: ["familiarFace", "loudFriend", "bottleBringer"],
    });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result).not.toBeNull();
    expect(result.revealedGuests).toHaveLength(3);
    expect(result.needsNameDropChoice).toBe(true);
  });
});

// ── Arrival abilities ────────────────────────────────────────────

describe("arrival: scoreNow (Main Character)", () => {
  test("scores 2 points on admission", () => {
    const player = makePlayer({
      arrivingGuest: "mainCharacter",
      roundDeck: ["familiarFace"],
      roundPoints: 0,
    });
    const opponent = makeOpponent();
    const venue = Game.VENUES.velvetRoom;
    const result = Game.admitGuest(player, venue, opponent, venue);
    expect(result).not.toBeNull();
    expect(result.admitted).toBe("mainCharacter");
    expect(player.roundPoints).toBe(2);
    expect(result.effects).toContain("scored 2 points on arrival");
  });
});

describe("arrival: queueGatecrasher (Address Leaker)", () => {
  test("plants gatecrasher on opponent's queue", () => {
    const player = makePlayer({
      arrivingGuest: "addressLeaker",
      roundDeck: ["familiarFace"],
    });
    const opponent = makeOpponent({ roundDeck: ["familiarFace"] });
    const venue = Game.VENUES.velvetRoom;
    const result = Game.admitGuest(player, venue, opponent, venue);
    expect(result).not.toBeNull();
    expect(opponent.roundDeck).toContain("gatecrasher");
    expect(result.effects).toContain("planted gatecrasher on opponent's queue");
  });
});

describe("arrival: plusOne (Plus-One Prince)", () => {
  test("auto-admits the next guest", () => {
    const player = makePlayer({
      arrivingGuest: "plusOnePrince",
      roundDeck: ["familiarFace", "loudFriend"],
    });
    const opponent = makeOpponent();
    const venue = Game.VENUES.velvetRoom;
    const result = Game.admitGuest(player, venue, opponent, venue);
    expect(result).not.toBeNull();
    expect(result.autoAdmitted).not.toBeNull();
    // Plus-One Prince entered, then the next guest was auto-admitted
    expect(result.autoAdmitted.admitted).toBeDefined();
  });
});

describe("arrival: socialClimber", () => {
  test("gains +1 bonusPoints on entry", () => {
    const player = makePlayer({
      arrivingGuest: "socialClimber",
      roundDeck: ["familiarFace"],
    });
    const opponent = makeOpponent();
    const venue = Game.VENUES.velvetRoom;
    const result = Game.admitGuest(player, venue, opponent, venue);
    expect(result).not.toBeNull();
    const entry = player.house.find(e => typeof e !== "string" && e.guestId === "socialClimber");
    expect(entry.bonusPoints).toBe(1);
  });
});

describe("arrival: stackChoice (Group Chat Host)", () => {
  test("reveals 2 and sets needsStackChoice on admission", () => {
    const player = makePlayer({
      arrivingGuest: "groupChatHost",
      roundDeck: ["familiarFace", "loudFriend", "bottleBringer"],
    });
    const opponent = makeOpponent();
    const venue = Game.VENUES.velvetRoom;
    const result = Game.admitGuest(player, venue, opponent, venue);
    expect(result).not.toBeNull();
    expect(result.needsStackChoice).toBe(true);
    expect(result.revealedGuests).toHaveLength(2);
  });
});

describe("arrival: impersonator (Social Butterfly)", () => {
  test("copies action ability of guest to the left", () => {
    // Set up house: doorWatcher is already in house at position 0
    // Social Butterfly will enter at position 0, pushing doorWatcher to 1
    const player = makePlayer({
      arrivingGuest: "socialButterfly",
      house: [makeHouseEntry("doorWatcher")],
      roundDeck: ["familiarFace"],
    });
    const opponent = makeOpponent();
    const venue = Game.VENUES.velvetRoom;
    const result = Game.admitGuest(player, venue, opponent, venue);
    expect(result).not.toBeNull();
    // Social Butterfly should have copied doorWatcher's revealNext ability
    const butterflyEntry = player.house.find(e => typeof e !== "string" && e.guestId === "socialButterfly");
    expect(butterflyEntry.copiedAbility).toBeDefined();
    expect(butterflyEntry.copiedAbility.type).toBe("revealNext");
  });
});

// ── Departure abilities ──────────────────────────────────────────

describe("departure: scoreNow (Afterparty Host)", () => {
  test("scores 2 on departure when booted", () => {
    const activator = makeHouseEntry("fedUpRoommate");
    const target = makeHouseEntry("afterpartyHost");
    const player = makePlayer({ house: [activator, target], roundPoints: 0 });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom, {
      source: "house", guestId: "fedUpRoommate", instanceId: activator.instanceId,
      targetInstanceId: target.instanceId,
    });
    expect(player.roundPoints).toBe(2);
    expect(result.effects).toEqual(expect.arrayContaining([
      expect.stringContaining("departure: scored 2 points"),
    ]));
  });
});

describe("departure: gainMoney (Tab Runner)", () => {
  test("gains 2 money on departure", () => {
    const activator = makeHouseEntry("fedUpRoommate");
    const target = makeHouseEntry("tabRunner");
    const player = makePlayer({ house: [activator, target], roundMoney: 0 });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom, {
      source: "house", guestId: "fedUpRoommate", instanceId: activator.instanceId,
      targetInstanceId: target.instanceId,
    });
    expect(player.roundMoney).toBe(2);
  });
});

describe("departure: coolHeat (Cool-Off Smoker)", () => {
  test("cools 1 heat on departure", () => {
    const activator = makeHouseEntry("fedUpRoommate");
    const target = makeHouseEntry("coolOffSmoker");
    const player = makePlayer({ house: [activator, target], heat: 3 });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom, {
      source: "house", guestId: "fedUpRoommate", instanceId: activator.instanceId,
      targetInstanceId: target.instanceId,
    });
    expect(player.heat).toBe(2);
  });
});

describe("departure: queueGatecrasher (Messy Drunk)", () => {
  test("plants gatecrasher on opponent when messy drunk is booted", () => {
    const activator = makeHouseEntry("fedUpRoommate");
    const target = makeHouseEntry("messyDrunk");
    const player = makePlayer({ house: [activator, target] });
    const opponent = makeOpponent({ roundDeck: ["familiarFace"] });
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom, {
      source: "house", guestId: "fedUpRoommate", instanceId: activator.instanceId,
      targetInstanceId: target.instanceId,
    });
    expect(opponent.roundDeck).toContain("gatecrasher");
  });
});

describe("departure: addOpponentHeat (Drama Starter)", () => {
  test("spikes 1 heat to opponent on departure", () => {
    const activator = makeHouseEntry("fedUpRoommate");
    const target = makeHouseEntry("dramaStarter");
    const player = makePlayer({ house: [activator, target] });
    const opponent = makeOpponent({ heat: 1 });
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom, {
      source: "house", guestId: "fedUpRoommate", instanceId: activator.instanceId,
      targetInstanceId: target.instanceId,
    });
    expect(opponent.heat).toBe(2);
  });
});

// ── Scoring abilities ────────────────────────────────────────────

describe("scoring: wallflower", () => {
  test("+1 per empty slot at scoring", () => {
    // velvetRoom gridSize 3, capacity 3. 1 guest -> 2 empty slots -> +2 bonus
    const state = {
      round: 1, pointTarget: 50, phase: "guest", guestPhaseScoredRound: null,
      player: makePlayer({
        phaseComplete: true,
        house: [makeHouseEntry("wallflower")],
        roundPoints: 0, roundMoney: 0, guestMoney: 0, guestPoints: 1, // wallflower base
      }),
      rival: makePlayer({ name: "Rival", isAI: true, phaseComplete: true }),
      winner: null,
    };
    Game.endGuestPhase(state);
    // 1 base + 2 wallflower bonus = 3
    expect(state.player.points).toBe(3);
  });
});

describe("scoring: clique (Link-Up Friend)", () => {
  test("+1 per adjacent sharing a tag", () => {
    // linkUpFriend tags: VIP, Broker. familiarFace tags: VIP -> shares VIP
    const state = {
      round: 1, pointTarget: 50, phase: "guest", guestPhaseScoredRound: null,
      player: makePlayer({
        phaseComplete: true,
        house: [makeHouseEntry("familiarFace"), makeHouseEntry("linkUpFriend")],
        roundPoints: 0, roundMoney: 0, guestMoney: 0, guestPoints: 2, // 1 + 1 base
      }),
      rival: makePlayer({ name: "Rival", isAI: true, phaseComplete: true }),
      winner: null,
    };
    Game.endGuestPhase(state);
    // 2 base + 1 clique bonus = 3
    expect(state.player.points).toBe(3);
  });
});

describe("scoring: centerOfAttention (Headliner)", () => {
  test("+2 if newest (index 0)", () => {
    const state = {
      round: 1, pointTarget: 50, phase: "guest", guestPhaseScoredRound: null,
      player: makePlayer({
        phaseComplete: true,
        house: [makeHouseEntry("headliner"), makeHouseEntry("familiarFace")],
        roundPoints: 0, roundMoney: 0, guestMoney: 0, guestPoints: 3, // 2 + 1 base
      }),
      rival: makePlayer({ name: "Rival", isAI: true, phaseComplete: true }),
      winner: null,
    };
    Game.endGuestPhase(state);
    // 3 base + 2 center bonus = 5
    expect(state.player.points).toBe(5);
  });

  test("no bonus if not newest", () => {
    const state = {
      round: 1, pointTarget: 50, phase: "guest", guestPhaseScoredRound: null,
      player: makePlayer({
        phaseComplete: true,
        house: [makeHouseEntry("familiarFace"), makeHouseEntry("headliner")],
        roundPoints: 0, roundMoney: 0, guestMoney: 0, guestPoints: 3, // 1 + 2 base
      }),
      rival: makePlayer({ name: "Rival", isAI: true, phaseComplete: true }),
      winner: null,
    };
    Game.endGuestPhase(state);
    // 3 base + 0 bonus = 3
    expect(state.player.points).toBe(3);
  });
});

describe("scoring: packedHouse (Big Planner)", () => {
  test("+4 if house is full", () => {
    // velvetRoom gridSize 3
    const state = {
      round: 1, pointTarget: 50, phase: "guest", guestPhaseScoredRound: null,
      player: makePlayer({
        phaseComplete: true,
        house: [makeHouseEntry("bigPlanner"), makeHouseEntry("familiarFace"), makeHouseEntry("loudFriend")],
        roundPoints: 0, roundMoney: 0, guestMoney: 0, guestPoints: 4, // 2 + 1 + 1 base
      }),
      rival: makePlayer({ name: "Rival", isAI: true, phaseComplete: true }),
      winner: null,
    };
    Game.endGuestPhase(state);
    // 4 base + 4 packed house bonus = 8
    expect(state.player.points).toBe(8);
  });

  test("no bonus if house not full", () => {
    const state = {
      round: 1, pointTarget: 50, phase: "guest", guestPhaseScoredRound: null,
      player: makePlayer({
        phaseComplete: true,
        house: [makeHouseEntry("bigPlanner"), makeHouseEntry("familiarFace")],
        roundPoints: 0, roundMoney: 0, guestMoney: 0, guestPoints: 3, // 2 + 1 base
      }),
      rival: makePlayer({ name: "Rival", isAI: true, phaseComplete: true }),
      winner: null,
    };
    Game.endGuestPhase(state);
    // 3 base + 0 bonus = 3
    expect(state.player.points).toBe(3);
  });
});

describe("scoring: highRoller", () => {
  test("+1 per 2 money", () => {
    const state = {
      round: 1, pointTarget: 50, phase: "guest", guestPhaseScoredRound: null,
      player: makePlayer({
        phaseComplete: true,
        money: 6,
        house: [makeHouseEntry("highRoller")],
        roundPoints: 0, roundMoney: 0, guestMoney: 1, guestPoints: 2, // highRoller: 1 money, 2 pts base
      }),
      rival: makePlayer({ name: "Rival", isAI: true, phaseComplete: true }),
      winner: null,
    };
    Game.endGuestPhase(state);
    // totalMoney = 0 + 1 + 6 = 7, floor(7/2) = 3
    // 2 base + 3 highRoller bonus = 5
    expect(state.player.points).toBe(5);
  });
});

describe("scoring: chaosChaser", () => {
  test("+1 per heat", () => {
    const state = {
      round: 1, pointTarget: 50, phase: "guest", guestPhaseScoredRound: null,
      player: makePlayer({
        phaseComplete: true,
        heat: 3,
        house: [makeHouseEntry("chaosChaser")],
        roundPoints: 0, roundMoney: 0, guestMoney: 0, guestPoints: 2, // 2 base
      }),
      rival: makePlayer({ name: "Rival", isAI: true, phaseComplete: true }),
      winner: null,
    };
    Game.endGuestPhase(state);
    // 2 base + 3 chaos bonus = 5
    expect(state.player.points).toBe(5);
  });
});

describe("scoring: lastToLeave (Late Legend)", () => {
  test("+2 if oldest (last index)", () => {
    const state = {
      round: 1, pointTarget: 50, phase: "guest", guestPhaseScoredRound: null,
      player: makePlayer({
        phaseComplete: true,
        house: [makeHouseEntry("familiarFace"), makeHouseEntry("lateLegend")],
        roundPoints: 0, roundMoney: 0, guestMoney: 0, guestPoints: 3, // 1 + 2 base
      }),
      rival: makePlayer({ name: "Rival", isAI: true, phaseComplete: true }),
      winner: null,
    };
    Game.endGuestPhase(state);
    // 3 base + 2 lastToLeave bonus = 5
    expect(state.player.points).toBe(5);
  });

  test("no bonus if not oldest", () => {
    const state = {
      round: 1, pointTarget: 50, phase: "guest", guestPhaseScoredRound: null,
      player: makePlayer({
        phaseComplete: true,
        house: [makeHouseEntry("lateLegend"), makeHouseEntry("familiarFace")],
        roundPoints: 0, roundMoney: 0, guestMoney: 0, guestPoints: 3, // 2 + 1 base
      }),
      rival: makePlayer({ name: "Rival", isAI: true, phaseComplete: true }),
      winner: null,
    };
    Game.endGuestPhase(state);
    // 3 base + 0 bonus = 3
    expect(state.player.points).toBe(3);
  });
});

// ── General activation guards ─────────────────────────────────────

describe("activateAbility guards", () => {
  test("returns null if door is closed", () => {
    const player = makePlayer({ arrivingGuest: "doorWatcher", doorClosed: true });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result).toBeNull();
  });

  test("returns null if busted", () => {
    const player = makePlayer({ arrivingGuest: "doorWatcher", busted: true });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result).toBeNull();
  });

  test("returns null if ability already used (arriving)", () => {
    const player = makePlayer({ arrivingGuest: "doorWatcher", arrivingAbilityUsed: true });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom);
    expect(result).toBeNull();
  });

  test("returns null if ability already used (house)", () => {
    const entry = makeHouseEntry("doorWatcher", { abilityUsed: true });
    const player = makePlayer({ house: [entry] });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom, {
      source: "house", guestId: "doorWatcher", instanceId: entry.instanceId,
    });
    expect(result).toBeNull();
  });

  test("house guest ability cannot be used twice", () => {
    const player = makePlayer({ house: ["doorWatcher"] });
    const opponent = makeOpponent();

    const first = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom,
      { source: "house", guestId: "doorWatcher" },
    );
    expect(first).not.toBeNull();
    expect(player.house[0].abilityUsed).toBe(true);

    const second = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom,
      { source: "house", guestId: "doorWatcher" },
    );
    expect(second).toBeNull();
  });

  test("returns null for guest without ability", () => {
    const player = makePlayer({ arrivingGuest: "familiarFace" });
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
    const player = makePlayer({ house: [makeHouseEntry("familiarFace")] });
    const opponent = makeOpponent();
    const result = Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom, {
      source: "house", guestId: "doorWatcher", instanceId: 99999,
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
    expect(state.rival.points).toBe(10);
    expect(state.rival.money).toBe(2);
  });

  test("busted player with pending arriving guest does not score", () => {
    const state = makeState(
      {
        busted: true, phaseComplete: true,
        roundPoints: 0, roundMoney: 0, points: 2, money: 1,
        arrivingGuest: "bottleBringer", roundDeck: [],
      },
      { phaseComplete: true, roundPoints: 0, roundMoney: 0 },
    );
    state.player.house = [];
    Game.endGuestPhase(state);
    expect(state.player.points).toBe(2);
    expect(state.player.money).toBe(1);
    expect(state.player.arrivingGuest).toBeNull();
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
        roundMoney: 1, roundPoints: 2,
        guestMoney: 3, guestPoints: 4,
        arrivingGuest: "bottleBringer",
      }),
      rival: makeOpponent({
        phaseComplete: true,
        roundMoney: 2, roundPoints: 1,
        guestMoney: 1, guestPoints: 2,
        arrivingGuest: "familiarFace",
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
