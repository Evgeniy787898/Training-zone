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
      <!-- Flip Toggle -->
      <ExercisesDirectionToggle
        v-if="currentProgram && displayPrograms.length > 0"
        v-model="showPrograms"
      />

      <ProgramsSection
        ref="programsSectionComponent"
        :current-program="currentProgram"
        :training-programs="trainingPrograms"
        :current-training-program="currentTrainingProgram"
        :is-flipped="showPrograms"
        :training-programs-loading="trainingProgramsLoading"
        :training-programs-error="trainingProgramsError"
        :has-prev-program="hasPrev"
        :has-next-program="hasNext"
        :has-prev-training="hasPrevTrainingProgram"
        :has-next-training="hasNextTrainingProgram"
        :discipline-slide-direction="disciplineSlideDirection"
        :training-slide-direction="slideDirection"
        :parallax-style="parallaxProgramsSection"
        :parallax-back-style="parallaxTrainingPrograms"
        :get-program-styles="getProgramStyles"
        :get-training-program-styles="getTrainingProgramStyles"
        :active-program-id="userProgramSnapshot?.programId"
        :is-activating="isActivatingProgram"
        @flip="showPrograms = !showPrograms"
        @prev-program="selectPrevProgram"
        @next-program="selectNextProgram"
        @prev-training="selectPrevTrainingProgram"
        @next-training="selectNextTrainingProgram"
        @retry-training="retryLoadTrainingPrograms"
        @set-active-program="handleSetActiveProgram"
      />

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
          <!-- PROG-R02: Exercise Filters extracted -->
          <ExerciseFilters
            :search-query="searchQuery"
            :equipment-filter="equipmentFilter"
            :available-equipment="availableEquipment"
            @update:searchQuery="searchQuery = $event"
            @clear-search="clearSearch"
            @toggle-equipment="toggleEquipmentFilter"
            @clear-equipment="clearEquipmentFilter"
          />

          <div ref="exercisesSectionElement" class="exercises-section" v-if="currentProgram" :style="parallaxExercises">
            <ExerciseList
              ref="exercisesListComponent"
              :exercises="filteredExercises"
              :visible-exercises="visibleExercises"
              :has-more="hasMore"
              :card-styles="exerciseCardStyles"
              :loading="programExercisesLoading"
              :error="programExercisesError"
              :visible="exercisesVisible && !programExercisesLoading"
              :slide-direction="slideDirection"
              :get-card-3-d-style="getCard3DStyle"
              @load-more="loadMore"
              @retry="retryLoadProgramExercises"
              @click="(exercise) => handleExerciseCardClick(undefined as unknown as MouseEvent, exercise)"
              @card-mouseenter="(exercise) => { prefetchExerciseData(exercise); preloadExerciseImages(exercise, 'high'); }"
              @card-mousemove="(e, exercise) => handle3DMouseMove(e, `exercise-${exercise.id}`)"
              @card-mouseleave="(exercise) => { handle3DMouseLeave(`exercise-${exercise.id}`); cancelPrefetchExercise(); }"
            />
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
import { ref, computed, onMounted, watch } from 'vue';

import ErrorState from '@/modules/shared/components/ErrorState.vue';
import ErrorHandler from '@/services/errorHandler';
import { createLazyComponent } from '@/utils/lazyComponent';

import AppIcon from '@/modules/shared/components/AppIcon.vue';
import { hapticLight, hapticMedium } from '@/utils/hapticFeedback';
import { useIntersectionObserver } from '@/composables/useIntersectionObserver';

const ExerciseModal = createLazyComponent(() => import('@/modules/exercises/components/ExerciseModal.vue'), {
  delay: 0,
  suspensible: true,
});

import ExercisesDirectionToggle from '@/modules/exercises/components/ExercisesDirectionToggle.vue';
import ExerciseFilters from '@/modules/exercises/components/ExerciseFilters.vue';
import ProgramsSection from '@/modules/exercises/components/ProgramsSection.vue';
import ExerciseList from '@/modules/exercises/components/ExerciseList.vue';
import { useExercisesScroll } from '@/composables/useExercisesScroll';
import { useExercisePreloading } from '@/composables/useExercisePreloading';
import { cachedApiClient } from '@/services/cachedApi';
import { useExercisesData } from '@/composables/useExercisesData';
import { useCard3D } from '@/composables/useCard3D';
import type {
  UserProgramSnapshot
} from '@/types';
import type { ProgramExercise } from '@/types/exercises-page';

// New Composables
import { useExercisesPageStyles } from '@/composables/exercises/useExercisesPageStyles';
import { useParallaxEffect } from '@/composables/exercises/useParallaxEffect';
import { useCustomScrollbar } from '@/composables/exercises/useCustomScrollbar';
import { useExercisesGestures } from '@/composables/exercises/useExercisesGestures';

