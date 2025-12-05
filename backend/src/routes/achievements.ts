import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { isAchievementSchemaError } from '../utils/schemaGuards.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
    respondWithAppError,
    respondWithDatabaseUnavailable,
    respondWithSuccess,
} from '../utils/apiResponses.js';
import type { AchievementsResponse } from '../types/apiResponses.js';
import { getCachedResource, setCachedResource } from '../modules/infrastructure/cacheStrategy.js';
import { applyEdgeCacheHeaders } from '../utils/cacheHeaders.js';
import { maybeRespondWithNotModified } from '../utils/etag.js';
import { cacheConfig } from '../config/constants.js';
import { AppError } from '../services/errors.js';
import { paginationQuerySchema, type PaginationMeta } from '../types/pagination.js';
import { resolvePagination } from '../services/pagination.js';
import { fieldSelectionParamSchema } from '../types/fields.js';
import { filterCollectionFields, resolveFieldSelection } from '../services/fieldSelection.js';
import { loadAchievementsPage } from '../modules/profile/achievementsFeed.js';

const router = Router();

const ACHIEVEMENT_CACHE_SETTINGS = cacheConfig.achievements;

const ACHIEVEMENT_FIELDS = Object.freeze([
    'id',
    'profileId',
    'title',
    'description',
    'awardedAt',
    'triggerSource',
] as const);

const achievementsQuerySchema = paginationQuerySchema.extend({
    fields: fieldSelectionParamSchema,
});

type AchievementsQuery = z.infer<typeof achievementsQuerySchema>;

const buildMeta = (req: Request, pagination?: PaginationMeta, fields?: readonly string[]) => {
    if (!req.traceId && !pagination && !fields) {
        return undefined;
    }
    const meta: Record<string, unknown> = {};
    if (req.traceId) {
        meta.traceId = req.traceId;
    }
    if (pagination) {
        meta.pagination = pagination;
    }
    if (fields && fields.length > 0) {
        meta.fields = fields;
    }
    return meta;
};

type CachedAchievementsPayload = {
    achievements: any[];
    source: 'database';
    fallback: false;
    cachedAt: string;
    pagination: PaginationMeta;
};

// GET /api/achievements
router.get('/', validateRequest({ query: achievementsQuerySchema }), async (req: Request, res: Response, next) => {
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

        if (!req.prisma) {
            return respondWithDatabaseUnavailable(res, 'achievements', {
                traceId: req.traceId,
            });
        }

        const query = (req.validated?.query as AchievementsQuery | undefined) ?? {};
        const paginationInput = query ?? {};
        const pagination = resolvePagination(paginationInput);
        const fieldSelection = resolveFieldSelection({
            requested: query.fields,
            allowed: ACHIEVEMENT_FIELDS,
        });
        const cacheParams = { profileId: req.profileId, page: pagination.page, pageSize: pagination.pageSize };

        try {
            const cached = await getCachedResource<CachedAchievementsPayload, 'achievementsPage'>(
                'achievementsPage',
                cacheParams,
            );
            if (cached) {
                const payload: AchievementsResponse = {
                    ...cached,
                    achievements: filterCollectionFields(
                        cached.achievements as unknown as Record<string, unknown>[],
                        fieldSelection,
                    ),
                    cached: true,
                };
                res.setHeader('X-Cache-Status', 'HIT');
                applyEdgeCacheHeaders(res, { ...ACHIEVEMENT_CACHE_SETTINGS.edge, scope: 'private' });
                if (maybeRespondWithNotModified(req, res, payload)) {
                    return;
                }
                return respondWithSuccess<AchievementsResponse>(res, payload, {
                    meta: buildMeta(req, cached.pagination, fieldSelection.requested ? fieldSelection.fields : undefined),
                });
            }

            const payload = await loadAchievementsPage(req.prisma, {
                profileId: req.profileId,
                page: pagination.page,
                pageSize: pagination.pageSize,
            });

            res.setHeader('X-Cache-Status', 'MISS');
            applyEdgeCacheHeaders(res, { ...ACHIEVEMENT_CACHE_SETTINGS.edge, scope: 'private' });
            await setCachedResource('achievementsPage', cacheParams, payload);

            const responsePayload: AchievementsResponse = {
                ...payload,
                achievements: filterCollectionFields(
                    payload.achievements as unknown as Record<string, unknown>[],
                    fieldSelection,
                ),
            };

            if (maybeRespondWithNotModified(req, res, responsePayload)) {
                return;
            }

            return respondWithSuccess<AchievementsResponse>(res, responsePayload, {
                meta: buildMeta(
                    req,
                    payload.pagination,
                    fieldSelection.requested ? fieldSelection.fields : undefined,
                ),
            });
        } catch (error) {
            if (isAchievementSchemaError(error)) {
                console.warn('[achievements] Schema unavailable', error);
                return respondWithDatabaseUnavailable(res, 'achievements', {
                    traceId: req.traceId,
                    details: { stage: 'schema_validation' },
                });
            }
            return respondWithDatabaseUnavailable(res, 'achievements', {
                traceId: req.traceId,
            });
        }
    } catch (error) {
        next(error);
    }
});

export default router;
