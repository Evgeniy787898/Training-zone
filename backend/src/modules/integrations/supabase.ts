// TZONA V2 - Supabase/Prisma wrapper service
// Обертка для работы с базой данных через Prisma
import type { SafePrismaClient } from '../../types/prisma.js';
import { format, addDays } from 'date-fns';
import { rememberCachedResource } from '../infrastructure/cacheStrategy.js';
import { ensureOwnedByProfile } from '../security/accessControl.js';
import { collectLevelImages } from '../../utils/exercises.js';
import { toInteger } from '../../utils/numbers.js';
import { achievementSummarySelect, assistantNoteSummarySelect } from '../database/prismaSelect.js';
import { batchOperationDefaults } from '../../config/constants.js';
import {
    fetchRpeDistributionBuckets,
    fetchSessionVolumeSummaries,
    type SessionVolumeSummary,
} from '../infrastructure/materializedViews.js';
import { runPrismaBatch } from '../../services/prismaBatch.js';
import {
    invalidateAssistantNotesCache,
    invalidateExerciseCatalogCache,
    invalidateSessionDerivedCaches,
} from '../infrastructure/cacheInvalidation.js';

type SessionExerciseRecord = {
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

type AssistantDialogStateRecord = {
    id: string;
    profileId: string;
    statePayload: Record<string, any> | null;
    updatedAt: Date;
    expiresAt: Date | null;
};

const ensureStringValue = (value: any): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
};

const TRAINING_SESSION_EXERCISE_BATCH_SIZE =
    batchOperationDefaults.trainingSessionExercises.upsertChunkSize || batchOperationDefaults.chunkSize;

async function resolveExerciseId(prisma: SafePrismaClient, cache: Map<string, string | null>, exerciseKey: string): Promise<string | null> {
    if (cache.has(exerciseKey)) {
        return cache.get(exerciseKey) ?? null;
    }
    const exercise = await prisma.exercise.findUnique({
        where: { exerciseKey },
        select: { id: true },
    });
    const value = exercise?.id ?? null;
    cache.set(exerciseKey, value);
    return value;
}

async function resolveExerciseLevel(
    prisma: SafePrismaClient,
    cache: Map<string, Map<string, { id: string | null; sets?: number | null; reps?: number | null }>>,
    exerciseKey: string,
    levelCode: string,
): Promise<{ id: string | null; sets?: number | null; reps?: number | null }> {
    const levelCache = cache.get(exerciseKey) ?? new Map();
    cache.set(exerciseKey, levelCache);
    if (levelCache.has(levelCode)) {
        return levelCache.get(levelCode)!;
    }
    const level = await prisma.exerciseLevel.findFirst({
        where: { exerciseKey, level: levelCode },
        select: { id: true, sets: true, reps: true },
    });
    const value = { id: level?.id ?? null, sets: level?.sets ?? undefined, reps: level?.reps ?? undefined };
    levelCache.set(levelCode, value);
    return value;
}

