<template>
  <Teleport to="body">
    <Transition name="image-zoom">
      <div
        v-if="isOpen"
        class="image-zoom-overlay"
        @click.self="close"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
        @wheel="handleWheel"
      >
        <!-- Close button -->
        <button
          class="image-zoom__close"
          @click="close"
          aria-label="Закрыть"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <!-- Zoom controls -->
        <div class="image-zoom__controls">
          <button
            class="image-zoom__control"
            @click="zoomOut"
            :disabled="scale <= minScale"
            aria-label="Уменьшить"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            </svg>
          </button>
          <span class="image-zoom__scale">{{ Math.round(scale * 100) }}%</span>
          <button
            class="image-zoom__control"
            @click="zoomIn"
            :disabled="scale >= maxScale"
            aria-label="Увеличить"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            </svg>
          </button>
          <button
            class="image-zoom__control"
            @click="resetZoom"
            aria-label="Сбросить масштаб"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 12h18M12 3v18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <!-- Image container with zoom and pan -->
        <div
          ref="zoomContainerRef"
          class="image-zoom__container"
          :style="containerStyle"
          @mousedown="handleMouseDown"
          @mousemove="handleMouseMove"
          @mouseup="handleMouseUp"
          @mouseleave="handleMouseUp"
        >
          <img
            ref="imageRef"
            :src="src"
            :alt="alt"
            class="image-zoom__image"
            :style="imageStyle"
            @load="handleImageLoad"
            @error="handleImageError"
            draggable="false"
          />
        </div>

        <!-- Image counter (if multiple images) -->
        <div class="image-zoom__counter" v-if="images && images.length > 1">
          {{ currentIndex + 1 }} / {{ images.length }}
        </div>

        <!-- Navigation arrows (if multiple images) -->
        <button
          v-if="images && images.length > 1 && currentIndex > 0"
          class="image-zoom__nav image-zoom__nav--prev"
          @click="prevImage"
          aria-label="Предыдущее фото"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button
          v-if="images && images.length > 1 && currentIndex < images.length - 1"
          class="image-zoom__nav image-zoom__nav--next"
          @click="nextImage"
          aria-label="Следующее фото"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { hapticLight, hapticSelection } from '@/utils/hapticFeedback';
import { SwipeGesture, type SwipeDirection } from '@/utils/swipeGestures';

interface Props {
  isOpen: boolean;
  src: string;
  alt?: string;
  images?: string[];
  initialIndex?: number;
}

const props = withDefaults(defineProps<Props>(), {
  alt: '',
  images: undefined,
  initialIndex: 0,
});

const emit = defineEmits<{
  close: [];
  'image-change': [index: number];
}>();

const imageRef = ref<HTMLImageElement | null>(null);
const zoomContainerRef = ref<HTMLElement | null>(null);

// Swipe Gesture Instance для навигации между изображениями
let zoomSwipe: SwipeGesture | null = null;

// Zoom state
const minScale = 0.5;
const maxScale = 5;
const scaleStep = 0.25;
const scale = ref(1);
const position = ref({ x: 0, y: 0 });
const imageSize = ref({ width: 0, height: 0 });
const isDragging = ref(false);
const dragStart = ref({ x: 0, y: 0 });

// Touch state for pinch zoom
const touchState = ref<{
  distance: number;
  center: { x: number; y: number };
  initialScale: number;
  initialPosition: { x: number; y: number };
} | null>(null);

// Image navigation
const currentIndex = ref(props.initialIndex);

// Computed styles
const containerStyle = computed(() => ({
  transform: `translate(${position.value.x}px, ${position.value.y}px)`,
  cursor: isDragging.value ? 'grabbing' : (scale.value > 1 ? 'grab' : 'default'),
}));

const imageStyle = computed(() => ({
  transform: `scale(${scale.value})`,
  transformOrigin: 'center center',
  willChange: 'transform',
}));

// Methods
const resetZoom = () => {
  hapticLight();
  scale.value = 1;
  position.value = { x: 0, y: 0 };
  clampPosition();
};

const zoomIn = () => {
  hapticSelection();
  if (scale.value < maxScale) {
    const oldScale = scale.value;
    scale.value = Math.min(maxScale, scale.value + scaleStep);
    
    // Adjust position to zoom towards center
    const scaleDiff = scale.value - oldScale;
    position.value.x -= (window.innerWidth / 2 - position.value.x) * (scaleDiff / oldScale);
    position.value.y -= (window.innerHeight / 2 - position.value.y) * (scaleDiff / oldScale);
    
    clampPosition();
  }
};

