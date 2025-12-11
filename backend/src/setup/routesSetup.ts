import type { Express, Request, Response } from 'express';
import { createLazyRouter } from '../utils/lazyRouter.js';
import { profileContextMiddleware } from '../middleware/profileContext.js';
import { createCsrfProtectionMiddleware } from '../middleware/csrfProtection.js';
import { ensureTraceId } from '../services/trace.js';
import { getCachedResource, setCachedResource } from '../modules/infrastructure/cacheStrategy.js';
import { loadActiveTrainingDisciplines, loadTrainingPrograms } from '../modules/training/trainingCatalog.js';
import { respondWithDatabaseUnavailable } from '../utils/apiResponses.js';
import { logger } from '../services/logger.js';

// Route imports
import { createSessionsRouter } from '../routes/sessions.js';
import { createExercisesRouter } from '../routes/exercises.js';
import { createProfileRouter } from '../routes/profile.js';
import reportsRouter from '../routes/reports.js';
import achievementsRouter from '../routes/achievements.js';
import dailyAdviceRouter from '../routes/dailyAdvice.js';
import { createAuthRouter } from '../routes/auth.js';
import assistantRouter from '../routes/assistant.js';
import { createUserProgramsRouter } from '../routes/userPrograms.js';
import mediaRouter from '../routes/media.js';
import microservicesProxy from '../routes/microservicesProxy.js';
import { createProgressRouter } from '../routes/progress.js';
import { createProgressPhotosRouter } from '../routes/progressPhotos.js';
import { createBodyScanRouter } from '../routes/bodyScan.js';
import { createEvolutionRouter } from '../routes/evolution.js';
import analyticsRouter from '../routes/analytics.js';

const PROGRAM_SCHEMA_ERROR_CODES = new Set(['P2021', 'P2022', 'P2010', 'P2003', 'P2000']);

function isProgramSchemaError(error: any) {
    if (!error || typeof error !== 'object') {
        return false;
    }

    const code = typeof error.code === 'string' ? error.code : '';
    if (PROGRAM_SCHEMA_ERROR_CODES.has(code)) {
        return true;
    }

    const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
    if (message.includes('training_programs') || message.includes('training programs')) {
        return true;
    }

    const metaTarget = typeof error.meta?.target === 'string' ? error.meta.target.toLowerCase() : '';
    if (metaTarget.includes('training_programs') || metaTarget.includes('training programs')) {
        return true;
    }

    return false;
}

import type { ServiceContainer } from './servicesSetup.js';

/**
 * Setup all routes for the Express app
 */
