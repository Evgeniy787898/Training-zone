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

const router = Router();

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

router.post('/reply', validateRequest({ body: replySchema }), async (req: AssistantRequest, res: Response, next) => {
    try {
        const payload = req.validated?.body as ReplyPayload;
        const db = new DatabaseService(req.prisma!);
        const historyService = new HistoryService(db);

        const historyState = await historyService.loadAssistantHistory(req.profileId!);
        const history = historyState.messages;

        const turnStartedAt = Date.now();

        const interpretation = interpretCommand({
            profile: req.profile,
            message: payload.message,
            history,
        });

        const reply = await conversationService.generateReply({
            profile: req.profile,
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

export default router;

