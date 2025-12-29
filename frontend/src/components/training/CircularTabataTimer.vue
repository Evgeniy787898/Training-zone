<template>
  <div 
    class="circular-timer"
    :class="[
      `circular-timer--${phase}`,
      { 'circular-timer--overtime': isOvertime }
    ]"
    @click="handleCenterClick"
  >
    <!-- SVG Ring Timer -->
    <svg 
      class="circular-timer__svg" 
      :viewBox="`0 0 ${size} ${size}`"
      :width="size"
      :height="size"
    >
      <!-- Background ring -->
      <circle
        class="circular-timer__track"
        :cx="center"
        :cy="center"
        :r="radius"
        fill="none"
        :stroke-width="strokeWidth"
      />
      
      <!-- Progress ring (snake animation) -->
      <circle
        class="circular-timer__progress"
        :class="{ 'circular-timer__progress--overtime': isOvertime }"
        :cx="center"
        :cy="center"
        :r="radius"
        fill="none"
        :stroke-width="strokeWidth"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="progressOffset"
        stroke-linecap="round"
        transform="rotate(-90)"
        :transform-origin="`${center} ${center}`"
      />
    </svg>
    
    <!-- Exercise image inside circle -->
    <div class="circular-timer__image-container">
      <img 
        v-if="currentImage"
        :src="currentImage"
        :alt="exerciseName"
        class="circular-timer__image"
        @click.stop="$emit('image-click')"
      />
      <div v-else class="circular-timer__placeholder">
        <span class="circular-timer__placeholder-icon">🏋️</span>
      </div>
      
      <!-- Image Navigation Arrows (inside circle at bottom) -->
      <div v-if="exerciseImages.length > 1" class="circular-timer__image-arrows">
        <button
          class="circular-timer__arrow circular-timer__arrow--prev"
          @click.stop="prevImage"
          :disabled="currentImageIndex === 0"
          aria-label="Предыдущее изображение"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <span class="circular-timer__image-counter">{{ currentImageIndex + 1 }} / {{ exerciseImages.length }}</span>
        <button
          class="circular-timer__arrow circular-timer__arrow--next"
          @click.stop="nextImage"
          :disabled="currentImageIndex === exerciseImages.length - 1"
          aria-label="Следующее изображение"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>
    </div>
    <!-- Phase indicator with Play/Pause icon -->
    <div class="circular-timer__phase-badge" :data-phase="phase">
      <span class="phase-badge__icon">{{ isRunning ? '❚❚' : '▶' }}</span>
      <span class="phase-badge__label">{{ phaseLabel }}</span>
    </div>
    
    <!-- Time display (below circle) -->
    <div class="circular-timer__time">
      <span class="circular-timer__time-value">{{ formattedTime }}</span>
      <span v-if="isOvertime" class="circular-timer__time-overtime">+{{ overtimeFormatted }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

interface Props {
  totalDuration: number;
  remainingTime: number;
  phase: 'work' | 'rest' | 'rest_set' | 'rest_exercise' | 'idle';
  exerciseName?: string;
  exerciseImage?: string;
  exerciseImages?: string[];
  isRunning: boolean;
  size?: number;
  strokeWidth?: number;
}

const props = withDefaults(defineProps<Props>(), {
  exerciseName: '',
  exerciseImage: '',
  exerciseImages: () => [],
  size: 280,
  strokeWidth: 12
});

const emit = defineEmits<{
  (e: 'toggle'): void;
  (e: 'image-click'): void;
}>();

// Image carousel state
const currentImageIndex = ref(0);

// Computed values for SVG
const center = computed(() => props.size / 2);
const radius = computed(() => (props.size - props.strokeWidth) / 2 - 4);
const circumference = computed(() => 2 * Math.PI * radius.value);

// Progress calculation
const progress = computed(() => {
  if (!props.totalDuration || props.phase === 'idle') return 0;
  const elapsed = props.totalDuration - props.remainingTime;
  return Math.min(1, Math.max(0, elapsed / props.totalDuration));
});

const progressOffset = computed(() => {
  return circumference.value * (1 - progress.value);
});

// Overtime detection
const isOvertime = computed(() => props.remainingTime < 0);
const overtimeSeconds = computed(() => Math.abs(Math.min(0, props.remainingTime)));

// Formatted times
const formattedTime = computed(() => {
  const absTime = Math.abs(props.remainingTime);
  const min = Math.floor(absTime / 60);
  const sec = absTime % 60;
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
});

const overtimeFormatted = computed(() => {
  const sec = overtimeSeconds.value;
  return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;
});

// Phase label
const phaseLabel = computed(() => {
  switch (props.phase) {
    case 'work': return 'Работа';
    case 'rest': return 'Отдых';
    case 'rest_set': return 'Отдых между подходами';
    case 'rest_exercise': return 'Отдых между упражнениями';
    case 'idle': return 'Готов';
    default: return '';
  }
});

// Current image (from carousel or single)
const currentImage = computed(() => {
  if (props.exerciseImages.length > 0) {
    return props.exerciseImages[currentImageIndex.value];
  }
  return props.exerciseImage;
});

// Event handlers
const handleCenterClick = () => {
  emit('toggle');
};

const prevImage = () => {
  if (currentImageIndex.value > 0) {
    currentImageIndex.value--;
  }
};

const nextImage = () => {
  if (currentImageIndex.value < props.exerciseImages.length - 1) {
    currentImageIndex.value++;
  }
};

// Reset image index when images change
watch(() => props.exerciseImages, () => {
  currentImageIndex.value = 0;
});
</script>

<style scoped>
.circular-timer {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: v-bind('size + "px"');
  height: v-bind('size + "px"');
  aspect-ratio: 1; /* Force perfect circle */
  flex-shrink: 0;
  cursor: pointer;
  user-select: none;
}

.circular-timer__svg {
  position: absolute;
  top: 0;
  left: 0;
}

.circular-timer__track {
  stroke: var(--color-border);
  opacity: 0.3;
}

.circular-timer__progress {
  stroke: var(--color-accent);
  transition: stroke-dashoffset 1s linear, stroke 0.3s ease;
}

.circular-timer--rest .circular-timer__progress,
.circular-timer--rest_set .circular-timer__progress,
.circular-timer--rest_exercise .circular-timer__progress {
  stroke: var(--color-warning);
}

.circular-timer__progress--overtime {
  stroke: var(--color-danger);
  animation: overtime-pulse 0.5s ease-in-out infinite;
}

@keyframes overtime-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.circular-timer__image-container {
  position: relative;
  width: calc(100% - 32px);
  height: calc(100% - 32px);
  aspect-ratio: 1; /* Force perfect circle */
  border-radius: 50%;
  overflow: hidden;
  background: var(--color-bg-elevated);
  border: 2px solid rgba(255, 255, 255, 0.15); /* Subtle border */
  box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.3);
}

