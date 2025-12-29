<template>
  <div 
    ref="containerRef"
    class="compare-viewer"
    :class="{ 'compare-viewer--smooth': isSmooth }"
    @mousedown="startDrag"
    @wheel.prevent="handleWheel"
    @mouseenter="isActive = true"
    @mouseleave="isActive = false"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
    tabindex="0"
    @keydown="handleKeydown"
  >
    <!-- Loading state with body skeleton (#10) -->
    <div v-if="loading" class="compare-viewer__loading">
      <div class="skeleton-body">
        <svg viewBox="0 0 100 200" class="body-silhouette">
          <!-- Head -->
          <circle cx="50" cy="20" r="15" class="skeleton-part"/>
          <!-- Neck -->
          <rect x="45" y="35" width="10" height="10" class="skeleton-part" style="animation-delay: 0.1s"/>
          <!-- Shoulders -->
          <rect x="20" y="45" width="60" height="8" rx="4" class="skeleton-part" style="animation-delay: 0.15s"/>
          <!-- Torso -->
          <rect x="30" y="53" width="40" height="50" rx="4" class="skeleton-part" style="animation-delay: 0.2s"/>
          <!-- Arms -->
          <rect x="15" y="53" width="12" height="45" rx="4" class="skeleton-part" style="animation-delay: 0.25s"/>
          <rect x="73" y="53" width="12" height="45" rx="4" class="skeleton-part" style="animation-delay: 0.25s"/>
          <!-- Hips -->
          <rect x="30" y="103" width="40" height="15" rx="4" class="skeleton-part" style="animation-delay: 0.3s"/>
          <!-- Legs -->
          <rect x="32" y="118" width="14" height="60" rx="4" class="skeleton-part" style="animation-delay: 0.35s"/>
          <rect x="54" y="118" width="14" height="60" rx="4" class="skeleton-part" style="animation-delay: 0.35s"/>
        </svg>
      </div>
      <span class="loading-text">{{ loadingText || 'Загрузка...' }}</span>
    </div>

    <!-- Empty state - no scans -->
    <div v-else-if="!hasLeft && !hasRight" class="compare-viewer__empty">
      <div class="empty-upload-zones">
        <div class="upload-zone" @click="$emit('uploadLeft')">
          <div class="upload-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </div>
          <span class="upload-title">Текущее</span>
          <span class="upload-hint">Загрузить 360° снимок</span>
        </div>
        <div class="upload-zone" @click="$emit('uploadRight')">
          <div class="upload-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="3"/>
              <line x1="12" y1="2" x2="12" y2="4"/>
              <line x1="12" y1="20" x2="12" y2="22"/>
              <line x1="2" y1="12" x2="4" y2="12"/>
              <line x1="20" y1="12" x2="22" y2="12"/>
            </svg>
          </div>
          <span class="upload-title">Цель</span>
          <span class="upload-hint">Загрузить 360° снимок</span>
        </div>
      </div>
    </div>

    <!-- Single scan mode -->
    <div v-else-if="!hasLeft || !hasRight" class="compare-viewer__single">
      <div class="single-image-container" :style="{ transform: `scale(${zoomLevel})`, transformOrigin: zoomOrigin }">
        <img 
          :src="hasLeft ? leftFrames[currentIndex] : rightFrames[currentIndex]"
          class="compare-viewer__image"
          draggable="false"
          alt="360 view"
          @error="handleImageError"
        />
      </div>
      <div class="single-label">{{ hasLeft ? 'Текущее' : 'Цель' }}</div>
      <button class="add-scan-btn" @click="hasLeft ? $emit('uploadRight') : $emit('uploadLeft')">
        <span class="add-icon">+</span>
        {{ hasLeft ? 'Добавить цель' : 'Добавить текущее' }}
      </button>
    </div>

    <!-- Compare mode - both scans present -->
    <div v-else class="compare-viewer__compare">
      <!-- Left image (Current) - clipped on the right -->
      <div 
        class="compare-side compare-side--left"
        :style="{ 
          clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
          transform: `scale(${zoomLevel})`,
          transformOrigin: zoomOrigin
        }"
      >
        <img 
          :src="leftFrames[currentIndex]"
          class="compare-viewer__image"
          draggable="false"
          alt="Current"
          @error="handleImageError"
        />
      </div>

      <!-- Right image (Goal) - clipped on the left -->
      <div 
        class="compare-side compare-side--right"
        :style="{ 
          clipPath: `inset(0 0 0 ${sliderPosition}%)`,
          transform: `scale(${zoomLevel})`,
          transformOrigin: zoomOrigin
        }"
      >
        <img 
          :src="rightFrames[currentIndex]"
          class="compare-viewer__image"
          draggable="false"
          alt="Goal"
          @error="handleImageError"
        />
      </div>

      <!-- Labels -->
      <div class="compare-labels">
        <span class="compare-label compare-label--left" :style="{ opacity: sliderPosition > 15 ? 1 : 0 }">Сейчас</span>
        <span class="compare-label compare-label--right" :style="{ opacity: sliderPosition < 85 ? 1 : 0 }">Цель</span>
      </div>

      <!-- Divider -->
      <div 
        class="compare-divider"
        :style="{ left: sliderPosition + '%' }"
        @mousedown.stop="startSliderDrag"
        @touchstart.stop="startSliderTouch"
      >
        <div class="divider-line"></div>
        <div class="divider-handle">
          <span class="handle-arrows">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </span>
        </div>
      </div>
    </div>

    <!-- Controls (bottom) - hidden when parent handles controls from header -->
    <div v-if="(hasLeft || hasRight) && !loading && !hideControls" class="compare-controls">
      <!-- Auto-rotate button (#4) -->
      <button 
        class="control-btn" 
        :class="{ 'control-btn--active': isAutoRotating }"
        @click="toggleAutoRotate"
        :title="isAutoRotating ? 'Остановить' : 'Авто-вращение'"
      >
        <svg v-if="!isAutoRotating" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="4" width="4" height="16"/>
          <rect x="14" y="4" width="4" height="16"/>
        </svg>
      </button>
      
      <!-- Frame indicator -->
      <div class="frame-indicator">
        {{ currentIndex + 1 }} / {{ frameCount }}
      </div>
    </div>

    <!-- Hint -->
    <transition name="fade">
      <div v-if="showHint && (hasLeft || hasRight) && !loading" class="compare-viewer__hint">
        Перетаскивайте для вращения · Колёсико для зума
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';

const props = defineProps<{
  leftFrames: string[];
  rightFrames: string[];
  loading?: boolean;
  loadingText?: string;
  isAutoRotating?: boolean;
  hideControls?: boolean;
}>();

const emit = defineEmits<{
  (e: 'uploadLeft'): void;
  (e: 'uploadRight'): void;
}>();

// Refs
const containerRef = ref<HTMLElement | null>(null);

// State
const currentIndex = ref(0);
const zoomLevel = ref(1);
const zoomOrigin = ref('center center');
const sliderPosition = ref(50); // 0-100%
const isActive = ref(false);
const showHint = ref(true);

// Auto-rotate (#4)
const isAutoRotating = ref(false);
let autoRotateInterval: ReturnType<typeof setInterval> | null = null;

// Smooth animation (#3) - enabled only during auto-rotate
const isSmooth = ref(false);

// Drag state
const isDragging = ref(false);
const isSliderDragging = ref(false);
const startX = ref(0);
const startIndex = ref(0);
const startSliderPos = ref(50);

// Touch state
const initialPinchDistance = ref(0);
const initialZoom = ref(1);

// Constants
const SENSITIVITY = 5;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

// Error handling
const imageError = ref(false);

function handleImageError(event: Event) {
  const img = event.target as HTMLImageElement;
  console.warn('[CompareViewer] Image failed to load:', img.src);
  imageError.value = true;
  // Set a placeholder
  img.style.opacity = '0.3';
}

// Computed
const hasLeft = computed(() => props.leftFrames.length > 0);
const hasRight = computed(() => props.rightFrames.length > 0);
const hideControls = computed(() => props.hideControls ?? false);
// Use minimum to keep both scans in sync (they should have same frame count ideally)
const frameCount = computed(() => {
  if (hasLeft.value && hasRight.value) {
    return Math.min(props.leftFrames.length, props.rightFrames.length);
  }
  return Math.max(props.leftFrames.length, props.rightFrames.length);
});

// Lifecycle
onMounted(() => {
  window.addEventListener('mouseup', endDrag);
  window.addEventListener('mousemove', onDrag);
  setTimeout(() => { showHint.value = false; }, 4000);
});

onUnmounted(() => {
  window.removeEventListener('mouseup', endDrag);
  window.removeEventListener('mousemove', onDrag);
  stopAutoRotate(); // Clean up interval
});

// Reset when frames change
watch([() => props.leftFrames, () => props.rightFrames], () => {
  currentIndex.value = 0;
  zoomLevel.value = 1;
  zoomOrigin.value = 'center center';
  stopAutoRotate();
});

// React to parent controlling auto-rotate (from header button)
watch(() => props.isAutoRotating, (newVal) => {
  if (newVal) {
    startAutoRotate();
  } else {
    stopAutoRotate();
  }
});

// Auto-rotate functions (#4)
function toggleAutoRotate() {
  if (isAutoRotating.value) {
    stopAutoRotate();
  } else {
    startAutoRotate();
  }
}

function startAutoRotate() {
  isAutoRotating.value = true;
  isSmooth.value = true; // Enable smooth transitions
  autoRotateInterval = setInterval(() => {
    currentIndex.value = (currentIndex.value + 1) % frameCount.value;
  }, 100); // 10 FPS for smooth rotation
}

function stopAutoRotate() {
  isAutoRotating.value = false;
  isSmooth.value = false;
  if (autoRotateInterval) {
    clearInterval(autoRotateInterval);
    autoRotateInterval = null;
  }
}

// --- Rotation Drag ---
function startDrag(event: MouseEvent) {
  if (isSliderDragging.value) return;
  stopAutoRotate(); // Stop auto-rotate when user starts dragging
  isDragging.value = true;
  startX.value = event.clientX;
  startIndex.value = currentIndex.value;
  showHint.value = false;
}

function onDrag(event: MouseEvent) {
  if (isSliderDragging.value) {
    // Slider drag
    if (!containerRef.value) return;
    const rect = containerRef.value.getBoundingClientRect();
    const x = event.clientX - rect.left;
    let newPos = (x / rect.width) * 100;
    newPos = Math.max(5, Math.min(95, newPos));
    sliderPosition.value = newPos;
  } else if (isDragging.value) {
    // Rotation drag
    const deltaX = event.clientX - startX.value;
    const frameDelta = Math.round(deltaX / SENSITIVITY);
    let newIndex = startIndex.value - frameDelta;
    
    // Wrap around
    while (newIndex < 0) newIndex += frameCount.value;
    while (newIndex >= frameCount.value) newIndex -= frameCount.value;
    
    currentIndex.value = newIndex;
  }
}

function endDrag() {
  isDragging.value = false;
  isSliderDragging.value = false;
}

// --- Slider Drag ---
function startSliderDrag(_event: MouseEvent) {
  isSliderDragging.value = true;
  startSliderPos.value = sliderPosition.value;
}

function startSliderTouch(_event: TouchEvent) {
  isSliderDragging.value = true;
  startSliderPos.value = sliderPosition.value;
}

// --- Wheel Zoom ---
function handleWheel(event: WheelEvent) {
  if (!isActive.value || !containerRef.value) return;
  
  const rect = containerRef.value.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  zoomOrigin.value = `${x}% ${y}%`;
  
  const delta = event.deltaY * -0.001;
  let newZoom = zoomLevel.value + delta * 5;
  
  if (newZoom < MIN_ZOOM) {
    newZoom = MIN_ZOOM;
    zoomOrigin.value = 'center center';
  }
  if (newZoom > MAX_ZOOM) newZoom = MAX_ZOOM;
  
  zoomLevel.value = newZoom;
}

// --- Touch Handling ---
function handleTouchStart(event: TouchEvent) {
  showHint.value = false;
  
  if (event.touches.length === 2) {
    // Pinch zoom
    const touch1 = event.touches[0];
    const touch2 = event.touches[1];
    initialPinchDistance.value = Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY
    );
    initialZoom.value = zoomLevel.value;
  } else if (event.touches.length === 1) {
    // Single touch - rotation
    isDragging.value = true;
    startX.value = event.touches[0].clientX;
    startIndex.value = currentIndex.value;
  }
}

