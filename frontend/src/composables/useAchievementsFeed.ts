import { ref } from 'vue';
import { cachedApiClient } from '@/services/cachedApi';
import type { Achievement } from '@/types';
import { useLazyList } from './useLazyList';

interface UseAchievementsFeedOptions {
  pageSize?: number;
  immediate?: boolean;
}

export function useAchievementsFeed(options?: UseAchievementsFeedOptions) {
  const achievementsSource = ref<string | null>(null);

  const list = useLazyList<Achievement>({
    pageSize: options?.pageSize ?? 10,
    immediate: options?.immediate ?? true,
    limiterKey: 'achievements-feed',
    throttleMs: 800,
    fetchPage: async (page, pageSize) => {
      const payload = await cachedApiClient.getAchievements({ page, pageSize });
      const achievements = Array.isArray(payload?.achievements) ? payload.achievements : [];

      if (page === 1) {
        achievementsSource.value = payload?.source ?? (payload?.fallback ? 'schema_unavailable' : null);
      }

      const pagination = payload?.pagination;
      const hasMore = pagination ? Boolean(pagination.has_more) : achievements.length === pageSize;

      return {
        items: achievements,
        hasMore,
      };
    },
  });

  const reloadAchievements = async () => {
    achievementsSource.value = null;
    await list.reload();
  };

  return {
    achievements: list.items,
    achievementsLoading: list.loading,
    achievementsError: list.error,
    achievementsHasMore: list.hasMore,
    achievementsSentinelRef: list.sentinelRef,
    achievementsSource,
    reloadAchievements,
    loadMoreAchievements: list.loadMore,
  };
}
