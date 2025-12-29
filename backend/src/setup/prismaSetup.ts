import { logger } from '../services/logger.js';
import { createPrismaClientWithPooling } from '../services/prismaConnection.js';
import { applyStringSanitization } from '../services/stringSanitization.js';
import { applyJsonOptimization } from '../services/jsonOptimization.js';
import { applyXssProtection } from '../modules/security/xssProtection.js';
import { applySensitiveDataEncryption } from '../services/sensitiveDataEncryption.js';
import { attachDatabaseRetry } from '../modules/database/databaseRetry.js';
import { attachDatabaseAvailabilityTracking } from '../modules/database/databaseAvailability.js';
import { attachPrismaSlowQueryLogging } from '../services/prismaQueryLogging.js';
import { ensureEncryptionConfigured } from '../modules/security/encryption.js';
import { hardenPrismaAgainstSqlInjection } from '../modules/database/prismaGuards.js';
import { registerCacheMetricsPrismaResolver } from '../modules/infrastructure/cacheMetrics.js';
import { scheduleCacheWarming } from '../modules/infrastructure/cacheWarming.js';
import { startMetricsDashboardSampler } from '../services/metricsDashboard.js';
import { describeDatasource } from '../services/prismaConnection.js';
import { updateDbConnectionMetrics } from '../modules/analytics/resourceMetrics.js';
import { appContainer, diTokens } from '../services/container.js';
import { SessionRepository } from '../repositories/sessionRepository.js';
import { SessionService } from '../services/sessionService.js';
import type { EnvConfig } from './envConfig.js';

export interface PrismaSetupResult {
    prisma: any;
    prismaMode: string | null;
    usedFallback: boolean;
    cacheWarmingHandle: any;
}

/**
 * Initialize Prisma client with all middleware and monitoring
 */
export async function setupPrisma(config: EnvConfig): Promise<PrismaSetupResult> {
    const poolUrl =
        process.env.PRISMA_POOL_URL ||
        process.env.PRISMA_RUNTIME_URL ||
        process.env.DATABASE_POOL_URL ||
        process.env.DATABASE_URL ||
        null;
    const directUrl =
        process.env.PRISMA_DIRECT_URL ||
        process.env.DIRECT_URL ||
        process.env.DATABASE_DIRECT_URL ||
        null;

    const {
        client: basePrisma,
        mode: prismaMode,
        runtimeUrl: prismaRuntimeUrl,
        connectionLimit: connectionLimitFromUrl,
        concurrencyLimit,
        queueWarnSize,
        usedFallback,
    } = await createPrismaClientWithPooling({
        poolUrl,
        directUrl,
        preferPool: config.prisma.preferPool,
        fallbackOnFailure: config.prisma.fallbackPool,
        warmupTimeoutMs: config.prisma.poolWarmupTimeout,
        connectionHeadroom: config.prisma.connectionHeadroom,
        requestedConcurrency: config.prisma.requestedConcurrency,
        queueWarnSize: config.prisma.queueWarnSize,
        logLevels: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

    // Setup concurrency limiter
    const limiter = createConcurrencyLimiter(concurrencyLimit, queueWarnSize, (state) => {
        updateDbConnectionMetrics({
            limit: connectionLimitFromUrl ?? concurrencyLimit ?? null,
            mode: prismaMode ?? 'unknown',
            active: state.active,
            queueSize: state.queueSize,
        });
    });

    if (limiter) {
        updateDbConnectionMetrics({
            limit: connectionLimitFromUrl ?? concurrencyLimit ?? null,
            mode: prismaMode ?? 'unknown',
            active: 0,
            queueSize: 0,
        });
        basePrisma.$use(async (params: any, next: (params: any) => Promise<any>) => {
            return limiter(() => next(params));
        });
        logger.info(`[prisma] concurrency guard enabled (limit=${concurrencyLimit})`);
    } else {
        logger.info('[prisma] concurrency guard disabled');
        updateDbConnectionMetrics({
            limit: connectionLimitFromUrl ?? null,
            mode: prismaMode ?? 'unknown',
            active: 0,
            queueSize: 0,
        });
    }

    // Apply security and optimization middleware
    applyStringSanitization(basePrisma);
    applyJsonOptimization(basePrisma);
    applyXssProtection(basePrisma);
    applySensitiveDataEncryption(basePrisma);
    attachDatabaseRetry(basePrisma);
    attachDatabaseAvailabilityTracking(basePrisma);
    attachPrismaSlowQueryLogging(basePrisma);
    ensureEncryptionConfigured();

    logger.info('[security] Sensitive data encryption enabled');
    logger.info('[database] transient error retries enabled');

    const prisma = hardenPrismaAgainstSqlInjection(basePrisma);
    registerCacheMetricsPrismaResolver(() => prisma as any);
    const cacheWarmingHandle = scheduleCacheWarming(prisma as any);
    startMetricsDashboardSampler(prisma as any);

    const datasourceLabel = prismaMode === 'pool' ? 'pgbouncer' : 'direct';
    const datasourceDescription = describeDatasource(prismaRuntimeUrl);

    if (usedFallback) {
        logger.warn('[prisma] Pool connection unavailable during warmup, switched to direct database URL');
    }

    logger.info(
        `[prisma] datasource=${datasourceLabel}, connection_limit=${connectionLimitFromUrl ?? 'unknown'}, runtime=${datasourceDescription}`,
    );

    // Register in DI container
    appContainer.registerValue(diTokens.prisma, prisma);
    appContainer.registerFactory(diTokens.sessionRepository, (container) => {
        const client = container.resolve(diTokens.prisma);
        return new SessionRepository(client);
    });
    appContainer.registerFactory(diTokens.sessionService, (container) => {
        const repository = container.resolve(diTokens.sessionRepository);
        const historyService = container.resolve(diTokens.historyService);
        return new SessionService(repository, historyService);
    });

    return {
        prisma,
        prismaMode,
        usedFallback,
        cacheWarmingHandle,
    };
}

// Concurrency limiter utility
function createConcurrencyLimiter(
    limit: number | null | undefined,
    warnSize = 25,
    onStateChange?: (state: { active: number; queueSize: number }) => void,
) {
    if (!limit || !Number.isFinite(limit) || limit <= 0) {
        return null;
    }

    let active = 0;
    const waiting: Array<() => void> = [];

    const emitState = () => {
        if (onStateChange) {
            onStateChange({ active, queueSize: waiting.length });
        }
    };

    return async function runWithLimit<T>(task: () => Promise<T>): Promise<T> {
        if (active >= limit) {
            await new Promise<void>((resolve) => {
                waiting.push(resolve);
                if (waiting.length === warnSize) {
                    logger.warn(`[prisma] query backlog reached ${warnSize}, requests will wait for a free connection`);
                } else if (waiting.length > warnSize && waiting.length % warnSize === 0) {
                    logger.warn(`[prisma] query backlog still high (${waiting.length})`);
                }
            });
            emitState();
        }
        active++;
        emitState();
        try {
            return await task();
        } finally {
            active--;
            const next = waiting.shift();
            if (next) {
                next();
            }
            emitState();
        }
    };
}
