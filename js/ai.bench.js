const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { performance } = require('perf_hooks');
const Game = require('./game');

const MONTE_CARLO_RUNS = 120;
const ROLLOUT_CLOSE_HEAT_PRESSURE = 0.93;
const ROLLOUT_LOW_UPSIDE_THRESHOLD = 0;
const ROLLOUT_MIN_ADMITS_BEFORE_CLOSE = 2;
const EARLY_TEMPO_PROTECTED_GUESTS = 3;
const ADMIT_ADVANTAGE_MARGIN = 0.75;

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

function makeState() {
  return {
    rival: {
      venueId: 'velvetRoom',
      doorClosed: false,
      busted: false,
      heat: 1,
      roundMoney: 5,
      roundPoints: 2,
      roundDeck: ['familiarFace', 'loudFriend', 'bottleBringer', 'bigPlanner', 'danceCaptain'],
      arrivingGuest: 'familiarFace',
      arrivingAbilityUsed: false,
      fullDeck: ['familiarFace', 'loudFriend', 'bottleBringer', 'bigPlanner', 'danceCaptain'],
      money: 10,
      shopItemPurchases: { slotIncrease: 0, heatCapIncrease: 0 },
      slotIncrease: 0,
      heatCapBonus: 0,
      house: [],
    },
    player: {
      venueId: 'velvetRoom',
      doorClosed: false,
      busted: false,
      heat: 2,
      roundDeck: ['familiarFace', 'loudFriend', 'bottleBringer', 'bigPlanner'],
      house: [],
    },
  };
}

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

