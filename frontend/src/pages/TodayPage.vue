<template>
  <div class="today-page">
    <!-- Background -->
    <div class="today-bg">
      <div class="today-bg__grid"></div>
      <div class="today-bg__glow today-bg__glow--1"></div>
      <div class="today-bg__glow today-bg__glow--2"></div>
    </div>

    <!-- Header -->
    <header class="today-header">
      <h1 class="today-title">Сегодня</h1>
    </header>


    <!-- Calendar - uses its own surface-card styling -->
    <DaySwitcher :date="selectedDate" @update:date="handleDateChange" class="today-calendar" />

    <!-- Program info and action button -->
    <div v-if="hasProgram && !isBeforeProgramStart && !showHistoricalPlaceholder && !isRestDay" class="today-action-bar">
      <div class="action-bar__content">
        <span class="action-bar__discipline">{{ userProgram?.discipline?.name }}</span>
        <span class="action-bar__divider">•</span>
        <span class="action-bar__program">{{ userProgram?.program?.name }}</span>
      </div>
      <!-- Приступить кнопка - только когда тренировка не начата -->
      <BaseButton
        v-if="!trainingStarted && !isTrainingDone"
        variant="primary"
        size="sm"
        class="action-bar__cta"
        @click="handleStartTraining"
      >
        Приступить
      </BaseButton>
      <!-- Активно кнопка - когда тренировка в процессе, нажатие открывает режим тренировки -->
      <BaseButton
        v-else-if="trainingStarted && !isTrainingDone"
        variant="secondary"
        size="sm"
        class="action-bar__cta action-bar__cta--active"
        @click="openFocusMode"
      >
        <span class="cta-pulse"></span>
        Активно
      </BaseButton>
      <!-- Завершено - когда тренировка сохранена -->
      <div v-else-if="isTrainingDone" class="action-bar__done-group">
        <span class="action-bar__status action-bar__status--done">
          ✓ Сохранено
        </span>
        <button 
          class="action-bar__edit-btn"
          @click="handleEditTraining"
          aria-label="Редактировать тренировку"
        >
          ✏️
        </button>
      </div>
    </div>



    <!-- Scrollable Main Content -->
    <main class="today-main">
      <section v-if="loading || !initialLoadComplete || !programContextReady" class="today-panel" data-animate="fade-up">
        <TodaySkeleton />
      </section>

      <section v-else-if="error" class="today-panel" data-animate="fade-up">
        <ErrorState :message="errorMessage" @retry="reloadAll" />
      </section>

      <section v-else class="today-content">
        <BaseCard
          v-if="!hasProgram"
          class="training-placeholder"
          hoverable
          data-animate="scale-in"
        >
          <template #header>
            <h2 class="training-placeholder__title">Настрой свою тренировку</h2>
          </template>
          <p class="training-placeholder__message">
            {{ trainingHint }}
          </p>
          <BaseButton variant="primary" @click="goToPrograms">
            Перейти к программам
          </BaseButton>
        </BaseCard>

        <BaseCard
          v-else-if="isBeforeProgramStart"
          class="training-placeholder"
          hoverable
          data-animate="scale-in"
        >
          <template #header>
            <h2 class="training-placeholder__title">Программа скоро начнется</h2>
          </template>
          <p class="training-placeholder__message">
            Тренировки начнутся {{ programStartLabel }}. Отдохни и наберись сил!
          </p>
          <BaseButton variant="secondary" @click="goToPrograms">
            Открыть программу
          </BaseButton>
        </BaseCard>

        <BaseCard
          v-else-if="userProgram && showHistoricalPlaceholder"
          class="training-placeholder"
          flat
          data-animate="scale-in"
        >
          <template #header>
            <h2 class="training-placeholder__title">Историческая тренировка</h2>
          </template>
          <p class="training-placeholder__message">
            Эта тренировка уже завершена. Вы можете просмотреть ее результаты.
          </p>
        </BaseCard>


        <div v-else class="today-stage" data-animate="scale-in">

          <p v-if="sessionSourceHint" class="session-source-hint" role="status">
            {{ sessionSourceHint }}
          </p>

          <!-- Simplified: Only show TodayWorkoutPanel, removed stage-nav tabs -->
          <TodayWorkoutPanel
            :show-historical-placeholder="showHistoricalPlaceholder"
            :is-rest-day="isRestDay"
            :exercise-cards="exerciseCards"
            :missing-exercises="missingExercises"
            :exercise-results="exerciseResults"
            :is-spark-active="isSparkActive"
          />
        </div>
      </section>
    </main>

    <DailyAdviceModal
      :is-open="adviceModalOpen"
      :date="formatDate(selectedDate)"
      @close="adviceModalOpen = false"
    />
    <div
      v-if="timerFocusMode"
      class="today-page__focus-overlay"
      role="presentation"
      @click="disableFocusMode"
    ></div>

    <FocusSessionView
      v-if="appStore.isFocusMode"
      ref="focusSessionRef"
      :exercises="exerciseCards"
      :results="exerciseResults"
      :timer-elapsed="tabataElapsed"
      @exit="appStore.toggleFocusMode"
      @cancel="handleCancelTraining"
      @update-result="handleFocusUpdateResult"
      @complete="handleFocusComplete"
    />

    <!-- Completion Watermark -->
    <Transition name="checkmark-fade">
      <div v-if="trainingCompleted && !appStore.isFocusMode" class="completion-watermark">
        <svg class="completion-watermark__icon" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="45" stroke="currentColor" stroke-width="3" stroke-opacity="0.3"/>
          <path d="M30 52 L45 67 L70 35" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </Transition>
  </div>
