<template>
  <Transition name="focus-slide">
    <div 
      v-if="!isMinimized"
      class="focus-session"
      :class="{ 'focus-session--overtime': isOvertime }"
      @touchstart="handleTouchStart"
      @touchend="handleTouchEnd"
    >
      <!-- Header -->
      <header class="focus-session__header">
        <!-- Left: Total Time with Label -->
        <div class="focus-session__total-time">
          <svg class="total-time__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="13" r="8"/>
            <path d="M12 9v4l2 2"/>
            <path d="M5 3L2 6"/>
            <path d="M22 6l-3-3"/>
          </svg>
          <div class="total-time__content">
            <span class="total-time__value">{{ formattedTotalTime }}</span>
            <span class="total-time__label">общее время</span>
          </div>
        </div>
        
        <!-- Right: Action Icons -->
        <div class="focus-session__header-actions">
          <button 
            class="icon-btn icon-btn--ghost"
            @click="showSettings = true"
            aria-label="Настройки"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
           
          <button 
            class="icon-btn icon-btn--ghost"
            @click="minimize"
            aria-label="Свернуть"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="M14 10l7-7"/><path d="M3 21l7-7"/></svg>
          </button>
           
          <button 
            class="icon-btn icon-btn--danger"
            @click="handleClose"
            aria-label="Закрыть"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </header>
      
      <!-- Body -->
      <main class="focus-session__body">
        <Transition name="exercise-slide" mode="out-in">
          <div :key="currentExercise?.key" class="focus-session__exercise" v-if="currentExercise">
            
            <!-- Main Content: Timer + Images -->
            <div class="focus-session__main-row">
              <!-- LEFT: Large Professional Timer with Time + Status Inside -->
              <button class="focus-timer" @click="toggleTimer">
                <svg class="focus-timer__ring" :viewBox="`0 0 ${timerRingSize} ${timerRingSize}`">
                  <circle 
                    class="focus-timer__ring-bg"
                    :cx="timerRingSize / 2"
                    :cy="timerRingSize / 2"
                    :r="timerRadius"
                  />
                  <circle 
                    class="focus-timer__ring-progress"
                    :class="`focus-timer__ring-progress--${currentPhase}`"
                    :cx="timerRingSize / 2"
                    :cy="timerRingSize / 2"
                    :r="timerRadius"
                    :stroke-dasharray="timerCircumference"
                    :stroke-dashoffset="timerProgressOffset"
                  />
                </svg>
                <div class="focus-timer__content">
                  <span class="focus-timer__status" :class="`focus-timer__status--${currentPhase}`">
                    {{ getPhaseStatusText }}
                  </span>
                  <span class="focus-timer__time">{{ formattedPhaseTime }}</span>
                  <span v-if="!isTimerRunning" class="focus-timer__hint">нажми чтобы начать</span>
                </div>
              </button>
              
              <!-- RIGHT: Exercise Images as Circles -->
              <div class="focus-session__images-panel">
                <span class="images-panel__label">Нажми для просмотра</span>
                <div class="images-panel__grid">
                  <button
                    v-for="(img, idx) in currentExerciseImages"
                    :key="idx"
                    class="images-panel__item"
                    @click="openImageZoom(img)"
                    :aria-label="`Изображение ${idx + 1}`"
                  >
                    <img :src="img" :alt="`Шаг ${idx + 1}`" />
                  </button>
                </div>
              </div>
            </div>
            
            <!-- Info Section: Exercise Name + Sets Progress -->
            <div class="focus-session__info-section">
              <div class="focus-session__exercise-info">
                <h2 class="exercise-info__title">{{ currentExerciseTitle }}</h2>
                <div class="exercise-info__targets">
                  <span class="exercise-info__target-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
                    {{ currentExercise.sets }} {{ currentExercise.sets === 1 ? 'подход' : 'подхода' }}
                  </span>
                  <span class="exercise-info__separator">×</span>
                  <span class="exercise-info__target-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                    {{ currentExercise.reps }} повторов
                  </span>
                </div>
              </div>
              
              <!-- Set Progress Indicators -->
              <div class="focus-session__sets-progress">
                <SetProgressIndicators
                  :total-sets="currentTotalSets"
                  :target-reps="currentExercise.reps"
                  :completed-sets="currentCompletedSets"
                  :current-set-index="currentSetIndex"
                  :base-sets="currentExercise.sets ?? 0"
                  @set-click="openRepsInput"
                  @remove-dynamic-set="handleRemoveDynamicSet"
                />
              </div>
            </div>
          </div>
          
          <!-- Completion Screen -->
          <div v-else class="focus-session__completion">
            <div class="completion-icon">🎉</div>
            <h2 class="completion-title">Тренировка завершена!</h2>
            <p class="completion-subtitle">Отличная работа. Оставь комментарий.</p>
            <button class="completion-btn" @click="showComment = true">
              💬 Оставить комментарий
            </button>
          </div>
        </Transition>
      </main>
      
      <!-- Footer -->
      <footer class="focus-session__footer">
        <!-- Left: Music Button -->
        <button 
          class="footer-music-btn"
          @click="showMusicPlayer = true"
          :class="{ 'footer-music-btn--playing': isMusicPlaying }"
          aria-label="Музыка"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        </button>
        
        <!-- Right: Exercise Progress Stepper with Icons -->
        <div class="exercise-stepper">
          <button
            v-for="(ex, idx) in orderedExercises"
            :key="ex.key"
            class="exercise-stepper__item"
            :class="{
              'exercise-stepper__item--completed': isExerciseCompleted(ex.key),
              'exercise-stepper__item--current': currentIndex === idx,
              'exercise-stepper__item--upcoming': currentIndex < idx && !isExerciseCompleted(ex.key)
            }"
            @click="goToExerciseIndex(idx)"
            :aria-label="`Упражнение ${idx + 1}`"
          >
            <img 
              v-if="ex.iconUrl" 
              :src="ex.iconUrl" 
              :alt="ex.exerciseTitle || ''"
              class="exercise-stepper__icon"
            />
            <span v-else class="exercise-stepper__number">{{ idx + 1 }}</span>
          </button>
        </div>
      </footer>
      
      <!-- Modals -->
      <RepsInputModal
        :is-open="repsModalOpen"
        :set-index="selectedSetIndex"
        :target-reps="currentExercise?.reps ?? 0"
        :current-reps="selectedSetReps"
        :current-level="currentExerciseLevel"
        :current-tier="currentExerciseTier"
        :total-sets="currentTotalSets"
        :completed-sets="currentCompletedSets.length"
        :all-tier-levels="allTierLevels"
        :is-first-set="selectedSetIndex === 0"
        :level-code="currentExercise?.levelCode ?? ''"
        :next-exercise-name="nextExerciseName"
        @close="repsModalOpen = false"
        @save="handleSaveReps"
        @add-sets="handleInlineAddSets"
      />
      
      <TrainingSettingsModal
        :is-open="showSettings"
        :settings="tabataSettings"
        @close="showSettings = false"
        @save="handleSaveSettings"
      />
      
      <TrainingCommentModal
        :is-open="showComment"
        :current-comment="comment"
        @close="showComment = false"
        @save="handleSaveComment"
        @skip="handleSkipComment"
      />

       <TrainingMusicPlayer
         v-model:is-open="showMusicPlayer"
         @play-state="isMusicPlaying = $event"
       />
      
      <!-- Image Zoom with controls -->
      <ImageZoom
        :is-open="showImageZoom"
        :src="zoomImageUrl"
        :images="currentExerciseImages"
        :initial-index="zoomImageIndex"
        alt="Упражнение"
        @close="showImageZoom = false"
      />
      
      <!-- Progression Recommendation Modal -->
      <ProgressionRecommendationModal
        v-if="progressionResult"
        :is-open="showProgression"
        :result="progressionResult"
        :current-level="currentExerciseLevel"
        :current-tier="currentExerciseTier"
        @close="showProgression = false"
        @accept="handleProgressionAccept"
        @skip="showProgression = false"
      />
      
      <!-- Phase 6: Optional Set Modal -->
      <OptionalSetModal
        :show="showOptionalSetModal"
        :completed-reps="currentCompletedSets[0]?.reps ?? 0"
        :target-tier="optionalSetOffer?.targetTier ?? 2"
        :target-name="optionalSetOffer?.targetName ?? ''"
        :sets-to-add="optionalSetOffer?.setsToAdd ?? 1"
        :reps-needed="optionalSetOffer?.repsNeeded ?? 10"
        @accept="handleOptionalSetAccept"
        @skip="handleOptionalSetSkip"
      />
      
      <!-- Close confirmation -->
      <Teleport to="body">
        <Transition name="modal-fade">
          <div v-if="showCloseConfirm" class="confirm-overlay" @click.self="showCloseConfirm = false">
            <div class="confirm-modal">
              <h3>Завершить тренировку?</h3>
              <p>Все несохранённые данные будут потеряны.</p>
              <div class="confirm-actions">
                <button class="confirm-btn confirm-btn--cancel" @click="showCloseConfirm = false">
                  Отмена
                </button>
                <button class="confirm-btn confirm-btn--confirm" @click="confirmClose">
                  Завершить
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>
    </div>
  </Transition>
  
  <!-- Minimized Tab now handled by global pill in App.vue -->
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useWindowSize } from '@vueuse/core';
import { type ExerciseCard } from '@/types/today';
import { type ExerciseLevel, type OptionalSetOffer } from '@/types';
import { hapticLight, hapticMedium, hapticSuccess, hapticWarning } from '@/utils/hapticFeedback';
import { useAppStore } from '@/stores/app';
// CircularTabataTimer removed - using inline professional timer
import SetProgressIndicators from './SetProgressIndicators.vue';
import RepsInputModal from './RepsInputModal.vue';
import TrainingSettingsModal from './TrainingSettingsModal.vue';
import TrainingCommentModal from './TrainingCommentModal.vue';
import TrainingMusicPlayer from './TrainingMusicPlayer.vue';
import ProgressionRecommendationModal from './ProgressionRecommendationModal.vue';
import OptionalSetModal from './OptionalSetModal.vue';
import ImageZoom from '@/modules/shared/components/ImageZoom.vue';
import { calculateSmartProgression, type ProgressionResult, type ProgressionInput } from '@/utils/progressionCalculator';
import { cachedApiClient } from '@/services/cachedApi';

