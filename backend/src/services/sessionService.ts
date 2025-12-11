import { addDays, endOfDay, isValid, parseISO, startOfDay, startOfWeek } from 'date-fns';

import { AppError } from './errors.js';
import { ensureOwnedByProfile } from '../modules/security/accessControl.js';
import { invalidateSessionDerivedCaches } from '../modules/infrastructure/cacheInvalidation.js';
import type { OwnershipAssertionOptions } from '../types/accessControl.js';
import type { SessionRepository } from '../repositories/sessionRepository.js';
import type {
    CreateSessionPayload,
    SessionIdParams,
    SessionsDateQuery,
    StructuredNotes,
    UpdateSessionPayload,
} from '../types/api/shared.js';
import { isStructuredNotes } from '../utils/typeGuards.js';

export { isSessionsDataUnavailableError } from '../repositories/sessionRepository.js';

/**
 * Structured notes are JSON payloads that encode plan/program context for a
 * training session.  We frequently receive them from the UI as strings so the
 * helper below centralizes validation and telemetry for malformed payloads.
 */
const parseStructuredNotes = (notes: unknown): StructuredNotes | null => {
    if (typeof notes !== 'string') {
        return null;
    }
    try {
        const parsed = JSON.parse(notes);
        if (isStructuredNotes(parsed)) {
            return parsed;
        }
        console.warn('[sessions] Structured notes payload failed validation');
    } catch (error) {
        console.warn('[sessions] Failed to parse structured notes:', error);
    }
    return null;
};

/**
 * Sessions can be scheduled with or without the precise timestamp.  We prepare
 * both variants up front because Prisma rejects partial updates when the
 * timestamp is missing.  The repository chooses the correct assignment based on
 * the available indexes.
 */
const buildPlannedAssignments = (plannedAt: Date | null | undefined) => {
    if (!plannedAt) {
        return {
            withPlanned: {},
            withDateOnly: {},
        };
    }

    return {
        withPlanned: { plannedAt },
        withDateOnly: { plannedAt },
    };
};

const buildInvalidDateError = () =>
    new AppError({
        code: 'invalid_date',
        message: 'Некорректная дата запроса',
        statusCode: 400,
        category: 'validation',
    });

const buildSessionNotFoundError = () =>
    new AppError({
        code: 'session_not_found',
        message: 'Тренировка не найдена',
        statusCode: 404,
        category: 'not_found',
    });

/**
 * SessionService contains the core business logic for creating, updating, and
 * fetching training sessions.  It guarantees consistent scheduling semantics,
 * structured-note handling, ownership checks, and cache invalidation regardless
 * of which transport (HTTP, Supabase sync, background worker) invokes it.
 */
import type { HistoryService } from './historyService.js';

export class SessionService {
    constructor(
        private readonly repository: SessionRepository,
        private readonly historyService: HistoryService,
    ) { }

    async getSessionForDay(profileId: string, date?: string) {
        const targetDate = date ? parseISO(date) : new Date();
        if (!isValid(targetDate)) {
            throw buildInvalidDateError();
        }

        const dayStart = startOfDay(targetDate);
        const dayEnd = endOfDay(targetDate);

        console.log('[sessions/today] Query params:', {
            profileId,
            dayStart: dayStart.toISOString(),
            dayEnd: dayEnd.toISOString(),
        });

        const sessions = await this.repository.fetchSessionsWithinRange(profileId, dayStart, dayEnd);
        const hydrated = await this.repository.hydrateSessions(sessions || []);
        return { session: hydrated[0] ?? null, dayStart, dayEnd };
    }

    async getWeekSessions(profileId: string, date?: string) {
        const referenceDate = date ? parseISO(date) : new Date();
        if (!isValid(referenceDate)) {
            throw buildInvalidDateError();
        }

        const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
        const weekEnd = addDays(weekStart, 6);

        const sessions = await this.repository.fetchSessionsWithinRange(profileId, weekStart, weekEnd);
        const hydrated = await this.repository.hydrateSessions(sessions);

        return { weekStart, weekEnd, sessions: hydrated };
    }

    async getSessionById(
        profileId: string,
        sessionId: string,
        ownership?: OwnershipAssertionOptions,
    ) {
        const session = await this.repository.findSessionById(sessionId);

        if (!session) {
            throw buildSessionNotFoundError();
        }

        ensureOwnedByProfile(session, profileId, ownership ?? {
            resource: 'training_session',
            resourceId: sessionId,
            action: 'read',
        });

        const [hydrated] = await this.repository.hydrateSessions([session]);
        return hydrated ?? session;
    }

