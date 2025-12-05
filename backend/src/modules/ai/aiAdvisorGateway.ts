import crypto from 'crypto';
import { z } from 'zod';
import { callMicroservice } from '../../services/microserviceGateway.js';
import { parseAiAdvisorResponse } from '../../services/externalDataValidation.js';
import { aiAdvisorContextConfig, aiAdvisorMonitoringConfig } from '../../config/constants.js';
import { rememberCachedResource } from '../infrastructure/cacheStrategy.js';
import { buildFallbackAdvice, type AiAdvisorFallbackReason } from './aiAdvisorFallback.js';
import { isAppError } from '../../services/errors.js';
import { recordMonitoringEvent } from '../infrastructure/monitoring.js';
import type { AiAdvisorContextEntry, AiAdvisorPersonalization } from '../../types/aiAdvisor.js';
import type { AssistantAdviceResponse } from '../../types/apiResponses.js';
import type { MonitoringSeverity } from '../../types/monitoring.js';
import type { SafePrismaClient } from '../../types/prisma.js';

const sanitizeListSchema = (maxItems: number, maxLength: number) =>
    z.array(z.string().trim().min(1).max(maxLength)).max(maxItems);

const contextEntrySchema = z
    .object({
        exerciseKey: z.string().trim().min(1).max(64),
        currentLevel: z.string().trim().min(1).max(48),
        goals: sanitizeListSchema(8, 64).optional(),
        performance: z.record(z.string().trim().min(1).max(80)).optional(),
        advice: z.string().trim().min(1).max(480),
        nextSteps: sanitizeListSchema(4, 200).optional(),
        tips: sanitizeListSchema(4, 160).optional(),
        createdAt: z.string().trim().min(1).max(64),
    })
    .strict();

const personalizationProfileSchema = z
    .object({
        firstName: z.string().trim().min(1).max(64).optional(),
        lastName: z.string().trim().min(1).max(64).optional(),
        timezone: z.string().trim().min(1).max(64).optional(),
        notificationTime: z.string().trim().min(1).max(32).optional(),
        preferredLanguage: z.string().trim().min(1).max(32).optional(),
    })
    .strict();

const personalizationStatsSchema = z
    .object({
        completionRate30d: z.number().min(0).max(100).optional(),
        plannedSessions30d: z.number().int().min(0).optional(),
        completedSessions30d: z.number().int().min(0).optional(),
        latestSessionStatus: z.string().trim().min(1).max(32).optional(),
        latestSessionDiscipline: z.string().trim().min(1).max(80).optional(),
        latestSessionPlannedAt: z.string().trim().min(1).max(64).optional(),
    })
    .strict();

const personalizationAchievementsSchema = z
    .object({
        latestTitle: z.string().trim().min(1).max(160).optional(),
        latestAwardedAt: z.string().trim().min(1).max(64).optional(),
        totalCount: z.number().int().min(0).optional(),
    })
    .strict();

const personalizationReadinessSchema = z
    .object({
        avgRpe7d: z.number().min(0).max(10).optional(),
    })
    .strict();

const personalizationSchema = z
    .object({
        profile: personalizationProfileSchema.optional(),
        goals: sanitizeListSchema(6, 160).optional(),
        equipment: sanitizeListSchema(12, 80).optional(),
        focusAreas: sanitizeListSchema(6, 80).optional(),
        injuries: sanitizeListSchema(6, 80).optional(),
        tone: z.string().trim().min(1).max(64).optional(),
        stats: personalizationStatsSchema.optional(),
        achievements: personalizationAchievementsSchema.optional(),
        readiness: personalizationReadinessSchema.optional(),
    })
    .strict();

const adviceRequestSchema = z
    .object({
        exerciseKey: z.string().trim().min(1).max(64),
        currentLevel: z.string().trim().min(1).max(32),
        performance: z.record(z.any()).default({}),
        goals: z.array(z.string().trim().min(1).max(64)).max(10).optional(),
        profileId: z.string().trim().min(1).max(64),
        context: z.array(contextEntrySchema).max(aiAdvisorContextConfig.maxEntries).optional(),
        personalization: personalizationSchema.optional(),
    })
    .strict();