// Types
interface SetResult {
  setIndex: number;
  reps: number;
}

interface TabataSettings {
  work: number;
  rest: number;
  restBetweenSets: number;
  restBetweenExercises: number;
}

type Phase = 'work' | 'rest' | 'rest_set' | 'rest_exercise' | 'idle';

// Props
const props = defineProps<{
  exercises: ExerciseCard[];
  results: Record<string, number>;
  timerElapsed: number;
}>();

const emit = defineEmits<{
  (e: 'exit'): void;
  (e: 'cancel'): void;
  (e: 'update-result', payload: { key: string; value: number }): void;
  (e: 'complete', payload: { comment: string; results: Record<string, SetResult[]> }): void;
  (e: 'progression-update', payload: { exerciseKey: string | undefined; newLevel: number; newTier: number }): void;
}>();

// State
const currentIndex = ref(0);
const currentSetIndex = ref(0);
const isMinimized = ref(false);
const isTimerRunning = ref(false);
const currentPhase = ref<Phase>('idle');
const phaseRemainingTime = ref(0);
const totalElapsed = ref(0);

// Modal states
const showSettings = ref(false);
const showComment = ref(false);
const showMusicPlayer = ref(false);
const showCloseConfirm = ref(false);
const repsModalOpen = ref(false);
const selectedSetIndex = ref(0);
const showImageZoom = ref(false);
const zoomImageUrl = ref('');
const zoomImageIndex = ref(0);

