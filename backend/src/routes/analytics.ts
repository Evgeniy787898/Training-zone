import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { format, subDays } from 'date-fns';
import { validateRequest } from '../middleware/validateRequest.js';
import { respondWithSuccess, respondWithDatabaseUnavailable, respondWithAppError } from '../utils/apiResponses.js';
import { DatabaseService } from '../modules/integrations/supabase.js';
import { AppError } from '../services/errors.js';
import { getCachedResource, setCachedResource } from '../modules/infrastructure/cacheStrategy.js';

const router = Router();

const visualizationQuerySchema = z.object({
    range: z.string().optional(),
}).strict();

type VisualizationQuery = z.infer<typeof visualizationQuerySchema>;

function parseRange(range = '30d') {
    const match = /^(\d+)([dw]|all)$/.exec(range);
    if (!match && range !== 'all') {
        const error: any = new Error('Неверный формат диапазона');
        error.status = 422;
        error.code = 'range_invalid';
        throw error;
    }

    if (range === 'all') {
        return { startDate: new Date(0), label: 'all' };
    }

    const value = Number(match![1]);
    const unit = match![2];

    switch (unit) {
        case 'd':
            return { startDate: subDays(new Date(), value), label: `${value}d` };
        case 'w':
            return { startDate: subDays(new Date(), value * 7), label: `${value}w` };
        default:
            return { startDate: subDays(new Date(), 30), label: '30d' };
    }
}

router.get(
    '/visualizations/:type',
    validateRequest({ query: visualizationQuerySchema }),
    async (req: Request, res: Response) => {
        try {
            if (!req.profileId) {
                return respondWithAppError(
                    res,
                    new AppError({
                        code: 'auth_required',
                        message: 'Profile required',
                        statusCode: 401,
                        category: 'authentication',
                    })
                );
            }

            if (!req.prisma) {
                return respondWithDatabaseUnavailable(res, 'analytics', { traceId: req.traceId });
            }

            const { type } = req.params;
            const { range } = (req.validated?.query as VisualizationQuery) ?? {};
            const { startDate, label } = parseRange(range);

            const cacheParams = { profileId: req.profileId, type, range: label };
            const cached = await getCachedResource<any, 'analytics'>('analytics' as any, cacheParams);

            if (cached) {
                res.setHeader('x-cache', 'hit');
                return respondWithSuccess(res, cached);
            }

            const db = new DatabaseService(req.prisma);
            let result;

            switch (type) {
                case 'sessions_trend':
                    result = await db.getSessionsTrend(req.profileId, startDate);
                    break;
                case 'discipline_breakdown':
                    result = await db.getDisciplineBreakdown(req.profileId, startDate);
                    break;
                case 'program_completion':
                    result = await db.getProgramCompletion(req.profileId, startDate);
                    break;
                default:
                    return respondWithAppError(
                        res,
                        new AppError({
                            code: 'not_found',
                            message: `Visualization ${type} not found`,
                            statusCode: 404,
                            category: 'not_found',
                        })
                    );
            }

            await setCachedResource('analytics' as any, cacheParams, result);
            res.setHeader('x-cache', 'miss');
            return respondWithSuccess(res, result);

        } catch (error: any) {
            console.error('[analytics] Visualization error:', error);
            return respondWithAppError(
                res,
                new AppError({
                    code: 'internal_error',
                    message: 'Failed to generate visualization',
                    statusCode: 500,
                    category: 'internal',
                    details: { error: error.message }
                })
            );
        }
    }
);

export default router;
