<template>
  <div 
    class="body360-viewer"
    ref="containerRef"
    @mousedown="startDrag"
    @mousemove="onDrag"
    @mouseup="endDrag"
    @mouseleave="endDrag"
    @touchstart.prevent="startTouch"
    @touchmove.prevent="onTouch"
    @touchend="endDrag"
  >
    <!-- Loading state -->
    <div v-if="loading" class="body360-viewer__loading">
      <div class="spinner"></div>
      <span>Загрузка кадров...</span>
    </div>

    <!-- Image display -->
    <img 
      v-else-if="frames.length > 0"
      :src="frames[currentIndex]"
      class="body360-viewer__image"
      draggable="false"
      alt="360° просмотр тела"
    />

    <!-- Empty state -->
    <div v-else class="body360-viewer__empty">
      <span class="icon">📷</span>
      <span>Нет изображений</span>
    </div>

    <!-- Progress indicator -->
    <div v-if="frames.length > 1" class="body360-viewer__progress">
      <div 
        class="body360-viewer__progress-fill" 
        :style="{ width: `${(currentIndex / (frames.length - 1)) * 100}%` }"
      ></div>
    </div>

    <!-- Frame counter -->
    <div v-if="frames.length > 0" class="body360-viewer__counter">
      {{ currentIndex + 1 }} / {{ frames.length }}
    </div>

    <!-- Drag hint -->
    <div v-if="showHint && frames.length > 1" class="body360-viewer__hint">
      👆 Потяните влево/вправо для вращения
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps<{
  frames: string[];
  loading?: boolean;
  initialIndex?: number;
}>();

const emit = defineEmits<{
  (e: 'indexChange', index: number): void;
}>();

const containerRef = ref<HTMLElement | null>(null);
const currentIndex = ref(props.initialIndex ?? 0);
const isDragging = ref(false);
const startX = ref(0);
const startIndex = ref(0);
const showHint = ref(true);

// Sensitivity: pixels per frame
const SENSITIVITY = 8;

watch(() => props.frames, () => {
  if (currentIndex.value >= props.frames.length) {
    currentIndex.value = 0;
  }
});

watch(() => props.initialIndex, (val) => {
  if (val !== undefined) {
    currentIndex.value = val;
  }
});

watch(currentIndex, (val) => {
  emit('indexChange', val);
});

function startDrag(event: MouseEvent) {
  if (props.frames.length <= 1) return;
  isDragging.value = true;
  startX.value = event.clientX;
  startIndex.value = currentIndex.value;
  showHint.value = false;
}

function onDrag(event: MouseEvent) {
  if (!isDragging.value) return;
  const deltaX = event.clientX - startX.value;
  const deltaFrames = Math.round(deltaX / SENSITIVITY);
  let newIndex = startIndex.value - deltaFrames;
  
  // Wrap around
  while (newIndex < 0) newIndex += props.frames.length;
  while (newIndex >= props.frames.length) newIndex -= props.frames.length;
  
  currentIndex.value = newIndex;
}

function startTouch(event: TouchEvent) {
  if (props.frames.length <= 1) return;
  const touch = event.touches[0];
  isDragging.value = true;
  startX.value = touch.clientX;
  startIndex.value = currentIndex.value;
  showHint.value = false;
}

function onTouch(event: TouchEvent) {
  if (!isDragging.value) return;
  const touch = event.touches[0];
  const deltaX = touch.clientX - startX.value;
  const deltaFrames = Math.round(deltaX / SENSITIVITY);
  let newIndex = startIndex.value - deltaFrames;
  
  while (newIndex < 0) newIndex += props.frames.length;
  while (newIndex >= props.frames.length) newIndex -= props.frames.length;
  
  currentIndex.value = newIndex;
}

function endDrag() {
  isDragging.value = false;
}

// Preload images
onMounted(() => {
  if (props.frames.length > 0) {
    props.frames.forEach(src => {
      const img = new Image();
      img.src = src;
    });
  }
  
  // Hide hint after 5 seconds
  setTimeout(() => {
    showHint.value = false;
  }, 5000);
});
</script>

<style scoped>
.body360-viewer {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4;
  max-height: 60vh;
  background: radial-gradient(circle at center, rgba(255,255,255,0.02) 0%, transparent 100%);
  border-radius: 16px;
  overflow: hidden;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  touch-action: pan-y;
  border: 1px solid var(--color-border-subtle, rgba(255,255,255,0.05));
}

.body360-viewer:active {
  cursor: grabbing;
}

.body360-viewer__loading,
.body360-viewer__empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--color-text-muted, rgba(255,255,255,0.5));
  font-size: 0.85rem;
}

.body360-viewer__empty .icon {
  font-size: 48px;
  opacity: 0.5;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border, rgba(255,255,255,0.1));
  border-top-color: var(--color-accent, #00ffcc);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.body360-viewer__image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}

.body360-viewer__progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: rgba(255,255,255,0.1);
}

.body360-viewer__progress-fill {
  height: 100%;
  background: var(--color-accent, #00ffcc);
  transition: width 0.05s linear;
}

.body360-viewer__counter {
  position: absolute;
  bottom: 12px;
  right: 12px;
  background: rgba(0,0,0,0.6);
  color: white;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  backdrop-filter: blur(4px);
}

.body360-viewer__hint {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.7);
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 0.8rem;
  backdrop-filter: blur(4px);
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translate(-50%, 10px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}
</style>
