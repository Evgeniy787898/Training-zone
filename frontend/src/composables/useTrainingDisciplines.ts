import { computed } from 'vue';
import { cachedApiClient } from '@/services/cachedApi';
import type { TrainingDirection } from '@/types';
import { useBatchUpdates } from './useBatchUpdates';
import { useCachedRequest } from './useCachedRequest';
import { useCarouselNavigation } from './useCarouselNavigation';

export interface BaseProgram {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  color?: string;
  gradient?: { primary: string; soft: string };
  locked?: boolean;
}

export function useTrainingDisciplines() {
  const { batchRAF } = useBatchUpdates();

  const {
    data: programs,
    loading,
    error,
    execute,
  } = useCachedRequest<BaseProgram[], []>(
    async () => {
      const directionsData = await cachedApiClient.getTrainingDisciplines();

      const mapped = directionsData.map((d: TrainingDirection) => ({
        id: d.id,
        slug: d.slug ?? d.id,
        title: d.name,
        subtitle: d.description || '',
        color: undefined,
        gradient: undefined,
        locked: false,
      }));

      return mapped;
    },
    {  
      initialValueFactory: () => [],
      createKey: () => 'disciplines',
    }
  );

  const displayPrograms = computed(() => programs.value);
  const {
    visibleIndex,
    prevIndex: prevVisibleIndex,
    hasPrev,
    hasNext,
    slideDirection,
    setIndex: setVisibleIndex,
    reset,
    selectPrev,
    selectNext,
  } = useCarouselNavigation({
    length: () => displayPrograms.value.length,
    batch: batchRAF,
  });
  /**
   * Загрузка направлений тренировок
   */
  const loadDisciplines = async () => {
    const result = await execute();

    reset(result.length ? 0 : -1);

    return result;
  };

  const currentProgram = computed(() => displayPrograms.value[visibleIndex.value] ?? null);

  return {
    // State
    loading,
    error,
    programs,
    visibleIndex,
    prevVisibleIndex,
    
    // Computed
    displayPrograms,
    currentProgram,
    hasPrev,
    hasNext,
    slideDirection,

    // Methods
    loadDisciplines,
    setVisibleIndex,
    selectPrev,
    selectNext,
  };
}
