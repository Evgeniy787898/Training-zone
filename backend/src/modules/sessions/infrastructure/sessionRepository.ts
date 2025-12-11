import { endOfDay, startOfDay } from 'date-fns';

import type { Prisma } from '@prisma/client';
import type { SafePrismaClient } from '../../../types/prisma.js';
import type { StructuredNotes } from '../../../types/api/shared.js';
import { batchOperationDefaults } from '../../../config/constants.js';
import { runPrismaBatch } from '../../../services/prismaBatch.js';
import {
    isTrainingSessionSchemaError,
    isUserProgramSchemaError as isUserProgramSchemaErrorOriginal,
} from '../../../utils/schemaGuards.js';
import { collectLevelImages } from '../../../utils/exercises.js';
import { toInteger } from '../../../utils/numbers.js';

type DerivedExerciseRecord = {
    exerciseKey: string;
    levelCode: string;
    data: {
        profileId: string;
        exerciseId?: string | null;
        exerciseLevelId?: string | null;
        disciplineId?: string | null;
        programId?: string | null;
        userProgramId?: string | null;
        orderIndex?: number | null;
        targetSets?: number | null;
        targetReps?: number | null;
        targetDurationSeconds?: number | null;
        completedSets?: number | null;
        completedReps?: number | null;
        completedDurationSeconds?: number | null;
    };
};

const EXERCISE_STORAGE_ERROR_CODES = new Set(['P2021', 'P2022', 'P2010', 'P2003', 'P2025']);
const TRAINING_SESSION_EXERCISE_BATCH_SIZE =
    batchOperationDefaults.trainingSessionExercises.upsertChunkSize || batchOperationDefaults.chunkSize;

const ensureStringValue = (value: any): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
};

const serializeSessionExercise = (row: any) => {
    const level = row.exerciseLevel ?? null;
    const exercise = row.exercise ?? null;
    const images = collectLevelImages(level);
    const targetLevelCode = row.levelCode || level?.level || null;
    const targetSets = row.targetSets ?? level?.sets ?? null;
    const targetReps = row.targetReps ?? level?.reps ?? null;

    return {
        id: row.id,
        exercise_key: row.exerciseKey,
        exerciseKey: row.exerciseKey,
        exercise_id: row.exerciseId ?? null,
        exerciseId: row.exerciseId ?? null,
        exercise_level_id: row.exerciseLevelId ?? null,
        exerciseLevelId: row.exerciseLevelId ?? null,
        level_code: targetLevelCode,
        levelCode: targetLevelCode,
        profileId: row.profileId ?? null,
        name: level?.title || exercise?.title || row.exerciseKey,
        target: {
            level: targetLevelCode,
            sets: targetSets,
            reps: targetReps,
            durationSeconds: row.targetDurationSeconds ?? null,
        },
        actual: row.completedReps ?? null,
        actualReps: row.completedReps ?? null,
        actualSets: row.completedSets ?? null,
        completed_duration_seconds: row.completedDurationSeconds ?? null,
        order: row.orderIndex ?? null,
        images,
        image_url: images[0] ?? null,
        programId: row.programId ?? null,
        userProgramId: row.userProgramId ?? null,
        disciplineId: row.disciplineId ?? null,
    };
};

const serializeSessionRecord = (session: any, exercises: any[]) => {
    const plannedAtIso = session.plannedAt instanceof Date ? session.plannedAt.toISOString() : session.plannedAt ?? null;
    const createdAtIso = session.createdAt instanceof Date ? session.createdAt.toISOString() : session.createdAt ?? null;
    const updatedAtIso = session.updatedAt instanceof Date ? session.updatedAt.toISOString() : session.updatedAt ?? null;

    return {
        ...session,
        plannedAt: plannedAtIso,
        createdAt: createdAtIso,
        updatedAt: updatedAtIso,
        exercises: exercises.map(serializeSessionExercise),
    };
};

