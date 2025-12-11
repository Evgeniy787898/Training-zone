/**
 * Progress Routes (GAP-008: Personal Records)
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validateRequest.js';
import { respondWithSuccess, respondWithAppError } from '../utils/apiResponses.js';
import { AppError } from '../services/errors.js';
import { PersonalRecordsService } from '../modules/progress/personalRecordsService.js';
import type { SafePrismaClient } from '../types/prisma.js';

const personalRecordsQuerySchema = z.object({
    exercise_key: z.string().trim().min(1).optional(),
}).strict();

type PersonalRecordsQuery = z.infer<typeof personalRecordsQuerySchema>;

export function createProgressRouter(prisma: SafePrismaClient) {
    const router = Router();
    const personalRecordsService = new PersonalRecordsService(prisma);

    // GET /api/progress/personal-records
    router.get('/personal-records', validateRequest({ query: personalRecordsQuerySchema }), async (req: Request, res: Response) => {
        try {
            if (!req.profileId) {
                return respondWithAppError(
                    res,
                    new AppError({
                        code: 'auth_required',
                        message: 'Требуется авторизация',
                        statusCode: 401,
                        category: 'authentication',
                    }),
                    { traceId: req.traceId },
                );
            }

            const { exercise_key } = (req.validated?.query as PersonalRecordsQuery | undefined) ?? {};
            const summary = await personalRecordsService.getPersonalRecords(req.profileId, exercise_key);

            return respondWithSuccess(res, summary, {
                meta: req.traceId ? { traceId: req.traceId } : undefined,
            });
        } catch (error: any) {
            console.error('[progress/personal-records] Unexpected error:', error);
            return respondWithAppError(
                res,
                new AppError({
                    code: 'internal_error',
                    message: 'Не удалось получить личные рекорды',
                    statusCode: 500,
                    category: 'internal',
                }),
                { traceId: req.traceId },
            );
        }
    });

    return router;
}
