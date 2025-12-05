import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import sessionsRouter from '../../routes/sessions.js';
import { DependencyContainer, diTokens } from '../../services/container.js';
import type { SessionServiceContract } from '../../types/services.js';
import type { SafePrismaClient } from '../../types/prisma.js';
import { TrainingSessionStatus } from '../../types/sessions.js';

type SessionServiceMock = SessionServiceContract & {
  [K in keyof SessionServiceContract]: ReturnType<typeof vi.fn>;
};

const createSessionServiceMock = (): SessionServiceMock => ({
  getSessionForDay: vi.fn<SessionServiceContract['getSessionForDay']>(),
  getWeekSessions: vi.fn<SessionServiceContract['getWeekSessions']>(),
  getSessionById: vi.fn<SessionServiceContract['getSessionById']>(),
  saveSession: vi.fn<SessionServiceContract['saveSession']>(),
  updateSession: vi.fn<SessionServiceContract['updateSession']>(),
  deleteSession: vi.fn<SessionServiceContract['deleteSession']>(),
});

type TestAppOptions = {
  profileId?: string;
  sessionService?: SessionServiceMock;
};

const createTestApp = (options: TestAppOptions = {}) => {
  const sessionService = options.sessionService ?? createSessionServiceMock();
  const container = new DependencyContainer(null);
  container.registerValue(diTokens.sessionService, sessionService);

  const prismaStub = {
    $on: () => undefined,
    $use: () => undefined,
  } as unknown as SafePrismaClient;

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.traceId = 'integration-trace';
    if (options.profileId !== undefined) {
      req.profileId = options.profileId;
    }
    req.prisma = prismaStub;
    req.container = container.createScope();
    next();
  });

  app.use('/api/sessions', sessionsRouter);
  app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = error?.statusCode ?? 500;
    res.status(status).json({
      success: false,
      error: {
        code: error?.code ?? 'internal_error',
        message: error?.message ?? 'Internal Server Error',
      },
    });
  });

  return { app, sessionService };
};

describe('Sessions API integration', () => {
  it('requires authentication for /today endpoint', async () => {
    const { app } = createTestApp({ profileId: undefined });

    const response = await request(app).get('/api/sessions/today');

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: { error: 'auth_required', classification: 'auth' },
    });
  });

  it('returns current day session with meta data', async () => {
    const serviceMock = createSessionServiceMock();
    const sessionPayload = {
      id: 'session-1',
      profileId: 'profile-1',
      planned_at: '2024-01-10T09:00:00.000Z',
      status: TrainingSessionStatus.done,
    };
    serviceMock.getSessionForDay.mockResolvedValue({ session: sessionPayload });

    const { app } = createTestApp({ profileId: 'profile-1', sessionService: serviceMock });

    const response = await request(app).get('/api/sessions/today');

    expect(serviceMock.getSessionForDay).toHaveBeenCalledWith('profile-1', undefined);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        session: sessionPayload,
        source: 'database',
      },
      meta: { traceId: 'integration-trace' },
    });
  });

  it('validates query params for week endpoint', async () => {
    const { app } = createTestApp({ profileId: 'profile-2' });

    const response = await request(app).get('/api/sessions/week').query({ date: 'invalid-date' });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        error: 'validation_failed',
        classification: 'validation',
        resource: '/week',
      },
    });
  });

  it('persists a new session via POST /api/sessions', async () => {
    const serviceMock = createSessionServiceMock();
    const newSession = {
      id: 'session-created',
      profileId: 'profile-3',
      planned_at: '2024-05-05T10:00:00.000Z',
      status: TrainingSessionStatus.done,
    };
    serviceMock.saveSession.mockResolvedValue(newSession as any);

    const payload = {
      planned_at: '2024-05-05T10:00:00.000Z',
      status: TrainingSessionStatus.done,
      notes: 'Integration test payload',
    };

    const { app } = createTestApp({ profileId: 'profile-3', sessionService: serviceMock });

    const response = await request(app).post('/api/sessions').send(payload);

    expect(serviceMock.saveSession).toHaveBeenCalledWith('profile-3', payload);
    expect(response.status).toBe(200);
    expect(response.body.data.session.id).toBe('session-created');
  });

  it('deletes session and returns confirmation message', async () => {
    const serviceMock = createSessionServiceMock();
    serviceMock.deleteSession.mockResolvedValue(undefined as any);

    const { app } = createTestApp({ profileId: 'profile-4', sessionService: serviceMock });

    const response = await request(app).delete('/api/sessions/0b1c0f6e-6f0d-4e53-8d2e-1234567890ab');

    expect(response.status).toBe(200);
    expect(serviceMock.deleteSession).toHaveBeenCalledWith(
      'profile-4',
      '0b1c0f6e-6f0d-4e53-8d2e-1234567890ab',
      expect.objectContaining({ action: 'delete' }),
    );
    expect(response.body).toMatchObject({
      success: true,
      data: { message: 'Тренировка удалена' },
    });
  });
});
