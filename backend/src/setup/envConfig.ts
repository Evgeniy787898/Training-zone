import {
    parsePositiveNumber,
    parseNonNegativeNumber,
    parseRatioNumber,
    parseBoolean,
} from '../utils/envParsers.js';
import type {
    DatabaseAvailabilityConfig,
    DatabaseRetryConfig,
    CircuitBreakerConfig,
    RequestTimeoutConfig,
} from '../types/config.js';
import type { CompressionMiddlewareOptions } from '../middleware/compression.js';

export interface EnvConfig {
    databaseAvailability: Partial<DatabaseAvailabilityConfig>;
    databaseRetry: Partial<DatabaseRetryConfig>;
    circuitBreaker: Partial<CircuitBreakerConfig>;
    requestTimeout: Partial<RequestTimeoutConfig>;
    performanceMetrics: any;
    resourceMetrics: any;
    businessMetrics: any;
    metricsDashboard: any;
    health: any;
    compression: CompressionMiddlewareOptions;
    prisma: {
        requestedConcurrency?: number;
        queueWarnSize?: number;
        connectionHeadroom: number;
        poolWarmupTimeout: number;
        preferPool: boolean;
        fallbackPool: boolean;
    };
    allowedOrigins: string[];
    globalRateLimit: number | null;
}

/**
 * Parse and validate all environment variables
 * Consolidates env parsing logic from index.ts
 */
