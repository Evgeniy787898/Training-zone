<template>
  <div class="exercise-card-wrapper">
    <BaseCard
      tag="article"
      class="exercise-card"
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
          @click="openZoom"
        />
        
        <!-- Arrow Navigation -->
        <div v-if="card.images.length > 1" class="exercise-card__nav">
          <button
            type="button"
            class="exercise-card__nav-btn"
            :disabled="mediaIndex === 0"
            @click.stop="prevImage"
            aria-label="Предыдущее фото"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <span class="exercise-card__nav-counter">{{ mediaIndex + 1 }}/{{ card.images.length }}</span>
          <button
            type="button"
            class="exercise-card__nav-btn"
            :disabled="mediaIndex === card.images.length - 1"
            @click.stop="nextImage"
            aria-label="Следующее фото"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
      <div v-else class="exercise-card__media exercise-card__media--empty">
        <span>Без изображения</span>
      </div>
      
      <div class="exercise-card__body">
        <h3 class="exercise-card__title">{{ card.levelTitle || card.levelLabel }}</h3>
        <p v-if="card.tierLabel" class="exercise-card__tier">{{ card.tierLabel }}</p>
        <p class="exercise-card__sets">{{ card.sets }} подход(а) × {{ card.reps }} повторений</p>
      </div>
    </BaseCard>

    <!-- Image Zoom Modal -->
    <ImageZoom
      :is-open="isZoomOpen"
      :src="zoomImageSrc"
      :images="zoomImages.length > 1 ? zoomImages : undefined"
      :initial-index="mediaIndex"
      @close="closeZoom"
      @image-change="handleZoomImageChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import OptimizedImage from '@/modules/shared/components/OptimizedImage.vue';
import ImageZoom from '@/modules/shared/components/ImageZoom.vue';
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

// Zoom state
const isZoomOpen = ref(false);
const zoomImageSrc = ref('');
const zoomImages = computed(() => props.card.images.map(img => img.src || ''));

const currentImage = computed<ExerciseImageSource | null>(() => {
  if (!props.card.images.length) return null;
  const index = mediaIndex.value;
  const clamped = Math.max(0, Math.min(index, props.card.images.length - 1));
  return props.card.images[clamped] ?? null;
});

const prevImage = () => {
  if (mediaIndex.value > 0) {
    mediaIndex.value--;
  }
};

const nextImage = () => {
  if (mediaIndex.value < props.card.images.length - 1) {
    mediaIndex.value++;
  }
};

const openZoom = () => {
  if (!props.card.images.length) return;
  zoomImageSrc.value = currentImage.value?.src || '';
  isZoomOpen.value = true;
};

const closeZoom = () => {
  isZoomOpen.value = false;
};

const handleZoomImageChange = (index: number) => {
  mediaIndex.value = index;
  zoomImageSrc.value = zoomImages.value[index] || '';
};
</script>

<style scoped>
.exercise-card-wrapper {
  display: contents;
}

.exercise-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
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
  aspect-ratio: 16 / 9;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.exercise-card__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.exercise-card__media--empty {
  color: var(--color-text-muted);
  font-size: clamp(0.85rem, 2vw, 0.95rem);
  cursor: default;
}

/* Arrow Navigation */
.exercise-card__nav {
  position: absolute;
  bottom: 0.35rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.3rem;
  background: rgba(0, 0, 0, 0.35);
  padding: 0.15rem 0.4rem;
  border-radius: 8px;
  backdrop-filter: blur(2px);
}

.exercise-card__nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: white;
  cursor: pointer;
  padding: 0;
  transition: opacity 0.15s ease;
}

.exercise-card__nav-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.exercise-card__nav-counter {
  color: white;
  font-size: 0.65rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

/* Centered Body */
.exercise-card__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.1rem;
}

.exercise-card__title {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.2;
}

.exercise-card__level {
  margin: 0;
  font-size: clamp(0.75rem, 1.8vw, 0.85rem);
  color: var(--color-accent);
  font-weight: 500;
}

.exercise-card__tier {
  margin: 0;
  font-size: clamp(0.8rem, 2vw, 0.9rem);
  color: color-mix(in srgb, var(--color-text-secondary) 80%, transparent);
}

.exercise-card__sets {
  margin: 0;
  font-size: 0.65rem;
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
