<template>
  <div ref="exercisesPageRef" class="exercises-page" :style="pageStyleVarsWithParallax">
    <!-- Page Title - по центру, единый стиль -->
    <h1 ref="pageTitleRef" class="page-title" :style="parallaxPageTitle">Программы тренировок</h1>

    <!-- Error State -->
    <div v-if="error && !programs.length && !loading" class="page-error">
      <ErrorState
        message="Не удалось загрузить программы тренировок"
        @retry="loadCatalog"
      />
    </div>

    <!-- Main Content -->
    <div ref="pageContentRef" class="page-content">
      <!-- Flip Toggle - СВЕРХУ над всем -->
      <div v-if="currentProgram && displayPrograms.length > 0" class="direction-flip-toggle">
        <button 
          :class="['flip-toggle-btn', { 'active': !showPrograms }]"
          @click="showPrograms = false"
        >
          Направление
        </button>
        <button 
          :class="['flip-toggle-btn', { 'active': showPrograms }]"
          @click="showPrograms = true"
        >
          Программы
        </button>
      </div>

      <div ref="programsSectionRef" class="programs-section" :style="parallaxProgramsSection">

        <div class="program-card-wrapper" :style="currentProgram ? getProgramStyles(currentProgram) : undefined">
          <div class="programs-container">
            <!-- Flip Container with 3D transform -->
            <div class="card-flip-container" :class="{ 'flipped': showPrograms }">
              <transition
                :name="disciplineSlideDirection === 'next' ? 'discipline-slide-next' : 'discipline-slide-prev'"
                mode="out-in"
              >
                <div
                  v-if="currentProgram && displayPrograms.length > 0"
                  :key="visibleIndex"
                  class="card-flip-inner"
                >
                  <!-- FRONT SIDE: Direction Card -->
                  <div class="card-flip-front">
                    <BaseCard
                      ref="disciplineCardRef"
                      class="program-card-interactive"
                      :class="{ 'program-card-interactive--locked': currentProgram?.locked }"
                      hoverable
                      :style="currentProgram ? { ...getProgramStyles(currentProgram), ...getCard3DStyle(`discipline-${currentProgram.id}`) } : undefined"
                      @click="currentProgram && !currentProgram.locked && onProgramClick(currentProgram)"
                      @mousemove="(e) => currentProgram && !currentProgram.locked && handle3DMouseMove(e, `discipline-${currentProgram.id}`)"
                      @mouseleave="() => currentProgram && !currentProgram.locked && handle3DMouseLeave(`discipline-${currentProgram.id}`)"
                    >
                      <div class="program-title">{{ currentProgram?.title || '' }}</div>
                      <div v-if="currentProgram?.subtitle" class="program-subtitle">{{ currentProgram?.subtitle }}</div>
                    </BaseCard>
                  </div>

                  <!-- BACK SIDE: Programs List -->
                  <div class="card-flip-back">
                    <div ref="trainingProgramsSectionElement" class="programs-back-container" :style="parallaxTrainingPrograms">
                      <transition
                        :name="slideDirection === 'next' ? 'program-slide-next' : 'program-slide-prev'"
                        mode="out-in"
                      >
                        <template v-if="trainingProgramsLoading">
                          <SkeletonProgram key="skeleton-program" />
                        </template>
                        <template v-else-if="trainingProgramsError">
                          <ErrorState
                            key="training-programs-error"
                            :message="trainingProgramsError"
                            action-label="Попробовать снова"
                            @retry="retryLoadTrainingPrograms"
                          />
                        </template>
                        <template v-else-if="trainingPrograms.length > 0">
                          <div class="training-program-card-wrapper" key="training-program-wrapper">
                            <BaseCard
                              key="training-program-card"
                              ref="trainingProgramCardRef"
                              class="training-program-card training-program-card--back"
                              hoverable
                              :style="{ ...getTrainingProgramStyles(currentTrainingProgram), ...getCard3DStyle(`program-${currentTrainingProgram?.id || 'none'}`) }"
                              @mousemove="(e) => currentTrainingProgram && handle3DMouseMove(e, `program-${currentTrainingProgram.id}`)"
                              @mouseleave="() => currentTrainingProgram && handle3DMouseLeave(`program-${currentTrainingProgram.id}`)"
                            >
                              <div class="training-program-content" v-if="currentTrainingProgram">
                                <div class="training-program-title">{{ currentTrainingProgram.name }}</div>
                                <div v-if="currentTrainingProgram.description" class="training-program-description">{{ currentTrainingProgram.description }}</div>
                              </div>
                            </BaseCard>

                            <button
                              type="button"
                              class="training-program-card__nav training-program-card__nav--left"
                              :disabled="!hasPrevTrainingProgram"
                              @click.stop="selectPrevTrainingProgram"
                            >
                              ‹
                            </button>
                            <button
                              type="button"
                              class="training-program-card__nav training-program-card__nav--right"
                              :disabled="!hasNextTrainingProgram"
                              @click.stop="selectNextTrainingProgram"
                            >
                              ›
                            </button>
                          </div>
                        </template>
                        <template v-else>
                          <div key="training-programs-empty" class="empty-state empty-state--inline">
                            <div class="empty-state__icon">📘</div>
                            <div class="empty-state__title">Нет программ</div>
                            <p class="empty-state__description">
                              Для выбранного направления пока нет программ.
                            </p>
                          </div>
                        </template>
                      </transition>
                    </div>
                  </div>

                  <!-- Navigation arrows for direction (on front side) -->
                  <button
                    v-if="!showPrograms"
                    type="button"
                    class="program-button__nav program-button__nav--left"
                    :disabled="!hasPrev"
                    @click="selectPrevProgram"
                  >
                    ‹
                  </button>
                  <button
                    v-if="!showPrograms"
                    type="button"
                    class="program-button__nav program-button__nav--right"
                    :disabled="!hasNext"
                    @click="selectNextProgram"
                  >
                    ›
                  </button>
                </div>
                <SkeletonDiscipline
                  v-else
                  key="skeleton-discipline"
                />
              </transition>
            </div>
          </div>
        </div>
      </div>

      <!-- Training programs moved to flip card back -->

      <!-- Exercises Toggle Button -->
      <div class="exercises-toggle-container" v-if="currentProgram && (currentTrainingProgram || !showPrograms)">
        <button 
          class="exercises-toggle-btn-main" 
          @click="toggleExercises"
          :class="{ 'active': exercisesExpanded }"
        >
          <span>{{ showPrograms ? 'Упражнения программы' : 'Все упражнения' }}</span>
          <AppIcon :name="exercisesExpanded ? 'chevronUp' : 'chevronDown'" />
        </button>
      </div>

      <!-- Collapsible Exercises Section -->
      <div class="exercises-collapsible-wrapper" :class="{ 'expanded': exercisesExpanded }">
        <div class="exercises-collapsible-content">
          <!-- Упражнения показываются только если выбрана реальная программа -->
          <div ref="exercisesSectionElement" class="exercises-section" v-if="currentProgram" :style="parallaxExercises">
            <div ref="exercisesListRef" class="exercises-container" :class="{ 'exercises-container--visible': exercisesVisible && !programExercisesLoading }">
              <transition
                :name="slideDirection === 'next' ? 'program-slide-next' : 'program-slide-prev'"
                mode="out-in"
                :key="`exercises-${visibleTrainingProgramIndex}-${visibleIndex}`"
              >
                <template v-if="programExercisesLoading">
                  <div key="loading" class="exercises-list">
                    <SkeletonExercise
                      v-for="i in 3"
                      :key="`skeleton-exercise-${i}`"
                    />
                  </div>
                </template>
                <template v-else-if="programExercisesError">
                  <ErrorState
                    key="exercises-error"
                    :message="programExercisesError"
                    action-label="Обновить"
                    @retry="retryLoadProgramExercises"
                  />
                </template>
                <template v-else-if="programExercises.length > 0">
                  <!-- Реальные упражнения с Virtual Scrolling -->
                  <div 
                    key="list" 
                    class="exercises-list"
                    :class="{ 'exercises-list--virtual': programExercises.length > 10 }"
                    :ref="el => { exercisesScrollContainerRef = el as HTMLElement; }"
                  >
                    <!-- Virtual scrolling wrapper - показывает только видимые элементы -->
                    <div 
                      v-if="programExercises.length > 10"
                      class="exercises-list-virtual"
                      :style="{ height: `${exercisesListHeight}px`, position: 'relative' }"
                    >
                      <!-- Виртуальное позиционирование видимых элементов -->
                      <div
                        class="exercises-list-virtual-content"
                        :style="{ transform: `translateY(${exercisesOffsetY}px)` }"
                      >
                        <BaseCard
                          v-for="{ exercise, index: realIndex } in visibleExercises"
                          :key="exercise.id"
                          :data-exercise-index="realIndex"
                          class="program-exercise-card"
                          :class="{ 'program-exercise-card--expanded': expandedIconId === exercise.id }"
                          hoverable
                          :style="{ 
                            ...exerciseCardStyles[realIndex], 
                            ...getCard3DStyle(`exercise-${exercise.id}`) 
                          }"
                          @click="handleExerciseCardClick($event, exercise)"
                          @mouseenter="() => { prefetchExerciseData(exercise); preloadExerciseImages(exercise, 'high'); }"
                          @mousemove="(e) => handle3DMouseMove(e, `exercise-${exercise.id}`)"
                          @mouseleave="() => { handle3DMouseLeave(`exercise-${exercise.id}`); cancelPrefetchExercise(); }"
                        >
                          <!-- Иконка упражнения -->
                          <div 
                            class="program-exercise-icon"
                            :class="{ 'program-exercise-icon--has-image': exercise.iconUrl }"
                            @click.stop="handleIconClick(exercise)"
                          >
                            <img 
                              v-if="exercise.iconUrl"
                              :src="exercise.iconUrl"
                              :alt="exercise.title"
                              class="program-exercise-icon__img"
                            />
                            <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                              <path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                          </div>
                          <!-- Контент карточки -->
                          <div class="program-exercise-content">
                            <div class="program-exercise-title text-fade-in" :style="{ '--delay': `${realIndex * 50}ms` }">{{ exercise.title }}</div>
                            <div v-if="exercise.description" class="program-exercise-description text-fade-in" :style="{ '--delay': `${realIndex * 50 + 100}ms` }">{{ exercise.description }}</div>
                          </div>
                          <!-- Расширенное изображение (Smart Fill) -->
                          <template v-if="expandedIconId === exercise.id && exercise.iconUrlHover">
                            <!-- Слой 1: Размытый фон -->
                            <div class="program-exercise-expanded-bg">
                              <img 
                                :src="exercise.iconUrlHover"
                                alt=""
                                class="program-exercise-expanded-bg__img"
                              />
                            </div>
                            <!-- Слой 2: Основное изображение -->
                            <img 
                              :src="exercise.iconUrlHover"
                              :alt="exercise.title"
                              class="program-exercise-expanded-img"
                            />
                          </template>
                        </BaseCard>
                      </div>
                    </div>
                    <!-- Для коротких списков рендерим все элементы (без virtual scrolling) -->
                    <template v-else>
                      <BaseCard
                        v-for="(exercise, index) in programExercises"
                        :key="exercise.id"
                        class="program-exercise-card"
                        :class="{ 'program-exercise-card--expanded': expandedIconId === exercise.id }"
                        hoverable
                        :style="{ ...exerciseCardStyles[index], ...getCard3DStyle(`exercise-${exercise.id}`) }"
                        @click="handleExerciseCardClick($event, exercise)"
                        @mouseenter="() => { prefetchExerciseData(exercise); preloadExerciseImages(exercise, 'high'); }"
                        @mousemove="(e) => handle3DMouseMove(e, `exercise-${exercise.id}`)"
                        @mouseleave="() => { handle3DMouseLeave(`exercise-${exercise.id}`); cancelPrefetchExercise(); }"
                      >
                        <!-- Иконка упражнения -->
                        <div 
                          class="program-exercise-icon"
                          :class="{ 'program-exercise-icon--has-image': exercise.iconUrl }"
                          @click.stop="handleIconClick(exercise)"
                        >
                          <img 
                            v-if="exercise.iconUrl"
                            :src="exercise.iconUrl"
                            :alt="exercise.title"
                            class="program-exercise-icon__img"
                          />
                          <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                            <path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                          </svg>
                        </div>
                        <!-- Контент карточки -->
                        <div class="program-exercise-content">
                          <div class="program-exercise-title text-fade-in" :style="{ '--delay': `${index * 50}ms` }">{{ exercise.title }}</div>
                          <div v-if="exercise.description" class="program-exercise-description text-fade-in" :style="{ '--delay': `${index * 50 + 100}ms` }">{{ exercise.description }}</div>
                        </div>
                        <!-- Расширенное изображение (Smart Fill) -->
                        <template v-if="expandedIconId === exercise.id && exercise.iconUrlHover">
                          <!-- Слой 1: Размытый фон (заполняет всю карточку) -->
                          <div class="program-exercise-expanded-bg">
                            <img 
                              :src="exercise.iconUrlHover"
                              alt=""
                              class="program-exercise-expanded-bg__img"
                            />
                          </div>
                          <!-- Слой 2: Основное изображение (по центру, без обрезки) -->
                          <img 
                            :src="exercise.iconUrlHover"
                            :alt="exercise.title"
                            class="program-exercise-expanded-img"
                          />
                        </template>
                      </BaseCard>
                    </template>
                  </div>
                </template>
                <template v-else>
                  <div key="empty" class="exercises-empty">
                    <div class="exercises-empty__icon">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity="0.3"/>
                        <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
                      </svg>
                    </div>
                    <p class="exercises-empty__text">Упражнения
                      пока не выбраны — попробуй переключить программу или обновить каталог.
                    </p>
                    <button type="button" class="button button--ghost" @click="retryLoadProgramExercises">
                      Обновить упражнения
                    </button>
                  </div>
                </template>
              </transition>
            </div>
          </div>
        </div>
      </div>
    </div>

      <!-- Exercise Modal -->
    <ExerciseModal
      :isOpen="isExerciseModalOpen"
      :exerciseKey="selectedExercise?.exerciseKey || null"
      :exerciseTitle="selectedExercise?.title || ''"
      :exerciseColor="exerciseModalColor"
      @close="closeExerciseModal"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, computed, readonly, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useAppStore } from '@/stores/app';
import { cachedApiClient } from '@/services/cachedApi';
import { invalidateProgramContextCaches } from '@/services/cacheManager';
import { TrainingDirection, TrainingProgram, ProgramExercise } from '@/types';
import ErrorHandler from '@/services/errorHandler';
import ErrorState from '@/modules/shared/components/ErrorState.vue';
// import BaseButton from '@/components/ui/BaseButton.vue'; // TODO: Use when refactoring
import BaseCard from '@/components/ui/BaseCard.vue';
import { createLazyComponent } from '@/utils/lazyComponent';
import SkeletonDiscipline from '@/modules/shared/components/SkeletonDiscipline.vue';
import SkeletonProgram from '@/modules/shared/components/SkeletonProgram.vue';
import SkeletonExercise from '@/modules/shared/components/SkeletonExercise.vue';
import AppIcon from '@/modules/shared/components/AppIcon.vue';
import { lightenColor, mixColors, getDisciplineColor, generateDisciplineGradient, getExerciseColor, getProgramColor } from '@/utils/colorUtils';
import { hapticLight, hapticMedium, hapticSelection } from '@/utils/hapticFeedback';
import { SwipeGesture, type SwipeDirection } from '@/utils/swipeGestures';
import { useIntersectionObserver } from '@/composables/useIntersectionObserver';
import { useBatchUpdates } from '@/composables/useBatchUpdates';
import { buildExerciseImageSource, type ExerciseImageSource } from '@/utils/exerciseImages';
import { stripImageTransforms, stripSrcsetTransforms } from '@/utils/imageTransforms';

