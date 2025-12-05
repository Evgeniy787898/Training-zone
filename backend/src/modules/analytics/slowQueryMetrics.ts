import { slowQueryDefaults } from '../../config/constants.js';
import type { SlowQuerySample } from '../../services/prismaQueryLogging.js';
import type { SlowQueryMetricsSnapshot } from '../../types/metrics.js';

const durationHistory: number[] = [];
let slowQueryCount = 0;
let lastSlowQuery: SlowQuerySample | null = null;
let thresholdMs: number = slowQueryDefaults.thresholdMs;

const percentile = (values: number[], ratio: number): number | null => {
  if (!values.length) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(ratio * (sorted.length - 1)));
  return sorted[index];
};

export const recordSlowQueryMetrics = (sample: SlowQuerySample, currentThreshold: number) => {
  slowQueryCount += 1;
  lastSlowQuery = sample;
  thresholdMs = currentThreshold;
  durationHistory.push(sample.durationMs);
  if (durationHistory.length > slowQueryDefaults.historySize) {
    durationHistory.shift();
  }
};

export const getSlowQueryMetricsSnapshot = (): SlowQueryMetricsSnapshot => {
  return {
    total: slowQueryCount,
    lastAt: lastSlowQuery?.timestamp ?? null,
    lastDurationMs: lastSlowQuery?.durationMs ?? null,
    lastTarget: lastSlowQuery?.target ?? null,
    thresholdMs,
    recentCount: durationHistory.length,
    recentP95Ms: percentile(durationHistory, 0.95),
  };
};

export const resetSlowQueryMetrics = () => {
  slowQueryCount = 0;
  lastSlowQuery = null;
  durationHistory.length = 0;
  thresholdMs = slowQueryDefaults.thresholdMs;
};
