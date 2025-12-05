import type { Ref } from 'vue';
import { cachedApiClient } from '@/services/cachedApi';
import type { ProgramExercise } from '@/types';
import { useCachedRequest } from './useCachedRequest';

export function useExercises(_programId: Ref<string | undefined>, _disciplineId: Ref<string | undefined>) {
  const { data: exercises, loading, execute, clear } = useCachedRequest<ProgramExercise[], [string | undefined, string | undefined]>(
    async (pid, did) => {
      const response = await cachedApiClient.getProgramExercises(pid, did);
      return Array.isArray(response) ? response : [];
    },
    {
      initialValueFactory: () => [],
      createKey: (pid, did) => `${pid ?? ''}_${did ?? ''}`,
    }
  );

  const loadExercises = async (pid?: string, did?: string) => {
    if (!pid && !did) {
      clear();
      return exercises.value;
    }

    return execute(pid, did);
  };

  return {
    // State
    loading,
    exercises,

    // Methods
    loadExercises,
    clear,
  };
}
