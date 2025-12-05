import type { SafePrismaClient } from '../../types/prisma.js';
import { cacheMonitoringConfig } from '../../config/constants.js';
import { createRecurringTask } from '../../patterns/recurringTask.js';
import { recordMonitoringEvent } from './monitoring.js';

export type CacheMetricsSnapshot = {
  hits: number;
  misses: number;
  redisHits: number;
  memoryHits: number;
  hitRatio: number;
  windowSamples: number;
};

type CacheMetricsState = {
  hits: number;
  misses: number;
  redisHits: number;
  memoryHits: number;
};

const state: CacheMetricsState = {
  hits: 0,
  misses: 0,
  redisHits: 0,
  memoryHits: 0,
};

let prismaResolver: (() => SafePrismaClient | undefined) | null = null;

const resolvePrisma = (): SafePrismaClient | undefined => prismaResolver?.();

export const registerCacheMetricsPrismaResolver = (
  resolver: () => SafePrismaClient | undefined,
): void => {
  prismaResolver = resolver;
};

const resetState = () => {
  state.hits = 0;
  state.misses = 0;
  state.redisHits = 0;
  state.memoryHits = 0;
};

const snapshotState = (): CacheMetricsSnapshot => {
  const total = state.hits + state.misses;
  const ratio = total === 0 ? 0 : state.hits / total;
  return {
    hits: state.hits,
    misses: state.misses,
    redisHits: state.redisHits,
    memoryHits: state.memoryHits,
    hitRatio: ratio,
    windowSamples: total,
  };
};

const snapshotAndReset = (): CacheMetricsSnapshot | null => {
  const snapshot = snapshotState();
  if (snapshot.windowSamples === 0) {
    return null;
  }
  resetState();
  return snapshot;
};

export const recordCacheHit = (source: 'redis' | 'memory'): void => {
  if (!cacheMonitoringConfig.enabled) {
    return;
  }
  state.hits += 1;
  if (source === 'redis') {
    state.redisHits += 1;
  } else {
    state.memoryHits += 1;
  }
};

export const recordCacheMiss = (): void => {
  if (!cacheMonitoringConfig.enabled) {
    return;
  }
  state.misses += 1;
};

export const getCacheMetricsSnapshot = (): CacheMetricsSnapshot => snapshotState();

const reportCacheMetrics = async (): Promise<void> => {
  if (!cacheMonitoringConfig.enabled) {
    return;
  }
  const snapshot = snapshotAndReset();
  if (!snapshot || snapshot.windowSamples < cacheMonitoringConfig.minSamples) {
    return;
  }
  const { hitRatio } = snapshot;
  if (hitRatio >= cacheMonitoringConfig.warnThreshold) {
    return;
  }
  const severity =
    hitRatio < cacheMonitoringConfig.criticalThreshold ? 'critical' : 'warning';
  await recordMonitoringEvent(resolvePrisma(), {
    category: 'cache',
    severity,
    message: 'Cache hit ratio dropped below target',
    resource: 'cache-store',
    metadata: {
      ...snapshot,
      warnThreshold: cacheMonitoringConfig.warnThreshold,
      criticalThreshold: cacheMonitoringConfig.criticalThreshold,
      intervalMs: cacheMonitoringConfig.reportIntervalMs,
    },
  });
};

const reporter = cacheMonitoringConfig.enabled
  ? createRecurringTask({
    name: 'cache-hit-miss-monitor',
    intervalMs: cacheMonitoringConfig.reportIntervalMs,
    run: () => reportCacheMetrics(),
    immediate: false,
  })
  : null;

export const shutdownCacheMetrics = (): void => {
  reporter?.dispose();
  resetState();
};
