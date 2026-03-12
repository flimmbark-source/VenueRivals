const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { performance } = require('perf_hooks');
const Game = require('./game');

const PERF_BUDGETS_MS = {
  'ai.decideGuestAction.avg': 6.5,
  'ai.decideBuyPhaseActions.avg': 30,
};

function loadAI() {
  const aiPath = path.join(__dirname, 'ai.js');
  const source = `${fs.readFileSync(aiPath, 'utf8')}\n;globalThis.__PERF_AI__ = AI;`;
  const context = { Game, Math, console, globalThis: {} };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'ai.js' });
  return context.__PERF_AI__;
}

function makeState() {
  const state = Game.createGameState('Player', 'velvetRoom', 'Rival', 'backAlley', 50);
  Game.startGuestPhase(state);
  for (let i = 0; i < 6; i += 1) {
    if (!state.player.doorClosed && !state.player.busted) {
      Game.admitGuest(state.player, Game.VENUES[state.player.venueId], state.rival, Game.VENUES[state.rival.venueId]);
    }
    if (!state.rival.doorClosed && !state.rival.busted) {
      Game.admitGuest(state.rival, Game.VENUES[state.rival.venueId], state.player, Game.VENUES[state.player.venueId]);
    }
  }
  return state;
}

function measureAvgMs(iterations, fn) {
  const t0 = performance.now();
  for (let i = 0; i < iterations; i += 1) fn();
  return (performance.now() - t0) / iterations;
}

function assertBudget(name, value) {
  const budget = PERF_BUDGETS_MS[name];
  if (value > budget) {
    throw new Error(`${name} budget exceeded: ${value.toFixed(3)}ms > ${budget.toFixed(3)}ms`);
  }
}

function run() {
  const AI = loadAI();
  const state = makeState();
  const market = Game.getMarket(state.rival);

  const guestActionAvg = measureAvgMs(120, () => {
    AI.decideGuestAction(state);
  });

  const buyActionAvg = measureAvgMs(20, () => {
    AI.decideBuyPhaseActions(state, market);
  });

  console.log(`ai.decideGuestAction.avg=${guestActionAvg.toFixed(3)}ms (budget ${PERF_BUDGETS_MS['ai.decideGuestAction.avg']}ms)`);
  console.log(`ai.decideBuyPhaseActions.avg=${buyActionAvg.toFixed(3)}ms (budget ${PERF_BUDGETS_MS['ai.decideBuyPhaseActions.avg']}ms)`);

  assertBudget('ai.decideGuestAction.avg', guestActionAvg);
  assertBudget('ai.decideBuyPhaseActions.avg', buyActionAvg);
}

run();