export function parseEnvironmentConfig(): EnvConfig {
    // Database Availability
    const databaseAvailability: any = {};
    const degradedCooldownEnv = parsePositiveNumber(process.env.DATABASE_DEGRADED_COOLDOWN_MS);
    if (degradedCooldownEnv) {
        databaseAvailability.degradedCooldownMs = degradedCooldownEnv;
    }
    const degradedRetryAfterEnv = parsePositiveNumber(process.env.DATABASE_DEGRADED_RETRY_AFTER_MS);
    if (degradedRetryAfterEnv) {
        databaseAvailability.retryAfterMs = degradedRetryAfterEnv;
    }
    const healthSnapshotEnv = parsePositiveNumber(process.env.DATABASE_HEALTH_SNAPSHOT_TTL_MS);
    if (healthSnapshotEnv) {
        databaseAvailability.healthSnapshotTtlMs = healthSnapshotEnv;
    }

    // Database Retry
    const databaseRetry: any = {};
    const retryMaxAttemptsEnv = parsePositiveNumber(process.env.DATABASE_RETRY_MAX_ATTEMPTS);
    if (retryMaxAttemptsEnv) {
        databaseRetry.maxAttempts = retryMaxAttemptsEnv;
    }
    const retryInitialDelayEnv = parsePositiveNumber(process.env.DATABASE_RETRY_INITIAL_DELAY_MS);
    if (retryInitialDelayEnv) {
        databaseRetry.initialDelayMs = retryInitialDelayEnv;
    }
    const retryMaxDelayEnv = parsePositiveNumber(process.env.DATABASE_RETRY_MAX_DELAY_MS);
    if (retryMaxDelayEnv) {
        databaseRetry.maxDelayMs = retryMaxDelayEnv;
    }
    const retryBackoffEnv = parseNonNegativeNumber(process.env.DATABASE_RETRY_BACKOFF_MULTIPLIER);
    if (retryBackoffEnv && retryBackoffEnv > 0) {
        databaseRetry.backoffMultiplier = retryBackoffEnv;
    }
    const retryJitterEnv = parseRatioNumber(process.env.DATABASE_RETRY_JITTER_RATIO);
    if (retryJitterEnv !== null) {
        databaseRetry.jitterRatio = retryJitterEnv;
    }

    // Circuit Breaker
    const circuitBreaker: any = {};
    const cbFailureEnv = parsePositiveNumber(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD);
    if (cbFailureEnv) {
        circuitBreaker.failureThreshold = cbFailureEnv;
    }
    const cbSuccessEnv = parsePositiveNumber(process.env.CIRCUIT_BREAKER_SUCCESS_THRESHOLD);
    if (cbSuccessEnv) {
        circuitBreaker.successThreshold = cbSuccessEnv;
    }
    const cbOpenEnv = parsePositiveNumber(process.env.CIRCUIT_BREAKER_OPEN_DURATION_MS);
    if (cbOpenEnv) {
        circuitBreaker.openDurationMs = cbOpenEnv;
    }
    const cbHalfOpenEnv = parsePositiveNumber(process.env.CIRCUIT_BREAKER_HALF_OPEN_MAX_CONCURRENT);
    if (cbHalfOpenEnv) {
        circuitBreaker.halfOpenMaxConcurrent = cbHalfOpenEnv;
    }

    // Request Timeout
    const requestTimeout: any = {};
    const softTimeoutEnv = parsePositiveNumber(process.env.REQUEST_TIMEOUT_SOFT_MS);
    if (softTimeoutEnv) {
        requestTimeout.softTimeoutMs = softTimeoutEnv;
    }
    const hardTimeoutEnv = parsePositiveNumber(process.env.REQUEST_TIMEOUT_HARD_MS);
    if (hardTimeoutEnv) {
        requestTimeout.hardTimeoutMs = hardTimeoutEnv;
    }
    const timeoutHeader = process.env.REQUEST_TIMEOUT_HEADER?.trim();
    if (timeoutHeader) {
        requestTimeout.headerName = timeoutHeader;
    }

    // Performance Metrics
    const performanceMetrics: any = {};
    const perfLatencyEnv = parsePositiveNumber(process.env.PERF_METRICS_LATENCY_SAMPLE_SIZE);
    if (perfLatencyEnv) {
        performanceMetrics.latencySampleSize = perfLatencyEnv;
    }
    const perfThroughputEnv = parsePositiveNumber(process.env.PERF_METRICS_THROUGHPUT_WINDOW_MS);
    if (perfThroughputEnv) {
        performanceMetrics.throughputWindowMs = perfThroughputEnv;
    }
    const perfSlowThresholdEnv = parsePositiveNumber(process.env.PERF_METRICS_SLOW_THRESHOLD_MS);
    if (perfSlowThresholdEnv) {
        performanceMetrics.slowRequestThresholdMs = perfSlowThresholdEnv;
    }
    const perfSlowSamplesEnv = parsePositiveNumber(process.env.PERF_METRICS_SLOW_SAMPLE_SIZE);
    if (perfSlowSamplesEnv) {
        performanceMetrics.slowRequestSampleSize = perfSlowSamplesEnv;
    }

    // Resource Metrics
    const resourceMetrics: any = {};
    const resourceSampleEnv = parsePositiveNumber(process.env.RESOURCE_METRICS_SAMPLE_INTERVAL_MS);
    if (resourceSampleEnv) {
        resourceMetrics.sampleIntervalMs = resourceSampleEnv;
    }
    const resourceSnapshotEnv = parsePositiveNumber(process.env.RESOURCE_METRICS_SNAPSHOT_TTL_MS);
    if (resourceSnapshotEnv) {
        resourceMetrics.snapshotTtlMs = resourceSnapshotEnv;
    }

    // Business Metrics
    const businessMetrics: any = {};
    const businessLookbackEnv = parsePositiveNumber(process.env.BUSINESS_METRICS_LOOKBACK_DAYS);
    if (businessLookbackEnv) {
        businessMetrics.lookbackDays = businessLookbackEnv;
    }
    const businessCacheTtlEnv = parsePositiveNumber(process.env.BUSINESS_METRICS_CACHE_TTL_MS);
    if (businessCacheTtlEnv) {
        businessMetrics.cacheTtlMs = businessCacheTtlEnv;
    }

    // Metrics Dashboard
    const metricsDashboard: any = {};
    const metricsDashboardIntervalEnv = parsePositiveNumber(process.env.METRICS_DASHBOARD_SAMPLE_INTERVAL_MS);
    if (metricsDashboardIntervalEnv) {
        metricsDashboard.sampleIntervalMs = metricsDashboardIntervalEnv;
    }
    const metricsDashboardHistoryEnv = parsePositiveNumber(process.env.METRICS_DASHBOARD_HISTORY_SIZE);
    if (metricsDashboardHistoryEnv) {
        metricsDashboard.historySize = metricsDashboardHistoryEnv;
    }

    // Health
    const health: any = {};
    const healthTtlEnv = parsePositiveNumber(process.env.HEALTH_SNAPSHOT_TTL_MS);
    if (healthTtlEnv) {
        health.ttlMs = healthTtlEnv;
    }
    const healthMicroserviceTimeoutEnv = parsePositiveNumber(process.env.HEALTH_MICROSERVICE_TIMEOUT_MS);
    if (healthMicroserviceTimeoutEnv) {
        health.microserviceTimeoutMs = healthMicroserviceTimeoutEnv;
    }

    // Compression
    const compression: CompressionMiddlewareOptions = {};
    const compressionDisabled = parseBoolean(process.env.COMPRESSION_DISABLED, false);
    if (compressionDisabled) {
        compression.enabled = false;
    }
    const compressionThresholdEnv = parsePositiveNumber(process.env.COMPRESSION_THRESHOLD_BYTES);
    if (compressionThresholdEnv) {
        compression.thresholdBytes = compressionThresholdEnv;
    }
    const compressionPreferBrotliEnv = process.env.COMPRESSION_PREFER_BROTLI;
    if (compressionPreferBrotliEnv !== undefined) {
        compression.preferBrotli = parseBoolean(compressionPreferBrotliEnv, true);
    }
    const compressionBrotliQualityEnv = parseNonNegativeNumber(process.env.COMPRESSION_BROTLI_QUALITY);
    if (compressionBrotliQualityEnv !== null) {
        compression.brotliQuality = compressionBrotliQualityEnv;
    }
    const compressionGzipLevelEnvRaw = process.env.COMPRESSION_GZIP_LEVEL;
    if (compressionGzipLevelEnvRaw !== undefined && compressionGzipLevelEnvRaw !== '') {
        const parsed = Number(compressionGzipLevelEnvRaw);
        if (Number.isFinite(parsed)) {
            compression.gzipLevel = parsed;
        }
    }

    // Prisma
    const requestedConcurrency = parsePositiveNumber(process.env.PRISMA_MAX_CONCURRENCY);
    const parsedQueueWarnSize = parsePositiveNumber(process.env.PRISMA_QUEUE_WARN_SIZE);
    const connectionHeadroom = parseNonNegativeNumber(process.env.PRISMA_CONNECTION_HEADROOM) ?? 1;
    const poolWarmupTimeout = parsePositiveNumber(process.env.PRISMA_POOL_WARMUP_TIMEOUT_MS) ?? 5000;
    const preferPool = parseBoolean(process.env.PRISMA_PREFER_POOL, true);
    const fallbackPool = parseBoolean(process.env.PRISMA_POOL_FALLBACK_ENABLED, true);

    // Allowed Origins
    const allowedOrigins = process.env.FRONTEND_URL
        ? process.env.FRONTEND_URL.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

    // Global Rate Limit
    const parsedGlobalLimit = Number(process.env.GLOBAL_RATE_LIMIT_MAX);
    const globalRateLimit = Number.isFinite(parsedGlobalLimit) && parsedGlobalLimit > 0
        ? Math.floor(parsedGlobalLimit)
        : null;

    return {
        databaseAvailability,
        databaseRetry,
        circuitBreaker,
        requestTimeout,
        performanceMetrics,
        resourceMetrics,
        businessMetrics,
        metricsDashboard,
        health,
        compression,
        prisma: {
            requestedConcurrency: requestedConcurrency ?? undefined,
            queueWarnSize: parsedQueueWarnSize ?? undefined,
            connectionHeadroom,
            poolWarmupTimeout,
            preferPool,
            fallbackPool,
        },
        allowedOrigins,
        globalRateLimit,
    };
}
