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
    const player = makePlayer({ heat: 3, roundDeck: ['coolOffSmoker'] });
    const opponent = makePlayer({ isAI: true });
    const draw = Game.drawNextGuest(player, Game.VENUES.nightMarket, opponent);
    expect(draw.arrivalResult.effects).toContain('cooled 1 heat');
    expect(player.heat).toBe(2);
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


describe('ability package roster differentiation', () => {
  test('guests sharing a package have distinct stat+cost profiles', () => {
    const grouped = {};

    Object.entries(Game.GUESTS).forEach(([guestId, guest]) => {
      const pkg = guest?.ability?.package;
      if (!pkg) return;
      grouped[pkg] = grouped[pkg] || [];
      grouped[pkg].push({
        guestId,
        cost: guest.cost,
        profile: `${guest.heat}/${guest.money}/${guest.points}/${guest.cost}`,
      });
    });

    Object.values(grouped)
      .filter((entries) => entries.length > 1)
      .forEach((entries) => {
        const costs = new Set(entries.map((entry) => entry.cost));
        const profiles = new Set(entries.map((entry) => entry.profile));

        expect(costs.size).toBe(entries.length);
        expect(profiles.size).toBe(entries.length);
      });
  });
});


describe('ability text fidelity', () => {
  test('CURATE reveals next guests for ordering', () => {
    const curator = makeHouseEntry('doorWatcher');
    const player = makePlayer({ house: [curator], roundDeck: ['familiarFace', 'loudFriend'] });
    const opponent = makePlayer({ isAI: true });

    const result = Game.activateAbility(player, opponent, Game.VENUES.neutral, Game.VENUES.neutral, {
      source: 'house',
      guestId: 'doorWatcher',
      instanceId: curator.instanceId,
    });

    expect(result.needsStackChoice).toBe(true);
    expect(result.revealedGuests.length).toBe(2);
  });

  test('BOUNCE returns selected guest to top of queue', () => {
    const bouncer = makeHouseEntry('porchBuddy');
    const target = makeHouseEntry('familiarFace');
    const player = makePlayer({ house: [bouncer, target], heat: Game.GUESTS.familiarFace.heat });
    const opponent = makePlayer({ isAI: true });

    const result = Game.activateAbility(player, opponent, Game.VENUES.neutral, Game.VENUES.neutral, {
      source: 'house',
      guestId: 'porchBuddy',
      instanceId: bouncer.instanceId,
      targetInstanceId: target.instanceId,
    });

    expect(result.effects.some((e) => e.includes('bounced Familiar Face'))).toBe(true);
    expect(player.roundDeck[0]).toBe('familiarFace');
    expect(player.house.find((e) => e.instanceId === target.instanceId)).toBeUndefined();
  });

  test('CRASH THE PARTY plants a gatecrasher in opponent queue', () => {
    const crasher = makeHouseEntry('addressLeaker');
    const player = makePlayer({ house: [crasher] });
    const opponent = makePlayer({ isAI: true, roundDeck: ['familiarFace'] });

    Game.activateAbility(player, opponent, Game.VENUES.backAlley, Game.VENUES.neutral, {
      source: 'house',
      guestId: 'addressLeaker',
      instanceId: crasher.instanceId,
    });

    expect(opponent.roundDeck[opponent.roundDeck.length - 1]).toBe('gatecrasher');
  });

  test('SPIKE 1 adds heat to opponent on departure', () => {
    const booter = makeHouseEntry('fedUpRoommate');
    const spiker = makeHouseEntry('chaosChaser');
    const player = makePlayer({ house: [booter, spiker], heat: 4 });
    const opponent = makePlayer({ isAI: true, heat: 0 });

    Game.activateAbility(player, opponent, Game.VENUES.backAlley, Game.VENUES.neutral, {
      source: 'house',
      guestId: 'fedUpRoommate',
      instanceId: booter.instanceId,
      targetInstanceId: spiker.instanceId,
    });

    expect(opponent.heat).toBe(1);
  });

  test('IMPERSONATOR copies the left guest active action on arrival', () => {
    const leftGuest = makeHouseEntry('wingMan');
    const player = makePlayer({ house: [leftGuest], roundDeck: ['socialButterfly'] });
    const opponent = makePlayer({ isAI: true });

    const draw = Game.drawNextGuest(player, Game.VENUES.nightMarket, opponent);

    expect(draw.arrivalResult.effects.some((e) => e.includes('copied NUDGE'))).toBe(true);
    expect(player.arrivingCopiedAbility?.effectType).toBe('nudge');
  });

  test('SOCIAL CLIMBER grants permanent bonus point counter on arrival', () => {
    const player = makePlayer({ roundDeck: ['socialClimber'] });
    const opponent = makePlayer({ isAI: true });

    const draw = Game.drawNextGuest(player, Game.VENUES.velvetRoom, opponent);

    expect(draw.arrivalResult.effects.some((e) => e.includes('social climber: +1 permanent points'))).toBe(true);
    expect(player.arrivingBonusPoints).toBe(1);
  });

  test('REFRESH can only refresh another used active guest', () => {
    const buildScenario = () => {
      const refresher = makeHouseEntry('danceCaptain');
      const usedActive = makeHouseEntry('wingMan', { abilityUsed: true });
      const usedAutomatic = makeHouseEntry('wallflower', { abilityUsed: true });
      return {
        refresher,
        usedActive,
        usedAutomatic,
        player: makePlayer({ house: [refresher, usedActive, usedAutomatic] }),
      };
    };

    const selfCase = buildScenario();
    const selfAttempt = Game.activateAbility(selfCase.player, makePlayer({ isAI: true }), Game.VENUES.velvetRoom, Game.VENUES.neutral, {
      source: 'house',
      guestId: 'danceCaptain',
      instanceId: selfCase.refresher.instanceId,
      targetInstanceId: selfCase.refresher.instanceId,
    });
    expect(selfAttempt.effects).toContain('cannot refresh self');

    const automaticCase = buildScenario();
    const automaticAttempt = Game.activateAbility(automaticCase.player, makePlayer({ isAI: true }), Game.VENUES.velvetRoom, Game.VENUES.neutral, {
      source: 'house',
      guestId: 'danceCaptain',
      instanceId: automaticCase.refresher.instanceId,
      targetInstanceId: automaticCase.usedAutomatic.instanceId,
    });
    expect(automaticAttempt.effects).toContain('target cannot be refreshed');

    const validCase = buildScenario();
    const validAttempt = Game.activateAbility(validCase.player, makePlayer({ isAI: true }), Game.VENUES.velvetRoom, Game.VENUES.neutral, {
      source: 'house',
      guestId: 'danceCaptain',
      instanceId: validCase.refresher.instanceId,
      targetInstanceId: validCase.usedActive.instanceId,
    });
    expect(validAttempt.effects.some((e) => e.includes('refreshed Wingman'))).toBe(true);
    expect(validCase.usedActive.abilityUsed).toBe(false);
  });
});
