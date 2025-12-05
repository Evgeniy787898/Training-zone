import type {
    BusinessMetricsConfig,
    MetricsDashboardConfig,
    PerformanceMetricsConfig,
    ResourceMetricsConfig,
} from './config.js';
import type { HealthDependencies, HealthStatus } from './health.js';

export type { BusinessMetricsConfig, PerformanceMetricsConfig, ResourceMetricsConfig };
export type { MetricsDashboardConfig };

export interface PerformanceMetricsSnapshot {
    totals: {
        requests: number;
        responses: number;
        errors: number;
        inFlight: number;
    };
    errorRate: number;
    latency: {
        avgMs: number;
        p95Ms: number;
        minMs: number | null;
        maxMs: number | null;
        samples: number;
    };
    throughput: {
        windowMs: number;
        perSecond: number;
        perMinute: number;
        sampleCount: number;
    };
    slowRequests: Array<{
        method: string;
        path: string;
        route?: string;
        statusCode: number;
        durationMs: number;
        timestamp: string;
        traceId?: string;
    }>;
    lastUpdatedAt: string | null;
}

export interface SlowQueryMetricsSnapshot {
    total: number;
    lastAt: string | null;
    lastDurationMs: number | null;
    lastTarget: string | null;
    thresholdMs: number;
    recentCount: number;
    recentP95Ms: number | null;
}

export interface CompletedRequestMetricsInput {
    durationMs: number;
    method: string;
    path: string;
    route?: string;
    statusCode: number;
    traceId?: string;
}

export interface ResourceMetricsSnapshot {
    lastUpdatedAt: string | null;
    process: {
        rssMb: number;
        heapTotalMb: number;
        heapUsedMb: number;
        externalMb: number;
        arrayBuffersMb: number;
    };
    cpu: {
        percent: number;
        userMs: number;
        systemMs: number;
        cores: number;
    };
    dbConnections: {
        limit: number | null;
        mode: 'pool' | 'direct' | 'unknown';
        active: number;
        queueSize: number;
        lastUpdatedAt: string | null;
    };
}

export interface SlaMetricsSnapshot {
    targets: Array<{
        id: string;
        method: string;
        route: string;
        windowSamples: number;
        availability: number;
        availabilityTarget: number;
        p95Ms: number;
        p95TargetMs: number;
        lastUpdatedAt: string | null;
        breaches: number;
    }>;
    windowMs: number;
}

export interface CapacityPlanningSnapshot {
    recommendedInstances: number | null;
    rationale: string;
    inputs: {
        throughputPerSecond: number;
        targetPerInstance: number;
        cpuPercent: number;
        memoryPercent: number;
    };
}

export interface BusinessMetricsSnapshot {
    status: 'ok' | 'degraded';
    windowDays: number;
    lastUpdatedAt: string | null;
    activeProfiles: number;
    newProfiles: number;
    achievementsAwarded: number;
    sessions: {
        total: number;
        planned: number;
        inProgress: number;
        done: number;
        skipped: number;
        completionRate: number;
        avgPerActiveProfile: number;
    };
}

export type WebVitalMetric = 'CLS' | 'FID' | 'INP' | 'LCP' | 'TTFB' | 'FCP';

export interface WebVitalReport {
    metric: WebVitalMetric;
    value: number;
    rating: 'good' | 'needs-improvement' | 'poor';
    navigationType?: string;
    page?: string;
    sessionId?: string;
    timestamp: number;
}

export interface WebVitalMetricsSnapshot {
    updatedAt: string | null;
    metrics: Array<{
        metric: WebVitalMetric;
        total: number;
        good: number;
        needsImprovement: number;
        poor: number;
        lastValue?: number;
        lastTimestamp?: number;
    }>;
}

export interface MetricsDashboardEntry {
    timestamp: string;
    status: HealthStatus;
    performance: PerformanceMetricsSnapshot;
    resources: ResourceMetricsSnapshot;
    business: BusinessMetricsSnapshot;
    sla?: SlaMetricsSnapshot;
    capacity?: CapacityPlanningSnapshot;
    dependencies: HealthDependencies;
}

export interface MetricsDashboardSnapshot {
    config: MetricsDashboardConfig;
    entries: MetricsDashboardEntry[];
    lastRecordedAt: string | null;
}