async function syncSessionExercisePayload(
    prisma: SafePrismaClient,
    sessionId: string,
    profileId: string,
    payload: any[] | undefined,
    context: { disciplineId?: string | null; programId?: string | null; userProgramId?: string | null },
): Promise<void> {
    if (!Array.isArray(payload)) {
        await prisma.trainingSessionExercise.deleteMany({ where: { sessionId } });
        return;
    }

    const records: SessionExerciseRecord[] = [];
    const exerciseIdCache = new Map<string, string | null>();
    const levelCache = new Map<string, Map<string, { id: string | null; sets?: number | null; reps?: number | null }>>();

    for (let index = 0; index < payload.length; index += 1) {
        const entry = payload[index];
        const exerciseKey = ensureStringValue(entry?.exercise_key ?? entry?.exerciseKey ?? entry?.key);
        if (!exerciseKey) continue;

        const rawLevel = ensureStringValue(entry?.level ?? entry?.level_code ?? entry?.target?.level);
        const levelCode = rawLevel ?? '';
        let targetSets = toInteger(entry?.target?.sets ?? entry?.sets);
        let targetReps = toInteger(entry?.target?.reps ?? entry?.reps);
        const targetDuration = toInteger(entry?.target?.durationSeconds ?? entry?.target?.duration);
        const actualReps = toInteger(entry?.actual ?? entry?.actualReps);
        const actualSets = toInteger(entry?.actualSets);
        const actualDuration = toInteger(entry?.actualDuration ?? entry?.actualDurationSeconds);

        const exerciseId = await resolveExerciseId(prisma, exerciseIdCache, exerciseKey);
        let exerciseLevelId: string | null = null;
        if (levelCode) {
            const resolved = await resolveExerciseLevel(prisma, levelCache, exerciseKey, levelCode);
            exerciseLevelId = resolved.id;
            if (targetSets === null && resolved.sets !== undefined) {
                targetSets = resolved.sets ?? null;
            }
            if (targetReps === null && resolved.reps !== undefined) {
                targetReps = resolved.reps ?? null;
            }
        }

        records.push({
            exerciseKey,
            levelCode,
            data: {
                profileId,
                exerciseId,
                exerciseLevelId,
                disciplineId: context.disciplineId ?? null,
                programId: context.programId ?? null,
                userProgramId: context.userProgramId ?? null,
                orderIndex: toInteger(entry?.order ?? index),
                targetSets,
                targetReps,
                targetDurationSeconds: targetDuration,
                completedSets: actualSets ?? targetSets ?? null,
                completedReps: actualReps ?? null,
                completedDurationSeconds: actualDuration,
            },
        });
    }

    await prisma.$transaction(async (tx: any) => {
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
}

const serializeExerciseRow = (row: any) => {
    const level = row.exerciseLevel ?? null;
    const exercise = row.exercise ?? null;
    const images = collectLevelImages(level);
    const levelCode = row.levelCode || level?.level || null;
    const sets = row.targetSets ?? level?.sets ?? null;
    const reps = row.targetReps ?? level?.reps ?? null;

    return {
        exercise_key: row.exerciseKey,
        exerciseKey: row.exerciseKey,
        exercise_id: row.exerciseId ?? null,
        exerciseId: row.exerciseId ?? null,
        exercise_level_id: row.exerciseLevelId ?? null,
        exerciseLevelId: row.exerciseLevelId ?? null,
        level_code: levelCode,
        levelCode,
        profileId: row.profileId ?? null,
        name: level?.title || exercise?.title || row.exerciseKey,
        target: {
            level: levelCode,
            sets,
            reps,
            durationSeconds: row.targetDurationSeconds ?? null,
        },
        actual: row.completedReps ?? null,
        actualReps: row.completedReps ?? null,
        actualSets: row.completedSets ?? null,
        completed_duration_seconds: row.completedDurationSeconds ?? null,
        images,
        image_url: images[0] ?? null,
        programId: row.programId ?? null,
        userProgramId: row.userProgramId ?? null,
        disciplineId: row.disciplineId ?? null,
        order: row.orderIndex ?? null,
    };
};

async function hydrateSessionRecords(prisma: SafePrismaClient, sessions: any[]): Promise<any[]> {
    if (!sessions.length) return sessions;
    const sessionIds = sessions.map((session) => session.id);
    const rows = await prisma.trainingSessionExercise.findMany({
        where: { sessionId: { in: sessionIds } },
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
                    image1: true,
                    image2: true,
                    image3: true,
                    updatedAt: true,
                },
            },
        },
        orderBy: [{ sessionId: 'asc' }, { orderIndex: 'asc' }, { createdAt: 'asc' }],
    });

    const grouped = new Map<string, any[]>();
    for (const row of rows) {
        if (!grouped.has(row.sessionId)) {
            grouped.set(row.sessionId, []);
        }
        grouped.get(row.sessionId)!.push(serializeExerciseRow(row));
    }

    return sessions.map((session) => {
        const plannedAt = session.plannedAt instanceof Date ? session.plannedAt.toISOString() : session.plannedAt ?? null;
        const legacyExercises = Array.isArray((session as any).exercisePayload)
            ? (session as any).exercisePayload
            : Array.isArray((session as any).exercises)
                ? (session as any).exercises
                : [];
        return {
            ...session,
            date: plannedAt,
            exercises: grouped.get(session.id) ?? [],
            legacyExercises,
        };
    });
}

