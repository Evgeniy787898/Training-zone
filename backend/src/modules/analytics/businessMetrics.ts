import type { Prisma } from '@prisma/client';
import { businessMetricsDefaults } from '../../config/constants.js';
import type { BusinessMetricsConfig, BusinessMetricsSnapshot } from '../../types/metrics.js';

type PrismaClientLike = {
    trainingSession: Pick<Prisma.TrainingSessionDelegate, 'groupBy' | 'count'>;
    profile: Pick<Prisma.ProfileDelegate, 'count'>;
    achievement: Pick<Prisma.AchievementDelegate, 'count'>;
};

const toNumber = (value: unknown): number | undefined => {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) {
        return undefined;
    }
    return parsed;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

let config: BusinessMetricsConfig = { ...businessMetricsDefaults };

let cache: {
    snapshot: BusinessMetricsSnapshot;
    expiresAt: number;
} | null = null;

const mapStatusCounts = (rows: Array<{ status: string; _count: { _all: number } }>) => {
    return rows.reduce<Record<string, number>>((acc, row) => {
        acc[row.status] = row._count._all;
        return acc;
    }, {});
};

export const configureBusinessMetrics = (overrides: Partial<BusinessMetricsConfig>) => {
    const next: any = { ...config };

    const lookback = toNumber(overrides.lookbackDays);
    if (typeof lookback === 'number') {
        next.lookbackDays = clamp(Math.floor(lookback), 1, 90);
    }

    const ttl = toNumber(overrides.cacheTtlMs);
    if (typeof ttl === 'number') {
        next.cacheTtlMs = clamp(Math.floor(ttl), 1_000, 10 * 60 * 1_000);
    }

    config = next;
};

export const resetBusinessMetricsCache = () => {
    cache = null;
};

export const getBusinessMetricsSnapshot = async (
    prisma: PrismaClientLike | null,
): Promise<BusinessMetricsSnapshot> => {
    const now = Date.now();
    if (cache && cache.expiresAt > now) {
        return cache.snapshot;
    }

    if (!prisma) {
        const degraded: BusinessMetricsSnapshot = {
            windowDays: config.lookbackDays,
            status: 'degraded',
            lastUpdatedAt: null,
            activeProfiles: 0,
            newProfiles: 0,
            achievementsAwarded: 0,
            sessions: {
                total: 0,
                planned: 0,
                inProgress: 0,
                done: 0,
                skipped: 0,
                completionRate: 0,
                avgPerActiveProfile: 0,
            },
        };
        cache = { snapshot: degraded, expiresAt: now + config.cacheTtlMs };
        return degraded;
    }

    const since = new Date(now - config.lookbackDays * 24 * 60 * 60 * 1000);

    const [sessionStatusRows, activeProfileRows, newProfiles, achievements] = await Promise.all([
        prisma.trainingSession.groupBy({
            by: ['status'],
            where: { plannedAt: { gte: since } },
            _count: { _all: true },
        }),
        prisma.trainingSession.groupBy({
            by: ['profileId'],
            where: { plannedAt: { gte: since } },
            _count: { _all: true },
        }),
        prisma.profile.count({ where: { createdAt: { gte: since } } }),
        prisma.achievement.count({ where: { awardedAt: { gte: since } } }),
    ]);

    const statusCounts = mapStatusCounts(sessionStatusRows);
    const planned = statusCounts.planned ?? 0;
    const inProgress = statusCounts.in_progress ?? 0;
    const done = statusCounts.done ?? 0;
    const skipped = statusCounts.skipped ?? 0;
    const totalSessions = planned + inProgress + done + skipped;
    const completionRate = totalSessions ? done / totalSessions : 0;
    const activeProfiles = activeProfileRows.length;
    const avgPerActiveProfile = activeProfiles ? totalSessions / activeProfiles : 0;

    const snapshot: BusinessMetricsSnapshot = {
        status: 'ok',
        windowDays: config.lookbackDays,
        lastUpdatedAt: new Date(now).toISOString(),
        activeProfiles,
        newProfiles,
        achievementsAwarded: achievements,
        sessions: {
            total: totalSessions,
            planned,
            inProgress,
            done,
            skipped,
            completionRate,
            avgPerActiveProfile,
        },
    };

    cache = {
        snapshot,
        expiresAt: now + config.cacheTtlMs,
    };

    return snapshot;
};