</template>

<script lang="ts">
import { computed, defineAsyncComponent, defineComponent, onMounted, ref, watch } from 'vue';
import { format, isSameDay } from 'date-fns';
import { useRouter } from 'vue-router';
import { useAppStore } from '@/stores/app';
import ErrorHandler from '@/services/errorHandler';
import { cachedApiClient as apiClient } from '@/services/cachedApi';
import { useInstantFeedback } from '@/services/instantFeedback';
import { createInteractionGuard } from '@/services/interactionGuard';
import { useTodaySession } from '@/composables/useTodaySession';
import { useWorkoutTimer } from '@/composables/useWorkoutTimer';
import type { StageId } from '@/types/today';
// evaluateResultStatus imported but used elsewhere
import { hapticMedium, hapticSuccess } from '@/utils/hapticFeedback';
import { useSessionPersistence } from '@/composables/today/useSessionPersistence';

// Import TodaySkeleton synchronously to prevent white flash
import TodaySkeleton from '@/modules/today/components/TodaySkeleton.vue';

// Critical components - sync import to prevent skeleton interruption
import BaseCard from '@/components/ui/BaseCard.vue';
import DaySwitcher from '@/modules/today/components/DaySwitcher.vue';
import TodayWorkoutPanel from '@/modules/today/components/TodayWorkoutPanel.vue';
import BaseButton from '@/components/ui/BaseButton.vue';

// Explicit Async Imports for non-critical components
const loadComponent = (name: string, loader: () => Promise<any>) => defineAsyncComponent({
  loader: async () => {
    try {
      return await loader();
    } catch (e) {
      console.error(`Failed to load component ${name}`, e);
      throw e;
    }
  }
});

