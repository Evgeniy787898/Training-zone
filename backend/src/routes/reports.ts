import crypto from 'crypto';
import { Request, Response, Router } from 'express';
import { subDays } from 'date-fns';
import { z } from 'zod';
import {
    respondWithAppError,
    respondWithDatabaseUnavailable,
    respondWithSuccess,
} from '../utils/apiResponses.js';
import { DatabaseService } from '../modules/integrations/supabase.js';
import { getCachedResource, setCachedResource } from '../modules/infrastructure/cacheStrategy.js';
import { applyEdgeCacheHeaders } from '../utils/cacheHeaders.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { cacheConfig } from '../config/constants.js';
import { AppError } from '../services/errors.js';
import { maybeRespondWithNotModified } from '../utils/etag.js';

const router = Router();

const REPORT_CACHE_SETTINGS = cacheConfig.reports;

const reportSchema = z
    .object({
        range: z.string().trim().optional(),
    })
    .strict();

type ReportQuery = z.infer<typeof reportSchema>;

function parseRange(range = '30d') {
    const match = /^(\d+)([dw])$/.exec(range);
    if (!match) {
        const error: any = new Error('Неверный формат диапазона');
        error.status = 422;
        error.code = 'range_invalid';
        throw error;
    }

    const value = Number(match[1]);
    const unit = match[2];

    switch (unit) {
        case 'd':
            return { startDate: subDays(new Date(), value), label: `${value}d` };
        case 'w':
            return { startDate: subDays(new Date(), value * 7), label: `${value}w` };
        default:
            throw new Error('unsupported_range');
    }
}

const reportParamsSchema = z
    .object({
        slug: z
            .string()
            .trim()
            .min(1, 'Укажите идентификатор отчёта')
            .max(64, 'Слишком длинный идентификатор отчёта')
            .regex(/^[a-z0-9_-]+$/i, 'Недопустимые символы в идентификаторе отчёта'),
    })
    .strict();

type ReportParams = z.infer<typeof reportParamsSchema>;

// GET /api/reports/:slug
router.get(
    '/:slug',
    validateRequest({ query: reportSchema, params: reportParamsSchema }),
    async (req: Request, res: Response, next) => {
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

            const { slug } = (req.validated?.params as ReportParams) ?? { slug: '' };

            if (!req.prisma) {
                return respondWithDatabaseUnavailable(res, 'reports', {
                    traceId: req.traceId,
                    details: { slug },
                });
            }
            const { range } = (req.validated?.query as ReportQuery | undefined) ?? {};
            const { startDate, label } = parseRange(range);

            const traceId = req.traceId || crypto.randomUUID();
            res.setHeader('x-trace-id', traceId);

            const cacheParams = { profileId: req.profileId, slug, range: label };
            const cached = await getCachedResource<any, 'reports'>('reports', cacheParams);
            if (cached) {
                const payload = cached;
                res.setHeader('x-cache', 'hit');
                applyEdgeCacheHeaders(res, { ...REPORT_CACHE_SETTINGS.edge, scope: 'private' });
                if (maybeRespondWithNotModified(req, res, payload)) {
                    return;
                }
                return respondWithSuccess(res, payload, { meta: { traceId } });
            }

            const db = new DatabaseService(req.prisma);
            const now = new Date();

            if (slug === 'volume_trend') {
                try {
                    const { chart, summary } = await db.getVolumeTrend(req.profileId, startDate);
                    const payload = {
                        report: slug,
                        range: label,
                        chart,
                        summary,
                        source: 'database',
                        fallback: false,
                        generated_at: now.toISOString(),
                    };

                    await setCachedResource('reports', cacheParams, payload);
                    res.setHeader('x-cache', 'miss');
                    applyEdgeCacheHeaders(res, { ...REPORT_CACHE_SETTINGS.edge, scope: 'private' });
                    if (maybeRespondWithNotModified(req, res, payload)) {
                        return;
                    }
                    return respondWithSuccess(res, payload, { meta: { traceId } });
                } catch (error) {
                    console.error('[reports] volume trend error', error);
                    return respondWithDatabaseUnavailable(res, 'reports', {
                        traceId,
                        details: { slug, stage: 'volume_trend' },
                    });
                }
            }

            if (slug === 'rpe_distribution') {
                try {
                    const { chart, summary } = await db.getRpeDistribution(req.profileId, startDate);
                    const payload = {
                        report: slug,
                        range: label,
                        chart,
                        summary,
                        source: 'database',
                        fallback: false,
                        generated_at: now.toISOString(),
                    };

                    await setCachedResource('reports', cacheParams, payload);
                    res.setHeader('x-cache', 'miss');
                    applyEdgeCacheHeaders(res, { ...REPORT_CACHE_SETTINGS.edge, scope: 'private' });
                    if (maybeRespondWithNotModified(req, res, payload)) {
                        return;
                    }
                    return respondWithSuccess(res, payload, { meta: { traceId } });
                } catch (error) {
                    console.error('[reports] rpe distribution error', error);
                    return respondWithDatabaseUnavailable(res, 'reports', {
                        traceId,
                        details: { slug, stage: 'rpe_distribution' },
                    });
                }
            }

            return respondWithAppError(
                res,
                new AppError({
                    code: 'report_not_available',
                    message: 'Отчёт недоступен',
                    statusCode: 404,
                    category: 'not_found',
                }),
                { traceId },
            );
        } catch (error) {
            if (error instanceof z.ZodError) {
                return respondWithAppError(
                    res,
                    new AppError({
                        code: 'validation_failed',
                        message: 'Некорректные параметры запроса',
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

export default router;