const ExerciseModal = createLazyComponent(() => import('@/modules/exercises/components/ExerciseModal.vue'), {
  delay: 0,
  suspensible: true,
});

const appStore = useAppStore();
const { showToast } = appStore;

// Batch updates для оптимизации DOM updates
const { batchRAF, batchNextTick } = useBatchUpdates();

type BaseProgram = { id: string; title: string; subtitle: string; locked?: boolean; slug?: string; name?: string };
type DisplayProgram = BaseProgram & {
  color: string;
  gradient?: ReturnType<typeof generateDisciplineGradient>;
};

// Programs loaded from API only - используем shallowRef для оптимизации (массив не требует глубокой реактивности)
const programs = shallowRef<BaseProgram[]>([]);

const loading = ref(true);
const error = ref<Error | null>(null);
const activeProgram = ref<string>('');
const visibleIndex = ref(0);
const prevVisibleIndex = ref(0);

// Состояния видимости для последовательного появления элементов
const disciplineVisible = ref(false);
const programsVisible = ref(false);
const exercisesVisible = ref(false);

// Flip animation state
const showPrograms = ref(false);

// Collapsible Exercises State
const exercisesExpanded = ref(false);
const toggleExercises = () => {
  exercisesExpanded.value = !exercisesExpanded.value;
};

// Training Programs State - используем shallowRef для оптимизации (массив не требует глубокой реактивности)
const trainingPrograms = shallowRef<TrainingProgram[]>([]);
const trainingProgramsLoading = ref(false);
const trainingProgramsError = ref<string | null>(null);
const visibleTrainingProgramIndex = ref(0);
const prevTrainingProgramIndex = ref(0);

// Program Exercises State - используем shallowRef для оптимизации (массив не требует глубокой реактивности)
const programExercises = shallowRef<ProgramExercise[]>([]);
const programExercisesLoading = ref(false);
const programExercisesError = ref<string | null>(null);

// Icon expand state - для показа hover-изображения при клике
const expandedIconId = ref<string | null>(null);
let expandedIconTimeout: ReturnType<typeof setTimeout> | null = null;

// ==================== VIRTUAL SCROLLING для Упражнений ====================
// Virtual scrolling state - рендерим только видимые карточки для производительности
const EXERCISE_CARD_HEIGHT = 88; // Приблизительная высота карточки упражнения (включая gap)
const VIRTUAL_SCROLL_BUFFER = 3; // Количество элементов буфера сверху и снизу

const exercisesScrollContainerRef = ref<HTMLElement | null>(null);
const exercisesScrollTop = ref(0);
const exercisesViewportHeight = ref(0);

// Вычисляем видимые индексы упражнений для virtual scrolling
const visibleExerciseIndices = computed(() => {
  if (!exercisesViewportHeight.value || programExercises.value.length === 0) {
    // Если список короткий (<10 элементов), рендерим все
    if (programExercises.value.length <= 10) {
      return { start: 0, end: programExercises.value.length };
    }
    // Для длинных списков используем virtual scrolling
    return { start: 0, end: Math.min(VIRTUAL_SCROLL_BUFFER * 2 + 1, programExercises.value.length) };
  }
  
  const scrollTop = exercisesScrollTop.value;
  const viewportHeight = exercisesViewportHeight.value;
  
  // Используем фиксированную высоту для расчета (если нет фактических измерений)
  const avgHeight = EXERCISE_CARD_HEIGHT;
  
  // Рассчитываем видимый диапазон
  const start = Math.max(0, Math.floor(scrollTop / avgHeight) - VIRTUAL_SCROLL_BUFFER);
  const end = Math.min(
    programExercises.value.length,
    Math.ceil((scrollTop + viewportHeight) / avgHeight) + VIRTUAL_SCROLL_BUFFER + 1
  );
  
  return { start, end };
});

// Видимые упражнения для рендеринга (virtual scrolling)
const visibleExercises = computed(() => {
  const { start, end } = visibleExerciseIndices.value;
  return programExercises.value.slice(start, end).map((exercise, index) => ({
    exercise,
    index: start + index, // Реальный индекс в полном списке
  }));
});

// Общая высота списка для virtual scrolling
const exercisesListHeight = computed(() => {
  if (programExercises.value.length === 0) return 0;
  
  // Если список короткий, не используем virtual scrolling
  if (programExercises.value.length <= 10) {
    return programExercises.value.length * EXERCISE_CARD_HEIGHT;
  }
  
  // Для длинных списков используем приблизительную высоту
  return programExercises.value.length * EXERCISE_CARD_HEIGHT;
});

// Смещение для виртуального позиционирования
const exercisesOffsetY = computed(() => {
  const { start } = visibleExerciseIndices.value;
  return start * EXERCISE_CARD_HEIGHT;
});

// Обработчик скролла для virtual scrolling (throttled)
let exercisesScrollRafId: number | null = null;
const handleExercisesScroll = () => {
  if (exercisesScrollRafId !== null) return;
  
  exercisesScrollRafId = requestAnimationFrame(() => {
    if (exercisesScrollContainerRef.value) {
      exercisesScrollTop.value = exercisesScrollContainerRef.value.scrollTop;
      exercisesViewportHeight.value = exercisesScrollContainerRef.value.clientHeight;
      
      // Обновляем предзагрузку изображений при скролле (для видимых элементов)
      preloadVisibleExerciseImages();
    }
    exercisesScrollRafId = null;
  });
};

// Инициализация virtual scrolling
const initExercisesVirtualScroll = () => {
  if (!exercisesScrollContainerRef.value) return;
  
  exercisesScrollTop.value = exercisesScrollContainerRef.value.scrollTop;
  exercisesViewportHeight.value = exercisesScrollContainerRef.value.clientHeight;
  
  // Добавляем обработчик скролла
  exercisesScrollContainerRef.value.addEventListener('scroll', handleExercisesScroll, { passive: true });
};

// Очистка virtual scrolling
const cleanupExercisesVirtualScroll = () => {
  if (exercisesScrollContainerRef.value) {
    exercisesScrollContainerRef.value.removeEventListener('scroll', handleExercisesScroll);
  }
  if (exercisesScrollRafId !== null) {
    cancelAnimationFrame(exercisesScrollRafId);
    exercisesScrollRafId = null;
  }
};

// ==================== IMAGE PRELOADING для Упражнений ====================
// State для image preloading
const exerciseImagesPreloaded = ref<Set<string>>(new Set()); // Кеш предзагруженных изображений
const exerciseImagesPreloading = ref<Set<string>>(new Set()); // Изображения в процессе загрузки
const exerciseLevelsCache = ref<Map<string, any>>(new Map()); // Кеш уровней упражнений (для быстрого доступа к изображениям)
const EXERCISE_IMAGE_SIZES = '(max-width: 1024px) 80vw, min(640px, 60vw)';

// Функция для извлечения изображений из уровней упражнения
const extractExerciseImages = (levels: any[]): ExerciseImageSource[] => {
  const images: ExerciseImageSource[] = [];

  for (const level of levels) {
    const candidates = [level?.image1, level?.image2, level?.image3];
    candidates.forEach((candidate) => {
      const source = buildExerciseImageSource(candidate ?? null, {
        defaultWidth: 720,
        widths: [360, 480, 640, 768, 960, 1280],
        sizes: EXERCISE_IMAGE_SIZES,
      });
      if (!source) {
        return;
      }

      const sanitizedSrc = stripImageTransforms(source.src) ?? source.src;
      const sanitizedSrcset = stripSrcsetTransforms(source.srcset ?? null) ?? source.srcset;

      if (!images.some((existing) => existing.src === sanitizedSrc)) {
        images.push({
          ...source,
          src: sanitizedSrc,
          srcset: sanitizedSrcset,
        });
      }
    });
  }

  return images;
};

// Предзагрузка изображений упражнения
const preloadExerciseImages = async (exercise: ProgramExercise, priority: 'high' | 'low' = 'low') => {
  if (!exercise.exerciseKey) return;
  
  const cacheKey = `exercise_images_${exercise.exerciseKey}`;
  
  // Проверяем, не загружаем ли уже
  if (exerciseImagesPreloading.value.has(cacheKey)) return;
  
  // Проверяем, не загружены ли уже
  if (exerciseImagesPreloaded.value.has(cacheKey)) return;
  
  exerciseImagesPreloading.value.add(cacheKey);
  
  try {
    // Загружаем уровни упражнения (если еще не загружены)
    let levels = exerciseLevelsCache.value.get(exercise.exerciseKey);
    
    if (!levels) {
      // Загружаем уровни в фоне (используем кеш для быстрого доступа)
      const data = await cachedApiClient.getExerciseLevels(exercise.exerciseKey);
      levels = data?.items || [];
      exerciseLevelsCache.value.set(exercise.exerciseKey, levels);
    }
    
    // ОПТИМИЗАЦИЯ: Предзагружаем только первые 3 уровня, чтобы не спамить запросами (вместо всех 30+)
    // Это снижает количество запросов с ~90 до ~9 на упражнение
    const levelsToPreload = levels.slice(0, 3);
    
    // Извлекаем изображения
    const images = extractExerciseImages(levelsToPreload);

    // Предзагружаем изображения с приоритетом
    const loadImage = (image: ExerciseImageSource) => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          resolve();
        };
        img.onerror = () => resolve(); // Игнорируем ошибки (404 и т.д.)
        if (image.srcset) {
          img.srcset = image.srcset;
          if (image.sizes) {
            img.sizes = image.sizes;
          }
        }
        img.src = image.src;

        // Для высокого приоритета загружаем быстрее
        if (priority === 'high') {
          img.fetchPriority = 'high';
        }
      });
    };
    
    // Загружаем изображения параллельно (но с ограничением для низкого приоритета)
    if (priority === 'high') {
      // Для высокого приоритета - все параллельно (их теперь мало)
      await Promise.all(images.map(loadImage));
    } else {
      // Для низкого приоритета - батчами по 3 для экономии ресурсов
      for (let i = 0; i < images.length; i += 3) {
        const batch = images.slice(i, i + 3);
        await Promise.all(batch.map(loadImage));
        // Небольшая задержка между батчами для неблокирующей загрузки
        if (i + 3 < images.length) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    }
    
    exerciseImagesPreloaded.value.add(cacheKey);
  } catch (error) {
    console.warn(`Failed to preload images for ${exercise.exerciseKey}`, error);
  } finally {
    exerciseImagesPreloading.value.delete(cacheKey);
  }
};

// Предзагрузка изображений видимых упражнений (high priority)
const preloadVisibleExerciseImages = () => {
  if (programExercises.value.length === 0) return;
  
  const { start, end } = visibleExerciseIndices.value;
  const visibleExercises = programExercises.value.slice(start, end);
  
  // Предзагружаем изображения видимых упражнений с высоким приоритетом
  visibleExercises.forEach((exercise) => {
    if (exercise.exerciseKey) {
      requestAnimationFrame(() => {
        preloadExerciseImages(exercise, 'high');
      });
    }
  });
};

// Предзагрузка изображений всех упражнений после загрузки списка (low priority)
const preloadAllExerciseImages = () => {
  if (programExercises.value.length === 0) return;
  
  // Начинаем предзагрузку всех изображений в фоне с низким приоритетом
  programExercises.value.forEach((exercise, index) => {
    if (exercise.exerciseKey) {
      // Небольшая задержка для каждого упражнения, чтобы не перегружать браузер
      setTimeout(() => {
        preloadExerciseImages(exercise, 'low');
      }, index * 200); // 200ms между каждым упражнением (увеличили интервал)
    }
  });
};

// Exercise Modal State
const selectedExercise = ref<ProgramExercise | null>(null);
const isExerciseModalOpen = ref(false);

// 3D Hover Effect State для динамического наклона карточек
const card3DHover = ref<{ [key: string]: { rotateX: number; rotateY: number } }>({});

// Swipe Gesture Refs
const disciplineCardRef = ref<HTMLElement | null>(null);
const trainingProgramCardRef = ref<HTMLElement | null>(null);
const exercisesListRef = ref<HTMLElement | null>(null);

// Intersection Observer Refs для lazy loading
const trainingProgramsSectionElement = ref<HTMLElement | null>(null);
const exercisesSectionElement = ref<HTMLElement | null>(null);

// Swipe Gesture Instances
let disciplineSwipe: SwipeGesture | null = null;
let trainingProgramSwipe: SwipeGesture | null = null;
let exercisesSwipe: SwipeGesture | null = null;

// Функция для обработки 3D hover эффекта (оптимизирована с RAF для batch обновлений)
let raf3DId: number | null = null;
const pending3DUpdates = new Map<string, { rotateX: number; rotateY: number }>();

const handle3DMouseMove = (event: MouseEvent, cardId: string) => {
  // Сохраняем вычисления для batch обновления в RAF (не блокируем UI)
  const card = (event.currentTarget as HTMLElement);
  const rect = card.getBoundingClientRect();
  const cardCenterX = rect.left + rect.width / 2;
  const cardCenterY = rect.top + rect.height / 2;
  
  const mouseX = event.clientX - cardCenterX;
  const mouseY = event.clientY - cardCenterY;
  
  const maxRotateX = 8;
  const maxRotateY = 8;
  
  const rotateY = (mouseX / (rect.width / 2)) * maxRotateY;
  const rotateX = -(mouseY / (rect.height / 2)) * maxRotateX;
  
  const clampedRotateX = Math.max(-maxRotateX, Math.min(maxRotateX, rotateX));
  const clampedRotateY = Math.max(-maxRotateY, Math.min(maxRotateY, rotateY));
  
  // Сохраняем обновление для batch обработки в RAF
  pending3DUpdates.set(cardId, { rotateX: clampedRotateX, rotateY: clampedRotateY });
  
  // Используем RAF для batch обновления всех карточек за один кадр
  if (raf3DId === null) {
    raf3DId = requestAnimationFrame(() => {
      // Применяем все обновления за один раз (не блокируем UI)
      pending3DUpdates.forEach((value, id) => {
        card3DHover.value[id] = value;
      });
      pending3DUpdates.clear();
      raf3DId = null;
    });
  }
};

// Функция для сброса 3D эффекта при уходе мыши
const handle3DMouseLeave = (cardId: string) => {
  card3DHover.value[cardId] = { rotateX: 0, rotateY: 0 };
};

// Computed свойства для стилей 3D трансформации (максимально оптимизировано)
const getCard3DStyle = (cardId: string) => {
  // Для программ полностью отключаем 3D эффект во время transition
  if (cardId.startsWith('program-') && isTransitioningPrograms) {
    return { transform: 'translateZ(0)', transition: 'none' };
  }
  
  // Для направлений отключаем 3D эффект во время transition
  if (cardId.startsWith('discipline-') && isTransitioningDisciplines) {
    return {};
  }
  
  const hover = card3DHover.value[cardId];
  
  // Если нет 3D эффекта - не возвращаем ничего
  if (!hover || (hover.rotateX === 0 && hover.rotateY === 0)) {
    return {};
  }
  
  // Упрощенная логика - только 3D эффект, без дополнительных трансформаций
  // чтобы не конфликтовать с slide transitions
  const combinedTransform = `perspective(1000px) rotateX(${hover.rotateX}deg) rotateY(${hover.rotateY}deg) translateZ(0)`;
  
  return {
    transform: combinedTransform,
    // Быстрый transition только для 3D эффекта
    transition: 'transform 0.1s linear',
  };
};

