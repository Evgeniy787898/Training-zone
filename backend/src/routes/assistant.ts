// TZONA V2 - Assistant API Route
// Ported from V1 assistant.js
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import conversationService from '../modules/ai/conversation.js';
import { interpretCommand } from '../modules/ai/internalAssistantEngine.js';
import aiCommandRouter from '../modules/ai/aiCommandRouter.js';
import { HistoryService, CONVERSATION_STATE_KEY } from '../modules/ai/history.js';
import { DatabaseService } from '../modules/integrations/supabase.js';
import { validateRequest } from '../middleware/validateRequest.js';
import type { SafePrismaClient } from '../types/prisma.js';
import { respondWithAppError, respondWithSuccess } from '../utils/apiResponses.js';
import { AppError, isAppError } from '../services/errors.js';
import { shortenText } from '../utils/text.js';
import {
    paginationQuerySchema,
    type PaginationMeta,
    type PaginationQuery,
} from '../types/pagination.js';
import { buildPaginationMeta, resolvePagination } from '../services/pagination.js';
import type {
    AssistantAdviceResponse,
    AssistantCommandInterpretationResponse,
    AssistantNoteResponse,
    AssistantNotesResponse,
    AssistantReplyResponse,
    AssistantStateResponse,
    AssistantNoteSummary,
} from '../types/apiResponses.js';
import { isPlainObject } from '../utils/object.js';
import { requestAiAdvice } from '../modules/ai/aiAdvisorGateway.js';
import { AiAdvisorContextService } from '../modules/ai/aiAdvisorContext.js';
import { createSseStream } from '../utils/sse.js';
import { loadAiAdvisorPersonalization } from '../modules/ai/aiAdvisorPersonalization.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import { rateLimitConfig } from '../config/constants.js';

const router = Router();

// Rate limiters for assistant endpoints (per-user limiting using profileId)
const chatRateLimiter = createRateLimiter({
    windowMs: rateLimitConfig.assistant.chat.windowMs,
    max: rateLimitConfig.assistant.chat.defaultMax,
    name: 'assistant-chat',
    keyGenerator: (req) => (req as any).profileId || req.ip || 'anonymous',
});

const ttsRateLimiter = createRateLimiter({
    windowMs: rateLimitConfig.assistant.tts.windowMs,
    max: rateLimitConfig.assistant.tts.defaultMax,
    name: 'assistant-tts',
    keyGenerator: (req) => (req as any).profileId || req.ip || 'anonymous',
});

const transcribeRateLimiter = createRateLimiter({
    windowMs: rateLimitConfig.assistant.transcribe.windowMs,
    max: rateLimitConfig.assistant.transcribe.defaultMax,
    name: 'assistant-transcribe',
    keyGenerator: (req) => (req as any).profileId || req.ip || 'anonymous',
});

// Latency monitoring - extracted to modules/ai/latencyMonitor.ts (BE-008)
import {
    type LatencyAlertSeverity,
    type LatencyAlertReason,
    type LatencyAlertPayload,
    type LatencyStats,
    resolveSlowThreshold,
    clampRatio,
    toPositiveInteger,
    toLatencyValue,
    buildLatencyAlertMessage,
    createLatencyAlert,
    normalizeAlertEntry,
    normalizeAlertHistoryList,
    normalizeMetadata,
    normalizeTags,
} from '../modules/ai/latencyMonitor.js';

const serializeAssistantNote = (note: any): AssistantNoteSummary => ({
    id: note.id,
    profileId: note.profileId,
    title: note.title ?? null,
    content: note.content ?? '',
    tags: normalizeTags(note.tags),
    source: note.source ?? 'unknown',
    metadata: normalizeMetadata(note.metadata),
    createdAt: note.createdAt,
});

const replySchema = z
    .object({
        message: z.string().trim().min(1, 'Сообщение не может быть пустым'),
        mode: z.enum(['chat', 'command']).default('chat'),
        persist: z.boolean().optional().default(true),
    })
    .strict();

const aiAdviceSchema = z
    .object({
        exerciseKey: z.string().trim().min(1).max(64),
        currentLevel: z.string().trim().min(1).max(32),
        performance: z.record(z.any()).default({}),
        goals: z.array(z.string().trim().min(1).max(64)).max(10).optional(),
    })
    .strict();

const noteCreateSchema = z
    .object({
        content: z.string().trim().min(1, 'Текст заметки обязателен'),
        title: z.string().trim().min(1).optional(),
        tags: z.array(z.string().trim().min(1)).optional(),
    })
    .strict();

const noteListQuerySchema = z
    .object({
        ...paginationQuerySchema.shape,
        limit: paginationQuerySchema.shape.page_size,
    })
    .strict();

const historyEntrySchema = z.union([
    z.string().trim().min(1).max(2000),
    z
        .record(z.any())
        .refine(value => Object.keys(value).length <= 50, {
            message: 'Объекты истории не должны содержать более 50 ключей',
        }),
]);

const commandInterpretSchema = z
    .object({
        message: z.string().trim().min(1, 'Сообщение не может быть пустым'),
        history: z.array(historyEntrySchema).max(10).optional(),
    })
    .strict();

type ReplyPayload = z.infer<typeof replySchema>;
type AiAdvicePayload = z.infer<typeof aiAdviceSchema>;
type NoteCreatePayload = z.infer<typeof noteCreateSchema>;
type NoteListQuery = z.infer<typeof noteListQuerySchema>;
type CommandInterpretPayload = z.infer<typeof commandInterpretSchema>;

type AssistantRequest = Request & {
    profileId?: string;
    profile?: any;
    prisma?: SafePrismaClient;
};

const buildResponseMeta = (req: Request, pagination?: PaginationMeta) => {
    if (!req.traceId && !pagination) {
        return undefined;
    }
    const meta: Record<string, unknown> = {};
    if (req.traceId) {
        meta.traceId = req.traceId;
    }
    if (pagination) {
        meta.pagination = pagination;
    }
    return meta;
};