const zoomOut = () => {
  hapticSelection();
  if (scale.value > minScale) {
    const oldScale = scale.value;
    scale.value = Math.max(minScale, scale.value - scaleStep);
    
    // Adjust position to zoom towards center
    const scaleDiff = oldScale - scale.value;
    position.value.x += (window.innerWidth / 2 - position.value.x) * (scaleDiff / oldScale);
    position.value.y += (window.innerHeight / 2 - position.value.y) * (scaleDiff / oldScale);
    
    clampPosition();
  }
};

const clampPosition = () => {
  if (!imageRef.value) return;
  
  const scaledWidth = imageSize.value.width * scale.value;
  const scaledHeight = imageSize.value.height * scale.value;
  
  const maxX = Math.max(0, (scaledWidth - window.innerWidth) / 2);
  const maxY = Math.max(0, (scaledHeight - window.innerHeight) / 2);
  
  position.value.x = Math.max(-maxX, Math.min(maxX, position.value.x));
  position.value.y = Math.max(-maxY, Math.min(maxY, position.value.y));
};

const handleMouseDown = (e: MouseEvent) => {
  if (scale.value > 1) {
    isDragging.value = true;
    dragStart.value = {
      x: e.clientX - position.value.x,
      y: e.clientY - position.value.y,
    };
    hapticLight();
  }
};

const handleMouseMove = (e: MouseEvent) => {
  if (isDragging.value && scale.value > 1) {
    position.value.x = e.clientX - dragStart.value.x;
    position.value.y = e.clientY - dragStart.value.y;
    clampPosition();
  }
};

const handleMouseUp = () => {
  isDragging.value = false;
};

const handleWheel = (e: WheelEvent) => {
  e.preventDefault();
  
  const delta = e.deltaY > 0 ? -scaleStep : scaleStep;
  const oldScale = scale.value;
  scale.value = Math.max(minScale, Math.min(maxScale, scale.value + delta));
  
  if (scale.value !== oldScale) {
    hapticSelection();
    
    // Zoom towards mouse position
    const rect = imageRef.value?.getBoundingClientRect();
    if (rect) {
      const mouseX = e.clientX - rect.left - rect.width / 2;
      const mouseY = e.clientY - rect.top - rect.height / 2;
      
      const scaleDiff = scale.value - oldScale;
      position.value.x -= mouseX * (scaleDiff / oldScale);
      position.value.y -= mouseY * (scaleDiff / oldScale);
    }
    
    clampPosition();
  }
};

const getTouchDistance = (touches: TouchList): number => {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
};

const getTouchCenter = (touches: TouchList): { x: number; y: number } => {
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2,
  };
};

const handleTouchStart = (e: TouchEvent) => {
  if (e.touches.length === 2) {
    const distance = getTouchDistance(e.touches);
    const center = getTouchCenter(e.touches);
    
    touchState.value = {
      distance,
      center,
      initialScale: scale.value,
      initialPosition: { ...position.value },
    };
    
    e.preventDefault();
  } else if (e.touches.length === 1 && scale.value > 1) {
    isDragging.value = true;
    dragStart.value = {
      x: e.touches[0].clientX - position.value.x,
      y: e.touches[0].clientY - position.value.y,
    };
  }
};

const handleTouchMove = (e: TouchEvent) => {
  if (e.touches.length === 2 && touchState.value) {
    const distance = getTouchDistance(e.touches);
    const center = getTouchCenter(e.touches);
    const scaleDiff = distance / touchState.value.distance;
    
    scale.value = Math.max(minScale, Math.min(maxScale, touchState.value.initialScale * scaleDiff));
    
    // Adjust position for pinch center
    const centerDiffX = center.x - touchState.value.center.x;
    const centerDiffY = center.y - touchState.value.center.y;
    
    position.value.x = touchState.value.initialPosition.x + centerDiffX;
    position.value.y = touchState.value.initialPosition.y + centerDiffY;
    
    clampPosition();
    e.preventDefault();
  } else if (e.touches.length === 1 && isDragging.value && scale.value > 1) {
    position.value.x = e.touches[0].clientX - dragStart.value.x;
    position.value.y = e.touches[0].clientY - dragStart.value.y;
    clampPosition();
    e.preventDefault();
  }
};

const handleTouchEnd = () => {
  touchState.value = null;
  isDragging.value = false;
};

const handleImageLoad = () => {
  if (imageRef.value) {
    imageSize.value = {
      width: imageRef.value.naturalWidth,
      height: imageRef.value.naturalHeight,
    };
    resetZoom();
  }
};

const handleImageError = () => {
  console.warn('Failed to load image:', props.src);
};

const close = () => {
  hapticLight();
  resetZoom();
  emit('close');
};

const prevImage = () => {
  if (props.images && currentIndex.value > 0) {
    hapticSelection();
    currentIndex.value--;
    emit('image-change', currentIndex.value);
    resetZoom();
    
    nextTick(() => {
      if (imageRef.value) {
        imageRef.value.src = props.images![currentIndex.value];
      }
    });
  }
};

