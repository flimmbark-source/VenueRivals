/* ============================================
   VENUE RIVALS - Performance Runtime
   Hitch profiling, prewarm planning, streaming policy,
   fallback rendering, and platform memory budgeting.
   ============================================ */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.PerformanceRuntime = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const DEFAULT_MEMORY_BUDGET_MB = {
        mobile: 196,
        desktop: 640,
        lowPower: 320,
    };

    const DEFAULT_HITCH_THRESHOLD_MS = 16.6;

    function normalizePlatform(platformHint) {
        const hint = String(platformHint || '').toLowerCase();
        if (/iphone|ipad|android|mobile/.test(hint)) return 'mobile';
        if (/low|integrated|battery/.test(hint)) return 'lowPower';
        return 'desktop';
    }

    function keyForEvent(event) {
        return [event.assetId || 'unknown', event.shaderId || 'none', event.scene || 'unknown', event.matchContext || 'unknown'].join('::');
    }

    function createObjectPool(options = {}) {
        const factory = typeof options.factory === 'function' ? options.factory : (() => ({}));
        const reset = typeof options.reset === 'function' ? options.reset : (() => {});
        const maxSize = Number.isFinite(options.maxSize) && options.maxSize > 0 ? options.maxSize : 256;
        const available = [];
        let totalCreated = 0;

        function acquire() {
            if (available.length > 0) return available.pop();
            totalCreated += 1;
            return factory();
        }

        function release(item) {
            if (!item || available.length >= maxSize) return;
            reset(item);
            available.push(item);
        }

        function stats() {
            return {
                available: available.length,
                totalCreated,
                maxSize,
            };
        }

        return {
            acquire,
            release,
            stats,
        };
    }

    function createFrameBudgetGuard(options = {}) {
        const budgetsMs = {
            ai: 3,
            particles: 2,
            ui: 1.5,
            pathing: 2,
            ...options.budgetsMs,
        };
        const measurements = new Map();

        function record(subsystem, durationMs) {
            const key = subsystem || 'unknown';
            const existing = measurements.get(key) || [];
            existing.push(Number(durationMs) || 0);
            measurements.set(key, existing);
        }

        function summarizeSubsystem(subsystem) {
            const values = measurements.get(subsystem) || [];
            if (!values.length) {
                return {
                    subsystem,
                    budgetMs: budgetsMs[subsystem],
                    averageMs: 0,
                    maxMs: 0,
                    overBudget: false,
                };
            }
            const total = values.reduce((sum, value) => sum + value, 0);
            const averageMs = total / values.length;
            const maxMs = Math.max(...values);
            const budgetMs = budgetsMs[subsystem];
            return {
                subsystem,
                budgetMs,
                averageMs: Number(averageMs.toFixed(2)),
                maxMs: Number(maxMs.toFixed(2)),
                overBudget: Number.isFinite(budgetMs) ? averageMs > budgetMs : false,
            };
        }

        function report() {
            return Object.keys(budgetsMs).map((subsystem) => summarizeSubsystem(subsystem));
        }

        function assertWithinBudgets() {
            const violations = report().filter((entry) => entry.overBudget);
            if (!violations.length) return;
            const details = violations
                .map((entry) => `${entry.subsystem}: avg ${entry.averageMs}ms > budget ${entry.budgetMs}ms`)
                .join(', ');
            throw new Error(`Frame-time budget exceeded (${details})`);
        }

        return {
            budgetsMs,
            record,
            report,
            assertWithinBudgets,
        };
    }

    function createRuntime(options = {}) {
        const hitchThresholdMs = Number(options.hitchThresholdMs) > 0 ? Number(options.hitchThresholdMs) : DEFAULT_HITCH_THRESHOLD_MS;
        const platform = normalizePlatform(options.platformHint);
        const memoryBudgetsMb = { ...DEFAULT_MEMORY_BUDGET_MB, ...(options.memoryBudgetsMb || {}) };
        const assets = new Map();
        const hitches = [];
        const hitchAggregates = new Map();
        const nonCriticalSystems = new Map();
        const workerQueue = [];
        const profileSamples = [];
        const budgetGuard = createFrameBudgetGuard({ budgetsMs: options.frameBudgetsMs });

        (options.assetCatalog || []).forEach((asset) => {
            if (!asset || !asset.id) return;
            assets.set(asset.id, {
                id: asset.id,
                type: asset.type || 'material',
                shaderId: asset.shaderId || null,
                estimatedMb: Number(asset.estimatedMb) || 1,
                phases: Array.isArray(asset.phases) ? asset.phases : ['loading', 'preMatch', 'liveMatch'],
                critical: !!asset.critical,
                fallback: asset.fallback || 'placeholder',
                priority: Number.isFinite(asset.priority) ? asset.priority : 0,
            });
        });

        function recordHitch(event) {
            if (!event || !(event.durationMs > hitchThresholdMs)) return false;
            const normalized = {
                assetId: event.assetId || 'unknown',
                shaderId: event.shaderId || null,
                scene: event.scene || 'unknown',
                matchContext: event.matchContext || 'unknown',
                durationMs: Number(event.durationMs) || 0,
                timestamp: event.timestamp || Date.now(),
            };
            hitches.push(normalized);
            const key = keyForEvent(normalized);
            const existing = hitchAggregates.get(key) || {
                assetId: normalized.assetId,
                shaderId: normalized.shaderId,
                scene: normalized.scene,
                matchContext: normalized.matchContext,
                count: 0,
                maxMs: 0,
                totalMs: 0,
            };
            existing.count += 1;
            existing.totalMs += normalized.durationMs;
            existing.maxMs = Math.max(existing.maxMs, normalized.durationMs);
            hitchAggregates.set(key, existing);
            return true;
        }

        function getTopHitches(limit = 8) {
            return [...hitchAggregates.values()]
                .map((item) => ({ ...item, avgMs: Number((item.totalMs / Math.max(1, item.count)).toFixed(2)) }))
                .sort((a, b) => {
                    if (b.count !== a.count) return b.count - a.count;
                    return b.maxMs - a.maxMs;
                })
                .slice(0, Math.max(1, limit));
        }

        function planShaderPrewarm(phase = 'loading') {
            const topHitchAssets = new Set(getTopHitches(12).map((h) => h.assetId));
            return [...assets.values()]
                .filter((asset) => asset.phases.includes(phase))
                .map((asset) => ({
                    ...asset,
                    score: (asset.critical ? 3 : 0) + (topHitchAssets.has(asset.id) ? 4 : 0) + asset.priority,
                }))
                .filter((asset) => asset.score > 0)
                .sort((a, b) => b.score - a.score);
        }

        function planStreaming(predictedPhases = []) {
            const phaseOrder = Array.isArray(predictedPhases) && predictedPhases.length
                ? predictedPhases
                : ['loading', 'preMatch', 'liveMatch'];
            return [...assets.values()]
                .map((asset) => {
                    const firstPhaseIndex = Math.min(...asset.phases.map((p) => {
                        const idx = phaseOrder.indexOf(p);
                        return idx === -1 ? 999 : idx;
                    }));
                    const risk = (asset.critical ? 2 : 0) + Math.max(0, 4 - firstPhaseIndex) + asset.priority;
                    return {
                        assetId: asset.id,
                        risk,
                        startPhase: phaseOrder[Math.max(0, firstPhaseIndex)] || phaseOrder[0],
                        decompressEarly: risk >= 5,
                    };
                })
                .sort((a, b) => b.risk - a.risk);
        }

        function chooseFallback(assetId, streamDelayMs = 0) {
            const asset = assets.get(assetId);
            if (!asset) return { strategy: 'placeholder', reason: 'asset-not-registered' };
            if (streamDelayMs <= 0) return { strategy: 'full', reason: 'on-time' };
            if (streamDelayMs > 100 && asset.fallback === 'lod') {
                return { strategy: 'lod', reason: 'stream-late' };
            }
            return { strategy: 'placeholder', reason: 'stream-late' };
        }

        function getMemoryPolicy(currentUsageMb = 0) {
            const budgetMb = memoryBudgetsMb[platform] || DEFAULT_MEMORY_BUDGET_MB.desktop;
            const pressure = currentUsageMb / budgetMb;
            return {
                platform,
                budgetMb,
                pressure,
                shouldTrim: pressure >= 0.9,
                shouldDeferOptional: pressure >= 0.75,
            };
        }

        function profileFrame(sample) {
            if (!sample || !sample.scenario) return null;
            const normalized = {
                scenario: sample.scenario,
                frameMs: Number(sample.frameMs) || 0,
                uiOverlayMs: Number(sample.uiOverlayMs) || 0,
                particleMs: Number(sample.particleMs) || 0,
                abilitySpamMs: Number(sample.abilitySpamMs) || 0,
                entities: Number(sample.entities) || 0,
                timestamp: sample.timestamp || Date.now(),
            };
            profileSamples.push(normalized);
            budgetGuard.record('ui', normalized.uiOverlayMs);
            budgetGuard.record('particles', normalized.particleMs);
            return normalized;
        }

        function getMainThreadProfile(limit = 20) {
            return [...profileSamples]
                .sort((a, b) => b.frameMs - a.frameMs)
                .slice(0, Math.max(1, limit));
        }

        function profileWorstCaseMoments() {
            const scenarios = ['largeFight', 'particlesBurst', 'uiOverlayStack', 'abilitySpam'];
            const rows = scenarios.map((scenario) => {
                const samples = profileSamples.filter((entry) => entry.scenario === scenario);
                if (!samples.length) {
                    return {
                        scenario,
                        count: 0,
                        averageFrameMs: 0,
                        peakFrameMs: 0,
                    };
                }
                const total = samples.reduce((sum, item) => sum + item.frameMs, 0);
                return {
                    scenario,
                    count: samples.length,
                    averageFrameMs: Number((total / samples.length).toFixed(2)),
                    peakFrameMs: Number(Math.max(...samples.map((item) => item.frameMs)).toFixed(2)),
                };
            });
            return rows.sort((a, b) => b.peakFrameMs - a.peakFrameMs);
        }

        function registerNonCriticalSystem(systemName, optionsForSystem = {}) {
            nonCriticalSystems.set(systemName, {
                intervalFrames: Math.max(1, Number(optionsForSystem.intervalFrames) || 1),
                lane: optionsForSystem.lane || 'default',
                lastRunFrame: -1,
            });
        }

        function shouldRunSystem(systemName, frameNumber) {
            const config = nonCriticalSystems.get(systemName);
            if (!config) return true;
            const frame = Number(frameNumber) || 0;
            if (config.lastRunFrame < 0 || frame - config.lastRunFrame >= config.intervalFrames) {
                config.lastRunFrame = frame;
                return true;
            }
            return false;
        }

        function enqueueWorkerJob(job) {
            if (!job || typeof job.execute !== 'function') return false;
            workerQueue.push(job);
            return true;
        }

        function drainWorkerJobs(maxJobsPerTick = 2) {
            const completed = [];
            const allowed = Math.max(1, Number(maxJobsPerTick) || 1);
            while (completed.length < allowed && workerQueue.length) {
                const job = workerQueue.shift();
                completed.push(job.execute());
            }
            return completed;
        }

        return {
            hitchThresholdMs,
            platform,
            recordHitch,
            getTopHitches,
            planShaderPrewarm,
            planStreaming,
            chooseFallback,
            getMemoryPolicy,
            profileFrame,
            getMainThreadProfile,
            profileWorstCaseMoments,
            registerNonCriticalSystem,
            shouldRunSystem,
            enqueueWorkerJob,
            drainWorkerJobs,
            createObjectPool,
            frameBudgetGuard: budgetGuard,
        };
    }

    return { createRuntime, normalizePlatform, createObjectPool, createFrameBudgetGuard };
}));
