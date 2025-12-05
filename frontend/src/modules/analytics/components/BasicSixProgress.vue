<template>
  <section ref="surfaceRoot" class="basic-progress" aria-label="Прогресс базовых упражнений">
    <div v-if="loading" class="basic-progress__list" aria-hidden="true">
      <div
        v-for="ex in BASIC_SIX"
        :key="ex.key"
        class="surface-card surface-card--overlay basic-progress__card basic-progress__card--loading"
      ></div>
    </div>

    <div v-else class="basic-progress__list" role="list">
      <button
        v-for="exercise in exercises"
        :key="exercise.key"
        type="button"
        class="surface-card surface-card--overlay basic-progress__card"
        role="listitem"
        @click="handleExerciseClick(exercise)"
      >
        <div class="basic-progress__card-header">
          <span class="basic-progress__card-title">{{ exercise.title }}</span>
          <span class="basic-progress__card-level">
            {{ getLevelNumber(exercise.currentLevel) }} / {{ exercise.totalLevels }}
          </span>
        </div>
        <div class="basic-progress__meter">
          <span
            class="basic-progress__meter-fill"
            :style="{
              '--progress-width': `${getProgressPercent(exercise.currentLevel, exercise.totalLevels)}%`,
              '--progress-color': getLevelColor(getLevelNumber(exercise.currentLevel))
            }"
          ></span>
        </div>
      </button>
    </div>

    <div
      v-if="selectedExercise"
      class="basic-progress__modal"
      role="dialog"
      aria-modal="true"
      @click="handleCloseModal"
    >
      <section class="surface-card surface-card--overlay basic-progress__modal-content" @click.stop>
        <header class="basic-progress__modal-header">
          <h3 class="basic-progress__modal-title">{{ selectedExercise.title }}</h3>
          <button type="button" class="basic-progress__modal-close" @click="handleCloseModal" aria-label="Закрыть модальное окно">
            <NeonIcon name="close" variant="neutral" :size="22" />
          </button>
        </header>

        <div class="basic-progress__levels">
          <template v-if="!selectedExercise.currentLevel">
            <p class="basic-progress__empty">Не приступил к тренировкам</p>
            <article
              v-for="level in exerciseLevels"
              :key="level.id"
              class="basic-progress__level"
            >
              <header class="basic-progress__level-header">
                <span class="basic-progress__level-title">{{ level.title }}</span>
                <span class="basic-progress__level-id">{{ level.id }}</span>
              </header>
              <p class="basic-progress__level-meta">{{ level.sets }} × {{ level.reps }}</p>
            </article>
          </template>
          <template v-else>
            <article
              v-for="level in exerciseLevels"
              :key="level.id"
              class="basic-progress__level"
              :class="{ 'is-active': level.id === selectedExercise.currentLevel }"
            >
              <header class="basic-progress__level-header">
                <span class="basic-progress__level-title">{{ level.title }}</span>
                <span class="basic-progress__level-id">{{ level.id }}</span>
              </header>
              <p class="basic-progress__level-meta">{{ level.sets }} × {{ level.reps }}</p>
              <span v-if="level.id === selectedExercise.currentLevel" class="basic-progress__level-status">Вы здесь</span>
            </article>
          </template>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { cachedApiClient as apiClient } from '@/services/cachedApi';
import { ExerciseCatalogItem, ExerciseLevel } from '@/types';
import NeonIcon from '@/modules/shared/components/NeonIcon.vue';
import { useInteractiveSurfaces } from '@/composables/useInteractiveSurfaces';

const BASIC_SIX = [
  { key: 'pullups' },
  { key: 'squats' },
  { key: 'pushups' },
  { key: 'leg_raises' },
  { key: 'bridge' },
  { key: 'handstand' },
];

interface Exercise {
  key: string;
  title?: string;
  totalLevels?: number;
  currentLevel?: string | null;
}

const exercises = ref<Exercise[]>([]);
const loading = ref(true);
const selectedExercise = ref<Exercise | null>(null);
const exerciseLevels = ref<ExerciseLevel[]>([]);
const surfaceRoot = ref<HTMLElement | null>(null);

useInteractiveSurfaces(surfaceRoot);

const getLevelNumber = (level: string | null | undefined): number => {
  if (!level) return 0;
  const match = level.match(/^(\d+)\./);
  return match ? parseInt(match[1], 10) : 0;
};

const getProgressPercent = (currentLevel: string | null | undefined, totalLevels: number | undefined): number => {
  if (!totalLevels || totalLevels === 0) return 0;
  const current = getLevelNumber(currentLevel);
  return Math.min((current / totalLevels) * 100, 100);
};

const getLevelColor = (levelNumber: number): string => {
  const hue = (levelNumber / 10) * 120;
  return `hsl(${hue}, 70%, 45%)`;
};

const loadProgress = async () => {
  try {
    const data = await apiClient.getExerciseCatalog();
    const catalog = Array.isArray(data) ? data : (data.items || []);

    const exercisesMap: Record<string, any> = {};
    catalog.forEach((item: ExerciseCatalogItem) => {
      const key = item.key ?? item.exerciseKey;
      if (!key) {
        return;
      }

      if (BASIC_SIX.find(ex => ex.key === key)) {
        exercisesMap[key] = {
          title: item.title,
          totalLevels: 10,
          currentLevel: item.latest_progress?.level || null,
        };
      }
    });

    exercises.value = BASIC_SIX.map(ex => ({
      ...ex,
      ...exercisesMap[ex.key],
      title: exercisesMap[ex.key]?.title || ex.key,
    }));
  } catch (error) {
    console.error('Failed to load exercise progress:', error);
  } finally {
    loading.value = false;
  }
};