const nextImage = () => {
  if (props.images && currentIndex.value < props.images.length - 1) {
    hapticSelection();
    currentIndex.value++;
    emit('image-change', currentIndex.value);
    resetZoom();
    
    nextTick(() => {
      if (imageRef.value) {
        imageRef.value.src = props.images![currentIndex.value];
      }
    });
  }
};

// Keyboard handling
const handleKeyDown = (e: KeyboardEvent) => {
  if (!props.isOpen) return;
  
  if (e.key === 'Escape') {
    close();
  } else if (e.key === 'ArrowLeft' && props.images && currentIndex.value > 0) {
    prevImage();
  } else if (e.key === 'ArrowRight' && props.images && currentIndex.value < props.images.length - 1) {
    nextImage();
  } else if (e.key === '+' || e.key === '=') {
    zoomIn();
  } else if (e.key === '-') {
    zoomOut();
  } else if (e.key === '0') {
    resetZoom();
  }
};

// Watch for changes
watch(() => props.isOpen, (newValue) => {
  if (newValue) {
    nextTick(() => {
      resetZoom();
      if (props.images) {
        currentIndex.value = props.initialIndex;
        if (imageRef.value) {
          imageRef.value.src = props.images[currentIndex.value];
        }
      }
    });
  }
});

watch(() => props.src, () => {
  if (props.isOpen && imageRef.value) {
    resetZoom();
  }
});

watch(() => props.initialIndex, (newIndex) => {
  if (props.images) {
    currentIndex.value = newIndex;
    if (imageRef.value) {
      imageRef.value.src = props.images[newIndex];
    }
    resetZoom();
  }
});

// Инициализация swipe жестов для навигации между изображениями в zoom
  watch(
    () => [zoomContainerRef.value, props.isOpen, props.images, scale.value] as const,
    ([element, isOpen, images, currentScale]) => {
      if (zoomSwipe) {
        zoomSwipe.destroy();
        zoomSwipe = null;
      }

      // Swipe жесты только для множественных изображений и только если не увеличен масштаб
      const container = element as HTMLElement | null;
      const imageList = Array.isArray(images) ? images : [];
      const scaleValue = typeof currentScale === 'number' ? currentScale : 1;

      if (container && isOpen && imageList.length > 1 && scaleValue <= 1) {
        zoomSwipe = new SwipeGesture(container, {
          threshold: 80,
          velocityThreshold: 0.4,
          direction: 'horizontal',
          preventDefault: true,
          onSwipe: (direction: SwipeDirection) => {
            if (direction === 'left') {
              nextImage();
            } else if (direction === 'right') {
              prevImage();
            }
          },
      });
    }
  },
  { immediate: true }
);

// Отключаем swipe навигацию при увеличении масштаба
watch(
  () => scale.value,
  (newScale) => {
    if (zoomSwipe && newScale > 1) {
      zoomSwipe.destroy();
      zoomSwipe = null;
    } else if (!zoomSwipe && newScale <= 1 && props.images && props.images.length > 1 && props.isOpen && zoomContainerRef.value) {
      zoomSwipe = new SwipeGesture(zoomContainerRef.value, {
        threshold: 80,
        velocityThreshold: 0.4,
        direction: 'horizontal',
        preventDefault: true,
        onSwipe: (direction: SwipeDirection) => {
          if (direction === 'left') {
            nextImage();
          } else if (direction === 'right') {
            prevImage();
          }
        },
      });
    }
  }
);

// Lifecycle
onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  
  // Очистка swipe жестов
  if (zoomSwipe) {
    zoomSwipe.destroy();
    zoomSwipe = null;
  }
});
</script>

<style scoped>
.image-zoom-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10000;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.85) 100%);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}

.image-zoom__close {
  position: absolute;
  top: 1.618rem;
  right: 1.618rem;
  z-index: 10001;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.9) 100%);
  background: linear-gradient(135deg, var(--color-bg-primary-alpha-95) 0%, var(--color-bg-primary-alpha-90) 100%);
  color: var(--color-text-primary);
  border: 1px solid rgba(229, 231, 235, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.15),
    0 2px 6px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 var(--color-bg-primary-alpha-90);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.image-zoom__close:hover {
  background: linear-gradient(135deg, var(--color-bg-primary) 0%, var(--color-bg-secondary) 100%);
  transform: scale(1.08) rotate(90deg);
  box-shadow:
    0 6px 20px rgba(0, 0, 0, 0.2),
    0 3px 10px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 var(--color-bg-primary);
}

.image-zoom__close:active {
  transform: scale(1.05) rotate(90deg);
}