// Progression state
const showProgression = ref(false);
const progressionResult = ref<ProgressionResult | null>(null);
const currentExerciseLevel = ref(1);
const currentExerciseTier = ref(1);

// Phase 6: Dynamic set addition state
const allTierLevels = ref<ExerciseLevel[]>([]);
const showOptionalSetModal = ref(false);
const optionalSetOffer = ref<OptionalSetOffer | null>(null);
const dynamicSetsAdded = ref(0); // How many sets were added dynamically

// Data
const comment = ref('');
const exerciseResults = ref<Record<string, SetResult[]>>({});

// Voice commands
const voiceEnabled = ref(false);
const isListening = ref(false);

// Music
const isMusicPlaying = ref(false);

// Touch handling for gestures
const touchStartX = ref(0);
const touchStartY = ref(0);

// Settings
const tabataSettings = ref<TabataSettings>({
  work: 45,
  rest: 15,
  restBetweenSets: 90,
  restBetweenExercises: 180
});

// Computed
const currentExercise = computed(() => props.exercises[currentIndex.value]);
const isFirst = computed(() => currentIndex.value === 0);
const isLast = computed(() => currentIndex.value === props.exercises.length - 1);
const orderedExercises = computed(() => props.exercises); // Alias for clarity
const isOvertime = computed(() => phaseRemainingTime.value < 0);

const { width, height } = useWindowSize();
// Original timer size (kept for fallback)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const timerSize = computed(() => {
  // More space now without nav hints
  const heightConstraint = height.value - 260;
  const widthConstraint = width.value - 48;
  return Math.max(220, Math.min(420, widthConstraint, heightConstraint));
});

// Redesign: Large timer for professional look
const timerRingSize = 280; // SVG viewBox size - larger for better visibility
const timerRadius = 122; // Circle radius (280/2 - 18 for stroke)
const timerCircumference = 2 * Math.PI * timerRadius;

const timerProgressOffset = computed(() => {
  const duration = currentPhaseDuration.value;
  const remaining = phaseRemainingTime.value;
  if (duration <= 0) return timerCircumference;
  const progress = Math.max(0, Math.min(1, remaining / duration));
  return timerCircumference * (1 - progress);
});

const getPhaseStatusText = computed(() => {
  const running = isTimerRunning.value;
  switch (currentPhase.value) {
    case 'work': return running ? 'РАБОТА' : 'СТАРТ';
    case 'rest': return 'ОТДЫХ';
    case 'rest_set': return 'ПАУЗА';
    case 'rest_exercise': return 'ДАЛЕЕ';
    case 'idle':
    default: return running ? 'ГОТОВ' : 'СТАРТ';
  }
});

const formattedPhaseTime = computed(() => {
  const seconds = Math.max(0, Math.ceil(phaseRemainingTime.value));
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
});
const currentPhaseDuration = computed(() => {
  switch (currentPhase.value) {
    case 'work': return tabataSettings.value.work;
    case 'rest': return tabataSettings.value.rest;
    case 'rest_set': return tabataSettings.value.restBetweenSets;
    case 'rest_exercise': return tabataSettings.value.restBetweenExercises;
    default: return 0;
  }
});

const currentExerciseImages = computed(() => {
  const ex = currentExercise.value;
  if (!ex) return [];
  // ExerciseImageSource has 'src' property
  return ex.images?.map(img => typeof img === 'string' ? img : img.src) ?? [];
});

const currentExerciseTitle = computed(() => {
  const ex = currentExercise.value;
  if (!ex) return '';
  // User prefers distinct sub-level name (levelTitle) over generic title + level number
  return ex.levelTitle || ex.exerciseTitle || '';
});

const currentCompletedSets = computed(() => {
  const key = currentExercise.value?.key;
  if (!key) return [];
  return exerciseResults.value[key] ?? [];
});

// Total sets including dynamically added ones (Phase 6)
const currentTotalSets = computed(() => {
  const baseSets = currentExercise.value?.sets ?? 0;
  return baseSets + dynamicSetsAdded.value;
});

// Phase 7: Get next exercise level name for tier advancement
const nextExerciseName = computed(() => {
  const exercise = currentExercise.value;
  if (!exercise?.levelCode) return '';
  
  const match = exercise.levelCode.match(/^(\d+)\.(\d+)$/);
  if (!match) return '';
  
  const levelNum = parseInt(match[1], 10);
  const nextLevel = allTierLevels.value.find(l => l.level === `${levelNum + 1}.1`);
  return nextLevel?.title ?? `Уровень ${levelNum + 1}`;
});

const selectedSetReps = computed(() => {
  const sets = currentCompletedSets.value;
  const found = sets.find(s => s.setIndex === selectedSetIndex.value);
  return found?.reps ?? 0;
});

const formattedTotalTime = computed(() => {
  const min = Math.floor(totalElapsed.value / 60).toString().padStart(2, '0');
  const sec = (totalElapsed.value % 60).toString().padStart(2, '0');
  return `${min}:${sec}`;
});

// ===== Phase 6: Dynamic Set Addition Logic =====

