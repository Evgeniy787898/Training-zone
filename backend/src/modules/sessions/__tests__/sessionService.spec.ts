import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SessionService } from '../application/sessionService.js';
import type { SessionRepository } from '../infrastructure/sessionRepository.js';
import type { CreateSessionPayload } from '../../../contracts/session.js';

vi.mock('../../infrastructure/cacheInvalidation.js', () => ({
  invalidateSessionDerivedCaches: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../security/accessControl.js', () => ({
  ensureOwnedByProfile: vi.fn(),
}));

type RepositoryMock = {
  fetchSessionsWithinRange: ReturnType<typeof vi.fn>;
  hydrateSessions: ReturnType<typeof vi.fn>;
  findSessionById: ReturnType<typeof vi.fn>;
  findSessionByPlannedTimestamp: ReturnType<typeof vi.fn>;
  deriveStructuredSessionData: ReturnType<typeof vi.fn>;
  updateSessionWithSchedulingFallback: ReturnType<typeof vi.fn>;
  createSessionWithSchedulingFallback: ReturnType<typeof vi.fn>;
  syncSessionExercises: ReturnType<typeof vi.fn>;
  deleteSession: ReturnType<typeof vi.fn>;
};

const createRepositoryMock = (): RepositoryMock => ({
  fetchSessionsWithinRange: vi.fn().mockResolvedValue([]),
  hydrateSessions: vi.fn().mockResolvedValue([]),
  findSessionById: vi.fn().mockResolvedValue(null),
  findSessionByPlannedTimestamp: vi.fn().mockResolvedValue(null),
  deriveStructuredSessionData: vi.fn().mockResolvedValue({ sessionData: {}, exercises: [] }),
  updateSessionWithSchedulingFallback: vi.fn().mockResolvedValue(null),
  createSessionWithSchedulingFallback: vi.fn().mockResolvedValue(null),
  syncSessionExercises: vi.fn().mockResolvedValue(undefined),
  deleteSession: vi.fn().mockResolvedValue(undefined),
});

const buildService = () => new SessionService(createRepositoryMock() as unknown as SessionRepository);

describe('SessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws a validation error when getSessionForDay receives invalid date', async () => {
    const service = buildService();

    await expect(service.getSessionForDay('profile-1', 'not-a-date')).rejects.toMatchObject({
      code: 'invalid_date',
      statusCode: 400,
    });
  });

  it('updates existing sessions with structured notes when saveSession is called', async () => {
    const repository = createRepositoryMock();
    const service = new SessionService(repository as unknown as SessionRepository);
    const plannedAt = new Date().toISOString();
    const existingSession = { id: 'session-1', status: 'in_progress', notes: null } as any;

    repository.findSessionByPlannedTimestamp.mockResolvedValue(existingSession);
    repository.deriveStructuredSessionData.mockResolvedValue({
      sessionData: { derived: true },
      exercises: [{ exerciseKey: 'push_up' }],
    });
    repository.updateSessionWithSchedulingFallback.mockImplementation(async (_id: string, payload: any) => ({
      ...existingSession,
      ...payload,
      updatedAt: new Date(),
    }));
    repository.hydrateSessions.mockResolvedValue([{ id: 'session-1', hydrated: true }]);

    const payload = {
      planned_at: plannedAt,
      status: 'done',
      notes: JSON.stringify({ comment: 'Great work', program: { id: 'program-1' } }),
    } as CreateSessionPayload;

    const result = await service.saveSession('profile-1', payload);

    expect(result).toEqual({ id: 'session-1', hydrated: true });
    expect(repository.updateSessionWithSchedulingFallback).toHaveBeenCalled();
    expect(repository.syncSessionExercises).toHaveBeenCalledWith('session-1', 'profile-1', [{ exerciseKey: 'push_up' }]);
  });
});