.image-zoom__controls {
  position: absolute;
  top: 1.618rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10001;
  display: flex;
  align-items: center;
  gap: 0.809rem;
  background: linear-gradient(135deg, var(--color-bg-primary-alpha-95) 0%, var(--color-bg-primary-alpha-90) 100%);
  padding: 0.618rem 1rem;
  border-radius: 16px;
  border: 1px solid rgba(229, 231, 235, 0.6);
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.15),
    0 2px 6px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 var(--color-bg-primary-alpha-90);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.image-zoom__control {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-primary);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.image-zoom__control:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.05);
  transform: scale(1.1);
}

.image-zoom__control:active:not(:disabled) {
  transform: scale(0.95);
}

.image-zoom__control:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.image-zoom__scale {
  font-family: var(--font-family-base, 'Inter', 'Roboto Flex', 'Google Sans', sans-serif);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-primary);
  min-width: 48px;
  text-align: center;
  letter-spacing: 0.02em;
}

.image-zoom__container {
  position: relative;
  max-width: 100vw;
  max-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.1s linear;
  will-change: transform;
  backface-visibility: hidden;
}

.image-zoom__image {
  max-width: 90vw;
  max-height: 90vh;
  width: auto;
  height: auto;
  object-fit: contain;
  user-select: none;
  -webkit-user-select: none;
  -webkit-user-drag: none;
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
  backface-visibility: hidden;
}

.image-zoom__counter {
  position: absolute;
  bottom: 1.618rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10001;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.75) 0%, rgba(0, 0, 0, 0.65) 100%);
  color: var(--color-bg-primary);
  padding: 0.618rem 1.309rem;
  border-radius: 12px;
  font-family: var(--font-family-base, 'Inter', 'Roboto Flex', 'Google Sans', sans-serif);
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.image-zoom__nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10001;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-bg-primary-alpha-95) 0%, var(--color-bg-primary-alpha-90) 100%);
  color: var(--color-text-primary);
  border: 1px solid rgba(229, 231, 235, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.15),
    0 2px 6px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 var(--color-bg-primary-alpha-90);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.image-zoom__nav:hover {
  background: linear-gradient(135deg, var(--color-bg-primary) 0%, var(--color-bg-secondary) 100%);
  transform: translateY(-50%) scale(1.1);
  box-shadow:
    0 6px 20px rgba(0, 0, 0, 0.2),
    0 3px 10px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 var(--color-bg-primary);
}

.image-zoom__nav:active {
  transform: translateY(-50%) scale(1.05);
}

.image-zoom__nav--prev {
  left: 1.618rem;
}

.image-zoom__nav--next {
  right: 1.618rem;
}

/* Transitions */
.image-zoom-enter-active,
.image-zoom-leave-active {
  transition: opacity 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.image-zoom-enter-from,
.image-zoom-leave-to {
  opacity: 0;
}

/* Responsive */
@media (max-width: 768px) {
  .image-zoom__close {
    width: 44px;
    height: 44px;
    top: 1rem;
    right: 1rem;
  }

  .image-zoom__controls {
    top: 1rem;
    padding: 0.5rem 0.809rem;
    gap: 0.618rem;
  }

  .image-zoom__control {
    width: 32px;
    height: 32px;
  }

  .image-zoom__scale {
    font-size: 0.8125rem;
    min-width: 40px;
  }

  .image-zoom__counter {
    bottom: 1rem;
    padding: 0.5rem 1rem;
    font-size: 0.8125rem;
  }

  .image-zoom__nav {
    width: 44px;
    height: 44px;
  }

  .image-zoom__nav--prev {
    left: 1rem;
  }

  .image-zoom__nav--next {
    right: 1rem;
  }

  .image-zoom__image {
    max-width: 95vw;
    max-height: 95vh;
  }
}

@media (max-width: 480px) {
  .image-zoom__close {
    width: 40px;
    height: 40px;
    top: 0.875rem;
    right: 0.875rem;
  }

  .image-zoom__controls {
    top: 0.875rem;
    padding: 0.5rem 0.75rem;
    gap: 0.5rem;
  }

  .image-zoom__control {
    width: 28px;
    height: 28px;
  }

  .image-zoom__scale {
    font-size: 0.75rem;
    min-width: 36px;
  }

  .image-zoom__counter {
    bottom: 0.875rem;
    padding: 0.5rem 0.875rem;
    font-size: 0.75rem;
  }

  .image-zoom__nav {
    width: 40px;
    height: 40px;
  }

  .image-zoom__nav--prev {
    left: 0.875rem;
  }

  .image-zoom__nav--next {
    right: 0.875rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .image-zoom-enter-active,
  .image-zoom-leave-active,
  .image-zoom__container,
  .image-zoom__image {
    transition: none !important;
  }
}
</style>

