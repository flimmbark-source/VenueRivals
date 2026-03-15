const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Game = require('./game');

function loadAI() {
  const aiPath = path.join(__dirname, 'ai.js');
  const source = `${fs.readFileSync(aiPath, 'utf8')}\n;globalThis.__TEST_AI__ = AI;`;
  const context = {
    Game,
    Math,
    console,
    globalThis: {},
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'ai.js' });
  return context.__TEST_AI__;
}

function makeRival(overrides = {}) {
  return {
    venueId: 'velvetRoom',
    fullDeck: ['familiarFace', 'loudFriend'],
    money: 10,
    shopItemPurchases: { slotIncrease: 0, heatCapIncrease: 0 },
    slotIncrease: 0,
    heatCapBonus: 0,
    ...overrides,
  };
}

describe('AI buy phase Monte Carlo ranking', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('reuses one Monte Carlo score per guest when ranking and selecting', () => {
    const AI = loadAI();
    const state = { rival: makeRival() };
    const market = ['bottleBringer', 'familiarFace', 'loudFriend'];

    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.42);

    AI.decideBuyPhaseActions(state, market);

    // 3 market guests * 200 runs * (sampledDeck length 3 -> 2 random draws per shuffle)
    expect(randomSpy).toHaveBeenCalledTimes(1200);
  });

  test('produces deterministic buy ranking for a fixed random stream', () => {
    const AI = loadAI();
    const state = { rival: makeRival({ money: 7 }) };
    const market = ['bigPlanner', 'familiarFace', 'loudFriend', 'bottleBringer'];

    const randomSequence = [0.13, 0.77, 0.41, 0.95, 0.22, 0.68];
    let index = 0;
    jest.spyOn(Math, 'random').mockImplementation(() => {
      const value = randomSequence[index % randomSequence.length];
      index += 1;
      return value;
    });

    const first = AI.decideBuyPhaseActions(state, market);

    index = 0;
    const second = AI.decideBuyPhaseActions(state, market);

    expect(second).toEqual(first);
  });
});


function makeDoorState(overrides = {}) {
  return {
    rival: {
      venueId: 'velvetRoom',
      doorClosed: false,
      busted: false,
      heat: 2,
      roundMoney: 3,
      roundPoints: 1,
      roundDeck: ['familiarFace', 'loudFriend', 'bottleBringer'],
      arrivingGuest: 'bigSpender',
      arrivingAbilityUsed: false,
      house: [],
      ...makeRival(),
      ...overrides.rival,
    },
    player: {
      venueId: 'velvetRoom',
      doorClosed: false,
      busted: false,
      heat: 1,
      roundDeck: ['familiarFace', 'loudFriend'],
      house: [],
      ...overrides.player,
    },
  };
}