// Create database service wrapper
export class DatabaseService {
    constructor(private prisma: SafePrismaClient) { }

    // Profile operations
    async getProfileByTelegramId(telegramId: bigint) {
        return this.prisma.profile.findUnique({
            where: { telegramId },
        });
    }

    async getProfileById(profileId: string) {
        return this.prisma.profile.findUnique({
            where: { id: profileId },
        });
    }

    async createProfile(telegramId: bigint, userData: any = {}) {
        return this.prisma.profile.create({
            data: {
                telegramId,
                goals: userData.goals || {},
                equipment: userData.equipment || [],
                preferences: userData.preferences || {},
                notificationTime: userData.notification_time || '06:00:00',
                timezone: userData.timezone || 'Europe/Moscow',
            },
        });
    }

    async updateProfile(profileId: string, updates: any) {
        return this.prisma.profile.update({
            where: { id: profileId },
            data: updates,
        });
    }

    // Training session operations
    async createTrainingSession(sessionData: any) {
        const plannedAtSource = sessionData.planned_at || sessionData.date || new Date().toISOString();
        const notes = sanitizeNotes(sessionData.notes);
        const comment = ensureStringValue(sessionData.comment);

        const created = await this.prisma.trainingSession.create({
            data: {
                profileId: sessionData.profile_id,
                plannedAt: new Date(plannedAtSource),
                status: sessionData.status || 'planned',
                notes,
                comment,
                disciplineId: ensureStringValue(sessionData.discipline_id),
                programId: ensureStringValue(sessionData.program_id),
                userProgramId: ensureStringValue(sessionData.user_program_id),
                tabataRounds: toInteger(sessionData.tabata_rounds),
                tabataTotalSeconds: toInteger(sessionData.tabata_total_seconds),
                workIntervalSeconds: toInteger(sessionData.work_interval_seconds),
                restIntervalSeconds: toInteger(sessionData.rest_interval_seconds),
                restBetweenSetsSeconds: toInteger(sessionData.rest_between_sets_seconds),
                restBetweenExercisesSeconds: toInteger(sessionData.rest_between_exercises_seconds),
            },
        });

        if (Array.isArray(sessionData.exercises) && sessionData.exercises.length) {
            await syncSessionExercisePayload(this.prisma, created.id, created.profileId, sessionData.exercises, {
                disciplineId: created.disciplineId ?? null,
                programId: created.programId ?? null,
                userProgramId: created.userProgramId ?? null,
            });
        }

        const hydrated = await hydrateSessionRecords(this.prisma, [created]);
        await invalidateSessionDerivedCaches(created.profileId);
        return hydrated[0] ?? created;
    }

    async getTrainingSession(sessionId: string, profileId: string) {
        const session = await this.prisma.trainingSession.findUnique({
            where: { id: sessionId },
        });
        if (!session) return null;

        ensureOwnedByProfile(session, profileId, {
            resource: 'training_session',
            resourceId: session.id,
            action: 'read',
        });

        const hydrated = await hydrateSessionRecords(this.prisma, [session]);
        return hydrated[0] ?? session;
    }

