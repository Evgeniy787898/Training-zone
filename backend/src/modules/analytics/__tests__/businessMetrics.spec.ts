import { describe, expect, it, vi, beforeEach } from 'vitest';
import { configureBusinessMetrics, getBusinessMetricsSnapshot, resetBusinessMetricsCache } from '../businessMetrics.js';

const makePrisma = (overrides: Partial<any> = {}) => {
    const trainingSession = {
        groupBy: vi.fn(),
        count: vi.fn(),
    };
    const profile = {
        count: vi.fn(),
    };
    const achievement = {
        count: vi.fn(),
    };

    return {
        trainingSession,
        profile,
        achievement,
        ...overrides,
    } as any;
};

describe('businessMetrics', () => {
    beforeEach(() => {
        resetBusinessMetricsCache();
        configureBusinessMetrics({ lookbackDays: 7, cacheTtlMs: 10_000 });
    });

    it('computes business metrics with completion rate and averages', async () => {
        const prisma = makePrisma({
            trainingSession: {
                groupBy: vi
                    .fn()
                    .mockResolvedValueOnce([
                        { status: 'planned', _count: { _all: 2 } },
                        { status: 'done', _count: { _all: 3 } },
                        { status: 'in_progress', _count: { _all: 1 } },
                    ])
                    .mockResolvedValueOnce([{ profileId: 'p1', _count: { _all: 3 } }, { profileId: 'p2', _count: { _all: 3 } }]),
                count: vi.fn(),
            },
            profile: { count: vi.fn().mockResolvedValue(4) },
            achievement: { count: vi.fn().mockResolvedValue(5) },
        });

        const snapshot = await getBusinessMetricsSnapshot(prisma);

        expect(snapshot.status).toBe('ok');
        expect(snapshot.sessions.total).toBe(6);
        expect(snapshot.sessions.done).toBe(3);
        expect(snapshot.sessions.planned).toBe(2);
        expect(snapshot.sessions.inProgress).toBe(1);
        expect(snapshot.sessions.completionRate).toBeCloseTo(0.5);
        expect(snapshot.activeProfiles).toBe(2);
        expect(snapshot.sessions.avgPerActiveProfile).toBeCloseTo(3);
        expect(snapshot.newProfiles).toBe(4);
        expect(snapshot.achievementsAwarded).toBe(5);
        expect(snapshot.lastUpdatedAt).not.toBeNull();
    });

    it('caches snapshots until TTL expires', async () => {
        const prisma = makePrisma({
            trainingSession: {
                groupBy: vi.fn().mockResolvedValue([]).mockResolvedValueOnce([]),
                count: vi.fn(),
            },
            profile: { count: vi.fn().mockResolvedValue(0) },
            achievement: { count: vi.fn().mockResolvedValue(0) },
        });

        await getBusinessMetricsSnapshot(prisma);
        await getBusinessMetricsSnapshot(prisma);

        expect(prisma.trainingSession.groupBy).toHaveBeenCalledTimes(2);
        expect(prisma.profile.count).toHaveBeenCalledTimes(1);
    });
});
