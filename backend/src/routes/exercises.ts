import { Request, Response, Router } from 'express';
import { z } from 'zod';
import {
    respondWithAppError,
    respondWithDatabaseUnavailable,
    respondWithSuccess,
} from '../utils/apiResponses.js';
import { applyEdgeCacheHeaders } from '../utils/cacheHeaders.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { cacheConfig } from '../config/constants.js';
import { AppError } from '../services/errors.js';
import { paginationQuerySchema, type PaginationMeta } from '../types/pagination.js';
import {
    buildPaginationMeta,
    resolvePagination,
    type PaginationState,
} from '../services/pagination.js';
import { maybeRespondWithNotModified } from '../utils/etag.js';
import { fieldSelectionParamSchema } from '../types/fields.js';
import { filterCollectionFields, resolveFieldSelection } from '../services/fieldSelection.js';
import { buildExerciseLevelImageUrl } from '../services/staticAssets.js';
import { getCachedResource, setCachedResource } from '../modules/infrastructure/cacheStrategy.js';
import type {
    ExerciseLevelSummary,
    ExerciseCatalogItem,
    ExerciseCatalogResponse,
    ExerciseHistoryResponse,
    ExerciseLevelsResponse,
    ExerciseListResponse,
} from '../types/apiResponses.js';

import type { ExerciseService } from '../modules/exercises/exercise.service.js';
import type { FavoritesService } from '../modules/exercises/favorites.service.js';