    async getTrainingSessions(profileId: string, filters: any = {}) {
        const where: any = { profileId };

        if (filters.startDate) {
            where.plannedAt = { ...(where.plannedAt || {}), gte: new Date(filters.startDate) };
        }
        if (filters.endDate) {
            where.plannedAt = { ...(where.plannedAt || {}), lte: new Date(filters.endDate) };
        }
        if (filters.status) {
            where.status = filters.status;
        }

        const sessions = await this.prisma.trainingSession.findMany({
            where,
            orderBy: { plannedAt: 'desc' },
        });

        return hydrateSessionRecords(this.prisma, sessions);
    }

    async getLatestSessionSummary(profileId: string) {
        return this.prisma.trainingSession.findFirst({
            where: { profileId },
            orderBy: { plannedAt: 'desc' },
            select: {
                id: true,
                plannedAt: true,
                status: true,
                tabataTotalSeconds: true,
                tabataRounds: true,
            },
        });
    }

    async getRecentCompletionStats(profileId: string, { days = 7 } = {}) {
        const startDate = format(addDays(new Date(), -days), 'yyyy-MM-dd');

        const sessions = await this.prisma.trainingSession.findMany({
            where: {
                profileId,
                plannedAt: { gte: new Date(startDate) },
            },
            select: { status: true, plannedAt: true },
            orderBy: { plannedAt: 'asc' },
        });

        const summary = {
            total: 0,
            completed: 0,
            skipped: 0,
            lastStatus: null as string | null,
            lastRpe: null as number | null,
            streak: 0,
        };

        if (!sessions || sessions.length === 0) {
            return summary;
        }

        summary.total = sessions.length;
        let currentStreak = 0;

        for (const entry of sessions) {
            if (entry.status === 'done') {
                summary.completed += 1;
                currentStreak += 1;
                summary.lastStatus = entry.status;
            } else if (entry.status === 'skipped') {
                summary.skipped += 1;
                currentStreak = 0;
                summary.lastStatus = entry.status;
            }
        }

        summary.streak = currentStreak;
        return summary;
    }

    async updateTrainingSession(profileId: string, sessionId: string, updates: any) {
        const data: any = { ...updates };

        if (data.planned_at) {
            data.plannedAt = new Date(data.planned_at);
            delete data.planned_at;
        }
        if (data.profile_id) {
            data.profileId = data.profile_id;
            delete data.profile_id;
        }
        if (data.comment) {
            data.comment = ensureStringValue(data.comment);
        }
        if (data.discipline_id) {
            data.disciplineId = ensureStringValue(data.discipline_id);
            delete data.discipline_id;
        }
        if (data.program_id) {
            data.programId = ensureStringValue(data.program_id);
            delete data.program_id;
        }
        if (data.user_program_id) {
            data.userProgramId = ensureStringValue(data.user_program_id);
            delete data.user_program_id;
        }
        if (data.tabata_rounds !== undefined) {
            data.tabataRounds = toInteger(data.tabata_rounds);
            delete data.tabata_rounds;
        }
        if (data.tabata_total_seconds !== undefined) {
            data.tabataTotalSeconds = toInteger(data.tabata_total_seconds);
            delete data.tabata_total_seconds;
        }
        if (data.work_interval_seconds !== undefined) {
            data.workIntervalSeconds = toInteger(data.work_interval_seconds);
            delete data.work_interval_seconds;
        }
        if (data.rest_interval_seconds !== undefined) {
            data.restIntervalSeconds = toInteger(data.rest_interval_seconds);
            delete data.rest_interval_seconds;
        }
        if (data.rest_between_sets_seconds !== undefined) {
            data.restBetweenSetsSeconds = toInteger(data.rest_between_sets_seconds);
            delete data.rest_between_sets_seconds;
        }
        if (data.rest_between_exercises_seconds !== undefined) {
            data.restBetweenExercisesSeconds = toInteger(data.rest_between_exercises_seconds);
            delete data.rest_between_exercises_seconds;
        }

        const { exercises, ...sessionData } = data;

        const targetSession = await this.prisma.trainingSession.findUnique({
            where: { id: sessionId },
            select: { id: true, profileId: true },
        });

        if (!targetSession) {
            const notFound: any = new Error('Сессия не найдена');
            notFound.code = 'session_not_found';
            notFound.status = 404;
            throw notFound;
        }

        ensureOwnedByProfile(targetSession, profileId, {
            resource: 'training_session',
            resourceId: sessionId,
            action: 'update',
        });

        const updated = await this.prisma.trainingSession.update({
            where: { id: sessionId },
            data: sessionData,
        });

        if (Array.isArray(exercises)) {
            await syncSessionExercisePayload(this.prisma, sessionId, updated.profileId, exercises, {
                disciplineId: updated.disciplineId ?? null,
                programId: updated.programId ?? null,
                userProgramId: updated.userProgramId ?? null,
            });
        }

        const hydrated = await hydrateSessionRecords(this.prisma, [updated]);
        await invalidateSessionDerivedCaches(updated.profileId);
        return hydrated[0] ?? updated;
    }