    /**
     * Upserts a session for the requested `planned_at` timestamp.  We first try
     * to parse structured notes so both new and existing sessions can have their
     * derived exercise rows kept in sync.  When a session already exists we
     * update it in-place; otherwise we create a new record with scheduling
     * fallbacks and hydrate it before returning.
     */
    async saveSession(profileId: string, payload: CreateSessionPayload) {
        if (typeof payload.planned_at !== 'string') {
            throw buildInvalidDateError();
        }

        const plannedTimestamp = new Date(payload.planned_at);
        const { withPlanned, withDateOnly } = buildPlannedAssignments(plannedTimestamp);
        const existingSession = await this.repository.findSessionByPlannedTimestamp(
            profileId,
            plannedTimestamp,
        );

        const structuredNotes = parseStructuredNotes(payload.notes ?? existingSession?.notes ?? null);
        const { sessionData: structuredData, exercises } = await this.repository.deriveStructuredSessionData(
            structuredNotes,
            profileId,
        );

        if (existingSession) {
            const updateBase: Record<string, any> = {
                status: payload.status || existingSession.status,
                notes: payload.notes ?? existingSession.notes,
                ...structuredData,
                updatedAt: new Date(),
            };

            const updatedSession = await this.repository.updateSessionWithSchedulingFallback(
                existingSession.id,
                { ...updateBase, ...withPlanned },
                { ...updateBase, ...withDateOnly },
            );

            if (structuredNotes) {
                await this.repository.syncSessionExercises(updatedSession.id, profileId, exercises);
            }

            const [hydrated] = await this.repository.hydrateSessions([updatedSession]);
            await invalidateSessionDerivedCaches(profileId);
            return hydrated ?? updatedSession;
        }

        const sessionBase: any = {
            profileId,
            status: payload.status || 'done',
            notes: payload.notes,
            ...structuredData,
        };

        const newSession = await this.repository.createSessionWithSchedulingFallback(
            { ...sessionBase, ...withPlanned },
            { ...sessionBase, ...withDateOnly },
        );

        if (structuredNotes) {
            await this.repository.syncSessionExercises(newSession.id, profileId, exercises);
        }

        const [hydrated] = await this.repository.hydrateSessions([newSession]);
        await invalidateSessionDerivedCaches(profileId);
        return hydrated ?? newSession;
    }

    /**
     * Updates a specific session by id while re-running ownership assertions
     * and structured-note derivations.  We also keep the historical schedule
     * intact unless the payload requests a new planned timestamp.
     */
    async updateSession(
        profileId: string,
        sessionId: string,
        payload: UpdateSessionPayload,
        ownership?: OwnershipAssertionOptions,
    ) {
        const session = await this.repository.findSessionById(sessionId);

        if (!session) {
            throw buildSessionNotFoundError();
        }

        ensureOwnedByProfile(session, profileId, ownership ?? {
            resource: 'training_session',
            resourceId: sessionId,
            action: 'update',
        });

        const structuredNotes = parseStructuredNotes(payload.notes ?? session.notes ?? null);
        const { sessionData: structuredData, exercises } = await this.repository.deriveStructuredSessionData(
            structuredNotes,
            profileId,
        );

        const updates: any = {
            status: payload.status ?? session.status,
            notes: payload.notes ?? session.notes,
            updatedAt: new Date(),
            ...structuredData,
        };

        let plannedTimestamp: Date | null = null;
        if (typeof payload.planned_at === 'string') {
            plannedTimestamp = new Date(payload.planned_at);
        } else if (payload.planned_at !== undefined) {
            throw buildInvalidDateError();
        }
        const { withPlanned, withDateOnly } = buildPlannedAssignments(plannedTimestamp);

        const updatedSession = await this.repository.updateSessionWithSchedulingFallback(
            session.id,
            { ...updates, ...withPlanned },
            { ...updates, ...(plannedTimestamp ? withDateOnly : {}) },
        );

        await this.historyService.logChange(
            profileId,
            'TrainingSession',
            sessionId,
            'UPDATE',
            session,
            updatedSession
        );

        if (structuredNotes) {
            await this.repository.syncSessionExercises(updatedSession.id, profileId, exercises);
        }

        const [hydrated] = await this.repository.hydrateSessions([updatedSession]);
        await invalidateSessionDerivedCaches(profileId);
        return hydrated ?? updatedSession;
    }

    /**
     * Deletes a session after asserting ownership and then invalidates all
     * cache entries that depend on the user’s training history (profile summary,
     * reports, catalogs, etc.).
     */
    async deleteSession(
        profileId: string,
        sessionId: string,
        ownership?: OwnershipAssertionOptions,
    ) {
        const session = await this.repository.findSessionById(sessionId);

        if (!session) {
            throw buildSessionNotFoundError();
        }

        ensureOwnedByProfile(session, profileId, ownership ?? {
            resource: 'training_session',
            resourceId: sessionId,
            action: 'delete',
        });

        await this.repository.deleteSession(session.id);
        await invalidateSessionDerivedCaches(profileId);
    }
}
