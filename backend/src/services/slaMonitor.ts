import { slaDefaults } from '../config/constants.js';
import type { SlaConfig, SlaTarget } from '../types/config.js';
import type { SlaMetricsSnapshot } from '../types/metrics.js';

const normalizeKey = (method: string, route: string) => `${method.toUpperCase()} ${route}`;

const defaultSample = () => ({
    total: 0,
    success: 0,
    durations: [] as number[],
    lastUpdatedAt: null as string | null,
    breaches: 0,
});

let config: SlaConfig = { ...slaDefaults };
const samples = new Map<string, ReturnType<typeof defaultSample>>();

export const configureSlaMonitor = (overrides?: Partial<SlaConfig>) => {
    if (!overrides) return;
    const next: SlaConfig = {
        ...config,
        ...overrides,
        targets: overrides.targets ?? config.targets,
    };
    config = next;
};

const findTarget = (method: string, route?: string): SlaTarget | null => {
    if (!route) return null;
    return config.targets.find((target) => target.method === method.toUpperCase() && target.route === route) ?? null;
};

export const recordSlaSample = (input: {
    method: string;
    route?: string;
    statusCode: number;
    durationMs: number;
}) => {
    const target = findTarget(input.method, input.route);
    if (!target) return;

    const key = normalizeKey(target.method, target.route);
    const bucket = samples.get(key) ?? defaultSample();
    bucket.total += 1;
    if (input.statusCode < 500) {
        bucket.success += 1;
    }
    bucket.durations.push(Math.max(0, input.durationMs));
    bucket.lastUpdatedAt = new Date().toISOString();

    if (bucket.durations.length > 1_000) {
        bucket.durations.shift();
    }

    const availability = bucket.total ? bucket.success / bucket.total : 1;
    const sorted = [...bucket.durations].sort((a, b) => a - b);
    const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] : 0;
    if (availability < target.availabilityTarget || p95 > target.p95TargetMs) {
        bucket.breaches += 1;
    }

    samples.set(key, bucket);
};

export const getSlaSnapshot = (): SlaMetricsSnapshot => {
    const targets = config.targets.map((target) => {
        const key = normalizeKey(target.method, target.route);
        const bucket = samples.get(key) ?? defaultSample();
        const availability = bucket.total ? bucket.success / bucket.total : 1;
        const sorted = [...bucket.durations].sort((a, b) => a - b);
        const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] : 0;

        return {
            id: target.id,
            method: target.method,
            route: target.route,
            windowSamples: bucket.total,
            availability,
            availabilityTarget: target.availabilityTarget,
            p95Ms: p95,
            p95TargetMs: target.p95TargetMs,
            lastUpdatedAt: bucket.lastUpdatedAt,
            breaches: bucket.breaches,
        };
    });

    return {
        targets,
        windowMs: config.sampleWindowMs,
    };
};

export const resetSlaSamplesForTests = () => {
    samples.clear();
};