const { getCard3DStyle, handle3DMouseMove, handle3DMouseLeave } = useCard3D();

// Components Refs
const programsSectionComponent = ref<InstanceType<typeof ProgramsSection> | null>(null);
const exercisesListComponent = ref<InstanceType<typeof ExerciseList> | null>(null);

// Proxy Refs for composables
const programsSectionRef = computed<HTMLElement | null>(() => programsSectionComponent.value?.sectionElement || null);
const trainingProgramsSectionElement = computed<HTMLElement | null>(() => programsSectionComponent.value?.backContainerElement || null);
const exercisesSectionElement = ref<HTMLElement | null>(null);
const disciplineCardRef = computed<HTMLElement | null>(() => programsSectionComponent.value?.disciplineCardElement || null);
const trainingProgramCardRef = computed<HTMLElement | null>(() => programsSectionComponent.value?.trainingProgramCardElement || null);

// DOM refs
const exercisesPageRef = ref<HTMLElement | null>(null);
const pageTitleRef = ref<HTMLElement | null>(null);
const pageContentRef = ref<HTMLElement | null>(null);

// Intersection Observers
const { isIntersecting: isProgramsSectionVisible, reconnect: reconnectProgramsObserver } = useIntersectionObserver(
  trainingProgramsSectionElement,
  { rootMargin: '100px', threshold: 0.1 }
);
const { isIntersecting: isExercisesSectionVisible, reconnect: reconnectExercisesObserver } = useIntersectionObserver(
  exercisesSectionElement,
  { rootMargin: '100px', threshold: 0.1 }
);

// Data Composable
const {
  loading,
  error,
  exercisesVisible,
  programs,
  trainingPrograms,
  programExercises,
  trainingProgramsLoading,
  trainingProgramsError,
  programExercisesLoading,
  programExercisesError,
  activeProgramColor,
  displayPrograms,
  currentProgram,
  currentTrainingProgram,
  hasPrev,
  hasNext,
  hasPrevTrainingProgram,
  hasNextTrainingProgram,
  disciplineSlideDirection,
  slideDirection,
  loadCatalog,
  loadTrainingPrograms,
  loadProgramExercises,
  selectPrevProgram,
  selectNextProgram,
  selectPrevTrainingProgram,
  selectNextTrainingProgram,
} = useExercisesData(isProgramsSectionVisible, isExercisesSectionVisible, {
  onExercisesLoaded: () => {
     // Hook logic handled by component watcher if needed
  }
});

// --- Logic Refactored to Composables ---

// 1. Styles
const { 
  exerciseCardStyles, 
  pageStyleVars, 
  getProgramStyles, 
  getTrainingProgramStyles, 
  getExerciseModalColor 
} = useExercisesPageStyles(currentProgram, activeProgramColor, programExercises);

// 2. Parallax
const { 
  parallaxPageTitle, 
  parallaxProgramsSection, 
  parallaxTrainingPrograms, 
  parallaxExercises, 
  parallaxBackground 
} = useParallaxEffect(
  exercisesPageRef,
  pageTitleRef,
  programsSectionRef,
  trainingProgramsSectionElement, // proxy ref to element
  exercisesSectionElement
);

// 3. Scrollbar
useCustomScrollbar(pageStyleVars);

// 4. Gestures
useExercisesGestures(
  disciplineCardRef,
  trainingProgramCardRef,
  currentProgram,
  currentTrainingProgram,
  hasNext,
  hasPrev,
  hasNextTrainingProgram,
  hasPrevTrainingProgram,
  selectNextProgram,
  selectPrevProgram,
  selectNextTrainingProgram,
  selectPrevTrainingProgram
);

// --- Local Logic ---

// Flip animation state
const showPrograms = ref(false);

// Wrappers for Template/Retries
const retryLoadTrainingPrograms = async () => {
  if (currentProgram.value) await loadTrainingPrograms(currentProgram.value.id);
};
const retryLoadProgramExercises = async () => {
  if (currentTrainingProgram.value) await loadProgramExercises(currentTrainingProgram.value.id);
};

// Search Logic - Defined BEFORE scroll usage
const searchQuery = ref('');
const equipmentFilter = ref<string[]>([]);

// Available equipment from all exercises
const availableEquipment = computed(() => {
  const all = new Set<string>();
  for (const ex of programExercises.value) {
    if (ex.equipment && Array.isArray(ex.equipment)) {
      for (const eq of ex.equipment) {
        if (eq) all.add(eq);
      }
    }
  }
  return Array.from(all).sort();
});

const toggleEquipmentFilter = (eq: string) => {
  const idx = equipmentFilter.value.indexOf(eq);
  if (idx >= 0) {
    equipmentFilter.value = equipmentFilter.value.filter(e => e !== eq);
  } else {
    equipmentFilter.value = [...equipmentFilter.value, eq];
  }
};

