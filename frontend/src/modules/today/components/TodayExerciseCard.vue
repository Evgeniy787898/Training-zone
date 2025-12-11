<template>
  <BaseCard
    tag="article"
    class="exercise-card"
    hoverable
    :class="{
      'exercise-card--achieved': status === 'success',
      'exercise-card--spark': isSparkActive
    }"
  >
    <span
      v-if="isSparkActive"
      class="exercise-card__spark"
      aria-hidden="true"
    ></span>
    
    <div class="exercise-card__media" v-if="card.images.length">
      <OptimizedImage
        v-if="currentImage"
        :src="currentImage.src || ''"
        :srcset="currentImage.srcset || undefined"
        :sizes="currentImage.sizes || CARD_IMAGE_SIZES"
        :fetchpriority="fetchPriority"
        :alt="`Пример выполнения: ${card.levelLabel}`"
        loading="lazy"
        decoding="async"
      />
      <div class="exercise-card__dots" role="tablist">
        <button
          v-for="(_, index) in card.images"
          :key="index"
          type="button"
          class="exercise-card__dot"
          :class="{ 'exercise-card__dot--active': mediaIndex === index }"
          @click.stop="setMediaIndex(index)"
          :aria-label="`Показать фото ${index + 1}`"
        ></button>
      </div>
    </div>
    <div v-else class="exercise-card__media exercise-card__media--empty">
      <span>Без изображения</span>
    </div>
    
    <div class="exercise-card__body">
      <h3 class="exercise-card__title">{{ card.levelLabel }}</h3>
      <p v-if="card.tierLabel" class="exercise-card__tier">{{ card.tierLabel }}</p>
      <p class="exercise-card__sets">{{ card.sets }} подход(а) × {{ card.reps }} повторений</p>
    </div>
  </BaseCard>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import OptimizedImage from '@/modules/shared/components/OptimizedImage.vue';
import type { ExerciseCard } from '@/types/today';
import type { ExerciseImageSource } from '@/utils/exerciseImages';
import { CARD_IMAGE_SIZES } from '@/constants/today';

const props = defineProps<{
  card: ExerciseCard;
  status?: 'pending' | 'success' | 'danger';
  isSparkActive?: boolean;
  fetchPriority?: 'high' | 'low' | 'auto';
}>();

const mediaIndex = ref(0);

const currentImage = computed<ExerciseImageSource | null>(() => {
  if (!props.card.images.length) return null;
  const index = mediaIndex.value;
  const clamped = Math.max(0, Math.min(index, props.card.images.length - 1));
  return props.card.images[clamped] ?? null;
});

const setMediaIndex = (index: number) => {
  mediaIndex.value = index;
};
</script>

<style scoped>
.exercise-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.exercise-card--achieved {
  border: 1px solid color-mix(in srgb, var(--color-success) 45%, transparent);
  box-shadow: 0 12px 24px -18px color-mix(in srgb, var(--color-success) 60%, transparent);
}

.exercise-card__spark {
  position: absolute;
  top: -14px;
  right: -14px;
  width: 42px;
  height: 42px;
  pointer-events: none;
  background: radial-gradient(circle, color-mix(in srgb, var(--color-accent) 70%, transparent) 0%, transparent 70%);
  opacity: 0;
  transform: scale(0.6) rotate(0deg);
  animation: spark-burst 0.9s ease-out forwards;
}

.exercise-card__media {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--color-surface);
  display: flex;
  align-items: center;
  justify-content: center;
}

.exercise-card__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.exercise-card__media--empty {
  color: var(--color-text-muted);
  font-size: clamp(0.85rem, 2vw, 0.95rem);
}

.exercise-card__dots {
  position: absolute;
  bottom: 0.5rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: var(--space-xs);  /* 0.4→0.5 */
}

.exercise-card__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-border) 70%, transparent);
  border: none;
  cursor: pointer;
}

.exercise-card__dot--active {
  background: var(--color-accent);
}

.exercise-card__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
}

.exercise-card__title {
  margin: 0;
  font-size: clamp(1rem, 2.4vw, 1.2rem);
  font-weight: 600;
}

.exercise-card__tier {
  margin: 0;
  font-size: clamp(0.8rem, 2vw, 0.9rem);
  color: color-mix(in srgb, var(--color-text-secondary) 80%, transparent);
}

.exercise-card__sets {
  margin: 0;
  font-size: clamp(0.85rem, 2vw, 0.95rem);
  color: var(--color-text-secondary);
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
