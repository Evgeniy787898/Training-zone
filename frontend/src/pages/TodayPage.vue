<template>
  <div
    class="page-shell today-page"
    :class="{ 'today-page--focus': timerFocusMode }"
    data-animate="fade-up"
  >
    <header class="today-page__header" data-animate="fade-up">
      <h1 class="today-page__title">Сегодня</h1>
    </header>

    <DaySwitcher :date="selectedDate" @update:date="handleDateChange" />

    <section v-if="loading" class="today-page__panel" data-animate="fade-up">
      <TodaySkeleton />
    </section>

    <section v-else-if="error" class="today-page__panel" data-animate="fade-up">
      <ErrorState :message="errorMessage" @retry="reloadAll" />
    </section>

    <section v-else>
      <BaseCard
        v-if="!hasProgram"
        class="training-placeholder"
        hoverable
        data-animate="scale-in"
      >
        <h2 class="training-placeholder__title">Настрой свою тренировку</h2>
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
        <h2 class="training-placeholder__title">Старт программы</h2>
        <p class="training-placeholder__message">
          Программа началась {{ programStartLabel }}. Выбери дату после старта, чтобы увидеть тренировку.
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
            Приступить к тренировке
          </BaseButton>
          <span v-else class="training-day-header__status" :data-complete="trainingCompleted">
            {{ statusLabel }}
          </span>
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
            :id="`stage-tab-${stage.id}`"
            :data-stage-id="stage.id"
            :aria-disabled="isStageLocked(stage.id) ? 'true' : 'false'"
            :aria-controls="`stage-panel-${stage.id}`"
            :aria-selected="activeStage === stage.id"
            :tabindex="activeStage === stage.id ? 0 : -1"
            role="tab"
            @click="setStage(stage.id)"
            @keydown="handleStageKeydown($event, stage.id)"
            :ref="setStageButtonRef"
          >
            {{ stage.label }}
          </button>
        </nav>

        <div
          v-if="activeStage === 'workout'"
          class="stage-panel"
          role="tabpanel"
          :id="'stage-panel-workout'"
          aria-labelledby="stage-tab-workout"
          data-animate="fade-up"
        >
          <div
            v-if="showHistoricalPlaceholder"
            class="stage-placeholder stage-placeholder--muted"
          >
            <h3>Нет записи тренировки</h3>
            <p>За выбранную дату тренировка не была зафиксирована. Используйте вкладку «Программы тренировок», чтобы повторить технику.</p>
          </div>

          <div v-else-if="isRestDay" class="stage-placeholder">
            <h3>День восстановления</h3>
            <p>Сегодня в плане только восстановление. Проверь заметки в настройках программы или выбери другую дату.</p>
          </div>

          <div v-else-if="!exerciseCards.length" class="stage-placeholder stage-placeholder--muted">
            <h3>Недостаточно данных</h3>
            <p>Не удалось подготовить упражнения для этой тренировки. Проверь выбранную программу или обнови уровни упражнений.</p>
          </div>

          <template v-else>
            <section class="exercise-grid" aria-label="План на сегодня">
              <BaseCard
                v-for="(card, cardIndex) in exerciseCards"
                :key="card.key"
                tag="article"
                class="exercise-card"
                hoverable
                :class="{
                  'exercise-card--achieved': isExerciseAchieved(card),
                  'exercise-card--spark': isSparkActive(card.key)
                }"
                data-animate="stagger-item"
                :style="{ '--animate-order': cardIndex }"
              >
                <span
                  v-if="isSparkActive(card.key)"
                  class="exercise-card__spark"
                  aria-hidden="true"
                ></span>
                <div class="exercise-card__media" v-if="card.images.length">
                  <OptimizedImage
                    v-if="resolveCardImage(card)"
                    :src="resolveCardImage(card)?.src || ''"
                    :srcset="resolveCardImage(card)?.srcset || undefined"
                    :sizes="resolveCardImage(card)?.sizes || CARD_IMAGE_SIZES"
                    :fetchpriority="cardIndex < 2 ? 'high' : 'auto'"
                    :alt="`Пример выполнения: ${card.levelLabel}`"
                    loading="lazy"
                    decoding="async"
                  />
                  <div class="exercise-card__dots" role="tablist">
                    <button
                      v-for="(_, index) in card.images"
                      :key="index"
                      type="button"
                      class="exercise-card__dot"
                      :class="{ 'exercise-card__dot--active': currentMediaIndex(card.key) === index }"
                      @click="setMediaIndex(card.key, index)"
                      :aria-label="`Показать фото ${index + 1}`"
                    ></button>
                  </div>
                </div>
                <div v-else class="exercise-card__media exercise-card__media--empty">
                  <span>Без изображения</span>
                </div>
                <div class="exercise-card__body">
                  <h3 class="exercise-card__title">{{ card.levelLabel }}</h3>
                  <p v-if="card.tierLabel" class="exercise-card__tier">{{ card.tierLabel }}</p>
                  <p class="exercise-card__sets">{{ card.sets }} подход(а) × {{ card.reps }} повторений</p>
                </div>
              </BaseCard>
            </section>

            <div v-if="missingExercises.length" class="missing-data-card" data-animate="fade-up">
              <h4>Что ещё осталось уточнить</h4>
              <ul>
                <li v-for="item in missingExercises" :key="item.key">
                  {{ item.name || item.key }} — {{ item.reason }}
                </li>
              </ul>
            </div>
          </template>
        </div>

        <div
          v-else-if="activeStage === 'timer'"
          class="stage-panel"
          :class="{ 'stage-panel--focus': timerFocusMode }"
          role="tabpanel"
          :id="'stage-panel-timer'"
          aria-labelledby="stage-tab-timer"
          data-animate="fade-up"
        >
          <TabataTimer
            :locked="!trainingStarted && !trainingCompleted"
            :exercise-name="primaryExerciseTitle"
            :settings="timerSettings"
            :focus-mode="timerFocusMode"
            @update:settings="handleTimerSettings"
            @time-update="handleTimerUpdate"
            @session-complete="handleTimerComplete"
            @toggle-focus="toggleFocusMode"
          />
          <div v-if="!trainingStarted && !trainingCompleted" class="stage-placeholder stage-placeholder--info">
            <p>Таймер доступен для настройки. Нажми «Приступить к тренировке», чтобы начать отсчёт.</p>
          </div>
        </div>

        <div
          v-else
          class="stage-panel"
          role="tabpanel"
          :id="'stage-panel-results'"
          aria-labelledby="stage-tab-results"
          data-animate="fade-up"
        >
          <div v-if="!trainingStarted && !trainingCompleted" class="stage-placeholder stage-placeholder--info">
            <p>Раздел доступен для просмотра. Начни тренировку, чтобы зафиксировать результаты.</p>
          </div>

          <div>
            <section class="results-list" aria-label="Фиксация результатов">
              <article
                v-for="card in exerciseCards"
                :key="card.key"
                class="results-row"
                :class="[
                  `results-row--${resultStatus(card)}`,
                  { 'results-row--spark': isSparkActive(card.key) }
                ]"
              >
                <span
                  v-if="isSparkActive(card.key)"
                  class="results-row__spark"
                  aria-hidden="true"
                ></span>
                <div class="results-row__info">
                  <h4>{{ card.levelLabel }}</h4>
                  <span>Цель: {{ card.sets }} × {{ card.reps }}</span>
                </div>
                <div class="results-row__input">
                  <label :for="`result-${card.key}`">Выполнено</label>
                  <input
                    :id="`result-${card.key}`"
                    type="number"
                    min="0"
                    :value="exerciseResults[card.key] ?? 0"
                    :placeholder="String(card.reps)"
                    @input="onResultInput(card.key, $event)"
                  />
                </div>
              </article>
            </section>

            <BaseCard class="summary-card" hoverable>
              <h3 class="summary-card__title">Заметки к тренировке</h3>
              <textarea
                v-model="summaryComment"
                placeholder="Как прошла тренировка?"
                aria-label="Заметки к тренировке"
                rows="3"
              ></textarea>
              <BaseButton
                variant="primary"
                size="sm"
                class="summary-card__submit"
                :disabled="saving"
                :loading="saving"
                loading-text="Сохраняю…"
                @click="handleCompleteTraining"
              >
                Зафиксировать тренировку
              </BaseButton>
            </BaseCard>

            <div
              v-if="postWorkoutSuggestions.length"
            >
              <BaseCard class="post-session-card" hoverable>
                <h3 class="post-session-card__title">Что дальше?</h3>
                <ul class="post-session-card__list">
                  <li
                    v-for="item in postWorkoutSuggestions"
                    :key="item.id"
                    class="post-session-card__item"
                    :class="`post-session-card__item--${item.accent}`"
                  >
                    <h4>{{ item.title }}</h4>
                    <p>{{ item.description }}</p>
                  </li>
                </ul>
              </BaseCard>
            </div>
          </div>
        </div>
      </div>
    </section>

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
  </div>
