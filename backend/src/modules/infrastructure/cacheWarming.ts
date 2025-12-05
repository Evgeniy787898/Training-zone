import { cacheWarmingConfig } from '../../config/constants.js';
import { createRecurringTask } from '../../patterns/recurringTask.js';
import type { SafePrismaClient } from '../../types/prisma.js';
import { rememberCachedResource, setCachedResource } from './cacheStrategy.js';
import { achievementSummarySelect, assistantNoteSummarySelect, dailyAdviceSummarySelect } from '../database/prismaSelect.js';
import { loadActiveTrainingDisciplines, loadTrainingPrograms } from '../training/trainingCatalog.js';
import { loadProfileSummary } from '../profile/profileSummary.js';
import { loadAchievementsPage } from '../profile/achievementsFeed.js';

const DAILY_ADVICE_TYPES: Array<'training' | 'rest'> = ['training', 'rest'];

type CacheWarmingHandle = {
    dispose: () => void;
    trigger: () => Promise<void>;
};

async function warmDailyAdvice(prisma: SafePrismaClient) {
    for (const adviceType of DAILY_ADVICE_TYPES) {
        await rememberCachedResource('dailyAdviceList', { adviceType }, () =>
            prisma.dailyAdvice.findMany({
                where: { adviceType },
                select: dailyAdviceSummarySelect,
            }),
        );
    }
}

async function warmTrainingCaches(prisma: SafePrismaClient) {
    const disciplines = await loadActiveTrainingDisciplines(prisma);
    await setCachedResource('trainingDisciplines', {} as Record<string, never>, disciplines);

    const disciplineIds = new Set<string | null>();
    disciplineIds.add(null);
    disciplines.forEach((discipline) => disciplineIds.add(discipline.id));

    for (const disciplineId of disciplineIds) {
        const programs = await loadTrainingPrograms(prisma, { disciplineId: disciplineId || undefined });
        await setCachedResource('trainingPrograms', { disciplineId: disciplineId || undefined }, programs);
    }
}

async function warmProfileCaches(prisma: SafePrismaClient) {
    if (cacheWarmingConfig.profileSampleSize <= 0) {
        return;
    }

    const profiles = await prisma.profile.findMany({
        select: { id: true },
        orderBy: [{ updatedAt: 'desc' }],
        take: cacheWarmingConfig.profileSampleSize,
    });

    if (!profiles.length) {
        return;
    }

    for (const profile of profiles) {
        try {
            const summary = await loadProfileSummary(prisma, profile.id);
            if (summary) {
                await setCachedResource('profileSummary', { profileId: profile.id }, { ...summary, cached: undefined });
            }
        } catch (error) {
            console.warn('[cache-warming] Failed to warm profile summary', { profileId: profile.id, error });
        }

        try {
            const achievements = await loadAchievementsPage(prisma, {
                profileId: profile.id,
                page: 1,
                pageSize: cacheWarmingConfig.achievements.pageSize,
            });
            await setCachedResource(
                'achievementsPage',
                { profileId: profile.id, page: 1, pageSize: cacheWarmingConfig.achievements.pageSize },
                achievements,
            );
        } catch (error) {
            console.warn('[cache-warming] Failed to warm achievements', { profileId: profile.id, error });
        }
    }
}

async function runCacheWarming(prisma: SafePrismaClient) {
    try {
        await warmTrainingCaches(prisma);
        await warmDailyAdvice(prisma);
        await warmProfileCaches(prisma);
        console.log('[cache-warming] Critical caches refreshed');
    } catch (error) {
        console.error('[cache-warming] Failed to refresh caches', error);
    }
}

export function scheduleCacheWarming(prisma: SafePrismaClient | null): CacheWarmingHandle | null {
    if (!prisma || !cacheWarmingConfig.enabled) {
        return null;
    }

    const controller = new AbortController();
    const task = createRecurringTask({
        name: 'cache-warming',
        intervalMs: cacheWarmingConfig.intervalMs,
        immediate: false,
        autoStart: false,
        signal: controller.signal,
        run: () => runCacheWarming(prisma),
    });

    const startupTimer = setTimeout(() => {
        void task.trigger();
        task.start();
    }, cacheWarmingConfig.startupDelayMs);
    startupTimer.unref?.();

    return {
        dispose: () => {
            clearTimeout(startupTimer);
            controller.abort();
            task.dispose();
        },
        trigger: () => task.trigger(),
    };
}
