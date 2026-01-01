<template>
  <div 
    ref="listContainer" 
    class="exercises-container"
    :class="{ 'exercises-container--visible': visible }"
  >
    <transition
      :name="slideDirection === 'next' ? 'program-slide-next' : 'program-slide-prev'"
      mode="out-in"
    >
      <template v-if="loading">
        <div key="loading" class="exercises-list">
          <SkeletonExercise
            v-for="i in 3"
            :key="`skeleton-exercise-${i}`"
          />
        </div>
      </template>
      
      <template v-else-if="error">
        <ErrorState
          key="exercises-error"
          :message="error"
          action-label="Обновить"
          @retry="$emit('retry')"
        />
      </template>

      <template v-else-if="exercises.length > 0">
        <!-- Infinite Scroll List -->
        <div 
          key="list" 
          ref="scrollContainer"
          class="exercises-list exercises-list--scrollable"
        >
            <ProgramExerciseCard
              v-for="{ exercise, index: realIndex } in visibleExercises"
              :key="exercise.id"
              :exercise="exercise"
              :index="realIndex"
              :styles="cardStyles[realIndex]"
              :is-expanded="expandedIconId === exercise.id"
              @click="onCardClick"
              @icon-click="onIconClick"
              @card-mouseenter="onCardMouseEnter"
              @card-mousemove="onCardMouseMove"
              @card-mouseleave="onCardMouseLeave"
            />
            
            <!-- Sentinel for infinite scroll -->
            <div ref="sentinelRef" class="exercises-sentinel">
               <div v-if="hasMore" class="exercises-loading-spinner"></div>
            </div>
        </div>
      </template>

      <template v-else>
        <div class="exercises-empty">
          <div class="exercises-empty__icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 11H5M19 11C20.1046 11 21 11.8954 21 11V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V13C3 11.8954 3.89543 11 5 11M19 11V9C19 7.89543 18.1046 7 17 7M5 11V9C5 7.89543 5.89543 7 7 7M7 7V5C7 3.89543 7.89543 3 9 3H15C16.1046 3 17 3.89543 17 5V7M7 7H17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h3 class="exercises-empty__text">В этой программе нет упражнений</h3>
        </div>
      </template>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, type StyleValue } from 'vue';

import ErrorState from '@/modules/shared/components/ErrorState.vue';
import SkeletonExercise from '@/modules/shared/components/SkeletonExercise.vue';
import ProgramExerciseCard from '@/modules/exercises/components/ProgramExerciseCard.vue';
import { useIntersectionObserverSimple } from '@/composables/useIntersectionObserver';
import type { ProgramExercise } from '@/types/exercises-page';

interface VisibleExercise {
  exercise: ProgramExercise;
  index: number;
}

const props = defineProps<{
  exercises: ProgramExercise[];
  visibleExercises: VisibleExercise[];
  hasMore?: boolean;
  cardStyles: StyleValue[]; // Array of styles map
  loading?: boolean;
  error?: string | null;
  visible?: boolean;
  slideDirection?: string;
  getCard3DStyle: (id: string) => StyleValue;
}>();

const emit = defineEmits<{
  (e: 'retry'): void;
  (e: 'click', exercise: ProgramExercise): void;
  (e: 'card-mouseenter', exercise: ProgramExercise): void;
  (e: 'card-mousemove', event: MouseEvent, exercise: ProgramExercise): void;
  (e: 'card-mouseleave', exercise: ProgramExercise): void;
  (e: 'card-touchstart', exercise: ProgramExercise): void;
  (e: 'load-more'): void;
}>();

const listContainer = ref<HTMLElement | null>(null);
const scrollContainer = ref<HTMLElement | null>(null);
const sentinelRef = ref<HTMLElement | null>(null);

// UI State for expanding icons
const expandedIconId = ref<string | null>(null);
const expandedIconTimeout = ref<number | null>(null);

// Sentinel Observer
useIntersectionObserverSimple(sentinelRef, (isIntersecting) => {
  if (isIntersecting && props.hasMore) {
    emit('load-more');
  }
}, { rootMargin: '200px' });

// Expose container ref for parent's logic
defineExpose({
  exercisesListElement: computed(() => listContainer.value),
  scrollElement: computed(() => scrollContainer.value)
});

// Logic
const onIconClick = (exercise: ProgramExercise) => {
  if (expandedIconId.value === exercise.id) {
    expandedIconId.value = null;
    if (expandedIconTimeout.value) {
        clearTimeout(expandedIconTimeout.value);
        expandedIconTimeout.value = null;
    }
  } else {
    expandedIconId.value = exercise.id;
    if (expandedIconTimeout.value) clearTimeout(expandedIconTimeout.value);
    expandedIconTimeout.value = window.setTimeout(() => {
        expandedIconId.value = null;
    }, 3000);
  }
};

const onCardClick = (_event: MouseEvent, exercise: ProgramExercise) => {
  emit('click', exercise);
};

const onCardMouseEnter = (exercise: ProgramExercise) => {
  emit('card-mouseenter', exercise);
};

const onCardMouseMove = (event: MouseEvent, exercise: ProgramExercise) => {
  emit('card-mousemove', event, exercise);
};

const onCardMouseLeave = (exercise: ProgramExercise) => {
  emit('card-mouseleave', exercise);
  if (expandedIconTimeout.value) { 
  }
};
</script>

<script lang="ts">
  // Additional exports if needed
</script>

<style scoped>
/* Exercises Section Styles */
.exercises-container {
  position: relative;
  width: 100%;
  min-height: 120px;
  opacity: 0;
  transition: opacity 0.5s ease;
}

.exercises-container--visible {
  opacity: 1;
}

.exercises-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 3vw;
  width: 100%;
  position: relative;
  padding: 3vw 3vw var(--space-xl);
}

/* Scrollable Container */
.exercises-list--scrollable {
  max-height: 600px;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: var(--scroll-thumb-color-active, rgba(32, 33, 35, 0.35)) transparent;
  scroll-behavior: smooth;
}

.exercises-list--scrollable::-webkit-scrollbar {
  width: 6px;
}
.exercises-list--scrollable::-webkit-scrollbar-track {
  background: transparent;
}
.exercises-list--scrollable::-webkit-scrollbar-thumb {
  background-color: var(--scroll-thumb-color-active, rgba(32, 33, 35, 0.35));
  border-radius: 3px;
  transition: background-color 0.2s ease;
}
.exercises-list--scrollable::-webkit-scrollbar-thumb:hover {
  background-color: var(--scroll-thumb-color-hover, rgba(32, 33, 35, 0.45));
}

.exercises-sentinel {
  grid-column: 1 / -1;
  height: 20px;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 10px 0;
}

.exercises-loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Empty State */
.exercises-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4.854rem 2.618rem;
  text-align: center;
}

.exercises-empty__icon {
  margin-bottom: 1.309rem;
  color: rgba(156, 163, 175, 0.4);
}

.exercises-empty__text {
  color: var(--color-text-secondary, #6B7280);
  font-size: clamp(0.96875rem, 3.2vw, 1.0625rem);
  font-weight: 500;
}

@media (max-width: 768px) {
  .program-exercise-card {
    padding: var(--space-md) var(--space-sm);
    min-height: 140px;
  }
}
</style>