// Exercise card colors - разнообразная палитра для карточек упражнений (без желтых, красных и зеленых)
const exerciseCardColors = [
  // Синие/голубые оттенки
  '#3B82F6', '#2563EB', '#1D4ED8', '#1E40AF', // Синие
  '#60A5FA', '#3B82F6', '#2563EB', '#1D4ED8', // Светло-синие
  '#06B6D4', '#0891B2', '#0E7490', '#155E75', // Голубые
  '#22D3EE', '#06B6D4', '#0891B2', '#0E7490', // Светло-голубые
  // Фиолетовые/пурпурные оттенки
  '#8B5CF6', '#7C3AED', '#6D28D9', '#5B21B6', // Фиолетовые
  '#A78BFA', '#8B5CF6', '#7C3AED', '#6D28D9', // Светло-фиолетовые
  '#C084FC', '#A78BFA', '#8B5CF6', '#7C3AED', // Очень светло-фиолетовые
  '#818CF8', '#6366F1', '#4F46E5', '#4338CA', // Индиго
  // Розовые/фуксия оттенки
  '#EC4899', '#DB2777', '#BE185D', '#9F1239', // Розовые (не красные)
  '#F472B6', '#EC4899', '#DB2777', '#BE185D', // Светло-розовые
  '#FB7185', '#F472B6', '#EC4899', '#DB2777', // Очень светло-розовые
  // Оранжевые оттенки (не желтые)
  '#F97316', '#EA580C', '#C2410C', '#9A3412', // Оранжевые
  '#FB923C', '#F97316', '#EA580C', '#C2410C', // Светло-оранжевые
  // Бирюзовые/циановые
  '#14B8A6', '#0D9488', '#0F766E', '#115E59', // Бирюзовые
  '#5EEAD4', '#14B8A6', '#0D9488', '#0F766E', // Светло-бирюзовые
];

// Функция для получения уникального цвета на основе строки (exerciseKey или id)
const getColorFromString = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % exerciseCardColors.length;
  return exerciseCardColors[index];
};

// Кеш градиентов дисциплин для оптимизации
const disciplineGradientsCache = new Map<string, ReturnType<typeof generateDisciplineGradient>>();

// Получение градиента дисциплины с кешированием
const getDisciplineGradientCached = (disciplineId: string, disciplineName: string): ReturnType<typeof generateDisciplineGradient> => {
  const key = `${disciplineId}_${disciplineName}`;
  if (!disciplineGradientsCache.has(key)) {
    const primaryColor = getDisciplineColor(disciplineId, disciplineName);
    disciplineGradientsCache.set(key, generateDisciplineGradient(primaryColor));
  }
  return disciplineGradientsCache.get(key)!;
};

// Мемоизация стилей упражнений с использованием цветов дисциплины
  const exerciseCardStyles = computed(() => {
    // Получаем градиент текущей дисциплины
    const programName = currentProgram.value?.name ?? currentProgram.value?.title ?? '';
    const disciplineGradient = currentProgram.value?.id && programName
      ? getDisciplineGradientCached(currentProgram.value.id, programName)
      : null;
  
  return programExercises.value.map((exercise, index) => {
    let color: string;
    let lightenedBg: string;
    
    if (!exercise) {
      // Запасной цвет на случай отсутствия данных
      color = exerciseCardColors[index % exerciseCardColors.length];
      lightenedBg = lightenColor(color, 0.92);
    } else {
      // Генерируем цвет упражнения на основе дисциплины
      const exerciseKey = exercise.exerciseKey || exercise.id;
      if (disciplineGradient) {
        color = getExerciseColor(exerciseKey, disciplineGradient.primary);
      } else {
        // Fallback на старую систему
        color = getColorFromString(exerciseKey);
      }
      lightenedBg = lightenColor(color, 0.92);
    }
    
    return {
      '--exercise-card-color': color,
      '--exercise-card-bg': lightenedBg,
      '--exercise-card-icon-bg': lightenColor(color, 0.88),
      /* Плавная смена градиентов */
      '--exercise-card-gradient-start': lightenedBg,
      '--exercise-card-gradient-mid': mixColors(lightenedBg, color, 98),
      '--exercise-card-gradient-end': 'var(--color-bg-elevated)',
    };
  });
});

// filteredExercises удален - он просто возвращал catalogItems.value, что избыточно

  const coloredPrograms = computed<DisplayProgram[]>(() =>
    programs.value.map((program) => {
      // Генерируем уникальный цвет и градиент для каждой дисциплины
      const programName = program.name ?? program.title;
      const primaryColor = getDisciplineColor(program.id, programName);
    const gradient = generateDisciplineGradient(primaryColor);
    
    return {
      ...program,
      color: primaryColor,
      gradient, // Сохраняем градиент для использования в программах и упражнениях
    };
  }),
);

const displayPrograms = computed<DisplayProgram[]>(() => coloredPrograms.value);

const clampIndex = (index: number) => {
  const maxIndex = displayPrograms.value.length - 1;
  if (maxIndex < 0) return -1;
  return Math.min(Math.max(index, 0), maxIndex);
};

const setVisibleIndex = (index: number) => {
  if (!displayPrograms.value.length) {
    visibleIndex.value = 0;
    activeProgram.value = '';
    return;
  }
  const nextIndex = clampIndex(index);
  prevVisibleIndex.value = visibleIndex.value;
  visibleIndex.value = nextIndex;
  const program = nextIndex >= 0 ? displayPrograms.value[nextIndex] : null;
  activeProgram.value = program?.id ?? '';
};

const currentProgram = computed<DisplayProgram | null>(() => {
  if (!displayPrograms.value.length) {
    return null;
  }
  const program = displayPrograms.value[visibleIndex.value];
  return program ?? null;
});

// readonly для computed которые не меняются напрямую - оптимизация Vue
const hasPrev = computed(() => displayPrograms.value.length > 0 && visibleIndex.value > 0);
const hasNext = computed(
  () => displayPrograms.value.length > 0 && visibleIndex.value < displayPrograms.value.length - 1,
);

const activeProgramColor = computed(() => currentProgram.value?.color ?? '#10A37F');

const pageStyleVars = computed(() => {
  // Получаем цвет текущей карточки направления
  let baseColor = activeProgramColor.value;
  
  // Если цвет слишком нейтральный, используем значение по умолчанию
  if (!baseColor || baseColor === '#A3A3A3' || 
      baseColor === '#E5E7EB' || baseColor === '#9CA3AF' || baseColor === '#6B7280') {
    baseColor = '#10A37F'; // ChatGPT Green по умолчанию
  }
  
  // Генерируем оттенки для скроллбара на основе цвета карточки направления
  // Делаем более тусклые цвета (больше серого, меньше насыщенности)
  const scrollThumbBase = baseColor;
  const scrollThumbActive = lightenColor(scrollThumbBase, 0.5); // Более яркий при hover
  // Увеличиваем смешение с серым до 75% для более тусклого вида
  const scrollThumbInactive = mixColors(scrollThumbBase, '#E5E7EB', 75); // Более тусклый оттенок
  
  return {
    '--scroll-thumb-color-active': scrollThumbActive,
    '--scroll-thumb-color-base': scrollThumbInactive,
    '--scroll-thumb-color-hover': mixColors(scrollThumbBase, scrollThumbActive, 70),
    '--scroll-track-color': 'transparent',
  };
});

// Комбинированные стили с параллаксом для применения на странице
const pageStyleVarsWithParallax = computed(() => ({
  ...pageStyleVars.value,
  ...parallaxBackground.value,
}));

const getProgramStyles = (program: DisplayProgram | null) => {
  if (!program) {
    return {};
  }

  // Используем theme variables для консистентности с пресетами
  return {
    '--program-border-color': 'var(--color-border)',
    '--program-title-color': 'var(--color-accent)',
    '--program-subtitle-color': 'var(--color-text-secondary)',
    '--program-bg-color': 'var(--color-bg)',
    '--program-bg-soft-color': 'var(--color-bg-secondary)',
    '--program-nav-bg': 'var(--color-bg-elevated)',
    '--program-nav-color': 'var(--color-accent)',
    '--program-gradient-start': 'var(--color-bg)',
    '--program-gradient-mid': 'var(--color-bg-secondary)',
    '--program-gradient-end': 'var(--color-bg-elevated)',
  };
};

const loadCatalog = async () => {
  loading.value = true;
  error.value = null;
  
  // Сбрасываем состояния видимости для последовательного появления
  disciplineVisible.value = false;
  programsVisible.value = false;
  exercisesVisible.value = false;
  
  try {
    // Очищаем кеш программ тренировок при загрузке каталога, чтобы загружать свежие данные
    // Это гарантирует, что старые пустые данные из кеша не будут мешать
    console.log('[ExercisesPage] Clearing training programs cache before loading catalog');
    invalidateProgramContextCaches({ includeGlobal: true });
    
    // Приоритетная быстрая загрузка направлений - они должны появиться первыми
    // Если данные есть в кеше - они вернутся мгновенно через getWithBackgroundRefresh
    const directionsData = await cachedApiClient.getTrainingDisciplines();
    
    // МАППИНГ ДАННЫХ СРАЗУ после получения - это должно быть синхронно
    // Важно: устанавливаем данные ПЕРЕД тем как убрать loading
    programs.value = directionsData.map((d: TrainingDirection) => ({
      id: d.id,
      slug: d.slug,
      title: d.name,
      subtitle: d.description || '',
      locked: !d.isActive,
    }));
    
    // Синхронизация активной программы должна быть синхронной
    syncActiveProgram();
    
    // КРИТИЧНО: устанавливаем visible ПЕРЕД тем как убрать loading
    // Это гарантирует что класс появится сразу при рендеринге
    disciplineVisible.value = true;
    
    // Только после установки всех данных и visible убираем loading
    // Vue обработает изменения синхронно - computed свойства обновятся сразу
    loading.value = false;
    
    // Виброотклик убран - не нужен при появлении элементов
    
    // Предзагружаем программы для первого активного направления после появления направления
    // Упражнения загрузятся автоматически при выборе конкретной программы
    if (displayPrograms.value.length > 0 && visibleIndex.value >= 0) {
      const firstProgram = displayPrograms.value[visibleIndex.value];
      if (firstProgram) {
        setTimeout(async () => {
          await loadTrainingPrograms(firstProgram.id).catch((err) => {
            ErrorHandler.handleWithToast(err, 'ExercisesPage.preloadFirstDiscipline');
          });
        }, 200);
      }
    }
  } catch (err: any) {
    // Виброотклик убран
    error.value = err;
    loading.value = false;
    const appError = ErrorHandler.handle(err, 'loadCatalog');
    ErrorHandler.showToast(appError);
  }
};

const onProgramClick = (program: DisplayProgram | null) => {
  // Виброотклик убран
  
  if (!program) return;
  if (program.locked) {
    // Виброотклик убран
    showToast({
      title: 'Скоро',
      message: 'Дополнительные программы появятся после запуска основного релиза.',
      type: 'info',
    });
    return;
  }
  goToProgram(program.id);
};

const goToProgram = (programId: string) => {
  const nextIndex = displayPrograms.value.findIndex(
    item => item.id === programId,
  );
  if (nextIndex === -1) return;
  setVisibleIndex(nextIndex);
};

// Флаг для предотвращения множественных быстрых кликов
let isTransitioningDisciplines = false;

const selectPrevProgram = () => {
  if (!hasPrev.value || isTransitioningDisciplines) return;
  isTransitioningDisciplines = true;
  // Виброотклик убран
  // Используем requestAnimationFrame для мгновенного обновления
  requestAnimationFrame(() => {
    setVisibleIndex(visibleIndex.value - 1);
  });
  // Разрешаем следующий клик после завершения transition
  setTimeout(() => {
    isTransitioningDisciplines = false;
  }, 120); // Время transition (0.12s)
};

const selectNextProgram = () => {
  if (!hasNext.value || isTransitioningDisciplines) return;
  isTransitioningDisciplines = true;
  // Виброотклик убран
  // Используем batchRAF для батчинга обновления
  batchRAF(() => {
    setVisibleIndex(visibleIndex.value + 1);
  });
  // Разрешаем следующий клик после завершения transition
  setTimeout(() => {
    isTransitioningDisciplines = false;
  }, 120); // Время transition (0.12s)
};

const syncActiveProgram = () => {
  if (!programs.value.length) {
    activeProgram.value = '';
    setVisibleIndex(0);
    return;
  }

  if (!programs.value.find(program => program.id === activeProgram.value && !program.locked)) {
    const firstUnlocked = programs.value.find(program => !program.locked);
    activeProgram.value = firstUnlocked ? firstUnlocked.id : programs.value[0].id;
  }

  const nextIndex = displayPrograms.value.findIndex(
    item => item.id === activeProgram.value,
  );
  setVisibleIndex(nextIndex === -1 ? 0 : nextIndex);
};

// Кеш для программ тренировок, чтобы избежать повторных запросов
let lastDisciplineIdForPrograms: string | null = null;
let lastProgramsPromise: Promise<TrainingProgram[]> | null = null;

const loadTrainingPrograms = async (disciplineId: string | null) => {
  if (!disciplineId) {
    trainingPrograms.value = [];
    trainingProgramsError.value = null;
    visibleTrainingProgramIndex.value = 0;
    lastDisciplineIdForPrograms = null;
    lastProgramsPromise = null;
    return [];
  }

  if (lastDisciplineIdForPrograms === disciplineId && lastProgramsPromise) {
    return lastProgramsPromise;
  }

  trainingProgramsLoading.value = true;
  trainingProgramsError.value = null;
  programsVisible.value = false;
  lastDisciplineIdForPrograms = disciplineId;

  const requestPromise = (async () => {
    try {
      const programsData = await cachedApiClient.getTrainingPrograms(disciplineId);
      const normalizedPrograms = Array.isArray(programsData) ? programsData : [];
      const previousIndex = visibleTrainingProgramIndex.value;
      trainingPrograms.value = normalizedPrograms;

      if (trainingPrograms.value.length === 0) {
        visibleTrainingProgramIndex.value = 0;
        programExercises.value = [];
        exercisesVisible.value = false;
      } else {
        const nextIndex = Math.min(Math.max(previousIndex, 0), trainingPrograms.value.length - 1);
        visibleTrainingProgramIndex.value = nextIndex;
        // Если индекс не изменился (например, 0 -> 0), manually загрузим упражнения,
        // потому что watcher не сработает
        if (nextIndex === previousIndex || previousIndex >= trainingPrograms.value.length) {
          batchRAF(() => {
            programExercisesLoading.value = true;
            exercisesVisible.value = false;
          });
          void loadProgramExercises(trainingPrograms.value[nextIndex]?.id, disciplineId);
        }
      }

      await nextTick();
      trainingProgramsLoading.value = false;
      setTimeout(() => {
        programsVisible.value = true;
      }, 300);
      return trainingPrograms.value;
    } catch (err: any) {
      ErrorHandler.handleWithToast(err, 'ExercisesPage.loadTrainingPrograms');
      trainingProgramsError.value = err instanceof Error ? err.message : 'Не удалось загрузить программы';
      trainingPrograms.value = [];
      visibleTrainingProgramIndex.value = 0;
      throw err;
    } finally {
      if (trainingProgramsLoading.value) {
        batchRAF(() => {
          trainingProgramsLoading.value = false;
        });
      }
      if (lastDisciplineIdForPrograms === disciplineId) {
        lastDisciplineIdForPrograms = null;
        lastProgramsPromise = null;
      }
    }
  })();

  lastProgramsPromise = requestPromise;
  return requestPromise;
};