</template>

<script setup lang="ts">
import { computed, markRaw, onMounted, onUnmounted, ref, watch, type ComponentPublicInstance } from 'vue';
import { format, startOfDay, isSameDay, differenceInCalendarDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useAppStore } from '@/stores/app';
import ErrorHandler from '@/services/errorHandler';
import { cachedApiClient as apiClient } from '@/services/cachedApi';
import { useInstantFeedback } from '@/services/instantFeedback';
import { celebrateWithConfetti } from '@/utils/confetti';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import DaySwitcher from '@/modules/today/components/DaySwitcher.vue';
import TabataTimer from '@/modules/today/components/TabataTimer.vue';
import ErrorState from '@/modules/shared/components/ErrorState.vue';
import TodaySkeleton from '@/modules/today/components/TodaySkeleton.vue';
import DailyAdviceModal from '@/modules/shared/components/DailyAdviceModal.vue';
import OptimizedImage from '@/modules/shared/components/OptimizedImage.vue';
import type { ExerciseLevel, ProgramExercise as ProgramExerciseType, TrainingSession, UserProgramSnapshot } from '@/types';
import { buildExerciseImageSource, type ExerciseImageSource } from '@/utils/exerciseImages';
import { memoizeOne } from '@/utils/memoize';
import { debounce } from '@/utils/debounce';
import { createStableShallowRef } from '@/utils/reactivity';
import { createInteractionGuard } from '@/services/interactionGuard';

type StageId = 'workout' | 'timer' | 'results';

type PlanExercise = {
  key: string;
  name?: string | null;
  level?: string | number | null;
  levelLabel?: string | null;
  sets?: number | null;
  reps?: number | null;
  images?: string[];
};

type ProgramDay = {
  rawDay: string | null;
  dayKey: string | null;
  cycleIndex: number | null;
  label?: string | null;
  isRestDay: boolean;
  exercises: PlanExercise[];
};

type ExerciseCard = {
  key: string;
  levelLabel: string;
  sets: number;
  reps: number;
  images: ExerciseImageSource[];
  levelCode?: string;
  levelId?: string;
  tierLabel?: string | null;
};

type MissingExercise = {
  key: string;
  name?: string;
  reason: string;
};

const memoizedExtractProgramPlan = memoizeOne(extractProgramPlan);

const router = useRouter();
const appStore = useAppStore();
const instantFeedback = useInstantFeedback();
const interactionGuard = createInteractionGuard({ cooldownMs: 900 });
const { programRevision, exerciseLevels: storeExerciseLevels } = storeToRefs(appStore);
const CARD_IMAGE_SIZES = '(max-width: 768px) 85vw, min(420px, 40vw)';

const selectedDate = ref(new Date());
const loading = ref(true);
const error = ref<Error | null>(null);
type UserProgramWithSelection = UserProgramSnapshot & { selectedAt?: string | null };

const { state: userProgram, sync: syncUserProgram } = createStableShallowRef<UserProgramSnapshot | null>(null);
const { state: programPlan, sync: syncProgramPlan } = createStableShallowRef<ProgramDay[]>([]);
const { state: programExercises, sync: syncProgramExercises } =
  createStableShallowRef<ProgramExerciseType[]>([]);
// Используем уровни напрямую из store для автоматической синхронизации
const exerciseLevels = computed(() => storeExerciseLevels.value || new Map());
const { state: session, sync: syncSession } = createStableShallowRef<TrainingSession | null>(null);
const sessionSource = ref<string | null>(null);
const adviceModalOpen = ref(false);

const syncProgramFromStore = () => {
  const snapshot = appStore.getProgramContextSnapshot();
  syncUserProgram(snapshot.userProgram ?? null);
  syncProgramPlan(memoizedExtractProgramPlan(snapshot.userProgram?.program?.programData));
  syncProgramExercises(Array.isArray(snapshot.exercises) ? snapshot.exercises : []);
  // exerciseLevels теперь computed из store - обновляется автоматически
};

syncProgramFromStore();

const trainingStarted = ref(false);
const trainingCompleted = ref(false);
const activeStage = ref<StageId>('workout');
const summaryComment = ref('');
const exerciseResults = ref<Record<string, number>>({});
const mediaIndices = ref<Record<string, number>>({});
const stageButtonRefs = ref<Array<HTMLButtonElement | null>>([]);
const timerSettings = ref({
  work: 40,
  rest: 20,
  restBetweenSets: 30,
  restBetweenExercises: 45,
  rounds: 4,
});
const tabataElapsed = ref(0);
const saving = ref(false);
const sparkState = ref<Record<string, number>>({});
const timerFocusMode = ref(false);

const applyOptimisticSessionUpdate = async <T>(
  patch: Partial<TrainingSession>,
  action: () => Promise<T>,
) => {
  const previous = session.value ? { ...session.value } : null;

  if (session.value) {
    syncSession({ ...session.value, ...patch });
  }

  try {
    const result = await action();
    const nextSession = (result as any)?.session ?? result;
    if (nextSession) {
      syncSession(nextSession as TrainingSession);
    }
    return nextSession as T;
  } catch (error) {
    if (previous) {
      syncSession(previous);
    }
    throw error;
  }
};
const sparkTimers = new Map<string, ReturnType<typeof setTimeout>>();
let resultsHydrated = false;

const trainingHint = ref('Добавь подходящую программу и настроь расписание под свой режим.');

const stageNav = [
  { id: 'workout', label: 'Тренировка' },
  { id: 'timer', label: 'Табата-таймер' },
  { id: 'results', label: 'Итоги' },
] as const;
const stageOrder = stageNav.map((item) => item.id);

const setStageButtonRef = (el: Element | ComponentPublicInstance | null) => {
  if (!el) return;
  const button = el as HTMLButtonElement;
  if (!button) return; // Ensure it's an HTML element
  const stageId = button.dataset.stageId as StageId | undefined;
  if (!stageId) return;
  const index = stageOrder.indexOf(stageId);
  if (index >= 0) {
    stageButtonRefs.value[index] = button;
  }
};

const findNextEnabledStageIndex = (startIndex: number, direction: 1 | -1) => {
  const length = stageOrder.length;
  for (let i = 1; i <= length; i += 1) {
    const candidate = (startIndex + direction * i + length) % length;
    if (!isStageLocked(stageOrder[candidate])) {
      return candidate;
    }
  }
  return startIndex;
};

const focusStageButton = (index: number) => {
  const target = stageButtonRefs.value[index];
  if (target) {
    target.focus();
  }
};

const handleStageKeydown = (event: KeyboardEvent, stageId: StageId) => {
  const currentIndex = stageOrder.indexOf(stageId);
  if (currentIndex === -1) return;

  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault();
    const nextIndex = findNextEnabledStageIndex(currentIndex, 1);
    const nextStage = stageOrder[nextIndex];
    setStage(nextStage);
    focusStageButton(nextIndex);
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault();
    const prevIndex = findNextEnabledStageIndex(currentIndex, -1);
    const prevStage = stageOrder[prevIndex];
    setStage(prevStage);
    focusStageButton(prevIndex);
  } else if (event.key === 'Home') {
    event.preventDefault();
    const firstIndex = findNextEnabledStageIndex(-1, 1);
    const firstStage = stageOrder[firstIndex];
    setStage(firstStage);
    focusStageButton(firstIndex);
  } else if (event.key === 'End') {
    event.preventDefault();
    const lastIndex = findNextEnabledStageIndex(0, -1);
    const lastStage = stageOrder[lastIndex];
    setStage(lastStage);
    focusStageButton(lastIndex);
  }
};