export type AiAdviceRequest = z.input<typeof adviceRequestSchema>;
type NormalizedAiAdviceRequest = z.output<typeof adviceRequestSchema>;

export async function requestAiAdvice(
    payload: AiAdviceRequest,
    options: { traceId?: string | null; prisma?: SafePrismaClient } = {},
): Promise<AssistantAdviceResponse> {
    const normalized = adviceRequestSchema.parse(payload);
    const contextEntries = (normalized.context ?? []).map((entry) => ({
        ...entry,
        goals: entry.goals ?? [],
        nextSteps: entry.nextSteps ?? [],
        tips: entry.tips ?? [],
        performance: entry.performance ?? {},
    }));
    const limitedContext = limitContextEntries(contextEntries);
    const normalizedRequest: NormalizedAiAdviceRequest =
        limitedContext === normalized.context
            ? normalized
            : { ...normalized, context: limitedContext };
    const fingerprint = buildAdviceCacheFingerprint(normalizedRequest);
    try {
        return await rememberCachedResource(
            'aiAdvisorAdvice',
            { profileId: normalizedRequest.profileId, fingerprint },
            async () => {
                const response = await callMicroservice('aiAdvisor', {
                    path: '/api/generate-advice',
                    method: 'POST',
                    body: normalizedRequest,
                    traceId: options.traceId,
                });
                const parsed = parseAiAdvisorResponse(response);
                await trackAiAdvisorMetrics({
                    prisma: options.prisma,
                    traceId: options.traceId,
                    profileId: normalizedRequest.profileId,
                    request: normalizedRequest,
                    response: {
                        advice: parsed.advice,
                        nextSteps: parsed.nextSteps,
                        tips: (parsed.tips as string[] | undefined) ?? [],
                        metadata: parsed.metadata ?? {},
                    },
                    fingerprint,
                });
                const personalizationSummary = summarizePersonalization(normalizedRequest.personalization);
                const mergedMetadata: Record<string, unknown> = {
                    ...(parsed.metadata ?? {}),
                    profileId: normalizedRequest.profileId,
                    goals: normalizedRequest.goals ?? [],
                    contextSize: Array.isArray(normalizedRequest.context) ? normalizedRequest.context.length : 0,
                    ...(personalizationSummary ? { personalizationSummary } : {}),
                };
                return {
                    advice: parsed.advice,
                    nextSteps: parsed.nextSteps,
                    tips: (parsed.tips as string[] | undefined) ?? [],
                    metadata: {
                        ...mergedMetadata,
                    },
                } satisfies AssistantAdviceResponse;
            },
        );
    } catch (error) {
        const reason = resolveFallbackReason(error);
        void recordAiAdvisorFallback({
            prisma: options.prisma,
            traceId: options.traceId,
            profileId: normalizedRequest.profileId,
            fingerprint,
            reason,
            error,
        });
        if (process.env.NODE_ENV !== 'test') {
            console.warn(
                JSON.stringify({
                    event: 'ai_advisor_fallback',
                    reason,
                    traceId: options.traceId ?? null,
                    error: isAppError(error) ? error.code : (error as Error)?.message,
                }),
            );
        }
        return buildFallbackAdvice(normalizedRequest, {
            reason,
            metadata: {
                profileId: normalizedRequest.profileId,
                fingerprint,
                errorCode: isAppError(error) ? error.code : undefined,
                statusCode: isAppError(error) ? error.statusCode : undefined,
                traceId: options.traceId ?? undefined,
            },
        });
    }
}

const resolveFallbackReason = (error: unknown): AiAdvisorFallbackReason => {
    if (!isAppError(error)) {
        return 'unknown';
    }
    if (error.code === 'microservice_timeout') {
        return 'microservice_timeout';
    }
    if (error.code === 'microservice_unavailable' || error.code === 'microservice_network_error') {
        return 'microservice_unavailable';
    }
    if (error.code === 'microservice_error' || error.code === 'microservice_empty_response') {
        return 'microservice_error';
    }
    if ((error as any).code === 'microservice_dependency') {
        return 'provider_error';
    }
    return 'unknown';
};