function legacyEstimateRolloutFromDoorState(baseState, orderedDeck, venue, heatCap) {
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

function legacyEstimateAdmitVsCloseValue(rival, venue) {
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
    admitTotal += legacyEstimateRolloutFromDoorState(
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

function legacyEstimateAbilityValue(rival, player, venue, playerVenue, guest) {
  if (!guest?.ability) return Number.NEGATIVE_INFINITY;
  if (guest.ability.trigger !== 'flash') return Number.NEGATIVE_INFINITY;

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

function legacyDoorDecision(state) {
  const rival = state.rival;
  const player = state.player;
  const venue = Game.VENUES[rival.venueId];
  const playerVenue = Game.VENUES[player.venueId];
  const guest = Game.GUESTS[rival.arrivingGuest];
  const rivalHeatCap = Game.getHeatCapacity(venue, rival);

  if (!guest) return 'close';
  if (rival.heat > rivalHeatCap) {
    if (!rival.arrivingAbilityUsed && guest.ability && guest.ability.type === 'coolHeat') {
      return 'ability';
    }
    return 'close';
  }
  if ((rival.heat + guest.heat) > rivalHeatCap) return 'close';

  const remainingHeatBuffer = rivalHeatCap - rival.heat;
  if (rival.house.length < EARLY_TEMPO_PROTECTED_GUESTS && remainingHeatBuffer >= 1) return 'admit';

  const values = legacyEstimateAdmitVsCloseValue(rival, venue);
  const abilityValue = rival.arrivingAbilityUsed
    ? Number.NEGATIVE_INFINITY
    : legacyEstimateAbilityValue(rival, player, venue, playerVenue, guest);

  if (abilityValue >= values.admitValue && abilityValue >= values.closeValue) return 'ability';
  if ((values.admitValue + ADMIT_ADVANTAGE_MARGIN) >= values.closeValue) return 'admit';
  return 'close';
}


function legacyEstimateRoundValueForGuest(rival, venue, guestId) {
  const sampledDeck = [...rival.fullDeck, guestId];
  const bustPenalty = Game.BUST_PENALTY;
  let totalScore = 0;

  for (let i = 0; i < MONTE_CARLO_RUNS; i++) {
    const drawOrder = shuffleCopy(sampledDeck);
    let heat = 0;
    let money = 0;
    let points = 0;
    for (let j = 0; j < drawOrder.length; j++) {
      const guest = Game.GUESTS[drawOrder[j]];
      heat += guest.heat;
      money += guest.money;
      points += guest.points;

      if (heat > Game.getHeatCapacity(venue, rival)) {
        money = Math.floor(money * bustPenalty);
        points = Math.floor(points * bustPenalty);
        break;
      }
    }

    totalScore += scoreRoundValue(money, points, venue);
  }

  return totalScore / MONTE_CARLO_RUNS;
}

function legacyBuildGuestScoreMap(rival, market, venue) {
  const guestScores = new Map();
  for (const guestId of market) {
    const guest = Game.GUESTS[guestId];
    const score = legacyEstimateRoundValueForGuest(rival, venue, guestId);
    guestScores.set(guestId, {
      score,
      scorePerCost: score / Math.max(1, guest.cost),
    });
  }
  return guestScores;
}

function legacyRankMarketByMonteCarlo(rival, market, venue, guestScores = legacyBuildGuestScoreMap(rival, market, venue)) {
  return [...market].sort((a, b) => {
    const aGuest = Game.GUESTS[a];
    const bGuest = Game.GUESTS[b];
    const aScore = guestScores.get(a);
    const bScore = guestScores.get(b);

    const aValue = aScore?.scorePerCost ?? Number.NEGATIVE_INFINITY;
    const bValue = bScore?.scorePerCost ?? Number.NEGATIVE_INFINITY;

    if (bValue === aValue) return aGuest.cost - bGuest.cost;
    return bValue - aValue;
  });
}

function legacyDecideBuyPhaseActions(state, market) {
  const rival = state.rival;
  const purchases = [];
  const venue = Game.VENUES[rival.venueId];

  const guestScores = legacyBuildGuestScoreMap(rival, market, venue);
  const ranked = legacyRankMarketByMonteCarlo(rival, market, venue, guestScores);
  let budget = rival.money;

  const slotCost = 3 + (rival.shopItemPurchases.slotIncrease * 2);
  const heatCost = 4 + (rival.shopItemPurchases.heatCapIncrease * 3);
  const houseCapacity = Game.getHouseCapacity(venue, rival);

  const slotValue = rival.fullDeck.length > houseCapacity ? 6 : 2;
  const avgHeat = rival.fullDeck.reduce((sum, id) => sum + (Game.GUESTS[id]?.heat || 0), 0) / Math.max(1, rival.fullDeck.length);
  const heatValue = avgHeat >= 1.5 ? 7 : (avgHeat >= 1 ? 4 : 2);

  const candidates = [];
  for (const guestId of ranked) {
    const guest = Game.GUESTS[guestId];
    const cachedScore = guestScores.get(guestId);
    candidates.push({ id: guestId, cost: guest.cost, value: cachedScore?.scorePerCost ?? 0 });
  }
  if (slotCost <= budget) {
    candidates.push({ id: 'slotIncrease', cost: slotCost, value: slotValue / Math.max(1, slotCost) });
  }
  if (heatCost <= budget) {
    candidates.push({ id: 'heatCapIncrease', cost: heatCost, value: heatValue / Math.max(1, heatCost) });
  }

  candidates.sort((a, b) => b.value - a.value);

  for (const item of candidates) {
    if (item.cost <= budget && purchases.length < 4) {
      purchases.push(item.id);
      budget -= item.cost;
    }
  }

  return purchases;
}

function runBenchmark() {
  const AI = loadAI();
  const iterations = 200;
  const buyIterations = 20;
  const state = makeState();
  const market = ['familiarFace', 'loudFriend', 'bottleBringer', 'bigSpender', 'bigPlanner'];

  // Warmup
  for (let i = 0; i < 50; i++) {
    AI.decideGuestAction(state);
    legacyDoorDecision(state);
  }

  const t0 = performance.now();
  for (let i = 0; i < iterations; i++) {
    legacyDoorDecision(state);
  }
  const legacyMs = performance.now() - t0;

  const t1 = performance.now();
  for (let i = 0; i < iterations; i++) {
    AI.decideGuestAction(state);
  }
  const optimizedMs = performance.now() - t1;

  console.log(`Legacy door decision latency:    ${(legacyMs / iterations).toFixed(4)} ms/op`);
  console.log(`Optimized decision latency:      ${(optimizedMs / iterations).toFixed(4)} ms/op`);
  console.log(`Door speedup (legacy/optimized): ${(legacyMs / Math.max(optimizedMs, 1e-9)).toFixed(2)}x`);

  const t2 = performance.now();
  for (let i = 0; i < buyIterations; i++) {
    legacyDecideBuyPhaseActions(state, market);
  }
  const legacyBuyMs = performance.now() - t2;

  const t3 = performance.now();
  for (let i = 0; i < buyIterations; i++) {
    AI.decideBuyPhaseActions(state, market);
  }
  const optimizedBuyMs = performance.now() - t3;

  console.log(`Legacy buy latency:              ${(legacyBuyMs / buyIterations).toFixed(4)} ms/op`);
  console.log(`Optimized buy latency:           ${(optimizedBuyMs / buyIterations).toFixed(4)} ms/op`);
  console.log(`Buy speedup (legacy/optimized):  ${(legacyBuyMs / Math.max(optimizedBuyMs, 1e-9)).toFixed(2)}x`);
}

runBenchmark();
