import type { NextFunction, Request, Response } from 'express';
import { ensureTraceId, runWithTrace } from '../services/trace.js';

const resolveResource = (req: Request): string | undefined => {
    const base = req.baseUrl || req.path;
    if (!base) {
        return undefined;
    }
    if (base.startsWith('/api/')) {
        return base.slice(5) || 'http_request';
    }
    return base.replace(/^\/+/, '') || 'http_request';
};

export const createTraceContextMiddleware = () => (req: Request, res: Response, next: NextFunction) => {
    const traceId = ensureTraceId(req.header('x-trace-id') || req.traceId);
    req.traceId = traceId;
    res.setHeader('x-trace-id', traceId);

    const resource = resolveResource(req);

    return runWithTrace({ traceId, resource }, () => next());
};