router.post('/reply', chatRateLimiter, validateRequest({ body: replySchema }), async (req: AssistantRequest, res: Response, next) => {
    try {
        const payload = req.validated?.body as ReplyPayload;
        const db = new DatabaseService(req.prisma!);
        const historyService = new HistoryService(db);

        const historyState = await historyService.loadAssistantHistory(req.profileId!);
        const history = historyState.messages;

        const turnStartedAt = Date.now();

        // Load profile with cached AI summary (much faster than loading all relations)
        const profile = await req.prisma!.profile.findUnique({
            where: { id: req.profileId! },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                timezone: true,
                goals: true,
                equipment: true,
                aiSummary: true,
                aiSummaryUpdatedAt: true,
            },
        });

        // Import summary service
        const { needsSummaryRefresh, updateProfileSummary, expandSummaryForAi } = await import('../modules/ai/profileSummaryService.js');

        // Refresh summary in background if stale (>5 min)
        if (needsSummaryRefresh(profile?.aiSummaryUpdatedAt)) {
            updateProfileSummary(req.prisma!, req.profileId!); // async, don't await
        }

        // Build profile for AI from summary
        const profileForAi = {
            ...req.profile,
            firstName: profile?.firstName || req.profile?.firstName,
            aiSummary: profile?.aiSummary,
            aiSummaryText: profile?.aiSummary ? expandSummaryForAi(profile.aiSummary as any) : null,
            _prisma: req.prisma, // Pass prisma for Self-Learning integration
        };

        const interpretation = interpretCommand({
            profile: profileForAi,
            message: payload.message,
            history,
        });

        const reply = await conversationService.generateReply({
            profile: profileForAi,
            message: payload.message,
            history,
            mode: payload.mode,
        });

        const latencyMs = Date.now() - turnStartedAt;

        const previousLatencyStats = (historyState?.payload?.latency_stats as Record<string, any> | null) || null;
        const previousSamples = Number(previousLatencyStats?.samples) || 0;
        const previousAverage = Number(previousLatencyStats?.average_ms) || 0;
        const previousSlowTurns = Number(previousLatencyStats?.slow_turns) || 0;
        const previousWorst = Number(previousLatencyStats?.worst_ms) || 0;
        const slowThreshold = resolveSlowThreshold(previousLatencyStats);

        const samples = previousSamples + 1;
        const averageMs = Math.round(((previousAverage * previousSamples) + latencyMs) / samples);
        const worstMs = Math.max(previousWorst, latencyMs);
        const slowTurns = previousSlowTurns + (latencyMs >= slowThreshold ? 1 : 0);
        const slowRatio = samples > 0 ? Number((slowTurns / samples).toFixed(2)) : 0;
        const latencyStats = {
            last_ms: latencyMs,
            average_ms: averageMs,
            samples,
            slow_threshold_ms: slowThreshold,
            slow_turns: slowTurns,
            slow_ratio: slowRatio,
            worst_ms: worstMs,
            last_updated_at: new Date().toISOString(),
        };
        const isSlowResponse = latencyMs >= slowThreshold;

        const latencyAlertBase = createLatencyAlert(latencyMs, {
            slow_threshold_ms: slowThreshold,
            average_ms: averageMs,
            slow_ratio: slowRatio,
            samples,
        });
        const previousAlertHistory = normalizeAlertHistoryList(historyState?.payload?.latency_alert_history);
        const triggeredAt = new Date().toISOString();
        const latencyAlertRecord: LatencyAlertPayload | null = latencyAlertBase
            ? ({ ...latencyAlertBase, triggered_at: triggeredAt } as LatencyAlertPayload)
            : null;
        const latencyAlertHistory = latencyAlertRecord
            ? [latencyAlertRecord, ...previousAlertHistory].slice(0, 10)
            : previousAlertHistory;

        if (payload.persist) {
            await historyService.persistAssistantTurn({
                profileId: req.profileId!,
                previousState: historyState,
                userMessage: payload.message,
                assistantMessage: reply || undefined,
                intent: interpretation.intent,
                mode: payload.mode,
                extraMeta: {
                    latency_stats: latencyStats,
                    last_latency_ms: latencyMs,
                    slow_response: isSlowResponse,
                    ...(latencyAlertRecord
                        ? {
                            latency_alert: latencyAlertRecord,
                            latency_alert_history: latencyAlertHistory,
                        }
                        : {}),
                },
            });
        }

        try {
            await db.logDialogEvent(req.profileId!, 'assistant_reply', {
                mode: payload.mode,
                intent: interpretation.intent,
                history_messages: history.length,
                latency_ms: latencyMs,
                slow_threshold_ms: slowThreshold,
                slow: isSlowResponse,
            }, {
                responseLatencyMs: latencyMs,
            });
            if (latencyAlertRecord) {
                await db.logEvent(
                    req.profileId!,
                    'assistant_latency',
                    latencyAlertRecord.severity === 'error' ? 'error' : 'warn',
                    {
                        ...latencyAlertRecord,
                        trace_id: req.traceId || null,
                        triggered_at: triggeredAt,
                    },
                    req.traceId || null,
                );
            }

            // Log interaction for AI Self-Learning (ML-001)
            try {
                await (req.prisma! as any).aIInteraction.create({
                    data: {
                        profileId: req.profileId,
                        userMessage: payload.message,
                        aiResponse: reply || '',
                        intent: interpretation.intent,
                        latencyMs: latencyMs,
                        metadata: {
                            mode: payload.mode,
                            history_length: history.length,
                            confidence: interpretation.confidence,
                            slow: isSlowResponse,
                        },
                    },
                });
            } catch (err) {
                // AIInteraction table might not exist - that's OK
                console.debug('[Assistant] AIInteraction logging failed (table may not exist)');
            }
        } catch (eventError) {
            console.error('Failed to log assistant reply telemetry:', eventError);
        }

        const responsePayload: AssistantReplyResponse = {
            reply,
            intent: interpretation.intent,
            confidence: interpretation.confidence,
            candidates: interpretation.candidateIntents,
            saved: Boolean(payload.persist),
            latency_ms: latencyMs,
            latency_stats: latencyStats,
            slow_response: isSlowResponse,
            latency_alert: latencyAlertRecord,
        };

        return respondWithSuccess<AssistantReplyResponse>(res, responsePayload, {
            meta: req.traceId ? { traceId: req.traceId } : undefined,
        });
    } catch (error) {
        next(error);
    }
});