export default defineComponent({
  name: 'TodayPage',
  components: {
    BaseCard, // Sync - critical for empty state
    DaySwitcher, // Sync - always visible
    TodaySkeleton, // Sync - critical for loading
    TodayWorkoutPanel, // Sync - main content
    BaseButton, // Sync - action bar
    ErrorState: loadComponent('ErrorState', () => import('@/modules/shared/components/ErrorState.vue')),
    TodayTimerPanel: loadComponent('TodayTimerPanel', () => import('@/modules/today/components/TodayTimerPanel.vue')),
    TodayResultsPanel: loadComponent('TodayResultsPanel', () => import('@/modules/today/components/TodayResultsPanel.vue')),
    FocusSessionView: loadComponent('FocusSessionView', () => import('@/components/training/FocusSessionView.vue')),
    DailyAdviceModal: loadComponent('DailyAdviceModal', () => import('@/modules/shared/components/DailyAdviceModal.vue')),
    NeonIcon: defineAsyncComponent(() => import('@/modules/shared/components/NeonIcon.vue')),
  },
  setup() {
    const router = useRouter();
    const appStore = useAppStore();
    const instantFeedback = useInstantFeedback();
    const interactionGuard = createInteractionGuard({ cooldownMs: 900 });

    const {
      selectedDate, loading, initialLoadComplete, programContextReady, error, session, sessionSource, userProgram,
      exercisePreparation, hasProgram, isTrainingDay, isRestDay,
      showHistoricalPlaceholder, isBeforeProgramStart, programStartLabel,
      handleDateChange, reloadAll, syncSession: _syncSession, applyOptimisticSessionUpdate: _applyOptimisticSessionUpdate, ensureSession
    } = useTodaySession();

    const {
      timerSettings, tabataElapsed, timerFocusMode,
      toggleFocusMode: _toggleFocusMode, disableFocusMode, isSparkActive,
    } = useWorkoutTimer();

    const exerciseCards = computed(() => exercisePreparation.value.cards);
    const missingExercises = computed(() => exercisePreparation.value.missing);
    const trainingStarted = ref(false);
    const trainingCompleted = ref(false);
    const activeStage = ref<StageId>('workout');
    const summaryComment = ref('');
    const exerciseResults = ref<Record<string, number>>({});
    const saving = ref(false);
    const adviceModalOpen = ref(false);
    const trainingHint = ref('Добавь подходящую программу и настрой расписание под свой режим.');
    const focusSessionRef = ref<{ restore: () => void; isMinimized: { value: boolean } } | null>(null);

    const isoDate = computed(() => format(selectedDate.value, 'yyyy-MM-dd'));
    const storageKey = computed(() => {
      const pid = hasProgram.value ? (userProgram.value?.id || userProgram.value?.program?.id) : 'noprog';
      return `tzona-training-${pid}-${isoDate.value}`;
    });

    const { savePersistedState, loadPersistedState } = useSessionPersistence({
      storageKey, session, loading, trainingStarted, trainingCompleted,
      activeStage, summaryComment, exerciseResults, timerSettings, tabataElapsed
    });

    // Removed stageNav, setStageButtonRef, handleStageKeydown, setStage - not used after UI simplification

    const primaryExerciseTitle = computed(() => exerciseCards.value[0]?.levelLabel ?? 'Упражнение');
    const errorMessage = computed(() => (error.value as any)?.message || 'Произошла ошибка при загрузке данных');
    const formatDate = (date: Date) => format(date, 'yyyy-MM-dd');

    const statusLabel = computed(() => {
      if (trainingCompleted.value) return 'Завершено';
      if (trainingStarted.value) return 'Активно';
      if (showHistoricalPlaceholder.value) return 'В прошлом';
      return '';
    });

    // Check if selected date is today
    const isToday = computed(() => isSameDay(selectedDate.value, new Date()));
    
    // Session status from API
    const sessionStatus = computed(() => session.value?.status ?? 'pending');
    
    // Training state computed properties for button visibility
    const isTrainingDone = computed(() => {
      return sessionStatus.value === 'done' || trainingCompleted.value;
    });

    const sessionSourceHint = computed(() => sessionSource.value === 'program_plan' ? 'Автоматический план' : null);

    const postWorkoutSuggestions = computed(() => []); // Simplified for brevity

    const goToPrograms = () => router.push('/programs');

    const initializeHeroBadge = () => {
      appStore.setHeroBadge((!hasProgram.value || !isTrainingDay.value || showHistoricalPlaceholder.value) ? '--' : format(selectedDate.value, 'dd'));
    };

    const updateHeroState = () => {
      appStore.setHeroStatus((hasProgram.value && isSameDay(selectedDate.value, new Date()) && trainingStarted.value && !trainingCompleted.value) ? 'training' : null);
    };

    const handleStartTraining = async () => {
      await interactionGuard.run('start-training', async () => {
        hapticMedium();
        trainingStarted.value = true;
        tabataElapsed.value = 0;
        activeStage.value = 'workout';
        try {
          await ensureSession('in_progress');
          instantFeedback.signalSuccess({ title: 'Тренировка', message: 'Сессия создана' });
          // Open focus mode immediately
          openFocusMode();
        } catch (err) {
          trainingStarted.value = false;
          ErrorHandler.handleWithToast(err, 'TodayPage.startTraining');
        }
        updateHeroState();
        savePersistedState({ immediate: true });
      });
    };

    const handleCompleteTraining = async () => {
      if (!hasProgram.value || saving.value) {
        return;
      }
      await interactionGuard.run('complete-training', async () => {
        saving.value = true;
        try {
          hapticSuccess();
          const sessionId = await ensureSession('done');
          const payload = {
             status: 'done',
             notes: JSON.stringify({
               comment: summaryComment.value,
               date: isoDate.value,
               timer: { ...timerSettings.value, elapsedSeconds: tabataElapsed.value },
               trainingStarted: true,
               trainingCompleted: true
             })
          };
          await apiClient.updateSession(sessionId, payload as any);
          
          trainingCompleted.value = true;
          trainingStarted.value = false;
          savePersistedState({ immediate: true });
          updateHeroState();
          // Close focus mode if open
          if (appStore.isFocusMode) {
            appStore.toggleFocusMode();
          }
          instantFeedback.signalSuccess({ title: '\u0413\u043e\u0442\u043e\u0432\u043e', message: '\u0422\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043a\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0430' });
        } catch (err) {
          ErrorHandler.handleWithToast(err, 'TodayPage.complete');
        } finally {
          saving.value = false;
        }
      });
    };

    const handleFocusUpdateResult = (p: { key: string; value: number }) => { exerciseResults.value = { ...exerciseResults.value, [p.key]: p.value }; };
    const handleFocusComplete = () => { 
      handleCompleteTraining(); 
    };
    const openFocusMode = () => {
      hapticMedium();
      // If already in focus mode, restore from minimized state
      if (appStore.isFocusMode && focusSessionRef.value?.isMinimized?.value) {
        focusSessionRef.value.restore();
      } else if (!appStore.isFocusMode) {
        appStore.toggleFocusMode();
      }
    };
    const handleEditTraining = () => {
      hapticMedium();
      // Reopen training for editing
      trainingCompleted.value = false;
      trainingStarted.value = true;
      activeStage.value = 'results';
      instantFeedback.signalSuccess({ title: 'Редактирование', message: 'Откройте результаты' });
    };

    const handleCancelTraining = async () => {
      hapticMedium();
      appStore.toggleFocusMode();
      
      // Reset local state
      trainingStarted.value = false;
      trainingCompleted.value = false;
      activeStage.value = 'workout';
      exerciseResults.value = {};
      
      // Clear persistence
      const { clearPersistedState } = useSessionPersistence({
        storageKey, session, loading, trainingStarted, trainingCompleted,
        activeStage, summaryComment, exerciseResults, timerSettings, tabataElapsed
      });
      clearPersistedState();
      
      instantFeedback.signalSuccess({ title: 'Отменено', message: 'Сессия сброшена' });
    };

    watch(selectedDate, async (date) => { await handleDateChange(date); initializeHeroBadge(); updateHeroState(); loadPersistedState(); });
    watch([hasProgram, isTrainingDay, showHistoricalPlaceholder], () => initializeHeroBadge());
    
    onMounted(() => loadPersistedState());

    return {
      appStore, selectedDate, loading, initialLoadComplete, programContextReady, error, errorMessage, userProgram, hasProgram,
      isBeforeProgramStart, programStartLabel, showHistoricalPlaceholder, trainingHint,
      trainingStarted, trainingCompleted, statusLabel, isRestDay, sessionSourceHint,
      isToday, isTrainingDone, timerFocusMode, focusSessionRef,
      handleDateChange, reloadAll, goToPrograms, formatDate, primaryExerciseTitle,
      handleCompleteTraining, handleStartTraining, handleEditTraining, handleCancelTraining,
      handleFocusUpdateResult, handleFocusComplete, openFocusMode, disableFocusMode,
      exerciseCards, missingExercises, exerciseResults, summaryComment, saving,
      postWorkoutSuggestions, isSparkActive, adviceModalOpen, tabataElapsed
    };
  }
});
</script>

