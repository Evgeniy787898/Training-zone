import type { PrismaClient } from '@prisma/client';

import { databaseAvailabilityDefaults, microserviceClients } from '../../config/constants.js';
import { getCacheFallbackState, getCacheRedisConfig } from './cache.js';
import { getDatabaseAvailabilitySnapshot } from '../database/databaseAvailability.js';
import { getBusinessMetricsSnapshot } from '../analytics/businessMetrics.js';
import { getLogMetricsSnapshot } from '../analytics/logMetrics.js';
import { getPerformanceMetricsSnapshot } from '../analytics/performanceMetrics.js';
import { getResourceMetricsSnapshot } from '../analytics/resourceMetrics.js';
import { getSlowQueryMetricsSnapshot } from '../analytics/slowQueryMetrics.js';
import { getWebVitalsMetricsSnapshot } from '../analytics/webVitalsMetrics.js';
import { callMicroservice } from '../../services/microserviceGateway.js';
import { ensureTraceId } from '../../services/trace.js';
import { getSlaSnapshot } from '../../services/slaMonitor.js';
import { computeCapacityPlan } from '../analytics/capacityPlanning.js';
import { evaluateAnomalies } from '../analytics/anomalyAlerts.js';
import type {
  HealthSnapshot,
  HealthStatus,
  MicroserviceHealthSnapshot,
  HealthDependencyStatus,
} from '../../types/health.js';
import { AppError } from '../../services/errors.js';

type HealthSnapshotConfig = {
  ttlMs: number;
  microserviceTimeoutMs: number;
};

const defaultConfig: HealthSnapshotConfig = {
  ttlMs: databaseAvailabilityDefaults.healthSnapshotTtlMs,
  microserviceTimeoutMs: 1_500,
};

let config: HealthSnapshotConfig = { ...defaultConfig };
let cachedSnapshot: { snapshot: HealthSnapshot; expiresAt: number } | null = null;

export const configureHealthSnapshot = (overrides?: Partial<HealthSnapshotConfig>) => {
  if (!overrides) {
    return;
  }

  const ttl = overrides.ttlMs;
  const timeout = overrides.microserviceTimeoutMs;

  config = {
    ttlMs: Number.isFinite(ttl) && ttl && ttl > 0 ? Math.floor(ttl) : config.ttlMs,
    microserviceTimeoutMs:
      Number.isFinite(timeout) && timeout && timeout > 0 ? Math.floor(timeout) : config.microserviceTimeoutMs,
  };
};

export const resetHealthSnapshotCache = () => {
  cachedSnapshot = null;
};

const mapCacheStatus = (): { status: HealthDependencyStatus; mode: string; reason: string | null } => {
  const fallback = getCacheFallbackState();
  const redisConfig = getCacheRedisConfig();

  if (!redisConfig || !fallback.enabled) {
    return { status: 'disabled', mode: fallback.mode, reason: fallback.reason };
  }

  if (fallback.mode === 'fallback') {
    return { status: 'degraded', mode: fallback.mode, reason: fallback.reason };
  }

  if (fallback.mode === 'unknown') {
    return { status: 'unknown', mode: fallback.mode, reason: fallback.reason };
  }

  return { status: 'ok', mode: fallback.mode, reason: fallback.reason };
};

const mapMicroserviceStatus = (status: MicroserviceHealthSnapshot['status']): HealthDependencyStatus => {
  if (status === 'unavailable') {
    return 'unhealthy';
  }
  if (status === 'degraded') {
    return 'degraded';
  }
  return status;
};

const computeOverallStatus = (statuses: HealthDependencyStatus[]): HealthStatus => {
  if (statuses.some((status) => status === 'unhealthy')) {
    return 'unhealthy';
  }
  if (statuses.some((status) => status === 'degraded' || status === 'unknown')) {
    return 'degraded';
  }
  return 'ok';
};

const collectMicroserviceHealth = async (
  traceId: string,
): Promise<Record<string, MicroserviceHealthSnapshot>> => {
  const entries = Object.entries(microserviceClients);

  const results = await Promise.all(
    entries.map(async ([name, clientConfig]: [string, any]) => {
      if (!clientConfig?.enabled || !clientConfig.baseUrl) {
        return [
          name,
          {
            status: 'disabled',
            checkedAt: new Date().toISOString(),
          } satisfies MicroserviceHealthSnapshot,
        ];
      }

      const startedAt = Date.now();

      try {
        const response = await callMicroservice<Record<string, unknown>>(name as any, {
          path: '/api/health',
          traceId,
          timeoutMs: config.microserviceTimeoutMs,
        });

        const latencyMs = Date.now() - startedAt;
        return [
          name,
          {
            status: 'ok',
            latencyMs,
            checkedAt: new Date().toISOString(),
            upstreamStatus: typeof response?.status === 'string' ? response.status : 'ok',
          } satisfies MicroserviceHealthSnapshot,
        ];
      } catch (error) {
        const latencyMs = Date.now() - startedAt;
        const appError = error instanceof AppError ? error : null;
        return [
          name,
          {
            status: 'unavailable',
            latencyMs,
            checkedAt: new Date().toISOString(),
            errorCode: appError?.code ?? 'microservice_unavailable',
            message: appError?.message ?? (error instanceof Error ? error.message : 'unknown error'),
          } satisfies MicroserviceHealthSnapshot,
        ];
      }
    }),
  );

  return Object.fromEntries(results);
};

export const getHealthSnapshot = async (input: {
  prisma: PrismaClient | null;
  traceId?: string | null;
}): Promise<HealthSnapshot> => {
  const now = Date.now();
  if (cachedSnapshot && cachedSnapshot.expiresAt > now) {
    return cachedSnapshot.snapshot;
  }

  const traceId = ensureTraceId(input.traceId);

  const database = getDatabaseAvailabilitySnapshot();
  const cache = mapCacheStatus();
  const performance = getPerformanceMetricsSnapshot();
  const resources = getResourceMetricsSnapshot();
  const logs = getLogMetricsSnapshot();
  const slowQueries = getSlowQueryMetricsSnapshot();
  const webVitals = getWebVitalsMetricsSnapshot();
  const sla = getSlaSnapshot();
  const microservices = await collectMicroserviceHealth(traceId);
  const business = await getBusinessMetricsSnapshot(input.prisma);
  const capacity = computeCapacityPlan(performance, resources);

  const dependencyStatuses: HealthDependencyStatus[] = [
    database.status === 'available' ? 'ok' : 'degraded',
    cache.status,
    business.status === 'ok' ? 'ok' : 'degraded',
    ...Object.values(microservices).map((entry) => mapMicroserviceStatus(entry.status)),
  ];

  const snapshot: HealthSnapshot = {
    status: computeOverallStatus(dependencyStatuses),
    service: 'training-area-api',
    timestamp: new Date(now).toISOString(),
    uptimeMs: Math.round(process.uptime() * 1000),
    meta: { traceId },
    dependencies: {
      database,
      cache: cache as any,
      microservices,
    },
    metrics: {
      performance,
      resources,
      logs,
      business,
      slowQueries,
      webVitals,
      sla,
      capacity,
    },
  };

  await evaluateAnomalies({ prisma: input.prisma, performance, resources, sla, capacity });

  cachedSnapshot = {
    snapshot,
    expiresAt: now + config.ttlMs,
  };

  return snapshot;
};
