import type { WebVitalMetric, WebVitalReport } from '../../types/metrics.js';

export interface WebVitalMetricSnapshot {
    metric: WebVitalMetric;
    total: number;
    good: number;
    needsImprovement: number;
    poor: number;
    lastValue?: number;
    lastTimestamp?: number;
}

export interface WebVitalsMetricsSnapshot {
    updatedAt: string | null;
    metrics: WebVitalMetricSnapshot[];
}

type MutableMetric = {
    total: number;
    good: number;
    needsImprovement: number;
    poor: number;
    lastValue?: number;
    lastTimestamp?: number;
};

const store: Record<WebVitalMetric, MutableMetric> = {
    CLS: { total: 0, good: 0, needsImprovement: 0, poor: 0 },
    FID: { total: 0, good: 0, needsImprovement: 0, poor: 0 },
    INP: { total: 0, good: 0, needsImprovement: 0, poor: 0 },
    LCP: { total: 0, good: 0, needsImprovement: 0, poor: 0 },
    TTFB: { total: 0, good: 0, needsImprovement: 0, poor: 0 },
    FCP: { total: 0, good: 0, needsImprovement: 0, poor: 0 },
};

let updatedAt: string | null = null;

export const resetWebVitalMetrics = () => {
    Object.keys(store).forEach((key) => {
        const metric = key as WebVitalMetric;
        store[metric] = { total: 0, good: 0, needsImprovement: 0, poor: 0 };
    });
    updatedAt = null;
};

export const recordWebVitalMetric = (report: WebVitalReport) => {
    const entry = store[report.metric] ?? (store[report.metric as WebVitalMetric] = {
        total: 0,
        good: 0,
        needsImprovement: 0,
        poor: 0,
    });

    entry.total += 1;
    if (report.rating === 'good') entry.good += 1;
    if (report.rating === 'needs-improvement') entry.needsImprovement += 1;
    if (report.rating === 'poor') entry.poor += 1;

    entry.lastValue = report.value;
    entry.lastTimestamp = report.timestamp;
    updatedAt = new Date().toISOString();
};

export const getWebVitalsMetricsSnapshot = (): WebVitalsMetricsSnapshot => ({
    updatedAt,
    metrics: (Object.keys(store) as WebVitalMetric[]).map((metric) => ({
        metric,
        ...store[metric],
    })),
});