const isSessionExerciseSchemaError = (error: unknown) => {
    if (!error || typeof error !== 'object') {
        return false;
    }

    const err = error as Record<string, any>;
    const code = typeof err.code === 'string' ? err.code : undefined;
    if (code && EXERCISE_STORAGE_ERROR_CODES.has(code)) {
        const target = String(err.meta?.target ?? err.meta?.modelName ?? '').toLowerCase();
        if (!target || target.includes('training_session_exercises')) {
            return true;
        }
    }

    const name = typeof err.name === 'string' ? err.name : '';
    if (name.includes('PrismaClientKnownRequestError') || name.includes('PrismaClientUnknownRequestError')) {
        return true;
    }

    const message = typeof err.message === 'string' ? err.message.toLowerCase() : '';
    if (message.includes('training_session_exercise') || message.includes('session exercise')) {
        return true;
    }

    const metaTarget = typeof err.meta?.target === 'string' ? err.meta.target.toLowerCase() : '';
    if (metaTarget.includes('training_session_exercise')) {
        return true;
    }

    return false;
};

const isSessionTableSchemaError = (error: unknown) => isTrainingSessionSchemaError(error);
const isUserProgramSchemaError = (error: unknown) => isUserProgramSchemaErrorOriginal(error);

export const isSessionsDataUnavailableError = (error: unknown) =>
    isSessionTableSchemaError(error) || isUserProgramSchemaError(error);

export class SessionRepository {
    private plannedAtColumnAvailable = true;

    constructor(private readonly prisma: SafePrismaClient) { }

    private markPlannedAtUnavailable(error?: unknown) {
        if (!this.plannedAtColumnAvailable) {
            return;
        }
        this.plannedAtColumnAvailable = false;
        console.warn('[sessions] planned_at column unavailable, switching to date-based scheduling.');
        if (error) {
            console.warn('[sessions] Root cause:', error);
        }
    }

    private isMissingColumnError(error: unknown, column: string) {
        if (!error || typeof error !== 'object') {
            return false;
        }

        const err = error as Record<string, any>;
        const message = typeof err.message === 'string' ? err.message.toLowerCase() : '';
        if (message.includes(column.toLowerCase())) {
            return true;
        }

        const metaColumn = typeof err.meta?.column_name === 'string' ? err.meta.column_name.toLowerCase() : '';
        if (metaColumn.includes(column.toLowerCase())) {
            return true;
        }

        if (typeof err.code === 'string' && err.code === 'P2021') {
            return true;
        }

        return false;
    }

    async hydrateSessions(sessions: any[]): Promise<any[]> {
        if (!sessions || !sessions.length) return [];
        try {
            const sessionIds = sessions.map((session) => session.id);
            const exerciseRows = await this.prisma.trainingSessionExercise.findMany({
                where: {
                    sessionId: { in: sessionIds },
                },
                include: {
                    exercise: { select: { id: true, title: true, exerciseKey: true } },
                    exerciseLevel: {
                        select: {
                            id: true,
                            level: true,
                            title: true,
                            sets: true,
                            reps: true,
                            imageUrl: true,
                            imageUrl2: true,
                            imageUrl3: true,
                            updatedAt: true,
                        },
                    },
                },
                orderBy: [{ sessionId: 'asc' }, { orderIndex: 'asc' }, { createdAt: 'asc' }],
            });

            const grouped = new Map<string, any[]>();
            for (const row of exerciseRows) {
                if (!grouped.has(row.sessionId)) {
                    grouped.set(row.sessionId, []);
                }
                grouped.get(row.sessionId)!.push(row);
            }

            return sessions.map((session) => serializeSessionRecord(session, grouped.get(session.id) ?? []));
        } catch (error) {
            if (isSessionExerciseSchemaError(error)) {
                console.error('[sessions] Training session exercise schema unavailable:', error);
            }
            throw error;
        }
    }