// readonly для computed которые не меняются напрямую - оптимизация Vue
const hasPrevTrainingProgram = readonly(computed(() => {
  // Есть предыдущая если не первая программа
  return visibleTrainingProgramIndex.value > 0;
}));

const hasNextTrainingProgram = readonly(computed(() => {
  // Есть следующая если не последняя программа (включая переход с заглушки на реальные программы)
  return visibleTrainingProgramIndex.value < trainingPrograms.value.length - 1;
}));

// Флаг для предотвращения множественных быстрых кликов программ
let isTransitioningPrograms = false;

const selectPrevTrainingProgram = () => {
  if (!hasPrevTrainingProgram.value || trainingPrograms.value.length === 0 || isTransitioningPrograms) return;
  
  // Мгновенно обновляем индекс без batchRAF для отзывчивости
  prevTrainingProgramIndex.value = visibleTrainingProgramIndex.value;
  const newIndex = Math.max(0, visibleTrainingProgramIndex.value - 1);
  
  if (newIndex >= 0 && newIndex < trainingPrograms.value.length) {
    isTransitioningPrograms = true;
    visibleTrainingProgramIndex.value = newIndex;
    
    // Разрешаем следующий клик после завершения transition (CSS transition ~300ms)
    setTimeout(() => {
      isTransitioningPrograms = false;
    }, 350); // Немного больше времени transition для надежности
  }
};

const selectNextTrainingProgram = () => {
  if (!hasNextTrainingProgram.value || trainingPrograms.value.length === 0 || isTransitioningPrograms) return;
  
  // Мгновенно обновляем индекс без batchRAF для отзывчивости
  prevTrainingProgramIndex.value = visibleTrainingProgramIndex.value;
  const newIndex = Math.min(trainingPrograms.value.length - 1, visibleTrainingProgramIndex.value + 1);
  
  if (newIndex >= 0 && newIndex < trainingPrograms.value.length) {
    isTransitioningPrograms = true;
    visibleTrainingProgramIndex.value = newIndex;
    
    // Разрешаем следующий клик после завершения transition (CSS transition ~300ms)
    setTimeout(() => {
      isTransitioningPrograms = false;
    }, 350); // Немного больше времени transition для надежности
  }
};

const slideDirection = computed(() => {
  return visibleTrainingProgramIndex.value > prevTrainingProgramIndex.value ? 'next' : 'prev';
});

// ==================== PREFETCH STRATEGY ====================
// Prefetch следующих/предыдущих элементов при hover на стрелки для мгновенного перехода

// Debounce для prefetch чтобы не делать слишком много запросов
let prefetchDisciplineTimeout: ReturnType<typeof setTimeout> | null = null;
let prefetchProgramTimeout: ReturnType<typeof setTimeout> | null = null;

// Prefetch программы следующего направления при hover на стрелку направления
// Prefetch при hover на стрелки направления (временно не используется после flip)
// @ts-expect-error - unused after flip refactor
const prefetchNextDiscipline = () => {
  if (prefetchDisciplineTimeout) {
    clearTimeout(prefetchDisciplineTimeout);
  }
  
  // Небольшая задержка перед prefetch (300ms) чтобы не загружать при случайном hover
  prefetchDisciplineTimeout = setTimeout(async () => {
    if (!hasNext.value || displayPrograms.value.length === 0) return;
    
    const nextIndex = visibleIndex.value + 1;
    if (nextIndex >= 0 && nextIndex < displayPrograms.value.length) {
      const nextProgram = displayPrograms.value[nextIndex];
      if (nextProgram && !nextProgram.locked) {
        try {
          await cachedApiClient.getTrainingPrograms(nextProgram.id);
        } catch (err) {
          console.debug('Prefetch training programs failed:', err);
        }
      }
    }
  }, 300);
};

// Prefetch программы предыдущего направления при hover на стрелку направления
// @ts-expect-error - unused after flip refactor
const prefetchPrevDiscipline = () => {
  if (prefetchDisciplineTimeout) {
    clearTimeout(prefetchDisciplineTimeout);
  }
  
  prefetchDisciplineTimeout = setTimeout(async () => {
    if (!hasPrev.value || displayPrograms.value.length === 0) return;
    
    const prevIndex = visibleIndex.value - 1;
    if (prevIndex >= 0 && prevIndex < displayPrograms.value.length) {
      const prevProgram = displayPrograms.value[prevIndex];
      if (prevProgram && !prevProgram.locked) {
        try {
          await cachedApiClient.getTrainingPrograms(prevProgram.id);
        } catch (err) {
          console.debug('Prefetch training programs failed:', err);
        }
      }
    }
  }, 300);
};

// Prefetch упражнения следующей программы при hover на стрелку программы
// @ts-expect-error - unused after flip refactor  
const prefetchNextProgram = () => {
  if (prefetchProgramTimeout) {
    clearTimeout(prefetchProgramTimeout);
  }
  
  prefetchProgramTimeout = setTimeout(async () => {
    if (!hasNextTrainingProgram.value || trainingPrograms.value.length === 0) return;
    
    const nextIndex = visibleTrainingProgramIndex.value + 1;
    if (nextIndex >= 0 && nextIndex < trainingPrograms.value.length) {
      const nextProgram = trainingPrograms.value[nextIndex];
      if (nextProgram) {
        try {
          await cachedApiClient.getProgramExercises(nextProgram.id, currentProgram.value?.id);
        } catch (err) {
          console.debug('Prefetch program exercises failed:', err);
        }
      }
    }
  }, 300);
};

// Prefetch упражнения предыдущей программы при hover на стрелку программы
// @ts-expect-error - unused after flip refactor
const prefetchPrevProgram = () => {
  if (prefetchProgramTimeout) {
    clearTimeout(prefetchProgramTimeout);
  }
  
  prefetchProgramTimeout = setTimeout(async () => {
    if (!hasPrevTrainingProgram.value || trainingPrograms.value.length === 0) return;
    
    const prevIndex = visibleTrainingProgramIndex.value - 1;
    if (prevIndex >= 0 && prevIndex < trainingPrograms.value.length) {
      const prevProgram = trainingPrograms.value[prevIndex];
      if (prevProgram) {
        try {
          await cachedApiClient.getProgramExercises(prevProgram.id, currentProgram.value?.id);
        } catch (err) {
          console.debug('Prefetch program exercises failed:', err);
        }
      }
    }
  }, 300);
};

// Отмена prefetch при уходе с hover
// @ts-expect-error - unused after flip refactor
const cancelPrefetchDiscipline = () => {
  if (prefetchDisciplineTimeout) {
    clearTimeout(prefetchDisciplineTimeout);
    prefetchDisciplineTimeout = null;
  }
};

// @ts-expect-error - unused after flip refactor
const cancelPrefetchProgram = () => {
  if (prefetchProgramTimeout) {
    clearTimeout(prefetchProgramTimeout);
    prefetchProgramTimeout = null;
  }
};

// Prefetch данных упражнения при hover на карточку упражнения для мгновенного открытия модалки
let prefetchExerciseTimeout: ReturnType<typeof setTimeout> | null = null;

const prefetchExerciseData = (exercise: ProgramExercise) => {
  if (prefetchExerciseTimeout) {
    clearTimeout(prefetchExerciseTimeout);
  }
  
  // Prefetch уровни упражнения при hover (150ms задержка - быстрее чем для программ)
  prefetchExerciseTimeout = setTimeout(async () => {
    if (!exercise || !exercise.exerciseKey) return;
    
    try {
      // Prefetch уровни упражнения для мгновенного открытия модалки
      await cachedApiClient.getExerciseLevels(exercise.exerciseKey);
    } catch (err) {
      console.debug('Prefetch exercise levels failed:', err);
    }
  }, 150); // Быстрее для лучшего UX
};

const cancelPrefetchExercise = () => {
  if (prefetchExerciseTimeout) {
    clearTimeout(prefetchExerciseTimeout);
    prefetchExerciseTimeout = null;
  }
};

const disciplineSlideDirection = computed(() => {
  return visibleIndex.value > prevVisibleIndex.value ? 'next' : 'prev';
});

  const getTrainingProgramStyles = (program: TrainingProgram | null) => {
  if (!program) return {};
  
  // Обычные карточки программ с отличающимся оттенком от направления
  const disciplineColor = currentProgram.value?.color || '#10A37F';
  const programColor = getProgramColor(disciplineColor);
  const programBorderColor = mixColors(programColor, '#0F172A', 45);
  
  return {
    '--training-program-bg': 'var(--color-surface-card, rgba(15,17,23,0.96))',
    '--training-program-border': programBorderColor,
    '--training-program-title-color': 'var(--color-text-primary, #f4f4f5)',
    '--training-program-description-color': 'var(--color-text-secondary, #cbd5f5)',
    '--training-program-nav-color': programBorderColor,
    '--training-program-gradient-start': 'color-mix(in srgb, var(--color-surface-card, rgba(15,17,23,0.96)) 95%, transparent)',
    '--training-program-gradient-mid': 'color-mix(in srgb, var(--color-surface-card, rgba(15,17,23,0.96)) 90%, transparent)',
    '--training-program-gradient-end': 'color-mix(in srgb, var(--color-surface-card, rgba(15,17,23,0.96)) 86%, transparent)',
    '--connection-color': programBorderColor,
  };
};

const currentTrainingProgram = computed(() => {
  return trainingPrograms.value[visibleTrainingProgramIndex.value] || null;
});

// Кеш для последнего запроса, чтобы избежать дублирующих запросов
// Должно быть объявлено ДО функций, которые его используют
let lastRequestKey: string | null = null;
let lastRequestPromise: Promise<ProgramExercise[]> | null = null;

// Вспомогательная функция для очистки состояния программ
const clearTrainingProgramsState = () => {
  trainingPrograms.value = [];
  visibleTrainingProgramIndex.value = 0;
  programExercises.value = [];
  programExercisesLoading.value = false;
  trainingProgramsError.value = null;
  programExercisesError.value = null;
  lastRequestKey = null;
  lastRequestPromise = null;
  
  // Очищаем virtual scrolling и image preloading
  cleanupExercisesVirtualScroll();
  exerciseImagesPreloaded.value.clear();
  exerciseImagesPreloading.value.clear();
  exerciseLevelsCache.value.clear();
};

// Вспомогательная функция для проверки валидности индекса
const isValidIndex = (index: number, arrayLength: number): boolean => {
  return index >= 0 && index < arrayLength;
};

watch(programs, () => {
  syncActiveProgram();
});

// ==================== INTERSECTION OBSERVER для Lazy Loading ====================
// Intersection Observer для lazy loading программ тренировок
const { isIntersecting: isProgramsSectionVisible, reconnect: reconnectProgramsObserver } = useIntersectionObserver(
  trainingProgramsSectionElement,
  {
    rootMargin: '100px', // Начинаем загрузку за 100px до входа в viewport (preload zone)
    threshold: 0.1,
  }
);

// Intersection Observer для lazy loading упражнений
const { isIntersecting: isExercisesSectionVisible, reconnect: reconnectExercisesObserver } = useIntersectionObserver(
  exercisesSectionElement,
  {
    rootMargin: '100px', // Начинаем загрузку за 100px до входа в viewport (preload zone)
    threshold: 0.1,
  }
);

// Флаг для отслеживания первой загрузки программ (чтобы не ждать Intersection Observer)
const shouldLoadProgramsImmediately = ref(true);

watch(visibleIndex, (newIndex, oldIndex) => {
  // Обновляем prevVisibleIndex для корректной анимации (синхронно)
  if (oldIndex !== undefined) {
    prevVisibleIndex.value = oldIndex;
  }
  
  // Сбрасываем состояния видимости при смене направления (синхронно)
  programsVisible.value = false;
  exercisesVisible.value = false;
  
  // Проверяем валидность индекса
  if (!isValidIndex(newIndex, displayPrograms.value.length)) {
    clearTrainingProgramsState();
    return;
  }

  const program = displayPrograms.value[newIndex];
  if (program) {
    // Если это первая загрузка или секция уже видна - загружаем в RAF для неблокирующей загрузки
    // Иначе Intersection Observer загрузит программы когда секция появится в viewport
    if (shouldLoadProgramsImmediately.value || isProgramsSectionVisible.value) {
      // Используем requestAnimationFrame для неблокирующей загрузки
      requestAnimationFrame(async () => {
        await loadTrainingPrograms(program.id);
        if (shouldLoadProgramsImmediately.value) {
          shouldLoadProgramsImmediately.value = false; // После первой загрузки переключаемся на lazy
        }
      });
    }
    // Иначе Intersection Observer загрузит программы автоматически когда секция появится
  } else {
    clearTrainingProgramsState();
  }
}, { immediate: true });

// Флаг для отслеживания первой загрузки упражнений
const shouldLoadExercisesImmediately = ref(true);

watch(visibleTrainingProgramIndex, (newIndex, oldIndex) => {
  // Обновляем prevTrainingProgramIndex для корректной анимации
  if (oldIndex !== undefined) {
    prevTrainingProgramIndex.value = oldIndex;
  }
  
  // Скрываем упражнения при смене программы
  exercisesVisible.value = false;
  
  // Проверяем валидность индекса
  if (!isValidIndex(newIndex, trainingPrograms.value.length)) {
    programExercises.value = [];
    programExercisesLoading.value = false;
    return;
  }
  
  const program = trainingPrograms.value[newIndex];
  if (program) {
    // ВСЕГДА загружаем упражнения при переключении программы (не зависим от Intersection Observer)
    // Загружаем асинхронно в следующем тике для неблокирующей загрузки
    nextTick(async () => {
      // Передаем programId (это ID программы тренировок)
      // disciplineId не нужен для загрузки упражнений по программе
      await loadProgramExercises(program.id, undefined);
      if (shouldLoadExercisesImmediately.value) {
        shouldLoadExercisesImmediately.value = false; // После первой загрузки переключаемся на lazy
      }
    });
  } else {
    programExercises.value = [];
    programExercisesLoading.value = false;
    programExercisesError.value = null;
    lastRequestKey = null;
    lastRequestPromise = null;
  }
});

const loadProgramExercises = async (programId?: string, disciplineId?: string) => {
  // Не загружаем если нет ни programId, ни disciplineId
  if (!programId && !disciplineId) {
    programExercises.value = [];
    programExercisesError.value = null;
    lastRequestKey = null;
    lastRequestPromise = null;
    return;
  }

  // Создаем ключ для кеширования запроса
  const requestKey = `${programId || ''}_${disciplineId || ''}`;
  
  // Если уже идет запрос с теми же параметрами, возвращаем тот же промис
  if (lastRequestKey === requestKey && lastRequestPromise) {
    return lastRequestPromise;
  }

  // Батчим обновление loading через RAF
  batchRAF(() => {
    programExercisesLoading.value = true;
    exercisesVisible.value = false; // Скрываем упражнения при загрузке
  });
  programExercisesError.value = null;
  lastRequestKey = requestKey;
  
  const requestPromise = (async () => {
    try {
      const exercisesData = await cachedApiClient.getProgramExercises(programId, disciplineId);
      // Батчим обновление данных через RAF
      batchRAF(() => {
        programExercises.value = Array.isArray(exercisesData) ? exercisesData : [];
      });
      
      // Виброотклик убран - не нужен при появлении элементов
      
      // Последовательное появление: после загрузки упражнений показываем их с задержкой
      // Батчим обновление через batchNextTick для правильного порядка
      batchNextTick(() => {
        programExercisesLoading.value = false;
      });
      
      // Инициализируем virtual scrolling после загрузки данных через batchRAF
      batchRAF(() => {
        initExercisesVirtualScroll();
      });
      
      setTimeout(() => {
        batchRAF(() => {
          exercisesVisible.value = true;
        });
        
        // Начинаем предзагрузку изображений после появления упражнений
        preloadVisibleExerciseImages(); // Сначала видимые (high priority)
        setTimeout(() => {
          preloadAllExerciseImages(); // Затем все остальные (low priority)
        }, 500); // Небольшая задержка для неблокирующей загрузки
      }, 300); // Небольшая задержка для плавного появления упражнений после программы
      
      return programExercises.value;
  } catch (err: any) {
      // При ошибке просто показываем пустой список, не показываем тост
      // (возможно, упражнений просто нет в базе)
      ErrorHandler.handleWithToast(err, 'ExercisesPage.loadProgramExercises');
      // Виброотклик убран
      // Батчим обновление через RAF
      batchRAF(() => {
        programExercises.value = [];
        programExercisesLoading.value = false;
        exercisesVisible.value = false;
      });
      programExercisesError.value =
        err instanceof Error ? err.message : 'Не удалось загрузить упражнения';
      return [];
  } finally {
      if (programExercisesLoading.value) {
        programExercisesLoading.value = false;
      }
      // Очищаем кеш после завершения запроса
      if (lastRequestKey === requestKey) {
        lastRequestKey = null;
        lastRequestPromise = null;
  }
    }
  })();

  lastRequestPromise = requestPromise;
  return requestPromise;
};