router.post(
    '/commands/interpret',
    validateRequest({ body: commandInterpretSchema }),
    async (req: AssistantRequest, res: Response, next) => {
        try {
            if (!req.profileId) {
                return respondWithAppError(
                    res,
                    new AppError({
                        code: 'auth_required',
                        message: 'Profile required',
                        statusCode: 401,
                        category: 'authentication',
                    }),
                    { traceId: req.traceId },
                );
            }

            const payload = req.validated?.body as CommandInterpretPayload;
            const interpretation = await aiCommandRouter.interpret({
                profile: req.profile,
                message: payload.message,
                history: payload.history,
            });

            const candidateList = Array.isArray((interpretation as any)?.candidateIntents)
                ? (interpretation as any).candidateIntents.map((candidate: any) => ({
                    intent: typeof candidate?.intent === 'string' ? candidate.intent : 'unknown',
                    confidence: typeof candidate?.confidence === 'number' ? candidate.confidence : 0,
                }))
                : [];

            const entities = isPlainObject((interpretation as any)?.entities)
                ? ((interpretation as any).entities as Record<string, unknown>)
                : {};
            const slots = isPlainObject((interpretation as any)?.slots)
                ? ((interpretation as any).slots as Record<string, unknown>)
                : {};

            const responsePayload: AssistantCommandInterpretationResponse = {
                intent: typeof interpretation?.intent === 'string' ? interpretation.intent : 'unknown',
                raw_intent: typeof (interpretation as any)?.rawIntent === 'string'
                    ? (interpretation as any).rawIntent
                    : null,
                confidence:
                    typeof (interpretation as any)?.confidence === 'number'
                        ? (interpretation as any).confidence
                        : 0,
                candidates: candidateList,
                entities,
                slots,
                needs_clarification: Boolean((interpretation as any)?.needsClarification),
                follow_up: typeof (interpretation as any)?.followUp === 'string' ? (interpretation as any).followUp : null,
                history: Array.isArray((interpretation as any)?.history)
                    ? ((interpretation as any).history as string[])
                    : [],
                profile_id:
                    typeof (interpretation as any)?.profileId === 'string'
                        ? (interpretation as any).profileId
                        : req.profileId ?? null,
            };

            return respondWithSuccess<AssistantCommandInterpretationResponse>(res, responsePayload, {
                meta: req.traceId ? { traceId: req.traceId } : undefined,
            });
        } catch (error) {
            next(error);
        }
    },
);

router.post('/ai-advice', validateRequest({ body: aiAdviceSchema }), async (req: AssistantRequest, res: Response, next) => {
    try {
        if (!req.profileId) {
            return respondWithAppError(
                res,
                new AppError({
                    code: 'auth_required',
                    message: 'Profile required',
                    statusCode: 401,
                    category: 'authentication',
                }),
                { traceId: req.traceId },
            );
        }

        const payload = req.validated?.body as AiAdvicePayload;
        const db = new DatabaseService(req.prisma!);
        const contextService = new AiAdvisorContextService(db);
        const contextEntries = await contextService.loadContext(req.profileId);
        const personalization = await loadAiAdvisorPersonalization(req.prisma!, req.profileId);

        const advice = await requestAiAdvice(
            {
                ...payload,
                performance: payload.performance ?? {},
                profileId: req.profileId,
                context: contextEntries,
                personalization: personalization ?? undefined,
            },
            { traceId: req.traceId, prisma: req.prisma },
        );

        try {
            await contextService.recordInteraction(req.profileId, {
                exerciseKey: payload.exerciseKey,
                currentLevel: payload.currentLevel,
                goals: payload.goals,
                performance: payload.performance,
                advice: advice.advice,
                nextSteps: advice.nextSteps,
                tips: advice.tips,
            });
        } catch (contextError) {
            console.error('Failed to persist AI advisor context:', contextError);
        }

        return respondWithSuccess<AssistantAdviceResponse>(res, advice, {
            meta: req.traceId ? { traceId: req.traceId } : undefined,
        });
    } catch (error) {
        next(error);
    }
});

router.post(
    '/ai-advice/stream',
    validateRequest({ body: aiAdviceSchema }),
    async (req: AssistantRequest, res: Response, next) => {
        if (!req.profileId) {
            return respondWithAppError(
                res,
                new AppError({
                    code: 'auth_required',
                    message: 'Profile required',
                    statusCode: 401,
                    category: 'authentication',
                }),
                { traceId: req.traceId },
            );
        }

        const payload = req.validated?.body as AiAdvicePayload;
        const baseMeta = { traceId: req.traceId ?? null };
        let stream: ReturnType<typeof createSseStream> | null = null;
        let closeHandler: (() => void) | null = null;

        const detachCloseHandler = () => {
            if (!closeHandler) {
                return;
            }
            if (typeof (req as any).off === 'function') {
                (req as any).off('close', closeHandler);
            } else {
                req.removeListener('close', closeHandler);
            }
            closeHandler = null;
        };

        const safeSend = (event: string, data: Record<string, unknown>) => {
            if (stream && !stream.isClosed()) {
                stream.send(event, { ...data, ...baseMeta });
            }
        };

        try {
            stream = createSseStream(res);
            closeHandler = () => {
                if (stream && !stream.isClosed()) {
                    stream.close({ stage: 'disconnected', ...baseMeta });
                }
            };
            req.on('close', closeHandler);

            safeSend('progress', { stage: 'accepted' });

            const db = new DatabaseService(req.prisma!);
            const contextService = new AiAdvisorContextService(db);
            const contextEntries = await contextService.loadContext(req.profileId);
            const personalization = await loadAiAdvisorPersonalization(req.prisma!, req.profileId);

            safeSend('progress', { stage: 'context_loaded', entries: contextEntries.length });
            safeSend('progress', { stage: 'personalization_loaded', enriched: Boolean(personalization) });

            if (stream.isClosed()) {
                detachCloseHandler();
                return;
            }

            const advice = await requestAiAdvice(
                {
                    ...payload,
                    performance: payload.performance ?? {},
                    profileId: req.profileId,
                    context: contextEntries,
                    personalization: personalization ?? undefined,
                },
                { traceId: req.traceId, prisma: req.prisma },
            );

            if (stream.isClosed()) {
                detachCloseHandler();
                return;
            }

            safeSend('advice', { stage: 'advice', payload: advice });

            try {
                await contextService.recordInteraction(req.profileId, {
                    exerciseKey: payload.exerciseKey,
                    currentLevel: payload.currentLevel,
                    goals: payload.goals,
                    performance: payload.performance,
                    advice: advice.advice,
                    nextSteps: advice.nextSteps,
                    tips: advice.tips,
                });
                safeSend('progress', { stage: 'context_recorded' });
            } catch (contextError) {
                console.error('Failed to persist AI advisor context:', contextError);
                safeSend('progress', { stage: 'context_record_failed' });
            }

            safeSend('complete', { stage: 'completed' });
            stream.close({ stage: 'completed', ...baseMeta });
            detachCloseHandler();
        } catch (error) {
            if (stream && !stream.isClosed()) {
                safeSend('error', {
                    stage: 'failed',
                    error: isAppError(error) ? error.code : 'internal_error',
                    message: isAppError(error) ? error.message : 'Unexpected assistant error',
                });
                stream.close({ stage: 'failed', ...baseMeta });
                detachCloseHandler();
                return;
            }
            detachCloseHandler();
            next(error);
        }
    },
);