// Get tier name based on tier number
const getTierName = (tier: number): string => {
  const names: Record<number, string> = {
    1: 'Начальный',
    2: 'Продвинутый',
    3: 'Профессиональный',
  };
  return names[tier] ?? `Тир ${tier}`;
};

// Parse level code like "1.2" into { levelNum: 1, tierNum: 2 }
const parseLevelCode = (levelCode: string): { levelNum: number; tierNum: number } => {
  const match = levelCode?.match(/^(\d+)\.(\d+)$/);
  if (!match) return { levelNum: 1, tierNum: 1 };
  return { levelNum: parseInt(match[1], 10), tierNum: parseInt(match[2], 10) };
};

// Get tier data from allTierLevels
const getTierData = (levelNum: number, tierNum: number): ExerciseLevel | undefined => {
  return allTierLevels.value.find(l => l.level === `${levelNum}.${tierNum}`);
};

// Get next exercise level data
const getNextLevelData = (nextLevelNum: number): ExerciseLevel | undefined => {
  return allTierLevels.value.find(l => l.level === `${nextLevelNum}.1`);
};

// Fetch all tier levels for current exercise
const fetchTierLevels = async () => {
  const exercise = currentExercise.value;
  if (!exercise?.key) return;
  
  try {
    const response = await cachedApiClient.getExerciseLevels(exercise.key);
    allTierLevels.value = response.items;
    dynamicSetsAdded.value = 0;
  } catch (error) {
    console.error('[FocusSessionView] Failed to fetch tier levels:', error);
    allTierLevels.value = [];
  }
};

// Calculate what tiers are reachable based on Set 1 performance
const calculateReachableTiers = (set1Reps: number): OptionalSetOffer | null => {
  const exercise = currentExercise.value;
  if (!exercise?.levelCode) return null;
  
  const { levelNum, tierNum } = parseLevelCode(exercise.levelCode);
  
  const tier1 = getTierData(levelNum, 1);
  const tier2 = getTierData(levelNum, 2);
  const tier3 = getTierData(levelNum, 3);
  const nextLevel = getNextLevelData(levelNum + 1);
  
  const currentSets = exercise.sets ?? 1;
  
  // Check what per-set goal was met (highest first)
  if (tier3?.reps && set1Reps >= tier3.reps) {
    // Met Профессиональный per-set goal → can reach next exercise level
    const setsToAdd = (tier3.sets ?? 3) - currentSets;
    if (setsToAdd > 0) {
      return {
        targetTier: 'next_level',
        targetName: nextLevel?.title ?? `Уровень ${levelNum + 1}`,
        setsToAdd,
        repsNeeded: tier3.reps,
      };
    }
  }
  
  if (tier2?.reps && set1Reps >= tier2.reps && tierNum < 3) {
    // Met Продвинутый per-set goal → can reach Профессиональный
    const targetSets = tier3?.sets ?? 3;
    const setsToAdd = targetSets - currentSets;
    if (setsToAdd > 0) {
      return {
        targetTier: 3,
        targetName: getTierName(3),
        setsToAdd,
        repsNeeded: tier3?.reps ?? 20,
      };
    }
  }
  
  if (tier1?.reps && set1Reps >= tier1.reps && tierNum < 2) {
    // Met Начальный goal → can reach Продвинутый
    const targetSets = tier2?.sets ?? 2;
    const setsToAdd = targetSets - currentSets;
    if (setsToAdd > 0) {
      return {
        targetTier: 2,
        targetName: 'Продвинутый',
        setsToAdd,
        repsNeeded: tier2?.reps ?? 15,
      };
    }
  }
  
  return null;
};

// Handle optional set modal accept
const handleOptionalSetAccept = (setsToAdd: number) => {
  const exercise = currentExercise.value;
  if (!exercise) return;
  
  // Add dynamic sets to the exercise
  dynamicSetsAdded.value += setsToAdd;
  
  showOptionalSetModal.value = false;
  optionalSetOffer.value = null;
  
  // Move to next set (set 1 since set 0 was just completed)
  currentSetIndex.value = 1;
  
  // Start rest between sets
  currentPhase.value = 'rest_set';
  phaseRemainingTime.value = tabataSettings.value.restBetweenSets;
  
  hapticSuccess();
};

// Phase 7: Handle inline add sets from RepsInputModal
const handleInlineAddSets = (setsToAdd: number) => {
  dynamicSetsAdded.value += setsToAdd;
  hapticSuccess();
  // Modal stays open - user can continue to save after adding sets
};

// Phase 7: Handle remove dynamic set
const handleRemoveDynamicSet = () => {
  if (dynamicSetsAdded.value > 0) {
    dynamicSetsAdded.value--;
    hapticLight();
  }
};

// Handle optional set modal skip - continue with original flow
const handleOptionalSetSkip = () => {
  showOptionalSetModal.value = false;
  optionalSetOffer.value = null;
  
  // Continue with original exercise flow (no extra sets)
  const totalSets = currentExercise.value?.sets ?? 0;
  if (currentSetIndex.value < totalSets - 1) {
    currentSetIndex.value++;
    currentPhase.value = 'rest_set';
    phaseRemainingTime.value = tabataSettings.value.restBetweenSets;
  } else {
    // All sets completed - check progression
    checkExerciseProgression();
  }
  
  hapticLight();
};

// Watch for exercise change to fetch tier levels
watch(() => currentIndex.value, () => {
  fetchTierLevels();
  dynamicSetsAdded.value = 0;
}, { immediate: true });

// ===== End Phase 6 =====

// Timer logic
let timerInterval: ReturnType<typeof setInterval> | null = null;
let totalTimerInterval: ReturnType<typeof setInterval> | null = null;

