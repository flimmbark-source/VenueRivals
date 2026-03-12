(function (global) {
    'use strict';

    function defaultNow() {
        if (typeof performance !== 'undefined' && performance.now) return performance.now();
        return Date.now();
    }

    function createObjectPool({ create, reset, maxSize = 256 }) {
        const free = [];
        return {
            acquire() {
                return free.pop() || create();
            },
            release(item) {
                if (item == null || free.length >= maxSize) return;
                reset?.(item);
                free.push(item);
            },
            size() {
                return free.length;
            },
        };
    }

    function createFrameProfiler({ now = defaultNow, budgetsMs = {}, onBudgetExceeded = null } = {}) {
        let frameId = 0;
        let current = null;
        const stats = new Map();

        function ensureStat(name) {
            if (!stats.has(name)) stats.set(name, { total: 0, count: 0, max: 0, last: 0 });
            return stats.get(name);
        }

        function mark(name, durationMs) {
            const stat = ensureStat(name);
            stat.total += durationMs;
            stat.count += 1;
            stat.max = Math.max(stat.max, durationMs);
            stat.last = durationMs;
            if (current) {
                current.total += durationMs;
                current.samples[name] = (current.samples[name] || 0) + durationMs;
            }
        }

        return {
            startFrame(label = 'frame') {
                frameId += 1;
                current = { id: frameId, label, start: now(), total: 0, samples: Object.create(null) };
            },
            measure(name, fn) {
                const t0 = now();
                const result = fn();
                mark(name, now() - t0);
                return result;
            },
            mark,
            endFrame() {
                if (!current) return { violations: [] };
                current.duration = Math.max(current.total, now() - current.start);
                const violations = [];
                Object.entries(current.samples).forEach(([name, value]) => {
                    const budget = budgetsMs[name];
                    if (typeof budget === 'number' && value > budget) {
                        const violation = { frameId: current.id, subsystem: name, durationMs: value, budgetMs: budget };
                        violations.push(violation);
                        onBudgetExceeded?.(violation);
                    }
                });
                const frame = current;
                current = null;
                return { frame, violations };
            },
            getReport() {
                const subsystems = {};
                stats.forEach((value, key) => {
                    subsystems[key] = {
                        avgMs: value.count ? value.total / value.count : 0,
                        maxMs: value.max,
                        lastMs: value.last,
                        samples: value.count,
                    };
                });
                return { subsystems };
            },
        };
    }

    function createJobScheduler({ now = defaultNow, budgetMs = 3 } = {}) {
        const queue = [];
        return {
            enqueue(name, fn) {
                queue.push({ name, fn });
            },
            runDueJobs(profiler = null) {
                const started = now();
                let processed = 0;
                while (queue.length && (now() - started) < budgetMs) {
                    const job = queue.shift();
                    if (profiler) profiler.measure(`job.${job.name}`, job.fn);
                    else job.fn();
                    processed += 1;
                }
                return processed;
            },
            size() {
                return queue.length;
            },
        };
    }

    function createFixedIntervalGate() {
        const counters = new Map();
        return {
            tick(key, everyNFrames = 1) {
                const next = (counters.get(key) || 0) + 1;
                counters.set(key, next);
                return next % Math.max(1, everyNFrames) === 0;
            },
            reset(key) {
                counters.delete(key);
            },
        };
    }

    const api = {
        createObjectPool,
        createFrameProfiler,
        createJobScheduler,
        createFixedIntervalGate,
    };

    global.PerfRuntime = api;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
}(typeof window !== 'undefined' ? window : globalThis));