export function createExercisesRouter(exerciseService: ExerciseService, favoritesService?: FavoritesService) {
    const router = Router();

    const EXERCISE_CATALOG_CACHE = cacheConfig.exercises.catalog;
    const EXERCISE_LIST_CACHE = cacheConfig.exercises.list;
    const EXERCISE_CATALOG_FIELDS = Object.freeze([
        'id',
        'exerciseKey',
        'title',
        'focus',
        'description',
        'cue',
        'programId',
        'iconUrl',
        'iconUrlHover',
    ] as const);

    const PUBLIC_CATALOG_CACHE_HEADERS = Object.freeze({
        ...EXERCISE_CATALOG_CACHE.edge,
        scope: 'public' as const,
    });

    const PRIVATE_CATALOG_CACHE_HEADERS = Object.freeze({
        scope: 'private' as const,
        maxAge: EXERCISE_CATALOG_CACHE.edge.maxAge,
    });

    const EXERCISE_LIST_CACHE_HEADERS = Object.freeze({
        ...EXERCISE_LIST_CACHE.edge,
        scope: 'public' as const,
    });


    type CachedExerciseCatalogPayload = ExerciseCatalogResponse;

    type CachedExerciseListPayload = {
        items: ExerciseListResponse;
        pagination: PaginationMeta;
    };

    const buildResponseMeta = (req: Request, pagination?: PaginationMeta, fields?: readonly string[]) => {
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

    type ImageSlot = 1 | 2 | 3;

    const resolveLevelImageUrl = (level: any, slot: ImageSlot): string | null => {
        if (!level) {
            return null;
        }

        // Return direct Supabase URL from database (imageUrl, imageUrl2, imageUrl3)
        // This avoids rate limiting on the media proxy endpoint
        const fieldName = slot === 1 ? 'imageUrl' : slot === 2 ? 'imageUrl2' : 'imageUrl3';
        return level[fieldName] || null;
    };

    const exerciseCatalogQuerySchema = paginationQuerySchema.extend({
        fields: fieldSelectionParamSchema,
    });

    const exerciseListQuerySchema = z
        .object({
            program_id: z.string().trim().min(1).optional(),
            discipline_id: z.string().trim().min(1).optional(),
            fields: fieldSelectionParamSchema,
        })
        .extend(paginationQuerySchema.shape)
        .strict();

    const exerciseKeyParamsSchema = z
        .object({
            exerciseKey: z.string().trim().min(1),
        })
        .strict();

    const exerciseLevelsQuerySchema = z
        .object({
            level: z.string().trim().min(1).optional(),
        })
        .extend(paginationQuerySchema.shape)
        .strict();

    const exerciseHistoryQuerySchema = z.object(paginationQuerySchema.shape).strict();

    type ExerciseCatalogQuery = z.infer<typeof exerciseCatalogQuerySchema>;
    type ExerciseListQuery = z.infer<typeof exerciseListQuerySchema>;
    type ExerciseKeyParams = z.infer<typeof exerciseKeyParamsSchema>;
    type ExerciseLevelsQuery = z.infer<typeof exerciseLevelsQuerySchema>;
    type ExerciseHistoryQuery = z.infer<typeof exerciseHistoryQuerySchema>;

    // GET /api/exercises/catalog
    router.get('/catalog', validateRequest({ query: exerciseCatalogQuerySchema }), async (req: Request, res: Response, next) => {
        try {
            console.log('[exercises/catalog] Request received');

            const query = (req.validated?.query as ExerciseCatalogQuery | undefined) ?? {};
            const paginationInput = query ?? {};
            const pagination = resolvePagination(paginationInput);
            const fieldSelection = resolveFieldSelection({
                requested: query.fields,
                allowed: EXERCISE_CATALOG_FIELDS,
            });

            const cacheParams = {
                profileId: req.profileId ?? null,
                page: pagination.page,
                pageSize: pagination.pageSize,
            };
            const cached = await getCachedResource<CachedExerciseCatalogPayload, 'exerciseCatalog'>(
                'exerciseCatalog',
                cacheParams,
            );
            if (cached) {
                const payload: ExerciseCatalogResponse = {
                    ...cached,
                    items: filterCollectionFields(cached.items, fieldSelection),
                    cached: true,
                };
                if (!req.profileId) {
                    applyEdgeCacheHeaders(res, PUBLIC_CATALOG_CACHE_HEADERS);
                } else {
                    applyEdgeCacheHeaders(res, PRIVATE_CATALOG_CACHE_HEADERS);
                }
                if (maybeRespondWithNotModified(req, res, payload)) {
                    return;
                }
                return respondWithSuccess<ExerciseCatalogResponse>(res, payload, {
                    meta: buildResponseMeta(
                        req,
                        cached.pagination,
                        fieldSelection.requested ? fieldSelection.fields : undefined,
                    ),
                });
            }

            let exercises: any[] = [];
            let totalExercises = 0;
            let levels: any[] = [];

            try {
                console.log('[exercises/catalog] Fetching exercises from database...');
                const { exercises: exerciseRows, total: totalCount } = await exerciseService.getExercises({
                    skip: pagination.offset,
                    take: pagination.limit,
                    orderBy: { exerciseKey: 'asc' },
                });
                exercises = exerciseRows;
                totalExercises = totalCount;
                console.log(`[exercises/catalog] Found ${exercises.length} exercises for page ${pagination.page}`);
            } catch (dbError: any) {
                console.error('[exercises/catalog] Database error fetching exercises:', dbError);
                return respondWithDatabaseUnavailable(res, 'exercise_catalog', {
                    traceId: req.traceId,
                    details: { stage: 'exercise_lookup' },
                });
            }

            const exerciseKeys = exercises.map((exercise: any) => exercise.exerciseKey).filter(Boolean);

            if (exerciseKeys.length > 0) {
                try {
                    console.log('[exercises/catalog] Fetching levels from database...');
                    const { levels: levelRows } = await exerciseService.getExerciseLevels({
                        where: {
                            exerciseKey: { in: exerciseKeys },
                            isActive: { not: false },
                        },
                        orderBy: [
                            { exerciseKey: 'asc' },
                            { orderIndex: 'asc' },
                            { level: 'asc' },
                        ],
                    });
                    levels = levelRows;
                    console.log(`[exercises/catalog] Found ${levels.length} levels for ${exerciseKeys.length} exercises`);
                } catch (dbError: any) {
                    console.error('[exercises/catalog] Database error fetching levels:', dbError);
                    return respondWithDatabaseUnavailable(res, 'exercise_catalog', {
                        traceId: req.traceId,
                        details: { stage: 'level_lookup' },
                    });
                }
            }

            // Group levels by exercise
            const levelsByExercise = new Map<string, any[]>();
            levels.forEach((level: any) => {
                try {
                    if (!level || !level.exerciseKey) {
                        console.warn('[exercises/catalog] Skipping level without exerciseKey:', level?.id);
                        return;
                    }

                    if (!levelsByExercise.has(level.exerciseKey)) {
                        levelsByExercise.set(level.exerciseKey, []);
                    }

                    const levelData = {
                        id: level.level || '',
                        title: level.title || '',
                        sets: level.sets ?? null,
                        reps: level.reps ?? null,
                        execution: level.execution || '',
                        technique: level.technique || '',
                        improvement: level.improvement || '',
                        image1: resolveLevelImageUrl(level, 1),
                        image2: resolveLevelImageUrl(level, 2),
                        image3: resolveLevelImageUrl(level, 3),
                        disciplineId: level.disciplineId ?? null,
                    };

                    levelsByExercise.get(level.exerciseKey)!.push(levelData);
                } catch (levelError: any) {
                    console.error('[exercises/catalog] Error processing level:', levelError);
                    console.error('[exercises/catalog] Level:', level?.exerciseKey, level?.level);
                    console.error('[exercises/catalog] Level error stack:', levelError.stack);
                    // Пропускаем проблемный level, продолжаем
                }
            });

            console.log(`[exercises/catalog] Grouped ${levelsByExercise.size} exercise groups`);

            // Get exercise progress overview (only if profileId is available)
            let progress = [];
            let latestByKey = new Map<string, any>();

            if (req.profileId) {
                try {
                    const { progress: progressRows } = await exerciseService.getExerciseProgress({
                        where: {
                            session: {
                                profileId: req.profileId,
                            },
                        },
                        orderBy: { createdAt: 'desc' },
                        take: 40,
                    });
                    progress = progressRows;

                    progress.forEach((item: any) => {
                        if (!latestByKey.has(item.exerciseKey)) {
                            latestByKey.set(item.exerciseKey, item);
                        }
                    });
                } catch (dbError: any) {
                    console.error('[exercises/catalog] Database error finding progress:', dbError);
                    progress = [];
                    latestByKey = new Map<string, any>();
                }
            }

            const items: ExerciseCatalogItem[] = exercises
                .map<ExerciseCatalogItem | null>((exercise: any) => {
                    try {
                        if (!exercise || !exercise.exerciseKey) {
                            console.warn('[exercises/catalog] Skipping exercise without exerciseKey:', exercise?.id);
                            return null;
                        }

                        const entry = latestByKey.get(exercise.exerciseKey);
                        const exerciseLevels = (levelsByExercise.get(exercise.exerciseKey) || []) as ExerciseLevelSummary[];

                        return {
                            key: exercise.exerciseKey || '',
                            title: exercise.title || '',
                            focus: exercise.focus || '',
                            description: exercise.description || '',
                            cue: exercise.cue || '',
                            levels: exerciseLevels,
                            latest_progress: entry
                                ? {
                                    level: entry.levelResult || entry.levelTarget || null,
                                    decision: entry.decision || null,
                                    session_date: entry.session?.plannedAt || null,
                                    updated_at: entry.createdAt,
                                }
                                : null,
                        };
                    } catch (exerciseError: any) {
                        console.error('[exercises/catalog] Error processing exercise:', exerciseError);
                        console.error('[exercises/catalog] Exercise:', exercise?.exerciseKey);
                        console.error('[exercises/catalog] Error stack:', exerciseError.stack);
                        // Возвращаем null для проблемного exercise, затем отфильтруем
                        return null;
                    }
                })
                .filter((item): item is ExerciseCatalogItem => item !== null);

            console.log(`[exercises/catalog] Returning ${items.length} items`);

            const paginationMeta = buildPaginationMeta({
                total: totalExercises,
                page: pagination.page,
                pageSize: pagination.pageSize,
            });

            const payload: ExerciseCatalogResponse = {
                items: items as ExerciseCatalogResponse['items'],
                generated_at: new Date().toISOString(),
                pagination: paginationMeta,
            };

            await setCachedResource('exerciseCatalog', cacheParams, payload);
            if (!req.profileId) {
                applyEdgeCacheHeaders(res, PUBLIC_CATALOG_CACHE_HEADERS);
            } else {
                applyEdgeCacheHeaders(res, PRIVATE_CATALOG_CACHE_HEADERS);
            }

            const responsePayload: ExerciseCatalogResponse = {
                ...payload,
                items: filterCollectionFields(payload.items as Record<string, unknown>[], fieldSelection) as ExerciseCatalogResponse['items'],
            };

            if (maybeRespondWithNotModified(req, res, responsePayload)) {
                return;
            }

            return respondWithSuccess<ExerciseCatalogResponse>(res, responsePayload, {
                meta: buildResponseMeta(
                    req,
                    paginationMeta,
                    fieldSelection.requested ? fieldSelection.fields : undefined,
                ),
            });
        } catch (error: any) {
            console.error('[exercises/catalog] Unexpected error:', error);
            console.error('[exercises/catalog] Error name:', error.name);
            console.error('[exercises/catalog] Error message:', error.message);
            console.error('[exercises/catalog] Error code:', error.code);
            console.error('[exercises/catalog] Error stack:', error.stack);
            return respondWithDatabaseUnavailable(res, 'exercise_catalog', {
                traceId: req.traceId,
            });
        }
    });

    // GET /api/exercises/list - должно быть ПЕРЕД /:exerciseKey/... маршрутами
    router.get('/list', validateRequest({ query: exerciseListQuerySchema }), async (req: Request, res: Response, next) => {
        const startTime = Date.now();
        try {
            const { program_id, discipline_id, page, page_size, fields } =
                (req.validated?.query as ExerciseListQuery | undefined) ?? {};
            const pagination = resolvePagination({ page, page_size });
            const fieldSelection = resolveFieldSelection({
                requested: fields,
                allowed: EXERCISE_CATALOG_FIELDS,
            });

            // Если нет ни program_id, ни discipline_id, возвращаем пустой массив
            if (!program_id && !discipline_id) {
                const emptyMeta = buildPaginationMeta({
                    total: 0,
                    page: pagination.page,
                    pageSize: pagination.pageSize,
                });
                const emptyPayload: ExerciseListResponse = [];
                return respondWithSuccess<ExerciseListResponse>(res, emptyPayload, {
                    meta: buildResponseMeta(
                        req,
                        emptyMeta,
                        fieldSelection.requested ? fieldSelection.fields : undefined,
                    ),
                });
            }

            const cacheParams = {
                filter: program_id ? 'program' : discipline_id ? 'discipline' : 'empty',
                filterId: program_id ?? discipline_id ?? null,
                page: pagination.page,
                pageSize: pagination.pageSize,
            } as const;

            const cached = await getCachedResource<CachedExerciseListPayload, 'exerciseList'>(
                'exerciseList',
                cacheParams,
            );
            if (cached) {
                const payload = filterCollectionFields(
                    cached.items as Record<string, unknown>[],
                    fieldSelection,
                ) as ExerciseListResponse;
                applyEdgeCacheHeaders(res, EXERCISE_LIST_CACHE_HEADERS);
                if (maybeRespondWithNotModified(req, res, payload)) {
                    return;
                }
                return respondWithSuccess<ExerciseListResponse>(res, payload, {
                    meta: buildResponseMeta(
                        req,
                        cached.pagination,
                        fieldSelection.requested ? fieldSelection.fields : undefined,
                    ),
                });
            }

            let exercises: any[] = [];
            let total = 0;

            if (program_id) {
                try {
                    const queryStart = Date.now();
                    const { exercises: result, total: count } = await exerciseService.getExercisesByProgram(program_id, {
                        skip: pagination.offset,
                        take: pagination.limit,
                    });

                    exercises = result;
                    total = count;

                    const queryTime = Date.now() - queryStart;
                    console.log(`[exercises/list] Service query by programId completed in ${queryTime}ms, found ${exercises.length} exercises for program ${program_id}`);
                } catch (dbError: any) {
                    console.error('[exercises/list] Error querying exercises by programId through Service:', dbError);
                    return respondWithDatabaseUnavailable(res, 'exercise_list', {
                        traceId: req.traceId,
                        details: {
                            stage: 'program_query',
                            programId: program_id,
                        },
                    });
                }
            } else if (discipline_id) {
                try {
                    const queryStart = Date.now();
                    const { exercises: result, total: count } = await exerciseService.getExercisesByDiscipline(discipline_id, {
                        skip: pagination.offset,
                        take: pagination.limit,
                    });

                    exercises = result;
                    total = count;

                    const queryTime = Date.now() - queryStart;
                    console.log(`[exercises/list] Service query by disciplineId completed in ${queryTime}ms, found ${exercises.length} exercises for discipline ${discipline_id}`);
                } catch (dbError: any) {
                    console.error('[exercises/list] Error querying exercises by discipline:', dbError);
                    return respondWithDatabaseUnavailable(res, 'exercise_list', {
                        traceId: req.traceId,
                        details: {
                            stage: 'discipline_query',
                            disciplineId: discipline_id,
                        },
                    });
                }
            }
            const totalTime = Date.now() - startTime;
            console.log(`[exercises/list] Total request time: ${totalTime}ms, returning ${exercises.length} exercises${program_id ? ` for program ${program_id}` : discipline_id ? ` for discipline ${discipline_id}` : ''}`);

            const payload = exercises.map((exercise) => ({
                id: exercise.id,
                exerciseKey: exercise.exerciseKey,
                title: exercise.title,
                focus: exercise.focus ?? null,
                description: exercise.description ?? null,
                cue: exercise.cue ?? null,
                programId: exercise.programId ?? null,
                iconUrl: exercise.iconUrl ?? null,
                iconUrlHover: exercise.iconUrlHover ?? null,
            }));

            const paginationMeta = buildPaginationMeta({
                total,
                page: pagination.page,
                pageSize: pagination.pageSize,
            });

            await setCachedResource('exerciseList', cacheParams, {
                items: payload as ExerciseListResponse,
                pagination: paginationMeta,
            });
            applyEdgeCacheHeaders(res, EXERCISE_LIST_CACHE_HEADERS);

            const filteredPayload = filterCollectionFields(
                payload as unknown as Record<string, unknown>[],
                fieldSelection,
            ) as ExerciseListResponse;

            if (maybeRespondWithNotModified(req, res, filteredPayload)) {
                return;
            }

            return respondWithSuccess<ExerciseListResponse>(res, filteredPayload, {
                meta: buildResponseMeta(
                    req,
                    paginationMeta,
                    fieldSelection.requested ? fieldSelection.fields : undefined,
                ),
            });
        } catch (error: any) {
            console.error('[exercises/list] Unexpected error:', error);
            console.error('[exercises/list] Error stack:', error.stack);
            return respondWithDatabaseUnavailable(res, 'exercise_list', {
                traceId: req.traceId,
            });
        }
    });

    // GET /api/exercises/:exerciseKey/history
    router.get(
        '/:exerciseKey/history',
        validateRequest({ params: exerciseKeyParamsSchema, query: exerciseHistoryQuerySchema }),
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

                const { exerciseKey } = (req.validated?.params as ExerciseKeyParams) ?? { exerciseKey: '' };

                const paginationQuery = (req.validated?.query as ExerciseHistoryQuery | undefined) ?? {};
                const pagination = resolvePagination(paginationQuery);

                let history;
                let total = 0;
                try {
                    const whereClause = {
                        exerciseKey,
                        session: {
                            profileId: req.profileId,
                        },
                    };

                    const { progress: historyRows, total: count } = await exerciseService.getExerciseProgress({
                        where: whereClause,
                        orderBy: { createdAt: 'desc' },
                        skip: pagination.offset,
                        take: pagination.limit,
                    });

                    history = historyRows;
                    total = count;
                } catch (dbError: any) {
                    console.error('[exercises/history] Database error:', dbError);
                    return respondWithDatabaseUnavailable(res, 'exercise_history', {
                        traceId: req.traceId,
                        details: { stage: 'history_lookup', exerciseKey },
                    });
                }
                const paginationMeta = buildPaginationMeta({
                    total,
                    page: pagination.page,
                    pageSize: pagination.pageSize,
                });

                const payload: ExerciseHistoryResponse = {
                    exercise: exerciseKey,
                    items: history.map((record: any) => ({
                        level_target: record.levelTarget,
                        level_result: record.levelResult,
                        volume_target: record.volumeTarget,
                        volume_actual: record.volumeActual,
                        rpe: record.rpe,
                        decision: record.decision,
                        notes: record.notes,
                        session_date: record.session?.plannedAt || null,
                        recorded_at: record.createdAt,
                    })),
                };

                return respondWithSuccess<ExerciseHistoryResponse>(res, payload, {
                    meta: buildResponseMeta(req, paginationMeta),
                });
            } catch (error: any) {
                console.error('[exercises/:exerciseKey/history] Unexpected error:', error);
                console.error('[exercises/:exerciseKey/history] Error stack:', error.stack);
                // Возвращаем пустой массив вместо 500 ошибки
                const fallbackPayload: ExerciseHistoryResponse = {
                    exercise: req.params.exerciseKey,
                    items: [],
                };
                return respondWithSuccess<ExerciseHistoryResponse>(res, fallbackPayload, {
                    meta: buildResponseMeta(req),
                });
            }
        },
    );

    // GET /api/exercises/:exerciseKey/levels
    router.get(
        '/:exerciseKey/levels',
        validateRequest({ params: exerciseKeyParamsSchema, query: exerciseLevelsQuerySchema }),
        async (req: Request, res: Response, next) => {
            const startTime = Date.now();
            try {
                const { exerciseKey } = (req.validated?.params as ExerciseKeyParams) ?? { exerciseKey: '' };
                const { level: levelFilter, page, page_size } = (req.validated?.query as ExerciseLevelsQuery | undefined) ?? {};
                const pagination = resolvePagination({ page, page_size });

                if (!exerciseKey) {
                    return respondWithAppError(
                        res,
                        new AppError({
                            code: 'invalid_request',
                            message: 'exerciseKey is required',
                            statusCode: 400,
                            category: 'validation',
                        }),
                        { traceId: req.traceId },
                    );
                }

                let levels: any[] = [];
                let totalLevels = 0;
                try {
                    const queryStart = Date.now();
                    const whereCondition: Record<string, any> = {
                        exerciseKey,
                        OR: [
                            { isActive: true },
                            { isActive: null },
                        ],
                    };

                    if (levelFilter) {
                        whereCondition.level = levelFilter;
                    }

                    const { levels: levelRows, total: count } = await exerciseService.getExerciseLevels({
                        where: whereCondition,
                        orderBy: [
                            { orderIndex: 'asc' },
                            { level: 'asc' },
                        ],
                        skip: pagination.offset,
                        take: pagination.limit,
                    });

                    levels = levelRows;
                    totalLevels = count;

                    const queryTime = Date.now() - queryStart;
                    console.log(
                        `[exercises/:exerciseKey/levels] Query completed in ${queryTime}ms, found ${levels.length} levels for exerciseKey: ${exerciseKey}`,
                    );
                } catch (dbError: any) {
                    console.error('[exercises/:exerciseKey/levels] Database error:', dbError);
                    return respondWithDatabaseUnavailable(res, 'exercise_levels', {
                        traceId: req.traceId,
                        details: { exercise_key: exerciseKey, stage: 'lookup_failed' },
                    });
                }
                const serializeStart = Date.now();
                let serializedLevels: ExerciseLevelsResponse['items'] = [];
                try {
                    const BATCH_SIZE = 5;
                    for (let i = 0; i < levels.length; i += BATCH_SIZE) {
                        const batch = levels.slice(i, i + BATCH_SIZE);
                        const batchResults = batch.map((level) => {
                            const entry = {
                                id: level.id,
                                exerciseKey: level.exerciseKey,
                                level: level.level,
                                title: level.title || '',
                                execution: level.execution || '',
                                technique: level.technique || '',
                                improvement: level.improvement || '',
                                sets: level.sets || null,
                                reps: level.reps || null,
                                image1: resolveLevelImageUrl(level, 1),
                                image2: resolveLevelImageUrl(level, 2),
                                image3: resolveLevelImageUrl(level, 3),
                                disciplineId: level.disciplineId ?? null,
                                orderIndex: level.orderIndex ?? null,
                            } satisfies ExerciseLevelsResponse['items'][number];
                            return entry;
                        });

                        serializedLevels.push(...batchResults);

                        if (i + BATCH_SIZE < levels.length) {
                            await new Promise((resolve) => setImmediate(resolve));
                        }
                    }
                } catch (serializeError: any) {
                    console.error('[exercises/:exerciseKey/levels] Serialization error:', serializeError);
                    return respondWithDatabaseUnavailable(res, 'exercise_levels', {
                        traceId: req.traceId,
                        details: { exercise_key: exerciseKey, stage: 'serialization_failed' },
                    });
                }

                const serializeTime = Date.now() - serializeStart;
                const totalTime = Date.now() - startTime;
                console.log(
                    `[exercises/:exerciseKey/levels] Serialization completed in ${serializeTime}ms, total: ${totalTime}ms, returning ${serializedLevels.length} levels`,
                );

                const paginationMeta = buildPaginationMeta({
                    total: totalLevels,
                    page: pagination.page,
                    pageSize: pagination.pageSize,
                });

                const payload: ExerciseLevelsResponse = {
                    exercise_key: exerciseKey,
                    items: serializedLevels,
                };

                return respondWithSuccess<ExerciseLevelsResponse>(res, payload, {
                    meta: buildResponseMeta(req, paginationMeta),
                });
            } catch (error: any) {
                console.error('[exercises/:exerciseKey/levels] Unexpected error:', error);
                console.error('[exercises/:exerciseKey/levels] Error stack:', error.stack);
                return respondWithDatabaseUnavailable(res, 'exercise_levels', {
                    traceId: req.traceId,
                    details: { exercise_key: req.params.exerciseKey || 'unknown', stage: 'unexpected' },
                });
            }
        },
    );

    // ==================== FAVORITES ENDPOINTS ====================

    // GET /api/exercises/favorites - Get all favorite exercise keys
    router.get('/favorites', async (req: Request, res: Response) => {
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

            if (!favoritesService) {
                return respondWithAppError(
                    res,
                    new AppError({
                        code: 'service_unavailable',
                        message: 'Favorites service not configured',
                        statusCode: 503,
                        category: 'dependencies',
                    }),
                    { traceId: req.traceId },
                );
            }

            const favorites = await favoritesService.getFavorites(req.profileId);
            return respondWithSuccess(res, { items: favorites }, {
                meta: req.traceId ? { traceId: req.traceId } : undefined,
            });
        } catch (error: any) {
            console.error('[exercises/favorites] Error:', error);
            return respondWithAppError(
                res,
                new AppError({
                    code: 'favorites_error',
                    message: 'Failed to get favorites',
                    statusCode: 500,
                    category: 'internal',
                }),
                { traceId: req.traceId },
            );
        }
    });

    // POST /api/exercises/favorites/:exerciseKey - Add to favorites
    router.post('/favorites/:exerciseKey', async (req: Request, res: Response) => {
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

            if (!favoritesService) {
                return respondWithAppError(
                    res,
                    new AppError({
                        code: 'service_unavailable',
                        message: 'Favorites service not configured',
                        statusCode: 503,
                        category: 'dependencies',
                    }),
                    { traceId: req.traceId },
                );
            }

            const { exerciseKey } = req.params;
            const result = await favoritesService.addFavorite(req.profileId, exerciseKey);
            return respondWithSuccess(res, result, {
                meta: req.traceId ? { traceId: req.traceId } : undefined,
            });
        } catch (error: any) {
            console.error('[exercises/favorites] Add error:', error);
            return respondWithAppError(
                res,
                new AppError({
                    code: 'favorites_error',
                    message: 'Failed to add favorite',
                    statusCode: 500,
                    category: 'internal',
                }),
                { traceId: req.traceId },
            );
        }
    });

    // DELETE /api/exercises/favorites/:exerciseKey - Remove from favorites
    router.delete('/favorites/:exerciseKey', async (req: Request, res: Response) => {
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

            if (!favoritesService) {
                return respondWithAppError(
                    res,
                    new AppError({
                        code: 'service_unavailable',
                        message: 'Favorites service not configured',
                        statusCode: 503,
                        category: 'dependencies',
                    }),
                    { traceId: req.traceId },
                );
            }

            const { exerciseKey } = req.params;
            const result = await favoritesService.removeFavorite(req.profileId, exerciseKey);
            return respondWithSuccess(res, result, {
                meta: req.traceId ? { traceId: req.traceId } : undefined,
            });
        } catch (error: any) {
            console.error('[exercises/favorites] Remove error:', error);
            return respondWithAppError(
                res,
                new AppError({
                    code: 'favorites_error',
                    message: 'Failed to remove favorite',
                    statusCode: 500,
                    category: 'internal',
                }),
                { traceId: req.traceId },
            );
        }
    });

    // POST /api/exercises/favorites/:exerciseKey/toggle - Toggle favorite
    router.post('/favorites/:exerciseKey/toggle', async (req: Request, res: Response) => {
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

            if (!favoritesService) {
                return respondWithAppError(
                    res,
                    new AppError({
                        code: 'service_unavailable',
                        message: 'Favorites service not configured',
                        statusCode: 503,
                        category: 'dependencies',
                    }),
                    { traceId: req.traceId },
                );
            }

            const { exerciseKey } = req.params;
            const result = await favoritesService.toggleFavorite(req.profileId, exerciseKey);
            return respondWithSuccess(res, result, {
                meta: req.traceId ? { traceId: req.traceId } : undefined,
            });
        } catch (error: any) {
            console.error('[exercises/favorites] Toggle error:', error);
            return respondWithAppError(
                res,
                new AppError({
                    code: 'favorites_error',
                    message: 'Failed to toggle favorite',
                    statusCode: 500,
                    category: 'internal',
                }),
                { traceId: req.traceId },
            );
        }
    });

    return router;
}


