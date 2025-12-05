import type { PrismaClient } from '@prisma/client';

import { metricsDashboardDefaults } from '../config/constants.js';
import { createRecurringTask, type RecurringTaskHandle } from '../patterns/recurringTask.js';
import type {
  MetricsDashboardConfig,
  MetricsDashboardEntry,
  MetricsDashboardSnapshot,
} from '../types/metrics.js';
import { ensureTraceId } from './trace.js';
import { getHealthSnapshot } from '../modules/infrastructure/health.js';

let config: MetricsDashboardConfig = { ...metricsDashboardDefaults };
const history: MetricsDashboardEntry[] = [];
let lastRecordedAt = 0;
let sampler: RecurringTaskHandle | null = null;

const pruneHistory = () => {
  while (history.length > config.historySize) {
    history.shift();
  }
};

export const configureMetricsDashboard = (overrides: Partial<MetricsDashboardConfig> = {}): void => {
  const next: any = { ...config };

  if (Number.isFinite(overrides.sampleIntervalMs) && overrides.sampleIntervalMs) {
    next.sampleIntervalMs = Math.min(Math.max(Math.floor(overrides.sampleIntervalMs), 1_000), 60 * 60 * 1000);
  }

  if (Number.isFinite(overrides.historySize) && overrides.historySize) {
    next.historySize = Math.min(Math.max(Math.floor(overrides.historySize), 5), 1_000);
  }

  config = next;

  if (sampler) {
    sampler.dispose();
    sampler = null;
  }
};

const recordSnapshot = async (prisma: PrismaClient | null, traceId?: string): Promise<MetricsDashboardEntry> => {
  const snapshot = await getHealthSnapshot({ prisma, traceId });
  const entry: MetricsDashboardEntry = {
    timestamp: snapshot.timestamp,
    status: snapshot.status,
    performance: snapshot.metrics.performance,
    resources: snapshot.metrics.resources,
    business: snapshot.metrics.business,
    sla: snapshot.metrics.sla,
    capacity: snapshot.metrics.capacity,
    dependencies: snapshot.dependencies,
  };

  history.push(entry);
  lastRecordedAt = Date.now();
  pruneHistory();
  return entry;
};

export const getMetricsDashboardSnapshot = async (
  prisma: PrismaClient | null,
  traceId?: string | null,
): Promise<MetricsDashboardSnapshot> => {
  const now = Date.now();
  if (!history.length || now - lastRecordedAt > config.sampleIntervalMs) {
    await recordSnapshot(prisma, ensureTraceId(traceId));
  }

  return {
    config,
    entries: [...history],
    lastRecordedAt: lastRecordedAt ? new Date(lastRecordedAt).toISOString() : null,
  };
};

export const startMetricsDashboardSampler = (prisma: PrismaClient | null): void => {
  if (sampler) {
    sampler.dispose();
    sampler = null;
  }

  sampler = createRecurringTask({
    name: 'metrics-dashboard-sampler',
    intervalMs: config.sampleIntervalMs,
    run: async () => {
      await recordSnapshot(prisma, ensureTraceId(null));
    },
  });
};

export const stopMetricsDashboardSamplerForTests = (): void => {
  sampler?.dispose();
  sampler = null;
  history.splice(0, history.length);
  lastRecordedAt = 0;
};