    async fetchSessionsWithinRange(profileId: string, start: Date, end: Date) {
        if (this.plannedAtColumnAvailable) {
            try {
                return await this.prisma.trainingSession.findMany({
                    where: {
                        profileId,
                        plannedAt: {
                            gte: start,
                            lte: end,
                        },
                    },
                    orderBy: { plannedAt: 'asc' },
                });
            } catch (error) {
                if (this.isMissingColumnError(error, 'planned_at')) {
                    this.markPlannedAtUnavailable(error);
                } else if (isSessionTableSchemaError(error)) {
                    throw error;
                } else {
                    throw error;
                }
            }
        }

        return this.prisma.trainingSession.findMany({
            where: {
                profileId,
                plannedAt: {
                    gte: start,
                    lte: end,
                },
            },
            orderBy: { plannedAt: 'asc' },
        });
    }

    async fetchHistory(profileId: string, limit: number, offset: number) {
        if (this.plannedAtColumnAvailable) {
            try {
                return await this.prisma.trainingSession.findMany({
                    where: { profileId, status: 'done' },
                    orderBy: { plannedAt: 'desc' },
                    take: limit,
                    skip: offset,
                });
            } catch (error) {
                if (this.isMissingColumnError(error, 'planned_at')) {
                    this.markPlannedAtUnavailable(error);
                } else {
                    throw error;
                }
            }
        }

        return this.prisma.trainingSession.findMany({
            where: { profileId, status: 'done' },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
        });
    }

    async findSessionByPlannedTimestamp(profileId: string, plannedAt: Date) {
        if (this.plannedAtColumnAvailable) {
            try {
                const session = await this.prisma.trainingSession.findFirst({
                    where: {
                        profileId,
                        plannedAt,
                    },
                    orderBy: { updatedAt: 'desc' },
                });
                if (session) {
                    return session;
                }
            } catch (error) {
                if (this.isMissingColumnError(error, 'planned_at')) {
                    this.markPlannedAtUnavailable(error);
                } else if (isSessionTableSchemaError(error)) {
                    throw error;
                } else {
                    throw error;
                }
            }
        }

        return this.prisma.trainingSession.findFirst({
            where: {
                profileId,
                plannedAt: {
                    gte: startOfDay(plannedAt),
                    lt: endOfDay(plannedAt),
                },
            },
            orderBy: { updatedAt: 'desc' },
        });
    }

    async findSessionById(sessionId: string) {
        return this.prisma.trainingSession.findUnique({ where: { id: sessionId } });
    }

    async updateSessionWithSchedulingFallback(
        sessionId: string,
        dataWithPlanned: Prisma.TrainingSessionUpdateInput,
        fallbackData: Prisma.TrainingSessionUpdateInput,
    ) {
        if (this.plannedAtColumnAvailable) {
            try {
                return await this.prisma.trainingSession.update({
                    where: { id: sessionId },
                    data: dataWithPlanned,
                });
            } catch (error) {
                if (this.isMissingColumnError(error, 'planned_at')) {
                    this.markPlannedAtUnavailable(error);
                } else {
                    throw error;
                }
            }
        }

        return this.prisma.trainingSession.update({
            where: { id: sessionId },
            data: fallbackData,
        });
    }

    async createSessionWithSchedulingFallback(
        dataWithPlanned: Prisma.TrainingSessionCreateInput,
        fallbackData: Prisma.TrainingSessionCreateInput,
    ) {
        if (this.plannedAtColumnAvailable) {
            try {
                return await this.prisma.trainingSession.create({
                    data: dataWithPlanned,
                });
            } catch (error) {
                if (this.isMissingColumnError(error, 'planned_at')) {
                    this.markPlannedAtUnavailable(error);
                } else {
                    throw error;
                }
            }
        }

        return this.prisma.trainingSession.create({
            data: fallbackData,
        });
    }

    async deleteSession(sessionId: string) {
        return this.prisma.trainingSession.delete({
            where: { id: sessionId },
        });
    }

