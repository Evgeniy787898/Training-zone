import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCacheState = {
    enabled: true,
    mode: 'ready',
    failureCount: 0,
    lastFailureAt: null,
    fallbackUntil: null,
    reason: null,
};

vi.mock('../cache.js', () => ({
    getCacheFallbackState: vi.fn(() => mockCacheState),
    getCacheRedisConfig: vi.fn(() => ({
        url: 'redis://cache',
        options: { maxRetriesPerRequest: 1, enableReadyCheck: true, lazyConnect: true },
    })),
}));

vi.mock('../databaseAvailability.js', () => ({
    getDatabaseAvailabilitySnapshot: vi.fn(() => ({
        status: 'available',
        degradedUntil: undefined,
        retryAfterMs: undefined,
        lastFailureAt: undefined,
        lastSuccessAt: Date.now(),
        lastError: undefined,
    })),
}));

vi.mock('../performanceMetrics.js', () => ({
    getPerformanceMetricsSnapshot: vi.fn(() => ({
        totals: { requests: 1, responses: 1, errors: 0, inFlight: 0 },
        latency: { avgMs: 10, p95Ms: 12, minMs: 8, maxMs: 15, samples: 3 },
        throughput: { windowMs: 1_000, perSecond: 1, perMinute: 60, sampleCount: 3 },
        slowRequests: [],
        lastUpdatedAt: new Date().toISOString(),
    })),
}));

vi.mock('../resourceMetrics.js', () => ({
    getResourceMetricsSnapshot: vi.fn(() => ({
        lastUpdatedAt: new Date().toISOString(),
        process: { rssMb: 100, heapTotalMb: 50, heapUsedMb: 25, externalMb: 5, arrayBuffersMb: 2 },
        cpu: { percent: 10, userMs: 100, systemMs: 50, cores: 4 },
        dbConnections: { limit: 10, mode: 'pool', active: 1, queueSize: 0, lastUpdatedAt: new Date().toISOString() },
    })),
}));

vi.mock('../logMetrics.js', () => ({
    getLogMetricsSnapshot: vi.fn(() => ({
        counts: { debug: 0, info: 1, warn: 0, error: 0 },
        lastEventAt: { debug: null, info: new Date().toISOString(), warn: null, error: null },
        total: 1,
    })),
}));

vi.mock('../businessMetrics.js', () => ({
    getBusinessMetricsSnapshot: vi.fn(async () => ({
        status: 'ok',
        windowDays: 7,
        lastUpdatedAt: new Date().toISOString(),
        activeProfiles: 5,
        newProfiles: 1,
        achievementsAwarded: 2,
        sessions: {
            total: 10,
            planned: 2,
            inProgress: 3,
            done: 4,
            skipped: 1,
            completionRate: 0.4,
            avgPerActiveProfile: 2,
        },
    })),
}));

const callMicroservice = vi.fn();

vi.mock('../microserviceGateway.js', () => ({
    callMicroservice: (...args: unknown[]) => callMicroservice(...args),
}));

vi.mock('../config/constants.js', () => ({
    databaseAvailabilityDefaults: { degradedCooldownMs: 30_000, retryAfterMs: 15_000, healthSnapshotTtlMs: 5_000 },
    microserviceClients: {
        aiAdvisor: { enabled: true, baseUrl: 'http://advisor', timeoutMs: 5_000, token: null },
    },
}));

import { getHealthSnapshot, resetHealthSnapshotCache } from '../health.js';

describe('health snapshot', () => {
    beforeEach(() => {
        resetHealthSnapshotCache();
        callMicroservice.mockResolvedValue({ status: 'ok' });
        mockCacheState.mode = 'ready';
    });

    it('returns ok status when dependencies are healthy', async () => {
        const snapshot = await getHealthSnapshot({ prisma: null, traceId: 'trace-test' });

        expect(snapshot.status).toBe('ok');
        expect(snapshot.dependencies.cache.status).toBe('ok');
        expect(snapshot.dependencies.microservices.aiAdvisor.status).toBe('ok');
        expect(snapshot.meta.traceId).toBe('trace-test');
    });

    it('downgrades to degraded when cache is in fallback mode', async () => {
        mockCacheState.mode = 'fallback';
        resetHealthSnapshotCache();

        const snapshot = await getHealthSnapshot({ prisma: null, traceId: 'trace-fallback' });

        expect(snapshot.dependencies.cache.status).toBe('degraded');
        expect(snapshot.status).toBe('degraded');
    });

    it('marks microservice failures as unhealthy', async () => {
        callMicroservice.mockRejectedValueOnce(new Error('offline'));
        resetHealthSnapshotCache();

        const snapshot = await getHealthSnapshot({ prisma: null, traceId: 'trace-fail' });

        expect(snapshot.dependencies.microservices.aiAdvisor.status).toBe('unavailable');
        expect(snapshot.status).toBe('unhealthy');
    });
});
