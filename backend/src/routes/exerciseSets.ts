/**
 * Exercise Set Results API Routes
 * 
 * Handles saving and retrieving per-set exercise results
 */

import { Request, Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { validateRequest } from '../middleware/validateRequest.js';
import { respondWithSuccess, respondWithAppError } from '../utils/apiResponses.js';
import { respondAuthRequired } from '../utils/auth.js';
import { AppError } from '../services/errors.js';

// Validation schemas
const setResultSchema = z.object({
    exerciseKey: z.string().min(1),
    setIndex: z.number().int().min(0),
    targetReps: z.number().int().min(0),
    actualReps: z.number().int().min(0),
    rpe: z.number().int().min(1).max(10).optional(),
    durationSeconds: z.number().int().min(0).optional(),
    restAfterSeconds: z.number().int().min(0).optional(),
});

const saveSetResultsSchema = z.object({
    sessionId: z.string().uuid(),
    results: z.array(setResultSchema),
});

const sessionIdQuerySchema = z.object({
    sessionId: z.string().uuid(),
});

export function createExerciseSetsRouter(prisma: PrismaClient) {
    const router = Router();

    const buildRequestMeta = (req: Request) => (req.traceId ? { traceId: req.traceId } : undefined);

    // GET /api/exercise-sets?sessionId=xxx - Get all set results for a session
    router.get('/', validateRequest({ query: sessionIdQuerySchema }), async (req: Request, res: Response, next) => {
        try {
            if (!req.profileId) {
                return respondAuthRequired(req, res);
            }

            const { sessionId } = req.validated?.query as { sessionId: string };

            const results = await prisma.exerciseSetResult.findMany({
                where: {
                    profileId: req.profileId,
                    sessionId,
                },
                orderBy: [
                    { exerciseKey: 'asc' },
                    { setIndex: 'asc' },
                ],
            });

            return respondWithSuccess(res, { results }, { meta: buildRequestMeta(req) });
        } catch (error) {
            if (error instanceof AppError) {
                return respondWithAppError(res, error, { traceId: req.traceId });
            }
            next(error);
        }
    });

    // POST /api/exercise-sets - Save set results (batch)
    router.post('/', validateRequest({ body: saveSetResultsSchema }), async (req: Request, res: Response, next) => {
        try {
            if (!req.profileId) {
                return respondAuthRequired(req, res);
            }

            const { sessionId, results } = req.validated?.body as z.infer<typeof saveSetResultsSchema>;

            // Verify session belongs to user
            const session = await prisma.trainingSession.findFirst({
                where: { id: sessionId, profileId: req.profileId },
            });

            if (!session) {
                return respondWithAppError(res, new AppError(404, 'Сессия не найдена'), { traceId: req.traceId });
            }

            // Upsert each result
            const upsertedResults = await Promise.all(
                results.map(async (result) => {
                    return prisma.exerciseSetResult.upsert({
                        where: {
                            sessionId_exerciseKey_setIndex: {
                                sessionId,
                                exerciseKey: result.exerciseKey,
                                setIndex: result.setIndex,
                            },
                        },
                        create: {
                            profileId: req.profileId!,
                            sessionId,
                            exerciseKey: result.exerciseKey,
                            setIndex: result.setIndex,
                            targetReps: result.targetReps,
                            actualReps: result.actualReps,
                            rpe: result.rpe,
                            durationSeconds: result.durationSeconds,
                            restAfterSeconds: result.restAfterSeconds,
                        },
                        update: {
                            actualReps: result.actualReps,
                            rpe: result.rpe,
                            durationSeconds: result.durationSeconds,
                            restAfterSeconds: result.restAfterSeconds,
                        },
                    });
                })
            );

            // Calculate totals for each exercise and update TrainingSessionExercise
            const exerciseKeys = [...new Set(results.map(r => r.exerciseKey))];

            for (const exerciseKey of exerciseKeys) {
                const exerciseResults = upsertedResults.filter(r => r.exerciseKey === exerciseKey);
                const totalReps = exerciseResults.reduce((sum, r) => sum + r.actualReps, 0);
                const completedSets = exerciseResults.filter(r => r.actualReps > 0).length;

                // Update session exercise totals
                await prisma.trainingSessionExercise.updateMany({
                    where: {
                        sessionId,
                        exerciseKey,
                    },
                    data: {
                        completedSets,
                        completedReps: totalReps,
                    },
                });
            }

            return respondWithSuccess(res, {
                message: 'Результаты сохранены',
                saved: upsertedResults.length,
            }, { meta: buildRequestMeta(req) });
        } catch (error) {
            console.error('[ExerciseSets] Save error:', error);
            if (error instanceof AppError) {
                return respondWithAppError(res, error, { traceId: req.traceId });
            }
            next(error);
        }
    });

    // GET /api/exercise-sets/history/:exerciseKey - Get historical performance
    router.get('/history/:exerciseKey', async (req: Request, res: Response, next) => {
        try {
            if (!req.profileId) {
                return respondAuthRequired(req, res);
            }

            const { exerciseKey } = req.params;
            const limit = parseInt(req.query.limit as string, 10) || 10;

            // Get recent sessions with this exercise
            const results = await prisma.exerciseSetResult.findMany({
                where: {
                    profileId: req.profileId,
                    exerciseKey,
                },
                orderBy: { createdAt: 'desc' },
                take: limit * 5, // Get enough to group by session
                include: {
                    // Include session info if needed
                },
            });

            // Group by session
            const sessionMap = new Map<string, typeof results>();
            for (const result of results) {
                if (!sessionMap.has(result.sessionId)) {
                    sessionMap.set(result.sessionId, []);
                }
                sessionMap.get(result.sessionId)!.push(result);
            }

            // Calculate stats per session
            const history = Array.from(sessionMap.entries())
                .slice(0, limit)
                .map(([sessionId, sessionResults]) => {
                    const totalReps = sessionResults.reduce((sum, r) => sum + r.actualReps, 0);
                    const avgRpe = sessionResults.filter(r => r.rpe).length > 0
                        ? sessionResults.reduce((sum, r) => sum + (r.rpe || 0), 0) / sessionResults.filter(r => r.rpe).length
                        : null;

                    return {
                        sessionId,
                        date: sessionResults[0].createdAt,
                        sets: sessionResults.length,
                        totalReps,
                        avgRpe: avgRpe ? Math.round(avgRpe * 10) / 10 : null,
                    };
                });

            return respondWithSuccess(res, {
                exerciseKey,
                history,
            }, { meta: buildRequestMeta(req) });
        } catch (error) {
            if (error instanceof AppError) {
                return respondWithAppError(res, error, { traceId: req.traceId });
            }
            next(error);
        }
    });

    return router;
}
