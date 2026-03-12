const { createRuntime, normalizePlatform, createObjectPool, createFrameBudgetGuard } = require('./performance.js');

describe('PerformanceRuntime', () => {
  test('identifies top hitch events by asset and context', () => {
    const runtime = createRuntime({ hitchThresholdMs: 10 });
    runtime.recordHitch({ assetId: 'sprite:familiarFace', scene: 'game', matchContext: 'guest', durationMs: 25 });
    runtime.recordHitch({ assetId: 'sprite:familiarFace', scene: 'game', matchContext: 'guest', durationMs: 20 });
    runtime.recordHitch({ assetId: 'image:venue-background', scene: 'title', matchContext: 'menu', durationMs: 40 });

    const top = runtime.getTopHitches(1);
    expect(top[0].assetId).toBe('sprite:familiarFace');
    expect(top[0].count).toBe(2);
    expect(top[0].scene).toBe('game');
  });

  test('builds prewarm and streaming plans for critical assets', () => {
    const runtime = createRuntime({
      assetCatalog: [
        { id: 'sprite:familiarFace', critical: true, phases: ['loading', 'preMatch'], priority: 2, fallback: 'lod' },
        { id: 'sprite:gatecrasher', critical: false, phases: ['liveMatch'], priority: 1, fallback: 'placeholder' },
      ],
    });
    runtime.recordHitch({ assetId: 'sprite:familiarFace', durationMs: 30, scene: 'game', matchContext: 'guest' });

    const prewarm = runtime.planShaderPrewarm('loading');
    expect(prewarm[0].id).toBe('sprite:familiarFace');

    const streaming = runtime.planStreaming(['loading', 'preMatch', 'liveMatch']);
    expect(streaming[0].assetId).toBe('sprite:familiarFace');
    expect(streaming[0].decompressEarly).toBe(true);
  });

  test('selects fallback and memory policy per platform budget', () => {
    const runtime = createRuntime({
      platformHint: 'iPhone',
      assetCatalog: [{ id: 'sprite:familiarFace', fallback: 'lod' }],
    });

    expect(normalizePlatform('iPhone')).toBe('mobile');
    expect(runtime.chooseFallback('sprite:familiarFace', 120).strategy).toBe('lod');

    const policy = runtime.getMemoryPolicy(180);
    expect(policy.platform).toBe('mobile');
    expect(policy.shouldTrim).toBe(true);
  });

  test('profiles worst-case main thread moments and sorts peaks', () => {
    const runtime = createRuntime();

    runtime.profileFrame({ scenario: 'largeFight', frameMs: 27, uiOverlayMs: 1.2, particleMs: 3.5, abilitySpamMs: 2.2, entities: 60 });
    runtime.profileFrame({ scenario: 'largeFight', frameMs: 24, uiOverlayMs: 1.1, particleMs: 3.2, abilitySpamMs: 2.0, entities: 58 });
    runtime.profileFrame({ scenario: 'abilitySpam', frameMs: 29, uiOverlayMs: 0.8, particleMs: 1.8, abilitySpamMs: 5.5, entities: 30 });

    const moments = runtime.profileWorstCaseMoments();
    expect(moments[0].scenario).toBe('abilitySpam');
    expect(moments.find((row) => row.scenario === 'largeFight').averageFrameMs).toBe(25.5);
  });

  test('moves non-critical work to worker queue and throttles update intervals', () => {
    const runtime = createRuntime();
    runtime.registerNonCriticalSystem('aiUpdates', { intervalFrames: 3, lane: 'worker' });

    expect(runtime.shouldRunSystem('aiUpdates', 1)).toBe(true);
    expect(runtime.shouldRunSystem('aiUpdates', 2)).toBe(false);
    expect(runtime.shouldRunSystem('aiUpdates', 4)).toBe(true);

    const completed = [];
    runtime.enqueueWorkerJob({ execute: () => { completed.push('ai'); return 'ai'; } });
    runtime.enqueueWorkerJob({ execute: () => { completed.push('path'); return 'path'; } });

    const firstDrain = runtime.drainWorkerJobs(1);
    expect(firstDrain).toEqual(['ai']);
    expect(completed).toEqual(['ai']);

    const secondDrain = runtime.drainWorkerJobs(2);
    expect(secondDrain).toEqual(['path']);
  });

  test('reuses objects from pool to avoid per-frame allocations', () => {
    const pool = createObjectPool({
      factory: () => ({ active: false, value: 0 }),
      reset: (item) => {
        item.active = false;
        item.value = 0;
      },
      maxSize: 4,
    });

    const a = pool.acquire();
    a.active = true;
    a.value = 42;
    pool.release(a);

    const b = pool.acquire();
    expect(b).toBe(a);
    expect(b.value).toBe(0);

    const stats = pool.stats();
    expect(stats.totalCreated).toBe(1);
    expect(stats.available).toBe(0);
  });

  test('enforces frame-time budgets with CI-friendly hard failures', () => {
    const guard = createFrameBudgetGuard({ budgetsMs: { ai: 2.5, particles: 2 } });
    guard.record('ai', 3.1);
    guard.record('particles', 1.8);

    expect(() => guard.assertWithinBudgets()).toThrow(/Frame-time budget exceeded/);

    const passingGuard = createFrameBudgetGuard({ budgetsMs: { ai: 3 } });
    passingGuard.record('ai', 2.4);
    expect(() => passingGuard.assertWithinBudgets()).not.toThrow();
  });
});