    async syncSessionExercises(sessionId: string, profileId: string, records: DerivedExerciseRecord[]) {
        try {
            await this.prisma.$transaction(async (tx) => {
                if (!records.length) {
                    await tx.trainingSessionExercise.deleteMany({ where: { sessionId } });
                    return;
                }

                const keepClauses = records.map((record) => ({
                    exerciseKey: record.exerciseKey,
                    levelCode: record.levelCode,
                }));

                await tx.trainingSessionExercise.deleteMany({
                    where: {
                        sessionId,
                        NOT: { OR: keepClauses },
                    },
                });

                await runPrismaBatch(
                    records,
                    async (record) => {
                        const { profileId: exerciseProfileId, ...exerciseData } = record.data || {};
                        await tx.trainingSessionExercise.upsert({
                            where: {
                                sessionId_exerciseKey_levelCode: {
                                    sessionId,
                                    exerciseKey: record.exerciseKey,
                                    levelCode: record.levelCode,
                                },
                            },
                            update: exerciseData,
                            create: {
                                sessionId,
                                profileId: exerciseProfileId ?? profileId,
                                exerciseKey: record.exerciseKey,
                                levelCode: record.levelCode,
                                ...exerciseData,
                            },
                        });
                    },
                    { chunkSize: TRAINING_SESSION_EXERCISE_BATCH_SIZE },
                );
            });
        } catch (error) {
            if (isSessionExerciseSchemaError(error)) {
                console.error('[sessions] Training session exercise schema unavailable during sync:', error);
            }
            throw error;
        }
    }

