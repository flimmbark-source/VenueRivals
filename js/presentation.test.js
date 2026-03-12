const Presentation = require('./presentation');

describe('presentation layer derivation', () => {
  const baseState = {
    phase: 'guest',
    pointTarget: 50,
    player: { venueId: 'velvetRoom', points: 10, heat: 0, busted: false },
    rival: { venueId: 'backAlley', points: 8, heat: 0, busted: false },
  };

  beforeEach(() => {
    global.Game = {
      VENUES: { velvetRoom: { bustThreshold: 3 } },
      getHeatCapacity: () => 3,
    };
  });

  test('derives calm idle state by default', () => {
    const state = Presentation.derivePresentationState({ gameState: baseState });
    expect(state.heatBand).toBe('calm');
    expect(state.momentType).toBe('idle');
    expect(state.venueMood).toBe('velvet-noir');
  });

  test('derives urgent pressure when heat reaches critical', () => {
    const state = Presentation.derivePresentationState({
      gameState: { ...baseState, player: { ...baseState.player, heat: 3 } },
    });
    expect(state.heatBand).toBe('critical');
    expect(state.pressure).toBe('urgent');
  });

  test('uses moment hint when provided', () => {
    const state = Presentation.derivePresentationState({ gameState: baseState, momentHint: 'ability' });
    expect(state.momentType).toBe('ability');
  });
});


  test('exposes phase-2 motion event names', () => {
    expect(Presentation.EVENTS).toMatchObject({
      HEAT_CHANGED: 'HEAT_CHANGED',
      BUST_WARNING: 'BUST_WARNING',
      GUEST_ADMITTED: 'GUEST_ADMITTED',
      RARE_GUEST_ADMITTED: 'RARE_GUEST_ADMITTED',
      ABILITY_USED: 'ABILITY_USED',
      ROUND_BANKED: 'ROUND_BANKED',
      ROUND_BUST: 'ROUND_BUST',
      RIVAL_SPIKE: 'RIVAL_SPIKE',
    });
  });

describe('presentation event bus', () => {
  test('emits payload to subscribers', () => {
    const bus = Presentation.createEventBus();
    const calls = [];
    bus.on(Presentation.EVENTS.ABILITY_USED, (payload) => calls.push(payload));

    bus.emit(Presentation.EVENTS.ABILITY_USED, { who: 'player' });
    expect(calls).toEqual([{ who: 'player' }]);
  });
});
