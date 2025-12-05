import { describe, expect, it, beforeEach } from 'vitest';
import {
  configureResourceMetrics,
  getResourceMetricsSnapshot,
  resetResourceMetricsForTests,
  updateDbConnectionMetrics,
} from '../resourceMetrics.js';

describe('resourceMetrics', () => {
  beforeEach(() => {
    resetResourceMetricsForTests();
    configureResourceMetrics({ sampleIntervalMs: 1000, snapshotTtlMs: 0 });
    updateDbConnectionMetrics({ limit: 10, mode: 'pool', active: 0, queueSize: 0 });
  });

  it('returns process and CPU stats', () => {
    const snapshot = getResourceMetricsSnapshot();
    expect(snapshot.process.heapTotalMb).toBeGreaterThan(0);
    expect(snapshot.cpu.cores).toBeGreaterThan(0);
    expect(snapshot.lastUpdatedAt).toBeTruthy();
  });

  it('tracks db connection usage updates', () => {
    updateDbConnectionMetrics({ active: 3, queueSize: 2 });
    const snapshot = getResourceMetricsSnapshot();
    expect(snapshot.dbConnections.active).toBe(3);
    expect(snapshot.dbConnections.queueSize).toBe(2);
    expect(snapshot.dbConnections.limit).toBe(10);
    expect(snapshot.dbConnections.mode).toBe('pool');
    expect(snapshot.dbConnections.lastUpdatedAt).toBeTruthy();
  });
});
