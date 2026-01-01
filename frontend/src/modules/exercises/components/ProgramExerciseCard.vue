<template>
  <div
    class="exercise-card"
    :class="{ 'exercise-card--expanded': isExpanded }"
    :style="styles"
    @click="onClick"
    @mouseenter="onMouseEnter"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
  >
    <!-- Primary image fills the card -->
    <div class="exercise-card__image-wrapper">
      <img 
        v-if="exercise.iconUrl"
        :src="exercise.iconUrl"
        :alt="exercise.title"
        class="exercise-card__image"
        loading="lazy"
      />
      <div v-else class="exercise-card__placeholder">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
          <path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
    </div>
    
    <!-- Title label at bottom -->
    <div class="exercise-card__label">
      <span class="exercise-card__title">{{ exercise.title }}</span>
    </div>
    
    <!-- Expand button (if has second image) -->
    <button 
      v-if="exercise.iconUrlHover" 
      class="exercise-card__expand-btn"
      @click.stop="onIconClick"
      aria-label="Показать детали"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
      </svg>
    </button>

    <!-- Expanded state - shows secondary image -->
    <template v-if="isExpanded && exercise.iconUrlHover">
      <div class="exercise-card__expanded-overlay">
        <img 
          :src="exercise.iconUrlHover" 
          :alt="exercise.title" 
          class="exercise-card__expanded-image"
        />
        <div class="exercise-card__expanded-label">
          <span>{{ exercise.title }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { type StyleValue } from 'vue';
import type { ProgramExercise } from '@/types/exercises-page';

const props = defineProps<{
  exercise: ProgramExercise;
  index: number;
  styles?: StyleValue;
  isExpanded?: boolean;
}>();

const emit = defineEmits<{
  (e: 'click', event: MouseEvent, exercise: ProgramExercise): void;
  (e: 'icon-click', exercise: ProgramExercise): void;
  (e: 'card-mouseenter', exercise: ProgramExercise): void;
  (e: 'card-mousemove', event: MouseEvent, exercise: ProgramExercise): void;
  (e: 'card-mouseleave', exercise: ProgramExercise): void;
}>();

const onClick = (event: MouseEvent) => {
  emit('click', event, props.exercise);
};

const onIconClick = () => {
  emit('icon-click', props.exercise);
};

const onMouseEnter = () => {
  emit('card-mouseenter', props.exercise);
};

const onMouseMove = (event: MouseEvent) => {
  emit('card-mousemove', event, props.exercise);
};

const onMouseLeave = () => {
  emit('card-mouseleave', props.exercise);
};
</script>

<style scoped>
/* Card container - NO transforms to prevent overlap */
.exercise-card {
  position: relative;
  aspect-ratio: 1 / 1;
  width: 100%;
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  background: #1a1a1f;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  box-sizing: border-box;
}

/* Fallback for browsers without aspect-ratio support */
@supports not (aspect-ratio: 1 / 1) {
  .exercise-card {
    height: 0;
    padding-bottom: 100%;
  }
}

.exercise-card:hover {
  border-color: rgba(255, 255, 255, 0.2);
}

/* Image fills entire card */
.exercise-card__image-wrapper {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, #1a1a1f 0%, #0f0f12 100%);
}

.exercise-card__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.exercise-card__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: rgba(255, 255, 255, 0.25);
}

/* Title overlay at bottom */
.exercise-card__label {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 24px 8px 8px;
  background: linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.8) 60%, rgba(0, 0, 0, 0.95) 100%);
  pointer-events: none;
}

.exercise-card__title {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 0.75rem;
  font-weight: 600;
  color: #fff;
  text-align: center;
  line-height: 1.3;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}

/* Expand button (top-right corner) */
.exercise-card__expand-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.exercise-card:hover .exercise-card__expand-btn {
  opacity: 1;
}

.exercise-card__expand-btn:hover {
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
}

/* Expanded state overlay */
.exercise-card--expanded {
  z-index: 10;
  border-color: var(--color-accent, #10A37F);
}

.exercise-card__expanded-overlay {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  flex-direction: column;
  background: linear-gradient(145deg, #1a1a1f 0%, #0f0f12 100%);
}

.exercise-card__expanded-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.exercise-card__expanded-label {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 8px;
  background: linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.85) 100%);
  text-align: center;
  font-size: 0.8rem;
  font-weight: 600;
  color: #fff;
}

/* Responsive */
@media (min-width: 480px) {
  .exercise-card {
    border-radius: 20px;
  }
  
  .exercise-card__title {
    font-size: 0.8rem;
  }
}
</style>