function buildLegacyDoorDecision(state) {
  const MONTE_CARLO_RUNS = 120;
  const ROLLOUT_CLOSE_HEAT_PRESSURE = 0.93;
  const ROLLOUT_LOW_UPSIDE_THRESHOLD = 0;
  const ROLLOUT_MIN_ADMITS_BEFORE_CLOSE = 2;
  const EARLY_TEMPO_PROTECTED_GUESTS = 3;
  const ADMIT_ADVANTAGE_MARGIN = 0.75;

  function scoreRoundValue(money, points, venue) {
    let total = money + points;
    if (venue.style === 'money') total += money;
    if (venue.style === 'points') total += points;
    return total;
  }

  function shuffleCopy(list) {
    const result = [...list];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function estimateRolloutFromDoorState(baseState, orderedDeck, venue, heatCap) {
    let heat = baseState.heat;
    let money = baseState.money;
    let points = baseState.points;
    const bustPenalty = Game.BUST_PENALTY;

    for (let i = 0; i < orderedDeck.length; i++) {
      const closeScore = scoreRoundValue(money, points, venue);
      const nextGuest = Game.GUESTS[orderedDeck[i]];
      const nextHeat = heat + nextGuest.heat;
      const nextMoney = money + nextGuest.money;
      const nextPoints = points + nextGuest.points;

      if (nextHeat > heatCap) {
        const bustedMoney = Math.floor(nextMoney * bustPenalty);
        const bustedPoints = Math.floor(nextPoints * bustPenalty);
        return scoreRoundValue(bustedMoney, bustedPoints, venue);
      }

      const continueScore = scoreRoundValue(nextMoney, nextPoints, venue);
      const heatPressure = nextHeat / heatCap;
      const nearEnd = i >= orderedDeck.length - 1;
      const lowUpside = (continueScore - closeScore) <= ROLLOUT_LOW_UPSIDE_THRESHOLD;
      const deepIntoRun = i >= ROLLOUT_MIN_ADMITS_BEFORE_CLOSE;

      if (heatPressure > ROLLOUT_CLOSE_HEAT_PRESSURE && lowUpside && deepIntoRun && !nearEnd) {
        return closeScore;
      }

      heat = nextHeat;
      money = nextMoney;
      points = nextPoints;
    }

    return scoreRoundValue(money, points, venue);
  }

  function estimateAdmitVsCloseValue(rival, venue) {
    const arrivingGuest = Game.GUESTS[rival.arrivingGuest];
    const closeMoney = rival.roundMoney + (arrivingGuest?.money || 0);
    const closePoints = rival.roundPoints + (arrivingGuest?.points || 0);
    const closeValue = scoreRoundValue(closeMoney, closePoints, venue);

    if (rival.roundDeck.length === 0) {
      return { closeValue, admitValue: closeValue };
    }

    const heatCap = Game.getHeatCapacity(venue, rival);
    let admitTotal = 0;
    for (let i = 0; i < MONTE_CARLO_RUNS; i++) {
      const orderedDeck = shuffleCopy(rival.roundDeck);
      admitTotal += estimateRolloutFromDoorState(
        { heat: rival.heat, money: closeMoney, points: closePoints },
        orderedDeck,
        venue,
        heatCap,
      );
    }

    return {
      closeValue,
      admitValue: admitTotal / MONTE_CARLO_RUNS,
    };
  }

  function estimateAbilityValue(rival, player, venue, playerVenue, guest) {
    if (!guest?.ability || guest.ability.trigger !== 'flash') return Number.NEGATIVE_INFINITY;

    const projectedHeat = rival.heat + guest.heat;
    const rivalHeatCap = Game.getHeatCapacity(venue, rival);
    if (projectedHeat > rivalHeatCap) return Number.NEGATIVE_INFINITY;

    let value = scoreRoundValue(rival.roundMoney, rival.roundPoints, venue);

    switch (guest.ability.type) {
      case 'coolHeat': {
        const headroom = rivalHeatCap - rival.heat;
        value += headroom <= 1 ? guest.ability.value * 5 : guest.ability.value * 1.5;
        break;
      }
      case 'addOpponentHeat': {
        if (!player.doorClosed && !player.busted) {
          const projected = player.heat + guest.ability.value;
          const playerHeatCap = Game.getHeatCapacity(playerVenue, player);
          const ratio = projected / playerHeatCap;
          value += ratio * 3;
          if (projected > playerHeatCap) value += 6;
        }
        break;
      }
      case 'scoreNow':
        value += guest.ability.value * 1.5;
        break;
      default:
        break;
    }

    return value;
  }

  function estimateDoorSafeAction(rival, guest, venue, player, playerVenue) {
    if (!guest) return 'close';

    const rivalHeatCap = Game.getHeatCapacity(venue, rival);
    if (rival.heat > rivalHeatCap) {
      if (!rival.arrivingAbilityUsed && guest.ability && guest.ability.type === 'coolHeat') {
        return 'ability';
      }
      return 'close';
    }

    if ((rival.heat + guest.heat) > rivalHeatCap) {
      return 'close';
    }

    const remainingHeatBuffer = rivalHeatCap - rival.heat;
    if (rival.house.length < EARLY_TEMPO_PROTECTED_GUESTS && remainingHeatBuffer >= 1) {
      return 'admit';
    }

    const values = estimateAdmitVsCloseValue(rival, venue);
    const abilityValue = rival.arrivingAbilityUsed
      ? Number.NEGATIVE_INFINITY
      : estimateAbilityValue(rival, player, venue, playerVenue, guest);

    if (abilityValue >= values.admitValue && abilityValue >= values.closeValue) {
      return 'ability';
    }

    if ((values.admitValue + ADMIT_ADVANTAGE_MARGIN) >= values.closeValue) return 'admit';
    return 'close';
  }

  const { rival, player } = state;
  const venue = Game.VENUES[rival.venueId];
  const playerVenue = Game.VENUES[player.venueId];
  const guest = Game.GUESTS[rival.arrivingGuest];
  return estimateDoorSafeAction(rival, guest, venue, player, playerVenue);
}

describe('AI guest door decision parity', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('keeps decision thresholds and scoring parity with legacy rollout path', () => {
    const AI = loadAI();
    const state = makeDoorState({
      rival: {
        house: [{ guestId: 'familiarFace', abilityUsed: false, instanceId: 'h1' }, { guestId: 'loudFriend', abilityUsed: false, instanceId: 'h2' }, { guestId: 'bottleBringer', abilityUsed: false, instanceId: 'h3' }],
      },
    });

    const randomSequence = [0.13, 0.77, 0.41, 0.95, 0.22, 0.68, 0.04, 0.56];
    let index = 0;
    jest.spyOn(Math, 'random').mockImplementation(() => {
      const value = randomSequence[index % randomSequence.length];
      index += 1;
      return value;
    });

    const current = AI.decideGuestAction(state);

    index = 0;
    const legacy = buildLegacyDoorDecision(state);

    expect(current).toEqual(legacy);
  });
});
