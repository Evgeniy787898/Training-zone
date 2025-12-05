import { capacityPlanningDefaults } from '../../config/constants.js';
import type { CapacityPlanningConfig } from '../../types/config.js';
import type { CapacityPlanningSnapshot, PerformanceMetricsSnapshot, ResourceMetricsSnapshot } from '../../types/metrics.js';

let config: CapacityPlanningConfig = { ...capacityPlanningDefaults };

export const configureCapacityPlanning = (overrides?: Partial<CapacityPlanningConfig>) => {
  if (!overrides) return;
  config = { ...config, ...overrides };
};

export const computeCapacityPlan = (
  performance: PerformanceMetricsSnapshot,
  resources: ResourceMetricsSnapshot,
): CapacityPlanningSnapshot => {
  const throughput = performance.throughput.perSecond;
  const cpuPercent = resources.cpu.percent;
  const memoryPercent = resources.process.heapUsedMb && resources.process.heapTotalMb
    ? (resources.process.heapUsedMb / resources.process.heapTotalMb) * 100
    : resources.process.heapUsedMb;

  const tputPerInstance = Math.max(config.maxThroughputPerInstance, 1);
  const recommended = Math.max(1, Math.ceil(throughput / tputPerInstance));
  const rationale = `p95 latency=${performance.latency.p95Ms}ms throughput=${throughput.toFixed(
    2,
  )}/s cpu=${cpuPercent.toFixed(1)}% mem=${memoryPercent?.toFixed?.(1) ?? 'n/a'}%`;

  return {
    recommendedInstances: Number.isFinite(recommended) ? recommended : null,
    rationale,
    inputs: {
      throughputPerSecond: throughput,
      targetPerInstance: tputPerInstance,
      cpuPercent,
      memoryPercent: Number.isFinite(memoryPercent) ? memoryPercent : 0,
    },
  } satisfies CapacityPlanningSnapshot;
};