const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const DAY_NAME_ALIASES: Record<string, string> = {
  sun: 'sunday',
  sunday: 'sunday',
  вс: 'sunday',
  воскресенье: 'sunday',
  mon: 'monday',
  monday: 'monday',
  пн: 'monday',
  понедельник: 'monday',
  tue: 'tuesday',
  tuesday: 'tuesday',
  вт: 'tuesday',
  вторник: 'tuesday',
  wed: 'wednesday',
  wednesday: 'wednesday',
  ср: 'wednesday',
  среда: 'wednesday',
  thu: 'thursday',
  thursday: 'thursday',
  чт: 'thursday',
  четверг: 'thursday',
  fri: 'friday',
  friday: 'friday',
  пт: 'friday',
  пятница: 'friday',
  sat: 'saturday',
  saturday: 'saturday',
  сб: 'saturday',
  суббота: 'saturday',
  rest: 'rest',
  отдых: 'rest',
  'rest day': 'rest',
  выходной: 'rest',
};
const weekDayOrder = WEEKDAY_KEYS;

function sanitizeDayValue(value: string): string {
  return value.replace(/[._-]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

function resolveCycleIndexFromValue(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = String(value).match(/(\d+)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.round(parsed) - 1);
}

function normalizeDayKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.toString().trim().toLowerCase();
  if (!trimmed) return null;
  if (DAY_NAME_ALIASES[trimmed]) {
    return DAY_NAME_ALIASES[trimmed];
  }
  const sanitized = sanitizeDayValue(trimmed);
  if (DAY_NAME_ALIASES[sanitized]) {
    return DAY_NAME_ALIASES[sanitized];
  }
  const cycleIndex = resolveCycleIndexFromValue(sanitized);
  if (cycleIndex !== null) {
    return `cycle-${cycleIndex}`;
  }
  return sanitized;
}

const hasProgram = computed(() => Boolean(userProgram.value?.program?.id));
const errorMessage = computed(() => error.value?.message ?? 'Не удалось загрузить данные');
const isoDate = computed(() => format(selectedDate.value, 'yyyy-MM-dd'));
const programStartDate = computed(() => {
  const program = userProgram.value as UserProgramWithSelection | null;
  const raw = program?.selectedAt ?? program?.createdAt ?? program?.updatedAt;
  return raw ? startOfDay(new Date(raw)) : null;
});
const isBeforeProgramStart = computed(() => {
  if (!programStartDate.value) return false;
  return startOfDay(selectedDate.value).getTime() < programStartDate.value.getTime();
});
const programStartLabel = computed(() => (programStartDate.value ? format(programStartDate.value, 'd MMMM yyyy', { locale: ru }) : ''));

const planByDay = computed(() => {
  const map = new Map<string, ProgramDay>();
  for (const entry of programPlan.value) {
    if (entry.dayKey) {
      map.set(entry.dayKey, entry);
    }
  }
  return map;
});

const planByCycleIndex = computed(() => {
  const map = new Map<number, ProgramDay>();
  for (const entry of programPlan.value) {
    if (typeof entry.cycleIndex === 'number' && entry.cycleIndex >= 0 && !map.has(entry.cycleIndex)) {
      map.set(entry.cycleIndex, entry);
    }
  }
  return map;
});

const cyclePlanLength = computed(() => {
  if (!planByCycleIndex.value.size) return 0;
  return Math.max(...Array.from(planByCycleIndex.value.keys())) + 1;
});

const hasExplicitWeekdays = computed(() => {
  return programPlan.value.some((day) => {
    if (!day.dayKey) return false;
    return WEEKDAY_KEYS.includes(day.dayKey as (typeof WEEKDAY_KEYS)[number]);
  });
});

const selectedDayKey = computed(
  () => normalizeDayKey(weekDayOrder[selectedDate.value.getDay()]) ?? weekDayOrder[selectedDate.value.getDay()],
);

const todaysCycleIndex = computed(() => {
  if (!programStartDate.value || !planByCycleIndex.value.size) return null;
  const diff = differenceInCalendarDays(startOfDay(selectedDate.value), programStartDate.value);
  if (diff < 0) return null;
  const length = cyclePlanLength.value;
  if (length <= 0) return null;
  return diff % length;
});

const todaysPlan = computed(() => {
  if (hasExplicitWeekdays.value) {
    if (selectedDayKey.value) {
      return planByDay.value.get(selectedDayKey.value) ?? null;
    }
    return null;
  }

  const cycleIndex = todaysCycleIndex.value;
  if (cycleIndex !== null) {
    return planByCycleIndex.value.get(cycleIndex) ?? null;
  }
  return null;
});

const todaysExercises = computed<PlanExercise[]>(() => {
  if (todaysPlan.value?.exercises?.length) {
    return todaysPlan.value.exercises;
  }
  return [];
});

const isTrainingDay = computed(() => {
  if (todaysPlan.value?.isRestDay) {
    return false;
  }
  return todaysExercises.value.length > 0;
});
const isRestDay = computed(() => {
  if (!hasProgram.value) return false;
  if (session.value?.status === 'rest') return true;
  if (todaysPlan.value?.isRestDay) return true;
  if (hasExplicitWeekdays.value && !todaysPlan.value) return true;
  return !isTrainingDay.value;
});
const isPastDate = computed(() => startOfDay(selectedDate.value).getTime() < startOfDay(new Date()).getTime());
const showHistoricalPlaceholder = computed(() => isPastDate.value && !session.value && isTrainingDay.value);
const exercisesByKey = computed(() => {
  const map = new Map<string, ProgramExerciseType>();
  for (const exercise of programExercises.value) {
    const key = exercise.exerciseKey || (exercise as any).key;
    if (key) {
      map.set(key, exercise);
    }
  }
  return map;
});

const exercisePreparation = computed(() => {
  const cards: ExerciseCard[] = [];
  const missing: MissingExercise[] = [];

  if (!hasProgram.value) {
    return { cards, missing };
  }

  if (!todaysExercises.value.length) {
    return { cards, missing };
  }

  todaysExercises.value.forEach((planExercise: PlanExercise) => {
    const exerciseKey = planExercise.key;
    if (!exerciseKey) return;
    const exercise = exercisesByKey.value.get(exerciseKey) as ProgramExerciseType | undefined;
    const levels = exerciseLevels.value.get(exerciseKey) ?? [];
    const levelReference = planExercise.level ?? resolveLevelReference(exerciseKey);
    const level = pickLevel(levels, levelReference);
    
    console.log(`[TodayPage.exercisePreparation] ${exerciseKey}:`, {
      totalLevels: levels.length,
      levelReference,
      selectedLevel: level?.level,
      hasImage1: !!level?.image1,
      hasImage2: !!level?.image2,
      hasImage3: !!level?.image3,
    });
    
    const exerciseTitle = exercise ? (exercise as ProgramExerciseType).title : undefined;
    const hasPlanDetails = Boolean(planExercise.level || planExercise.levelLabel || planExercise.sets || planExercise.reps);

    if (!exercise && !level && !hasPlanDetails) {
      missing.push({
        key: exerciseKey,
        name: planExercise.name || exerciseTitle,
        reason: 'Данные упражнения недоступны',
      });
      return;
    }

    const fallbackImages = [
      ...(planExercise.images ?? []),
    ];
    const images = collectImages(level, exercise, fallbackImages);
    
    console.log(`[TodayPage.exercisePreparation] ${exerciseKey} images:`, {
      collected: images.length,
      firstImageLength: images[0]?.src?.length || 0,
    });
    
    const sets =
      coalesceNumber(planExercise.sets, level?.sets, (exercise as any)?.sets) ?? 3;
    const reps =
      coalesceNumber(planExercise.reps, level?.reps, (exercise as any)?.reps) ?? 10;

    const levelCode =
      normalizeLevelCode(level?.level ?? planExercise.level ?? levelReference) ?? null;
    const tierLabel = resolveLevelTier(levelCode);
    const baseName = planExercise.name || exerciseTitle || exerciseKey;
    const labelSource =
      level?.title || level?.name || planExercise.levelLabel || baseName;
    const levelLabel = buildLevelLabel(levelCode, labelSource, baseName) ?? baseName;

    cards.push({
      key: exerciseKey,
      levelLabel,
      levelCode: levelCode ?? undefined,
      levelId: level?.id,
      sets,
      reps,
      images,
      tierLabel,
    });
  });

  return {
    cards: markRaw(cards),
    missing: markRaw(missing),
  };
});

const exerciseCards = computed(() => exercisePreparation.value.cards);
const missingExercises = computed(() => exercisePreparation.value.missing);
const primaryExerciseTitle = computed(() => exerciseCards.value[0]?.levelLabel ?? 'Упражнение');
const statusLabel = computed(() => {
  if (trainingCompleted.value) return 'Тренировка зафиксирована';
  if (trainingStarted.value) return 'Тренировка начата';
  if (showHistoricalPlaceholder.value) return 'Нет записи';
  return '';
});
const sessionSourceHint = computed(() => {
  if (sessionSource.value === 'program_plan') {
    return 'План дня сформирован из данных программы. Запусти тренировку, чтобы сохранить прогресс.';
  }
  return null;
});

const postWorkoutSuggestions = computed(() => {
  if (!trainingCompleted.value || !exerciseCards.value.length) {
    return [] as Array<{ id: string; title: string; description: string; accent: 'calm' | 'drive' }>;
  }

  const successCount = exerciseCards.value.filter((card) => resultStatus(card) === 'success').length;
  const pending = exerciseCards.value.length - successCount;
  const primary = exerciseCards.value[0];
  const baseName = primary?.levelLabel ?? 'упражнение';
  const baseReps = primary?.reps ?? 0;
  const challengeReps = baseReps ? Math.max(baseReps + 2, baseReps + Math.round(baseReps * 0.1)) : 6;

  return [
    {
      id: 'recovery',
      title: 'Восстановление',
      accent: 'calm' as const,
      description:
        pending > 0
          ? 'Сделай мягкую растяжку и дыхательную серию, чтобы подтянуть технику и восстановиться.'
          : 'Запланируй растяжку, стакан воды и не менее 8 часов сна — организм восстановится быстрее.',
    },
    {
      id: 'challenge',
      title: 'Усложнить',
      accent: 'drive' as const,
      description: `На следующей тренировке попробуй добавить +2 повтора к «${baseName}» или задержку в финальной фазе. Цель: ${challengeReps} повторов.`,
    },
  ];
});

const storageKey = computed(() => {
  if (hasProgram.value) {
    const programId = userProgram.value?.id || userProgram.value?.program?.id;
    return `tzona-training-${programId}-${isoDate.value}`;
  }
  return `tzona-training-${isoDate.value}`;
});

const handleDateChange = (date: Date) => {
  selectedDate.value = date;
};

const goToPrograms = () => {
  router.push('/programs');
};

// Разрешаем доступ ко всем разделам для просмотра информации
// Таймер и итоги доступны всегда, даже без начала тренировки
const isStageLocked = (_stageId: StageId) => false;

const setStage = (stageId: StageId) => {
  if (isStageLocked(stageId)) {
    return;
  }
  activeStage.value = stageId;
  if (stageId !== 'timer' && timerFocusMode.value) {
    timerFocusMode.value = false;
  }
};

const currentMediaIndex = (key: string) => mediaIndices.value[key] ?? 0;

const setMediaIndex = (key: string, index: number) => {
  mediaIndices.value = { ...mediaIndices.value, [key]: index };
};

const resolveCardImage = (card: ExerciseCard): ExerciseImageSource | null => {
  if (!card.images.length) {
    return null;
  }
  const index = currentMediaIndex(card.key);
  const clamped = Math.max(0, Math.min(index, card.images.length - 1));
  return card.images[clamped] ?? null;
};

const onResultInput = (key: string, event: Event) => {
  const next = Number((event.target as HTMLInputElement).value) || 0;
  exerciseResults.value = { ...exerciseResults.value, [key]: next };
};

const evaluateResultStatus = (card: ExerciseCard, actual: number) => {
  if (!actual) return 'pending' as const;
  const target = card.reps ?? 0;
  return actual >= target ? ('success' as const) : ('danger' as const);
};

const resultStatus = (card: ExerciseCard) => {
  const actual = exerciseResults.value[card.key] ?? 0;
  return evaluateResultStatus(card, actual);
};

const isExerciseAchieved = (card: ExerciseCard) => resultStatus(card) === 'success';
const isSparkActive = (key: string) => Boolean(sparkState.value[key]);

const scheduleSpark = (key: string) => {
  const stamp = Date.now();
  sparkState.value = { ...sparkState.value, [key]: stamp };
  const pending = sparkTimers.get(key);
  if (pending) {
    clearTimeout(pending);
  }
  const timeout = (typeof window !== 'undefined' ? window.setTimeout : setTimeout)(() => {
    const next = { ...sparkState.value };
    if (next[key] === stamp) {
      delete next[key];
      sparkState.value = next;
    }
    sparkTimers.delete(key);
  }, 900);
  sparkTimers.set(key, timeout as ReturnType<typeof setTimeout>);
};

const toggleFocusMode = () => {
  timerFocusMode.value = !timerFocusMode.value;
};

const disableFocusMode = () => {
  timerFocusMode.value = false;
};

const handleStartTraining = async () => {
  const result = await interactionGuard.run('start-training', async () => {
    trainingStarted.value = true;
    trainingCompleted.value = false;
    tabataElapsed.value = 0;
    activeStage.value = 'workout';
    instantFeedback.signalStart({ title: 'Тренировка', message: 'Готовим сессию…' });
    try {
      await ensureSession('in_progress');
      instantFeedback.signalSuccess({ title: 'Тренировка', message: 'Сессия создана, можно начинать.' });
    } catch (err: any) {
      trainingStarted.value = false;
      ErrorHandler.handleWithToast(err, 'TodayPage.startTraining');

      // Улучшенная обработка ошибок с понятными сообщениями
      let message = 'Не удалось создать тренировку';
      if (err?.response?.status === 503 || err?.message?.includes('недоступен')) {
        message = 'База данных временно недоступна. Попробуй ещё раз позже.';
      } else if (err?.response?.status === 500) {
        message = err?.response?.data?.message || 'Сервер временно недоступен. Попробуй ещё раз позже.';
      } else if (err?.message) {
        message = err.message;
      }

      instantFeedback.signalError({ title: 'Не получилось начать тренировку', message });
      return null;
    }
    updateHeroState();
    savePersistedState({ immediate: true });
    return true;
  });

  if (!result) {
    return;
  }
};

const handleTimerSettings = (next: typeof timerSettings.value) => {
  timerSettings.value = { ...timerSettings.value, ...next };
  savePersistedState();
};

const handleTimerUpdate = (elapsed: number) => {
  tabataElapsed.value = elapsed;
  savePersistedState({ immediate: true });
};

const handleTimerComplete = () => {
  // 🎉 Запускаем конфетти!
  celebrateWithConfetti();

  // Автоматически переключаемся на результаты
  activeStage.value = 'results';
  savePersistedState({ immediate: true });
};

const handleCompleteTraining = async () => {
  if (!hasProgram.value || saving.value) return;

  const result = await interactionGuard.run('complete-training', async () => {
    try {
      saving.value = true;
      instantFeedback.signalStart({ title: 'Сохранение тренировки', message: 'Фиксируем результаты…' });
      const sessionId = await ensureSession('done');
      const payload = {
        status: 'done',
        notes: JSON.stringify({
          comment: summaryComment.value,
          date: isoDate.value,
          program: {
            id: userProgram.value?.program?.id,
            selectionId: userProgram.value?.id,
            disciplineId: userProgram.value?.discipline?.id,
          },
          results: exerciseCards.value.map((card) => ({
            exerciseKey: card.key,
            level: card.levelCode,
            levelId: card.levelId,
            target: { sets: card.sets, reps: card.reps },
            actual: exerciseResults.value[card.key] ?? 0,
          })),
          timer: { ...timerSettings.value, elapsedSeconds: tabataElapsed.value },
          trainingStarted: trainingStarted.value,
          trainingCompleted: true,
        }),
      } as Record<string, any>;

      const response = await applyOptimisticSessionUpdate({ status: 'done' }, () =>
        apiClient.updateSession(sessionId, payload),
      );
      syncSession(response?.session ?? response ?? session.value);

      trainingCompleted.value = true;
      trainingStarted.value = false;
      savePersistedState({ immediate: true });
      updateHeroState();
      instantFeedback.signalSuccess({ title: 'Тренировка сохранена', message: 'Результаты зафиксированы.' });
      return true;
    } catch (err: any) {
      instantFeedback.signalError({ title: 'Не удалось сохранить тренировку', message: err?.message ?? 'Попробуйте ещё раз' });
      return null;
    } finally {
      saving.value = false;
    }
  });

  if (!result) {
    return;
  }
};

const ensureSession = async (status: 'planned' | 'in_progress' | 'done'): Promise<string> => {
  if (session.value?.id) {
    if (status && session.value.status !== status) {
      try {
        const response = await applyOptimisticSessionUpdate({ status }, () =>
          apiClient.updateSession(session.value!.id, { status }),
        );
        syncSession(response?.session ?? session.value);
        sessionSource.value = 'database';
      } catch (err) {
        console.warn('Не удалось обновить статус сессии', err);
      }
    }
    return session.value.id;
  }

  const planned = new Date(selectedDate.value);
  planned.setHours(10, 0, 0, 0);
  try {
    console.log('[TodayPage.ensureSession] Creating session:', {
      planned_at: planned.toISOString(),
      status,
      date: selectedDate.value,
    });
    const created = await apiClient.createSession({
      planned_at: planned.toISOString(),
      status,
    });
    console.log('[TodayPage.ensureSession] Session created:', created);
    syncSession(created?.session ?? created);
    sessionSource.value = created?.source ?? 'database';
    if (!session.value?.id) {
      throw new Error('Session ID missing after creation');
    }
    return session.value.id;
  } catch (err: any) {
    ErrorHandler.handleWithToast(err, 'TodayPage.createSession');
    syncSession(session.value ?? null);
    sessionSource.value = 'program_plan';
    // Если это ошибка БД (503), пробрасываем её дальше с понятным сообщением
    if (err?.response?.status === 503 || err?.message?.includes('недоступен')) {
      throw err;
    }
    throw err;
  }
};

const loadSessionForDate = async () => {
  resultsHydrated = false;
  sparkState.value = {};
  sparkTimers.forEach((timeout) => clearTimeout(timeout));
  sparkTimers.clear();
  try {
    const response = await apiClient.getTodaySession(isoDate.value);
    syncSession(response?.session ?? null);
    sessionSource.value = response?.source ?? null;
    trainingCompleted.value = session.value?.status === 'done';
    trainingStarted.value = session.value?.status === 'in_progress';
    const notes = parseSessionNotes(session.value?.notes);
    if (notes) {
      applySessionNotes(notes);
    }
    resultsHydrated = true;
  } catch (err: any) {
    syncSession(null);
    sessionSource.value = null;
    trainingCompleted.value = false;
    trainingStarted.value = false;
    if (err?.response?.status && err.response.status !== 404) {
      throw err;
    }
  }
};

const reloadAll = async () => {
  const startTime = performance.now();
  loading.value = true;
  error.value = null;
  try {
    console.log('[TodayPage.reloadAll] Starting...');
    const [programSnapshot] = await Promise.all([
      appStore.ensureProgramContext({ force: false, includeLevels: true }),
      loadSessionForDate()
    ]);

    syncUserProgram(programSnapshot.userProgram ?? null);
    syncProgramPlan(memoizedExtractProgramPlan(programSnapshot.userProgram?.program?.programData));
    syncProgramExercises(Array.isArray(programSnapshot.exercises) ? programSnapshot.exercises : []);

    loading.value = false;
    const loadTime = performance.now() - startTime;
    console.log(`[TodayPage.reloadAll] ✅ Content loaded in ${Math.round(loadTime)}ms`);
    
    initializeHeroBadge();
    updateHeroState();
    loadPersistedState();
  } catch (err) {
    // const loadTime = performance.now() - startTime; // TODO: Use for performance metrics
    ErrorHandler.handleWithToast(err, 'TodayPage.reloadAll');
    error.value = err as Error;
    loading.value = false;
    initializeHeroBadge();
    updateHeroState();
    loadPersistedState();
  }
};

const resolveLevelReference = (exerciseKey: string): number | null => {
  const map = userProgram.value?.currentLevels || userProgram.value?.initialLevels || {};
  const raw = map?.[exerciseKey];
  if (raw === undefined || raw === null) {
    return null;
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === 'object') {
    if (typeof raw.level === 'number' && Number.isFinite(raw.level)) {
      return raw.level;
    }
    if (typeof raw.currentLevel === 'number' && Number.isFinite(raw.currentLevel)) {
      return raw.currentLevel;
    }
  }
  if (typeof raw === 'string') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const pickLevel = (levels: ExerciseLevel[], value: any) => {
  if (!levels.length) return undefined;
  if (typeof value === 'string') {
    const direct = levels.find((level) => level.level === value);
    if (direct) return direct;
    const prefixed = levels.find((level) => level.level?.startsWith(`${value}.`));
    if (prefixed) return prefixed;
  }
  if (typeof value === 'number') {
    const byNumber = levels.find((level) => Number(level.level?.split('.')[0]) === value);
    if (byNumber) return byNumber;
    const index = Math.max(0, Math.min(value - 1, levels.length - 1));
    return levels[index];
  }
  return levels[0];
};

const collectImages = (level?: ExerciseLevel, exercise?: ProgramExerciseType, fallback: string[] = []) => {
  const candidates = [
    (level as any)?.imageUrl,
    (level as any)?.imageUrl2,
    (level as any)?.image1,
    (level as any)?.image2,
    (level as any)?.image3,
    (exercise as any)?.imageUrl,
    ...(Array.isArray(fallback) ? fallback : []),
  ];

  const sources: ExerciseImageSource[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const source = buildExerciseImageSource(candidate ?? null, {
      defaultWidth: 480,
      widths: [240, 360, 480, 640, 768],
      sizes: CARD_IMAGE_SIZES,
    });
    if (source && !seen.has(source.src)) {
      seen.add(source.src);
      sources.push(source);
    }
    if (sources.length >= 3) {
      break;
    }
  }

  return sources;
};

const normalizeLevelCode = (value: string | number | null | undefined): string | null => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).replace(',', '.').trim();
  return normalized || null;
};

