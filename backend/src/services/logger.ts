import pino from 'pino';
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';

const isDevelopment = process.env.NODE_ENV === 'development';
const logLevel = process.env.LOG_LEVEL || 'info';

export const logger = pino({
    level: logLevel,
    transport: isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
            },
        }
        : undefined,
    formatters: {
        level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
});

export const requestLogger = pinoHttp({
    logger,
    genReqId: (req: Request) => {
        if (req.headers['x-trace-id']) return req.headers['x-trace-id'] as string;
        if (req.headers['x-request-id']) return req.headers['x-request-id'] as string;
        return randomUUID();
    },
    customProps: (req: Request, res: Response) => {
        return {
            traceId: req.id,
            profileId: (req as any).profileId,
        };
    },
    serializers: {
        req: (req) => ({
            id: req.id,
            method: req.method,
            url: req.url,
            query: req.query,
            params: req.params,
            headers: {
                'user-agent': req.headers['user-agent'],
                'content-type': req.headers['content-type'],
                'x-forwarded-for': req.headers['x-forwarded-for'],
            },
        }),
        res: (res) => {
            const getHeader = (name: string) => {
                // @ts-ignore
                if (typeof res.getHeader === 'function') return res.getHeader(name);
                // @ts-ignore
                if (typeof res.get === 'function') return res.get(name);
                // @ts-ignore
                return res.headers?.[name];
            };
            return {
                statusCode: res.statusCode,
                headers: {
                    'content-type': getHeader('content-type'),
                    'content-length': getHeader('content-length'),
                },
            };
        },
    },
    // Reduce noise in dev
    autoLogging: {
        ignore: (req) => {
            if (isDevelopment) {
                return req.url?.includes('/health') || req.url?.includes('/metrics');
            }
            return false;
        },
    },
});
export const logHttpError = (error: unknown, req?: Request, context?: Record<string, unknown>) => {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error({
        err,
        req: req ? {
            method: req.method,
            url: req.url,
            headers: req.headers,
        } : undefined,
        ...context,
    }, 'HTTP Error');
};
