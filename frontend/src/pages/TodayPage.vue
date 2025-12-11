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

    <!-- Fixed Controls (DaySwitcher) -->
    <div class="today-controls">
      <DaySwitcher :date="selectedDate" @update:date="handleDateChange" />
    </div>

    <!-- Scrollable Main Content -->
    <main class="today-main">
      <section v-if="loading" class="today-panel" data-animate="fade-up">
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
          <header
            class="training-day-header interactive-card gradient-outline gradient-outline--accent"
            data-animate="fade-up"
          >
            <div class="training-day-header__info">
              <span class="training-day-header__program">{{ userProgram?.program?.name }}</span>
              <span class="training-day-header__discipline">{{ userProgram?.discipline?.name }}</span>
            </div>
            <BaseButton
              v-if="!trainingStarted && !trainingCompleted && !showHistoricalPlaceholder && !isRestDay"
              variant="primary"
              class="training-day-header__cta"
              @click="handleStartTraining"
            >
              Приступить
            </BaseButton>
            <span v-else class="training-day-header__status" :data-complete="trainingCompleted">
              {{ statusLabel }}
            </span>
            <BaseButton
              v-if="trainingStarted && !trainingCompleted"
              variant="ghost" 
              size="sm"
              class="focus-mode-trigger"
              @click="appStore.toggleFocusMode"
              title="Focus Mode"
            >
              <NeonIcon name="maximize" size="20" />
            </BaseButton>
          </header>

          <p v-if="sessionSourceHint" class="session-source-hint" role="status">
            {{ sessionSourceHint }}
          </p>

          <nav
            class="stage-nav gradient-outline gradient-outline--soft"
            aria-label="Шаги тренировки"
            role="tablist"
            data-animate="fade-up"
          >
            <button
              v-for="stage in stageNav"
              :key="stage.id"
              type="button"
              class="stage-nav__tab"
              :class="{
                'stage-nav__tab--active': activeStage === stage.id,
                'stage-nav__tab--locked': isStageLocked(stage.id)
              }"
              @click="setStage(stage.id)"
              :ref="setStageButtonRef"
            >
              {{ stage.label }}
            </button>
          </nav>

          <TodayWorkoutPanel
            v-if="activeStage === 'workout'"
            :show-historical-placeholder="showHistoricalPlaceholder"
            :is-rest-day="isRestDay"
            :exercise-cards="exerciseCards"
            :missing-exercises="missingExercises"
            :exercise-results="exerciseResults"
            :is-spark-active="isSparkActive"
          />

          <TodayTimerPanel
            v-else-if="activeStage === 'timer'"
            :is-locked="!trainingStarted && !trainingCompleted"
            :primary-exercise-title="primaryExerciseTitle"
            :settings="timerSettings"
            :focus-mode="timerFocusMode"
            :has-prev="hasPrevExercise"
            :has-next="hasNextExercise"
            @update:settings="updateTimerSettings"
            @time-update="updateTimerElapsed"
            @session-complete="handleCompleteTraining"
            @toggle-focus="appStore.toggleFocusMode"
            @prev-exercise="handlePrevExercise"
            @next-exercise="handleNextExercise"
          />

          <TodayResultsPanel
            v-else
            :is-locked="!trainingStarted && !trainingCompleted"
            :exercise-cards="exerciseCards"
            :exercise-results="exerciseResults"
            @update:exercise-results="exerciseResults = $event"
            :summary-comment="summaryComment"
            @update:summary-comment="summaryComment = $event"
            :saving="saving"
            :post-workout-suggestions="postWorkoutSuggestions"
            :is-spark-active="isSparkActive"
            @complete-training="handleCompleteTraining"
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
      :exercises="exerciseCards"
      :results="exerciseResults"
      :timer-elapsed="tabataElapsed"
      @exit="appStore.toggleFocusMode"
      @update-result="handleFocusUpdateResult"
      @complete="handleFocusComplete"
    />
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
import { evaluateResultStatus } from '@/utils/resultLogic';
import { hapticMedium, hapticSuccess } from '@/utils/hapticFeedback';
import { useSessionPersistence } from '@/composables/today/useSessionPersistence';
import { useStageNavigation } from '@/composables/today/useStageNavigation';