export type AiAdvisorContextPayload = AiAdvisorContextEntry;

function buildAdviceCacheFingerprint(payload: NormalizedAiAdviceRequest): string {
    const canonical = {
        profileId: payload.profileId,
        exerciseKey: payload.exerciseKey,
        currentLevel: payload.currentLevel,
        goals: canonicalizeStringList(payload.goals),
        performance: canonicalizePerformance(payload.performance ?? {}),
        context: Array.isArray(payload.context)
            ? payload.context.map((entry) => ({
                exerciseKey: entry.exerciseKey,
                currentLevel: entry.currentLevel,
                advice: entry.advice,
                goals: canonicalizeStringList(entry.goals),
                nextSteps: canonicalizeStringList(entry.nextSteps),
                tips: canonicalizeStringList(entry.tips),
                performance: canonicalizePerformance(entry.performance ?? {}),
            }))
            : [],
        personalization: canonicalizePersonalization(payload.personalization),
    };
    const serialized = JSON.stringify(canonical);
    return crypto.createHash('sha1').update(serialized).digest('hex');
}

function canonicalizeStringList(values?: string[] | null): string[] {
    if (!Array.isArray(values)) {
        return [];
    }
    return values
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter((entry) => Boolean(entry));
}

function canonicalizePerformance(record: Record<string, unknown>): Array<{ key: string; value: string }> {
    return Object.entries(record || {})
        .map(([key, value]) => ({ key: key.trim(), value: describePerformanceValue(value) }))
        .filter((entry) => Boolean(entry.key) && Boolean(entry.value))
        .sort((a, b) => a.key.localeCompare(b.key));
}

function describePerformanceValue(value: unknown): string {
    if (value === null || typeof value === 'undefined') {
        return '';
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    if (Array.isArray(value)) {
        return value.map((entry) => describePerformanceValue(entry)).filter(Boolean).join('|');
    }
    if (typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>).sort((a, b) => a[0].localeCompare(b[0]));
        return entries
            .map(([key, nestedValue]) => `${key}:${describePerformanceValue(nestedValue)}`)
            .filter(Boolean)
            .join(';');
    }
    return String(value);
}

function canonicalizePersonalization(payload?: AiAdvisorPersonalization | null): Record<string, unknown> {
    if (!payload) {
        return {};
    }
    const profile = payload.profile
        ? compactMetadata({
            firstName: payload.profile.firstName?.trim(),
            lastName: payload.profile.lastName?.trim(),
            timezone: payload.profile.timezone?.trim(),
            notificationTime: payload.profile.notificationTime?.trim(),
            preferredLanguage: payload.profile.preferredLanguage?.trim(),
        })
        : undefined;

    const stats = payload.stats
        ? compactMetadata({
            completionRate30d: typeof payload.stats.completionRate30d === 'number'
                ? Math.round(payload.stats.completionRate30d)
                : undefined,
            plannedSessions30d: payload.stats.plannedSessions30d,
            completedSessions30d: payload.stats.completedSessions30d,
            latestSessionStatus: payload.stats.latestSessionStatus?.trim(),
            latestSessionDiscipline: payload.stats.latestSessionDiscipline?.trim(),
            latestSessionPlannedAt: payload.stats.latestSessionPlannedAt,
        })
        : undefined;

    const achievements = payload.achievements
        ? compactMetadata({
            latestTitle: payload.achievements.latestTitle?.trim(),
            latestAwardedAt: payload.achievements.latestAwardedAt,
            totalCount: payload.achievements.totalCount,
        })
        : undefined;

    const readiness = payload.readiness
        ? compactMetadata({ avgRpe7d: payload.readiness.avgRpe7d })
        : undefined;

    return compactMetadata({
        profile,
        stats,
        achievements,
        readiness,
        tone: payload.tone?.trim(),
        goals: canonicalizeStringList(payload.goals),
        equipment: canonicalizeStringList(payload.equipment),
        focusAreas: canonicalizeStringList(payload.focusAreas),
        injuries: canonicalizeStringList(payload.injuries),
    });
}

