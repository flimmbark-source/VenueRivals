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

    // 3 market guests * 120 runs * (sampledDeck length 3 -> 2 random draws per shuffle)
    expect(randomSpy).toHaveBeenCalledTimes(720);
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