const startTotalTimer = () => {
  if (totalTimerInterval) return;
  totalTimerInterval = setInterval(() => {
    totalElapsed.value++;
  }, 1000);
};

const stopTotalTimer = () => {
  if (totalTimerInterval) {
    clearInterval(totalTimerInterval);
    totalTimerInterval = null;
  }
};

const startPhaseTimer = () => {
  if (timerInterval) return;
  isTimerRunning.value = true;
  timerInterval = setInterval(() => {
    phaseRemainingTime.value--;
    
    // Overtime haptic
    if (phaseRemainingTime.value < 0 && phaseRemainingTime.value % 5 === 0) {
      hapticWarning();
    }
  }, 1000);
};

const stopPhaseTimer = () => {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  isTimerRunning.value = false;
};

const toggleTimer = () => {
  if (isTimerRunning.value) {
    stopPhaseTimer();
  } else {
    if (currentPhase.value === 'idle') {
      currentPhase.value = 'work';
      phaseRemainingTime.value = tabataSettings.value.work;
    }
    startPhaseTimer();
    startTotalTimer();
  }
  hapticLight();
};

// Navigation
const goToPrevExercise = () => {
  if (!isFirst.value) {
    currentIndex.value--;
    currentSetIndex.value = 0;
    hapticLight();
  }
};

const goToNextExercise = () => {
  if (!isLast.value) {
    currentIndex.value++;
    currentSetIndex.value = 0;
    // Don't change phase - let timer control phase independently
    hapticMedium();
  }
};

// Redesign: Check if exercise is completed (all sets done)
const isExerciseCompleted = (key: string): boolean => {
  const results = exerciseResults.value[key];
  if (!results || results.length === 0) return false;
  const exercise = orderedExercises.value.find(e => e.key === key);
  if (!exercise) return false;
  return results.length >= (exercise.sets ?? 1);
};

// Redesign: Navigate to specific exercise by index
const goToExerciseIndex = (idx: number) => {
  if (idx >= 0 && idx < orderedExercises.value.length) {
    currentIndex.value = idx;
    currentSetIndex.value = 0;
    hapticLight();
  }
};

// Kept for swipe gesture fallback
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const handleNext = () => {
  if (isLast.value) {
    // Complete training
    stopPhaseTimer();
    showComment.value = true;
  } else {
    goToNextExercise();
  }
};

// Reps input
const openRepsInput = (setIndex: number) => {
  selectedSetIndex.value = setIndex;
  repsModalOpen.value = true;
  hapticLight();
};

const handleSaveReps = (payload: { setIndex: number; reps: number }) => {
  const key = currentExercise.value?.key;
  if (!key) return;
  
  if (!exerciseResults.value[key]) {
    exerciseResults.value[key] = [];
  }
  
  const existing = exerciseResults.value[key].findIndex(s => s.setIndex === payload.setIndex);
  if (existing >= 0) {
    exerciseResults.value[key][existing].reps = payload.reps;
  } else {
    exerciseResults.value[key].push(payload);
  }
  
  // Phase 6: Check Set 1 for tier advancement opportunity
  if (payload.setIndex === 0) {
    const offer = calculateReachableTiers(payload.reps);
    if (offer && offer.setsToAdd > 0) {
      optionalSetOffer.value = offer;
      showOptionalSetModal.value = true;
      // Don't proceed to next set yet - wait for modal response
      hapticSuccess();
      return;
    }
  }
  
  // Move to next set
  const totalSets = currentTotalSets.value;
  if (payload.setIndex < totalSets - 1) {
    currentSetIndex.value = payload.setIndex + 1;
    // Start rest between sets
    currentPhase.value = 'rest_set';
    phaseRemainingTime.value = tabataSettings.value.restBetweenSets;
  } else {
    // All sets completed - check progression
    checkExerciseProgression();
  }
  
  // Emit update
  const totalReps = exerciseResults.value[key].reduce((sum, s) => sum + s.reps, 0);
  emit('update-result', { key, value: totalReps });
  
  hapticSuccess();
};

// Check progression after exercise completion
const checkExerciseProgression = () => {
  const exercise = currentExercise.value;
  if (!exercise) return;
  
  const key = exercise.key;
  const results = exerciseResults.value[key] ?? [];
  
  // Parse current level from levelLabel (e.g., "Уровень 1.2" -> level=1, tier=2)
  const levelMatch = exercise.levelLabel?.match(/(\d+)\.(\d+)/);
  const level = levelMatch ? parseInt(levelMatch[1], 10) : 1;
  const tier = levelMatch ? parseInt(levelMatch[2], 10) : 1;
  
  currentExerciseLevel.value = level;
  currentExerciseTier.value = tier;
  
  // Calculate totals
  const actualReps = results.reduce((sum, s) => sum + s.reps, 0);
  const targetReps = exercise.reps;
  const actualSets = results.length;
  const targetSets = exercise.sets;
  
  // Build progression input
  const input: ProgressionInput = {
    currentLevel: level,
    currentTier: tier,
    targetReps,
    actualReps,
    targetSets,
    actualSets,
    // TODO: Get workout history from backend
    workoutHistory: [],
  };
  
  // Calculate progression
  const result = calculateSmartProgression(input);
  
  // Show modal if recommendation is to advance or regress
  if (result.recommendation !== 'stay') {
    progressionResult.value = result;
    showProgression.value = true;
  }
};