router.get('/notes', validateRequest({ query: noteListQuerySchema }), async (req: AssistantRequest, res: Response, next) => {
    const query = (req.validated?.query as NoteListQuery | undefined) ?? {};
    const paginationInput: PaginationQuery = {
        page: query.page,
        page_size: query.page_size ?? query.limit,
    };
    const pagination = resolvePagination(paginationInput);

    try {
        const db = new DatabaseService(req.prisma!);
        const { notes, total } = await db.getAssistantNotes(req.profileId!, {
            limit: pagination.limit,
            offset: pagination.offset,
        });
        const paginationMeta = buildPaginationMeta({
            total,
            page: pagination.page,
            pageSize: pagination.pageSize,
        });
        const payload: AssistantNotesResponse = {
            notes: notes.map((note: any) => serializeAssistantNote(note)),
        };
        return respondWithSuccess<AssistantNotesResponse>(res, payload, {
            meta: buildResponseMeta(req, paginationMeta),
        });
    } catch (error) {
        next(error);
    }
});

router.post('/notes', validateRequest({ body: noteCreateSchema }), async (req: AssistantRequest, res: Response, next) => {
    try {
        const payload = req.validated?.body as NoteCreatePayload;
        const db = new DatabaseService(req.prisma!);

        const note = await db.saveAssistantNote(req.profileId!, {
            title: payload.title,
            content: payload.content,
            tags: payload.tags || [],
            metadata: {
                source: 'api',
            },
        });

        try {
            await db.mergeDialogState(req.profileId!, CONVERSATION_STATE_KEY, (state: any = {}) => ({
                ...state,
                notes_saved: (state?.notes_saved || 0) + 1,
                last_saved_note_id: note.id,
                last_saved_note_at: note.createdAt,
                last_note_preview: shortenText(note.content),
            }));
        } catch (error) {
            console.error('Failed to merge dialog state after API note save:', error);
        }

        await db.logEvent(req.profileId!, 'assistant_note_saved', 'info', {
            note_id: note.id,
            source: 'api',
        });

        const responsePayload: AssistantNoteResponse = { note: serializeAssistantNote(note) };
        return respondWithSuccess<AssistantNoteResponse>(res, responsePayload, {
            statusCode: 201,
            meta: req.traceId ? { traceId: req.traceId } : undefined,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return respondWithAppError(
                res,
                new AppError({
                    code: 'validation_failed',
                    message: 'Некорректные данные',
                    statusCode: 422,
                    category: 'validation',
                    details: error.issues,
                    exposeDetails: true,
                }),
                { traceId: req.traceId },
            );
        }
        next(error);
    }
});

router.get('/state', async (req: AssistantRequest, res: Response, next) => {
    try {
        if (!req.profileId || !req.prisma) {
            return respondWithAppError(
                res,
                new AppError({
                    code: 'auth_required',
                    message: 'Profile required',
                    statusCode: 401,
                    category: 'authentication',
                }),
                { traceId: req.traceId },
            );
        }

        const db = new DatabaseService(req.prisma!);
        const stateRecord = await db.getDialogState(req.profileId, 'assistant_session');
        const payload = (stateRecord?.statePayload as any) || {};

        const normalized = {
            status: (payload.session_status as string) || 'idle',
            last_user_message_at: payload.last_user_message_at || null,
            last_assistant_message_at: payload.last_assistant_message_at || null,
            last_intent: payload.last_intent || null,
            last_mode: payload.last_mode || null,
            total_user_messages: payload.total_user_messages || 0,
            total_assistant_messages: payload.total_assistant_messages || 0,
            total_turns: payload.total_turns || 0,
            closed_at: payload.closed_at || null,
            closed_reason: payload.closed_reason || null,
            closed_summary: payload.closed_summary || null,
            last_updated_at: payload.last_updated_at || stateRecord?.updatedAt?.toISOString() || null,
            last_latency_ms: payload.last_latency_ms ?? null,
            slow_response: payload.slow_response ?? false,
            latency_stats: (() => {
                const stats = payload.latency_stats;
                if (!stats || typeof stats !== 'object') {
                    return null;
                }
                return {
                    last_ms: typeof stats.last_ms === 'number' ? stats.last_ms : null,
                    average_ms: typeof stats.average_ms === 'number' ? stats.average_ms : null,
                    samples: typeof stats.samples === 'number' ? stats.samples : 0,
                    slow_threshold_ms: typeof stats.slow_threshold_ms === 'number' ? stats.slow_threshold_ms : resolveSlowThreshold(stats),
                    slow_turns: typeof stats.slow_turns === 'number' ? stats.slow_turns : 0,
                    slow_ratio: typeof stats.slow_ratio === 'number' ? stats.slow_ratio : 0,
                    worst_ms: typeof stats.worst_ms === 'number' ? stats.worst_ms : null,
                    last_updated_at: stats.last_updated_at || stateRecord?.updatedAt?.toISOString() || null,
                };
            })(),
            latency_alert: (() => {
                const entry = normalizeAlertEntry(payload.latency_alert);
                return entry || null;
            })(),
            latency_alert_history: normalizeAlertHistoryList(payload.latency_alert_history),
        };

        const responsePayload: AssistantStateResponse = {
            state: normalized,
            updated_at: stateRecord?.updatedAt?.toISOString() || null,
            expires_at: stateRecord?.expiresAt?.toISOString() || null,
        };

        return respondWithSuccess<AssistantStateResponse>(res, responsePayload, {
            meta: req.traceId ? { traceId: req.traceId } : undefined,
        });
    } catch (error) {
        next(error);
    }
});

// ============================================
// CHAT HISTORY ENDPOINTS
// ============================================

const CHAT_HISTORY_STATE_TYPE = 'trainer_chat_history';
const MAX_CHAT_MESSAGES = 100;

interface ChatHistoryMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}

