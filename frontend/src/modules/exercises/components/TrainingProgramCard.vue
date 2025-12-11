<template>
  <div class="training-program-card-wrapper">
    <BaseCard
      ref="cardRef"
      class="training-program-card training-program-card--back"
      :class="{ 'training-program-card--is-active': isActive }"
      hoverable
      :style="styles"
      @mousemove="onMouseMove"
      @mouseleave="onMouseLeave"
    >
      <div class="training-program-content">
        <div class="training-program-title">{{ program.name }}</div>
        <div v-if="program.description" class="training-program-description">{{ program.description }}</div>
        
        <div class="program-actions">
          <!-- When active, show simple text indicator instead of huge checkbox -->
          <span v-if="isActive" class="active-indicator">Текущая программа</span>
          <button
            v-else
            class="activate-btn"
            :disabled="isActivating"
            @click.stop="$emit('activate')"
          >
            {{ isActivating ? 'Сохранение...' : 'Выбрать программу' }}
          </button>
        </div>
      </div>
    </BaseCard>

    <button
      type="button"
      class="training-program-card__nav training-program-card__nav--left"
      :disabled="!hasPrev"
      @click.stop="$emit('prev')"
    >
      ‹
    </button>
    <button
      type="button"
      class="training-program-card__nav training-program-card__nav--right"
      :disabled="!hasNext"
      @click.stop="$emit('next')"
    >
      ›
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, type StyleValue } from 'vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import type { TrainingProgram } from '@/types/exercises-page';

defineProps<{
  program: TrainingProgram;
  styles?: StyleValue;
  hasPrev?: boolean;
  hasNext?: boolean;
  isActive?: boolean;
  isActivating?: boolean;
}>();

const emit = defineEmits<{
  (e: 'prev'): void;
  (e: 'next'): void;
  (e: 'activate'): void;
  (e: 'card-mousemove', event: MouseEvent): void;
  (e: 'card-mouseleave'): void;
}>();

const cardRef = ref<InstanceType<typeof BaseCard> | null>(null);

// Expose the underlying card element for SwipeGesture in parent
defineExpose({
  cardElement: computed(() => cardRef.value?.$el)
});

const onMouseMove = (event: MouseEvent) => {
  emit('card-mousemove', event);
};

const onMouseLeave = () => {
  emit('card-mouseleave');
};
</script>

<style scoped>
/* Карточка программы тренировок - визуальное отражение направления с 3D эффектом */
.training-program-card {
  position: relative;
  width: 100%;
  max-width: 420px;
  height: 220px;
  padding: var(--space-lg);
  background: var(--training-program-bg, var(--color-bg-secondary));
  border: 1px solid var(--training-program-border, var(--color-border));
  border-radius: var(--radius-lg);
  touch-action: pan-y pinch-zoom;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  margin: 0 auto;
  transform-style: preserve-3d;
  backface-visibility: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
  box-shadow: var(--shadow-sm);
  will-change: transform, box-shadow;
  opacity: 0;
}

.training-program-card--visible {
  opacity: 1;
  transform: translateZ(0);
}

.training-program-card--visible:hover,
.training-program-card:hover {
  border-color: var(--color-border-strong);
  box-shadow: var(--shadow-md);
  background: var(--color-bg-elevated);
}

.training-program-card--active {
  border-color: var(--training-program-border, rgba(229, 231, 235, 0.6));
  box-shadow: 
    0 4px 16px rgba(0, 0, 0, 0.08),
    0 2px 8px rgba(0, 0, 0, 0.06);
  background: var(--training-program-bg, var(--color-bg-secondary));
  opacity: 1;
}

/* Back specific override */
.training-program-card--back {
  min-height: 180px;
  display: flex !important;
  align-items: center;
  justify-content: center;
  opacity: 1 !important;
  background: var(--color-bg-card) !important;
  border: 1px solid var(--color-border) !important;
  box-shadow: none !important;
  color: var(--color-text-primary) !important;
}

.training-program-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm, 0.75rem);
  width: 100%;
  text-align: center;
  opacity: 1 !important;
  /* Ensure 3D tilt effect applies to all children */
  transform-style: preserve-3d;
  backface-visibility: hidden;
}