.circular-timer__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.circular-timer__placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-secondary);
}

.circular-timer__placeholder-icon {
  font-size: 4rem;
}

/* Image Navigation Arrows */
.circular-timer__image-arrows {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 16px;
  /* Transparent background - no container */
}

.circular-timer__arrow {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.circular-timer__arrow:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.circular-timer__arrow:active:not(:disabled) {
  transform: scale(0.9);
  background: rgba(255, 255, 255, 0.2);
}

.circular-timer__image-counter {
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  min-width: 40px;
  text-align: center;
}

.circular-timer__phase-badge {
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 14px;
  border-radius: 14px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
}

.phase-badge__icon {
  font-size: 0.6rem;
}

.phase-badge__label {
  font-size: inherit;
}

.circular-timer__phase-badge[data-phase="work"] {
  background: color-mix(in srgb, var(--color-accent) 20%, var(--color-bg-elevated));
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.circular-timer__phase-badge[data-phase="rest"],
.circular-timer__phase-badge[data-phase="rest_set"],
.circular-timer__phase-badge[data-phase="rest_exercise"] {
  background: color-mix(in srgb, var(--color-warning) 20%, var(--color-bg-elevated));
  border-color: var(--color-warning);
  color: var(--color-warning);
}

.circular-timer__time {
  position: absolute;
  bottom: -35px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.circular-timer__time-value {
  font-size: 3.5rem; /* Even larger */
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-primary);
  text-shadow: 0 4px 20px rgba(0, 0, 0, 0.8);
  letter-spacing: 0.02em;
}

.circular-timer__time-overtime {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-danger);
}

.circular-timer--overtime {
  animation: timer-shake 0.3s ease-in-out;
}

@keyframes timer-shake {
  0%, 100% { transform: rotate(0); }
  25% { transform: rotate(-2deg); }
  75% { transform: rotate(2deg); }
}
</style>
