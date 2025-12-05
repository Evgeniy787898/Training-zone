import type { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import express from 'express';
import { createTraceContextMiddleware } from '../middleware/traceContext.js';
import { createRequestTimeoutMiddleware } from '../middleware/requestTimeout.js';
import { createPerformanceMetricsMiddleware } from '../middleware/performanceMetrics.js';
import { createContentSecurityPolicyMiddleware } from '../middleware/contentSecurityPolicy.js';
import { createCompressionMiddleware } from '../middleware/compression.js';
import { createUrlInputValidationMiddleware } from '../middleware/urlInputValidation.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import { createDatabaseAvailabilityMiddleware } from '../middleware/databaseAvailability.js';
import { requestLogger, logger } from '../services/logger.js';
import { bodySizeLimits, describeBodySize, resolveBodyLimitForContentType } from '../modules/security/bodySizeLimits.js';
import { rateLimitConfig, requestTimeoutDefaults } from '../config/constants.js';
import { appContainer } from '../services/container.js';
import type { EnvConfig } from './envConfig.js';

const healthPaths = new Set(['/health', '/api/health', '/health/live', '/api/metrics/dashboard']);

/**
 * Setup all middleware for the Express app
 */
export function setupMiddleware(app: Express, config: EnvConfig, prisma: any) {
    // Origin enforcement
    const enforceAllowedOrigin = (req: Request, res: Response, next: any) => {
        if (!config.allowedOrigins.length) {
            return next();
        }

        const origin = req.headers.origin;
        if (!origin || config.allowedOrigins.includes(origin)) {
            return next();
        }

        logger.warn(`[security] Blocked request from disallowed origin: ${origin}`);
        return res.status(403).json({
            error: 'forbidden_origin',
            message: 'Origin is not allowed',
        });
    };

    // Body size enforcement
    const enforceBodySizeLimit = (req: Request, res: Response, next: NextFunction) => {
        const limit = resolveBodyLimitForContentType(req.headers['content-type']);
        res.locals.maxBodySize = limit;

        const contentLengthHeader = req.headers['content-length'];
        if (contentLengthHeader) {
            const declaredSize = Number(contentLengthHeader);
            if (Number.isFinite(declaredSize) && declaredSize > limit) {
                logger.warn(
                    `[security] Blocked request with declared payload ${declaredSize} bytes exceeding limit ${limit} bytes (${req.method} ${req.originalUrl})`,
                );
                return res.status(413).json({
                    error: 'payload_too_large',
                    message: `Request body exceeds the maximum allowed size (${describeBodySize(limit)})`,
                });
            }
        }

        return next();
    };

    // Request timeout config
    const requestTimeoutConfig = {
        ...requestTimeoutDefaults,
        ...config.requestTimeout,
    };

    // Core middleware
    app.use(createTraceContextMiddleware());
    app.use(createRequestTimeoutMiddleware(requestTimeoutConfig));
    app.use(createPerformanceMetricsMiddleware());
    app.use(enforceAllowedOrigin);

    // CORS
    app.use(
        cors({
            origin: config.allowedOrigins.length ? config.allowedOrigins : true,
            credentials: true,
            exposedHeaders: ['x-trace-id', 'x-cache', 'x-csrf-token'],
        }),
    );

    app.use(createContentSecurityPolicyMiddleware());

    // Permissions Policy
    app.use((req: Request, res: Response, next: any) => {
        res.setHeader(
            'Permissions-Policy',
            'accelerometer=(), gyroscope=(), magnetometer=(), camera=(), microphone=(), device-orientation=()',
        );
        next();
    });

    // Body parsers
    app.use(enforceBodySizeLimit);
    app.use(express.json({ limit: bodySizeLimits.json }));
    app.use(express.urlencoded({ limit: bodySizeLimits.form, extended: true }));
    app.use(express.text({ limit: bodySizeLimits.text }));
    app.use(
        express.raw({
            limit: bodySizeLimits.binary,
            type: (req) => {
                const contentType = req.headers['content-type'];
                if (!contentType) {
                    return false;
                }
                const lower = contentType.toLowerCase();
                return lower.includes('application/octet-stream') || lower === 'application/x-ndjson';
            },
        }),
    );

    // Logging and compression
    app.use(requestLogger);
    app.use(createCompressionMiddleware(config.compression));
    app.use(createUrlInputValidationMiddleware());

    // Rate limiting
    const globalRateLimiter = createRateLimiter({
        windowMs: rateLimitConfig.global.windowMs,
        max: config.globalRateLimit ?? rateLimitConfig.global.defaultMax,
        name: 'global',
    });

    app.use((req, res, next) => {
        if (healthPaths.has(req.path)) {
            return next();
        }
        return globalRateLimiter(req, res, next);
    });

    // Database availability check
    app.use(
        createDatabaseAvailabilityMiddleware({
            bypassPaths: Array.from(healthPaths),
        }),
    );

    // Attach Prisma and DI container to requests
    app.use((req: any, res: Response, next: any) => {
        req.prisma = prisma;
        req.container = appContainer.createScope();
        next();
    });
}