const clearEquipmentFilter = () => {
  equipmentFilter.value = [];
};

const filteredExercises = computed(() => {
  let result = programExercises.value;
  
  // Filter by search query
  const query = searchQuery.value.trim().toLowerCase();
  if (query) {
    result = result.filter((ex) =>
      (ex.title || '').toLowerCase().includes(query) ||
      (ex.exerciseKey || '').toLowerCase().includes(query)
    );
  }
  
  // Filter by equipment
  if (equipmentFilter.value.length > 0) {
    result = result.filter((ex) => {
      if (!ex.equipment || !Array.isArray(ex.equipment)) return false;
      return equipmentFilter.value.some(eq => ex.equipment?.includes(eq));
    });
  }
  
  return result;
});

const clearSearch = () => { searchQuery.value = ''; };

// Virtual Scroll & Preloading (Infinite Scroll)
const {
  exercisesScrollContainerRef,
  visibleExerciseIndices,
  visibleExercises,
  loadMore,
  hasMore
} = useExercisesScroll(filteredExercises);

const {
  preloadVisibleExerciseImages: _preloadVisibleExerciseImages,
  preloadExerciseImages,
  prefetchExerciseData,
  cancelPrefetchExercise,
  resetPreloadingState: _resetPreloadingState
} = useExercisePreloading(filteredExercises, visibleExerciseIndices);


// Collapsible Exercises State
const exercisesExpanded = ref(false);
const toggleExercises = () => {
  exercisesExpanded.value = !exercisesExpanded.value;
};

// Exercise Modal Logic
const selectedExercise = ref<ProgramExercise | null>(null);
const isExerciseModalOpen = ref(false);

const exerciseModalColor = computed(() => getExerciseModalColor(selectedExercise.value));

const openExerciseModal = (exercise: ProgramExercise) => {
  hapticMedium();
  selectedExercise.value = exercise;
  isExerciseModalOpen.value = true;
};

const closeExerciseModal = () => {
  hapticLight();
  isExerciseModalOpen.value = false;
  setTimeout(() => {
    selectedExercise.value = null;
  }, 300);
};

const handleExerciseCardClick = (_event: MouseEvent, exercise: ProgramExercise) => {
  openExerciseModal(exercise);
};

// Sync scroll container for virtual scrolling
watch(() => exercisesListComponent.value?.scrollElement, (el) => {
  exercisesScrollContainerRef.value = el || null;
}, { immediate: true });

// Page Styles with Parallax
const pageStyleVarsWithParallax = computed(() => ({
  ...pageStyleVars.value,
  ...parallaxBackground.value,
}));

// User Program State
const userProgramSnapshot = ref<UserProgramSnapshot | null>(null);
const isActivatingProgram = ref(false);

const loadUserProgram = async () => {
  try {
    const data = await cachedApiClient.getUserProgram();
    userProgramSnapshot.value = data;
  } catch (e) {
    console.error('Failed to load user program', e);
  }
};

const handleSetActiveProgram = async (programId: string) => {
  if (!programId || isActivatingProgram.value) return;
  
  if (!currentProgram.value) {
    ErrorHandler.handleWithToast(new Error('Discipline not selected'), 'SetActiveProgram');
    return;
  }

  isActivatingProgram.value = true;
  hapticMedium();

  try {
    // We need to create/update user program for the current discipline
    await cachedApiClient.createUserProgram({
      disciplineId: currentProgram.value.id,
      programId: programId
    });
    
    // Refresh user program data
    await loadUserProgram();
    
    // Show success toast
    // Assuming ErrorHandler might have a success method or we just log for now if no toast service exposed directly
    // Ideally: ToastService.success('Программа выбрана');
    console.log('Program activated successfully');
    
  } catch (err: any) {
    ErrorHandler.handleWithToast(err, 'SetActiveProgram');
  } finally {
    isActivatingProgram.value = false;
  }
};

onMounted(() => {
  loadCatalog();
  loadUserProgram();
  // reconnect observers logic handled by template refs updates
  watch(trainingProgramsSectionElement, () => reconnectProgramsObserver());
  watch(exercisesSectionElement, () => reconnectExercisesObserver());
});

// cleanup handled by composables auto-unmounting or Vue's unmounted hook
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
  /* Changed from overflow: visible to prevent layout issues with grid animation */
  overflow: hidden;
}

/* GAP-004 & GAP-005: Styles moved to ExerciseFilters.vue */
.programs-back-container {
  width: 100%;
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

/* Exercises Section - reduced margin for better layout */
.exercises-section {
  width: 100%;
  margin-top: var(--space-lg); /* Reduced from 4.854rem to standard spacing */
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
