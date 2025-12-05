import { Router, Request, Response } from 'express';
import { ensureTraceId } from '../services/trace.js';
import { getHealthSnapshot } from '../modules/infrastructure/health.js';
import { getMetricsDashboardSnapshot } from '../services/metricsDashboard.js';

const router = Router();

/**
 * Liveness probe - always returns OK
 */
router.get('/health/live', (req: Request, res: Response) => {
    const traceId = ensureTraceId(req.traceId);
    res.setHeader('x-trace-id', traceId);
    res.json({
        status: 'ok',
        service: 'training-area-api',
        timestamp: new Date().toISOString(),
    });
});

/**
 * Readiness probe - checks DB and microservices
 */
async function respondWithHealth(req: Request, res: Response) {
    const traceId = ensureTraceId(req.traceId);
    const prisma = (req as any).prisma;
    const snapshot = await getHealthSnapshot({ prisma: prisma as any, traceId });
    res.setHeader('x-trace-id', traceId);
    res.status(snapshot.status === 'unhealthy' ? 503 : 200).json(snapshot);
}

router.get('/health', respondWithHealth);
router.get('/api/health', respondWithHealth);

/**
 * Metrics dashboard endpoint
 */
router.get('/api/metrics/dashboard', async (req: Request, res: Response) => {
    const traceId = ensureTraceId(req.traceId);
    const prisma = (req as any).prisma;
    const snapshot = await getMetricsDashboardSnapshot(prisma as any, traceId);
    res.setHeader('x-trace-id', traceId);
    res.json(snapshot);
});

export default router;