.training-program-title {
  font-family: var(--font-family-base, 'Inter', 'Roboto Flex', 'Google Sans', sans-serif);
  font-size: clamp(1.309rem, 3.8vw, 1.618rem);
  font-weight: 600;
  color: var(--training-program-title-color, var(--color-text-primary)); /* Override for back card usually var(--color-text-primary) directly */
  text-align: center;
  line-height: 1.3;
  width: 100%;
  margin: 0;
  letter-spacing: -0.01em;
  transition: color 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Specific override for back card from original CSS */
.training-program-card--back .training-program-title {
  color: var(--color-text-primary) !important;
  font-weight: 600;
  font-size: 1.5rem;
}

.training-program-description {
  font-family: var(--font-family-base, 'Inter', 'Roboto Flex', 'Google Sans', sans-serif);
  font-size: clamp(0.875rem, 2.6vw, 1rem);
  font-weight: 400;
  color: var(--training-program-description-color, var(--color-text-secondary));
  text-align: center;
  line-height: 1.55;
  width: 100%;
  margin: 0;
  letter-spacing: 0.005em;
  max-width: 92%;
  margin-left: auto;
  margin-right: auto;
  opacity: 0.8;
}

/* Specific override for back card */
.training-program-card--back .training-program-description {
  color: var(--color-text-secondary) !important;
  margin-top: var(--space-sm);
}

/* Nav */
.training-program-card__nav {
  position: absolute;
  bottom: 0.5rem; /* Adjusted for card height? Original was bottom 1rem, but back card is smaller? Using original styles: bottom: 1rem is from global but overrides? */
  /* Original CSS had bottom: 1rem; */
  bottom: 1rem;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--training-program-nav-color, var(--color-accent, #10A37F)) 35%, transparent);
  background: color-mix(in srgb, var(--color-bg, #050505) 45%, rgba(255, 255, 255, 0.2));
  color: var(--training-program-nav-color, var(--training-program-title-color, #10A37F));
  font-size: 1.125rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 3;
  box-shadow: 
    0 2px 8px rgba(0, 0, 0, 0.06),
    0 1px 3px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(18px) saturate(185%);
  -webkit-backdrop-filter: blur(18px) saturate(185%);
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.training-program-card__nav--left {
  left: 1rem;
}

.training-program-card__nav--right {
  right: 1rem;
}

.training-program-card__nav:hover {
  background: var(--training-program-nav-color, #10A37F);
  color: var(--color-text-inverse);
  transform: translateY(-1px) scale(1.05);
  box-shadow: 
    0 4px 12px rgba(16, 163, 127, 0.25),
    0 2px 6px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.training-program-card__nav:active,
.training-program-card__nav:focus {
  background: var(--training-program-nav-color, var(--training-program-title-color, #10A37F));
  color: var(--color-text-inverse);
  transform: translateY(0) scale(1);
  box-shadow: 
    0 4px 12px rgba(16, 163, 127, 0.3),
    0 2px 6px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.training-program-card__nav:focus-visible {
  outline: none;
  box-shadow: 
    0 0 0 3px color-mix(in srgb, var(--training-program-nav-color, #10A37F) 30%, transparent),
    0 2px 8px rgba(0, 0, 0, 0.06),
    0 1px 3px rgba(0, 0, 0, 0.08);
}

.training-program-card__nav:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  color: color-mix(in srgb, var(--training-program-nav-color, #10A37F) 45%, transparent);
  background: color-mix(in srgb, var(--color-bg, #050505) 70%, rgba(255, 255, 255, 0.08));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.training-program-card-wrapper {
  position: relative;
  width: 100%;
  display: flex;
  justify-content: center;
}

@media (max-width: 768px) {
  .training-program-card {
    height: auto;
    min-height: 180px;
    padding: var(--space-md);
  }
}

.program-actions {
  margin-top: 1.5rem;
  display: flex;
  justify-content: center;
  width: 100%;
}

/* Simple text indicator for active program */
.active-indicator {
  padding: 0.5rem 1rem;
  color: var(--color-accent);
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Active card state - accent border */
.training-program-card--is-active {
  border-color: var(--color-accent) !important;
  box-shadow: 0 0 20px color-mix(in srgb, var(--color-accent) 25%, transparent) !important;
}

.activate-btn {
  padding: 0.5rem 1.25rem;
  background: var(--color-primary);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-full);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: var(--shadow-sm);
}

.activate-btn:hover:not(:disabled) {
  background: var(--color-primary-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.activate-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>
