import type { SafePrismaClient } from '../../types/prisma.js';
import { achievementSummarySelect } from '../database/prismaSelect.js';
import { buildPaginationMeta } from '../../services/pagination.js';
import type { PaginationMeta } from '../../types/pagination.js';

export type AchievementsCachePayload = {
    achievements: any[];
    source: 'database';
    fallback: false;
    cachedAt: string;
    pagination: PaginationMeta;
};

export async function loadAchievementsPage(
    prisma: SafePrismaClient,
    {
        profileId,
        page,
        pageSize,
    }: {
        profileId: string;
        page: number;
        pageSize: number;
    },
): Promise<AchievementsCachePayload> {
    const paginationOffset = (page - 1) * pageSize;
    const [achievements, total] = await prisma.$transaction([
        prisma.achievement.findMany({
            select: achievementSummarySelect,
            where: { profileId },
            orderBy: { awardedAt: 'desc' },
            skip: paginationOffset,
            take: pageSize,
        }),
        prisma.achievement.count({ where: { profileId } }),
    ]);

    const pagination = buildPaginationMeta({
        total,
        page,
        pageSize,
    });

    return {
        achievements,
        source: 'database',
        fallback: false,
        cachedAt: new Date().toISOString(),
        pagination,
    };
}
