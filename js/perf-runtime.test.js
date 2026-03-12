const PerfRuntime = require('./perf-runtime');

describe('perf runtime primitives', () => {
  test('reuses released objects from pool', () => {
    const pool = PerfRuntime.createObjectPool({
      create: () => ({ value: 0 }),
      reset: (item) => { item.value = 0; },
      maxSize: 2,
    });
    const a = pool.acquire();
    a.value = 99;
    pool.release(a);
    const b = pool.acquire();
    expect(b).toBe(a);
    expect(b.value).toBe(0);
  });

  test('captures budget violations per subsystem', () => {
    let t = 0;
    const violations = [];
    const profiler = PerfRuntime.createFrameProfiler({
      now: () => t,
      budgetsMs: { ai: 2 },
      onBudgetExceeded: (v) => violations.push(v),
    });

    profiler.startFrame();
    profiler.measure('ai', () => { t += 3; });
    const result = profiler.endFrame();

    expect(result.violations).toHaveLength(1);
    expect(violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({ subsystem: 'ai', budgetMs: 2 });
  });

  test('runs queued jobs within budget window', () => {
    let t = 0;
    const scheduler = PerfRuntime.createJobScheduler({ now: () => t, budgetMs: 3 });
    const done = [];
    scheduler.enqueue('one', () => { done.push('one'); t += 2; });
    scheduler.enqueue('two', () => { done.push('two'); t += 2; });

    const processed = scheduler.runDueJobs();
    expect(processed).toBe(2);
    expect(done).toEqual(['one', 'two']);
  });
});
