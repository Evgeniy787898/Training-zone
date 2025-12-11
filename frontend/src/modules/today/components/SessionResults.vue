<template>
  <section class="results-list" aria-label="Фиксация результатов">
    <article
      v-for="card in cards"
      :key="card.key"
      class="results-row"
      :class="[
        `results-row--${evaluateResultStatus(card, modelValue[card.key] ?? 0)}`,
        { 'results-row--spark': isSparkActive(card.key) }
      ]"
    >
      <span
        v-if="isSparkActive(card.key)"
        class="results-row__spark"
        aria-hidden="true"
      ></span>
      <div class="results-row__info">
        <h4>{{ card.levelLabel }}</h4>
        <span>Цель: {{ card.sets }} × {{ card.reps }}</span>
      </div>
      <div class="results-row__input">
        <label :for="`result-${card.key}`">Выполнено</label>
        <input
          :id="`result-${card.key}`"
          type="number"
          min="0"
          :value="modelValue[card.key] ?? 0"
          :placeholder="String(card.reps)"
          @input="onInput(card.key, $event)"
        />
      </div>
    </article>
  </section>
</template>

<script setup lang="ts">
import type { ExerciseCard } from '@/types/today';
import { evaluateResultStatus } from '@/utils/resultLogic';
import { hapticLight } from '@/utils/hapticFeedback';

const props = defineProps<{
  cards: ExerciseCard[];
  modelValue: Record<string, number>;
  isSparkActive: (key: string) => boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: Record<string, number>): void;
}>();

const onInput = (key: string, event: Event) => {
  hapticLight();
  const next = Number((event.target as HTMLInputElement).value) || 0;
  emit('update:modelValue', { ...props.modelValue, [key]: next });
};
</script>

<style scoped>
.results-list {
  display: flex;
  flex-direction: column;
  gap: clamp(0.85rem, 2vw, 1rem);
}

.results-row {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: clamp(0.85rem, 2vw, 1rem);
  padding: clamp(0.75rem, 2vw, 1rem);
  border-radius: var(--radius-lg);
  border: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent);
  background: color-mix(in srgb, var(--color-surface) 55%, transparent);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.results-row--pending {
  border-color: color-mix(in srgb, var(--color-border) 80%, transparent);
}

.results-row--success {
  border-color: color-mix(in srgb, var(--color-success) 45%, transparent);
  background: color-mix(in srgb, var(--color-success-soft) 35%, transparent);
}

.results-row--danger {
  border-color: color-mix(in srgb, var(--color-danger) 35%, transparent);
  background: color-mix(in srgb, var(--color-danger-soft) 30%, transparent);
}

.results-row--spark {
  box-shadow: 0 12px 24px -18px color-mix(in srgb, var(--color-accent) 55%, transparent);
}

.results-row__spark {
  position: absolute;
  top: -10px;
  right: -10px;
  width: 32px;
  height: 32px;
  pointer-events: none;
  background: radial-gradient(circle, color-mix(in srgb, var(--color-accent) 70%, transparent) 0%, transparent 70%);
  opacity: 0;
  transform: scale(0.6) rotate(0deg);
  animation: spark-burst 0.9s ease-out forwards;
}

.results-row__info {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
}

.results-row__info h4 {
  margin: 0;
  font-size: clamp(0.95rem, 2vw, 1.05rem);
}

.results-row__info span {
  color: var(--color-text-secondary);
}

.results-row__input {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
  font-size: clamp(0.8rem, 2vw, 0.9rem);
}

.results-row__input input {
  border-radius: var(--radius-md);
  border: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent);
  padding: var(--space-xs) var(--space-sm);  /* 0.4→0.5, 0.6→0.75 */
  font-size: clamp(0.85rem, 2vw, 0.95rem);
  width: min(140px, 40vw);
}

@keyframes spark-burst {
  0% {
    opacity: 0;
    transform: scale(0.4) rotate(0deg);
  }
  30% {
    opacity: 1;
    transform: scale(1) rotate(12deg);
  }
  70% {
    opacity: 0.75;
    transform: scale(0.85) rotate(-8deg);
  }
  100% {
    opacity: 0;
    transform: scale(1.15) rotate(4deg);
  }
}
</style>
