const { createRuntime, normalizePlatform } = require('./performance.js');

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
});