// GET /assistant/chat/history - Load chat history from DB
router.get('/chat/history', async (req: AssistantRequest, res: Response, next) => {
    try {
        if (!req.profileId) {
            return respondWithAppError(res, new AppError({
                code: 'unauthorized',
                message: 'Profile ID required',
                statusCode: 401,
                category: 'authentication',
            }));
        }

        const historyState = await req.prisma!.dialogState.findUnique({
            where: {
                profileId_stateType: {
                    profileId: req.profileId,
                    stateType: CHAT_HISTORY_STATE_TYPE,
                },
            },
        });

        const messages: ChatHistoryMessage[] = historyState?.statePayload
            && typeof historyState.statePayload === 'object'
            && 'messages' in (historyState.statePayload as any)
            ? (historyState.statePayload as any).messages
            : [];

        return respondWithSuccess(res, {
            messages,
            count: messages.length,
        });
    } catch (error) {
        next(error);
    }
});

// POST /assistant/chat/history - Save chat history to DB
const chatHistorySaveSchema = z.object({
    messages: z.array(z.object({
        id: z.string().optional(), // UUID for reaction tracking
        role: z.enum(['user', 'assistant']),
        content: z.string(),
        timestamp: z.string(),
        myReaction: z.string().nullish(), // User's reaction emoji
        aiReaction: z.string().nullish(), // AI's reaction
    })).max(MAX_CHAT_MESSAGES),
}).strict();

router.post('/chat/history', validateRequest({ body: chatHistorySaveSchema }), async (req: AssistantRequest, res: Response, next) => {
    try {
        if (!req.profileId) {
            return respondWithAppError(res, new AppError({
                code: 'unauthorized',
                message: 'Profile ID required',
                statusCode: 401,
                category: 'authentication',
            }));
        }

        const { messages } = req.validated?.body as { messages: ChatHistoryMessage[] };

        // Keep only last MAX_CHAT_MESSAGES
        const trimmedMessages = messages.slice(-MAX_CHAT_MESSAGES);

        await req.prisma!.dialogState.upsert({
            where: {
                profileId_stateType: {
                    profileId: req.profileId,
                    stateType: CHAT_HISTORY_STATE_TYPE,
                },
            },
            update: {
                statePayload: JSON.parse(JSON.stringify({ messages: trimmedMessages })),
                updatedAt: new Date(),
            },
            create: {
                profileId: req.profileId,
                stateType: CHAT_HISTORY_STATE_TYPE,
                statePayload: JSON.parse(JSON.stringify({ messages: trimmedMessages })),
            },
        });

        return respondWithSuccess(res, {
            saved: true,
            count: trimmedMessages.length,
        });
    } catch (error) {
        next(error);
    }
});

// DELETE /assistant/chat/history - Clear chat history
router.delete('/chat/history', async (req: AssistantRequest, res: Response, next) => {
    try {
        if (!req.profileId) {
            return respondWithAppError(res, new AppError({
                code: 'unauthorized',
                message: 'Profile ID required',
                statusCode: 401,
                category: 'authentication',
            }));
        }

        await req.prisma!.dialogState.deleteMany({
            where: {
                profileId: req.profileId,
                stateType: CHAT_HISTORY_STATE_TYPE,
            },
        });

        return respondWithSuccess(res, { cleared: true });
    } catch (error) {
        next(error);
    }
});

// ====== VOICE I/O ======

import multer from 'multer';
import OpenAI from 'openai';
import { Readable } from 'stream';

const audioUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid audio format'));
        }
    },
});

// POST /assistant/transcribe - Whisper transcription
router.post('/transcribe', transcribeRateLimiter, audioUpload.single('audio') as any, async (req: AssistantRequest, res: Response, next) => {
    try {
        if (!req.file) {
            return respondWithAppError(res, new AppError({
                code: 'invalid_request',
                message: 'No audio file provided',
                statusCode: 400,
                category: 'validation',
            }));
        }

        const openaiKey = process.env.OPENAI_API_KEY;
        if (!openaiKey) {
            return respondWithAppError(res, new AppError({
                code: 'service_unavailable',
                message: 'OpenAI API not configured',
                statusCode: 503,
                category: 'dependencies',
            }));
        }

        const openai = new OpenAI({ apiKey: openaiKey });

        // Convert buffer to File-like object for OpenAI
        const audioFile = new File([req.file.buffer], req.file.originalname, {
            type: req.file.mimetype,
        });

        const transcription = await openai.audio.transcriptions.create({
            file: audioFile,
            model: 'whisper-1',
            language: 'ru',
        });

        console.log(`[Assistant] Transcribed audio: "${shortenText(transcription.text, 50)}"`);

        return respondWithSuccess(res, { text: transcription.text });
    } catch (error: any) {
        console.error('[Assistant] Transcription error:', error);

        if (error?.status === 400) {
            return respondWithAppError(res, new AppError({
                code: 'invalid_request',
                message: 'Invalid audio file',
                statusCode: 400,
                category: 'validation',
            }));
        }

        next(error);
    }
});

// POST /assistant/speak - TTS (Text-to-Speech)
const speakSchema = z.object({
    text: z.string().min(1).max(4096),
    voice: z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']).optional().default('onyx'),
});