// Handle progression acceptance
const handleProgressionAccept = async (result: ProgressionResult) => {
  showProgression.value = false;
  
  const exerciseKey = currentExercise.value?.key;
  if (!exerciseKey) return;
  
  if (result.suggestedLevel && result.suggestedTier) {
    try {
      // Call API to update exercise level in user program
      const { cachedApiClient } = await import('@/services/cachedApi');
      await cachedApiClient.updateExerciseProgression({
        exerciseKey,
        newLevel: result.suggestedLevel,
        newTier: result.suggestedTier,
      });
      
      console.log('[Progression] Saved to backend:', {
        exerciseKey,
        newLevel: result.suggestedLevel,
        newTier: result.suggestedTier,
      });
      
      // Update local state
      currentExerciseLevel.value = result.suggestedLevel;
      currentExerciseTier.value = result.suggestedTier;
      
      // Emit event for parent (in case parent needs to refetch data)
      emit('progression-update', {
        exerciseKey,
        newLevel: result.suggestedLevel,
        newTier: result.suggestedTier,
      });
    } catch (error) {
      console.error('[Progression] Failed to save:', error);
      // Still emit the event so UI reflects the change
      emit('progression-update', {
        exerciseKey,
        newLevel: result.suggestedLevel,
        newTier: result.suggestedTier,
      });
    }
  }
  
  hapticSuccess();
};

// Settings
const handleSaveSettings = (settings: TabataSettings) => {
  tabataSettings.value = settings;
  localStorage.setItem('tabata-settings', JSON.stringify(settings));
};

// Comment
const handleSaveComment = (text: string) => {
  comment.value = text;
  completeTraining();
};

const handleSkipComment = () => {
  completeTraining();
};

const completeTraining = () => {
  stopPhaseTimer();
  stopTotalTimer();
  hapticSuccess();
  emit('complete', { 
    comment: comment.value,
    results: exerciseResults.value
  });
};

// Close
const handleClose = () => {
  showCloseConfirm.value = true;
};

const confirmClose = () => {
  stopPhaseTimer();
  stopTotalTimer();
  emit('cancel');
};

// Minimize/Restore
const appStore = useAppStore();

const minimize = () => {
  isMinimized.value = true;
  appStore.setTrainingMinimized(true);
  hapticLight();
};

const restore = () => {
  isMinimized.value = false;
  appStore.setTrainingMinimized(false);
  hapticLight();
};

// Image zoom
const openImageZoom = (img?: string) => {
  if (img) {
    // Direct image zoom from images panel
    const images = currentExerciseImages.value;
    const index = images.indexOf(img);
    zoomImageUrl.value = img;
    zoomImageIndex.value = index >= 0 ? index : 0;
    showImageZoom.value = true;
  } else {
    // Fallback: zoom first image
    const images = currentExerciseImages.value;
    if (images.length > 0) {
      zoomImageUrl.value = images[0];
      zoomImageIndex.value = 0;
      showImageZoom.value = true;
    }
  }
};

// Voice commands (kept for future voice feature)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const toggleVoice = () => {
  voiceEnabled.value = !voiceEnabled.value;
  isListening.value = voiceEnabled.value;
  hapticLight();
};

// Touch gestures
const handleTouchStart = (e: TouchEvent) => {
  touchStartX.value = e.touches[0].clientX;
  touchStartY.value = e.touches[0].clientY;
};

const handleTouchEnd = (e: TouchEvent) => {
  const deltaX = e.changedTouches[0].clientX - touchStartX.value;
  const deltaY = e.changedTouches[0].clientY - touchStartY.value;
  
  // Horizontal swipe
  if (Math.abs(deltaX) > 80 && Math.abs(deltaY) < 50) {
    if (deltaX > 0) {
      // Swipe right - prev exercise
      goToPrevExercise();
    } else {
      // Swipe left - next exercise
      goToNextExercise();
    }
  }
};

// Lifecycle
onMounted(() => {
  // Load saved settings
  const saved = localStorage.getItem('tabata-settings');
  if (saved) {
    try {
      tabataSettings.value = JSON.parse(saved);
    } catch {}
  }
  
  // Start total timer
  startTotalTimer();
});

onUnmounted(() => {
  stopPhaseTimer();
  stopTotalTimer();
});

// Watch for exercise changes
watch(currentExercise, () => {
  // Reset phase when exercise changes
  if (currentPhase.value !== 'rest_exercise') {
    currentPhase.value = 'idle';
    phaseRemainingTime.value = 0;
  }
});

// Sync totalElapsed with app store for global minimized pill display
watch(totalElapsed, (newVal) => {
  appStore.updateTrainingElapsedTime(newVal);
});

// Listen for global minimized state changes (from global pill click)
watch(() => appStore.isTrainingMinimized, (minimized) => {
  if (!minimized && isMinimized.value) {
    // Global pill was clicked - restore training
    isMinimized.value = false;
  }
});

// Expose methods and state for parent component
defineExpose({
  restore,
  isMinimized
});
</script>

<style scoped>
.focus-session {
  position: fixed;
  inset: 0;
  z-index: 2000; /* High z-index to cover everything */
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
  padding: 16px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
  overflow: hidden; /* Prevent scroll */
}

.focus-session--overtime {
  animation: overtime-bg-pulse 0.5s ease-in-out;
}

@keyframes overtime-bg-pulse {
  0%, 100% { background: var(--color-bg); }
  50% { background: color-mix(in srgb, var(--color-danger) 10%, var(--color-bg)); }
}

/* Header */
.focus-session__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding: 0 4px;
}

/* Redesign: Total Time with Label */
.focus-session__total-time {
  display: flex;
  align-items: center;
  gap: 10px;
}

.total-time__icon {
  color: var(--color-accent);
  opacity: 0.9;
}

.total-time__content {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.total-time__value {
  font-size: 1.25rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-primary);
  line-height: 1.1;
}

.total-time__label {
  font-size: 0.65rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.focus-session__header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.icon-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  backdrop-filter: blur(10px);
}