    async deriveStructuredSessionData(notesPayload: StructuredNotes | null, profileId: string) {
        if (!notesPayload) {
            return { sessionData: {}, exercises: [] };
        }

        const sessionData: Record<string, any> = {};
        const exercises: DerivedExerciseRecord[] = [];

        if (notesPayload.comment) {
            const comment = ensureStringValue(notesPayload.comment);
            if (comment) {
                sessionData.comment = comment;
            }
        }

        const program = notesPayload.program ?? null;
        if (program) {
            const programId = ensureStringValue((program as any).id);
            const selectionId = ensureStringValue((program as any).selectionId);
            const disciplineId = ensureStringValue((program as any).disciplineId);
            if (disciplineId) sessionData.disciplineId = disciplineId;
            if (programId) sessionData.programId = programId;
            if (selectionId) sessionData.userProgramId = selectionId;
        }

        if (notesPayload.timer) {
            const timer = notesPayload.timer as Record<string, any>;
            const work = toInteger(timer.work ?? timer.workSeconds);
            const rest = toInteger(timer.rest ?? timer.restSeconds);
            const restSets = toInteger(timer.restBetweenSets ?? timer.rest_between_sets ?? timer.restSets);
            const restExercises = toInteger(
                timer.restBetweenExercises ?? timer.rest_between_exercises ?? timer.restExercises,
            );
            const elapsed = toInteger(timer.elapsedSeconds ?? timer.elapsed);
            const rounds = toInteger(timer.rounds ?? timer.roundsCount ?? timer.rounds_total ?? timer.roundsPlanned);
            if (work !== null) sessionData.workIntervalSeconds = work;
            if (rest !== null) sessionData.restIntervalSeconds = rest;
            if (restSets !== null) sessionData.restBetweenSetsSeconds = restSets;
            if (restExercises !== null) sessionData.restBetweenExercisesSeconds = restExercises;
            if (elapsed !== null) sessionData.tabataTotalSeconds = elapsed;
            if (rounds !== null) sessionData.tabataRounds = rounds;
        }

        if (Array.isArray(notesPayload.results)) {
            const entries = notesPayload.results;
            const keysToFetch = new Set<string>();
            const levelPairs = new Map<string, Set<string>>();

            for (const entry of entries) {
                const exerciseKey = ensureStringValue((entry as any).exerciseKey ?? (entry as any).exercise_key);
                if (!exerciseKey) {
                    continue;
                }
                const explicitExerciseId = ensureStringValue((entry as any).exerciseId);
                if (!explicitExerciseId) {
                    keysToFetch.add(exerciseKey);
                }
                const explicitLevelId = ensureStringValue((entry as any).levelId ?? (entry as any).exerciseLevelId);
                const levelCode = ensureStringValue((entry as any).levelCode ?? (entry as any).level_code) ?? 'base';
                if (!explicitLevelId && levelCode) {
                    const existing = levelPairs.get(exerciseKey);
                    if (existing) {
                        existing.add(levelCode);
                    } else {
                        levelPairs.set(exerciseKey, new Set([levelCode]));
                    }
                }
            }

            const exerciseLookup = new Map<string, string>();
            if (keysToFetch.size > 0) {
                const exercises = await this.prisma.exercise.findMany({
                    where: { exerciseKey: { in: Array.from(keysToFetch) } },
                    select: { exerciseKey: true, id: true },
                });
                for (const record of exercises) {
                    exerciseLookup.set(record.exerciseKey, record.id);
                }
            }

            const levelLookup = new Map<
                string,
                {
                    id: string;
                    sets: number | null;
                    reps: number | null;
                }
            >();
            if (levelPairs.size > 0) {
                const conditions = Array.from(levelPairs.entries()).flatMap(([exerciseKey, levels]) =>
                    Array.from(levels).map((level) => ({ exerciseKey, level })),
                );
                if (conditions.length > 0) {
                    const levels = await this.prisma.exerciseLevel.findMany({
                        where: { OR: conditions },
                        select: { exerciseKey: true, level: true, id: true, sets: true, reps: true },
                    });
                    for (const level of levels) {
                        levelLookup.set(`${level.exerciseKey}:${level.level}`, {
                            id: level.id,
                            sets: level.sets ?? null,
                            reps: level.reps ?? null,
                        });
                    }
                }
            }

            let order = 0;
            for (const entry of entries) {
                const exerciseKey = ensureStringValue((entry as any).exerciseKey ?? (entry as any).exercise_key);
                if (!exerciseKey) {
                    continue;
                }

                const levelCode = ensureStringValue((entry as any).levelCode ?? (entry as any).level_code) ?? 'base';
                let targetSets = toInteger((entry as any)?.target?.sets);
                let targetReps = toInteger((entry as any)?.target?.reps);
                const targetDuration = toInteger((entry as any)?.target?.durationSeconds);
                const actualReps = toInteger((entry as any).actual ?? (entry as any).actualReps);
                const actualSets = toInteger((entry as any).actualSets);
                const actualDuration = toInteger((entry as any).actualDuration ?? (entry as any).actualDurationSeconds);
                const explicitExerciseId = ensureStringValue((entry as any).exerciseId);
                const explicitLevelId = ensureStringValue((entry as any).levelId ?? (entry as any).exerciseLevelId);

                let exerciseId = explicitExerciseId ?? null;
                if (!exerciseId) {
                    exerciseId = exerciseLookup.get(exerciseKey) ?? null;
                }

                let exerciseLevelId = explicitLevelId ?? null;
                if (!exerciseLevelId && levelCode) {
                    const level = levelLookup.get(`${exerciseKey}:${levelCode}`) ?? null;
                    exerciseLevelId = level?.id ?? null;
                    if (level) {
                        if (targetSets === null && level.sets !== null) {
                            targetSets = level.sets;
                        }
                        if (targetReps === null && level.reps !== null) {
                            targetReps = level.reps;
                        }
                    }
                }

                const completedSets = actualSets ?? targetSets ?? null;
                const completedReps = actualReps ?? null;

                exercises.push({
                    exerciseKey,
                    levelCode,
                    data: {
                        profileId,
                        exerciseId,
                        exerciseLevelId,
                        disciplineId: sessionData.disciplineId ?? null,
                        programId: sessionData.programId ?? null,
                        userProgramId: sessionData.userProgramId ?? null,
                        orderIndex: toInteger((entry as any).order ?? order),
                        targetSets,
                        targetReps,
                        targetDurationSeconds: targetDuration,
                        completedSets,
                        completedReps,
                        completedDurationSeconds: actualDuration,
                    },
                });

                order += 1;
            }
        }

        return { sessionData, exercises };
    }
}
