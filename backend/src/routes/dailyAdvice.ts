import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validateRequest.js';
import {
    respondWithAppError,
    respondWithDatabaseUnavailable,
    respondWithSuccess,
} from '../utils/apiResponses.js';
import { AppError } from '../services/errors.js';
import { dailyAdviceSelectionWithAdviceSelect, dailyAdviceSummarySelect } from '../modules/database/prismaSelect.js';
import { rememberCachedResource } from '../modules/infrastructure/cacheStrategy.js';
import { cacheConfig } from '../config/constants.js';
import { applyEdgeCacheHeaders } from '../utils/cacheHeaders.js';
import { maybeRespondWithNotModified } from '../utils/etag.js';
import { microserviceClients } from '../config/constants.js';
import type { DailyAdviceResponse } from '../types/apiResponses.js';

const router = Router();

const normalizeAdviceIdeas = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return value
            .map((entry) => (typeof entry === 'string' ? entry.trim() : typeof entry === 'number' ? entry.toString() : ''))
            .filter((entry): entry is string => entry.length > 0);
    }
    if (typeof value === 'string' && value.trim().length > 0) {
        return [value.trim()];
    }
    return [];
};

const DAILY_ADVICE_CACHE_SETTINGS = cacheConfig.dailyAdvice.list;
const DAILY_ADVICE_HTTP_CACHE = Object.freeze({
    scope: 'private' as const,
    maxAge: Math.min(300, DAILY_ADVICE_CACHE_SETTINGS.ttlSeconds),
});

const dailyAdviceQuerySchema = z
    .object({
        date: z
            .string()
            .trim()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
    })
    .strict();

type DailyAdviceQuery = z.infer<typeof dailyAdviceQuerySchema>;