function summarizePersonalization(payload?: AiAdvisorPersonalization | null): Record<string, unknown> | null {
    if (!payload) {
        return null;
    }
    return compactMetadata({
        hasProfile: Boolean(payload.profile),
        goalCount: Array.isArray(payload.goals) ? payload.goals.length : undefined,
        equipmentCount: Array.isArray(payload.equipment) ? payload.equipment.length : undefined,
        hasStats: Boolean(payload.stats),
        hasAchievements: Boolean(payload.achievements),
        hasReadiness: Boolean(payload.readiness),
        customTone: typeof payload.tone === 'string' ? payload.tone : undefined,
    });
}

type TrackAiAdvisorMetricsInput = {
    prisma?: SafePrismaClient;
    traceId?: string | null;
    profileId: string;
    request: NormalizedAiAdviceRequest;
    response: AssistantAdviceResponse;
    fingerprint: string;
};

const trackAiAdvisorMetrics = async ({
    prisma,
    traceId,
    profileId,
    request,
    response,
    fingerprint,
}: TrackAiAdvisorMetricsInput) => {
    if (!response || typeof response !== 'object') {
        return;
    }
    const metadata = (response.metadata ?? {}) as Record<string, unknown>;
    const latencyMs = parseNumber(metadata.latencyMs);
    const usageSnapshot = extractUsage(metadata.usage);
    const costSnapshot = extractCost(metadata.cost);
    const severity = resolveAiAdvisorSeverity(latencyMs, costSnapshot?.totalUsd);
    const contextSize = Array.isArray(request.context) ? request.context.length : 0;
    const payload = compactMetadata({
        provider: typeof metadata.provider === 'string' ? metadata.provider : undefined,
        status: typeof metadata.status === 'string' ? metadata.status : undefined,
        contextUsed: typeof metadata.contextUsed === 'boolean' ? metadata.contextUsed : undefined,
        latencyMs,
        promptTokens: usageSnapshot?.promptTokens,
        completionTokens: usageSnapshot?.completionTokens,
        totalTokens: usageSnapshot?.totalTokens,
        costUsd: costSnapshot?.totalUsd,
        costInputUsd: costSnapshot?.inputUsd,
        costOutputUsd: costSnapshot?.outputUsd,
        fingerprint,
        exerciseKey: request.exerciseKey,
        contextEntries: contextSize,
    });
    try {
        await recordMonitoringEvent(prisma, {
            category: 'ai_advisor',
            severity,
            message: 'ai_advice_generated',
            traceId,
            profileId,
            resource: request.exerciseKey,
            metadata: payload,
        });
    } catch (monitoringError) {
        if (process.env.NODE_ENV !== 'test') {
            console.error('Failed to record AI advisor metrics', monitoringError);
        }
    }
};

type RecordAiAdvisorFallbackInput = {
    prisma?: SafePrismaClient;
    traceId?: string | null;
    profileId: string;
    fingerprint: string;
    reason: AiAdvisorFallbackReason;
    error: unknown;
};

const recordAiAdvisorFallback = async ({
    prisma,
    traceId,
    profileId,
    fingerprint,
    reason,
    error,
}: RecordAiAdvisorFallbackInput) => {
    const severity = fallbackSeverityMap[reason] ?? 'warning';
    try {
        await recordMonitoringEvent(prisma, {
            category: 'ai_advisor',
            severity,
            message: 'ai_advice_fallback',
            traceId,
            profileId,
            metadata: compactMetadata({ reason, fingerprint }),
            error,
        });
    } catch (monitoringError) {
        if (process.env.NODE_ENV !== 'test') {
            console.error('Failed to record AI advisor fallback event', monitoringError);
        }
    }
};

const fallbackSeverityMap: Record<AiAdvisorFallbackReason, MonitoringSeverity> = {
    microservice_timeout: 'warning',
    microservice_unavailable: 'critical',
    microservice_error: 'warning',
    provider_error: 'warning',
    unknown: 'warning',
};

