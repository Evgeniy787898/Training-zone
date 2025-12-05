import { describe, expect, it, vi } from 'vitest';
import { loadProfileSummary } from '../profileSummary.js';
import type { SafePrismaClient } from '../../../types/prisma.js';

const buildPrismaMock = () => ({
  profile: {
    findUnique: vi.fn(),
  },
  trainingSession: {
    findMany: vi.fn(),
  },
  metric: {
    findMany: vi.fn(),
  },
  $executeRawUnsafe: vi.fn().mockResolvedValue(0),
  $queryRaw: vi.fn().mockResolvedValue([]),
});

type PrismaMock = ReturnType<typeof buildPrismaMock>;

describe('loadProfileSummary', () => {
  it('returns null when the profile is missing', async () => {
    const prisma = buildPrismaMock();
    prisma.profile.findUnique.mockResolvedValue(null);

    const summary = await loadProfileSummary(prisma as unknown as SafePrismaClient, 'profile-1');

    expect(summary).toBeNull();
    expect(prisma.trainingSession.findMany).not.toHaveBeenCalled();
  });

  it('calculates adherence metrics from recent sessions', async () => {
    const prisma = buildPrismaMock();
    const now = new Date('2024-01-01T00:00:00Z');
    prisma.profile.findUnique.mockResolvedValue({
      id: 'profile-1',
      notificationTime: now,
      timezone: 'UTC',
      preferences: { theme: 'dark' },
      notificationsPaused: false,
    });
    prisma.trainingSession.findMany.mockResolvedValue([
      { id: 's1', status: 'done' },
      { id: 's2', status: 'planned' },
    ]);
    prisma.metric.findMany.mockResolvedValue([{ id: 'm1' }]);

    const summary = await loadProfileSummary(prisma as unknown as SafePrismaClient, 'profile-1');

    expect(summary).not.toBeNull();
    expect(summary?.profile.id).toBe('profile-1');
    expect(summary?.adherence.total_sessions).toBe(2);
    expect(summary?.adherence.completed_sessions).toBe(1);
    expect(summary?.adherence.adherence_percent).toBe(50);
    expect(summary?.metrics).toEqual([{ id: 'm1' }]);
    expect(prisma.trainingSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ profileId: 'profile-1' }),
      }),
    );
  });
});