function handleTouchMove(event: TouchEvent) {
  if (isSliderDragging.value && event.touches.length === 1) {
    // Slider drag
    if (!containerRef.value) return;
    const rect = containerRef.value.getBoundingClientRect();
    const x = event.touches[0].clientX - rect.left;
    let newPos = (x / rect.width) * 100;
    newPos = Math.max(5, Math.min(95, newPos));
    sliderPosition.value = newPos;
  } else if (event.touches.length === 2) {
    // Pinch zoom
    const touch1 = event.touches[0];
    const touch2 = event.touches[1];
    const currentDistance = Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY
    );
    const scale = currentDistance / initialPinchDistance.value;
    let newZoom = initialZoom.value * scale;
    newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
    zoomLevel.value = newZoom;
  } else if (isDragging.value && event.touches.length === 1) {
    // Rotation
    const deltaX = event.touches[0].clientX - startX.value;
    const frameDelta = Math.round(deltaX / SENSITIVITY);
    let newIndex = startIndex.value - frameDelta;
    
    while (newIndex < 0) newIndex += frameCount.value;
    while (newIndex >= frameCount.value) newIndex -= frameCount.value;
    
    currentIndex.value = newIndex;
  }
}

function handleTouchEnd() {
  isDragging.value = false;
  isSliderDragging.value = false;
}