const resolveAiAdvisorSeverity = (latencyMs?: number | null, costUsd?: number | null): MonitoringSeverity => {
    if (typeof latencyMs === 'number' && latencyMs >= aiAdvisorMonitoringConfig.latency.criticalMs) {
        return 'critical';
    }
    if (typeof costUsd === 'number' && costUsd >= aiAdvisorMonitoringConfig.cost.criticalUsd) {
        return 'critical';
    }
    if (typeof latencyMs === 'number' && latencyMs >= aiAdvisorMonitoringConfig.latency.warnMs) {
        return 'warning';
    }
    if (typeof costUsd === 'number' && costUsd >= aiAdvisorMonitoringConfig.cost.warnUsd) {
        return 'warning';
    }
    return 'info';
};

type UsageSnapshot = {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
};

const extractUsage = (value: unknown): UsageSnapshot | null => {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const promptTokens = parseNumber((value as Record<string, unknown>).promptTokens);
    const completionTokens = parseNumber((value as Record<string, unknown>).completionTokens);
    const totalTokens = parseNumber((value as Record<string, unknown>).totalTokens);
    if (typeof promptTokens !== 'number' && typeof completionTokens !== 'number' && typeof totalTokens !== 'number') {
        return null;
    }
    return compactMetadata({ promptTokens, completionTokens, totalTokens });
};

type CostSnapshot = {
    inputUsd?: number;
    outputUsd?: number;
    totalUsd?: number;
};

const extractCost = (value: unknown): CostSnapshot | null => {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const inputUsd = parseNumber((value as Record<string, unknown>).inputUsd);
    const outputUsd = parseNumber((value as Record<string, unknown>).outputUsd);
    const totalUsd = parseNumber((value as Record<string, unknown>).totalUsd);
    if (typeof inputUsd !== 'number' && typeof outputUsd !== 'number' && typeof totalUsd !== 'number') {
        return null;
    }
    return compactMetadata({ inputUsd, outputUsd, totalUsd });
};

const parseNumber = (value: unknown): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return undefined;
};

const compactMetadata = <T extends Record<string, unknown>>(payload: T): Partial<T> => {
    return Object.fromEntries(
        Object.entries(payload).filter(([, value]) => value !== undefined && value !== null),
    ) as Partial<T>;
};

const limitContextEntries = (
    entries?: AiAdvisorContextEntry[] | null,
): AiAdvisorContextEntry[] | undefined => {
    if (!Array.isArray(entries) || entries.length === 0) {
        return undefined;
    }
    const bounded = entries.slice(-aiAdvisorContextConfig.maxEntries);
    const maxChars = aiAdvisorContextConfig.maxCharacters;
    if (!Number.isFinite(maxChars) || maxChars <= 0) {
        return bounded;
    }

    const selected: AiAdvisorContextEntry[] = [];
    let remaining = maxChars;
    for (let index = bounded.length - 1; index >= 0; index -= 1) {
        const entry = bounded[index];
        const cost = estimateContextEntryCost(entry);
        if (selected.length === 0 && cost > maxChars) {
            selected.push(entry);
            break;
        }
        if (cost <= remaining) {
            selected.push(entry);
            remaining -= cost;
            continue;
        }
        break;
    }
    return selected.reverse();
};

const estimateContextEntryCost = (entry: AiAdvisorContextEntry): number => {
    let total = 0;
    total += entry.exerciseKey.length;
    total += entry.currentLevel.length;
    total += entry.advice.length;
    total += entry.createdAt.length;
    total += sumList(entry.goals);
    total += sumList(entry.nextSteps);
    total += sumList(entry.tips);
    total += sumRecord(entry.performance);
    return total;
};

const sumList = (values?: string[]): number => {
    if (!Array.isArray(values) || values.length === 0) {
        return 0;
    }
    return values.reduce((acc, value) => acc + value.length, 0);
};

const sumRecord = (record?: Record<string, string>): number => {
    if (!record) {
        return 0;
    }
    return Object.entries(record).reduce((acc, [key, value]) => acc + key.length + value.length, 0);
};