.icon-btn:active {
  transform: scale(0.95);
  background: rgba(255, 255, 255, 0.1);
}

.icon-btn--danger {
  color: var(--color-danger);
  border-color: rgba(var(--rgb-danger), 0.2);
  background: rgba(var(--rgb-danger), 0.1);
}

/* Ghost style - no background/border */
.icon-btn--ghost {
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
}

.icon-btn--ghost:hover {
  color: var(--color-text-primary);
}

.icon-btn--ghost:active {
  background: rgba(255, 255, 255, 0.05);
}

.icon-btn--voice {
  color: var(--color-text-secondary);
}

.icon-btn--active {
  color: var(--color-accent);
  border-color: var(--color-accent);
  background: rgba(var(--rgb-accent), 0.1);
  animation: voice-pulse 1s ease-in-out infinite;
}

.focus-session__close-btn {
  color: var(--color-danger);
}

.focus-session__voice-btn--active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  animation: voice-pulse 1s ease-in-out infinite;
}

@keyframes voice-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

/* Body */
.focus-session__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start; /* Align content to top */
  overflow: hidden;
  padding-top: 8px;
}

.focus-session__exercise {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  gap: 12px;
  width: 100%;
  max-width: 100%;
  height: 100%;
  min-height: 0;
}

/* Redesign: Horizontal Main Row - Timer Left, Images Right */
.focus-session__main-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  flex: 1;
  min-height: 0;
  padding: 0 8px;
}

/* Redesign: Professional Focus Timer */
.focus-timer {
  position: relative;
  width: 280px;
  height: 280px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.08), transparent 50%),
              linear-gradient(135deg, rgba(255,255,255,0.03), rgba(0,0,0,0.2));
  border: none;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.2s, box-shadow 0.2s;
  box-shadow: 0 8px 32px rgba(0,0,0,0.3),
              inset 0 2px 0 rgba(255,255,255,0.05);
}

.focus-timer:hover {
  transform: scale(1.02);
}

.focus-timer:active {
  transform: scale(0.98);
}

.focus-timer__ring {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.focus-timer__ring-bg {
  fill: none;
  stroke: rgba(255,255,255,0.08);
  stroke-width: 8;
}

.focus-timer__ring-progress {
  fill: none;
  stroke-width: 8;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.3s ease;
}

.focus-timer__ring-progress--work {
  stroke: url(#work-gradient);
  stroke: var(--color-accent);
  filter: drop-shadow(0 0 8px var(--color-accent));
}

.focus-timer__ring-progress--rest,
.focus-timer__ring-progress--rest_set {
  stroke: var(--color-success);
  filter: drop-shadow(0 0 6px var(--color-success));
}

.focus-timer__ring-progress--rest_exercise {
  stroke: var(--color-warning);
  filter: drop-shadow(0 0 6px var(--color-warning));
}

.focus-timer__ring-progress--idle {
  stroke: var(--color-text-muted);
  opacity: 0.5;
}

.focus-timer__content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.focus-timer__status {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-secondary);
  background: rgba(255,255,255,0.05);
  padding: 4px 10px;
  border-radius: 12px;
  backdrop-filter: blur(4px);
}

.focus-timer__status--work {
  color: var(--color-accent);
  background: rgba(var(--rgb-accent), 0.12);
}

.focus-timer__status--rest,
.focus-timer__status--rest_set {
  color: var(--color-success);
  background: rgba(var(--rgb-success), 0.12);
}

.focus-timer__status--rest_exercise {
  color: var(--color-warning);
  background: rgba(var(--rgb-warning), 0.12);
}

.focus-timer__time {
  font-size: 3.5rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-primary);
  line-height: 1;
  text-shadow: 0 2px 8px rgba(0,0,0,0.3);
}

.focus-timer__hint {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  text-transform: lowercase;
  letter-spacing: 0.02em;
  margin-top: 6px;
  opacity: 0.7;
}

/* Redesign: Images Panel */
.focus-session__images-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.images-panel__label {
  font-size: 0.6rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-align: center;
}

.images-panel__grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}

.images-panel__item {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid rgba(255, 255, 255, 0.15);
  cursor: pointer;
  transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
  background: rgba(0, 0, 0, 0.2);
  padding: 0;
}

.images-panel__item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.images-panel__item:hover {
  transform: scale(1.08);
  border-color: var(--color-accent);
}

.images-panel__item:active {
  transform: scale(0.95);
  box-shadow: 0 0 0 4px rgba(var(--rgb-accent), 0.3);
}

/* Redesign: Info Section - Clean and Professional */
.focus-session__info-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  padding: 16px 12px;
}

.focus-session__exercise-info {
  flex: 1;
  min-width: 0;
}

.exercise-info__title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 4px;
  line-height: 1.2;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.exercise-info__targets {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.exercise-info__target-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.exercise-info__target-item svg {
  opacity: 0.7;
}

.exercise-info__separator {
  color: var(--color-text-muted);
}

.focus-session__sets-progress {
  flex-shrink: 0;
}

.focus-session__exercise-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 2px;
  /* Allow 2 lines max */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-align: center;
  line-height: 1.3;
}

.focus-session__exercise-targets {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  text-align: center;
}

/* Navigation hints */
.focus-session__nav-hints {
  display: flex;
  justify-content: space-between;
  width: 100%;
  padding: 0 16px;
}

.nav-hint {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  max-width: 40%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Footer */
.focus-session__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-top: 12px;
  width: 100%;
}

