import type { Prisma, PrismaClient } from '@prisma/client';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { slowQueryDefaults } from '../config/constants.js';
import { recordMonitoringEvent } from '../modules/infrastructure/monitoring.js';
import { recordSlowQueryMetrics } from '../modules/analytics/slowQueryMetrics.js';
import { getTraceId } from './trace.js';
import type { MonitoringSeverity } from '../types/monitoring.js';
import {
    parsePositiveNumber,
    parseRatioNumber,
    parseBoolean,
} from '../utils/envParsers.js';

export interface SlowQuerySample {
    timestamp: string;
    durationMs: number;
    target?: string;
    query: string;
    paramsPreview?: string | null;
    traceId?: string;
    stack?: string;
}

interface SlowQueryLoggingConfig {
    thresholdMs: number;
    historySize: number;
    paramsPreviewLength: number;
    sampleRate: number;
    logFilePath: string | null;
    captureStackTraces: boolean;
    monitoringEnabled: boolean;
    monitoringSeverity: MonitoringSeverity;
}

const parseSeverity = (value?: string | null): MonitoringSeverity | null => {
    if (!value) {
        return null;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === 'info' || normalized === 'warning' || normalized === 'critical') {
        return normalized;
    }
    return null;
};

let config: SlowQueryLoggingConfig = {
    thresholdMs: slowQueryDefaults.thresholdMs,
    historySize: slowQueryDefaults.historySize,
    paramsPreviewLength: slowQueryDefaults.paramsPreviewLength,
    sampleRate: slowQueryDefaults.sampleRate,
    logFilePath: slowQueryDefaults.logFilePath,
    captureStackTraces: slowQueryDefaults.captureStackTraces,
    monitoringEnabled: slowQueryDefaults.monitoringEnabled,
    monitoringSeverity: slowQueryDefaults.monitoringSeverity as MonitoringSeverity,
};

let resolvedLogPath = config.logFilePath ? resolveLogPath(config.logFilePath) : null;

function resolveLogPath(filePath: string) {
    return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
}

const applyEnvOverrides = () => {
    const threshold = parsePositiveNumber(process.env.PRISMA_SLOW_QUERY_THRESHOLD_MS);
    if (threshold) {
        config.thresholdMs = Math.floor(threshold);
    }
    const history = parsePositiveNumber(process.env.PRISMA_SLOW_QUERY_HISTORY_LIMIT);
    if (history) {
        config.historySize = Math.max(1, Math.floor(history));
    }
    const preview = parsePositiveNumber(process.env.PRISMA_SLOW_QUERY_PARAMS_PREVIEW);
    if (preview) {
        config.paramsPreviewLength = Math.max(50, Math.floor(preview));
    }
    const sampleRate = parseRatioNumber(process.env.PRISMA_SLOW_QUERY_SAMPLE_RATE);
    if (sampleRate !== null) {
        config.sampleRate = sampleRate;
    }
    if (process.env.PRISMA_SLOW_QUERY_LOG_PATH !== undefined) {
        const trimmed = process.env.PRISMA_SLOW_QUERY_LOG_PATH.trim();
        config.logFilePath = trimmed ? trimmed : null;
    }
    config.captureStackTraces = parseBoolean(
        process.env.PRISMA_SLOW_QUERY_CAPTURE_STACK,
        config.captureStackTraces,
    );
    config.monitoringEnabled = parseBoolean(
        process.env.PRISMA_SLOW_QUERY_MONITORING_ENABLED,
        config.monitoringEnabled,
    );
    const severity = parseSeverity(process.env.PRISMA_SLOW_QUERY_MONITORING_SEVERITY);
    if (severity) {
        config.monitoringSeverity = severity;
    }
    resolvedLogPath = config.logFilePath ? resolveLogPath(config.logFilePath) : null;
};

applyEnvOverrides();

export const configurePrismaSlowQueryLogging = (overrides: Partial<SlowQueryLoggingConfig>) => {
    config = {
        ...config,
        ...overrides,
    };
    if (overrides.logFilePath !== undefined) {
        resolvedLogPath = overrides.logFilePath ? resolveLogPath(overrides.logFilePath) : null;
    }
};

const slowQueryHistory: SlowQuerySample[] = [];
const attachedClients = new WeakSet<PrismaClient>();

const previewString = (value: string, limit: number) => {
    if (value.length <= limit) {
        return value;
    }
    return `${value.slice(0, limit)}…`;
};

const normalizeQuery = (query: string) => query.replace(/\s+/g, ' ').trim();

const pushHistory = (sample: SlowQuerySample) => {
    slowQueryHistory.push(sample);
    if (slowQueryHistory.length > config.historySize) {
        slowQueryHistory.shift();
    }
};

const persistSample = async (sample: SlowQuerySample) => {
    if (!resolvedLogPath) {
        return;
    }
    try {
        await fs.mkdir(path.dirname(resolvedLogPath), { recursive: true });
        await fs.appendFile(resolvedLogPath, `${JSON.stringify(sample)}\n`, 'utf-8');
    } catch (error) {
        console.error('[prisma] Failed to persist slow query log', error);
    }
};

const maybeCaptureStack = () => {
    if (!config.captureStackTraces) {
        return undefined;
    }
    const stack = new Error().stack;
    if (!stack) {
        return undefined;
    }
    return stack
        .split('\n')
        .filter((line) => !line.includes('prismaQueryLogging') && !line.includes('node:internal'))
        .join('\n');
};

const handleQueryEvent = (event: Prisma.QueryEvent) => {
    const durationMs = Number(event.duration);
    if (!Number.isFinite(durationMs)) {
        return;
    }

    const isSlow = durationMs >= config.thresholdMs;
    const sampled = !isSlow && config.sampleRate > 0 && Math.random() < config.sampleRate;
    if (!isSlow && !sampled) {
        return;
    }

    const sample: SlowQuerySample = {
        timestamp: new Date().toISOString(),
        durationMs,
        target: event.target || undefined,
        query: normalizeQuery(event.query),
        paramsPreview: event.params ? previewString(event.params, config.paramsPreviewLength) : undefined,
        traceId: getTraceId() ?? undefined,
        stack: maybeCaptureStack(),
    };

    if (isSlow) {
        pushHistory(sample);
        recordSlowQueryMetrics(sample, config.thresholdMs);
        console.warn(
            `[prisma] slow query ${durationMs}ms (target=${event.target ?? 'default'}) ${previewString(sample.query, 200)}`,
        );
        void persistSample(sample);
        if (config.monitoringEnabled) {
            void recordMonitoringEvent(undefined, {
                category: 'database',
                severity: config.monitoringSeverity,
                message: `Slow Prisma query (${durationMs}ms)`,
                resource: event.target ?? undefined,
                traceId: sample.traceId,
                metadata: {
                    durationMs,
                    query: previewString(sample.query, 400),
                },
            }).catch((error: unknown) => {
                console.error('[monitoring] Failed to record slow query event', error);
            });
        }
    } else if (sampled) {
        console.log(
            `[prisma] query sample ${durationMs}ms (target=${event.target ?? 'default'}) ${previewString(sample.query, 160)}`,
        );
    }
};

export const attachPrismaSlowQueryLogging = (client: PrismaClient) => {
    if (attachedClients.has(client)) {
        return;
    }
    attachedClients.add(client);
    (client.$on as any)('query', handleQueryEvent);
};

export const getSlowQueryHistory = () => [...slowQueryHistory];

export const getSlowQueryConfig = () => ({ ...config, logFilePath: resolvedLogPath });