const retryLoadTrainingPrograms = () => {
  const program = currentProgram.value;
  if (!program) {
    return Promise.resolve([]);
  }
  return loadTrainingPrograms(program.id);
};

const retryLoadProgramExercises = () => {
  const trainingProgram = currentTrainingProgram.value;
  if (!trainingProgram) {
    return Promise.resolve([]);
  }
  return loadProgramExercises(trainingProgram.id);
};

// Мемоизированный цвет для модалки упражнения на основе дисциплины
const exerciseModalColor = computed(() => {
  if (!selectedExercise.value) return '#3B82F6';
  
  const exerciseKey = selectedExercise.value.exerciseKey || selectedExercise.value.id;
  
  // Получаем градиент текущей дисциплины
  const disciplineGradient = currentProgram.value?.gradient || 
    (currentProgram.value?.id && currentProgram.value?.name
      ? getDisciplineGradientCached(currentProgram.value.id, currentProgram.value.name)
      : null);
  
  // Генерируем цвет упражнения на основе дисциплины
  if (disciplineGradient) {
    return getExerciseColor(exerciseKey, disciplineGradient.primary);
  }
  
  // Fallback на старую систему
  return getColorFromString(exerciseKey);
});

const openExerciseModal = (exercise: ProgramExercise) => {
  hapticMedium(); // Haptic feedback при открытии модального окна упражнения
  selectedExercise.value = exercise;
  isExerciseModalOpen.value = true;
};

const closeExerciseModal = () => {
  hapticLight(); // Haptic feedback при закрытии модального окна
  isExerciseModalOpen.value = false;
  // Не очищаем selectedExercise сразу, чтобы анимация закрытия работала плавно
  setTimeout(() => {
    selectedExercise.value = null;
  }, 300);
};

// Icon click handler - показывает hover-изображение на 2 секунды
const handleIconClick = (exercise: ProgramExercise) => {
  if (!exercise.iconUrlHover) return;
  
  hapticLight(); // Тактильный отклик
  
  // Очищаем предыдущий таймер если есть
  if (expandedIconTimeout) {
    clearTimeout(expandedIconTimeout);
  }
  
  // Показываем hover-изображение
  expandedIconId.value = exercise.id;
  
  // Скрываем через 2 секунды
  expandedIconTimeout = setTimeout(() => {
    expandedIconId.value = null;
  }, 2000);
};

// Card click handler - открывает модал если клик не по иконке
const handleExerciseCardClick = (_event: MouseEvent, exercise: ProgramExercise) => {
  // Если клик был на иконке, не открываем модал (иконка имеет @click.stop)
  // Этот хендлер вызывается только для кликов по остальной части карточки
  openExerciseModal(exercise);
};

// ==================== ПАРАЛЛАКС-ЭФФЕКТ ====================
// Refs для элементов с параллаксом
const pageTitleRef = ref<HTMLElement | null>(null);
const pageContentRef = ref<HTMLElement | null>(null);
const programsSectionRef = ref<HTMLElement | null>(null);
const exercisesPageRef = ref<HTMLElement | null>(null);

// Refs для параллакса (используем те же refs что и для Intersection Observer где возможно)
const trainingProgramsSectionRef = computed(() => trainingProgramsSectionElement.value);
const exercisesSectionRef = computed(() => exercisesSectionElement.value);

// Параллакс коэффициенты для разных элементов (0 = нет движения, 1 = полное движение)
const parallaxConfig = {
  pageTitle: 0.25,      // Легкий параллакс для заголовка
  programsSection: 0.4, // Средний для секции направлений
  trainingPrograms: 0.35, // Средний-легкий для программ
  exercises: 0.3,       // Легкий для упражнений
  background: 0.6,      // Сильный для фоновых элементов
};

// Позиция скролла
const scrollY = ref(0);
const windowHeight = ref(0);
const isReducedMotion = ref(false);

// Проверка prefers-reduced-motion
const checkReducedMotion = () => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    isReducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
};

// Функция для расчета параллакс-трансформации элемента (улучшенный алгоритм)
const getParallaxTransform = (element: HTMLElement | null, coefficient: number): string => {
  if (!element || isReducedMotion.value) return 'translateY(0)';
  
  const rect = element.getBoundingClientRect();
  const elementTop = rect.top + scrollY.value;
  const elementCenter = elementTop + rect.height / 2;
  const viewportCenter = scrollY.value + windowHeight.value / 2;
  
  // Расстояние от центра элемента до центра viewport
  const distance = viewportCenter - elementCenter;
  
  // Нормализация расстояния (от -1 до 1)
  const normalizedDistance = distance / windowHeight.value;
  
  // Параллакс-смещение с плавной кривой (ease-out эффект)
  // Используем квадратичную функцию для более плавного эффекта
  const parallaxOffset = normalizedDistance * coefficient * windowHeight.value * 0.15;
  
  // Ограничиваем максимальное смещение для производительности
  const maxOffset = windowHeight.value * 0.2;
  const clampedOffset = Math.max(-maxOffset, Math.min(maxOffset, parallaxOffset));
  
  return `translate3d(0, ${clampedOffset}px, 0)`;
};

// Computed свойства для параллакс-стилей (с оптимизацией)
const parallaxPageTitle = computed(() => {
  if (isReducedMotion.value) return {};
  return {
    transform: getParallaxTransform(pageTitleRef.value, parallaxConfig.pageTitle),
    transition: 'none',
    willChange: 'transform',
  };
});

const parallaxProgramsSection = computed(() => {
  if (isReducedMotion.value) return {};
  return {
    transform: getParallaxTransform(programsSectionRef.value, parallaxConfig.programsSection),
    transition: 'none',
    willChange: 'transform',
  };
});

const parallaxTrainingPrograms = computed(() => {
  if (isReducedMotion.value) return {};
  return {
    transform: getParallaxTransform(trainingProgramsSectionRef.value, parallaxConfig.trainingPrograms),
    transition: 'none',
    willChange: 'transform',
  };
});

const parallaxExercises = computed(() => {
  if (isReducedMotion.value) return {};
  return {
    transform: getParallaxTransform(exercisesSectionRef.value, parallaxConfig.exercises),
    transition: 'none',
    willChange: 'transform',
  };
});

// Параллакс для фонового градиента (улучшенный)
const parallaxBackground = computed(() => {
  if (isReducedMotion.value || !exercisesPageRef.value) return {};
  
  // Плавное изменение позиции фона в зависимости от скролла
  const parallaxOffset = (scrollY.value / windowHeight.value) * parallaxConfig.background * 30;
  const clampedOffset = Math.max(-30, Math.min(30, parallaxOffset));
  
  return {
    backgroundPosition: `center ${50 + clampedOffset}%`,
    transition: isReducedMotion.value ? 'background-position 0.3s ease' : 'none',
    willChange: isReducedMotion.value ? 'auto' : 'background-position',
  };
});

  // Обработчик скролла с оптимизацией (throttle через RAF + performance throttling)
  let rafId: number | null = null;
  let lastScrollTime = 0;

const handleScroll = () => {
  const now = performance.now();
  
    // Увеличен throttle до 32ms для лучшей производительности при скролле
    if (now - lastScrollTime < 32) {
      return;
    }
  
  // Если уже запланирован RAF - не создаем новый (оптимизация)
  if (rafId !== null) return;
  
  rafId = requestAnimationFrame(() => {
    // Обновляем значения синхронно для минимальной задержки
    scrollY.value = window.scrollY || window.pageYOffset || 0;
    windowHeight.value = window.innerHeight;
    lastScrollTime = performance.now();
    rafId = null;
  });
};

// Обработчик изменения размера окна (debounced)
let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
const handleResize = () => {
  if (resizeTimeout) clearTimeout(resizeTimeout);
  
  resizeTimeout = setTimeout(() => {
    windowHeight.value = window.innerHeight;
    scrollY.value = window.scrollY || window.pageYOffset || 0;
    resizeTimeout = null;
  }, 150);
};

// Проверка производительности устройства (для отключения параллакса на слабых устройствах)
const isLowEndDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  
  // Проверяем количество ядер процессора (приблизительно)
  const hardwareConcurrency = navigator.hardwareConcurrency || 2;
  
  // Проверяем память (если доступно)
  // @ts-ignore - deviceMemory может быть доступен в некоторых браузерах
  const deviceMemory = navigator.deviceMemory || 4;
  
  // Отключаем параллакс на слабых устройствах для производительности
  return hardwareConcurrency <= 2 || deviceMemory <= 2;
};

// Инициализация параллакса
const initParallax = () => {
  if (typeof window === 'undefined') return;
  
  checkReducedMotion();
  
  // Отключаем параллакс на слабых устройствах или при reduced motion
  if (isReducedMotion.value || isLowEndDevice()) {
    isReducedMotion.value = true;
    return;
  }
  
  scrollY.value = window.scrollY || window.pageYOffset || 0;
  windowHeight.value = window.innerHeight;
  
  // Добавляем обработчики с passive: true для оптимизации производительности
  window.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('resize', handleResize, { passive: true });
  
  // Также слушаем изменения prefers-reduced-motion в реальном времени
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleMotionChange = (_event: MediaQueryListEvent | MediaQueryList) => {
      checkReducedMotion();
      if (isReducedMotion.value) {
        cleanupParallax();
      } else if (!isLowEndDevice()) {
        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('resize', handleResize, { passive: true });
      }
    };
    
    // Современный способ (addEventListener)
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMotionChange);
    } else {
      // Fallback для старых браузеров
      // @ts-ignore
      mediaQuery.addListener(handleMotionChange);
    }
  }
};

// Очистка параллакса
const cleanupParallax = () => {
  if (typeof window === 'undefined') return;
  
  window.removeEventListener('scroll', handleScroll);
  window.removeEventListener('resize', handleResize);
  
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  
  if (resizeTimeout) {
    clearTimeout(resizeTimeout);
    resizeTimeout = null;
  }
  
  // Очищаем 3D RAF если он активен
  if (raf3DId !== null) {
    cancelAnimationFrame(raf3DId);
    raf3DId = null;
  }
  pending3DUpdates.clear();
};

// ID для динамического style элемента скроллбара
const SCROLLBAR_STYLE_ID = 'exercises-page-scrollbar-styles';

// MutationObserver для отслеживания изменений в DOM (Telegram WebApp может менять стили)
let scrollbarObserver: MutationObserver | null = null;

