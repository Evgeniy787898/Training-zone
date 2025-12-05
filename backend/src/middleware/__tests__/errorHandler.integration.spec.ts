import { describe, expect, it, beforeEach, vi } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { ZodError, type ZodIssue } from 'zod';

import { AppError } from '../../services/errors.js';
import { createErrorHandler } from '../errorHandler.js';
import { bodySizeLimits, describeBodySize } from '../../modules/security/bodySizeLimits.js';
import type { SafePrismaClient } from '../../types/prisma.js';
import { recordMonitoringEvent } from '../../modules/infrastructure/monitoring.js';

vi.mock('../../modules/infrastructure/monitoring.js', () => ({
  recordMonitoringEvent: vi.fn().mockResolvedValue(undefined),
}));

const createBaseApp = (registerRoutes: (app: Express) => void) => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.traceId = 'error-tests-trace';
    req.prisma = {
      observabilityEvent: {
        create: vi.fn().mockResolvedValue(undefined),
      },
    } as unknown as SafePrismaClient;
    next();
  });

  registerRoutes(app);

  app.use(
    createErrorHandler({
      defaultBodyLimit: bodySizeLimits.default,
      describeBodySize,
    }),
  );

  return app;
};

const issue: ZodIssue = {
  code: 'invalid_type',
  expected: 'string',
  received: 'number',
  path: ['field'],
  message: 'Expected string',
};

describe('error handler middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the serialized AppError payload with trace metadata', async () => {
    const app = createBaseApp((app) => {
      app.get('/app-error', (_req, _res, next) => {
        next(
          new AppError({
            message: 'Недостаточно прав',
            code: 'forbidden',
            category: 'authorization',
            statusCode: 403,
            details: { reason: 'ownership' },
            exposeDetails: true,
            userMessage: 'Доступ запрещён',
          }),
        );
      });
    });

    const response = await request(app).get('/app-error');

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        error: 'forbidden',
        message: 'Доступ запрещён',
        classification: 'auth',
        category: 'authorization',
        details: { reason: 'ownership' },
      },
      meta: { traceId: 'error-tests-trace', resource: 'app-error' },
    });
  });

  it('maps Prisma errors to service unavailable responses', async () => {
    const app = createBaseApp((app) => {
      app.get('/prisma-error', (_req, _res, next) => {
        next({ code: 'P2002', meta: { target: 'Session_profileId_key' } });
      });
    });

    const response = await request(app).get('/prisma-error');

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        error: 'service_unavailable',
        classification: 'database',
        message: 'Сервис временно недоступен. Пожалуйста, попробуйте позже.',
      },
      meta: { resource: 'prisma-error', traceId: 'error-tests-trace' },
    });
    expect(response.body.error.details).toMatchObject({ code: 'P2002', target: 'Session_profileId_key' });
  });

  it('treats timeout-like errors as dependency failures', async () => {
    const app = createBaseApp((app) => {
      app.get('/timeout', (_req, _res, next) => {
        const err = new Error('Upstream timeout');
        (err as any).code = 'ETIMEDOUT';
        next(err);
      });
    });

    const response = await request(app).get('/timeout');

    expect(response.status).toBe(504);
    expect(response.body.error).toMatchObject({
      error: 'dependency_timeout',
      classification: 'database',
      message: 'Сервис временно недоступен. Пожалуйста, попробуйте позже.',
    });
  });

  it('returns validation errors with exposed details for Zod failures', async () => {
    const app = createBaseApp((app) => {
      app.get('/zod', (_req, _res, next) => {
        next(new ZodError([issue]));
      });
    });

    const response = await request(app).get('/zod');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        error: 'validation_error',
        classification: 'validation',
        details: [issue],
      },
    });
  });

  it('converts oversized payload errors into 413 responses', async () => {
    const app = createBaseApp((app) => {
      app.post('/too-large', (_req, res, next) => {
        res.locals.maxBodySize = 1024;
        const err = new Error('entity too large') as any;
        err.type = 'entity.too.large';
        next(err);
      });
    });

    const response = await request(app).post('/too-large');

    expect(response.status).toBe(413);
    expect(response.body.error).toMatchObject({ error: 'payload_too_large', classification: 'validation' });
  });

  it('normalizes unexpected errors and records monitoring events', async () => {
    const app = createBaseApp((app) => {
      app.get('/crash', (_req, _res, next) => {
        next(new Error('boom'));
      });
    });

    const response = await request(app).get('/crash');

    expect(response.status).toBe(500);
    expect(response.body.error).toMatchObject({ error: 'internal_error', classification: 'internal' });
    expect(recordMonitoringEvent).toHaveBeenCalled();
  });
});