router.post('/speak',
    ttsRateLimiter,
    validateRequest({ body: speakSchema }),
    async (req: AssistantRequest, res: Response, next) => {
        try {
            const { text, voice } = req.validated?.body as { text: string; voice: string };

            const openaiKey = process.env.OPENAI_API_KEY;
            if (!openaiKey) {
                return respondWithAppError(res, new AppError({
                    code: 'service_unavailable',
                    message: 'OpenAI API not configured',
                    statusCode: 503,
                    category: 'dependencies',
                }));
            }

            const openai = new OpenAI({ apiKey: openaiKey });

            const mp3Response = await openai.audio.speech.create({
                model: 'tts-1',
                voice: voice, // 'onyx' - мужской голос
                input: text,
                speed: 1.0,
            });

            const buffer = Buffer.from(await mp3Response.arrayBuffer());

            console.log(`[Assistant] Generated speech: ${buffer.length} bytes for "${shortenText(text, 30)}"`);

            res.set({
                'Content-Type': 'audio/mpeg',
                'Content-Length': buffer.length.toString(),
                'Cache-Control': 'private, max-age=3600',
            });

            return res.send(buffer);
        } catch (error: any) {
            console.error('[Assistant] TTS error:', error);
            next(error);
        }
    });

// ====== MESSAGE FEEDBACK (Reactions) ======

const feedbackSchema = z.object({
    messageId: z.string().uuid(),
    reaction: z.string().max(10), // 'like', 'dislike', or emoji
    comment: z.string().max(500).optional(),
    userMessage: z.string().max(2000),
    aiResponse: z.string().max(5000),
    aiMood: z.string().max(20).optional(),
});

// POST /assistant/feedback - Save user reaction to AI response
router.post('/feedback', validateRequest({ body: feedbackSchema }), async (req: AssistantRequest, res: Response, next) => {
    try {
        if (!req.profileId) {
            return respondWithAppError(res, new AppError({
                code: 'unauthorized',
                message: 'Profile ID required',
                statusCode: 401,
                category: 'authentication',
            }));
        }

        const { messageId, reaction, comment, userMessage, aiResponse, aiMood } = req.body;

        // 1. Save to MessageFeedback (existing behavior)
        const feedback = await req.prisma!.messageFeedback.upsert({
            where: { messageId },
            create: {
                profileId: req.profileId,
                messageId,
                reaction,
                comment,
                userMessage,
                aiResponse,
                aiMood,
            },
            update: {
                reaction,
                comment,
            },
        });

        // 2. Store in AIInteraction for learning (NEW - AI Self-Learning)
        try {
            await (req.prisma! as any).aIInteraction.create({
                data: {
                    profileId: req.profileId,
                    userMessage,
                    aiResponse,
                    rating: reaction === 'like' ? 'positive' : reaction === 'dislike' ? 'negative' : 'neutral',
                    reactionEmoji: reaction.length <= 4 ? reaction : null, // Emoji only
                    feedbackComment: comment,
                    metadata: {
                        messageId,
                        aiMood,
                        source: 'feedback',
                    },
                },
            });
        } catch (err) {
            // AIInteraction table might not exist yet - that's OK
            console.warn('[Assistant] AIInteraction create failed (table may not exist):', (err as Error).message);
        }

        // 3. Trigger AI Self-Learning pipeline (NEW)
        try {
            const { createSelfLearningEngine } = await import('../services/aiSelfLearning.js');
            const learningEngine = createSelfLearningEngine(req.prisma! as any, req.profileId);

            // Process feedback asynchronously (don't block response)
            const ratingType = reaction === 'like' ? 'positive' : reaction === 'dislike' ? 'negative' : 'neutral';
            learningEngine.processFeedback({
                interactionId: messageId,
                rating: ratingType,
                emoji: reaction.length <= 4 ? reaction : undefined,
                comment: comment,
            }).catch(err => {
                console.warn('[SelfLearning] Processing failed:', err.message);
            });

            // If enough feedback collected, run instruction generation (async, don't block)
            if (reaction === 'like') {
                learningEngine.runInstructionGeneration().catch(err => {
                    console.warn('[SelfLearning] Instruction generation failed:', err.message);
                });
            }
        } catch (err) {
            console.warn('[Assistant] Self-learning integration failed:', (err as Error).message);
        }

        console.log(`[Assistant] Feedback saved: ${reaction} for message ${messageId.slice(0, 8)}`);

        return respondWithSuccess(res, {
            saved: true,
            id: feedback.id,
            learningTriggered: true,
        });
    } catch (error) {
        next(error);
    }
});

// GET /assistant/feedback/stats - Get feedback statistics for ML insights
router.get('/feedback/stats', async (req: AssistantRequest, res: Response, next) => {
    try {
        if (!req.profileId) {
            return respondWithAppError(res, new AppError({
                code: 'unauthorized',
                message: 'Profile ID required',
                statusCode: 401,
                category: 'authentication',
            }));
        }

        const stats = await req.prisma!.messageFeedback.groupBy({
            by: ['reaction'],
            where: { profileId: req.profileId },
            _count: { reaction: true },
        });

        const total = await req.prisma!.messageFeedback.count({
            where: { profileId: req.profileId },
        });

        // Get recent dislikes with comments for improvement
        const recentDislikes = await req.prisma!.messageFeedback.findMany({
            where: {
                profileId: req.profileId,
                reaction: 'dislike',
                comment: { not: null },
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
                comment: true,
                createdAt: true,
            },
        });

        return respondWithSuccess(res, {
            total,
            byReaction: stats.reduce((acc, s) => {
                acc[s.reaction] = s._count.reaction;
                return acc;
            }, {} as Record<string, number>),
            recentDislikes: recentDislikes.map(d => ({
                comment: d.comment,
                date: d.createdAt.toISOString(),
            })),
        });
    } catch (error) {
        next(error);
    }
});

// ============================================================
// PERSONAL INSTRUCTIONS ENDPOINTS (PERS-INS-002)
// ============================================================

const personalInstructionSchema = z.object({
    type: z.enum(['name', 'address', 'injury', 'preference', 'prohibition', 'style', 'note']),
    value: z.string().min(1).max(500),
    priority: z.number().int().min(1).max(10).optional(),
});

const personalInstructionsPayloadSchema = z.object({
    instructions: z.array(personalInstructionSchema).max(20),
}).strict();

