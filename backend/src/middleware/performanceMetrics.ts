import type { NextFunction, Request, Response } from 'express';
import { recordRequestEnd, recordRequestStart } from '../modules/analytics/performanceMetrics.js';
import { recordSlaSample } from '../services/slaMonitor.js';

const pathFromRequest = (req: Request) => {
    if (req.route?.path) {
        return req.route.path;
    }
    if (typeof req.originalUrl === 'string') {
        const index = req.originalUrl.indexOf('?');
        return index >= 0 ? req.originalUrl.slice(0, index) : req.originalUrl;
    }
    return req.path;
};

export const createPerformanceMetricsMiddleware = () => {
    return (req: Request, res: Response, next: NextFunction) => {
        recordRequestStart();
        const startedAt = process.hrtime.bigint();
        let completed = false;

        const finalize = () => {
            if (completed) {
                return;
            }
            completed = true;
            res.off('finish', onFinish);
            res.off('close', onClose);
            const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
            recordRequestEnd({
                durationMs,
                method: req.method,
                path: pathFromRequest(req),
                route: req.route?.path,
                statusCode: res.statusCode || 0,
                traceId: req.traceId,
            });
            recordSlaSample({
                method: req.method,
                route: req.route?.path,
                statusCode: res.statusCode || 0,
                durationMs,
            });
        };

        const onFinish = () => finalize();
        const onClose = () => finalize();

        res.on('finish', onFinish);
        res.on('close', onClose);

        next();
    };
};