<style scoped>
/* Page Layout - Fixed Header, Scrollable Content */
.today-page {
  position: fixed;
  inset: var(--header-height, 60px) 0 calc(var(--footer-height, 64px) + env(safe-area-inset-bottom)) 0;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
  overflow: hidden;
}

.today-page--focus {
  z-index: 200;
  inset: 0;
  background: black;
}

/* Background */
.today-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}
.today-bg__grid {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
  background-size: 28px 28px;
}
.today-bg__glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.25;
}
.today-bg__glow--1 { width: 180px; height: 180px; top: -40px; right: -20px; background: var(--color-accent); }
.today-bg__glow--2 { width: 140px; height: 140px; bottom: 25%; left: -30px; background: #a855f7; }

/* Header */
.today-header {
  position: relative;
  z-index: 10;
  text-align: center;
  padding: 0.5rem 1rem 0.3rem;
  flex-shrink: 0;
  /* background: rgba(var(--rgb-bg), 0.8); backdrop-filter: blur(10px); */
}
.today-title {
  font-size: 1.3rem;
  font-weight: 800;
  margin: 0;
  color: var(--color-text-primary);
}

/* Calendar - spacing */
.today-calendar {
  margin: 0.25rem 0.75rem;
  flex-shrink: 0;
}

/* Action Bar - full width, no container */
.today-action-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
}

