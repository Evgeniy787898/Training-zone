/**
 * Latency monitoring module for AI Assistant.
 * 
 * Tracks response latency and generates alerts when thresholds are exceeded.
 * Extracted from routes/assistant.ts for reusability (BE-008).
 */

import { isPlainObject } from '../../utils/object.js';

// === Types ===

export type LatencyAlertSeverity = 'warn' | 'error';
export type LatencyAlertReason = 'slow_turn' | 'slow_ratio' | 'average_latency';

export interface LatencyAlertPayload {
    severity: LatencyAlertSeverity;
    reason: LatencyAlertReason;
    message: string;
    latency_ms: number | null;
    threshold_ms: number;
    slow_ratio: number;
    average_ms: number | null;
    samples: number;
    triggered_at: string;
    [key: string]: unknown;
}

export interface LatencyStats {
    slow_threshold_ms?: number;
    average_ms?: number;
    slow_ratio?: number;
    samples?: number;
}

// === Constants ===

const DEFAULT_SLOW_THRESHOLD_MS = 3500;
const LATENCY_WARN_MULTIPLIER = 1.25;
const LATENCY_ERROR_MULTIPLIER = 2;
const LATENCY_WARN_RATIO = 0.35;
const LATENCY_ERROR_RATIO = 0.6;

// === Utility Functions ===

export const resolveSlowThreshold = (stats: LatencyStats | null | undefined): number => {
    if (!stats) {
        return DEFAULT_SLOW_THRESHOLD_MS;
    }
    const value = Number(stats.slow_threshold_ms);
    if (Number.isFinite(value) && value > 0) {
        return value;
    }
    return DEFAULT_SLOW_THRESHOLD_MS;
};

export const clampRatio = (value: unknown): number => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return 0;
    }
    if (value < 0) return 0;
    if (value > 1) return 1;
    return Number(value.toFixed(2));
};

export const toPositiveInteger = (value: unknown): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return 0;
    }
    const rounded = Math.max(0, Math.round(value));
    return rounded;
};

export const toLatencyValue = (value: unknown): number | null => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        return null;
    }
    return Math.round(value);
};

// === Alert Building ===

interface AlertContext {
    latencyMs: number | null;
    thresholdMs: number;
    ratio: number;
    samples: number;
}

export const buildLatencyAlertMessage = (
    reason: LatencyAlertReason,
    context: AlertContext,
): string => {
    const latencyLabel = context.latencyMs !== null ? `${context.latencyMs} мс` : '—';
    const thresholdLabel = `${context.thresholdMs} мс`;
    const ratioLabel = `${Math.round(context.ratio * 100)}% `;
    switch (reason) {
        case 'slow_turn':
            return `Последний ответ занял ${latencyLabel}, что превышает рабочий порог ${thresholdLabel}.`;
        case 'slow_ratio':
            return `Из последних ${context.samples} ответов медленными были ${ratioLabel}. Проверь нагрузку на сервисы.`;
        case 'average_latency':
        default:
            return `Среднее время ответа выросло и приближается к порогу ${thresholdLabel}. Требуется оптимизация.`;
    }
};