const resolveLevelTier = (value: string | number | null | undefined): string | null => {
  const normalized = normalizeLevelCode(value);
  if (!normalized) return null;
  const [, sublevelRaw] = normalized.split('.');
  const sublevel = sublevelRaw ? Number(sublevelRaw) : NaN;
  if (!Number.isFinite(sublevel)) return null;
  if (sublevel <= 1) return 'Начальный';
  if (sublevel === 2) return 'Продвинутый';
  return 'Профессиональный';
};

const buildLevelLabel = (
  _code: string | null,
  title: string | null | undefined,
  fallback?: string | null,
): string | null => {
  return title ?? fallback ?? null;
};

function coalesceNumber(...values: Array<number | string | null | undefined>): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

const formatDate = (date: Date) => format(date, 'yyyy-MM-dd');

const initializeHeroBadge = () => {
  if (!hasProgram.value || !isTrainingDay.value || showHistoricalPlaceholder.value) {
    appStore.setHeroBadge('--');
  } else {
    appStore.setHeroBadge(format(selectedDate.value, 'dd'));
  }
};

const updateHeroState = () => {
  if (!hasProgram.value) {
    appStore.setHeroStatus(null);
    return;
  }
  if (isSameDay(selectedDate.value, new Date()) && trainingStarted.value && !trainingCompleted.value) {
    appStore.setHeroStatus('training');
  } else {
    appStore.setHeroStatus(null);
  }
};

