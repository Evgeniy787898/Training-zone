<template>
  <BaseCard
    class="program-exercise-card"
    :class="{ 'program-exercise-card--expanded': isExpanded }"
    hoverable
    :style="styles"
    @click="onClick"
    @mouseenter="onMouseEnter"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
  >
    <div 
      class="program-exercise-icon"
      :class="{ 'program-exercise-icon--has-image': exercise.iconUrl }"
      @click.stop="onIconClick"
    >
      <img 
        v-if="exercise.iconUrl"
        :src="exercise.iconUrl"
        :alt="exercise.title"
        class="program-exercise-icon__img"
      />
      <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
        <path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </div>
    
    <div class="program-exercise-content">
      <div 
        class="program-exercise-title text-fade-in" 
        :style="{ '--delay': `${index * 50}ms` }"
      >
        {{ exercise.title }}
      </div>
      <div 
        v-if="exercise.description" 
        class="program-exercise-description text-fade-in" 
        :style="{ '--delay': `${index * 50 + 100}ms` }"
      >
        {{ exercise.description }}
      </div>
    </div>

    <template v-if="isExpanded && exercise.iconUrlHover">
      <div class="program-exercise-expanded-bg">
        <img :src="exercise.iconUrlHover" alt="" class="program-exercise-expanded-bg__img"/>
      </div>
      <img :src="exercise.iconUrlHover" :alt="exercise.title" class="program-exercise-expanded-img"/>
    </template>
  </BaseCard>
</template>

<script setup lang="ts">
import { type StyleValue } from 'vue';
import BaseCard from '@/components/ui/BaseCard.vue';
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
/* Card Styles */
.program-exercise-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  padding: var(--space-sm);
  background: linear-gradient(145deg, rgba(35, 35, 40, 0.95) 0%, rgba(25, 25, 30, 0.98) 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 32px;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  position: relative;
  z-index: 1;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  will-change: transform, box-shadow;
  overflow: hidden;
  aspect-ratio: 1;
  height: auto;
  min-height: 0;
}

.program-exercise-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: var(--radius-xl);
  background: radial-gradient(circle at 50% 0%, var(--exercise-card-color, var(--color-accent)) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 0.4s ease;
  pointer-events: none;
  z-index: -1;
}

.program-exercise-card:hover {
  border-color: rgba(255, 255, 255, 0.3);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.12);
  transform: translateY(-6px) scale(1.02);
  z-index: 10;
}

.program-exercise-card:hover::before {
  opacity: 0.15;
}

.program-exercise-card:active {
  transform: translateY(-3px) scale(1.01);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
}

.program-exercise-icon {
  margin: 0 auto;
  margin-bottom: 8px;
  width: 80px;
  height: 80px;
  min-width: 80px;
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1a1f;
  color: var(--exercise-card-color, var(--color-accent));
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.15);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  position: relative;
  overflow: hidden;
}

.program-exercise-card:hover .program-exercise-icon {
  transform: scale(1.08);
  border-color: var(--exercise-card-color, var(--color-accent));
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35), 0 0 20px var(--color-accent-light, rgba(16, 163, 127, 0.2)), inset 0 1px 0 rgba(255, 255, 255, 0.12);
}

.program-exercise-icon__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: #1a1a1f;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.program-exercise-icon--has-image {
  background: #1a1a1f;
  padding: 0;
}

.program-exercise-card:hover .program-exercise-icon--has-image .program-exercise-icon__img {
  transform: scale(1.1);
}

.program-exercise-content {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  text-align: center;
  padding: 0 4px;
}

.program-exercise-title {
  font-family: var(--font-family-base, 'Inter', 'Roboto Flex', 'Google Sans', sans-serif);
  font-size: clamp(0.9375rem, 2.8vw, 1.0625rem);
  font-weight: 600;
  color: var(--color-text-primary, #f4f4f5);
  line-height: 1.3;
  letter-spacing: -0.01em;
  transition: color 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.program-exercise-description {
  font-family: var(--font-family-base, 'Inter', 'Roboto Flex', 'Google Sans', sans-serif);
  font-size: clamp(0.75rem, 2.2vw, 0.875rem);
  font-weight: 400;
  color: var(--color-text-secondary, rgba(244, 244, 245, 0.7));
  line-height: 1.45;
  letter-spacing: 0.005em;
  opacity: 0.85;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Expanded State */
.program-exercise-card--expanded {
  z-index: 50 !important;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent), 0 16px 48px rgba(0, 0, 0, 0.5);
}

.program-exercise-card--expanded .program-exercise-content,
.program-exercise-card--expanded .program-exercise-icon {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.program-exercise-expanded-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 100;
  object-fit: contain;
  background: transparent;
  border-radius: inherit;
  animation: expandIn 0.2s ease-out forwards;
}

.program-exercise-expanded-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 90;
  overflow: hidden;
  border-radius: inherit;
  background: #000;
}

.program-exercise-expanded-bg__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(20px) brightness(0.7);
  transform: scale(1.2);
  opacity: 0;
  animation: fadeInBg 0.4s ease-out forwards;
}

@keyframes fadeInBg { from { opacity: 0; } to { opacity: 1; } }
@keyframes expandIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
@keyframes textFadeInStagger { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

.text-fade-in {
  animation: textFadeInStagger 0.6s cubic-bezier(0.4, 0, 0.2, 1) both;
  animation-delay: var(--delay, 0ms);
  opacity: 0;
}
</style>
