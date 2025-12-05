<template>
  <ModalDialog
    :model-value="isOpen"
    size="xl"
    body-flush
    hide-close-button
    position="bottom"
    @update:modelValue="handleVisibilityChange"
    @close="close"
  >
    <div class="exercise-modal">
      <!-- Fixed Header -->
      <div class="exercise-modal__header">
        <button class="exercise-modal__close" @click="close" aria-label="Закрыть">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
        <h2 class="exercise-modal__title">{{ props.exerciseTitle }}</h2>
        
        <!-- Quick Nav with smart fades -->
        <div class="exercise-modal__nav-wrapper" v-if="levels.length > 0">
          <div 
            class="exercise-modal__nav-fade exercise-modal__nav-fade--left"
            :class="{ 'exercise-modal__nav-fade--visible': showNavFadeLeft }"
          ></div>
          <div 
            class="exercise-modal__quick-nav" 
            ref="navRef"
            @scroll="handleNavScroll"
          >
            <button
              v-for="(levelGroup, index) in levels"
              :key="levelGroup.levelNumber"
              class="exercise-modal__nav-button"
              :class="{ 'exercise-modal__nav-button--active': activeLevelIndex === index }"
              @click="scrollToLevel(index)"
              :aria-label="`Уровень ${levelGroup.levelNumber}`"
            >
              {{ levelGroup.levelNumber }}
            </button>
          </div>
          <div 
            class="exercise-modal__nav-fade exercise-modal__nav-fade--right"
            :class="{ 'exercise-modal__nav-fade--visible': showNavFadeRight }"
          ></div>
        </div>
      </div>

      <!-- Scrollable Content -->
      <div class="exercise-modal__content" v-if="loading" ref="contentRef">
        <SkeletonLevel v-for="i in 3" :key="`skeleton-level-${i}`" />
      </div>

      <div class="exercise-modal__content" v-else-if="levels.length > 0" ref="contentRef" @scroll="handleScroll">
        <div
          v-for="levelGroup in levels"
          :key="levelGroup.levelNumber"
          class="exercise-modal__level"
          :id="`level-${levelGroup.levelNumber}`"
        >
          <!-- Level Header -->
          <div class="exercise-modal__level-header">
            <h3 class="exercise-modal__level-title">
              <span class="exercise-modal__level-badge">Уровень {{ levelGroup.levelNumber }}</span>
              <span v-if="levelGroup.sublevels[0]?.title">{{ levelGroup.sublevels[0].title }}</span>
            </h3>
          </div>
          
          <!-- Images Section -->
          <div class="exercise-modal__level-images" v-if="hasImagesForLevel(levelGroup.levelNumber)">
            <div 
              class="exercise-modal__image-container"
              @click="openImageZoom(getLevelImagesForLevel(levelGroup.levelNumber), currentImageIndex[levelGroup.levelNumber] || 0)"
            >
              <OptimizedImage
                class="exercise-modal__image"
                :src="getLevelImagesForLevel(levelGroup.levelNumber)[currentImageIndex[levelGroup.levelNumber] || 0]?.src"
                :srcset="getLevelImagesForLevel(levelGroup.levelNumber)[currentImageIndex[levelGroup.levelNumber] || 0]?.srcset || undefined"
                :sizes="MODAL_IMAGE_SIZES"
                alt=""
                loading="lazy"
              />
              
              <!-- Image Navigation if multiple -->
              <div class="exercise-modal__image-controls" v-if="getLevelImagesForLevel(levelGroup.levelNumber).length > 1">
                <button 
                  class="exercise-modal__image-btn"
                  @click.stop="prevImage(levelGroup.levelNumber)"
                  :disabled="(currentImageIndex[levelGroup.levelNumber] || 0) === 0"
                >
                  <AppIcon name="arrowLeft" :size="20" />
                </button>
                <span class="exercise-modal__image-counter">
                  {{ (currentImageIndex[levelGroup.levelNumber] || 0) + 1 }} / {{ getLevelImagesForLevel(levelGroup.levelNumber).length }}
                </span>
                <button 
                  class="exercise-modal__image-btn"
                  @click.stop="nextImage(levelGroup.levelNumber)"
                  :disabled="(currentImageIndex[levelGroup.levelNumber] || 0) >= getLevelImagesForLevel(levelGroup.levelNumber).length - 1"
                >
                  <AppIcon name="arrowRight" :size="20" />
                </button>
              </div>
            </div>
          </div>
          <div class="exercise-modal__image-placeholder" v-else>
            <AppIcon name="info" :size="48" variant="neutral" tone="ghost" />
            <p>Фото отсутствует</p>
          </div>

          <!-- Sublevels Grid -->
          <div class="exercise-modal__sublevels">
            <div 
              v-for="(sublevel, subIdx) in levelGroup.sublevels" 
              :key="sublevel?.id || subIdx"
              class="exercise-modal__sublevel-card"
            >
              <span class="exercise-modal__sublevel-label">{{ getSublevelLabel((levelGroup as any).levelNumber, subIdx) }}</span>
              <span class="exercise-modal__sublevel-value">{{ formatSetsReps(sublevel) }}</span>
            </div>
          </div>

          <!-- Text Sections -->
          <div class="exercise-modal__text-sections">
            <div class="exercise-modal__section" v-if="levelGroup.sublevels[0]?.execution">
              <h4>Выполнение</h4>
              <p>{{ levelGroup.sublevels[0].execution }}</p>
            </div>
            
            <div class="exercise-modal__section" v-if="levelGroup.sublevels[0]?.technique">
              <h4>Техника</h4>
              <p>{{ levelGroup.sublevels[0].technique }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="exercise-modal__content" v-else>
        <div class="exercise-modal__empty">
          <AppIcon name="info" :size="48" variant="neutral" />
          <p>Данные не найдены</p>
        </div>
      </div>
    </div>
  </ModalDialog>

  <ImageZoom
    :is-open="isImageZoomOpen"
    :src="zoomedImageSrc"
    :images="zoomedImages.length > 1 ? zoomedImages : undefined"
    :initial-index="zoomedImageIndex"
    @close="closeImageZoom"
    @image-change="handleZoomImageChange"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { ExerciseLevel } from '@/types';
import { cachedApiClient } from '@/services/cachedApi';
import ErrorHandler from '@/services/errorHandler';
import SkeletonLevel from '@/modules/shared/components/SkeletonLevel.vue';
import ImageZoom from '@/modules/shared/components/ImageZoom.vue';
import OptimizedImage from '@/modules/shared/components/OptimizedImage.vue';
import ModalDialog from '@/modules/shared/components/ModalDialog.vue';
import AppIcon from '@/modules/shared/components/AppIcon.vue';
import { throttle } from '@/utils/debounce';
import { buildExerciseImageSource, type ExerciseImageSource } from '@/utils/exerciseImages';

interface Props {
  isOpen: boolean;
  exerciseKey: string | null;
  exerciseTitle: string;
  exerciseColor?: string;
}

interface LevelGroup {
  levelNumber: number;
  sublevels: ExerciseLevel[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
}>();

const loading = ref(false);
const levelsData = ref<{ items: ExerciseLevel[] } | null>(null);
const activeLevelIndex = ref(0);
const currentImageIndex = ref<Record<number, number>>({});
const contentRef = ref<HTMLElement | null>(null);
const navRef = ref<HTMLElement | null>(null);

// Nav fade visibility state
const showNavFadeLeft = ref(false);
const showNavFadeRight = ref(true);

// Handle nav scroll for smart fades
const handleNavScroll = () => {
  if (!navRef.value) return;
  const { scrollLeft, scrollWidth, clientWidth } = navRef.value;
  const threshold = 5; // Small threshold for edge detection
  showNavFadeLeft.value = scrollLeft > threshold;
  showNavFadeRight.value = scrollLeft < scrollWidth - clientWidth - threshold;
};

// Image zoom state
const isImageZoomOpen = ref(false);
const zoomedImageSrc = ref('');
const zoomedImages = ref<string[]>([]);
const zoomedImageIndex = ref(0);

const MODAL_IMAGE_SIZES = '(max-width: 1024px) 90vw, min(680px, 60vw)';

const handleVisibilityChange = (value: boolean) => {
  if (!value) close();
};

const close = () => emit('close');

// Parsing logic
const getLevelNumber = (levelStr: string): number => {
  const match = levelStr.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
};

const getSublevelNumber = (levelStr: string): number => {
  const parts = levelStr.split('.');
  return parts.length > 1 ? parseInt(parts[1], 10) : 0;
};

const groupedLevels = computed(() => {
  if (!levelsData.value || !levelsData.value.items) return [];
  
  const allLevels = levelsData.value.items.filter(level => level != null);
  const grouped = new Map<number, ExerciseLevel[]>();
  
  allLevels.forEach(level => {
    const levelNum = getLevelNumber(level.level || '0');
    if (!grouped.has(levelNum)) grouped.set(levelNum, []);
    grouped.get(levelNum)!.push(level);
  });
  
  const sorted: Array<{ levelNumber: number; sublevels: ExerciseLevel[] }> = [];
  grouped.forEach((sublevels, levelNumber) => {
    sublevels.sort((a, b) => getSublevelNumber(a.level || '0') - getSublevelNumber(b.level || '0'));
    sorted.push({ levelNumber, sublevels });
  });
  
  return sorted.sort((a, b) => a.levelNumber - b.levelNumber);
}) as any as import('vue').ComputedRef<LevelGroup[]>;

const levels = groupedLevels;

// Image logic
const getLevelImages = (level: ExerciseLevel | null | undefined): ExerciseImageSource[] => {
  if (!level) return [];
  const slots = [level.image1, level.image2, level.image3];
  return slots
    .map((slot) => buildExerciseImageSource(slot ?? null, { defaultWidth: 720 }))
    .filter((image): image is ExerciseImageSource => Boolean(image));
};

const levelImagesCache = new Map<number, ExerciseImageSource[]>();

const getLevelImagesForLevel = (levelNumber: number): ExerciseImageSource[] => {
  if (levelImagesCache.has(levelNumber)) return levelImagesCache.get(levelNumber)!;
  
  const levelGroup = levels.value.find(l => l.levelNumber === levelNumber);
  if (!levelGroup || levelGroup.sublevels.length === 0) return [];
  
  const images = getLevelImages(levelGroup.sublevels[0]);
  levelImagesCache.set(levelNumber, images);
  return images;
};

const hasImagesForLevel = (levelNumber: number) => getLevelImagesForLevel(levelNumber).length > 0;

const prevImage = (levelNumber: number) => {
  const current = currentImageIndex.value[levelNumber] || 0;
  if (current > 0) currentImageIndex.value[levelNumber] = current - 1;
};

const nextImage = (levelNumber: number) => {
  const images = getLevelImagesForLevel(levelNumber);
  const current = currentImageIndex.value[levelNumber] || 0;
  if (current < images.length - 1) currentImageIndex.value[levelNumber] = current + 1;
};

// Scroll logic
const scrollToLevel = async (index: number) => {
  activeLevelIndex.value = index;
  await nextTick();
  const levelGroup = levels.value[index];
  if (levelGroup) {
    const element = document.getElementById(`level-${levelGroup.levelNumber}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

const handleScroll = throttle(() => {
  if (!contentRef.value) return;
  const scrollTop = contentRef.value.scrollTop;
  const levelElements = contentRef.value.querySelectorAll('.exercise-modal__level');
  
  levelElements.forEach((levelElement, index) => {
    const element = levelElement as HTMLElement;
    const offsetTop = element.offsetTop - contentRef.value!.offsetTop - 100;
    if (scrollTop >= offsetTop && scrollTop < offsetTop + element.offsetHeight) {
      activeLevelIndex.value = index;
    }
  });
}, 100);

// Data loading
const loadLevels = async () => {
  if (!props.exerciseKey || !props.isOpen) return;
  loading.value = true;
  currentImageIndex.value = {};
  activeLevelIndex.value = 0;
  levelImagesCache.clear();
  
  try {
    levelsData.value = await cachedApiClient.getExerciseLevels(props.exerciseKey);
  } catch (error) {
    ErrorHandler.handle(error, 'loadExerciseLevels');
    levelsData.value = null;
  } finally {
    loading.value = false;
  }
};

watch(() => props.isOpen, (newValue) => {
  if (newValue && props.exerciseKey) loadLevels();
  else levelsData.value = null;
});

// Zoom logic
const openImageZoom = (images: ExerciseImageSource[], index: number) => {
  if (!images.length) return;
  const resolved = images.map((image) => image.src);
  zoomedImages.value = resolved;
  zoomedImageIndex.value = index;
  zoomedImageSrc.value = resolved[index] ?? '';
  isImageZoomOpen.value = true;
};

const closeImageZoom = () => {
  isImageZoomOpen.value = false;
  setTimeout(() => {
    zoomedImages.value = [];
    zoomedImageSrc.value = '';
  }, 300);
};

const handleZoomImageChange = (index: number) => {
  zoomedImageIndex.value = index;
  zoomedImageSrc.value = zoomedImages.value[index] ?? '';
};

const getSublevelLabel = (levelNumber: number, sublevelIndex: number) => {
  const labels = ['Начальный', 'Продвинутый', 'Профессиональный'];
  if (levelNumber === 10 && sublevelIndex === 2) return 'Элитный';
  return labels[sublevelIndex] || '';
};

const formatSetsReps = (sublevel: ExerciseLevel | null | undefined) => {
  if (!sublevel) return '—';
  if (sublevel.sets && sublevel.reps) return `${sublevel.sets} × ${sublevel.reps}`;
  return '—';
};
</script>

<style scoped>
.exercise-modal {
  display: flex;
  flex-direction: column;
  height: 75vh; /* 3/4 screen height */
  max-height: 85vh;
  background: var(--color-bg-modal);
  color: var(--color-text-primary);
  overflow: hidden;
  border-top-left-radius: 32px;
  border-top-right-radius: 32px;
  box-shadow: var(--shadow-xl);
  width: 100%;
}

/* Override parent dialog styles to remove white corners/background */
:global(.app-modal__dialog:has(.exercise-modal)) {
  background: transparent !important;
  box-shadow: none !important;
  border: none !important;
  padding: 0 !important;
}

.exercise-modal__header {
  flex-shrink: 0;
  padding: 24px;
  background: var(--color-bg-modal);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
  z-index: 10;
}

.exercise-modal__close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 48px;
  height: 48px;
  background: transparent;
  border: 2px solid var(--color-border-strong);
  cursor: pointer;
  color: var(--color-text-primary);
  padding: 0;
  border-radius: 50%;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.exercise-modal__close:hover {
  border-color: var(--color-text-primary);
  transform: rotate(90deg) scale(1.1);
}

.exercise-modal__title {
  margin: 0;
  padding-right: 56px;
  font-size: 1.75rem;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, var(--color-text-primary) 0%, var(--color-text-secondary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  word-wrap: break-word;
}

/* Nav wrapper for smart fades */
.exercise-modal__nav-wrapper {
  position: relative;
  margin: 0 -24px;
  overflow: hidden; /* Clip glow at top/bottom */
}

.exercise-modal__quick-nav {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 20px 24px 20px; /* More vertical padding for glow */
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.exercise-modal__quick-nav::-webkit-scrollbar {
  display: none;
}

/* Smart fade overlays - fixed position within wrapper */
.exercise-modal__nav-fade {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 56px;
  pointer-events: none;
  z-index: 5;
  opacity: 0;
  transition: opacity 0.25s ease;
}

.exercise-modal__nav-fade--visible {
  opacity: 1;
}

.exercise-modal__nav-fade--left {
  left: 0;
  background: linear-gradient(to right, var(--color-bg-modal) 0%, transparent 100%);
}

.exercise-modal__nav-fade--right {
  right: 0;
  background: linear-gradient(to left, var(--color-bg-modal) 0%, transparent 100%);
}

.exercise-modal__nav-button {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.exercise-modal__nav-button--active {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
  border-color: var(--color-accent);
  transform: scale(1.1);
  box-shadow: 0 0 16px var(--color-accent-light);
  z-index: 2;
}

.exercise-modal__content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
  scroll-behavior: smooth;
}

.exercise-modal__level {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding-bottom: 32px;
  border-bottom: 1px solid var(--color-border);
}

.exercise-modal__level:last-child {
  border-bottom: none;
}

.exercise-modal__level-header {
  display: flex;
  align-items: center;
}

.exercise-modal__level-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.exercise-modal__level-badge {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.85rem;
}

.exercise-modal__image-container {
  position: relative;
  border-radius: 24px;
  overflow: hidden;
  background: #000;
  aspect-ratio: 4/3; /* Taller aspect ratio for better visibility */
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--color-border);
}

.exercise-modal__image {
  width: 100%;
  height: 100%;
  object-fit: contain; /* Show full image */
  background: #000;
}

.exercise-modal__image-controls {
  position: absolute;
  bottom: var(--space-sm);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  background: rgba(0, 0, 0, 0.6);
  padding: 4px 12px;
  border-radius: 999px;
  backdrop-filter: blur(4px);
}

.exercise-modal__image-btn {
  background: transparent;
  border: none;
  color: white;
  cursor: pointer;
  padding: 2px;
  display: flex;
}

.exercise-modal__image-btn:disabled {
  opacity: 0.3;
}

.exercise-modal__image-counter {
  color: white;
  font-size: 0.85rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.exercise-modal__image-placeholder {
  aspect-ratio: 16/9;
  background: var(--color-bg-elevated);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--color-text-tertiary);
  gap: var(--space-sm);
}

.exercise-modal__sublevels {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--space-sm);
}

.exercise-modal__sublevel-card {
  background: var(--color-surface);
  padding: 16px;
  border-radius: 16px;
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.exercise-modal__sublevel-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  font-weight: 600;
  letter-spacing: 0.05em;
}

.exercise-modal__sublevel-value {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-text-primary);
}

.exercise-modal__text-sections {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.exercise-modal__section h4 {
  margin: 0 0 12px;
  font-size: 0.9rem;
  color: var(--color-accent);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 700;
}

.exercise-modal__section p {
  margin: 0;
  font-size: 1rem;
  line-height: 1.6;
  color: var(--color-text-primary);
}

.exercise-modal__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-xl);
  color: var(--color-text-tertiary);
  gap: var(--space-md);
}
</style>