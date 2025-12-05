import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { isUserProgramSchemaError as isUserProgramSchemaErrorOriginal } from '../utils/schemaGuards.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
    respondWithAppError,
    respondWithSuccess,
} from '../utils/apiResponses.js';
import { AppError } from '../services/errors.js';
import { respondAuthRequired } from '../utils/auth.js';
import { invalidateExerciseCatalogCache } from '../modules/infrastructure/cacheInvalidation.js';
import type { UserProgramDetailsResponse, UserProgramResponse, UserProgramSummary } from '../types/apiResponses.js';
import type { UserProgramService } from '../modules/userPrograms/userProgram.service.js';

export function createUserProgramsRouter(userProgramService: UserProgramService) {
    const router = Router();

    const buildMeta = (req: Request) => (req.traceId ? { traceId: req.traceId } : undefined);

    const parseJsonField = (value: unknown) => {
        if (!value) return null;
        if (typeof value === 'object') {
            return value as Record<string, any>;
        }
        if (typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                return parsed && typeof parsed === 'object' ? (parsed as Record<string, any>) : null;
            } catch (error) {
                console.warn('[user-programs] Failed to parse JSON field:', error);
            }
        }
        return null;
    };

    const isUserProgramSchemaError = (error: unknown) => isUserProgramSchemaErrorOriginal(error);

    const respondUserProgramUnavailable = (res: Response, traceId?: string) =>
        respondWithAppError(
            res,
            new AppError({
                code: 'user_programs_unavailable',
                message: 'Данные программы пользователя временно недоступны. Попробуйте обновить позже.',
                statusCode: 503,
                category: 'dependencies',
            }),
            traceId ? { traceId } : undefined,
        );

    const levelRecordSchema = z.record(z.string().trim().min(1), z.number().finite());

    const saveUserProgramSchema = z
        .object({
            disciplineId: z.string().trim().uuid(),
            programId: z.string().trim().uuid(),
            initialLevels: levelRecordSchema.optional(),
            currentLevels: levelRecordSchema.optional(),
        })
        .strict();

    const updateUserProgramSchema = saveUserProgramSchema.partial();

    type SaveUserProgramPayload = z.infer<typeof saveUserProgramSchema>;
    type UpdateUserProgramPayload = z.infer<typeof updateUserProgramSchema>;

    const resolveJsonValue = (
        value: Record<string, any> | undefined,
        fallback: any,
    ) => {
        if (value !== undefined) {
            return value;
        }
        return fallback ?? null;
    };

    const normalizeLevelRecord = (value: unknown): Record<string, number> | null => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return null;
        }
        const entries = Object.entries(value as Record<string, unknown>).reduce<Record<string, number>>(
            (acc, [key, raw]) => {
                const num = typeof raw === 'number' ? raw : Number(raw);
                if (Number.isFinite(num)) {
                    acc[key] = num;
                }
                return acc;
            },
            {},
        );
        return Object.keys(entries).length ? entries : null;
    };

    const serializeUserProgramSummary = (program: any): UserProgramSummary => ({
        id: program.id,
        profileId: program.profileId,
        disciplineId: program.disciplineId ?? null,
        programId: program.programId ?? null,
        initialLevels: normalizeLevelRecord(program.initialLevels),
        currentLevels: normalizeLevelRecord(program.currentLevels),
        isActive: program.isActive !== false,
        createdAt: program.createdAt,
        updatedAt: program.updatedAt,
        discipline: program.discipline
            ? {
                id: program.discipline.id,
                name: program.discipline.name,
                description: program.discipline.description ?? null,
                imageUrl: program.discipline.imageUrl ?? null,
                isActive: program.discipline.isActive ?? null,
                createdAt: program.discipline.createdAt,
                updatedAt: program.discipline.updatedAt,
            }
            : null,
        program: program.program
            ? {
                id: program.program.id,
                disciplineId: program.program.disciplineId ?? null,
                name: program.program.name,
                description: program.program.description ?? null,
                frequency:
                    typeof program.program.frequency === 'number'
                        ? program.program.frequency
                        : Number(program.program.frequency ?? 0) || null,
                restDay: program.program.restDay ?? null,
                programData: program.program.programData ?? null,
                isActive: program.program.isActive ?? null,
                createdAt: program.program.createdAt,
                updatedAt: program.program.updatedAt,
            }
            : null,
    });

    // GET /api/user-programs - получить программу пользователя
    router.get('/', async (req: Request, res: Response, next) => {
        try {
            const profileId = req.profileId;

            if (!profileId) {
                return respondAuthRequired(req, res);
            }

            let userProgram;
            try {
                userProgram = await userProgramService.getActiveProgram(profileId);
            } catch (error) {
                if (isUserProgramSchemaError(error)) {
                    console.warn('[user-programs] Schema unavailable while fetching program:', error);
                    return respondUserProgramUnavailable(res, req.traceId);
                }
                throw error;
            }

            if (!userProgram) {
                return respondWithAppError(
                    res,
                    new AppError({
                        code: 'not_found',
                        message: 'User program not found',
                        statusCode: 404,
                        category: 'not_found',
                    }),
                    { traceId: req.traceId },
                );
            }

            // Проверяем, что связанные данные существуют
            if (!userProgram.discipline || !userProgram.program) {
                return respondWithAppError(
                    res,
                    new AppError({
                        code: 'incomplete_data',
                        message: 'User program data is incomplete',
                        statusCode: 404,
                        category: 'not_found',
                    }),
                    { traceId: req.traceId },
                );
            }

            const normalizedProgram = serializeUserProgramSummary(userProgram);
            const responsePayload: UserProgramDetailsResponse = {
                ...normalizedProgram,
                source: 'database',
                fallback: false,
            };

            return respondWithSuccess<UserProgramDetailsResponse>(res, responsePayload, { meta: buildMeta(req) });
        } catch (error) {
            if (isUserProgramSchemaError(error)) {
                console.warn('[user-programs] Schema unavailable when fetching program:', error);
                return respondUserProgramUnavailable(res, req.traceId);
            }
            next(error);
        }
    });

    // POST /api/user-programs - создать или обновить программу пользователя
    router.post('/', validateRequest({ body: saveUserProgramSchema }), async (req: Request, res: Response, next) => {
        try {
            const profileId = req.profileId;

            if (!profileId) {
                return respondAuthRequired(req, res);
            }

            const payload = req.validated?.body as SaveUserProgramPayload;
            const { disciplineId, programId, initialLevels, currentLevels } = payload;

            const userProgram = await userProgramService.createOrUpdate(profileId, {
                disciplineId,
                programId,
                initialLevels,
                currentLevels,
            });

            await invalidateExerciseCatalogCache(profileId);

            const response: UserProgramResponse = { userProgram: serializeUserProgramSummary(userProgram) };
            return respondWithSuccess<UserProgramResponse>(res, response, { meta: buildMeta(req) });
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
            if (isUserProgramSchemaError(error)) {
                console.warn('[user-programs] Schema unavailable when saving program:', error);
                return respondUserProgramUnavailable(res, req.traceId);
            }
            next(error);
        }
    });

    // POST /api/user-programs/create - создать новую запись (даже если есть существующая)
    router.post('/create', validateRequest({ body: saveUserProgramSchema }), async (req: Request, res: Response, next) => {
        try {
            const profileId = req.profileId;

            if (!profileId) {
                return respondAuthRequired(req, res);
            }

            const payload = req.validated?.body as SaveUserProgramPayload;
            const { disciplineId, programId, initialLevels, currentLevels } = payload;

            const userProgram = await userProgramService.createNewProgram(profileId, {
                disciplineId,
                programId,
                initialLevels,
                currentLevels,
            });

            await invalidateExerciseCatalogCache(profileId);

            return respondWithSuccess<UserProgramResponse>(
                res,
                { userProgram: serializeUserProgramSummary(userProgram) },
                { meta: buildMeta(req) },
            );
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
            if (isUserProgramSchemaError(error)) {
                console.warn('[user-programs] Schema unavailable when force-creating program:', error);
                return respondUserProgramUnavailable(res, req.traceId);
            }
            next(error);
        }
    });

    // PUT /api/user-programs - обновить программу пользователя
    router.put('/', validateRequest({ body: updateUserProgramSchema }), async (req: Request, res: Response, next) => {
        try {
            const profileId = req.profileId;

            if (!profileId) {
                return respondAuthRequired(req, res);
            }

            const payload = (req.validated?.body as UpdateUserProgramPayload) ?? {};
            const { disciplineId, programId, initialLevels, currentLevels } = payload;

            const userProgram = await userProgramService.updateProgram(profileId, {
                disciplineId,
                programId,
                initialLevels,
                currentLevels,
            });

            if (!userProgram) {
                return respondWithAppError(
                    res,
                    new AppError({
                        code: 'not_found',
                        message: 'User program not found',
                        statusCode: 404,
                        category: 'not_found',
                    }),
                    { traceId: req.traceId },
                );
            }

            await invalidateExerciseCatalogCache(profileId);

            return respondWithSuccess<UserProgramResponse>(
                res,
                { userProgram: serializeUserProgramSummary(userProgram) },
                { meta: buildMeta(req) },
            );
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
            if (isUserProgramSchemaError(error)) {
                console.warn('[user-programs] Schema unavailable when updating program:', error);
                return respondUserProgramUnavailable(res, req.traceId);
            }
            next(error);
        }
    });

    return router;
}