export const createLatencyAlert = (
    latencyMs: number,
    stats: LatencyStats,
): Omit<LatencyAlertPayload, 'triggered_at'> | null => {
    const threshold = Number.isFinite(stats?.slow_threshold_ms) ? Number(stats.slow_threshold_ms) : DEFAULT_SLOW_THRESHOLD_MS;
    const average = toLatencyValue(stats?.average_ms ?? null);
    const ratio = clampRatio(stats?.slow_ratio ?? 0);
    const samples = toPositiveInteger(stats?.samples ?? 0);
    const normalizedLatency = Math.max(0, Math.round(latencyMs));

    const exceedsWarnLatency = normalizedLatency >= threshold * LATENCY_WARN_MULTIPLIER;
    const exceedsErrorLatency = normalizedLatency >= threshold * LATENCY_ERROR_MULTIPLIER;
    const exceedsWarnRatio = ratio >= LATENCY_WARN_RATIO && samples >= 3;
    const exceedsErrorRatio = ratio >= LATENCY_ERROR_RATIO && samples >= 5;
    const exceedsWarnAverage = average !== null && average >= threshold * 1.1 && samples >= 3;
    const exceedsErrorAverage = average !== null && average >= threshold * 1.4 && samples >= 5;

    const baseContext: AlertContext = {
        latencyMs: normalizedLatency,
        thresholdMs: Math.round(threshold),
        ratio,
        samples,
    };

    if (exceedsErrorLatency) {
        return {
            severity: 'error',
            reason: 'slow_turn',
            message: buildLatencyAlertMessage('slow_turn', baseContext),
            latency_ms: normalizedLatency,
            threshold_ms: Math.round(threshold),
            slow_ratio: ratio,
            average_ms: average,
            samples,
        };
    }

    if (exceedsErrorRatio) {
        return {
            severity: 'error',
            reason: 'slow_ratio',
            message: buildLatencyAlertMessage('slow_ratio', baseContext),
            latency_ms: normalizedLatency,
            threshold_ms: Math.round(threshold),
            slow_ratio: ratio,
            average_ms: average,
            samples,
        };
    }

    if (exceedsErrorAverage) {
        return {
            severity: 'error',
            reason: 'average_latency',
            message: buildLatencyAlertMessage('average_latency', baseContext),
            latency_ms: normalizedLatency,
            threshold_ms: Math.round(threshold),
            slow_ratio: ratio,
            average_ms: average,
            samples,
        };
    }

    if (exceedsWarnLatency || exceedsWarnRatio || exceedsWarnAverage) {
        let reason: LatencyAlertReason = 'slow_turn';
        if (exceedsWarnRatio) {
            reason = 'slow_ratio';
        } else if (exceedsWarnAverage) {
            reason = 'average_latency';
        }

        return {
            severity: 'warn',
            reason,
            message: buildLatencyAlertMessage(reason, baseContext),
            latency_ms: normalizedLatency,
            threshold_ms: Math.round(threshold),
            slow_ratio: ratio,
            average_ms: average,
            samples,
        };
    }

    return null;
};

// === Alert Normalization ===

export const normalizeAlertEntry = (entry: unknown): LatencyAlertPayload | null => {
    if (!entry || typeof entry !== 'object') {
        return null;
    }
    const obj = entry as Record<string, unknown>;
    const severity = obj.severity === 'error' ? 'error' : obj.severity === 'warn' ? 'warn' : null;
    const validReasons: LatencyAlertReason[] = ['slow_turn', 'slow_ratio', 'average_latency'];
    const reason: LatencyAlertReason = validReasons.includes(obj.reason as LatencyAlertReason)
        ? (obj.reason as LatencyAlertReason)
        : 'slow_turn';
    const threshold = Number.isFinite(obj.threshold_ms) ? Math.round(Number(obj.threshold_ms)) : DEFAULT_SLOW_THRESHOLD_MS;
    const latencyMs = toLatencyValue(obj.latency_ms ?? null);
    const average = toLatencyValue(obj.average_ms ?? null);
    const ratio = clampRatio(obj.slow_ratio ?? 0);
    const samples = toPositiveInteger(obj.samples ?? 0);
    const triggeredAt = typeof obj.triggered_at === 'string' ? obj.triggered_at : new Date().toISOString();
    const message = typeof obj.message === 'string'
        ? obj.message
        : buildLatencyAlertMessage(reason, {
            latencyMs: latencyMs ?? null,
            thresholdMs: threshold,
            ratio,
            samples,
        });

    if (!severity) {
        return null;
    }

    return {
        severity,
        reason,
        message,
        latency_ms: latencyMs,
        threshold_ms: threshold,
        slow_ratio: ratio,
        average_ms: average,
        samples,
        triggered_at: triggeredAt,
    };
};

export const normalizeAlertHistoryList = (value: unknown): LatencyAlertPayload[] => {
    if (!Array.isArray(value)) {
        return [];
    }
    const normalized = value
        .map((entry) => normalizeAlertEntry(entry))
        .filter((entry): entry is LatencyAlertPayload => Boolean(entry));
    const uniqueByTimestamp = new Map<string, LatencyAlertPayload>();
    for (const entry of normalized) {
        if (!uniqueByTimestamp.has(entry.triggered_at)) {
            uniqueByTimestamp.set(entry.triggered_at, entry);
        }
    }
    return Array.from(uniqueByTimestamp.values()).slice(0, 10);
};

// === Metadata Normalization ===

export const normalizeMetadata = (metadata: unknown): Record<string, unknown> => {
    if (isPlainObject(metadata)) {
        return metadata;
    }
    return {};
};

export const normalizeTags = (tags: unknown): string[] => {
    if (!Array.isArray(tags)) {
        return [];
    }
    return tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0);
};
