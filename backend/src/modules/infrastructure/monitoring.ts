import type { Prisma } from '@prisma/client';
import type { SafePrismaClient } from '../../types/prisma.js';
import type { MonitoringAlertConfig, MonitoringEventInput, MonitoringSeverity } from '../../types/monitoring.js';
import { monitoringDefaults } from '../../config/constants.js';
import { getConfig } from '../../config/configService.js';
import { getTraceId } from '../../services/trace.js';

const severityWeight: Record<MonitoringSeverity, number> = {
    info: 0,
    warning: 1,
    critical: 2,
};

const compact = <T extends Record<string, unknown>>(payload: T): Partial<T> => {
    return Object.fromEntries(
        Object.entries(payload).filter(([, value]) => value !== undefined && value !== null && value !== ''),
    ) as Partial<T>;
};

const serializeError = (error: unknown) => {
    if (!error) {
        return undefined;
    }
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack,
        };
    }
    if (typeof error === 'string') {
        return { message: error };
    }
    try {
        return JSON.parse(JSON.stringify(error));
    } catch {
        return { message: 'Unserializable error payload' };
    }
};

const safeMetadata = (metadata?: Record<string, unknown>) => {
    if (!metadata) {
        return undefined;
    }
    try {
        return JSON.parse(JSON.stringify(metadata));
    } catch {
        return Object.fromEntries(
            Object.entries(metadata)
                .filter(([, value]) => typeof value !== 'object' || value === null)
                .map(([key, value]) => [key, String(value)]),
        );
    }
};

const dedupeCache = new Map<string, number>();

const now = () => Date.now();

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

const baseConfig = (): MonitoringAlertConfig => {
    const snapshot = getConfig().monitoring;
    const minSeverity = parseSeverity(snapshot.minSeverityForAlerts) || monitoringDefaults.minSeverityForAlerts;
    return {
        ...monitoringDefaults,
        ...snapshot,
        minSeverityForAlerts: minSeverity,
    } satisfies MonitoringAlertConfig;
};

let config: MonitoringAlertConfig = baseConfig();

export const configureMonitoring = (overrides: Partial<MonitoringAlertConfig>) => {
    config = {
        ...baseConfig(),
        ...compact(overrides),
    } as MonitoringAlertConfig;
};

export const reloadMonitoringConfig = () => {
    config = baseConfig();
    dedupeCache.clear();
};

const cleanupDedupe = () => {
    const expiresBefore = now() - config.dedupeTtlMs;
    for (const [key, timestamp] of dedupeCache.entries()) {
        if (timestamp < expiresBefore) {
            dedupeCache.delete(key);
        }
    }
};

const shouldAlertSeverity = (severity: MonitoringSeverity) =>
    severityWeight[severity] >= severityWeight[config.minSeverityForAlerts];

const buildDedupeKey = (event: MonitoringEventInput) =>
    [event.category, event.severity, event.message, event.resource, event.metadata?.['code']]
        .filter(Boolean)
        .join(':');

const markDedupe = (event: MonitoringEventInput) => {
    cleanupDedupe();
    const key = buildDedupeKey(event);
    const last = dedupeCache.get(key);
    if (last && now() - last < config.dedupeTtlMs) {
        return false;
    }
    dedupeCache.set(key, now());
    return true;
};

const dispatchWebhookAlert = async (event: MonitoringEventInput) => {
    if (!config.webhookUrl) {
        return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.webhookTimeoutMs);
    try {
        const response = await fetch(config.webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(config.webhookAuthHeader ? { Authorization: config.webhookAuthHeader } : {}),
            },
            body: JSON.stringify({
                ...event,
                metadata: safeMetadata(event.metadata),
                error: serializeError(event.error),
            }),
            signal: controller.signal,
        });
        if (!response.ok) {
            const text = await response.text();
            console.error('[monitoring] Webhook alert failed', { status: response.status, body: text });
        }
    } catch (error) {
        console.error('[monitoring] Webhook alert error', error);
    } finally {
        clearTimeout(timeout);
    }
};

const dispatchTelegramAlert = async (event: MonitoringEventInput) => {
    if (!config.telegramBotToken || !config.telegramChatId) {
        return;
    }

    const lines = [
        `🚨 *${event.category}* (${event.severity.toUpperCase()})`,
        `Message: ${event.message}`,
    ];
    if (event.resource) {
        lines.push(`Resource: ${event.resource}`);
    }
    if (event.metadata?.['statusCode']) {
        lines.push(`Status: ${event.metadata['statusCode']}`);
    }
    if (event.traceId) {
        lines.push(`Trace: ${event.traceId}`);
    }

    const response = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: config.telegramChatId,
            text: lines.join('\n'),
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        console.error('[monitoring] Telegram alert failed', { status: response.status, body: text });
    }
};

export const recordMonitoringEvent = async (
    prisma: SafePrismaClient | undefined,
    event: MonitoringEventInput,
) => {
    const eventInput = event ?? {
        category: 'unknown',
        severity: 'low',
        message: 'Monitoring event was undefined',
    };

    const payload: MonitoringEventInput = {
        ...eventInput,
        traceId: eventInput.traceId ?? getTraceId() ?? null,
        metadata: safeMetadata(eventInput.metadata),
    };

    if (prisma) {
        try {
            const serializedPayload = {
                message: payload.message,
                metadata: payload.metadata ?? null,
                resource: payload.resource,
                error: serializeError(payload.error),
            } as Prisma.InputJsonValue;
            await prisma.observabilityEvent.create({
                data: {
                    category: payload.category,
                    severity: payload.severity,
                    payload: serializedPayload,
                    traceId: payload.traceId,
                    profileId: payload.profileId ?? null,
                },
            });
        } catch (error) {
            console.error('[monitoring] Failed to persist observability event', error);
        }
    }

    if (!shouldAlertSeverity(payload.severity)) {
        return;
    }

    if (!markDedupe(payload)) {
        return;
    }

    await Promise.all([dispatchWebhookAlert(payload), dispatchTelegramAlert(payload)]);
};
