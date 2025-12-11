<template>
  <div class="discipline-card-wrapper">
    <BaseCard
      ref="cardRef"
      class="program-card-interactive"
      :class="{ 'program-card-interactive--locked': program.locked }"
      hoverable
      :style="styles"
      @click="onClick"
      @mousemove="onMouseMove"
      @mouseleave="onMouseLeave"
    >
      <div class="program-title">{{ program.title || '' }}</div>
      <div v-if="program.subtitle" class="program-subtitle">{{ program.subtitle }}</div>
    </BaseCard>

    <button
      v-if="!flipped"
      type="button"
      class="program-button__nav program-button__nav--left"
      :disabled="!hasPrev"
      @click.stop="$emit('prev')"
    >
      ‹
    </button>
    <button
      v-if="!flipped"
      type="button"
      class="program-button__nav program-button__nav--right"
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
import type { DisplayProgram } from '@/types/exercises-page';

const props = defineProps<{
  program: DisplayProgram;
  styles?: StyleValue;
  flipped?: boolean;
  hasPrev?: boolean;
  hasNext?: boolean;
}>();

const emit = defineEmits<{
  (e: 'click', program: DisplayProgram): void;
  (e: 'prev'): void;
  (e: 'next'): void;
  (e: 'card-mousemove', event: MouseEvent): void;
  (e: 'card-mouseleave'): void;
}>();

const cardRef = ref<InstanceType<typeof BaseCard> | null>(null);

// Expose the underlying card element for SwipeGesture in parent
defineExpose({
  cardElement: computed(() => cardRef.value?.$el)
});

const onClick = () => {
  if (!props.program.locked) {
    emit('click', props.program);
  }
};

const onMouseMove = (event: MouseEvent) => {
  if (!props.program.locked) {
    emit('card-mousemove', event);
  }
};

const onMouseLeave = () => {
  if (!props.program.locked) {
    emit('card-mouseleave');
  }
};
</script>

<style scoped>
/* Карточка направления - компактный дизайн с плавной сменой цветов */
.program-card-interactive :deep(.base-card__content) {
  position: relative;
  width: 100%;
  min-height: 180px; /* Компактнее */
  padding: 1.5rem 1.25rem; /* Меньше padding */
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.program-card-interactive {
  position: relative;
  width: 100%;
  min-height: 180px; /* Компактнее */
  cursor: pointer;
  /* Простой solid фон без градиентов и паттернов */
  background: var(--color-bg-card);
  border: 1.5px solid var(--program-border-color, var(--color-border)) !important;
  border-radius: var(--radius-xl) !important;
  color: var(--program-title-color, var(--color-text-primary));
  /* 3D Transform Support */
  transform-style: preserve-3d;
  backface-visibility: hidden;
  will-change: transform;
  touch-action: pan-y pinch-zoom;
  transition: 
    border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: var(--shadow-md);
  opacity: 1 !important;
  transform: translateY(0) scale(1) !important;
}

.program-card-interactive:not(.program-card-interactive--locked):hover {
  box-shadow: var(--shadow-lg);
  border-color: var(--color-accent) !important;
}

.program-card-interactive--locked {
  cursor: default;
  opacity: 0.65;
  pointer-events: none;
}

/* Типографика */
.program-title {
  font-family: var(--font-family-base, 'Inter', 'Roboto Flex', 'Google Sans', sans-serif);
  font-size: clamp(1.625rem, 4.5vw, 2rem);
  font-weight: 600;
  color: var(--program-title-color, var(--color-text-primary, #f4f4f5));
  text-align: center;
  line-height: 1.25;
  width: 100%;
  margin: 0;
  letter-spacing: -0.015em;
  /* Плавная смена цвета текста */
  transition: color 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  backface-visibility: hidden;
  /* Добавляем тень для лучшей читаемости */
  text-shadow: var(--text-shadow-md);
}

.program-subtitle {
  font-family: var(--font-family-base, 'Inter', 'Roboto Flex', 'Google Sans', sans-serif);
  font-size: clamp(0.9375rem, 2.8vw, 1.0625rem);
  font-weight: 400;
  color: var(--program-subtitle-color, var(--color-text-secondary));
  text-align: center;
  line-height: 1.6;
  width: 100%;
  margin: 0;
  letter-spacing: 0.01em;
  max-width: 90%;
  margin-left: auto;
  margin-right: auto;
  opacity: 0.95;
  /* Добавляем тень для читаемости */
  text-shadow: var(--text-shadow-sm);
}

/* Навигационные стрелки */
.program-button__nav {
  position: absolute;
  top: 1rem;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--program-nav-color, var(--color-accent, #10A37F)) 35%, transparent);
  background: color-mix(in srgb, var(--color-bg, #050505) 45%, var(--overlay-strong));
  color: var(--program-nav-color, var(--color-accent, #10A37F));
  font-size: 1.125rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 3;
  box-shadow: 
    0 8px 20px rgba(3, 5, 10, 0.45),
    0 4px 12px rgba(3, 5, 10, 0.35),
    inset 0 1px 0 var(--overlay-medium);
  backdrop-filter: blur(18px) saturate(185%);
  -webkit-backdrop-filter: blur(18px) saturate(185%);
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.program-button__nav--left {
  left: 1rem;
}

.program-button__nav--right {
  right: 1rem;
}

.program-button__nav:hover {
  background: var(--program-nav-color, #10A37F);
  color: var(--color-text-inverse);
  transform: translateY(-1px) scale(1.05);
  box-shadow: 
    0 4px 12px rgba(16, 163, 127, 0.25),
    0 2px 6px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 var(--overlay-strong);
}

.program-button__nav:active,
.program-button__nav:focus {
  background: var(--program-nav-color, #10A37F);
  color: var(--color-text-inverse);
  transform: translateY(0) scale(1);
  box-shadow: 
    0 4px 12px rgba(16, 163, 127, 0.3),
    0 2px 6px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 var(--overlay-strong);
}

.program-button__nav:focus-visible {
  outline: none;
  box-shadow: 
    0 0 0 3px color-mix(in srgb, var(--program-nav-color, #10A37F) 30%, transparent),
    0 2px 8px rgba(0, 0, 0, 0.06),
    0 1px 3px rgba(0, 0, 0, 0.08);
}

.program-button__nav:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  color: color-mix(in srgb, var(--program-nav-color, var(--color-accent, #10A37F)) 45%, transparent);
  background: color-mix(in srgb, var(--color-bg, #050505) 70%, var(--overlay-medium));
  box-shadow: inset 0 1px 0 var(--overlay-light);
}

.discipline-card-wrapper {
  position: relative;
  width: 100%;
}
</style>
