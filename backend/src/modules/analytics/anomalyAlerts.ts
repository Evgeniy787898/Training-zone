import { anomalyAlertDefaults } from '../../config/constants.js';
import type { CapacityPlanningSnapshot, PerformanceMetricsSnapshot, ResourceMetricsSnapshot, SlaMetricsSnapshot } from '../../types/metrics.js';
import type { SafePrismaClient } from '../../types/prisma.js';
import { recordMonitoringEvent } from '../infrastructure/monitoring.js';

let config = { ...anomalyAlertDefaults };

export const configureAnomalyAlerts = (overrides?: Partial<typeof config>) => {
  if (!overrides) return;
  config = { ...config, ...overrides };
};

export const evaluateAnomalies = async (input: {
  prisma: SafePrismaClient | null;
  performance: PerformanceMetricsSnapshot;
  resources: ResourceMetricsSnapshot;
  sla?: SlaMetricsSnapshot;
  capacity?: CapacityPlanningSnapshot;
}) => {
  const events: Array<Parameters<typeof recordMonitoringEvent>[1]> = [];

  const latency = input.performance.latency.p95Ms;
  if (latency >= config.latencyCriticalMs) {
    events.push({
      category: 'anomaly',
      severity: 'critical',
      message: `High p95 latency: ${Math.round(latency)}ms`,
      metadata: { p95: latency },
    });
  } else if (latency >= config.latencyWarnMs) {
    events.push({
      category: 'anomaly',
      severity: 'warning',
      message: `Elevated p95 latency: ${Math.round(latency)}ms`,
      metadata: { p95: latency },
    });
  }

  const errorRate = input.performance.errorRate;
  if (errorRate >= config.errorRateCritical) {
    events.push({
      category: 'error_rate',
      severity: 'critical',
      message: `Critical error rate ${(errorRate * 100).toFixed(2)}%`,
      metadata: { errorRate },
    });
  } else if (errorRate >= config.errorRateWarn) {
    events.push({
      category: 'error_rate',
      severity: 'warning',
      message: `Elevated error rate ${(errorRate * 100).toFixed(2)}%`,
      metadata: { errorRate },
    });
  }

  if (input.resources.cpu.percent >= config.cpuCritical) {
    events.push({
      category: 'resources',
      severity: 'critical',
      message: `CPU usage high: ${input.resources.cpu.percent.toFixed(1)}%`,
    });
  } else if (input.resources.cpu.percent >= config.cpuWarn) {
    events.push({
      category: 'resources',
      severity: 'warning',
      message: `CPU usage elevated: ${input.resources.cpu.percent.toFixed(1)}%`,
    });
  }

  const memPercent = input.resources.process.heapTotalMb
    ? (input.resources.process.heapUsedMb / Math.max(input.resources.process.heapTotalMb, 1)) * 100
    : 0;
  if (memPercent >= config.memoryCritical) {
    events.push({ category: 'resources', severity: 'critical', message: `Memory usage high: ${memPercent.toFixed(1)}%` });
  } else if (memPercent >= config.memoryWarn) {
    events.push({ category: 'resources', severity: 'warning', message: `Memory usage elevated: ${memPercent.toFixed(1)}%` });
  }

  if (input.sla) {
    for (const target of input.sla.targets) {
      if (target.windowSamples === 0) continue;
      const availabilityBreached = target.availability < target.availabilityTarget;
      const latencyBreached = target.p95Ms > target.p95TargetMs;
      if (availabilityBreached || latencyBreached) {
        events.push({
          category: 'sla',
          severity: availabilityBreached ? 'critical' : 'warning',
          message: `SLA drift for ${target.method} ${target.route}`,
          metadata: {
            availability: target.availability,
            availabilityTarget: target.availabilityTarget,
            p95: target.p95Ms,
            p95Target: target.p95TargetMs,
          },
        });
      }
    }
  }

  if (input.capacity?.recommendedInstances && input.capacity.recommendedInstances > 1) {
    events.push({
      category: 'capacity',
      severity: 'warning',
      message: `Capacity headroom low; consider ${input.capacity.recommendedInstances} instances`,
      metadata: { rationale: input.capacity.rationale },
    });
  }

  for (const event of events) {
    await recordMonitoringEvent(input.prisma ?? undefined, event);
  }
};