// Применяем стили скроллбара напрямую через динамический style элемент в head и inline стили
const applyScrollbarStyles = () => {
  if (typeof document === 'undefined') return;
  
  const appMain = document.querySelector('.app-main') as HTMLElement;
  if (!appMain) {
    // Если .app-main еще не существует, пробуем снова через небольшую задержку
    setTimeout(() => applyScrollbarStyles(), 100);
    return;
  }
  
  const styles = pageStyleVars.value;
  
  // Удаляем старый style элемент если существует
  let styleEl = document.getElementById(SCROLLBAR_STYLE_ID);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = SCROLLBAR_STYLE_ID;
    // Добавляем в конец head для максимального приоритета
    document.head.appendChild(styleEl);
  }
  
  // Делаем цвета тусклее (уменьшаем opacity и добавляем больше серого)
  // Используем rgba для контроля opacity напрямую
  const baseColor = styles['--scroll-thumb-color-base'];
  const hoverColor = styles['--scroll-thumb-color-hover'];
  const activeColor = styles['--scroll-thumb-color-active'];
  
  // Конвертируем hex в rgba с уменьшенной opacity
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
  
  // Делаем цвета намного тусклее (уменьшаем opacity)
  const baseRgba = hexToRgba(baseColor, 0.25); // Очень тусклый базовый цвет
  const hoverRgba = hexToRgba(hoverColor, 0.35); // Чуть ярче при hover
  const activeRgba = hexToRgba(activeColor, 0.45); // Еще ярче при active
  
  // Применяем inline стили напрямую к элементу для максимального приоритета в Telegram WebApp
  // Используем несколько способов для гарантии применения
  try {
    appMain.style.setProperty('scrollbar-width', 'thin', 'important');
    appMain.style.setProperty('scrollbar-color', `${baseRgba} transparent`, 'important');
    
    // Также пробуем через setAttribute для Telegram WebApp
    const currentStyle = appMain.getAttribute('style') || '';
    if (!currentStyle.includes('scrollbar-width')) {
      appMain.setAttribute('style', `${currentStyle}; scrollbar-width: thin !important; scrollbar-color: ${baseRgba} transparent !important;`.replace(/^;\s*/, ''));
    }
    
    // Применяем через CSS переменные
    appMain.style.setProperty('--scrollbar-thumb-color', baseRgba);
    appMain.style.setProperty('--scrollbar-thumb-hover', hoverRgba);
    appMain.style.setProperty('--scrollbar-thumb-active', activeRgba);
  } catch (e) {
    console.warn('Failed to apply scrollbar styles:', e);
  }
  
  // Генерируем CSS правила напрямую с !important для обхода глобальных стилей
  // Используем максимально специфичные селекторы для Telegram WebApp
  // Добавляем все возможные комбинации селекторов для максимальной специфичности
  const css = `
    html body #app .app-main,
    body #app .app-main,
    #app .app-main,
    html .app-main,
    body .app-main,
    .app-main {
      scrollbar-width: thin !important;
      scrollbar-color: ${baseRgba} ${styles['--scroll-track-color']} !important;
    }
    
    html body #app .app-main::-webkit-scrollbar,
    body #app .app-main::-webkit-scrollbar,
    #app .app-main::-webkit-scrollbar,
    html .app-main::-webkit-scrollbar,
    body .app-main::-webkit-scrollbar,
    .app-main::-webkit-scrollbar {
      width: 8px !important;
      height: 8px !important;
      opacity: 1 !important;
      background: transparent !important;
      display: block !important;
    }
    
    html body #app .app-main::-webkit-scrollbar-track,
    body #app .app-main::-webkit-scrollbar-track,
    #app .app-main::-webkit-scrollbar-track,
    html .app-main::-webkit-scrollbar-track,
    body .app-main::-webkit-scrollbar-track,
    .app-main::-webkit-scrollbar-track {
      background: ${styles['--scroll-track-color']} !important;
      border-radius: 4px !important;
      margin: 4px 0 !important;
      display: block !important;
    }
    
    html body #app .app-main::-webkit-scrollbar-thumb,
    body #app .app-main::-webkit-scrollbar-thumb,
    #app .app-main::-webkit-scrollbar-thumb,
    html .app-main::-webkit-scrollbar-thumb,
    body .app-main::-webkit-scrollbar-thumb,
    .app-main::-webkit-scrollbar-thumb {
      background-color: ${baseRgba} !important;
      border-radius: 4px !important;
      border: 1px solid transparent !important;
      background-clip: padding-box !important;
      transition: background-color 0.6s cubic-bezier(0.4, 0, 0.2, 1) !important;
      min-height: 40px !important;
      opacity: 1 !important;
      display: block !important;
    }
    
    html body #app .app-main::-webkit-scrollbar-thumb:hover,
    body #app .app-main::-webkit-scrollbar-thumb:hover,
    #app .app-main::-webkit-scrollbar-thumb:hover,
    html .app-main::-webkit-scrollbar-thumb:hover,
    body .app-main::-webkit-scrollbar-thumb:hover,
    .app-main::-webkit-scrollbar-thumb:hover {
      background-color: ${hoverRgba} !important;
      width: 10px !important;
      border-color: rgba(255, 255, 255, 0.2) !important;
    }
    
    html body #app .app-main::-webkit-scrollbar-thumb:active,
    body #app .app-main::-webkit-scrollbar-thumb:active,
    #app .app-main::-webkit-scrollbar-thumb:active,
    html .app-main::-webkit-scrollbar-thumb:active,
    body .app-main::-webkit-scrollbar-thumb:active,
    .app-main::-webkit-scrollbar-thumb:active {
      background-color: ${activeRgba} !important;
      width: 12px !important;
    }
    
    @media (hover: hover) {
      html body #app .app-main::-webkit-scrollbar-thumb,
      body #app .app-main::-webkit-scrollbar-thumb,
      #app .app-main::-webkit-scrollbar-thumb,
      html .app-main::-webkit-scrollbar-thumb,
      body .app-main::-webkit-scrollbar-thumb,
      .app-main::-webkit-scrollbar-thumb {
        opacity: 0.6 !important;
      }
      
      html body #app .app-main:hover::-webkit-scrollbar-thumb,
      html body #app .app-main:focus-within::-webkit-scrollbar-thumb,
      body #app .app-main:hover::-webkit-scrollbar-thumb,
      body #app .app-main:focus-within::-webkit-scrollbar-thumb,
      #app .app-main:hover::-webkit-scrollbar-thumb,
      #app .app-main:focus-within::-webkit-scrollbar-thumb,
      html .app-main:hover::-webkit-scrollbar-thumb,
      html .app-main:focus-within::-webkit-scrollbar-thumb,
      body .app-main:hover::-webkit-scrollbar-thumb,
      body .app-main:focus-within::-webkit-scrollbar-thumb,
      .app-main:hover::-webkit-scrollbar-thumb,
      .app-main:focus-within::-webkit-scrollbar-thumb {
        opacity: 0.9 !important;
      }
    }
    
    @media (hover: none) {
      html body #app .app-main::-webkit-scrollbar-thumb,
      body #app .app-main::-webkit-scrollbar-thumb,
      #app .app-main::-webkit-scrollbar-thumb,
      html .app-main::-webkit-scrollbar-thumb,
      body .app-main::-webkit-scrollbar-thumb,
      .app-main::-webkit-scrollbar-thumb {
        opacity: 0.7 !important;
      }
    }
  `;
  
  styleEl.textContent = css;
  
  // Для Telegram WebApp применяем стили напрямую через setAttribute для максимального приоритета
  // Создаем отдельный style элемент для инлайн стилей скроллбара
  const inlineStyleId = `${SCROLLBAR_STYLE_ID}-inline`;
  let inlineStyleEl = document.getElementById(inlineStyleId);
  if (!inlineStyleEl) {
    inlineStyleEl = document.createElement('style');
    inlineStyleEl.id = inlineStyleId;
    document.head.appendChild(inlineStyleEl);
  }
  
  // Применяем стили через data-атрибуты для Telegram WebApp
  appMain.setAttribute('data-scrollbar-color', baseRgba);
  appMain.setAttribute('data-scrollbar-hover', hoverRgba);
  appMain.setAttribute('data-scrollbar-active', activeRgba);
  
  // Дополнительный style блок с максимальной специфичностью для Telegram WebApp
  // Добавляем CSS переменные для использования в стилях
  inlineStyleEl.textContent = `
    [data-scrollbar-color] {
      scrollbar-width: thin !important;
      scrollbar-color: ${baseRgba} transparent !important;
      --scrollbar-thumb-color: ${baseRgba} !important;
      --scrollbar-thumb-hover: ${hoverRgba} !important;
      --scrollbar-thumb-active: ${activeRgba} !important;
    }
    
    html body #app .app-main,
    body #app .app-main,
    #app .app-main,
    html .app-main,
    body .app-main,
    .app-main {
      --scrollbar-thumb-color: ${baseRgba} !important;
      --scrollbar-thumb-hover: ${hoverRgba} !important;
      --scrollbar-thumb-active: ${activeRgba} !important;
    }
  `;
  
  // Настраиваем MutationObserver для отслеживания изменений в Telegram WebApp (только один раз)
  if (!scrollbarObserver && appMain) {
    scrollbarObserver = new MutationObserver((mutations) => {
      // При любых изменениях в DOM или атрибутах применяем стили снова
      let shouldReapply = false;
      
      mutations.forEach(mutation => {
        // Если Telegram WebApp изменил style атрибут, переприменяем стили
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          shouldReapply = true;
        }
        // Если добавили новый style элемент в head, переприменяем
        if (mutation.type === 'childList' && mutation.target === document.head) {
          shouldReapply = true;
        }
      });
      
      if (shouldReapply) {
        // Используем requestAnimationFrame для плавного переприменения
        requestAnimationFrame(() => {
          applyScrollbarStyles();
        });
      }
    });
    
    scrollbarObserver.observe(appMain, {
      attributes: true,
      attributeFilter: ['style', 'class'],
      childList: false,
      subtree: false,
    });
    
    // Также отслеживаем изменения в head (Telegram WebApp может добавлять свои стили)
    scrollbarObserver.observe(document.head, {
      childList: true,
      subtree: false,
    });
  }
  
  // Для Telegram WebApp применяем стили через requestAnimationFrame для максимального приоритета
  requestAnimationFrame(() => {
    try {
      appMain.style.setProperty('scrollbar-width', 'thin', 'important');
      appMain.style.setProperty('scrollbar-color', `${baseRgba} transparent`, 'important');
    } catch (e) {
      console.warn('Failed to apply scrollbar styles in RAF:', e);
    }
  });
};

// Watch для lazy loading программ при входе секции в viewport (неблокирующий)
watch(isProgramsSectionVisible, (isVisible) => {
  if (isVisible && !shouldLoadProgramsImmediately.value) {
    const program = displayPrograms.value[visibleIndex.value];
    if (program && !trainingProgramsLoading.value && trainingPrograms.value.length === 0) {
      // Секция появилась в viewport - загружаем программы в RAF для неблокирующей загрузки
      requestAnimationFrame(async () => {
        await loadTrainingPrograms(program.id);
      });
    }
  }
});

// Watch для lazy loading упражнений при входе секции в viewport (неблокирующий)
watch(isExercisesSectionVisible, (isVisible) => {
  if (isVisible && !shouldLoadExercisesImmediately.value) {
    const program = trainingPrograms.value[visibleTrainingProgramIndex.value];
    if (program && !programExercisesLoading.value && programExercises.value.length === 0) {
      // Секция появилась в viewport - загружаем упражнения в RAF для неблокирующей загрузки
      requestAnimationFrame(async () => {
        await loadProgramExercises(program.id);
      });
    }
  }
});

// Watch для обновления virtual scrolling и image preloading при изменении видимых элементов
watch([exercisesScrollTop, exercisesViewportHeight, () => programExercises.value.length], () => {
  // Обновляем предзагрузку изображений при изменении видимых элементов
  if (programExercises.value.length > 0) {
    requestAnimationFrame(() => {
      preloadVisibleExerciseImages();
    });
  }
}, { deep: false });

onMounted(() => {
  loadCatalog();
  
  nextTick(() => {
    initParallax();
    // Применяем стили скроллбара с множественными попытками для гарантии применения в Telegram WebApp
    const applyWithRetries = () => {
      applyScrollbarStyles();
      // Повторные попытки для Telegram WebApp (может загружать стили с задержкой)
      setTimeout(() => applyScrollbarStyles(), 100);
      setTimeout(() => applyScrollbarStyles(), 300);
      setTimeout(() => applyScrollbarStyles(), 500);
      setTimeout(() => applyScrollbarStyles(), 1000);
      setTimeout(() => applyScrollbarStyles(), 2000);
      setTimeout(() => applyScrollbarStyles(), 3000);
    };
    
    // Применяем сразу и через задержки
    applyWithRetries();
    
    // Дополнительные попытки после различных событий
    window.addEventListener('load', () => {
      setTimeout(() => applyScrollbarStyles(), 500);
    });
    
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      
      // Применяем стили после готовности Telegram WebApp
      setTimeout(() => {
        applyWithRetries();
        
        // Периодически переприменяем стили для Telegram WebApp (на 60 секунд)
        const intervalId = setInterval(() => {
          applyScrollbarStyles();
        }, 1000);
        
        // Останавливаем через 60 секунд
        setTimeout(() => clearInterval(intervalId), 60000);
      }, 500);
    }
    
    // Инициализация swipe жестов для карточек направлений
    watch(
      () => disciplineCardRef.value,
      (element) => {
        if (disciplineSwipe) {
          disciplineSwipe.destroy();
          disciplineSwipe = null;
        }
        
        if (element && currentProgram.value && !currentProgram.value.locked) {
          disciplineSwipe = new SwipeGesture(element, {
            threshold: 50,
            velocityThreshold: 0.3,
            direction: 'horizontal',
            preventDefault: true,
            onSwipe: (direction: SwipeDirection) => {
              if (direction === 'left' && hasNext.value) {
                hapticSelection();
                selectNextProgram();
              } else if (direction === 'right' && hasPrev.value) {
                hapticSelection();
                selectPrevProgram();
              }
            },
          });
        }
      },
      { immediate: true }
    );
    
    // Инициализация swipe жестов для карточек программ тренировок
    watch(
      () => trainingProgramCardRef.value,
      (element) => {
        if (trainingProgramSwipe) {
          trainingProgramSwipe.destroy();
          trainingProgramSwipe = null;
        }
        
        if (element && currentTrainingProgram.value) {
          trainingProgramSwipe = new SwipeGesture(element, {
            threshold: 50,
            velocityThreshold: 0.3,
            direction: 'horizontal',
            preventDefault: true,
            onSwipe: (direction: SwipeDirection) => {
              if (direction === 'left' && hasNextTrainingProgram.value) {
                // Виброотклик убран
                selectNextTrainingProgram();
              } else if (direction === 'right' && hasPrevTrainingProgram.value) {
                // Виброотклик убран
                selectPrevTrainingProgram();
              }
            },
          });
        }
      },
      { immediate: true }
    );
    
    // Инициализация swipe жестов для списка упражнений (вертикальный свайп для прокрутки - опционально)
      watch(
        () => exercisesListRef.value,
        (_element) => {
          if (exercisesSwipe) {
            exercisesSwipe.destroy();
            exercisesSwipe = null;
          }

          // Для списка упражнений swipe не нужен - используется стандартная прокрутка
          // Оставляем пустым для будущих улучшений
        },
        { immediate: true }
      );

    // Переподключаем Intersection Observer при изменении элементов
    watch(trainingProgramsSectionElement, () => {
      reconnectProgramsObserver();
    });
    
    watch(exercisesSectionElement, () => {
      reconnectExercisesObserver();
    });
  });
});

// Обновляем стили скроллбара при изменении цвета карточки направления
watch(() => activeProgramColor.value, () => {
  nextTick(() => {
    applyScrollbarStyles();
    // Повторные попытки для Telegram WebApp
    setTimeout(() => applyScrollbarStyles(), 200);
    setTimeout(() => applyScrollbarStyles(), 500);
    setTimeout(() => applyScrollbarStyles(), 1000);
  });
}, { immediate: false });

onUnmounted(() => {
  cleanupParallax();
  
  // Очищаем virtual scrolling
  cleanupExercisesVirtualScroll();
  
  // Очищаем image preloading кеши
  exerciseImagesPreloaded.value.clear();
  exerciseImagesPreloading.value.clear();
  exerciseLevelsCache.value.clear();
  
  // Останавливаем MutationObserver
  if (scrollbarObserver) {
    scrollbarObserver.disconnect();
    scrollbarObserver = null;
  }
  
  // Удаляем динамические style элементы скроллбара
  if (typeof document !== 'undefined') {
    const styleEl = document.getElementById(SCROLLBAR_STYLE_ID);
    if (styleEl) {
      styleEl.remove();
    }
    
    const inlineStyleEl = document.getElementById(`${SCROLLBAR_STYLE_ID}-inline`);
    if (inlineStyleEl) {
      inlineStyleEl.remove();
    }
  }
});
</script>

<style scoped>
/* Стили скроллбара применяются через динамический <style> элемент в head */
/* для обхода глобальных и браузерных стилей */

