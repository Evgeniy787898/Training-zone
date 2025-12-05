import { describe, expect, beforeEach, it } from 'vitest';
import {
    configurePerformanceMetrics,
    getPerformanceMetricsSnapshot,
    recordRequestEnd,
    recordRequestStart,
    resetPerformanceMetrics,
} from '../performanceMetrics.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('performanceMetrics', () => {
    beforeEach(() => {
        resetPerformanceMetrics();
        configurePerformanceMetrics({
            latencySampleSize: 10,
            throughputWindowMs: 200,
            slowRequestThresholdMs: 5,
            slowRequestSampleSize: 3,
        });
    });

    it('records totals, latency stats and throughput', async () => {
        recordRequestStart();
        await sleep(5);
        recordRequestEnd({
            durationMs: 6,
            method: 'GET',
            path: '/health',
            statusCode: 200,
        });
        recordRequestStart();
        recordRequestEnd({
            durationMs: 12,
            method: 'POST',
            path: '/api/test',
            statusCode: 500,
        });

        const snapshot = getPerformanceMetricsSnapshot();
        expect(snapshot.totals.requests).toBe(2);
        expect(snapshot.totals.responses).toBe(2);
        expect(snapshot.totals.errors).toBe(1);
        expect(snapshot.latency.samples).toBe(2);
        expect(snapshot.latency.maxMs).toBeGreaterThanOrEqual(12);
        expect(snapshot.throughput.sampleCount).toBe(2);
    });

    it('captures slow requests with trace metadata', () => {
        recordRequestStart();
        recordRequestEnd({
            durationMs: 50,
            method: 'GET',
            path: '/slow',
            statusCode: 200,
            traceId: 'trace-1',
        });
        recordRequestStart();
        recordRequestEnd({
            durationMs: 60,
            method: 'GET',
            path: '/slow',
            statusCode: 200,
            traceId: 'trace-2',
        });

        const snapshot = getPerformanceMetricsSnapshot();
        expect(snapshot.slowRequests.length).toBeGreaterThan(0);
        expect(snapshot.slowRequests[0].traceId).toBe('trace-2');
    });
});