    async deleteTrainingSession(sessionId: string) {
        const deleted = await this.prisma.trainingSession.delete({
            where: { id: sessionId },
        });
        await invalidateSessionDerivedCaches(deleted.profileId);
        return deleted;
    }

    // Exercise progress operations
    async createExerciseProgress(progressData: any) {
        const created = await this.prisma.exerciseProgress.create({
            data: {
                sessionId: progressData.session_id,
                profileId: progressData.profile_id || progressData.profileId,
                exerciseKey: progressData.exercise_key,
                levelTarget: progressData.level_target,
                levelResult: progressData.level_result,
                volumeTarget: progressData.volume_target,
                volumeActual: progressData.volume_actual,
                rpe: progressData.rpe ? parseFloat(progressData.rpe) : null,
                notes: progressData.notes,
                decision: progressData.decision,
                streakSuccess: progressData.streak_success || 0,
            },
        });

        const profileId = progressData.profile_id || progressData.profileId || created.profileId;
        await invalidateExerciseCatalogCache(profileId);

        return created;
    }

    async getExerciseProgressHistory(profileId: string, exerciseKey: string, limit = 10) {
        const sessions = await this.prisma.trainingSession.findMany({
            where: { profileId },
            select: { id: true },
        });

        const sessionIds = sessions.map((s: any) => s.id);

        return this.prisma.exerciseProgress.findMany({
            where: {
                sessionId: { in: sessionIds },
                exerciseKey,
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
                session: {
                    select: {
                        plannedAt: true,
                    },
                },
            },
        });
    }

    async getExerciseProgressOverview(profileId: string, { limit = 50 } = {}) {
        const sessions = await this.prisma.trainingSession.findMany({
            where: { profileId },
            select: { id: true },
        });

        const sessionIds = sessions.map((s: any) => s.id);

        const progress = await this.prisma.exerciseProgress.findMany({
            where: {
                sessionId: { in: sessionIds },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
                session: {
                    select: {
                        plannedAt: true,
                    },
                },
            },
        });

        const latestByExercise = new Map();
        for (const item of progress) {
            if (!latestByExercise.has(item.exerciseKey)) {
                latestByExercise.set(item.exerciseKey, item);
            }
        }

        return Array.from(latestByExercise.values());
    }

    // Metrics operations
    async recordMetric(profileId: string, metricType: string, value: number, unit: string, source = 'bot') {
        return this.prisma.metric.create({
            data: {
                profileId,
                metricType,
                value: value,
                unit,
                source,
            },
        });
    }

    async getLatestMetrics(profileId: string) {
        return this.prisma.metric.findMany({
            where: { profileId },
            orderBy: { recordedAt: 'desc' },
            take: 10,
        });
    }

