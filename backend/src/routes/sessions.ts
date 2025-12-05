import { addDays, format, isValid, parseISO, startOfWeek } from 'date-fns';
import { Request, Response, Router } from 'express';

import { validateRequest } from '../middleware/validateRequest.js';
import {
    respondWithAppError,
    respondWithDatabaseUnavailable,
    respondWithSuccess,
} from '../utils/apiResponses.js';
import { respondAuthRequired } from '../utils/auth.js';
import { AppError } from '../services/errors.js';
import { isAccessDeniedError } from '../modules/security/accessControl.js';
import type { ServiceContainer } from '../setup/servicesSetup.js';
import type { SessionService } from '../modules/sessions/application/sessionService.js';
import {
    createSessionSchema,
    sessionIdParamsSchema,
    sessionsDateQuerySchema,
    updateSessionSchema,
    type CreateSessionPayload,
    type SessionIdParams,
    type SessionsDateQuery,
    type UpdateSessionPayload,
} from '../contracts/session.js';
import type {
    SessionDeleteResponse,
    SessionSingleResponse,
    SessionTodayResponse,
    SessionWeekResponse,
} from '../types/apiResponses.js';

export function createSessionsRouter(sessionService: SessionService) {
    const router = Router();


    const buildRequestMeta = (req: Request) => (req.traceId ? { traceId: req.traceId } : undefined);
    // GET /api/sessions/today
    router.get('/today', validateRequest({ query: sessionsDateQuerySchema }), async (req: Request, res: Response, next) => {
        try {
            if (!req.profileId) {
                return respondAuthRequired(req, res);
            }

            const service = sessionService;

            const { date } = (req.validated?.query as SessionsDateQuery | undefined) ?? {};
            const { session } = await service.getSessionForDay(req.profileId, date);
            const payload: SessionTodayResponse = {
                session: session as SessionTodayResponse['session'],
                source: 'database',
            };

            return respondWithSuccess<SessionTodayResponse>(res, payload, { meta: buildRequestMeta(req) });
        } catch (error) {
            console.error('[sessions/today] Unexpected error:', error);
            if (error instanceof AppError) {
                return respondWithAppError(res, error, { traceId: req.traceId });
            }
            next(error);
        }
    });

    // GET /api/sessions/week
    router.get('/week', validateRequest({ query: sessionsDateQuerySchema }), async (req: Request, res: Response, next) => {
        let fallbackWeekStart: Date | null = null;
        let fallbackWeekEnd: Date | null = null;
        try {
            if (!req.profileId) {
                return respondAuthRequired(req, res);
            }

            const service = sessionService;

            const { date } = (req.validated?.query as SessionsDateQuery | undefined) ?? {};
            if (date) {
                const parsed = parseISO(date);
                if (isValid(parsed)) {
                    fallbackWeekStart = startOfWeek(parsed, { weekStartsOn: 1 });
                    fallbackWeekEnd = addDays(fallbackWeekStart, 6);
                }
            }

            const { weekStart, weekEnd, sessions } = await service.getWeekSessions(req.profileId, date);
            fallbackWeekStart = weekStart;
            fallbackWeekEnd = weekEnd;

            const payload: SessionWeekResponse = {
                week_start: format(weekStart, 'yyyy-MM-dd'),
                week_end: format(weekEnd, 'yyyy-MM-dd'),
                sessions: sessions as SessionWeekResponse['sessions'],
                source: 'database',
            };

            return respondWithSuccess<SessionWeekResponse>(res, payload, { meta: buildRequestMeta(req) });
        } catch (error) {
            console.error('[sessions/week] Unexpected error:', error);
            if (error instanceof AppError) {
                return respondWithAppError(res, error, { traceId: req.traceId });
            }
            next(error);
        }
    });

    // GET /api/sessions/:id
    router.get('/:id', validateRequest({ params: sessionIdParamsSchema }), async (req: Request, res: Response, next) => {
        try {
            if (!req.profileId) {
                return respondAuthRequired(req, res);
            }

            const service = sessionService;

            const session = await service.getSessionById(
                req.profileId,
                (req.validated?.params as SessionIdParams).id,
                {
                    resource: 'training_session',
                    resourceId: (req.validated?.params as SessionIdParams).id,
                    action: 'read',
                    traceId: req.traceId,
                    request: req,
                    message: 'Сессия принадлежит другому профилю',
                },
            );

            const payload: SessionSingleResponse = { session: session as SessionSingleResponse['session'] };
            return respondWithSuccess<SessionSingleResponse>(res, payload, { meta: buildRequestMeta(req) });
        } catch (error) {
            if (error instanceof AppError) {
                return respondWithAppError(res, error, { traceId: req.traceId });
            }
            next(error);
        }
    });

    // POST /api/sessions
    router.post('/', validateRequest({ body: createSessionSchema }), async (req: Request, res: Response, next) => {
        try {
            if (!req.profileId) {
                return respondAuthRequired(req, res);
            }

            const service = sessionService;

            const requestPayload = (req.validated?.body as CreateSessionPayload) ?? {
                planned_at: new Date().toISOString(),
            };

            const session = await service.saveSession(req.profileId, requestPayload);

            const responsePayload: SessionSingleResponse = { session: session as SessionSingleResponse['session'] };
            return respondWithSuccess<SessionSingleResponse>(res, responsePayload, { meta: buildRequestMeta(req) });
        } catch (error) {
            if (error instanceof AppError) {
                return respondWithAppError(res, error, { traceId: req.traceId });
            }
            next(error);
        }
    });

    // PUT /api/sessions/:id
    router.put('/:id', validateRequest({ params: sessionIdParamsSchema, body: updateSessionSchema }), async (req, res, next) => {
        try {
            if (!req.profileId) {
                return respondAuthRequired(req, res);
            }

            const service = sessionService;

            const requestPayload = (req.validated?.body as UpdateSessionPayload) ?? {};
            const sessionId = (req.validated?.params as SessionIdParams).id;

            const session = await service.updateSession(
                req.profileId,
                sessionId,
                requestPayload,
                {
                    resource: 'training_session',
                    resourceId: sessionId,
                    action: 'update',
                    traceId: req.traceId,
                    request: req,
                    message: 'Сессия принадлежит другому профилю',
                },
            );

            const responsePayload: SessionSingleResponse = { session: session as SessionSingleResponse['session'] };
            return respondWithSuccess<SessionSingleResponse>(res, responsePayload, { meta: buildRequestMeta(req) });
        } catch (error) {
            if (isAccessDeniedError(error)) {
                return next(error);
            }
            if (error instanceof AppError) {
                return respondWithAppError(res, error, { traceId: req.traceId });
            }
            next(error);
        }
    });

    // DELETE /api/sessions/:id
    router.delete('/:id', validateRequest({ params: sessionIdParamsSchema }), async (req, res, next) => {
        try {
            if (!req.profileId) {
                return respondAuthRequired(req, res);
            }

            const service = sessionService;

            const sessionId = (req.validated?.params as SessionIdParams).id;

            await service.deleteSession(req.profileId, sessionId, {
                resource: 'training_session',
                resourceId: sessionId,
                action: 'delete',
                traceId: req.traceId,
                request: req,
                message: 'Сессия принадлежит другому профилю',
            });

            const payload: SessionDeleteResponse = { message: 'Тренировка удалена' };
            return respondWithSuccess<SessionDeleteResponse>(res, payload, { meta: buildRequestMeta(req) });
        } catch (error) {
            if (isAccessDeniedError(error)) {
                return next(error);
            }
            if (error instanceof AppError) {
                return respondWithAppError(res, error, { traceId: req.traceId });
            }
            next(error);
        }
    });

    return router;
}

