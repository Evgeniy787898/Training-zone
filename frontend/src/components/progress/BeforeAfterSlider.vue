<template>
  <!-- PHOTO-F01: Before/After comparison slider for progress photos -->
  <div 
    class="before-after-slider"
    :class="{ 'is-dragging': isDragging }"
    ref="containerRef"
    @mousedown="startDrag"
    @mousemove="onDrag"
    @mouseup="endDrag"
    @mouseleave="endDrag"
    @touchstart="startDrag"
    @touchmove="onDrag"
    @touchend="endDrag"
  >
    <!-- Before Image (full width, clipped) -->
    <div 
      class="image-container before-container"
      :style="{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }"
    >
      <img 
        :src="beforeImage" 
        :alt="beforeLabel"
        class="comparison-image"
        @load="onImageLoad('before')"
      />
      <span class="image-label before-label">{{ beforeLabel }}</span>
    </div>

    <!-- After Image (full width, visible through clip) -->
    <div class="image-container after-container">
      <img 
        :src="afterImage" 
        :alt="afterLabel"
        class="comparison-image"
        @load="onImageLoad('after')"
      />
      <span class="image-label after-label">{{ afterLabel }}</span>
    </div>

    <!-- Slider Handle -->
    <div 
      class="slider-handle"
      :style="{ left: `${sliderPosition}%` }"
    >
      <div class="handle-line" />
      <div class="handle-circle">
        <svg viewBox="0 0 24 24" class="handle-icon">
          <path d="M8 5l-5 7 5 7M16 5l5 7-5 7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </div>

    <!-- Date Labels -->
    <div v-if="beforeDate || afterDate" class="date-labels">
      <span v-if="beforeDate" class="date-label before-date">{{ formatDate(beforeDate) }}</span>
      <span v-if="afterDate" class="date-label after-date">{{ formatDate(afterDate) }}</span>
    </div>

    <!-- Loading Overlay -->
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

interface Props {
  beforeImage: string;
  afterImage: string;
  beforeLabel?: string;
  afterLabel?: string;
  beforeDate?: string;
  afterDate?: string;
  initialPosition?: number; // 0-100, default 50
}

const props = withDefaults(defineProps<Props>(), {
  beforeLabel: 'До',
  afterLabel: 'После',
  initialPosition: 50,
});

const emit = defineEmits<{
  (e: 'position-change', position: number): void;
}>();

const containerRef = ref<HTMLElement | null>(null);
const sliderPosition = ref(props.initialPosition);
const isDragging = ref(false);
const loading = ref(true);
const loadedImages = ref({ before: false, after: false });

function startDrag(event: MouseEvent | TouchEvent) {
  isDragging.value = true;
  updatePosition(event);
}

function onDrag(event: MouseEvent | TouchEvent) {
  if (!isDragging.value) return;
  updatePosition(event);
}

function endDrag() {
  isDragging.value = false;
}

function updatePosition(event: MouseEvent | TouchEvent) {
  if (!containerRef.value) return;
  
  const rect = containerRef.value.getBoundingClientRect();
  let clientX: number;
  
  if ('touches' in event) {
    clientX = event.touches[0]?.clientX ?? 0;
  } else {
    clientX = event.clientX;
  }
  
  const x = clientX - rect.left;
  const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
  
  sliderPosition.value = percentage;
  emit('position-change', percentage);
}

function onImageLoad(which: 'before' | 'after') {
  loadedImages.value[which] = true;
  if (loadedImages.value.before && loadedImages.value.after) {
    loading.value = false;
  }
}

function formatDate(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    return format(date, 'd MMM yyyy', { locale: ru });
  } catch {
    return dateStr;
  }
}

// Keyboard navigation
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowLeft') {
    sliderPosition.value = Math.max(0, sliderPosition.value - 5);
    emit('position-change', sliderPosition.value);
  } else if (event.key === 'ArrowRight') {
    sliderPosition.value = Math.min(100, sliderPosition.value + 5);
    emit('position-change', sliderPosition.value);
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
.before-after-slider {
  position: relative;
  width: 100%;
  aspect-ratio: 3/4;
  overflow: hidden;
  border-radius: var(--radius-lg);
  background: var(--color-bg-secondary);
  cursor: ew-resize;
  user-select: none;
  touch-action: none;
}

.image-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.before-container {
  z-index: 2;
}

.after-container {
  z-index: 1;
}

.comparison-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

.image-label {
  position: absolute;
  bottom: var(--space-md);
  padding: var(--space-xs) var(--space-sm);
  background: rgba(0, 0, 0, 0.7);
  color: white;
  font-size: var(--font-size-sm);
  font-weight: 500;
  border-radius: var(--radius-md);
  backdrop-filter: blur(4px);
}

.before-label {
  left: var(--space-md);
}

.after-label {
  right: var(--space-md);
}

.slider-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 4px;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.handle-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 3px;
  background: white;
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.5);
}

.handle-circle {
  position: relative;
  width: 44px;
  height: 44px;
  background: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  transition: transform var(--duration-fast) var(--ease-out);
}

.is-dragging .handle-circle {
  transform: scale(1.1);
}

.handle-icon {
  width: 20px;
  height: 20px;
  color: var(--color-text-primary);
}

.date-labels {
  position: absolute;
  top: var(--space-md);
  left: var(--space-md);
  right: var(--space-md);
  display: flex;
  justify-content: space-between;
  z-index: 5;
}

.date-label {
  padding: var(--space-xs) var(--space-sm);
  background: rgba(0, 0, 0, 0.6);
  color: white;
  font-size: var(--font-size-xs);
  border-radius: var(--radius-sm);
  backdrop-filter: blur(4px);
}

.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-secondary);
  z-index: 20;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Mobile adjustments */
@media (max-width: 640px) {
  .handle-circle {
    width: 36px;
    height: 36px;
  }
  
  .handle-icon {
    width: 16px;
    height: 16px;
  }
  
  .image-label {
    font-size: var(--font-size-xs);
    padding: 2px var(--space-xs);
  }
}

/* Focus for accessibility */
.before-after-slider:focus {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
</style>
