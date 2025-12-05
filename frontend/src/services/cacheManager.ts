import { cachedApiClient } from '@/services/cachedApi';

const PERSISTENT_CACHE_KEY = 'tzona_persistent_cache';

const buildTrainingProgramsKey = (disciplineId?: string | null) =>
  `trainingPrograms_${disciplineId || 'all'}`;
const buildProgramExercisesKey = (programId?: string | null, disciplineId?: string | null) =>
  `programExercises_${programId || 'none'}_${disciplineId || 'none'}`;
const buildExerciseLevelsKey = (exerciseKey: string) => `exerciseLevels_${exerciseKey}`;

type CacheMutation = (parsed: Record<string, unknown>) => void;

const mutatePersistentCache = (mutator: CacheMutation) => {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    const stored = localStorage.getItem(PERSISTENT_CACHE_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    mutator(parsed);
    localStorage.setItem(PERSISTENT_CACHE_KEY, JSON.stringify(parsed));
  } catch (error) {
    console.warn('[cacheManager] Failed to mutate persistent cache', error);
  }
};

const invalidateCacheKeys = (keys: Iterable<string>) => {
  const uniqueKeys = Array.from(new Set(keys)).filter(Boolean);
  if (!uniqueKeys.length) return;

  cachedApiClient.invalidateCache(uniqueKeys);
  mutatePersistentCache((parsed) => {
    uniqueKeys.forEach((key) => {
      if (key in parsed) {
        delete parsed[key];
      }
    });
  });
};

export const invalidateProgramContextCaches = (options: {
  includeGlobal?: boolean;
  disciplineId?: string | null;
  programId?: string | null;
  exerciseKeys?: string[];
} = {}) => {
  const keys = new Set<string>();
  if (options.includeGlobal) {
    keys.add('trainingDisciplines');
    keys.add('trainingPrograms_all');
  }
  if (options.disciplineId) {
    keys.add(buildTrainingProgramsKey(options.disciplineId));
    keys.add(buildProgramExercisesKey(undefined, options.disciplineId));
  }
  if (options.programId) {
    keys.add(buildProgramExercisesKey(options.programId, options.disciplineId));
  }
  if (Array.isArray(options.exerciseKeys)) {
    options.exerciseKeys.forEach((exerciseKey) => {
      if (exerciseKey) {
        keys.add(buildExerciseLevelsKey(exerciseKey));
      }
    });
  }
  invalidateCacheKeys(keys);
};

export const invalidateExercisesCache = (exerciseKeys: string[]) => {
  const keys = exerciseKeys.map(buildExerciseLevelsKey);
  invalidateCacheKeys(keys);
};

export const clearAllCaches = () => {
  cachedApiClient.clearCache();
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(PERSISTENT_CACHE_KEY);
  }
};
