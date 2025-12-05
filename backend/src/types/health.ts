import type { CacheFallbackSnapshot } from '../modules/infrastructure/cache.js';
import type {
    BusinessMetricsSnapshot,
    CapacityPlanningSnapshot,
    PerformanceMetricsSnapshot,
    ResourceMetricsSnapshot,
    WebVitalMetricsSnapshot,
    SlaMetricsSnapshot,
    SlowQueryMetricsSnapshot,
} from './metrics.js';

export type HealthStatus = 'ok' | 'degraded' | 'unhealthy';
export type HealthDependencyStatus = 'ok' | 'degraded' | 'unhealthy' | 'disabled' | 'unknown';

export type CacheHealthSnapshot = {
    status: HealthDependencyStatus;
    mode: CacheFallbackSnapshot['mode'];
    reason: string | null;
};

export type MicroserviceHealthSnapshot = {
    status: 'ok' | 'degraded' | 'unavailable' | 'disabled';
    checkedAt: string;
    latencyMs?: number;
    upstreamStatus?: string;
    errorCode?: string;
    message?: string;
};

export type HealthDependencies = {
    database: ReturnType<typeof import('../modules/database/databaseAvailability.js').getDatabaseAvailabilitySnapshot>;
    cache: CacheHealthSnapshot;
    microservices: Record<string, MicroserviceHealthSnapshot>;
};

export type HealthSnapshot = {
    status: HealthStatus;
    service: string;
    timestamp: string;
    uptimeMs: number;
    meta: { traceId: string };
    dependencies: HealthDependencies;
    metrics: {
        performance: PerformanceMetricsSnapshot;
        resources: ResourceMetricsSnapshot;
        logs: ReturnType<typeof import('../modules/analytics/logMetrics.js').getLogMetricsSnapshot>;
        business: BusinessMetricsSnapshot;
        slowQueries: SlowQueryMetricsSnapshot;
        webVitals?: WebVitalMetricsSnapshot;
        sla?: SlaMetricsSnapshot;
        capacity?: CapacityPlanningSnapshot;
    };
};
