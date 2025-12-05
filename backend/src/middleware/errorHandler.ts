import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError, isAppError, normalizeToAppError } from '../services/errors.js';
import { respondWithAppError, respondWithDatabaseUnavailable } from '../utils/apiResponses.js';
import { logHttpError } from '../services/logger.js';
import { ensureTraceId, getTraceId } from '../services/trace.js';
import { recordMonitoringEvent } from '../modules/infrastructure/monitoring.js';
import type { MonitoringSeverity } from '../types/monitoring.js';
import { isPrismaError, isValidationLibraryError } from '../utils/typeGuards.js';
import fs from 'fs';
import path from 'path';

interface ErrorHandlerOptions {
    defaultBodyLimit: number;
    describeBodySize: (bytes: number) => string;
}

const resolveTraceId = (req: Request, res: Response) => {
    const traceId = ensureTraceId(req.traceId ?? req.header('x-trace-id') ?? getTraceId());
    req.traceId = traceId;
    res.setHeader('x-trace-id', traceId);
    return traceId;
};

const normalizeResource = (req: Request) => {
    const base = req.baseUrl || req.path || 'http_request';
    if (base.startsWith('/api/')) {
        return base.replace('/api/', '');
    }
    if (base.startsWith('/')) {
        return base.slice(1) || 'http_request';
    }
    return base;
};

const buildPayloadTooLargeError = (limit: number, describeBodySize: (bytes: number) => string) =>
    new AppError({
        message: `Request body exceeds the maximum allowed size (${describeBodySize(limit)})`,
        code: 'payload_too_large',
        statusCode: 413,
        category: 'validation',
        details: { limitBytes: limit },
        exposeDetails: true,
    });

const timeoutErrorCodes = new Set(['ETIMEDOUT', 'ESOCKETTIMEDOUT', 'ECONNABORTED', 'ERR_REQUEST_TIMEOUT']);
const timeoutErrorNames = new Set(['TimeoutError', 'AbortError']);
const timeoutMessageIndicators = ['timeout', 'timed out', 'time out', 'took too long'];

const isTimeoutLikeError = (error: any) => {
    if (!error) {
        return false;
    }
    const code = typeof error.code === 'string' ? error.code : undefined;
    if (code && timeoutErrorCodes.has(code)) {
        return true;
    }
    const name = typeof error.name === 'string' ? error.name : undefined;
    if (name && timeoutErrorNames.has(name)) {
        return true;
    }
    const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
    if (!message) {
        return false;
    }
    return timeoutMessageIndicators.some((indicator) => message.includes(indicator));
};

const buildDependencyTimeoutError = () =>
    new AppError({
        message: 'Внешний сервис превысил максимальное время ожидания',
        code: 'dependency_timeout',
        statusCode: 504,
        category: 'dependencies',
        userMessage: 'Сервис временно недоступен. Пожалуйста, попробуйте позже.',
    });

const maybeAlertCriticalError = (
    err: unknown,
    req: Request,
    traceId: string,
    resource: string,
    overrides?: { category?: string; severity?: MonitoringSeverity; metadata?: Record<string, unknown> },
) => {
    const appError = isAppError(err) ? err : undefined;
    const statusCode = overrides?.metadata?.statusCode
        ? Number(overrides.metadata.statusCode)
        : appError?.statusCode ?? (typeof (err as any)?.status === 'number' ? (err as any).status : undefined);

    if ((statusCode ?? 0) < 500) {
        return;
    }

    void recordMonitoringEvent(req.prisma, {
        category: overrides?.category || appError?.category || 'internal',
        severity: overrides?.severity || 'critical',
        message: appError?.message || (err instanceof Error ? err.message : 'Unhandled error'),
        traceId,
        profileId: req.profileId ?? req.profile?.id ?? null,
        resource,
        metadata: {
            method: req.method,
            path: req.originalUrl || req.url,
            statusCode: statusCode ?? 500,
            code: appError?.code ?? (err as any)?.code,
            classification: appError?.classification,
            ...overrides?.metadata,
        },
        error: isAppError(err) ? undefined : err,
    });

    // DEBUG: Write to file (synchronously)
    try {
        const logFile = path.resolve(process.cwd(), 'logs/error-debug.log');
        const timestamp = new Date().toISOString();
        const errorDetails = JSON.stringify({
            timestamp,
            path: req.originalUrl,
            method: req.method,
            statusCode,
            message: appError?.message || (err instanceof Error ? err.message : 'Unknown error'),
            stack: err instanceof Error ? err.stack : undefined,
            code: (err as any)?.code,
        }, null, 2);
        fs.appendFileSync(logFile, errorDetails + '\n---\n');
    } catch (e) {
        console.error('Failed to write to debug log', e);
    }
};

export const createErrorHandler = (options: ErrorHandlerOptions): ErrorRequestHandler => {
    return (err: any, req: Request, res: Response, next: NextFunction) => {
        if (!err) {
            return next();
        }

        const traceId = resolveTraceId(req, res);
        const resource = normalizeResource(req);

        if (err?.type === 'entity.too.large' || err?.status === 413) {
            const limit = Number(res.locals?.maxBodySize ?? options.defaultBodyLimit);
            const appError = buildPayloadTooLargeError(limit, options.describeBodySize);
            logHttpError(appError, req, { traceId, resource });
            return respondWithAppError(res, appError, { traceId, resource });
        }

        if (isPrismaError(err)) {
            logHttpError(err, req, { traceId, resource, category: 'database', classification: 'database' });
            maybeAlertCriticalError(err, req, traceId, resource, {
                category: 'database',
                metadata: { code: err.code, statusCode: 503 },
            });
            return respondWithDatabaseUnavailable(res, resource, {
                traceId,
                details: { code: err.code, target: err?.meta?.target },
            });
        }

        if (isTimeoutLikeError(err)) {
            const appError = buildDependencyTimeoutError();
            logHttpError(appError, req, { traceId, resource, category: 'dependencies', classification: 'database' });
            maybeAlertCriticalError(appError, req, traceId, resource, {
                category: 'dependencies',
                metadata: { statusCode: 504, code: (err as any)?.code },
            });
            return respondWithAppError(res, appError, { traceId, resource });
        }

        if (err instanceof ZodError) {
            const appError = new AppError({
                message: 'Некорректные данные',
                code: 'validation_error',
                category: 'validation',
                statusCode: 400,
                details: err.issues,
                exposeDetails: true,
            });
            logHttpError(appError, req, { traceId, resource });
            return respondWithAppError(res, appError, { traceId, resource });
        }

        if (isValidationLibraryError(err)) {
            const appError = new AppError({
                message: err.message || 'Некорректные данные',
                code: 'validation_error',
                category: 'validation',
                statusCode: 400,
                exposeDetails: true,
            });
            logHttpError(appError, req, { traceId, resource });
            return respondWithAppError(res, appError, { traceId, resource });
        }

        const normalized = normalizeToAppError(err, {
            message: 'Внутренняя ошибка сервера',
            code: 'internal_error',
            statusCode: err?.status || err?.statusCode || 500,
        });

        // DEBUG: Log full error to console
        console.error('========== ERROR 500 ==========');
        console.error('Path:', req.originalUrl);
        console.error('Method:', req.method);
        console.error('Message:', normalized.message);
        console.error('Stack:', err instanceof Error ? err.stack : 'No stack');
        console.error('================================');

        logHttpError(normalized, req, { traceId, resource });
        maybeAlertCriticalError(normalized, req, traceId, resource);
        return respondWithAppError(res, normalized, { traceId, resource });
    };
};