export function setupRoutes(app: Express, prisma: any, services: ServiceContainer) {
    // Lazy-loaded public routes
    const openApiRouter = createLazyRouter(async () => import('../routes/openapi.js'));
    const metricsRouter = createLazyRouter(async () => import('../routes/metrics.js'));
    const cacheRouter = createLazyRouter(async () => import('../routes/cache.js'));

    // Public routes
    app.use('/api/auth', createAuthRouter(services.profileService, services.refreshTokenService, services.auditService));
    app.use('/api/media', mediaRouter);
    app.use('/api/cache', cacheRouter);
    app.use('/api/metrics', metricsRouter);
    app.use('/api', openApiRouter);

    // Training disciplines endpoint
    app.get('/api/training-disciplines', async (req: Request, res: Response) => {
        const traceId = ensureTraceId(req.traceId);
        try {
            if (!prisma) {
                res.setHeader('x-trace-id', traceId);
                return respondWithDatabaseUnavailable(res, 'training_disciplines', { traceId });
            }

            const cached = await getCachedResource<any[], 'trainingDisciplines'>(
                'trainingDisciplines',
                {} as Record<string, never>,
            );
            if (cached) {
                res.setHeader('x-cache', 'hit');
                res.setHeader('x-trace-id', traceId);
                return res.json(cached);
            }

            const disciplines = await loadActiveTrainingDisciplines(prisma);

            await setCachedResource('trainingDisciplines', {} as Record<string, never>, disciplines);
            res.setHeader('x-cache', 'miss');
            res.setHeader('x-trace-id', traceId);
            res.json(disciplines);
        } catch (error: any) {
            logger.error({ err: error }, '[training-disciplines] Error');
            res.setHeader('x-trace-id', traceId);
            return respondWithDatabaseUnavailable(res, 'training_disciplines', { traceId });
        }
    });

    // Training programs endpoint
    app.get('/api/training-programs', async (req: Request, res: Response) => {
        const traceId = ensureTraceId(req.traceId);
        const startTime = Date.now();
        try {
            if (!prisma) {
                res.setHeader('x-trace-id', traceId);
                return respondWithDatabaseUnavailable(res, 'training_programs', { traceId });
            }

            const { discipline_id } = req.query;
            const disciplineId = typeof discipline_id === 'string' ? discipline_id : undefined;

            const cacheParams = { disciplineId };
            const cached = await getCachedResource<any[], 'trainingPrograms'>('trainingPrograms', cacheParams);
            if (cached) {
                res.setHeader('x-cache', 'hit');
                res.setHeader('x-trace-id', traceId);
                return res.json(cached);
            }

            const queryStartTime = Date.now();
            const programs = await loadTrainingPrograms(prisma, { disciplineId });

            const queryTime = Date.now() - queryStartTime;
            const totalTime = Date.now() - startTime;
            logger.info(
                `[training-programs] Query completed in ${queryTime}ms, total: ${totalTime}ms, found ${programs.length} programs${disciplineId ? ` for discipline ${disciplineId}` : ''}`,
            );

            await setCachedResource('trainingPrograms', cacheParams, programs);
            res.setHeader('x-cache', 'miss');
            res.setHeader('x-trace-id', traceId);
            res.json(programs);
        } catch (error: any) {
            logger.error({ err: error }, '[training-programs] Error');

            if (isProgramSchemaError(error)) {
                logger.warn({ err: error }, '[training-programs] Schema unavailable');
                res.setHeader('x-trace-id', traceId);
                return respondWithDatabaseUnavailable(res, 'training_programs', {
                    traceId,
                    details: { stage: 'schema_validation' },
                });
            }

            res.setHeader('x-trace-id', traceId);
            return respondWithDatabaseUnavailable(res, 'training_programs', { traceId });
        }
    });

    // Auth middleware for protected routes
    app.use('/api', profileContextMiddleware(prisma));
    app.use(
        '/api',
        createCsrfProtectionMiddleware({
            ignoredPaths: [
                '/api/auth/refresh',
                '/api/auth/logout',
                '/api/internal/image-processor',
                '/api/internal/ai-advisor',
                '/api/internal/analytics',
            ],
        }),
    );

    // Protected routes
    app.use('/api/sessions', createSessionsRouter(services.sessionService));
    app.use('/api/profile', createProfileRouter(services.profileService));
    app.use('/api/reports', reportsRouter);
    app.use('/api/exercises', createExercisesRouter(services.exerciseService, services.favoritesService));
    app.use('/api/achievements', achievementsRouter);
    app.use('/api/daily-advice', dailyAdviceRouter);
    app.use('/api/assistant', assistantRouter);
    app.use('/api/user-programs', createUserProgramsRouter(services.userProgramService));
    app.use('/api/progress', createProgressRouter(prisma));
    app.use('/api/progress-photos', createProgressPhotosRouter(services.progressPhotoService));
    app.use('/api/body-scan', createBodyScanRouter(services.bodyScanService));
    app.use('/api/evolution', createEvolutionRouter(services.evolutionService));

    // Microservices proxy
    app.use(microservicesProxy);

    // Analytics (visualizations)
    app.use('/api/analytics', analyticsRouter);

    // 404 handler
    app.use((req: Request, res: Response) => {
        res.status(404).json({ error: 'not_found', message: 'Endpoint not found' });
    });
}