const parseSessionNotes = (notes: any) => {
  if (!notes) return null;
  if (typeof notes === 'string') {
    try {
      return JSON.parse(notes);
    } catch (err) {
      console.warn('Не удалось разобрать сохранённые заметки тренировки', err);
      return null;
    }
  }
  if (typeof notes === 'object') return notes;
  return null;
};

const applySessionNotes = (notes: Record<string, any>) => {
  if (!notes) return;
  if (typeof notes.comment === 'string') {
    summaryComment.value = notes.comment;
  }
  if (Array.isArray(notes.results)) {
    const next: Record<string, number> = { ...exerciseResults.value };
    notes.results.forEach((result: any) => {
      if (result?.exerciseKey) {
        next[result.exerciseKey] = Number(result.actual) || 0;
      }
    });
    exerciseResults.value = next;
  }
  if (notes.timer) {
    timerSettings.value = {
      ...timerSettings.value,
      ...notes.timer,
    };
    if (typeof notes.timer.elapsedSeconds === 'number') {
      tabataElapsed.value = notes.timer.elapsedSeconds;
    }
  }
  if (typeof notes.trainingStarted === 'boolean') {
    trainingStarted.value = notes.trainingStarted;
  }
  if (typeof notes.trainingCompleted === 'boolean') {
    trainingCompleted.value = notes.trainingCompleted;
  }
};

