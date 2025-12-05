import { performanceMetricsDefaults } from '../../config/constants.js';
import type {
    CompletedRequestMetricsInput,
    PerformanceMetricsConfig,
    PerformanceMetricsSnapshot,
} from '../../types/metrics.js';

const defaultTotals = () => ({ requests: 0, responses: 0, errors: 0 });

let config: PerformanceMetricsConfig = { ...performanceMetricsDefaults };
let totals = defaultTotals();
let inFlight = 0;
const latencySamples: number[] = [];
const throughputEvents: number[] = [];
const slowRequests: PerformanceMetricsSnapshot['slowRequests'] = [];
let lastUpdatedAt: string | null = null;

const pruneLatencySamples = () => {
    while (latencySamples.length > config.latencySampleSize) {
        latencySamples.shift();
    }
};

const pruneThroughputEvents = (now: number) => {
    const threshold = now - config.throughputWindowMs;
    while (throughputEvents.length && throughputEvents[0] < threshold) {
        throughputEvents.shift();
    }
};

const sanitizeNumber = (value: number | undefined, min: number, max: number) => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return undefined;
    }
    if (!Number.isFinite(value)) {
        return undefined;
    }
    return Math.min(Math.max(Math.floor(value), min), max);
};

export const configurePerformanceMetrics = (overrides: Partial<PerformanceMetricsConfig>) => {
    const sanitized: any = {};
    const latency = sanitizeNumber(overrides.latencySampleSize, 10, 10_000);
    if (latency) {
        sanitized.latencySampleSize = latency;
    }
    const throughput = sanitizeNumber(overrides.throughputWindowMs, 1_000, 15 * 60 * 1000);
    if (throughput) {
        sanitized.throughputWindowMs = throughput;
    }
    const slowThreshold = sanitizeNumber(overrides.slowRequestThresholdMs, 50, 10 * 60 * 1000);
    if (slowThreshold) {
        sanitized.slowRequestThresholdMs = slowThreshold;
    }
    const slowSamples = sanitizeNumber(overrides.slowRequestSampleSize, 5, 500);
    if (slowSamples) {
        sanitized.slowRequestSampleSize = slowSamples;
    }

    config = { ...config, ...sanitized };
};

export const recordRequestStart = () => {
    totals.requests += 1;
    inFlight += 1;
};

export const recordRequestEnd = (input: CompletedRequestMetricsInput) => {
    if (inFlight > 0) {
        inFlight -= 1;
    }
    totals.responses += 1;
    if (input.statusCode >= 500) {
        totals.errors += 1;
    }

    const safeDuration = Math.max(0, Number.isFinite(input.durationMs) ? input.durationMs : 0);
    latencySamples.push(safeDuration);
    pruneLatencySamples();

    const now = Date.now();
    throughputEvents.push(now);
    pruneThroughputEvents(now);

    if (safeDuration >= config.slowRequestThresholdMs) {
        slowRequests.unshift({
            method: input.method,
            path: input.path,
            route: input.route,
            statusCode: input.statusCode,
            durationMs: safeDuration,
            timestamp: new Date(now).toISOString(),
            traceId: input.traceId,
        });
        if (slowRequests.length > config.slowRequestSampleSize) {
            slowRequests.pop();
        }
    }

    lastUpdatedAt = new Date(now).toISOString();
};

const computeLatencyStats = () => {
    if (!latencySamples.length) {
        return {
            avgMs: 0,
            p95Ms: 0,
            minMs: null,
            maxMs: null,
            samples: 0,
        } as PerformanceMetricsSnapshot['latency'];
    }

    const sorted = [...latencySamples].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, value) => acc + value, 0);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * 0.95) - 1));

    return {
        avgMs: sum / sorted.length,
        p95Ms: sorted[index],
        minMs: sorted[0],
        maxMs: sorted[sorted.length - 1],
        samples: sorted.length,
    } satisfies PerformanceMetricsSnapshot['latency'];
};

const computeThroughputStats = (): PerformanceMetricsSnapshot['throughput'] => {
    const now = Date.now();
    pruneThroughputEvents(now);
    const windowSeconds = config.throughputWindowMs / 1000;
    const perSecond = throughputEvents.length / Math.max(windowSeconds, 1);
    return {
        windowMs: config.throughputWindowMs,
        perSecond,
        perMinute: perSecond * 60,
        sampleCount: throughputEvents.length,
    };
};

export const getPerformanceMetricsSnapshot = (): PerformanceMetricsSnapshot => ({
    totals: {
        requests: totals.requests,
        responses: totals.responses,
        errors: totals.errors,
        inFlight,
    },
    errorRate: totals.responses ? totals.errors / totals.responses : 0,
    latency: computeLatencyStats(),
    throughput: computeThroughputStats(),
    slowRequests: [...slowRequests],
    lastUpdatedAt,
});

export const resetPerformanceMetrics = () => {
    totals = defaultTotals();
    inFlight = 0;
    latencySamples.length = 0;
    throughputEvents.length = 0;
    slowRequests.length = 0;
    lastUpdatedAt = null;
};