/* Redesign: Footer Music Button */
.footer-music-btn {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.footer-music-btn--playing {
  color: var(--color-accent);
  border-color: rgba(var(--rgb-accent), 0.3);
  background: rgba(var(--rgb-accent), 0.1);
  animation: music-pulse 2s ease-in-out infinite;
}

@keyframes music-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(var(--rgb-accent), 0.3); }
  50% { box-shadow: 0 0 0 6px rgba(var(--rgb-accent), 0); }
}

.footer-music-btn:active {
  transform: scale(0.95);
}

/* Redesign: Exercise Stepper with Icons */
.exercise-stepper {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  justify-content: flex-end;
}

.exercise-stepper__item {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.15);
  background: rgba(255,255,255,0.03);
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.25s ease;
  position: relative;
  overflow: hidden;
}

.exercise-stepper__item::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.1), transparent);
  opacity: 0;
  transition: opacity 0.2s;
}

.exercise-stepper__item:hover::before {
  opacity: 1;
}

/* Connecting lines between items */
.exercise-stepper__item:not(:last-child)::after {
  content: '';
  position: absolute;
  right: -6px;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 2px;
  background: rgba(255,255,255,0.2);
  border-radius: 1px;
}

/* Current exercise item */
.exercise-stepper__item--current {
  border-color: var(--color-accent);
  background: rgba(var(--rgb-accent), 0.15);
  box-shadow: 0 0 0 4px rgba(var(--rgb-accent), 0.2),
              0 4px 12px rgba(var(--rgb-accent), 0.3);
  animation: current-item-pulse 2s ease-in-out infinite;
}

.exercise-stepper__item--current::after {
  background: var(--color-accent);
}

@keyframes current-item-pulse {
  0%, 100% { box-shadow: 0 0 0 4px rgba(var(--rgb-accent), 0.2), 0 4px 12px rgba(var(--rgb-accent), 0.3); }
  50% { box-shadow: 0 0 0 8px rgba(var(--rgb-accent), 0.1), 0 4px 16px rgba(var(--rgb-accent), 0.4); }
}

/* Completed exercise item */
.exercise-stepper__item--completed {
  border-color: var(--color-success);
  background: rgba(var(--rgb-success), 0.2);
}

.exercise-stepper__item--completed::after {
  background: var(--color-success);
}

/* Upcoming exercise item */
.exercise-stepper__item--upcoming {
  opacity: 0.4;
}

.exercise-stepper__item:active {
  transform: scale(0.9);
}

/* Icon inside stepper */
.exercise-stepper__icon {
  width: 28px;
  height: 28px;
  object-fit: contain;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
}

.exercise-stepper__item--completed .exercise-stepper__icon {
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3)) brightness(1.1);
}

.exercise-stepper__item--upcoming .exercise-stepper__icon {
  filter: grayscale(0.5) opacity(0.6);
}

/* Fallback number */
.exercise-stepper__number {
  font-size: 0.8rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-secondary);
}

.exercise-stepper__item--current .exercise-stepper__number {
  color: var(--color-accent);
}

.exercise-stepper__item--completed .exercise-stepper__number {
  color: var(--color-success);
}

/* Completion */
.focus-session__completion {
  text-align: center;
  padding: 32px;
}

.completion-icon {
  font-size: 4rem;
  margin-bottom: 16px;
}

.completion-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 8px;
}

.completion-subtitle {
  color: var(--color-text-secondary);
  margin: 0 0 24px;
}

.completion-btn {
  padding: 16px 32px;
  border-radius: 16px;
  border: none;
  background: var(--color-accent);
  color: white;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}

/* Minimized Tab */
/* Minimized Pill - vertical on left edge */
.minimized-pill {
  position: fixed;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1001;
  cursor: pointer;
}

.minimized-pill__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 10px;
  background: rgba(30, 30, 30, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-left: none;
  border-radius: 0 16px 16px 0;
  box-shadow: 4px 0 20px rgba(0, 0, 0, 0.4);
  color: var(--color-text-primary);
  transition: transform 0.2s;
  writing-mode: vertical-rl;
  text-orientation: mixed;
}

.minimized-pill:active .minimized-pill__content {
  transform: scale(0.96);
}

.minimized-pill__time {
  font-size: 0.9rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-primary);
}

.minimized-pill__icon {
  color: var(--color-accent);
}

/* Image Zoom */
.image-zoom-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
}

.image-zoom__image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 8px;
}

/* Confirm modal */
.confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.confirm-modal {
  background: var(--color-bg-elevated);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  padding: 24px;
  text-align: center;
  max-width: 320px;
}

.confirm-modal h3 {
  margin: 0 0 8px;
  color: var(--color-text-primary);
}

.confirm-modal p {
  margin: 0 0 24px;
  color: var(--color-text-secondary);
  font-size: 0.875rem;
}

.confirm-actions {
  display: flex;
  gap: 12px;
}

.confirm-btn {
  flex: 1;
  padding: 12px;
  border-radius: 12px;
  border: none;
  font-weight: 600;
  cursor: pointer;
}

.confirm-btn--cancel {
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
}

.confirm-btn--confirm {
  background: var(--color-danger);
  color: white;
}

/* Transitions */
.focus-slide-enter-active,
.focus-slide-leave-active {
  transition: transform 0.4s ease;
}

/* Both enter and leave use same direction - from/to left */
.focus-slide-enter-from,
.focus-slide-leave-to {
  transform: translateX(-100%);
}

.tab-slide-enter-active,
.tab-slide-leave-active {
  transition: transform 0.3s ease;
}

.tab-slide-enter-from,
.tab-slide-leave-to {
  transform: translateX(-100%);
}

.exercise-slide-enter-active,
.exercise-slide-leave-active {
  transition: all 0.3s ease;
}

.exercise-slide-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.exercise-slide-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.25s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