const loadPersistedState = () => {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(storageKey.value);
    const sessionNotes = parseSessionNotes(session.value?.notes);
    if (!raw) {
      trainingStarted.value = session.value?.status === 'in_progress';
      trainingCompleted.value = session.value?.status === 'done';
      activeStage.value = trainingCompleted.value ? 'results' : 'workout';
      summaryComment.value = '';
      exerciseResults.value = {};
      timerSettings.value = {
        work: 40,
        rest: 20,
        restBetweenSets: 30,
        restBetweenExercises: 45,
        rounds: timerSettings.value.rounds,
      };
      tabataElapsed.value = 0;
      if (sessionNotes) {
        applySessionNotes(sessionNotes);
      }
      return;
    }
    const data = JSON.parse(raw) as Record<string, any>;
    trainingStarted.value = Boolean(data.trainingStarted);
    trainingCompleted.value = Boolean(data.trainingCompleted ?? session.value?.status === 'done');
    activeStage.value = (data.activeStage as StageId) ?? 'workout';
    summaryComment.value = data.summaryComment ?? '';
    exerciseResults.value = data.exerciseResults ?? {};
    timerSettings.value = { ...timerSettings.value, ...(data.timerSettings ?? {}) };
    tabataElapsed.value = data.tabataElapsed ?? 0;
    if (session.value?.status === 'done' && sessionNotes) {
      applySessionNotes(sessionNotes);
    }
  } catch (err) {
    console.warn('Не удалось загрузить сохранённое состояние тренировки', err);
  }
};

const persistUserState = () => {
  if (typeof window === 'undefined' || loading.value) return;
  const payload = {
    trainingStarted: trainingStarted.value,
    trainingCompleted: trainingCompleted.value,
    activeStage: activeStage.value,
    summaryComment: summaryComment.value,
    exerciseResults: exerciseResults.value,
    timerSettings: timerSettings.value,
    tabataElapsed: tabataElapsed.value,
  };
  window.localStorage.setItem(storageKey.value, JSON.stringify(payload));
};

const debouncedPersistUserState = debounce(persistUserState, 350);

const savePersistedState = (options?: { immediate?: boolean }) => {
  if (options?.immediate) {
    debouncedPersistUserState.cancel();
    persistUserState();
    return;
  }
  debouncedPersistUserState();
};

watch(selectedDate, async () => {
  try {
    await loadSessionForDate();
  } catch (err) {
    error.value = err as Error;
  }
  initializeHeroBadge();
  updateHeroState();
  loadPersistedState();
});

watch(storageKey, () => {
  loadPersistedState();
});

watch([hasProgram, isTrainingDay, showHistoricalPlaceholder], () => {
  initializeHeroBadge();
});

watch([trainingStarted, trainingCompleted, activeStage, exerciseResults, summaryComment, timerSettings], () => {
  savePersistedState();
}, { deep: true });

watch([trainingStarted, trainingCompleted], () => {
  updateHeroState();
}, { immediate: true });

watch(tabataElapsed, () => {
  savePersistedState({ immediate: true });
});

watch(exerciseCards, (cards) => {
  const nextResults: Record<string, number> = { ...exerciseResults.value };
  let mutated = false;
  const keys = new Set<string>();
  cards.forEach((card) => {
    keys.add(card.key);
    if (!(card.key in nextResults)) {
      nextResults[card.key] = 0;
      mutated = true;
    }
  });
  Object.keys(nextResults).forEach((key) => {
    if (!keys.has(key)) {
      delete nextResults[key];
      mutated = true;
    }
  });
  if (mutated) {
    exerciseResults.value = nextResults;
  }

  const nextMedia: Record<string, number> = {};
  cards.forEach((card) => {
    nextMedia[card.key] = mediaIndices.value[card.key] ?? 0;
  });
  mediaIndices.value = nextMedia;

  if (cards.length) {
    const targetRounds = Math.max(1, cards[0].sets ?? 1);
    if (timerSettings.value.rounds !== targetRounds) {
      timerSettings.value = { ...timerSettings.value, rounds: targetRounds };
    }
  }
}, { immediate: true });

watch(activeStage, (stage) => {
  if (stage !== 'workout' && isStageLocked(stage)) {
    activeStage.value = 'workout';
    return;
  }
  if (stage !== 'timer' && timerFocusMode.value) {
    timerFocusMode.value = false;
  }
});

watch(trainingCompleted, (done) => {
  if (done) {
    trainingStarted.value = false;
    timerFocusMode.value = false;
  }
});

watch(trainingStarted, (started) => {
  if (!started && !trainingCompleted.value) {
    timerFocusMode.value = false;
  }
});

watch(
  exerciseResults,
  (next, prev) => {
    if (!resultsHydrated) {
      resultsHydrated = true;
      return;
    }
    exerciseCards.value.forEach((card) => {
      const key = card.key;
      const previousValue = prev?.[key] ?? 0;
      const nextValue = next?.[key] ?? 0;
      const previousStatus = evaluateResultStatus(card, previousValue);
      const nextStatus = evaluateResultStatus(card, nextValue);
      if (nextStatus === 'success' && previousStatus !== 'success') {
        scheduleSpark(key);
      }
    });
  },
  { deep: true }
);

watch(programRevision, async () => {
  if (loading.value) {
    return;
  }
  syncProgramFromStore();
  initializeHeroBadge();
  updateHeroState();
  loadPersistedState();
  try {
    await loadSessionForDate();
  } catch (err) {
    error.value = err as Error;
  }
});

onMounted(() => {
  reloadAll();
  appStore.setOpenAdviceModal(() => {
    adviceModalOpen.value = true;
  });
});

onUnmounted(() => {
  appStore.setOpenAdviceModal(null);
  sparkTimers.forEach((timeout) => clearTimeout(timeout));
  sparkTimers.clear();
  timerFocusMode.value = false;
});

