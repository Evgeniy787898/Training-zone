import { Router } from 'express';
import { getTraceId } from '../services/trace.js';
import { getCacheLayerSnapshot } from '../modules/infrastructure/cache.js';
import { respondWithSuccess } from '../utils/apiResponses.js';

const cacheRouter = Router();

cacheRouter.get('/status', (_req, res) => {
    const snapshot = getCacheLayerSnapshot();

    return respondWithSuccess(res, snapshot, {
        meta: { traceId: getTraceId() ?? undefined, resource: 'cache:status' },
    });
});

export default cacheRouter;
