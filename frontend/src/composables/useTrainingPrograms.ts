import { computed, type Ref } from 'vue';
import { cachedApiClient } from '@/services/cachedApi';
import type { TrainingProgram } from '@/types';
import { useBatchUpdates } from './useBatchUpdates';
import { useCachedRequest } from './useCachedRequest';
import { useCarouselNavigation } from './useCarouselNavigation';

export function useTrainingPrograms(_disciplineId: Ref<string | null>) {
  const { batchRAF } = useBatchUpdates();

  const {
    data: trainingPrograms,
    loading,
    execute,
    clear: clearPrograms,
  } = useCachedRequest<(TrainingProgram & { placeholder?: boolean })[], [string]>(
    async (disciplineId) => {
      const data = await cachedApiClient.getTrainingPrograms(disciplineId);
      return data || [];
    },
    {
      initialValueFactory: () => [],
      createKey: (disciplineId) => disciplineId,
    }
  );

  const {
    visibleIndex,
    prevIndex,
    hasPrev,
    hasNext,
    slideDirection,
    setIndex,
    reset,
    selectPrev,
    selectNext,
  } = useCarouselNavigation({
    length: () => trainingPrograms.value.length,
    batch: batchRAF,
  });

  /**
   * Загрузка программ тренировок
   */
  const loadPrograms = async (id: string | null) => {
    if (!id) {
      clearPrograms();
      reset(0);
      return trainingPrograms.value;
    }

    const data = await execute(id);

    reset(0);

    return data;
  };

  const currentProgram = computed(() => trainingPrograms.value[visibleIndex.value] || null);
  // Watch disciplineId для автоматической загрузки
  // (будет использоваться в компоненте)

  return {
    // State
    loading,
    trainingPrograms,
    visibleIndex,
    prevIndex,

    // Computed
    currentProgram,
    hasPrev,
    hasNext,
    slideDirection,

    // Methods
    loadPrograms,
    setIndex,
    selectPrev,
    selectNext,
  };
}