    // Operation log
    async logOperation(profileId: string | null, action: string, status: string, payloadHash: string | null = null, errorCode: string | null = null) {
        try {
            return this.prisma.operationLog.create({
                data: {
                    profileId: profileId || null,
                    action,
                    status,
                    payloadHash,
                    errorCode,
                },
            });
        } catch (error) {
            console.error('Error logging operation:', error);
            return null;
        }
    }

    // Observability events
    async logEvent(profileId: string | null, category: string, severity: string, payload: any, traceId: string | null = null) {
        try {
            return this.prisma.observabilityEvent.create({
                data: {
                    profileId: profileId || null,
                    category,
                    severity,
                    payload,
                    traceId: traceId || null,
                },
            });
        } catch (error) {
            console.error('Error logging event:', error);
            return null;
        }
    }

    async logDialogEvent(profileId: string | null, eventType: string, payload: any = {}, options: any = {}) {
        try {
            return this.prisma.dialogEvent.create({
                data: {
                    profileId: profileId || null,
                    eventType,
                    payload,
                    abGroup: options.abGroup || null,
                    responseLatencyMs: options.responseLatencyMs || null,
                },
            });
        } catch (error) {
            console.error('Error logging dialog event:', error);
            return null;
        }
    }

    // Dialog states
    async saveDialogState(profileId: string, stateType: string, statePayload: any, expiresAt: Date | null = null) {
        return this.prisma.dialogState.upsert({
            where: {
                profileId_stateType: {
                    profileId,
                    stateType,
                },
            },
            update: {
                statePayload,
                expiresAt,
                updatedAt: new Date(),
            },
            create: {
                profileId,
                stateType,
                statePayload,
                expiresAt,
            },
        });
    }

    async getDialogState(profileId: string, stateType: string) {
        return this.prisma.dialogState.findUnique({
            where: {
                profileId_stateType: {
                    profileId,
                    stateType,
                },
            },
        });
    }

    async clearDialogState(profileId: string, stateType: string) {
        return this.prisma.dialogState.deleteMany({
            where: {
                profileId,
                stateType,
            },
        });
    }

    async mergeDialogState(profileId: string, stateType: string, updater: any) {
        const existing = await this.getDialogState(profileId, stateType);
        const basePayload = typeof existing?.statePayload === 'object' && existing?.statePayload !== null
            ? existing.statePayload as Record<string, any>
            : {};
        const nextPayload = typeof updater === 'function'
            ? updater(basePayload) ?? basePayload
            : {
                ...basePayload,
                ...(typeof updater === 'object' && updater !== null ? updater : {}),
            };

        return this.saveDialogState(
            profileId,
            stateType,
            nextPayload,
            existing?.expiresAt || null
        );
    }

    async saveAssistantNote(profileId: string, noteData: any) {
        if (!noteData.content || !noteData.content.trim()) {
            throw new Error('Note content is required');
        }

        const note = await this.prisma.assistantNote.create({
            data: {
                profileId,
                title: noteData.title || null,
                content: noteData.content.trim(),
                tags: noteData.tags || [],
                source: noteData.source || 'chat',
                metadata: noteData.metadata || {},
            },
        });

        await invalidateAssistantNotesCache(profileId);

        return note;
    }

    async getAssistantNotes(profileId: string, { limit = 20, offset = 0 } = {}) {
        return rememberCachedResource('assistantNotesPage', { profileId, limit, offset }, async () => {
            const noteFilter = {
                profileId,
                NOT: {
                    metadata: {
                        path: ['archived'],
                        equals: true,
                    },
                },
            };

            const [notes, total] = await this.prisma.$transaction([
                this.prisma.assistantNote.findMany({
                    select: assistantNoteSummarySelect,
                    where: noteFilter,
                    orderBy: { createdAt: 'desc' },
                    skip: offset,
                    take: limit,
                }),
                this.prisma.assistantNote.count({ where: noteFilter }),
            ]);

            return { notes, total };
        });
    }