.action-bar__content {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.action-bar__discipline {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.action-bar__divider {
  font-size: 0.5rem;
  color: rgba(255, 255, 255, 0.3);
}

.action-bar__program {
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--color-accent);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.action-bar__cta {
  font-weight: 600;
  font-size: 0.8rem;
  padding: 0.4rem 1rem;
}

.action-bar__status {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-text-secondary);
}

.action-bar__status[data-complete="true"] {
  color: var(--color-success);
  background: rgba(var(--rgb-success), 0.12);
}

.action-bar__status--disabled {
  color: var(--color-text-muted);
  background: rgba(255, 255, 255, 0.03);
  font-style: italic;
}

/* Main Content */
.today-main {
  position: relative;
  z-index: 1;
  flex: 1;
  padding: 0.5rem 1rem 1rem;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  max-width: 640px;
  width: 100%;
  margin: 0 auto;
}
.today-main::-webkit-scrollbar { width: 0; height: 0; background: transparent; }

.today-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Styles for internal components */
.training-placeholder { text-align: center; padding: 2.5rem 1.5rem; }
.training-placeholder__title { font-size: 1.15rem; font-weight: 600; margin-bottom: 0.5rem; }
.training-placeholder__message { font-size: 0.9rem; color: var(--color-text-secondary); margin-bottom: 1.5rem; }

.today-stage { display: flex; flex-direction: column; gap: 1rem; }

.training-day-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.8rem 1rem;
  background: rgba(255,255,255,0.03);
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.06);
}
.training-day-header__info { display: flex; flex-direction: column; }
.training-day-header__program { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: var(--color-accent); letter-spacing: 0.05em; }
.training-day-header__discipline { font-size: 0.95rem; font-weight: 600; }
.training-day-header__status { font-size: 0.8rem; padding: 0.2rem 0.6rem; border-radius: 6px; background: rgba(255,255,255,0.05); color: var(--color-text-secondary); }
.training-day-header__status[data-complete="true"] { color: var(--color-success); background: rgba(var(--rgb-success), 0.1); }
.training-day-header__cta { font-weight: 600; padding: 0.4rem 1rem; font-size: 0.85rem; }

.session-source-hint { font-size: 0.75rem; color: var(--color-text-tertiary); text-align: center; margin-top: -0.5rem; }

.stage-nav {
  display: grid; grid-template-columns: 1fr 1fr 1fr;
  padding: 0.25rem;
  background: rgba(255,255,255,0.03);
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.06);
  gap: 0.25rem;
}
.stage-nav__tab {
  padding: 0.5rem;
  border-radius: 8px;
  font-weight: 600; font-size: 0.85rem;
  color: var(--color-text-secondary);
  background: transparent; border: none;
  cursor: pointer; transition: all 0.2s;
}
.stage-nav__tab:hover { background: rgba(255,255,255,0.05); color: var(--color-text-primary); }
.stage-nav__tab--active { background: rgba(255,255,255,0.08); color: var(--color-text-primary); box-shadow: 0 1px 4px rgba(0,0,0,0.1); }

.today-page__focus-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); z-index: 150; }

/* Active button with pulse animation */
.action-bar__cta--active {
  position: relative;
  background: linear-gradient(135deg, var(--color-accent), var(--color-success));
  color: white;
  font-weight: 700;
  overflow: hidden;
}

.cta-pulse {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: rgba(255, 255, 255, 0.3);
  animation: cta-pulse-anim 1.5s ease-in-out infinite;
  pointer-events: none;
}

@keyframes cta-pulse-anim {
  0%, 100% { transform: scale(1); opacity: 0.3; }
  50% { transform: scale(1.05); opacity: 0; }
}

/* Completion status done */
.action-bar__status--done {
  color: var(--color-success);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

/* Completion Watermark */
.completion-watermark {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 50;
}

.completion-watermark__icon {
  width: 180px;
  height: 180px;
  color: var(--color-success);
  opacity: 0.15;
  animation: watermark-appear 0.6s ease-out;
}

@keyframes watermark-appear {
  0% { transform: scale(0.5); opacity: 0; }
  50% { transform: scale(1.1); opacity: 0.2; }
  100% { transform: scale(1); opacity: 0.15; }
}

/* Checkmark fade transition */
.checkmark-fade-enter-active {
  transition: opacity 0.4s, transform 0.4s;
}
.checkmark-fade-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}
.checkmark-fade-enter-from {
  opacity: 0;
  transform: scale(0.5);
}
.checkmark-fade-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

/* Active Button Style - Distinct from primary */
.action-bar__cta--active {
  background: rgba(255, 255, 255, 0.15) !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  color: var(--color-text-primary) !important;
  box-shadow: none !important;
}

.action-bar__cta--active:active {
  transform: scale(0.98);
}

/* Done group with edit button */
.action-bar__done-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.action-bar__edit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-text-secondary);
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.action-bar__edit-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: var(--color-accent);
  transform: scale(1.05);
}
</style>