const loadExerciseLevels = async () => {
  if (!selectedExercise.value) return;
  
  try {
    const data = await apiClient.getExerciseLevels(selectedExercise.value.key);
    exerciseLevels.value = data.items?.flat() || [];
  } catch (error) {
    console.error('Failed to load exercise levels:', error);
  }
};

const handleExerciseClick = (exercise: Exercise) => {
  selectedExercise.value = exercise;
  loadExerciseLevels();
};

const handleCloseModal = () => {
  selectedExercise.value = null;
};

onMounted(() => {
  loadProgress();
});
</script>

<style scoped>
.basic-progress {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.basic-progress__list {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: clamp(14rem, 10rem + 20vw, 18rem);
  gap: var(--space-sm);
  overflow-x: auto;
  padding-block-end: var(--space-sm);
  padding-inline-end: var(--space-xs);
  scroll-snap-type: x mandatory;
}

.basic-progress__list::-webkit-scrollbar {
  height: 6px;
}

.basic-progress__list::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 999px;
}

.basic-progress__card {
  align-items: stretch;
  gap: var(--space-sm);
  padding: clamp(1.1rem, 0.95rem + 0.6vw, 1.4rem);
  min-block-size: clamp(9.5rem, 8.5rem + 4vw, 12rem);
  border-color: var(--color-border);
  background-image: linear-gradient(145deg, var(--color-accent-light) 0%, transparent 70%),
    var(--panel-surface-gradient);
  color: var(--color-text-primary);
  text-align: left;
  scroll-snap-align: start;
}

.basic-progress__card:focus-visible {
  outline: none;
  border-color: var(--color-accent);
}

.basic-progress__card--loading {
  position: relative;
  overflow: hidden;
}

.basic-progress__card--loading::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(120deg, transparent 0%, var(--color-accent-light) 50%, transparent 100%);
  animation: shimmer 1.6s infinite;
}

.basic-progress__card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-xs);
}

.basic-progress__card-title {
  font-size: clamp(0.95rem, 0.9rem + 0.35vw, 1.1rem);
  font-weight: 600;
  margin: 0;
}

.basic-progress__card-level {
  font-size: clamp(0.75rem, 0.72rem + 0.25vw, 0.85rem);
  color: var(--color-text-secondary);
}

.basic-progress__meter {
  inline-size: 100%;
  block-size: 0.45rem;
  border-radius: 999px;
  background: var(--color-bg-secondary);
  overflow: hidden;
}

.basic-progress__meter-fill {
  display: block;
  inline-size: var(--progress-width);
  block-size: 100%;
  border-radius: inherit;
  background: var(--progress-color);
  transition: inline-size 0.3s ease;
}

.basic-progress__modal {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(1.5rem, 1rem + 2vw, 2.5rem);
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(24px);
}

.basic-progress__modal-content {
  inline-size: min(100%, 36rem);
  max-block-size: calc(100dvh - var(--space-xl));
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  padding: clamp(1.4rem, 1.1rem + 1vw, 2.1rem);
  border-radius: clamp(20px, 4vw, 26px);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-lg);
  overflow-y: auto;
  background: var(--color-bg-modal);
}

.basic-progress__modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}

.basic-progress__modal-title {
  margin: 0;
  font-size: clamp(1.2rem, 1.1rem + 0.6vw, 1.5rem);
  font-weight: 600;
  color: var(--color-text-primary);
}

.basic-progress__modal-close {
  inline-size: clamp(2.2rem, 2rem + 0.4vw, 2.6rem);
  block-size: clamp(2.2rem, 2rem + 0.4vw, 2.6rem);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.basic-progress__modal-close:hover,
.basic-progress__modal-close:focus-visible {
  outline: none;
  border-color: var(--color-accent);
  color: var(--color-text-primary);
  box-shadow: 0 0 12px var(--color-accent-light);
  transform: translateY(-0.05rem);
}

.basic-progress__levels {
  display: grid;
  gap: var(--space-sm);
}

.basic-progress__empty {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: clamp(0.85rem, 0.8rem + 0.35vw, 1rem);
}

.basic-progress__level {
  display: flex;
  flex-direction: column;
  gap: var(--space-xxs);
  padding: var(--space-sm);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.basic-progress__level.is-active {
  border-color: var(--color-accent);
  box-shadow: 0 0 12px var(--color-accent-light);
}

.basic-progress__level-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-xs);
}

.basic-progress__level-title {
  font-size: clamp(0.9rem, 0.85rem + 0.35vw, 1.05rem);
  font-weight: 600;
  margin: 0;
  color: var(--color-text-primary);
}

.basic-progress__level-id {
  font-size: clamp(0.75rem, 0.7rem + 0.25vw, 0.85rem);
  color: var(--color-text-muted);
}

.basic-progress__level-meta {
  margin: 0;
  font-size: clamp(0.8rem, 0.75rem + 0.35vw, 0.95rem);
  color: var(--color-text-secondary);
}

.basic-progress__level-status {
  align-self: flex-start;
  padding: var(--space-xxs) var(--space-sm);
  border-radius: 999px;
  background: var(--color-accent);
  color: var(--color-accent-contrast);
  font-size: clamp(0.7rem, 0.68rem + 0.25vw, 0.8rem);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-weight: 600;
}

@keyframes shimmer {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(100%);
  }
}

@media (min-width: 48rem) {
  .basic-progress__modal {
    padding: var(--space-lg);
  }
}
</style>