function extractProgramPlan(input: any): ProgramDay[] {
  if (!input) return [];
  let data = input;
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch (err) {
      console.warn('Не удалось разобрать план программы', err);
      return [];
    }
  }

  const resolveExerciseCollection = (item: any): any[] => {
    if (!item) return [];
    if (Array.isArray(item)) return item;
    if (typeof item !== 'object') return [];

    const candidates = [
      item.exercises,
      item.exercise,
      item.workouts,
      item.items,
      item.exercise_list,
      item.exerciseList,
      item.steps,
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate) && candidate.length) {
        return candidate;
      }
    }

    return [];
  };

  const normalizeExerciseImages = (exercise: any): string[] => {
    const pool: Array<string | undefined | null | string[]> = [
      exercise?.image,
      exercise?.imageUrl,
      exercise?.image_url,
      exercise?.preview,
      exercise?.media?.image,
      exercise?.media?.preview,
      exercise?.media?.images,
      exercise?.images,
      exercise?.photos,
    ];
    const images: string[] = [];
    const pushCandidate = (candidate: any) => {
      if (!candidate) return;
      if (Array.isArray(candidate)) {
        candidate.forEach(pushCandidate);
        return;
      }
      if (typeof candidate === 'string' && candidate.trim()) {
        images.push(candidate.trim());
      }
    };
    pool.forEach(pushCandidate);
    return images;
  };

  const normalizeExercises = (collection: any[]): PlanExercise[] =>
    (Array.isArray(collection) ? collection : resolveExerciseCollection(collection))
      .map((exercise: any) => {
        const key = String(exercise?.key ?? exercise?.exerciseKey ?? exercise?.id ?? '').trim();
        if (!key) {
          return null;
        }
        const target = typeof exercise?.target === 'object' ? exercise.target : {};
        const sets = coalesceNumber(
          exercise?.sets,
          exercise?.approach,
          exercise?.qty_sets,
          target?.sets,
          target?.approach,
        );
        const reps = coalesceNumber(
          exercise?.reps,
          exercise?.qty_reps,
          exercise?.count,
          target?.reps,
          target?.count,
        );
        const levelValue =
          exercise?.level ??
          exercise?.level_code ??
          exercise?.levelCode ??
          target?.level ??
          target?.levelCode ??
          target?.level_code ??
          null;
        const levelName =
          exercise?.levelLabel ??
          exercise?.level_label ??
          exercise?.levelTitle ??
          target?.levelLabel ??
          target?.level_name ??
          null;
        return {
          key,
          name: exercise?.name ?? exercise?.title ?? exercise?.label ?? null,
          level: levelValue,
          levelLabel: levelName,
          sets,
          reps,
          images: normalizeExerciseImages(exercise),
        } as PlanExercise;
      })
      .filter((exercise: PlanExercise | null): exercise is PlanExercise => Boolean(exercise && exercise.key));

  const resolveDayCandidate = (item: any): string | null => {
    if (!item || typeof item !== 'object') return null;
    return (
      item.day ??
      item.dayOfWeek ??
      item.day_of_week ??
      item.weekday ??
      item.title ??
      item.name ??
      item.label ??
      null
    );
  };

  const resolveSequenceIndex = (item: any, fallbackIndex: number): number => {
    const numericFields = [
      item?.sequence,
      item?.order,
      item?.orderIndex,
      item?.dayNumber,
      item?.day_number,
      item?.index,
      item?.dayIndex,
    ];
    for (const field of numericFields) {
      if (typeof field === 'number' && Number.isFinite(field)) {
        return Math.max(0, Math.round(field) - 1);
      }
    }
    const candidate = resolveDayCandidate(item);
    const fromValue = resolveCycleIndexFromValue(candidate);
    if (fromValue !== null) {
      return fromValue;
    }
    return fallbackIndex;
  };

  const collectPlanItems = (parsedData: any): any[] => {
    if (!parsedData) return [];
    if (Array.isArray(parsedData)) return parsedData;

    const directCandidates = [
      parsedData?.days,
      parsedData?.plan?.days,
      parsedData?.plan,
      parsedData?.program?.days,
      parsedData?.program?.plan,
      parsedData?.schedule,
      parsedData?.weekPlan,
      parsedData?.weeks,
      parsedData?.week,
      parsedData?.calendar,
    ];

    for (const candidate of directCandidates) {
      if (Array.isArray(candidate) && candidate.length) {
        return candidate;
      }
    }

    const aggregated: any[] = [];
    for (const candidate of directCandidates) {
      if (Array.isArray(candidate)) {
        aggregated.push(...candidate);
      } else if (candidate && typeof candidate === 'object' && Array.isArray(candidate.days)) {
        aggregated.push(...candidate.days);
      }
    }

    if (aggregated.length) {
      return aggregated;
    }

    if (parsedData && typeof parsedData === 'object') {
      for (const [key, value] of Object.entries(parsedData as Record<string, any>)) {
        if (Array.isArray(value)) {
          aggregated.push({ day: key, exercises: value });
        } else if (value && typeof value === 'object') {
          if (Array.isArray((value as any).days)) {
            aggregated.push(...(value as any).days);
          }
          const exercises = resolveExerciseCollection(value);
          if (exercises.length) {
            aggregated.push({
              ...value,
              day: value.day ?? value.dayOfWeek ?? value.day_of_week ?? key,
              exercises,
            });
          }
        }
      }
    }

    return aggregated;
  };

  const collection = collectPlanItems(data);

  return collection
    .map((item: any, index: number) => {
      if (!item) {
        return null;
      }
      const exercisesCollection = Array.isArray(item)
        ? normalizeExercises(item)
        : normalizeExercises(resolveExerciseCollection(item));

      const candidate = resolveDayCandidate(item) ?? (Array.isArray(item) ? null : (item as any).dayKey ?? null);
      const dayKey = normalizeDayKey(candidate);
      const cycleIndex = resolveCycleIndexFromValue(candidate) ?? resolveSequenceIndex(item, index);
      const explicitRest = Boolean(
        item?.rest ||
          item?.isRestDay ||
          item?.type === 'rest' ||
          (typeof candidate === 'string' && candidate.toLowerCase().includes('rest')),
      );
      const isRestDay = explicitRest || dayKey === 'rest' || !exercisesCollection.length;

      return {
        rawDay: candidate ? String(candidate) : null,
        dayKey,
        cycleIndex,
        label: item?.title ?? item?.name ?? null,
        isRestDay,
        exercises: isRestDay ? [] : exercisesCollection,
      } as ProgramDay;
    })
    .filter((day: ProgramDay | null): day is ProgramDay => Boolean(day && (day.isRestDay || day.exercises.length)));
}
</script>

<style scoped>
.today-page {
  position: relative;
  gap: clamp(1.5rem, 4vw, 2.5rem);
}

.today-page--focus .today-stage {
  position: relative;
}

.today-page--focus .today-stage > *:not(.stage-panel--focus) {
  filter: blur(2px);
  opacity: 0.35;
  pointer-events: none;
}

.today-page__focus-overlay {
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, rgba(12, 13, 16, 0.6) 50%, var(--color-surface) 40%);
  backdrop-filter: blur(6px);
  z-index: 20;
  cursor: pointer;
}

.today-page__focus-overlay::after {
  content: 'Нажмите, чтобы вернуться';
  position: absolute;
  inset: auto auto clamp(1.5rem, 4vw, 2.5rem) clamp(1rem, 4vw, 2rem);
  font-size: clamp(0.75rem, 2vw, 0.9rem);
  color: color-mix(in srgb, var(--color-text-secondary) 80%, transparent);
}

.today-page__header {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
}

.today-page__title {
  font-size: clamp(1.5rem, 4vw, 2rem);
  margin: 0;
}

.today-page__panel {
  min-height: 220px;
}

.training-placeholder {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  text-align: center;
  padding: clamp(1.5rem, 4vw, 2.25rem);
}

.training-placeholder__title {
  font-size: clamp(1.2rem, 3vw, 1.6rem);
  margin: 0;
}

.training-placeholder__message {
  margin: 0;
  color: var(--color-text-secondary);
}

.today-stage {
  display: flex;
  flex-direction: column;
  gap: clamp(1.25rem, 3vw, 2rem);
}

.training-day-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: clamp(1rem, 3vw, 2rem);
}

.training-day-header__info {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
}

.training-day-header__program {
  font-weight: 600;
  font-size: clamp(1rem, 2.4vw, 1.25rem);
}

.training-day-header__discipline {
  color: var(--color-text-secondary);
  font-size: clamp(0.85rem, 2vw, 0.95rem);
}

.training-day-header__cta {
  white-space: nowrap;
}

.training-day-header__status {
  padding: var(--space-xs) var(--space-md);  /* 0.4→0.5, 0.9→1 */
  border-radius: var(--radius-full, 999px);
  font-size: clamp(0.85rem, 2vw, 0.95rem);
  background-image: var(--gradient-accent-soft);
  color: var(--color-accent-contrast);
  box-shadow: 0 10px 24px color-mix(in srgb, var(--color-accent) 18%, transparent);
}

.training-day-header__status[data-complete='true'] {
  background-image: linear-gradient(135deg, color-mix(in srgb, var(--color-success) 65%, var(--color-text-inverse) 8%) 0%, var(--color-success) 80%);
  color: var(--color-text-inverse);
}

.session-source-hint {
  margin: -0.25rem 0 0;
  font-size: clamp(0.8rem, 1.8vw, 0.9rem);
  color: color-mix(in srgb, var(--color-text-secondary) 85%, transparent);
}

.stage-nav {
  display: flex;
  gap: var(--space-xs);  /* 0.4→0.5 close */
  padding: var(--space-2xs);
  border-radius: clamp(16px, 3vw, 22px);
  border: 1px solid transparent;
  background-image: linear-gradient(var(--panel-surface-base), var(--panel-surface-base)), var(--gradient-accent);
  background-origin: border-box;
  box-shadow: 0 18px 35px color-mix(in srgb, var(--color-accent) 12%, transparent);
}

.stage-nav__tab {
  flex: 1;
  background: color-mix(in srgb, var(--color-surface) 55%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-border) 40%, transparent);
  padding: var(--space-xs);  /* 0.55→0.5 close */
  font-size: clamp(0.85rem, 2vw, 0.95rem);
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  border-radius: clamp(12px, 2.5vw, 18px);
  transition: color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  position: relative;
  overflow: hidden;
}

.stage-nav__tab:hover,
.stage-nav__tab:focus-visible {
  color: var(--color-text-primary);
  outline: none;
}

.stage-nav__tab--active {
  color: var(--color-accent-contrast);
  border-color: transparent;
  background-image: var(--gradient-accent-highlight);
  box-shadow: 0 18px 32px color-mix(in srgb, var(--color-accent) 22%, transparent);
  font-weight: 600;
}