// GET /api/daily-advice
router.get('/', validateRequest({ query: dailyAdviceQuerySchema }), async (req: Request, res: Response, next) => {
    try {
        if (!req.prisma) {
            return respondWithDatabaseUnavailable(res, 'daily_advice', {
                traceId: req.traceId,
            });
        }

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

        const { date } = (req.validated?.query as DailyAdviceQuery | undefined) ?? {};
        const effectiveDate = date || new Date().toISOString().split('T')[0];
        const dateStart = new Date(`${effectiveDate}T00:00:00.000Z`);
        const dateEnd = new Date(`${effectiveDate}T23:59:59.999Z`);

        console.log('[daily-advice] Query params:', {
            profileId: req.profileId,
            date: effectiveDate,
            dateForQuery: dateStart.toISOString()
        });

        // Check if there's a training session for this date
        let session = null;
        let adviceType: 'training' | 'rest' = 'rest';

        try {
            session = await req.prisma.trainingSession.findFirst({
                where: {
                    profileId: req.profileId,
                    plannedAt: {
                        gte: dateStart,
                        lte: dateEnd,
                    },
                },
                include: {
                    exercises: {
                        select: {
                            exerciseKey: true,
                            levelCode: true,
                            exerciseLevelId: true,
                        },
                        take: 5
                    }
                }
            });
            adviceType = session ? 'training' : 'rest';
        } catch (dbError: any) {
            console.error('[daily-advice] Database error finding session:', dbError);
            return respondWithDatabaseUnavailable(res, 'daily_advice', {
                traceId: req.traceId,
                details: { stage: 'training_session_lookup' },
            });
        }

        let aiAdvicePayload: DailyAdviceResponse | null = null;

        // Try AI Advisor if it's a training day and service is enabled
        if (adviceType === 'training' && session && session.exercises.length > 0 && microserviceClients.aiAdvisor.enabled) {
            try {
                const { request } = await import('undici');
                // Pick a random exercise from the session to focus on
                const randomExercise = session.exercises[Math.floor(Math.random() * session.exercises.length)];

                const aiUrl = `${microserviceClients.aiAdvisor.baseUrl}/api/generate-advice`;
                console.log(`[daily-advice] Calling AI Advisor for exercise ${randomExercise.exerciseKey}`);

                const aiRes = await request(aiUrl, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        'x-trace-id': req.traceId || '',
                    },
                    body: JSON.stringify({
                        exerciseKey: randomExercise.exerciseKey,
                        currentLevel: randomExercise.levelCode || '1.1', // Fallback level if missing
                        performance: {}, // Can include history later
                        goals: [], // Can fetch from profile later
                        context: []
                    })
                });

                if (aiRes.statusCode === 200) {
                    const aiData = await aiRes.body.json() as any;
                    aiAdvicePayload = {
                        type: 'training',
                        shortText: aiData.advice.split('.')[0] + '.', // Simple heuristic for short text
                        fullText: aiData.advice,
                        ideas: normalizeAdviceIdeas(aiData.tips),
                        icon: 'run', // Dynamic icon based on advice?
                        theme: 'progress'
                    };
                } else {
                    console.warn(`[daily-advice] AI Advisor returned ${aiRes.statusCode}`);
                }
            } catch (aiError) {
                console.error('[daily-advice] Failed to call AI Advisor:', aiError);
                // Fallback to DB below
            }
        }

        if (aiAdvicePayload) {
            applyEdgeCacheHeaders(res, DAILY_ADVICE_HTTP_CACHE);
            return respondWithSuccess<DailyAdviceResponse>(res, aiAdvicePayload, {
                meta: req.traceId ? { traceId: req.traceId } : undefined,
            });
        }

        let existing = null;
        try {
            existing = await req.prisma.dailyAdviceSelection.findUnique({
                where: {
                    profileId_date: {
                        profileId: req.profileId,
                        date: dateStart,
                    },
                },
                select: dailyAdviceSelectionWithAdviceSelect,
            });
        } catch (dbError: any) {
            console.error('[daily-advice] Database error finding selection:', dbError);
            return respondWithDatabaseUnavailable(res, 'daily_advice', {
                traceId: req.traceId,
                details: { stage: 'selection_lookup' },
            });
        }

        if (existing?.advice) {
            const advice = existing.advice;
            const payload: DailyAdviceResponse = {
                type: advice.adviceType || adviceType,
                shortText: advice.shortText || '',
                fullText: advice.fullText || '',
                ideas: normalizeAdviceIdeas(advice.ideas),
                icon: advice.iconName || (adviceType === 'rest' ? 'crescent' : 'run'),
                theme: advice.theme || (adviceType === 'rest' ? 'recovery' : 'progress'),
            };
            applyEdgeCacheHeaders(res, DAILY_ADVICE_HTTP_CACHE);
            if (maybeRespondWithNotModified(req, res, payload)) {
                return;
            }
            return respondWithSuccess<DailyAdviceResponse>(res, payload, {
                meta: req.traceId ? { traceId: req.traceId } : undefined,
            });
        }

        // Get all advice of the required type
        let allAdvice: any[] = [];
        try {
            allAdvice = await rememberCachedResource('dailyAdviceList', { adviceType }, async () =>
                req.prisma!.dailyAdvice.findMany({
                    where: { adviceType },
                    select: dailyAdviceSummarySelect,
                }),
            );
        } catch (dbError: any) {
            console.error('[daily-advice] Database error finding advice:', dbError);
            return respondWithDatabaseUnavailable(res, 'daily_advice', {
                traceId: req.traceId,
                details: { stage: 'advice_lookup' },
            });
        }

        if (!allAdvice || allAdvice.length === 0) {
            return respondWithDatabaseUnavailable(res, 'daily_advice', {
                traceId: req.traceId,
                details: { stage: 'advice_empty', adviceType },
            });
        }

        // Randomly select one advice
        const selectedAdvice = allAdvice.length > 0
            ? allAdvice[Math.floor(Math.random() * allAdvice.length)]
            : null;

        if (!selectedAdvice) {
            return respondWithDatabaseUnavailable(res, 'daily_advice', {
                traceId: req.traceId,
                details: { stage: 'advice_selection_missing', adviceType },
            });
        }

        try {
            await req.prisma.dailyAdviceSelection.upsert({
                where: {
                    profileId_date: {
                        profileId: req.profileId,
                        date: dateStart,
                    },
                },
                update: {
                    adviceId: selectedAdvice.id,
                },
                create: {
                    profileId: req.profileId,
                    date: dateStart,
                    adviceId: selectedAdvice.id,
                },
            });
        } catch (error: any) {
            console.error('[daily-advice] Failed to persist advice selection:', error);
            return respondWithDatabaseUnavailable(res, 'daily_advice', {
                traceId: req.traceId,
                details: { stage: 'selection_persist' },
            });
        }

        const payload: DailyAdviceResponse = {
            type: selectedAdvice.adviceType || adviceType,
            shortText: selectedAdvice.shortText || '',
            fullText: selectedAdvice.fullText || '',
            ideas: normalizeAdviceIdeas(selectedAdvice.ideas),
            icon: selectedAdvice.iconName || (adviceType === 'rest' ? 'crescent' : 'run'),
            theme: selectedAdvice.theme || (adviceType === 'rest' ? 'recovery' : 'progress'),
        };

        applyEdgeCacheHeaders(res, DAILY_ADVICE_HTTP_CACHE);
        if (maybeRespondWithNotModified(req, res, payload)) {
            return;
        }

        return respondWithSuccess<DailyAdviceResponse>(res, payload, {
            meta: req.traceId ? { traceId: req.traceId } : undefined,
        });
    } catch (error: any) {
        console.error('[daily-advice] Unexpected error:', error);
        console.error('[daily-advice] Error stack:', error.stack);
        return respondWithDatabaseUnavailable(res, 'daily_advice', {
            traceId: req.traceId,
        });
    }
});

export default router;