// --- Keyboard ---
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowLeft') {
    currentIndex.value = (currentIndex.value - 1 + frameCount.value) % frameCount.value;
  } else if (event.key === 'ArrowRight') {
    currentIndex.value = (currentIndex.value + 1) % frameCount.value;
  } else if (event.key === 'r' || event.key === 'R') {
    zoomLevel.value = 1;
    zoomOrigin.value = 'center center';
  }
}
</script>

<style scoped>
.compare-viewer {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
  border-radius: 16px;
  overflow: hidden;
  cursor: grab;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  outline: none;
}

.compare-viewer:active {
  cursor: grabbing;
}

/* Loading with Body Skeleton (#10) */
.compare-viewer__loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  color: var(--color-text-secondary);
}

.skeleton-body {
  width: 100px;
  height: 200px;
}

.body-silhouette {
  width: 100%;
  height: 100%;
}

.skeleton-part {
  fill: rgba(255, 255, 255, 0.08);
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

@keyframes skeleton-pulse {
  0%, 100% { 
    fill: rgba(255, 255, 255, 0.08);
    filter: drop-shadow(0 0 0 transparent);
  }
  50% { 
    fill: rgba(255, 255, 255, 0.15);
    filter: drop-shadow(0 0 8px rgba(16, 185, 129, 0.3));
  }
}

.loading-text {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text-secondary);
}