// Explicit Async Imports to prevent circular dependency issues
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
    BaseCard: loadComponent('BaseCard', () => import('@/components/ui/BaseCard.vue')),
    DaySwitcher: loadComponent('DaySwitcher', () => import('@/modules/today/components/DaySwitcher.vue')),
    TodaySkeleton: loadComponent('TodaySkeleton', () => import('@/modules/today/components/TodaySkeleton.vue')),
    ErrorState: loadComponent('ErrorState', () => import('@/modules/shared/components/ErrorState.vue')),
    TodayWorkoutPanel: loadComponent('TodayWorkoutPanel', () => import('@/modules/today/components/TodayWorkoutPanel.vue')),
    TodayTimerPanel: loadComponent('TodayTimerPanel', () => import('@/modules/today/components/TodayTimerPanel.vue')),
    TodayResultsPanel: loadComponent('TodayResultsPanel', () => import('@/modules/today/components/TodayResultsPanel.vue')),
    FocusSessionView: loadComponent('FocusSessionView', () => import('@/components/training/FocusSessionView.vue')),
    DailyAdviceModal: loadComponent('DailyAdviceModal', () => import('@/modules/shared/components/DailyAdviceModal.vue')),
    BaseButton: defineAsyncComponent(() => import('@/components/ui/BaseButton.vue')),
    NeonIcon: defineAsyncComponent(() => import('@/modules/shared/components/NeonIcon.vue')),
  },
  setup() {
    const router = useRouter();
    const appStore = useAppStore();
    const instantFeedback = useInstantFeedback();
    const interactionGuard = createInteractionGuard({ cooldownMs: 900 });

    const {
      selectedDate, loading, error, session, sessionSource, userProgram,
      exercisePreparation, hasProgram, isTrainingDay, isRestDay,
      showHistoricalPlaceholder, isBeforeProgramStart, programStartLabel,
      handleDateChange, reloadAll, syncSession, applyOptimisticSessionUpdate, ensureSession
    } = useTodaySession();

    const {
      timerSettings, tabataElapsed, timerFocusMode, updateTimerSettings, updateTimerElapsed,
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

    const isoDate = computed(() => format(selectedDate.value, 'yyyy-MM-dd'));
    const storageKey = computed(() => {
      const pid = hasProgram.value ? (userProgram.value?.id || userProgram.value?.program?.id) : 'noprog';
      return `tzona-training-${pid}-${isoDate.value}`;
    });

    const { savePersistedState, loadPersistedState } = useSessionPersistence({
      storageKey, session, loading, trainingStarted, trainingCompleted,
      activeStage, summaryComment, exerciseResults, timerSettings, tabataElapsed
    });

    const { stageNav, setStageButtonRef, handleStageKeydown, setStage } = useStageNavigation(activeStage, timerFocusMode);

    const primaryExerciseTitle = computed(() => exerciseCards.value[0]?.levelLabel ?? 'Упражнение');
    const errorMessage = computed(() => (error.value as any)?.message || 'Произошла ошибка при загрузке данных');
    const formatDate = (date: Date) => format(date, 'yyyy-MM-dd');
    const isStageLocked = (_stageId: StageId) => false;
    const hasPrevExercise = computed(() => false);
    const hasNextExercise = computed(() => false); // Placeholder logic
    const handlePrevExercise = () => { };
    const handleNextExercise = () => { };

    const statusLabel = computed(() => {
      if (trainingCompleted.value) return 'Завершено';
      if (trainingStarted.value) return 'Активно';
      if (showHistoricalPlaceholder.value) return 'В прошлом';
      return '';
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
        } catch (err) {
          trainingStarted.value = false;
          ErrorHandler.handleWithToast(err, 'TodayPage.startTraining');
        }
        updateHeroState();
        savePersistedState({ immediate: true });
      });
    };

    const handleCompleteTraining = async () => {
      if (!hasProgram.value || saving.value) return;
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
          instantFeedback.signalSuccess({ title: 'Готово', message: 'Тренировка сохранена' });
        } catch (err) {
           ErrorHandler.handleWithToast(err, 'TodayPage.complete');
        } finally {
          saving.value = false;
        }
      });
    };

    const handleFocusUpdateResult = (p: { key: string; value: number }) => { exerciseResults.value = { ...exerciseResults.value, [p.key]: p.value }; };
    const handleFocusComplete = () => { appStore.toggleFocusMode(); handleCompleteTraining(); };

    watch(selectedDate, async (date) => { await handleDateChange(date); initializeHeroBadge(); updateHeroState(); loadPersistedState(); });
    watch([hasProgram, isTrainingDay, showHistoricalPlaceholder], () => initializeHeroBadge());
    
    onMounted(() => loadPersistedState());

    return {
      appStore, selectedDate, loading, error, errorMessage, userProgram, hasProgram,
      isBeforeProgramStart, programStartLabel, showHistoricalPlaceholder, trainingHint,
      trainingStarted, trainingCompleted, statusLabel, isRestDay, sessionSourceHint,
      stageNav, activeStage, isStageLocked, setStage, setStageButtonRef, handleStageKeydown,
      handleDateChange, reloadAll, goToPrograms, formatDate, primaryExerciseTitle,
      timerSettings, timerFocusMode, hasPrevExercise, hasNextExercise, updateTimerSettings,
      updateTimerElapsed, handleCompleteTraining, handleStartTraining, handlePrevExercise,
      handleNextExercise, handleFocusUpdateResult, handleFocusComplete, disableFocusMode,
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

/* Controls (DaySwitcher) */
.today-controls {
  position: relative;
  z-index: 10;
  flex-shrink: 0;
  padding: 0.25rem 0.5rem;
  background: transparent;
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
</style>
