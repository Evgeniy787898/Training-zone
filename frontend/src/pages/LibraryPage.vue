<template>
  <div class="page-shell library-page">
    <!-- Background -->
    <div class="page-bg">
      <div class="page-bg__grid"></div>
      <div class="page-bg__glow page-bg__glow--1"></div>
      <div class="page-bg__glow page-bg__glow--2"></div>
    </div>
    <header class="page-header library-page__header">
      <div>
        <h1 class="page-title">
          <AppIcon
            class="page-title__icon"
            name="book"
            variant="violet"
            :size="28"
          />
          <span>Библиотека упражнений</span>
        </h1>
        <p class="page-subtitle">
          База знаний калистеники: техника, прогрессии и рекомендации.
        </p>
      </div>
    </header>

    <div class="library-container">
      <ExerciseLibrary
        :exercises="exercises"
        :loading="loading"
        @select-exercise="openExerciseDetails"
        @toggle-favorite="handleToggleFavorite"
      />
    </div>

    <!-- Error State -->
    <div v-if="error" class="page-error center-msg">
      <p>Не удалось загрузить библиотеку</p>
      <button class="btn btn-primary" @click="loadLibrary">Повторить</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { cachedApiClient } from '@/services/cachedApi';
import AppIcon from '@/modules/shared/components/AppIcon.vue';
import ExerciseLibrary from '@/modules/knowledge/components/ExerciseLibrary.vue';
import type { ExerciseCatalogItem } from '@/types';
import ErrorHandler from '@/services/errorHandler';

const exercises = ref<ExerciseCatalogItem[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

const loadLibrary = async () => {
  loading.value = true;
  error.value = null;
  try {
    const response = await cachedApiClient.getExerciseCatalog();
    // Handle both array and object response format just in case
    exercises.value = Array.isArray(response) ? response : (response as any).items || [];
  } catch (err: any) {
    error.value = 'Failed to load library';
    ErrorHandler.handleWithToast(err, 'LibraryPage.loadLibrary');
  } finally {
    loading.value = false;
  }
};

const openExerciseDetails = (exercise: ExerciseCatalogItem) => {
  // TODO: Navigate to exercise details or open modal
  console.log('Open exercise:', exercise.title);
  // Initial implementation: functional placeholder
};

const handleToggleFavorite = async (exerciseKey: string) => {
  // TODO: Implement API call to save favorite
  console.log('Toggle favorite:', exerciseKey);
};

onMounted(() => {
  loadLibrary();
});
</script>

<style scoped>
.library-page {
  position: relative;
  gap: var(--space-lg);
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

/* Background */
.page-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}
.page-bg__grid {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
  background-size: 28px 28px;
}
.page-bg__glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.25;
}
.page-bg__glow--1 { width: 180px; height: 180px; top: -40px; right: -20px; background: var(--color-accent); }
.page-bg__glow--2 { width: 140px; height: 140px; bottom: 25%; left: -30px; background: #a855f7; }

.center-msg {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
  color: var(--color-text-secondary);
}

.library-container {
  display: flex;
  flex-direction: column;
  width: 100%;
}
</style>