    async getRecentAssistantNotes(profileId: string, { limit = 5 } = {}) {
        const { notes } = await this.getAssistantNotes(profileId, { limit, offset: 0 });
        return notes;
    }

    async getAchievements(profileId: string, { limit = 5 } = {}) {
        return this.prisma.achievement.findMany({
            select: achievementSummarySelect,
            where: { profileId },
            orderBy: { awardedAt: 'desc' },
            take: limit,
        });
    }

    async findInactiveAssistantChats({ thresholdMinutes, limit }: { thresholdMinutes: number; limit: number }) {
        const now = new Date();
        const threshold = new Date(now.getTime() - thresholdMinutes * 60 * 1000);

        const states = await this.prisma.dialogState.findMany({
            where: {
                stateType: 'assistant_session',
                OR: [
                    { updatedAt: { lt: threshold } },
                    { expiresAt: { lt: now } },
                ],
                NOT: {
                    statePayload: {
                        path: ['session_status'],
                        equals: 'closed',
                    },
                },
            },
            orderBy: { updatedAt: 'asc' },
            take: limit,
            select: {
                id: true,
                profileId: true,
                statePayload: true,
                updatedAt: true,
                expiresAt: true,
            },
        }) as AssistantDialogStateRecord[];

        return states.map((state) => ({
            state_id: state.id,
            profile_id: state.profileId,
            state_payload: state.statePayload,
            updated_at: state.updatedAt,
            expires_at: state.expiresAt ?? null,
        }));
    }

    async markAssistantSessionClosed(profileId: string, payload: { reason: string; summary?: any }) {
        const now = new Date();
        const nowIso = now.toISOString();
        const existing = await this.getDialogState(profileId, 'assistant_session');
        const basePayload = typeof existing?.statePayload === 'object' && existing?.statePayload !== null
            ? { ...(existing.statePayload as Record<string, any>) }
            : {};

        delete (basePayload as any).messages;

        const nextPayload = {
            ...basePayload,
            session_status: 'closed',
            closed_at: nowIso,
            closed_reason: payload.reason,
            closed_summary: payload.summary ?? null,
            last_updated_at: nowIso,
        };

        await this.saveDialogState(
            profileId,
            'assistant_session',
            nextPayload,
            addDays(now, 1),
        );

        await this.logEvent(profileId, 'assistant_session_closed', 'info', {
            ...payload,
            closed_at: nowIso,
        });
    }

    async getAdherenceSummary(profileId: string) {
        const thirtyDaysAgo = format(addDays(new Date(), -30), 'yyyy-MM-dd');

        const sessions = await this.prisma.trainingSession.findMany({
            where: {
                profileId,
                plannedAt: { gte: new Date(thirtyDaysAgo) },
            },
            select: { status: true },
        });

        const total = sessions.length;
        const completed = sessions.filter((item: any) => item.status === 'done').length;
        const adherence = total === 0 ? 0 : Math.round((completed / total) * 100);

        return {
            window: '30d',
            total_sessions: total,
            completed_sessions: completed,
            adherence_percent: adherence,
        };
    }

    async calculateProgressionDecision(profileId: string, session: any) {
        const endDate = session?.plannedAt || new Date().toISOString();
        const history = await this.getTrainingSessions(profileId, {
            endDate: format(new Date(endDate), 'yyyy-MM-dd'),
        });

        const recent = history.slice(0, 6);
        const completionRates: number[] = recent.map(item => (item.status === 'done' ? 1 : 0));
        const completionRatio = completionRates.length
            ? completionRates.reduce((acc, value) => acc + value, 0) / completionRates.length
            : 0;

        let decision = 'hold';
        let nextSteps = 'Держим текущую прогрессию. Продолжай в том же духе!';

        if (completionRatio > 0.8) {
            decision = 'advance';
            nextSteps = 'Можно усложнить следующую тренировку: добавим подход или усложним уровень.';
        } else if (completionRatio < 0.5) {
            decision = 'adjust_focus';
            nextSteps = 'Часто пропуски — скорректируем расписание и нагрузку, чтобы упростить вход.';
        }

        return { decision, next_steps: nextSteps };
    }

