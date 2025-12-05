import type { SafePrismaClient } from '../types/prisma.js';
import { getConfig } from '../config/configService.js';
import { recordMonitoringEvent } from '../modules/infrastructure/monitoring.js';

const pickConfigSnapshot = () => {
    const config = getConfig();
    return {
        stage: config.app.stage,
        frontendOrigins: config.app.frontendOrigins.length,
        cacheNamespace: config.cache.strategy.namespace,
        cacheAdaptiveTtlEnabled: config.cache.adaptiveTtl.enabled,
        cacheCompressionEnabled: config.cache.compression.enabled,
        cacheVersion: config.cache.versioning.globalVersion,
        monitoringAlertsEnabled: Boolean(config.monitoring.webhookUrl || config.monitoring.telegramBotToken),
        httpKeepAliveEnabled: config.httpClient.enableGlobalDispatcher,
        rateLimitWindowMs: config.rateLimits.global.windowMs,
    } as const;
};

export const recordConfigUsage = async (
    prisma: SafePrismaClient | undefined,
    source: 'startup' | 'runtime' | string = 'startup',
): Promise<void> => {
    const snapshot = pickConfigSnapshot();
    await recordMonitoringEvent(prisma, {
        category: 'config',
        severity: 'info',
        message: 'Configuration loaded',
        resource: source,
        metadata: snapshot,
    });
};