.exercises-page {
  min-height: 100vh;
  background: 
    radial-gradient(circle at 20% 30%, color-mix(in srgb, var(--color-accent, #10A37F) 6%, transparent) 0%, transparent 55%),
    radial-gradient(circle at 80% 70%, color-mix(in srgb, var(--color-accent, #10A37F) 4%, transparent) 0%, transparent 55%),
    radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--color-surface, #0f1117) 30%, transparent) 0%, transparent 60%),
    linear-gradient(180deg, color-mix(in srgb, var(--color-bg, #050505) 92%, transparent) 0%, var(--color-bg, #050505) 100%);
  background-size: 100% 100%, 100% 100%, 100% 100%, 100% 100%;
  padding: 0 var(--space-md, 1rem);
  padding-top: 4rem;
  padding-bottom: calc(4rem + 80px);
  position: relative;
  /* Скролл происходит на .app-main, не на .exercises-page */
  overflow: visible;
  /* Оптимизация скролла */
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
  /* GPU acceleration для плавного скролла */
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
  /* Оптимизация рендеринга при скролле */
  contain: layout style paint;
  /* Предотвращение layout shift при скролле */
  will-change: scroll-position;
  /* Скроллбар на .app-main, стили применены выше через :deep() */
}

.exercises-page::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 200px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--color-bg, #050505) 70%, transparent) 0%,
    transparent 100%
  );
  pointer-events: none;
  z-index: 1;
}

/* Particle effects - subtle частицы на фоне */
.exercises-page::after {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: 
    radial-gradient(2px 2px at 25% 35%, color-mix(in srgb, var(--color-accent, #10A37F) 18%, transparent), transparent),
    radial-gradient(2px 2px at 75% 65%, color-mix(in srgb, var(--color-accent, #10A37F) 12%, transparent), transparent),
    radial-gradient(1px 1px at 50% 50%, color-mix(in srgb, var(--color-text-secondary, #94a3b8) 14%, transparent), transparent),
    radial-gradient(1px 1px at 30% 70%, color-mix(in srgb, var(--color-accent, #10A37F) 8%, transparent), transparent),
    radial-gradient(1px 1px at 70% 30%, color-mix(in srgb, var(--color-accent, #10A37F) 8%, transparent), transparent);
  background-size: 200% 200%, 200% 200%, 150% 150%, 180% 180%, 180% 180%;
  background-position: 0% 0%, 100% 100%, 50% 50%, 25% 75%, 75% 25%;
  pointer-events: none;
  z-index: 0;
  opacity: 0.6;
  animation: particleFloat 20s ease-in-out infinite;
  will-change: background-position;
  backface-visibility: hidden;
}

@keyframes particleFloat {
  0%, 100% {
    background-position: 0% 0%, 100% 100%, 50% 50%, 25% 75%, 75% 25%;
  }
  25% {
    background-position: 10% 5%, 90% 95%, 55% 45%, 30% 70%, 70% 30%;
  }
  50% {
    background-position: 5% 10%, 95% 90%, 45% 55%, 20% 80%, 80% 20%;
  }
  75% {
    background-position: 15% 8%, 85% 92%, 52% 48%, 28% 72%, 72% 28%;
  }
}

/* Page Title - Стандартизированный */
.page-title {
  text-align: center;
  font-family: var(--font-family-base, 'Inter', 'Roboto Flex', 'Google Sans', sans-serif);
  font-size: clamp(2rem, 5vw, 2.75rem); /* Уменьшено */
  font-weight: 700;
  color: var(--color-text-primary, #1A1A1A);
  margin: 0 0 var(--space-lg) 0; /* Отступ до toggle */
  padding: 0;
  letter-spacing: -0.03em;
  line-height: 1.1;
  position: relative;
  z-index: 2;
  background: linear-gradient(135deg, var(--color-text-primary, #f4f4f5) 0%, color-mix(in srgb, var(--color-text-primary, #f4f4f5) 60%, #7dd3fc) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  will-change: transform;
  backface-visibility: hidden;
  transform-style: preserve-3d;
}

/* Page Loading - удалено, используется скелетон */

/* Error State */
.page-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
  padding: var(--space-xl, 2rem);
}

/* Page Content - минимальный spacing */
.page-content {
  width: 100%;
  max-width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 0.375rem; /* /2 от предыдущего (0.75rem) */
  margin-top: 0;
  position: relative;
  z-index: 2;
  overflow: visible;
}

/* Programs Section - минимальный spacing */
.programs-section {
  width: 100%;
  margin-top: 0.25rem; /* /2 от предыдущего (0.5rem) */
  display: flex;
  justify-content: center;
  position: relative;
  will-change: transform;
  backface-visibility: hidden;
  transform-style: preserve-3d;
}

.program-card-wrapper {
  position: relative;
  display: flex;
  justify-content: center;
  width: 100%;
  max-width: 100%;
  overflow: visible;
  isolation: isolate;
  /* Плавная смена градиентов при смене карточек */
  transition: 
    background 0.6s cubic-bezier(0.4, 0, 0.2, 1),
    background-position 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: background, background-position;
  backface-visibility: hidden;
}

.programs-container {
  position: relative;
  width: 100%;
  min-height: 240px;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: visible;
  padding: 0;
  isolation: isolate;
  /* 3D Perspective для карточек направлений */
  perspective: 1000px;
  transform-style: preserve-3d;
}

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

/* Контейнер для карточки направления с навигационными стрелками */
.program-card-wrapper-inner {
  position: relative;
  width: 100%;
  height: 100%;
  isolation: isolate;
  overflow: visible;
}

/* Навигационные стрелки - тонкая микро-интерактивность */
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
  /* Улучшенная поддержка touch событий для телефонов */
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

/* Микро-анимации текста - fade-in со stagger эффектом */
.text-fade-in {
  animation: textFadeInStagger 0.6s cubic-bezier(0.4, 0, 0.2, 1) both;
  animation-delay: var(--delay, 0ms);
  opacity: 0;
}

@keyframes textFadeInStagger {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Типографика - профессиональная иерархия с плавной сменой градиентов */
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

/* Wrapper for training programs and exercises sections */
.training-programs-wrapper-content {
  width: 100%;
  position: relative;
  overflow: visible;
  isolation: isolate;
  /* Плавная смена градиентов при смене программ */
  transition: 
    background 0.6s cubic-bezier(0.4, 0, 0.2, 1),
    background-position 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: background, background-position;
  backface-visibility: hidden;
}

/* Training Programs Section - с параллаксом и эффектом перехода от направления */
.training-programs-section {
  width: 100%;
  margin-top: var(--space-lg);
  padding: 0 var(--space-md);
  position: relative;
  overflow: visible;
  will-change: transform;
  backface-visibility: hidden;
  transform-style: preserve-3d;
}

/* Компактный Flip Toggle - по центру между заголовком и карточками */
.direction-flip-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-lg);
  /* Равные отступы сверху и снизу для центрирования */
  margin: var(--space-lg) auto var(--space-lg) auto;
  padding: 0;
}

.flip-toggle-btn {
  padding: var(--space-xs) var(--space-lg);
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 0.9375rem;
  font-weight: 500;
  border-radius: 0;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
  position: relative;
  border-bottom: 2px solid transparent;
}

.flip-toggle-btn.active {
  color: var(--color-accent);
  background: transparent;
  border-bottom-color: var(--color-accent);
}

.flip-toggle-btn:hover:not(.active) {
  color: var(--color-text-primary);
}

/* Flip Container with 3D Transform */
.card-flip-container {
  perspective: 1200px;
  width: 100%;
  position: relative;
}

.card-flip-inner {
  position: relative;
  width: 100%;
  min-height: 180px;
  transition: transform 0.7s cubic-bezier(0.4, 0, 0.2, 1);
  transform-style: preserve-3d;
}

.card-flip-container.flipped .card-flip-inner {
  transform: rotateY(180deg);
}

.card-flip-front,
.card-flip-back {
  position: absolute;
  width: 100%;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.card-flip-front {
  transform: rotateY(0deg);
  z-index: 2;
}

.card-flip-back {
  transform: rotateY(180deg);
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Exercises Toggle & Collapsible */
.exercises-toggle-container {
  display: flex;
  justify-content: center;
  margin-top: var(--space-lg);
  margin-bottom: var(--space-xs);
  position: relative;
  z-index: 5;
}

/* Accordion-style toggle button */
.exercises-toggle-btn-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  width: 100%;
  max-width: 400px;
  padding: 16px 24px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 600;
  font-size: 1rem;
  text-align: left;
  cursor: pointer;
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

/* Subtle gradient line at bottom when collapsed */
.exercises-toggle-btn-main::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 20%;
  right: 20%;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.5), transparent);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.exercises-toggle-btn-main:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.exercises-toggle-btn-main:hover::after {
  opacity: 1;
}

/* Active/Expanded state */
.exercises-toggle-btn-main.active {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%);
  border-color: rgba(59, 130, 246, 0.4);
  color: #fff;
  box-shadow: 
    0 0 20px rgba(59, 130, 246, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  border-radius: 20px 20px 8px 8px;
}

.exercises-toggle-btn-main.active::after {
  opacity: 0;
}

/* Icon container with rotation */
.exercises-toggle-btn-main :deep(svg),
.exercises-toggle-btn-main svg {
  width: 20px;
  height: 20px;
  opacity: 0.6;
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
}

.exercises-toggle-btn-main:hover :deep(svg),
.exercises-toggle-btn-main:hover svg {
  opacity: 1;
}

.exercises-toggle-btn-main.active :deep(svg),
.exercises-toggle-btn-main.active svg {
  opacity: 1;
  color: #3b82f6;
}

.exercises-collapsible-wrapper {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  width: 100%;
}

.exercises-collapsible-wrapper.expanded {
  grid-template-rows: 1fr;
}

.exercises-collapsible-content {
  min-height: 0;
  overflow: visible;
}


.programs-back-container {
  width: 100%;
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

/* Карточка программы на обратной стороне - уникальная окантовка */
.training-program-card--back {
  min-height: 180px;
  display: flex !important;
  align-items: center;
  justify-content: center;
  opacity: 1 !important; /* Переопределяем opacity: 0 из base */
  background: var(--color-bg-card) !important;
  /* Простая рамка без лишних эффектов */
  border: 1px solid var(--color-border) !important;
  box-shadow: none !important;
  color: var(--color-text-primary) !important;
}

.training-program-card--back .training-program-content {
  opacity: 1 !important;
}

.training-program-card--back .training-program-title {
  color: var(--color-text-primary) !important;
  font-weight: 600;
  font-size: 1.5rem;
}

.training-program-card--back .training-program-description {
  color: var(--color-text-secondary) !important;
  margin-top: var(--space-sm);
}


/* Connection lines removed - now using flip animation instead */

.training-programs-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  overflow: visible;
  opacity: 0;
  transform: translateY(20px) scale(0.96);
  transition: 
    opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  /* 3D Perspective для карточек программ */
  perspective: 1000px;
  transform-style: preserve-3d;
}

.training-programs-wrapper--visible {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.training-programs-carousel {
  width: 100%;
  max-width: 100%;
  margin: 0 auto;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: visible;
  position: relative;
  isolation: isolate;
}

.training-programs-container {
  position: relative;
  width: 100%;
  height: 220px;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: visible;
  padding: 0;
  /* Эффект отражения направления - визуальная связь */
  transform-origin: center center;
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Keyframes для цветовой пульсации accent-цвета */
@keyframes accent-pulse {
  0%, 100% {
    border-color: var(--accent-color-base);
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent-color-base) 0%, transparent);
  }
  50% {
    border-color: var(--accent-color-pulse);
    box-shadow: 0 0 12px 4px color-mix(in srgb, var(--accent-color-pulse) 25%, transparent);
  }
}



/* Карточка программы тренировок - визуальное отражение направления с 3D эффектом */
.training-program-card {
  position: relative;
  width: 100%;
  max-width: 420px;
  height: 220px;
  padding: var(--space-lg);
  background: var(--training-program-bg, var(--color-bg-secondary));
  border: 1px solid var(--training-program-border, var(--color-border));
  border-radius: var(--radius-lg);
  touch-action: pan-y pinch-zoom;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  margin: 0 auto;
  transform-style: preserve-3d;
  backface-visibility: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
  box-shadow: var(--shadow-sm);
  will-change: transform, box-shadow;
  opacity: 0;
}

.training-program-card--visible {
  /* Базовый transform, будет комбинирован с 3D эффектом через style binding */
  opacity: 1;
  transform: translateZ(0);
}

.training-program-card--visible:hover,
.training-program-card:hover {
  border-color: var(--color-border-strong);
  box-shadow: var(--shadow-md);
  background: var(--color-bg-elevated);
}



.training-program-card--active {
  border-color: var(--training-program-border, rgba(229, 231, 235, 0.6));
  box-shadow: 
    0 4px 16px rgba(0, 0, 0, 0.08),
    0 2px 8px rgba(0, 0, 0, 0.06);
  /* Без градиента - чистый белый фон */
  background: var(--training-program-bg, var(--color-bg-secondary));
  /* Активное состояние - более выраженное отражение */
  /* transform будет комбинирован с 3D эффектом через style binding */
  opacity: 1;
}

.training-program-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm, 0.75rem);
  width: 100%;
  text-align: center;
}

/* Типографика программ */
.training-program-title {
  font-family: var(--font-family-base, 'Inter', 'Roboto Flex', 'Google Sans', sans-serif);
  font-size: clamp(1.309rem, 3.8vw, 1.618rem);
  font-weight: 600;
  color: var(--training-program-title-color, var(--color-text-primary));
  text-align: center;
  line-height: 1.3;
  width: 100%;
  margin: 0;
  letter-spacing: -0.01em;
  /* Без градиента - обычный черный текст */
  transition: color 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.training-program-description {
  font-family: var(--font-family-base, 'Inter', 'Roboto Flex', 'Google Sans', sans-serif);
  font-size: clamp(0.875rem, 2.6vw, 1rem);
  font-weight: 400;
  color: var(--training-program-description-color, var(--color-text-secondary));
  text-align: center;
  line-height: 1.55;
  width: 100%;
  margin: 0;
  letter-spacing: 0.005em;
  max-width: 92%;
  margin-left: auto;
  margin-right: auto;
  opacity: 0.8;
}

/* Навигация программ тренировок - микро-интерактивность */
.training-program-card__nav {
  position: absolute;
  bottom: 1rem;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--training-program-nav-color, var(--color-accent, #10A37F)) 35%, transparent);
  background: color-mix(in srgb, var(--color-bg, #050505) 45%, rgba(255, 255, 255, 0.2));
  color: var(--training-program-nav-color, var(--training-program-title-color, #10A37F));
  font-size: 1.125rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 3;
  box-shadow: 
    0 2px 8px rgba(0, 0, 0, 0.06),
    0 1px 3px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(18px) saturate(185%);
  -webkit-backdrop-filter: blur(18px) saturate(185%);
  /* Улучшенная поддержка touch событий для телефонов */
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.training-program-card__nav--left {
  left: 1rem;
}

.training-program-card__nav--right {
  right: 1rem;
}

.training-program-card__nav:hover {
  background: var(--training-program-nav-color, #10A37F);
  color: var(--color-text-inverse);
  transform: translateY(-1px) scale(1.05);
  box-shadow: 
    0 4px 12px rgba(16, 163, 127, 0.25),
    0 2px 6px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.training-program-card__nav:active,
.training-program-card__nav:focus {
  background: var(--training-program-nav-color, var(--training-program-title-color, #10A37F));
  color: var(--color-text-inverse);
  transform: translateY(0) scale(1);
  box-shadow: 
    0 4px 12px rgba(16, 163, 127, 0.3),
    0 2px 6px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.training-program-card__nav:focus-visible {
  outline: none;
  box-shadow: 
    0 0 0 3px color-mix(in srgb, var(--training-program-nav-color, #10A37F) 30%, transparent),
    0 2px 8px rgba(0, 0, 0, 0.06),
    0 1px 3px rgba(0, 0, 0, 0.08);
}

.training-program-card__nav:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  color: color-mix(in srgb, var(--training-program-nav-color, #10A37F) 45%, transparent);
  background: color-mix(in srgb, var(--color-bg, #050505) 70%, rgba(255, 255, 255, 0.08));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

/* Transitions - максимально быстрые и плавные анимации */
.discipline-slide-next-enter-active,
.discipline-slide-next-leave-active,
.discipline-slide-prev-enter-active,
.discipline-slide-prev-leave-active {
  transition: 
    transform 0.12s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.1s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform, opacity;
  backface-visibility: hidden;
  transform-style: preserve-3d;
  /* Принудительное GPU ускорение */
  -webkit-transform: translateZ(0);
  transform: translateZ(0);
  -webkit-perspective: 1000;
  perspective: 1000;
  /* Изоляция слоя для GPU */
  isolation: isolate;
  /* Отключаем pointer-events во время transition для предотвращения конфликтов */
  pointer-events: none;
}

/* Slide next (вправо) для направлений - максимально быстрая анимация */
.discipline-slide-next-enter-from {
  transform: translate3d(100%, 0, 0) translateZ(0);
  opacity: 0;
}

.discipline-slide-next-leave-to {
  transform: translate3d(-100%, 0, 0) translateZ(0);
  opacity: 0;
}

.discipline-slide-next-enter-to {
  transform: translate3d(0, 0, 0) translateZ(0) !important;
  opacity: 1 !important;
  pointer-events: auto !important;
}

.discipline-slide-next-leave-from {
  transform: translate3d(0, 0, 0) translateZ(0);
  opacity: 1;
  pointer-events: auto;
}

/* Slide prev (влево) для направлений - максимально быстрая анимация */
.discipline-slide-prev-enter-from {
  transform: translate3d(-100%, 0, 0) translateZ(0);
  opacity: 0;
}

.discipline-slide-prev-leave-to {
  transform: translate3d(100%, 0, 0) translateZ(0);
  opacity: 0;
}

.discipline-slide-prev-enter-to {
  transform: translate3d(0, 0, 0) translateZ(0) !important;
  opacity: 1 !important;
  pointer-events: auto !important;
}

.discipline-slide-prev-leave-from {
  transform: translate3d(0, 0, 0) translateZ(0);
  opacity: 1;
  pointer-events: auto;
}

/* Transition for program cards - точно так же как для направлений */
.program-slide-next-enter-active,
.program-slide-next-leave-active,
.program-slide-prev-enter-active,
.program-slide-prev-leave-active {
  transition: 
    transform 0.12s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.1s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform, opacity;
  backface-visibility: hidden;
  transform-style: preserve-3d;
  /* Принудительное GPU ускорение */
  -webkit-transform: translateZ(0);
  transform: translateZ(0);
  -webkit-perspective: 1000;
  perspective: 1000;
  /* Изоляция слоя для GPU */
  isolation: isolate;
  /* Отключаем pointer-events во время transition для предотвращения конфликтов */
  pointer-events: none;
}

/* Slide next (вправо) для программ - максимально быстрая анимация */
.program-slide-next-enter-from {
  transform: translate3d(100%, 0, 0) translateZ(0);
  opacity: 0;
}

.program-slide-next-leave-to {
  transform: translate3d(-100%, 0, 0) translateZ(0);
  opacity: 0;
}

.program-slide-next-enter-to {
  transform: translate3d(0, 0, 0) translateZ(0) !important;
  opacity: 1 !important;
  pointer-events: auto !important;
}

.program-slide-next-leave-from {
  transform: translate3d(0, 0, 0) translateZ(0);
  opacity: 1;
  pointer-events: auto !important;
}

/* Slide prev (влево) для программ - максимально быстрая анимация */
.program-slide-prev-enter-from {
  transform: translate3d(-100%, 0, 0) translateZ(0);
  opacity: 0;
}

.program-slide-prev-leave-to {
  transform: translate3d(100%, 0, 0) translateZ(0);
  opacity: 0;
}

.program-slide-prev-enter-to {
  transform: translate3d(0, 0, 0) translateZ(0) !important;
  opacity: 1 !important;
  pointer-events: auto !important;
}

.program-slide-prev-leave-from {
  transform: translate3d(0, 0, 0) translateZ(0);
  opacity: 1;
  pointer-events: auto !important;
}

/* Exercises Section - профессиональный spacing с параллаксом и эффектом перехода от программы */
.exercises-section {
  width: 100%;
  margin-top: 4.854rem; /* 3rem * 1.618 (золотое сечение) */
  position: relative;
  overflow: visible;
  will-change: transform;
  backface-visibility: hidden;
  transform-style: preserve-3d;
  /* 3D Perspective для карточек упражнений */
  perspective: 1000px;
}

/* Визуальная связь между программой и упражнениями */
.program-to-exercises-connection {
  position: absolute;
  top: -3.236rem; /* Отступ от секции упражнений до программы */
  left: 50%;
  transform: translateX(-50%);
  width: 2px;
  height: 0;
  background: linear-gradient(
    180deg,
    var(--training-program-border, rgba(229, 231, 235, 0.5)) 0%,
    color-mix(in srgb, var(--training-program-border, rgba(229, 231, 235, 0.5)) 70%, transparent) 70%,
    transparent 100%
  );
  opacity: 0;
  transition: 
    height 0.9s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.7s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1;
  filter: blur(0.5px);
}

.program-to-exercises-connection--visible {
  height: 3.236rem;
  opacity: 0.5;
}

.exercises-container {
  position: relative;
  width: 100%;
  min-height: 120px;
  overflow: visible;
  opacity: 0;
  transform: translateY(20px) scale(0.98);
  transition: 
    opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.exercises-container--visible {
  opacity: 1;
  transform: translateY(0) scale(1);
}

/* Exercises Loading - удалено, используется скелетон */

/* Empty state - утонченный дизайн */
.exercises-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4.854rem 2.618rem; /* золотое сечение */
  text-align: center;
  position: relative;
}

.exercises-empty__icon {
  margin-bottom: 1.309rem; /* золотое сечение */
  color: rgba(156, 163, 175, 0.4);
  transition: all 0.3s ease;
}

.exercises-empty:hover .exercises-empty__icon {
  color: rgba(156, 163, 175, 0.5);
  transform: scale(1.05);
}

.exercises-empty__text {
  color: var(--color-text-secondary, #6B7280);
  font-size: clamp(0.96875rem, 3.2vw, 1.0625rem);
  font-weight: 500;
  letter-spacing: 0.01em;
  opacity: 0.8;
  margin: 0;
  line-height: 1.6;
}

.exercises-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-sm);
  width: 100%;
  position: relative;
  isolation: isolate;
  padding: 0 var(--space-2xs) var(--space-xl); /* Added bottom padding */
}

.exercises-list--virtual {
  /* Для virtual scrolling нужен overflow и фиксированная высота */
  max-height: 600px; /* Максимальная высота списка */
  overflow-y: auto;
  overflow-x: hidden;
  /* Кастомный скроллбар для виртуального скролла */
  scrollbar-width: thin;
  scrollbar-color: var(--scroll-thumb-color-active, rgba(32, 33, 35, 0.35)) transparent;
  /* Smooth scrolling для лучшего UX */
  scroll-behavior: smooth;
  /* Оптимизация для плавного скролла */
  will-change: scroll-position;
  contain: layout style;
}

.exercises-list--virtual::-webkit-scrollbar {
  width: 6px;
}

.exercises-list--virtual::-webkit-scrollbar-track {
  background: transparent;
}

.exercises-list--virtual::-webkit-scrollbar-thumb {
  background-color: var(--scroll-thumb-color-active, rgba(32, 33, 35, 0.35));
  border-radius: 3px;
  transition: background-color 0.2s ease;
}

.exercises-list--virtual::-webkit-scrollbar-thumb:hover {
  background-color: var(--scroll-thumb-color-hover, rgba(32, 33, 35, 0.45));
}

/* Virtual scrolling wrapper */
.exercises-list-virtual {
  position: relative;
  width: 100%;
  will-change: height;
  contain: layout;
}

/* Virtual scrolling content - позиционирование видимых элементов */
.exercises-list-virtual-content {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  will-change: transform;
  backface-visibility: hidden;
  transform-style: preserve-3d;
  /* GPU ускорение для плавного скролла */
  -webkit-transform: translateZ(0);
  transform: translateZ(0);
}

/* Карточки упражнений - профессиональный дизайн с плавной сменой градиентов */
.program-exercise-level-badge {
  padding: 0.15rem 0.5rem;
  font-size: 0.7rem;
  border-radius: var(--radius-full);
  gap: var(--space-sm);  /* Non-golden-ratio value */
  background: var(--color-surface-card);
}

.program-exercise-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center; /* Center content vertically */
  gap: var(--space-xs);
  padding: var(--space-sm);
  /* Premium glassmorphism */
  background: linear-gradient(
    145deg,
    rgba(35, 35, 40, 0.95) 0%,
    rgba(25, 25, 30, 0.98) 100%
  );
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 32px; /* Very round corners */
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  position: relative;
  z-index: 1;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  will-change: transform, box-shadow;
  overflow: hidden;
  /* Square shape */
  aspect-ratio: 1;
  height: auto;
  min-height: 0;
}

.program-exercise-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: var(--radius-xl);
  background: radial-gradient(
    circle at 50% 0%,
    var(--exercise-card-color, var(--color-accent)) 0%,
    transparent 70%
  );
  opacity: 0;
  transition: opacity 0.4s ease;
  pointer-events: none;
  z-index: -1;
}

.program-exercise-card:hover {
  border-color: rgba(255, 255, 255, 0.3);
  box-shadow: 
    0 12px 40px rgba(0, 0, 0, 0.25),
    0 0 0 1px rgba(255, 255, 255, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
  transform: translateY(-6px) scale(1.02);
  z-index: 10;
}

@keyframes shadowPulseExercise {
  0%, 100% {
    box-shadow: 
      0 8px 24px color-mix(in srgb, var(--exercise-card-color, #10A37F) 18%, transparent),
      0 6px 20px color-mix(in srgb, var(--exercise-card-color, #10A37F) 15%, transparent),
      0 4px 12px rgba(0, 0, 0, 0.08),
      0 2px 6px rgba(0, 0, 0, 0.06),
      0 1px 4px rgba(0, 0, 0, 0.04),
      inset 0 1px 0 rgba(255, 255, 255, 0.9),
      0 0 0 1px rgba(255, 255, 255, 0.45);
  }
  50% {
    box-shadow: 
      0 10px 28px color-mix(in srgb, var(--exercise-card-color, #10A37F) 22%, transparent),
      0 8px 24px color-mix(in srgb, var(--exercise-card-color, #10A37F) 18%, transparent),
      0 6px 16px rgba(0, 0, 0, 0.1),
      0 4px 10px rgba(0, 0, 0, 0.08),
      0 2px 6px rgba(0, 0, 0, 0.06),
      inset 0 1px 0 rgba(255, 255, 255, 0.95),
      0 0 0 1.5px rgba(255, 255, 255, 0.55);
  }
}

.program-exercise-card:hover::before {
  opacity: 0.15;
}

.program-exercise-card:active {
  transform: translateY(-3px) scale(1.01);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
}

/* Exercise card header with icon and title */
.program-exercise-card-header {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

/* Иконка упражнения - Premium круглый контейнер */
.program-exercise-icon {
  /* Центрирование иконки */
  margin: 0 auto;
  margin-bottom: 8px;
  width: 80px;
  height: 80px;
  min-width: 80px;
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Dark solid background */
  background: #1a1a1f;
  color: var(--exercise-card-color, var(--color-accent));
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.15);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 
    0 4px 20px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  position: relative;
  overflow: hidden; /* Clip content to circle */
}

/* Состояние при наведении на карточку */
.program-exercise-card:hover .program-exercise-icon {
  transform: scale(1.08);
  border-color: var(--exercise-card-color, var(--color-accent));
  box-shadow: 
    0 8px 28px rgba(0, 0, 0, 0.35),
    0 0 20px var(--color-accent-light, rgba(16, 163, 127, 0.2)),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
}

.program-exercise-icon svg {
  width: 32px;
  height: 32px;
}

/* Стили для изображений иконок - заполнение круга */
.program-exercise-icon__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  /* Solid background to hide transparency pattern */
  background: #1a1a1f;
}
/* Иконка с изображением */
.program-exercise-icon--has-image {
  background: #1a1a1f;
  padding: 0;
}

/* Hover на иконке с изображением */
.program-exercise-card:hover .program-exercise-icon--has-image .program-exercise-icon__img {
  transform: scale(1.1);
}

/* Расширенное изображение - заполняет всю карточку */
.program-exercise-expanded-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 100;
  object-fit: contain; /* Show full image without cropping */
  object-position: center;
  padding: 0;
  background: transparent; /* Transparent to show blurred bg */
  border-radius: inherit;
  animation: expandIn 0.2s ease-out forwards;
}

/* Размытый фон для расширенного изображения */
.program-exercise-expanded-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 90;
  overflow: hidden;
  border-radius: inherit;
  background: #000;
}

.program-exercise-expanded-bg__img {
  width: 100%;
  height: 100%;
  object-fit: cover; /* Fill completely */
  object-position: center;
  filter: blur(20px) brightness(0.7); /* Strong blur and darkening */
  transform: scale(1.2); /* Scale up to hide blur edges */
  opacity: 0;
  animation: fadeInBg 0.4s ease-out forwards;
}

@keyframes fadeInBg {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes expandIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* Состояние карточки при развернутой иконке */
.program-exercise-card--expanded {
  z-index: 50 !important;
  border-color: var(--color-accent);
  box-shadow: 
    0 0 0 2px var(--color-accent),
    0 16px 48px rgba(0, 0, 0, 0.5);
}

/* Скрываем контент под развернутой иконкой */
.program-exercise-card--expanded .program-exercise-content,
.program-exercise-card--expanded .program-exercise-icon {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}

/* Контент карточки - всегда по центру */
.program-exercise-content {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  text-align: center;
  padding: 0 4px;
}

/* Типографика упражнений */
.program-exercise-title {
  font-family: var(--font-family-base, 'Inter', 'Roboto Flex', 'Google Sans', sans-serif);
  font-size: clamp(0.9375rem, 2.8vw, 1.0625rem);
  font-weight: 600;
  color: var(--color-text-primary, #f4f4f5);
  line-height: 1.3;
  letter-spacing: -0.01em;
  transition: color 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  backface-visibility: hidden;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}

.program-exercise-description {
  font-family: var(--font-family-base, 'Inter', 'Roboto Flex', 'Google Sans', sans-serif);
  font-size: clamp(0.75rem, 2.2vw, 0.875rem);
  font-weight: 400;
  color: var(--color-text-secondary, rgba(244, 244, 245, 0.7));
  line-height: 1.45;
  letter-spacing: 0.005em;
  opacity: 0.85;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Отключение параллакса для пользователей с prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  .page-title,
  .programs-section,
  .training-programs-section,
  .exercises-section {
    transform: none !important;
    will-change: auto !important;
  }
  
  .exercises-page {
    background-attachment: scroll !important;
    background-position: center 50% !important;
  }
}

/* Responsive Design - продуманная адаптация */
@media (max-width: 768px) {
  .exercises-page {
    padding: 0 var(--space-sm);
    padding-top: var(--space-xs);
    padding-bottom: calc(var(--space-xl) + 80px);
    background-attachment: scroll;
  }

  .page-title {
    font-size: clamp(1.75rem, 5vw, 2.25rem); /* Уменьшено */
    margin: 0 0 var(--space-md) 0;
  }

  .direction-flip-toggle {
    margin: var(--space-md) auto var(--space-md) auto;
  }

  .page-content {
    gap: 0.25rem;
  }

  .training-program-card {
    height: auto;
    min-height: 180px;
    padding: var(--space-md);
  }

  .program-exercise-card {
    padding: var(--space-md) var(--space-sm);
    min-height: 140px;
  }

  .program-exercise-icon {
    width: 64px;
    height: 64px;
  }
}

@media (max-width: 480px) {
  .exercises-page {
    padding-top: var(--space-2xs);
  }

  .page-title {
    font-size: clamp(1.5rem, 5vw, 2rem); /* Уменьшено */
    margin: 0 0 var(--space-sm) 0;
  }

  .direction-flip-toggle {
    margin: var(--space-sm) auto var(--space-sm) auto;
  }
}



@media (max-width: 360px) {
  .exercises-page {
    padding: var(--space-sm, 0.75rem) var(--space-xs, 0.5rem);
  }

  .programs-container {
    min-height: 170px;
  }

  .program-button {
    min-height: 170px;
    padding: var(--space-md, 1rem) var(--space-sm, 0.75rem);
  }

  .program-button__nav {
    width: 32px;
    height: 32px;
  }

  .training-programs-container {
    height: 180px;
  }

  .training-program-card {
    height: 180px;
    padding: var(--space-sm, 0.75rem);
  }

  .training-program-card__nav {
    width: 32px;
    height: 32px;
    font-size: 0.875rem;
    bottom: var(--space-xs, 0.5rem);
  }

  .training-program-card__nav--left {
    left: var(--space-xs, 0.5rem);
  }

  .training-program-card__nav--right {
    right: var(--space-xs, 0.5rem);
  }
}
</style>