.stage-nav__tab--locked {
  color: var(--color-text-muted);
  opacity: 0.65;
}

.stage-panel {
  display: flex;
  flex-direction: column;
  gap: clamp(1rem, 2.5vw, 1.5rem);
}

.stage-panel--focus {
  position: relative;
  z-index: 30;
}

.exercise-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: clamp(1rem, 2vw, 1.5rem);
}

.exercise-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.exercise-card--achieved {
  border: 1px solid color-mix(in srgb, var(--color-success) 45%, transparent);
  box-shadow: 0 12px 24px -18px color-mix(in srgb, var(--color-success) 60%, transparent);
}

.exercise-card__spark {
  position: absolute;
  top: -14px;
  right: -14px;
  width: 42px;
  height: 42px;
  pointer-events: none;
  background: radial-gradient(circle, color-mix(in srgb, var(--color-accent) 70%, transparent) 0%, transparent 70%);
  opacity: 0;
  transform: scale(0.6) rotate(0deg);
  animation: spark-burst 0.9s ease-out forwards;
}

.exercise-card__media {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--color-surface);
  display: flex;
  align-items: center;
  justify-content: center;
}

.exercise-card__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.exercise-card__media--empty {
  color: var(--color-text-muted);
  font-size: clamp(0.85rem, 2vw, 0.95rem);
}

.exercise-card__dots {
  position: absolute;
  bottom: 0.5rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: var(--space-xs);  /* 0.4→0.5 */
}

.exercise-card__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-border) 70%, transparent);
  border: none;
  cursor: pointer;
}

.exercise-card__dot--active {
  background: var(--color-accent);
}

.exercise-card__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
}

.exercise-card__title {
  margin: 0;
  font-size: clamp(1rem, 2.4vw, 1.2rem);
  font-weight: 600;
}

.exercise-card__tier {
  margin: 0;
  font-size: clamp(0.8rem, 2vw, 0.9rem);
  color: color-mix(in srgb, var(--color-text-secondary) 80%, transparent);
}

.exercise-card__sets {
  margin: 0;
  font-size: clamp(0.85rem, 2vw, 0.95rem);
  color: var(--color-text-secondary);
}

.missing-data-card {
  border-radius: var(--radius-lg);
  padding: clamp(0.85rem, 2vw, 1.1rem);
  background: color-mix(in srgb, var(--color-warning-soft) 35%, transparent);
  color: var(--color-warning);
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.missing-data-card h4 {
  margin: 0;
  font-size: clamp(0.95rem, 2vw, 1.05rem);
}

.missing-data-card ul {
  margin: 0;
  padding-left: 1.2rem;
  color: var(--color-text-secondary);
}

.stage-placeholder {
  border-radius: var(--radius-xl);
  padding: clamp(1.2rem, 3vw, 1.6rem);
  background: color-mix(in srgb, var(--color-surface) 60%, transparent);
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  text-align: left;
}

.stage-placeholder--muted {
  color: var(--color-text-secondary);
}

.stage-placeholder--locked {
  background: color-mix(in srgb, var(--color-border) 45%, transparent);
  color: var(--color-text-secondary);
}

.stage-placeholder--info {
  margin-top: 1rem;
  margin-bottom: 1rem;
  background: var(--color-bg-secondary);
  border-radius: 8px;
}

.stage-placeholder--info p {
  color: var(--color-text-secondary);
  font-size: 0.875rem;
}

.stage-placeholder h3 {
  margin: 0;
  font-size: clamp(1rem, 2.4vw, 1.2rem);
}

.stage-placeholder p {
  margin: 0;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: clamp(0.85rem, 2vw, 1rem);
}

.results-row {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: clamp(0.85rem, 2vw, 1rem);
  padding: clamp(0.75rem, 2vw, 1rem);
  border-radius: var(--radius-lg);
  border: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent);
  background: color-mix(in srgb, var(--color-surface) 55%, transparent);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.results-row--pending {
  border-color: color-mix(in srgb, var(--color-border) 80%, transparent);
}

.results-row--success {
  border-color: color-mix(in srgb, var(--color-success) 45%, transparent);
  background: color-mix(in srgb, var(--color-success-soft) 35%, transparent);
}

.results-row--danger {
  border-color: color-mix(in srgb, var(--color-danger) 35%, transparent);
  background: color-mix(in srgb, var(--color-danger-soft) 30%, transparent);
}

.results-row--spark {
  box-shadow: 0 12px 24px -18px color-mix(in srgb, var(--color-accent) 55%, transparent);
}

.results-row__spark {
  position: absolute;
  top: -10px;
  right: -10px;
  width: 32px;
  height: 32px;
  pointer-events: none;
  background: radial-gradient(circle, color-mix(in srgb, var(--color-accent) 70%, transparent) 0%, transparent 70%);
  opacity: 0;
  transform: scale(0.6) rotate(0deg);
  animation: spark-burst 0.9s ease-out forwards;
}

.results-row__info {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
}

.results-row__info h4 {
  margin: 0;
  font-size: clamp(0.95rem, 2vw, 1.05rem);
}

.results-row__info span {
  color: var(--color-text-secondary);
}

.results-row__input {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
  font-size: clamp(0.8rem, 2vw, 0.9rem);
}

.results-row__input input {
  border-radius: var(--radius-md);
  border: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent);
  padding: var(--space-xs) var(--space-sm);  /* 0.4→0.5, 0.6→0.75 */
  font-size: clamp(0.85rem, 2vw, 0.95rem);
  width: min(140px, 40vw);
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: clamp(1rem, 2.5vw, 1.25rem);
}

.summary-card textarea {
  min-height: 90px;
  border-radius: var(--radius-md);
  border: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent);
  padding: var(--space-sm) var(--space-sm);  /* 0.6→0.75 */
  resize: vertical;
  font-size: clamp(0.85rem, 2vw, 0.95rem);
}

.summary-card__submit {
  align-self: flex-end;
}

.post-session-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);  /* 0.85→1 close */
  padding: clamp(1rem, 2.5vw, 1.25rem);
}

.post-session-card__title {
  margin: 0;
  font-size: clamp(1rem, 2.4vw, 1.2rem);
}

.post-session-card__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: clamp(0.75rem, 2vw, 1rem);
}

.post-session-card__item {
  border-radius: var(--radius-lg);
  padding: clamp(0.75rem, 2vw, 1rem);
  background: color-mix(in srgb, var(--color-surface) 60%, transparent);
  border-left: 3px solid color-mix(in srgb, var(--color-border) 75%, transparent);
}

.post-session-card__item--calm {
  border-left-color: color-mix(in srgb, var(--color-accent) 30%, transparent);
}

.post-session-card__item--drive {
  border-left-color: color-mix(in srgb, var(--color-accent) 70%, transparent);
  background: color-mix(in srgb, var(--color-accent) 10%, transparent);
}

.post-session-card__item h4 {
  margin: 0 0 0.35rem;
  font-size: clamp(0.95rem, 2vw, 1.05rem);
}

.post-session-card__item p {
  margin: 0;
  color: var(--color-text-secondary);
}

@keyframes spark-burst {
  0% {
    opacity: 0;
    transform: scale(0.4) rotate(0deg);
  }
  30% {
    opacity: 1;
    transform: scale(1) rotate(12deg);
  }
  70% {
    opacity: 0.75;
    transform: scale(0.85) rotate(-8deg);
  }
  100% {
    opacity: 0;
    transform: scale(1.15) rotate(4deg);
  }
}

@media (max-width: 640px) {
  .today-page {
    padding-bottom: calc(var(--footer-height) + env(safe-area-inset-bottom) + 12px);
  }

  .training-day-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .training-day-header__cta {
    width: 100%;
  }

  .stage-nav {
    overflow-x: auto;
    gap: var(--space-2xs);
    padding: 0 0.25rem 0.35rem;
    margin: 0 -0.25rem;
    scrollbar-width: thin;
  }

  .stage-nav__tab {
    flex: 0 0 auto;
    min-width: 130px;
    scroll-snap-align: start;
  }

  .stage-panel {
    gap: var(--space-md);  /* 0.9→1 close */
  }

  .exercise-grid {
    grid-template-columns: 1fr;
  }

  .results-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .results-row__input input {
    width: 100%;
  }
}
</style>