    async getVolumeTrend(profileId: string, startDate: Date) {
        const summaries = await fetchSessionVolumeSummaries(this.prisma, profileId, startDate);

        if (!summaries.length) {
            return {
                chart: [],
                summary: {
                    total_volume: 0,
                    average_volume: 0,
                    period_sessions: 0,
                },
            };
        }

        const chart = summaries.map((summary: SessionVolumeSummary) => ({
            date: format(summary.sessionDate, 'yyyy-MM-dd'),
            volume: summary.totalVolume,
            status: summary.status,
        }));

        const totalVolume = chart.reduce((acc: number, point: { volume: number }) => acc + point.volume, 0);
        const averageVolume = chart.length ? Math.round(totalVolume / chart.length) : 0;

        return {
            chart,
            summary: {
                total_volume: totalVolume,
                average_volume: averageVolume,
                period_sessions: chart.length,
            },
        };
    }

    async getRpeDistribution(profileId: string, startDate: Date) {
        const bucketCounts = await fetchRpeDistributionBuckets(this.prisma, profileId, startDate);
        const buckets = [
            { key: 'light', label: 'Лёгкие (1-4)' },
            { key: 'moderate', label: 'Средние (5-7)' },
            { key: 'heavy', label: 'Тяжёлые (8-9)' },
            { key: 'max', label: 'Предельные (9-10)' },
        ] as const;

        const chart = buckets.map((bucket) => ({
            label: bucket.label,
            value: bucketCounts.get(bucket.key) ?? 0,
        }));

        const total = chart.reduce((acc, entry) => acc + entry.value, 0);
        const heavyCount = bucketCounts.get('heavy') ?? 0;
        const lightCount = bucketCounts.get('light') ?? 0;

        return {
            chart,
            summary: {
                total_sessions: total,
                heavy_share: total ? Math.round((heavyCount / total) * 100) : 0,
                light_share: total ? Math.round((lightCount / total) * 100) : 0,
            },
        };
    }

    // Training disciplines
    async getTrainingDisciplines(activeOnly = true) {
        return this.prisma.trainingDiscipline.findMany({
            where: activeOnly ? { isActive: true } : {},
            orderBy: { name: 'asc' },
        });
    }

    // Training programs
    async getTrainingPrograms(disciplineId: string | null = null, activeOnly = true) {
        const where: any = {};
        if (disciplineId) {
            where.disciplineId = disciplineId;
        }
        if (activeOnly) {
            where.isActive = true;
        }

        return this.prisma.trainingProgram.findMany({
            where,
            orderBy: { name: 'asc' },
        });
    }

    // Exercise levels
    async getExerciseLevels(exerciseKey: string) {
        const levels = await this.prisma.exerciseLevel.findMany({
            where: {
                exerciseKey,
                isActive: true,
            },
            orderBy: [
                { level: 'asc' },
            ],
        });

        // Sort properly by level group and sublevel
        return levels.sort((a: any, b: any) => {
            const [aGroup, aSub] = a.level.split('.').map(Number);
            const [bGroup, bSub] = b.level.split('.').map(Number);

            if (aGroup !== bGroup) {
                return aGroup - bGroup;
            }
            return aSub - bSub;
        });
    }

    async getAiTemplates(category: string, { tag, limit = 10 }: any = {}) {
        // This would require an ai_templates table in Prisma schema
        // For now, return empty array
        return [];
    }
}

function sanitizeNotes(notes: string | null | undefined): string | null {
    if (!notes || typeof notes !== 'string') {
        return null;
    }
    return notes.slice(0, 1000);
}

