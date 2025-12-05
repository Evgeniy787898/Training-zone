import { Router } from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validateRequest.js';
import { respondWithSuccess } from '../utils/apiResponses.js';
import { ingestWebVital } from '../services/metricsIngestion.js';

const webVitalSchema = z.object({
    metric: z.enum(['CLS', 'FID', 'INP', 'LCP', 'TTFB', 'FCP']),
    value: z.number(),
    rating: z.enum(['good', 'needs-improvement', 'poor']),
    navigationType: z.string().optional(),
    page: z.string().optional(),
    sessionId: z.string().optional(),
    timestamp: z.number().int(),
});

const metricsRouter = Router();

metricsRouter.post(
    '/web-vitals',
    validateRequest({ body: webVitalSchema }),
    async (req, res) => {
        const payload = (req.validated?.body as z.infer<typeof webVitalSchema>) ?? req.body;

        ingestWebVital(payload, { resource: payload.page ?? req.path });

        return respondWithSuccess(
            res,
            { accepted: true },
            { meta: { traceId: req.traceId ?? undefined, resource: 'metrics:web-vitals' } },
        );
    },
);

export default metricsRouter;
