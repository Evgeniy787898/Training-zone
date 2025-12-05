import os from 'node:os';
import { resourceMetricsDefaults } from '../../config/constants.js';
import type { ResourceMetricsConfig, ResourceMetricsSnapshot } from '../../types/metrics.js';

const toMb = (bytes: number): number => {
  if (!Number.isFinite(bytes)) {
    return 0;
  }
  return Math.round((bytes / (1024 * 1024)) * 100) / 100;
};

let config: ResourceMetricsConfig = resourceMetricsDefaults;
let sampler: NodeJS.Timeout | null = null;
let lastCpuUsage = process.cpuUsage();
let lastHrTime = process.hrtime.bigint();
let cachedSnapshot: ResourceMetricsSnapshot | null = null;
let cachedAt = 0;

const defaultDbMetrics: ResourceMetricsSnapshot['dbConnections'] = {
  limit: null,
  mode: 'unknown',
  active: 0,
  queueSize: 0,
  lastUpdatedAt: null,
};

let dbMetrics: ResourceMetricsSnapshot['dbConnections'] = { ...defaultDbMetrics };

const buildSnapshot = (): ResourceMetricsSnapshot => {
  const memory = process.memoryUsage();
  const currentCpuUsage = process.cpuUsage();
  const nowHr = process.hrtime.bigint();

  const cpuDiffUser = currentCpuUsage.user - lastCpuUsage.user;
  const cpuDiffSystem = currentCpuUsage.system - lastCpuUsage.system;
  const elapsedMicros = Number(nowHr - lastHrTime) / 1000;
  lastCpuUsage = currentCpuUsage;
  lastHrTime = nowHr;

  const cpuPercent = elapsedMicros > 0 ? Math.min(Math.max(((cpuDiffUser + cpuDiffSystem) / elapsedMicros) * 100, 0), 100) : 0;

  return {
    lastUpdatedAt: new Date().toISOString(),
    process: {
      rssMb: toMb(memory.rss),
      heapTotalMb: toMb(memory.heapTotal),
      heapUsedMb: toMb(memory.heapUsed),
      externalMb: toMb(memory.external),
      arrayBuffersMb: toMb(memory.arrayBuffers),
    },
    cpu: {
      percent: Math.round(cpuPercent * 100) / 100,
      userMs: Math.round((cpuDiffUser / 1000) * 100) / 100,
      systemMs: Math.round((cpuDiffSystem / 1000) * 100) / 100,
      cores: os.cpus().length || 1,
    },
    dbConnections: dbMetrics,
  };
};

const ensureSampler = () => {
  if (sampler) {
    return;
  }
  sampler = setInterval(() => {
    cachedSnapshot = buildSnapshot();
    cachedAt = Date.now();
  }, config.sampleIntervalMs);
  sampler.unref();
};

const refreshSnapshotIfNeeded = () => {
  const now = Date.now();
  if (!cachedSnapshot || now - cachedAt > config.snapshotTtlMs) {
    cachedSnapshot = buildSnapshot();
    cachedAt = now;
  }
};

export const configureResourceMetrics = (overrides: Partial<ResourceMetricsConfig> = {}): void => {
  config = Object.freeze({
    sampleIntervalMs: overrides.sampleIntervalMs ?? resourceMetricsDefaults.sampleIntervalMs,
    snapshotTtlMs: overrides.snapshotTtlMs ?? resourceMetricsDefaults.snapshotTtlMs,
  });

  if (sampler) {
    clearInterval(sampler);
    sampler = null;
  }

  cachedSnapshot = null;
  cachedAt = 0;
  ensureSampler();
};

export const updateDbConnectionMetrics = (
  updates: Partial<Omit<ResourceMetricsSnapshot['dbConnections'], 'lastUpdatedAt'>>,
): void => {
  dbMetrics = {
    ...dbMetrics,
    ...updates,
    lastUpdatedAt: new Date().toISOString(),
  };
};

export const resetResourceMetricsForTests = (): void => {
  if (sampler) {
    clearInterval(sampler);
    sampler = null;
  }
  cachedSnapshot = null;
  cachedAt = 0;
  lastCpuUsage = process.cpuUsage();
  lastHrTime = process.hrtime.bigint();
  dbMetrics = { ...defaultDbMetrics };
  ensureSampler();
};

export const getResourceMetricsSnapshot = (): ResourceMetricsSnapshot => {
  refreshSnapshotIfNeeded();
  return cachedSnapshot ?? buildSnapshot();
};

// Initialize with defaults on module load
ensureSampler();