/**
 * GET /assistant/instructions
 * Get user's personal AI instructions
 */
router.get('/instructions', async (req, res, next) => {
    try {
        const profile = await req.prisma!.profile.findUnique({
            where: { id: req.profileId },
            select: { customInstructions: true },
        });

        if (!profile) {
            return respondWithAppError(res, new AppError({
                message: 'Profile not found',
                code: 'not_found',
                statusCode: 404,
                category: 'not_found',
            }));
        }

        let instructions: any[] = [];

        if (profile.customInstructions) {
            const data = profile.customInstructions as any;
            if (Array.isArray(data)) {
                instructions = data;
            } else if (data.instructions && Array.isArray(data.instructions)) {
                instructions = data.instructions;
            }
        }

        return respondWithSuccess(res, {
            instructions,
            count: instructions.length,
            maxAllowed: 20,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /assistant/instructions
 * Update user's personal AI instructions
 */
router.put(
    '/instructions',
    validateRequest({ body: personalInstructionsPayloadSchema }),
    async (req, res, next) => {
        try {
            const { instructions } = req.validated!.body as z.infer<typeof personalInstructionsPayloadSchema>;

            // Validate total length
            const totalLength = instructions.reduce((sum, i) => sum + i.value.length, 0);
            if (totalLength > 2000) {
                return respondWithAppError(
                    res,
                    new AppError({
                        message: 'Total instruction length exceeds 2000 characters',
                        code: 'validation_error',
                        statusCode: 400,
                        category: 'validation',
                    })
                );
            }

            // Sanitize instructions (basic XSS removal)
            const sanitized = instructions.map(inst => ({
                type: inst.type,
                value: inst.value
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                    .replace(/<[^>]*>/g, '')
                    .trim(),
                priority: inst.priority,
            }));

            const payload = {
                instructions: sanitized,
                updatedAt: new Date().toISOString(),
            };

            await req.prisma!.profile.update({
                where: { id: req.profileId },
                data: { customInstructions: payload },
            });

            return respondWithSuccess(res, {
                success: true,
                instructions: sanitized,
                count: sanitized.length,
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * DELETE /assistant/instructions/:type
 * Delete all instructions of a specific type
 */
router.delete('/instructions/:type', async (req, res, next) => {
    try {
        const { type } = req.params;
        const validTypes = ['name', 'address', 'injury', 'preference', 'prohibition', 'style', 'note'];

        if (!validTypes.includes(type)) {
            return respondWithAppError(
                res,
                new AppError({
                    message: `Invalid instruction type: ${type}`,
                    code: 'validation_error',
                    statusCode: 400,
                    category: 'validation',
                })
            );
        }

        const profile = await req.prisma!.profile.findUnique({
            where: { id: req.profileId },
            select: { customInstructions: true },
        });

        if (!profile) {
            return respondWithAppError(res, new AppError({
                message: 'Profile not found',
                code: 'not_found',
                statusCode: 404,
                category: 'not_found',
            }));
        }

        let instructions: any[] = [];
        if (profile.customInstructions) {
            const data = profile.customInstructions as any;
            if (Array.isArray(data)) {
                instructions = data;
            } else if (data.instructions && Array.isArray(data.instructions)) {
                instructions = data.instructions;
            }
        }

        // Filter out instructions of the specified type
        const filtered = instructions.filter(i => i.type !== type);
        const removed = instructions.length - filtered.length;

        const payload = {
            instructions: filtered,
            updatedAt: new Date().toISOString(),
        };

        await req.prisma!.profile.update({
            where: { id: req.profileId },
            data: { customInstructions: payload },
        });

        return respondWithSuccess(res, {
            success: true,
            removed,
            remaining: filtered.length,
        });
    } catch (error) {
        next(error);
    }
});

// ============================================================
// AI SELF-LEARNING ENDPOINTS (SELF-001, ML-001, LEARN-001)
// ============================================================

/**
 * GET /assistant/learned-instructions
 * Get auto-generated instructions from AI self-learning
 */
router.get('/learned-instructions', async (req: AssistantRequest, res: Response, next) => {
    try {
        if (!req.profileId) {
            return respondWithAppError(res, new AppError({
                code: 'unauthorized',
                message: 'Profile ID required',
                statusCode: 401,
                category: 'authentication',
            }));
        }

        const { createSelfLearningEngine } = await import('../services/aiSelfLearning.js');
        const engine = createSelfLearningEngine(req.prisma! as any, req.profileId);

        const instructions = await engine.getActiveInstructions();
        const promptAddition = await engine.getInstructionsForPrompt();

        return respondWithSuccess(res, {
            instructions: instructions.map(i => ({
                id: i.id,
                content: i.content,
                category: i.category,
                confidence: i.confidence,
                successRate: i.successRate,
                usageCount: i.usageCount,
                source: i.source,
                isActive: i.isActive,
                createdAt: i.createdAt,
            })),
            count: instructions.length,
            promptAddition,
        });
    } catch (error) {
        console.warn('[Assistant] learned-instructions error:', error);
        // Return empty if tables don't exist
        return respondWithSuccess(res, {
            instructions: [],
            count: 0,
            promptAddition: '',
            note: 'Self-learning tables may not be migrated yet',
        });
    }
});

/**
 * POST /assistant/trigger-learning
 * Manually trigger instruction generation from positive feedback
 */
router.post('/trigger-learning', async (req: AssistantRequest, res: Response, next) => {
    try {
        if (!req.profileId) {
            return respondWithAppError(res, new AppError({
                code: 'unauthorized',
                message: 'Profile ID required',
                statusCode: 401,
                category: 'authentication',
            }));
        }

        const { createSelfLearningEngine } = await import('../services/aiSelfLearning.js');
        const engine = createSelfLearningEngine(req.prisma! as any, req.profileId);

        const generatedInstructions = await engine.runInstructionGeneration();

        return respondWithSuccess(res, {
            generated: generatedInstructions.length,
            instructions: generatedInstructions.map(i => ({
                id: i.id,
                content: i.content,
                category: i.category,
                confidence: i.confidence,
            })),
        });
    } catch (error) {
        console.warn('[Assistant] trigger-learning error:', error);
        return respondWithSuccess(res, {
            generated: 0,
            instructions: [],
            note: 'Self-learning may require more feedback data or tables may not be migrated',
        });
    }
});

/**
 * GET /assistant/learning-profile
 * Get user's AI learning profile (communication style, patterns)
 */
router.get('/learning-profile', async (req: AssistantRequest, res: Response, next) => {
    try {
        if (!req.profileId) {
            return respondWithAppError(res, new AppError({
                code: 'unauthorized',
                message: 'Profile ID required',
                statusCode: 401,
                category: 'authentication',
            }));
        }

        // Try to get user learning profile from DB
        try {
            const profile = await (req.prisma! as any).aIUserLearningProfile.findUnique({
                where: { profileId: req.profileId },
            });

            if (profile) {
                return respondWithSuccess(res, {
                    exists: true,
                    communicationStyle: JSON.parse(profile.communicationStyle || '{}'),
                    topics: JSON.parse(profile.topics || '{}'),
                    patterns: JSON.parse(profile.patterns || '{}'),
                    emotionalPatterns: JSON.parse(profile.emotionalPatterns || '{}'),
                    lastUpdated: profile.lastUpdated,
                });
            }
        } catch (err) {
            // Table might not exist
        }

        return respondWithSuccess(res, {
            exists: false,
            note: 'Learning profile will be created after more interactions',
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /assistant/apply-decay
 * Apply confidence decay to stale instructions (SELF-002)
 */
router.post('/apply-decay', async (req: AssistantRequest, res: Response, next) => {
    try {
        if (!req.profileId) {
            return respondWithAppError(res, new AppError({
                code: 'unauthorized',
                message: 'Profile ID required',
                statusCode: 401,
                category: 'authentication',
            }));
        }

        const { createSelfLearningEngine } = await import('../services/aiSelfLearning.js');
        const engine = createSelfLearningEngine(req.prisma! as any, req.profileId);

        const result = await engine.applyConfidenceDecay();

        return respondWithSuccess(res, {
            ...result,
            message: `Confidence decay applied: ${result.decayed} decayed, ${result.deprecated} deprecated`,
        });
    } catch (error) {
        console.warn('[Assistant] apply-decay error:', error);
        return respondWithSuccess(res, {
            decayed: 0,
            deprecated: 0,
            note: 'Decay operation may require more data',
        });
    }
});

/**
 * GET /assistant/topic-interests
 * Get user's tracked topic interests (ADAPT-002)
 */
router.get('/topic-interests', async (req: AssistantRequest, res: Response, next) => {
    try {
        if (!req.profileId) {
            return respondWithAppError(res, new AppError({
                code: 'unauthorized',
                message: 'Profile ID required',
                statusCode: 401,
                category: 'authentication',
            }));
        }

        const { createSelfLearningEngine } = await import('../services/aiSelfLearning.js');
        const engine = createSelfLearningEngine(req.prisma! as any, req.profileId);

        const topics = await engine.getTopInterests();

        return respondWithSuccess(res, {
            topics,
            count: topics.length,
        });
    } catch (error) {
        console.warn('[Assistant] topic-interests error:', error);
        return respondWithSuccess(res, {
            topics: [],
            count: 0,
        });
    }
});

/**
 * POST /assistant/self-evaluate
 * Test self-evaluation on a given response (LEARN-005)
 */
router.post('/self-evaluate', async (req: AssistantRequest, res: Response, next) => {
    try {
        if (!req.profileId) {
            return respondWithAppError(res, new AppError({
                code: 'unauthorized',
                message: 'Profile ID required',
                statusCode: 401,
                category: 'authentication',
            }));
        }

        const { userMessage, aiResponse, intent } = req.body || {};
        if (!userMessage || !aiResponse) {
            return respondWithAppError(res, new AppError({
                code: 'validation_error',
                message: 'userMessage and aiResponse are required',
                statusCode: 400,
                category: 'validation',
            }));
        }

        const { createSelfLearningEngine } = await import('../services/aiSelfLearning.js');
        const engine = createSelfLearningEngine(req.prisma! as any, req.profileId);

        const evaluation = await engine.selfEvaluateResponse(userMessage, aiResponse, intent || 'unknown');

        return respondWithSuccess(res, evaluation);
    } catch (error) {
        console.warn('[Assistant] self-evaluate error:', error);
        return respondWithSuccess(res, {
            score: 1.0,
            issues: [],
            shouldRetry: false,
            note: 'Self-evaluation not available',
        });
    }
});

/**
 * GET /assistant/preferences
 * Get learned user preferences (ML-003)
 */
router.get('/preferences', async (req: AssistantRequest, res: Response, next) => {
    try {
        if (!req.profileId) {
            return respondWithAppError(res, new AppError({
                code: 'unauthorized',
                message: 'Profile ID required',
                statusCode: 401,
                category: 'authentication',
            }));
        }

        const { createSelfLearningEngine } = await import('../services/aiSelfLearning.js');
        const engine = createSelfLearningEngine(req.prisma! as any, req.profileId);

        const preferences = await engine.learnPreferences();

        return respondWithSuccess(res, preferences);
    } catch (error) {
        console.warn('[Assistant] preferences error:', error);
        return respondWithSuccess(res, {
            preferredTopics: [],
            preferredStyle: 'balanced',
            preferredTimeOfDay: 'any',
            confidenceLevel: 0.3,
        });
    }
});

/**
 * GET /assistant/deprecation-report
 * Get instruction deprecation report (SELF-004)
 */
router.get('/deprecation-report', async (req: AssistantRequest, res: Response, next) => {
    try {
        if (!req.profileId) {
            return respondWithAppError(res, new AppError({
                code: 'unauthorized',
                message: 'Profile ID required',
                statusCode: 401,
                category: 'authentication',
            }));
        }

        const { createSelfLearningEngine } = await import('../services/aiSelfLearning.js');
        const engine = createSelfLearningEngine(req.prisma! as any, req.profileId);

        const report = await engine.getDeprecationReport();

        return respondWithSuccess(res, report);
    } catch (error) {
        console.warn('[Assistant] deprecation-report error:', error);
        return respondWithSuccess(res, {
            activeCount: 0,
            deprecatedCount: 0,
            atRiskCount: 0,
            atRiskInstructions: [],
        });
    }
});

export default router;

