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

    function createRuntime(options = {}) {
        const hitchThresholdMs = Number(options.hitchThresholdMs) > 0 ? Number(options.hitchThresholdMs) : DEFAULT_HITCH_THRESHOLD_MS;
        const platform = normalizePlatform(options.platformHint);
        const memoryBudgetsMb = { ...DEFAULT_MEMORY_BUDGET_MB, ...(options.memoryBudgetsMb || {}) };
        const assets = new Map();
        const hitches = [];
        const hitchAggregates = new Map();

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

        return {
            hitchThresholdMs,
            platform,
            recordHitch,
            getTopHitches,
            planShaderPrewarm,
            planStreaming,
            chooseFallback,
            getMemoryPolicy,
        };
    }

    return { createRuntime, normalizePlatform };
}));
