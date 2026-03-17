const Game = require('./game');

function makePlayer(overrides = {}) {
  return {
    name: 'TestPlayer',
    venueId: 'velvetRoom',
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
    arrivingBonusPoints: 0,
    arrivingCopiedAbility: null,
    pendingPlusOne: false,
    pendingMagnet: false,
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

describe('ability package registry', () => {
  test('includes required packages with fixed triggers', () => {
    expect(Game.ABILITY_PACKAGES.curate.trigger).toBe('flash');
    expect(Game.ABILITY_PACKAGES.plusOne.trigger).toBe('arrival');
    expect(Game.ABILITY_PACKAGES.score2.trigger).toBe('departure');
    expect(Game.ABILITY_PACKAGES.gain2Money.trigger).toBe('departure');
    expect(Game.ABILITY_PACKAGES.spike1.trigger).toBe('departure');
  });

  test('guest map uses package keys', () => {
    expect(Game.GUESTS.messyDrunk.ability.package).toBe('crashTheParty');
    expect(Game.GUESTS.wallflower.ability.package).toBe('cool1');
    expect(Game.GUESTS.highRoller.ability.package).toBe('gain2Money');
    expect(Game.GUESTS.chaosChaser.ability.package).toBe('spike1');
  });
});

describe('arrival packages', () => {
  test('PLUS ONE sets pendingPlusOne on arrival', () => {
    const player = makePlayer({ roundDeck: ['plusOnePrince'] });
    const opponent = makePlayer({ isAI: true });
    const drawRes = Game.drawNextGuest(player, Game.VENUES.velvetRoom, opponent);
    expect(drawRes.arrivalResult.effects).toContain('plus one triggered');
    expect(player.pendingPlusOne).toBe(true);
  });

  test('COOL 1 cools on arrival', () => {
    const player = makePlayer({ heat: 3, roundDeck: ['wallflower'] });
    const opponent = makePlayer({ isAI: true });
    const draw = Game.drawNextGuest(player, Game.VENUES.velvetRoom, opponent);
    expect(draw.arrivalResult.effects).toContain('cooled 1 heat');
    expect(player.heat).toBe(3);
  });
});

describe('departure packages', () => {
  test('SCORE 2 grants points on departure via boot', () => {
    const scorer = makeHouseEntry('storyPoster');
    const booter = makeHouseEntry('fedUpRoommate');
    const player = makePlayer({ house: [booter, scorer], heat: 2 });
    const opponent = makePlayer({ isAI: true });

    Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom, {
      source: 'house',
      guestId: 'fedUpRoommate',
      instanceId: booter.instanceId,
      targetInstanceId: scorer.instanceId,
    });

    expect(player.roundPoints).toBe(2);
  });

  test('GAIN 2 MONEY grants money on departure via boot', () => {
    const target = makeHouseEntry('highRoller');
    const booter = makeHouseEntry('fedUpRoommate');
    const player = makePlayer({ house: [booter, target], heat: 1 });
    const opponent = makePlayer({ isAI: true });

    Game.activateAbility(player, opponent, Game.VENUES.velvetRoom, Game.VENUES.velvetRoom, {
      source: 'house',
      guestId: 'fedUpRoommate',
      instanceId: booter.instanceId,
      targetInstanceId: target.instanceId,
    });

    expect(player.roundMoney).toBe(2);
  });
});

describe('no scoring families remain', () => {
  test('round scoring bonus events are empty (families removed)', () => {
    const player = makePlayer({ house: [makeHouseEntry('highRoller'), makeHouseEntry('wallflower')] });
    const events = Game.getRoundScoringBonusEvents(player, Game.VENUES.nightMarket);
    expect(events).toEqual([]);
  });
});