/* Empty state */
.compare-viewer__empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.empty-upload-zones {
  display: flex;
  gap: 16px;
  width: 100%;
  max-width: 400px;
}

.upload-zone {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 16px;
  background: rgba(255,255,255,0.03);
  border: 2px dashed rgba(255,255,255,0.15);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.upload-zone:hover {
  background: rgba(255,255,255,0.06);
  border-color: var(--color-accent);
}

.upload-icon {
  font-size: 2rem;
  opacity: 0.8;
}

.upload-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.upload-hint {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  text-align: center;
}

/* Single scan mode */
.compare-viewer__single {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.single-image-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.single-label {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 4px 10px;
  background: rgba(0,0,0,0.6);
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  color: white;
}

.add-scan-btn {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  background: var(--color-accent);
  border: none;
  border-radius: 20px;
  color: black;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.add-scan-btn:hover {
  filter: brightness(1.1);
  transform: translateX(-50%) scale(1.02);
}

.add-icon {
  font-size: 1.1rem;
  font-weight: bold;
}

/* Compare mode */
.compare-viewer__compare {
  position: relative;
  width: 100%;
  height: 100%;
}

.compare-side {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.compare-viewer__image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}

/* Labels */
.compare-labels {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  padding: 12px 16px;
  pointer-events: none;
  z-index: 10;
}

.compare-label {
  padding: 4px 10px;
  background: rgba(0,0,0,0.6);
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  color: white;
  transition: opacity 0.2s;
}

/* Divider */
.compare-divider {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 48px;
  transform: translateX(-50%);
  cursor: ew-resize;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
}

.divider-line {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 3px;
  background: linear-gradient(180deg, var(--color-accent) 0%, rgba(16, 185, 129, 0.6) 100%);
  box-shadow: 0 0 12px rgba(16, 185, 129, 0.5);
  transform: translateX(-50%);
}

.divider-handle {
  position: relative;
  width: 42px;
  height: 42px;
  background: linear-gradient(135deg, var(--color-accent) 0%, #0d9573 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 
    0 4px 16px rgba(16, 185, 129, 0.4),
    0 0 0 3px rgba(255,255,255,0.15);
  transition: all 0.2s ease;
}

.compare-divider:hover .divider-handle {
  transform: scale(1.15);
  box-shadow: 
    0 6px 24px rgba(16, 185, 129, 0.6),
    0 0 0 4px rgba(255,255,255,0.2);
}

.compare-divider:active .divider-handle {
  transform: scale(1.05);
}

.handle-arrows {
  display: flex;
  align-items: center;
  gap: 2px;
  color: #000;
  font-weight: bold;
}

.handle-arrows svg {
  width: 16px;
  height: 16px;
}

/* Controls container */
.compare-controls {
  position: absolute;
  bottom: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 25;
}

.control-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.6);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 8px;
  color: rgba(255,255,255,0.8);
  cursor: pointer;
  transition: all 0.2s;
  backdrop-filter: blur(4px);
}

.control-btn:hover {
  background: rgba(0,0,0,0.8);
  color: white;
}

.control-btn--active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: white;
}

.control-btn--active:hover {
  background: #0d9573;
}

.frame-indicator {
  padding: 4px 10px;
  background: rgba(0,0,0,0.6);
  border-radius: 6px;
  font-size: 0.7rem;
  color: rgba(255,255,255,0.7);
  pointer-events: none;
}

/* Smooth image transition during auto-rotate */
.compare-viewer__image {
  transition: none;
}

.compare-viewer--smooth .compare-viewer__image {
  transition: opacity 0.05s ease;
}

/* Hint */
.compare-viewer__hint {
  position: absolute;
  bottom: 50px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 14px;
  background: rgba(0,0,0,0.7);
  border-radius: 8px;
  font-size: 0.75rem;
  color: rgba(255,255,255,0.8);
  white-space: nowrap;
  pointer-events: none;
  z-index: 5;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
