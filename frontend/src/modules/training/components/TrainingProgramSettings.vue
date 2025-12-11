<template>
  <div class="training-settings">
    <header class="training-settings__header">
      <div class="training-settings__titles">
        <h2 class="training-settings__title">Настройка программы тренировок</h2>
        <p class="training-settings__subtitle">Выберите направление, программу и стартовые уровни упражнений.</p>
      </div>
      <button
        v-if="hasProgress"
        type="button"
        class="training-settings__reset"
        @click="resetState()"
      >
        Начать заново
      </button>
    </header>

    <div class="training-settings__steps">
      <div class="steps-layout">
        <template v-for="(step, index) in steps" :key="`step-${step.id}`">
          <button
            type="button"
            class="step-indicator"
            :class="{
              'step-indicator--active': currentStep === step.id,
              'step-indicator--completed': isStepCompleted(step.id) && currentStep !== step.id,
              'step-indicator--clickable': currentStep !== step.id && (currentStep > step.id || canGoToStep(step.id))
            }"
            :style="{ gridColumn: `${index * 2 + 1} / span 1` }"
            @click="goToStep(step.id)"
          >
            <span class="step-indicator__number">{{ step.id }}</span>
            <span class="step-indicator__label">{{ step.label }}</span>
          </button>
          <div
            v-if="index < steps.length - 1"
            class="step-connector"
            :class="{ 'step-connector--active': isConnectorActive(step.id) }"
            :style="{ gridColumn: `${index * 2 + 2} / span 1` }"
            aria-hidden="true"
          >
            <span class="step-connector__line"></span>
            <span class="step-connector__arrow"></span>
          </div>
        </template>
      </div>
    </div>

    <div class="training-settings__content">
      <div v-show="currentStep === 1" class="settings-step">
        <div class="step-content">
          <h3 class="step-title">Выберите направление тренировок</h3>
          <p class="step-description">Ознакомьтесь с полным перечнем направлений</p>

          <LoadingState
            v-if="loadingDisciplines"
            inline
            title="Загружаем направления…"
            description="Готовим список дисциплин"
            :skeleton-count="3"
            :skeleton-lines="2"
          />

          <div v-else-if="error" class="error-state">
            <p>{{ error }}</p>
            <button @click="loadDisciplines" class="retry-btn" type="button">Попробовать снова</button>
          </div>

          <div v-else class="disciplines-grid">
            <button
              v-for="discipline in disciplines"
              :key="discipline.id"
              type="button"
              class="discipline-card program-button"
              :class="{ 'discipline-card--selected': selectedDiscipline?.id === discipline.id || isDisciplineSelected(discipline.id) }"
              :style="{ ...getDisciplineCardStyle(discipline), ...getCard3DStyle(`discipline-${discipline.id}`) }"
              @click="selectDiscipline(discipline)"
              @mousemove="(e) => handle3DMouseMove(e, `discipline-${discipline.id}`)"
              @mouseleave="() => handle3DMouseLeave(`discipline-${discipline.id}`)"
              :aria-pressed="selectedDiscipline?.id === discipline.id || isDisciplineSelected(discipline.id)"
            >
              <div
                v-if="selectedDiscipline?.id === discipline.id || isDisciplineSelected(discipline.id)"
                class="program-card__check discipline-card__check"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <div class="program-title">{{ discipline.name }}</div>
              <div v-if="discipline.description" class="program-subtitle">{{ discipline.description }}</div>
            </button>
          </div>
        </div>
      </div>

      <div v-show="currentStep === 2" class="settings-step">
        <div class="step-content">
          <h3 class="step-title">Выберите программу тренировок</h3>
          <p class="step-description">{{ selectedDiscipline?.name }}</p>

          <LoadingState
            v-if="loadingPrograms"
            inline
            title="Загружаем программы…"
            description="Проверяем доступные планы для выбранного направления"
            :skeleton-count="3"
            :skeleton-lines="2"
          />

          <div v-else-if="programError" class="error-state">
            <p>{{ programError }}</p>
            <button @click="loadPrograms" class="retry-btn" type="button">Попробовать снова</button>
          </div>

          <div v-else class="programs-list">
            <button
              v-for="program in programs"
              :key="program.id"
              type="button"
              class="program-card training-program-card"
              :class="{
                'program-card--selected': selectedProgram?.id === program.id || isProgramSelected(program.id),
                'training-program-card--visible': true,
                'training-program-card--active': selectedProgram?.id === program.id || isProgramSelected(program.id)
              }"
              :style="{ ...getProgramCardStyle(program), ...getCard3DStyle(`program-${program.id}`) }"
              @click="selectProgram(program)"
              @mousemove="(e) => handle3DMouseMove(e, `program-${program.id}`)"
              @mouseleave="() => handle3DMouseLeave(`program-${program.id}`)"
              :aria-pressed="selectedProgram?.id === program.id || isProgramSelected(program.id)"
            >
              <div class="training-program-content">
                <h4 class="training-program-title">{{ program.name }}</h4>
                <p v-if="program.description" class="training-program-description">
                  {{ program.description }}
                </p>
              </div>
              <div v-if="selectedProgram?.id === program.id || isProgramSelected(program.id)" class="program-card__check">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </button>
          </div>
        </div>
      </div>

      <div v-show="currentStep === 3" class="settings-step">
        <div class="step-content">
          <h3 class="step-title">Выберите начальные уровни упражнений</h3>
          <p class="step-description">Уровень, с которого вы начнете для каждого упражнения</p>

          <LoadingState
            v-if="loadingExercises"
            inline
            title="Загружаем упражнения…"
            description="Подготавливаем стартовые уровни для программы"
            :skeleton-count="4"
            :skeleton-lines="2"
          />

          <div v-else-if="exercisesError" class="error-state">
            <p>{{ exercisesError }}</p>
            <button @click="loadExercises" class="retry-btn" type="button">Попробовать снова</button>
          </div>

          <div v-else class="exercises-levels-list">
            <div
              v-for="(exercise, index) in exercises"
              :key="exercise.exerciseKey"
              class="exercise-level-item program-exercise-card"
              :class="{ 'exercise-level-item--selected': selectedLevels[exercise.exerciseKey] !== undefined }"
              :style="{ ...getExerciseCardStyle(exercise, index), ...getCard3DStyle(`exercise-${exercise.exerciseKey}`) }"
              @mousemove="(e) => handle3DMouseMove(e, `exercise-${exercise.exerciseKey}`)"
              @mouseleave="() => handle3DMouseLeave(`exercise-${exercise.exerciseKey}`)"
            >
              <div class="exercise-level-header">
                <div 
                  class="program-exercise-icon"
                  :class="{ 'program-exercise-icon--has-image': exercise.iconUrl }"
                >
                  <img 
                    v-if="exercise.iconUrl"
                    :src="exercise.iconUrl"
                    :alt="exercise.title"
                    class="program-exercise-icon__img"
                    loading="lazy"
                  />
                  <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                    <path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </div>
                <div class="exercise-level-header__body">
                  <div class="program-exercise-title">{{ exercise.title }}</div>
                  <div class="program-exercise-meta">
                    <span class="program-exercise-meta__label">Стартовый уровень</span>
                    <span class="program-exercise-meta__value">{{ getLevelValue(exercise.exerciseKey) }}</span>
                  </div>
                </div>
              </div>
              <div class="exercise-level-controller">
                <div
                  class="level-segments"
                  role="group"
                  :aria-label="`Выбор уровня для ${exercise.title}`"
                >
                  <button
                    v-for="level in LEVELS"
                    :key="level"
                    type="button"
                    class="level-segment"
                    :class="{
                      'level-segment--filled': level <= getLevelValue(exercise.exerciseKey),
                      'level-segment--current': level === getLevelValue(exercise.exerciseKey)
                    }"
                    @click.stop="selectLevel(exercise.exerciseKey, level)"
                    :aria-label="`Установить уровень ${level}`"
                    :aria-pressed="getLevelValue(exercise.exerciseKey) === level"
                  >
                    <span class="sr-only">Уровень {{ level }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div v-if="canConfirm" class="step-actions">
            <div class="step-actions__buttons">
              <button
                v-if="showUpdateButton && !showAddButton"
                type="button"
                class="step-confirm-btn step-confirm-btn--update"
                :disabled="saving"
                @click="updateSelection"
              >
                <span v-if="saving">Сохранение...</span>
                <span v-else>Изменить</span>
              </button>
              <template v-else-if="showAddButton">
                <button
                  type="button"
                  class="step-confirm-btn step-confirm-btn--update"
                  :disabled="saving"
                  @click="updateSelection"
                >
                  <span v-if="saving">Сохранение...</span>
                  <span v-else>Изменить</span>
                </button>
                <button
                  type="button"
                  class="step-confirm-btn step-confirm-btn--add"
                  :disabled="saving"
                  @click="addSelection"
                >
                  <span v-if="saving">Сохранение...</span>
                  <span v-else>Добавить</span>
                </button>
              </template>
              <button
                v-else-if="showSaveButton"
                type="button"
                class="step-confirm-btn"
                :disabled="saving"
                @click="confirmSelection"
              >
                <span v-if="saving">Сохранение...</span>
                <span v-else>Зафиксировать данные</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { cachedApiClient as apiClient } from '@/services/cachedApi';
import {
  mixColors,
  lightenColor,
  getDisciplineColor,
  generateDisciplineGradient,
  getExerciseColor,
  getProgramColor as _getProgramColor,
} from '@/utils/colorUtils';
import LoadingState from '@/modules/shared/components/LoadingState.vue';
import ErrorHandler from '@/services/errorHandler';
import type {
  TrainingDiscipline,
  TrainingProgram,
  ProgramExercise,
  UserProgramSnapshot,
  UserProgramLevels,
} from '@/types';

const props = defineProps<{ active: boolean }>();

const emit = defineEmits<{
  'program-selected': [data: {
    discipline: TrainingDiscipline;
    program: TrainingProgram;
    exercises: ProgramExercise[];
    initialLevels: Record<string, number>;
    action?: 'save' | 'update' | 'create';
  }];
}>();

const steps = [
  { id: 1, label: 'Направление' },
  { id: 2, label: 'Программа' },
  { id: 3, label: 'Уровни' },
] as const;
type StepId = typeof steps[number]['id'];

const LEVEL_MIN = 1;
const LEVEL_MAX = 10;
const LEVELS = Array.from({ length: LEVEL_MAX - LEVEL_MIN + 1 }, (_, index) => LEVEL_MIN + index);
const normalizeLevelValue = (raw: UserProgramLevels[string] | undefined): number => {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  if (raw && typeof raw === 'object') {
    if (typeof raw.level === 'number') {
      return raw.level;
    }
    if (typeof raw.currentLevel === 'number') {
      return raw.currentLevel;
    }
  }
  return LEVEL_MIN;
};
const normalizeLevelMap = (levels?: UserProgramLevels | null): Record<string, number> => {
  if (!levels) {
    return {};
  }
  return Object.entries(levels).reduce<Record<string, number>>((acc, [key, value]) => {
    acc[key] = normalizeLevelValue(value);
    return acc;
  }, {});
};

const currentStep = ref<StepId>(1);
const selectedDiscipline = ref<TrainingDiscipline | null>(null);
const selectedProgram = ref<TrainingProgram | null>(null);
const selectedLevels = ref<Record<string, number>>({});

// Сохраненная программа из БД
const savedUserProgram = ref<UserProgramSnapshot | null>(null);
const savedInitialLevels = ref<UserProgramLevels>({});

const disciplines = ref<TrainingDiscipline[]>([]);
const programs = ref<TrainingProgram[]>([]);
const exercises = ref<ProgramExercise[]>([]);

const loadingDisciplines = ref(false);
const loadingPrograms = ref(false);
const loadingExercises = ref(false);
const loadingUserProgram = ref(false);
const saving = ref(false);

const error = ref<string | null>(null);
const programError = ref<string | null>(null);
const exercisesError = ref<string | null>(null);

const card3DHover = ref<Record<string, { rotateX: number; rotateY: number }>>({});
const pending3DUpdates = new Map<string, { rotateX: number; rotateY: number }>();
let raf3DId: number | null = null;

const initialized = ref(false);

// Определяем, что уже выбрано из БД
const isDisciplineSelected = (disciplineId: string) => {
  return savedUserProgram.value?.disciplineId === disciplineId;
};

const isProgramSelected = (programId: string) => {
  return savedUserProgram.value?.programId === programId;
};

const getDisciplineId = (discipline: TrainingDiscipline | null | undefined): string | null => {
  if (!discipline) {
    return null;
  }
  return discipline.id ?? null;
};

const normalizeProgramPayload = (payload: unknown): TrainingProgram[] => {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is TrainingProgram => Boolean((item as TrainingProgram | undefined)?.id));
  }
  if (payload && typeof payload === 'object') {
    if (Array.isArray((payload as any).items)) {
      return (payload as any).items.filter((item: unknown): item is TrainingProgram => Boolean((item as any)?.id));
    }
    if (Array.isArray((payload as any).data)) {
      return (payload as any).data.filter((item: unknown): item is TrainingProgram => Boolean((item as any)?.id));
    }
    if (Array.isArray((payload as any).programs)) {
      return (payload as any).programs.filter((item: unknown): item is TrainingProgram => Boolean((item as any)?.id));
    }
  }
  return [];
};

const mergeWithSelectedProgram = (list: TrainingProgram[]): TrainingProgram[] => {
  const current = selectedProgram.value;
  if (current?.id && !list.some((entry) => entry?.id === current.id)) {
    return [current, ...list];
  }
  return list;
};

// Определяем логику кнопок
const showUpdateButton = computed(() => {
  // Показываем кнопку "Изменить", если:
  // 1. Есть сохраненная программа
  // 2. И выбрано то же направление (независимо от программы)
  if (!savedUserProgram.value || !selectedDiscipline.value) {
    return false;
  }
  return savedUserProgram.value.disciplineId === selectedDiscipline.value.id;
});

const showAddButton = computed(() => {
  // Показываем кнопку "Добавить", если:
  // 1. Есть сохраненная программа
  // 2. Выбрано то же направление, но другая программа
  if (!savedUserProgram.value || !selectedDiscipline.value || !selectedProgram.value) {
    return false;
  }
  return savedUserProgram.value.disciplineId === selectedDiscipline.value.id &&
         savedUserProgram.value.programId !== selectedProgram.value.id;
});

const showSaveButton = computed(() => {
  // Показываем кнопку "Зафиксировать данные", если:
  // 1. Нет сохраненной программы (новое направление)
  // 2. Или выбрано новое направление
  if (!savedUserProgram.value) {
    return true;
  }
  if (!selectedDiscipline.value) {
    return false;
  }
  return savedUserProgram.value.disciplineId !== selectedDiscipline.value.id;
});

const canConfirm = computed(() => {
  return exercises.value.length > 0 &&
    exercises.value.every((ex: ProgramExercise) => selectedLevels.value[ex.exerciseKey] !== undefined);
});

const stepCompletion = computed<Record<StepId, boolean>>(() => ({
  1: Boolean(selectedDiscipline.value),
  2: Boolean(selectedProgram.value),
  3: canConfirm.value,
}));

const isStepCompleted = (stepNumber: StepId) => {
  return stepCompletion.value[stepNumber];
};

const isConnectorActive = (stepNumber: StepId) => {
  if (stepNumber === 1) {
    return Boolean(selectedDiscipline.value);
  }
  if (stepNumber === 2) {
    return Boolean(selectedProgram.value);
  }
  return false;
};

const hasProgress = computed(() => {
  return Boolean(selectedDiscipline.value || selectedProgram.value || Object.keys(selectedLevels.value).length);
});

const loadDisciplines = async () => {
  if (loadingDisciplines.value) return;
  loadingDisciplines.value = true;
  error.value = null;
  try {
    const data = await apiClient.getTrainingDisciplines();
    disciplines.value = Array.isArray(data) ? data : [];
  } catch (err: any) {
    error.value = 'Не удалось загрузить направления тренировок';
    ErrorHandler.handleWithToast(err, 'TrainingProgramSettings.loadDisciplines');
  } finally {
    loadingDisciplines.value = false;
  }
};

const loadPrograms = async () => {
  if (loadingPrograms.value) return;

  const disciplineId =
    getDisciplineId(selectedDiscipline.value) ??
    savedUserProgram.value?.disciplineId ??
    null;

  if (!disciplineId) {
    programs.value = mergeWithSelectedProgram([]);
    return;
  }

  loadingPrograms.value = true;
  programError.value = null;
  try {
    const data = await apiClient.getTrainingPrograms(disciplineId);
    const normalized = normalizeProgramPayload(data);
    programs.value = mergeWithSelectedProgram(normalized);
  } catch (err: any) {
    programError.value = 'Не удалось загрузить программы тренировок';
    programs.value = mergeWithSelectedProgram([]);
    ErrorHandler.handleWithToast(err, 'TrainingProgramSettings.loadPrograms');
  } finally {
    loadingPrograms.value = false;
  }
};

const loadExercises = async () => {
  if (!selectedProgram.value || !selectedProgram.value.id || loadingExercises.value) return;

  loadingExercises.value = true;
  exercisesError.value = null;
  try {
    const data = await apiClient.getProgramExercises(selectedProgram.value.id);
    exercises.value = Array.isArray(data) ? data : [];

    const nextLevels: Record<string, number> = { ...selectedLevels.value };
    
    // Если меняется программа в рамках одного направления, сохраняем уровни для одинаковых упражнений
    if (savedUserProgram.value && 
        savedUserProgram.value.disciplineId === selectedDiscipline.value?.id &&
        savedUserProgram.value.programId !== selectedProgram.value.id) {
      // Загружаем упражнения из старой программы для сохранения уровней
      try {
        const oldExercises = await apiClient.getProgramExercises(savedUserProgram.value.programId);
        const oldExerciseKeys = new Set(
          Array.isArray(oldExercises) ? oldExercises.map((ex: ProgramExercise) => ex.exerciseKey) : []
        );

        // Сохраняем уровни для одинаковых упражнений
        exercises.value.forEach((ex: ProgramExercise) => {
          if (oldExerciseKeys.has(ex.exerciseKey) && savedInitialLevels.value[ex.exerciseKey] !== undefined) {
            nextLevels[ex.exerciseKey] = normalizeLevelValue(savedInitialLevels.value[ex.exerciseKey]);
          } else if (nextLevels[ex.exerciseKey] === undefined) {
            nextLevels[ex.exerciseKey] = LEVEL_MIN;
          }
        });
      } catch (err) {
        console.warn('Failed to load old exercises for level preservation:', err);
      }
    }
    
    exercises.value.forEach((ex: ProgramExercise) => {
      if (nextLevels[ex.exerciseKey] === undefined) {
        nextLevels[ex.exerciseKey] = LEVEL_MIN;
      }
    });
    selectedLevels.value = nextLevels;
  } catch (err: any) {
    exercisesError.value = 'Не удалось загрузить упражнения';
    ErrorHandler.handleWithToast(err, 'TrainingProgramSettings.loadExercises');
  } finally {
    loadingExercises.value = false;
  }
};

// Загрузка сохраненной программы из БД (с кэшем для быстрой загрузки)
const loadUserProgram = async () => {
  if (loadingUserProgram.value) return;
  loadingUserProgram.value = true;
  try {
    // Используем кэшированный API для быстрой загрузки
    const userProgram = await apiClient.getUserProgram();
    savedUserProgram.value = userProgram;
    savedInitialLevels.value = userProgram.initialLevels || {};
    
    // Загружаем данные параллельно для ускорения
    // Устанавливаем выбранные элементы из БД
    if (userProgram.discipline) {
      selectedDiscipline.value = userProgram.discipline;
      // Загружаем программы для выбранного направления
      await loadPrograms();
    }
    if (userProgram.program && userProgram.program.id) {
      selectedProgram.value = userProgram.program;
      // Загружаем упражнения для выбранной программы
      // Проверяем, что selectedProgram установлен перед загрузкой упражнений
      if (selectedProgram.value && selectedProgram.value.id) {
        await loadExercises();
      }
    }
    if (userProgram.initialLevels) {
      selectedLevels.value = normalizeLevelMap(userProgram.initialLevels);
    }
  } catch (err: any) {
    // Если пользователь не авторизован (401), это нормально - просто не загружаем данные
    if (err.code === 'AUTHENTICATION_ERROR' || 
        err.message?.includes('401') ||
        err.message?.includes('аутентификации') ||
        err.message?.includes('Unauthorized')) {
      // Пользователь еще не авторизован - это нормально
      savedUserProgram.value = null;
      savedInitialLevels.value = {};
      return;
    }
    
    // Если программы нет в БД (404) или серверная ошибка (500), это нормально
    if (err.code === 'NOT_FOUND_ERROR' || 
        err.code === 'SERVER_ERROR' ||
        err.message?.includes('not_found') || 
        err.message?.includes('404') ||
        err.message?.includes('500') ||
        err.message?.includes('не найден') ||
        err.message?.includes('недоступен') ||
        err.message?.includes('database_unavailable')) {
      savedUserProgram.value = null;
      savedInitialLevels.value = {};
    } else {
      ErrorHandler.handleWithToast(err, 'TrainingProgramSettings.loadUserProgram');
    }
  } finally {
    loadingUserProgram.value = false;
  }
};

const selectDiscipline = (discipline: TrainingDiscipline) => {
  if (selectedDiscipline.value?.id === discipline.id) return;
  selectedDiscipline.value = discipline;
};

const selectProgram = (program: TrainingProgram) => {
  if (selectedProgram.value?.id === program.id) return;
  selectedProgram.value = program;
};

const selectLevel = (exerciseKey: string, level: number) => {
  selectedLevels.value = {
    ...selectedLevels.value,
    [exerciseKey]: level,
  };
};

const getLevelValue = (exerciseKey: string) => {
  return selectedLevels.value[exerciseKey] ?? LEVEL_MIN;
};

const resetState = (preserveDisciplines = true) => {
  currentStep.value = 1;
  selectedDiscipline.value = null;
  selectedProgram.value = null;
  selectedLevels.value = {};
  programError.value = null;
  exercisesError.value = null;
  if (!preserveDisciplines) {
    disciplines.value = [];
  }
  programs.value = [];
  exercises.value = [];
  card3DHover.value = {};
  pending3DUpdates.clear();
  if (raf3DId !== null) {
    cancelAnimationFrame(raf3DId);
    raf3DId = null;
  }
};

const confirmSelection = async () => {
  if (!canConfirm.value || saving.value) return;
  const discipline = selectedDiscipline.value;
  const program = selectedProgram.value;
  if (!discipline || !program) return;

  saving.value = true;
  try {
    emit('program-selected', {
      discipline,
      program,
      exercises: exercises.value,
      initialLevels: selectedLevels.value,
      action: 'save', // По умолчанию сохраняем
    });

    resetState();
  } catch (err: any) {
    ErrorHandler.handleWithToast(err, 'TrainingProgramSettings.saveProgram');
  } finally {
    saving.value = false;
  }
};

const updateSelection = async () => {
  if (!canConfirm.value || saving.value) return;
  const discipline = selectedDiscipline.value;
  const program = selectedProgram.value;
  if (!discipline || !program) return;

  saving.value = true;
  try {
    emit('program-selected', {
      discipline,
      program,
      exercises: exercises.value,
      initialLevels: selectedLevels.value,
      action: 'update', // Обновляем существующую
    });

    resetState();
  } catch (err: any) {
    ErrorHandler.handleWithToast(err, 'TrainingProgramSettings.updateProgram');
  } finally {
    saving.value = false;
  }
};

const addSelection = async () => {
  if (!canConfirm.value || saving.value) return;
  const discipline = selectedDiscipline.value;
  const program = selectedProgram.value;
  if (!discipline || !program) return;

  saving.value = true;
  try {
    emit('program-selected', {
      discipline,
      program,
      exercises: exercises.value,
      initialLevels: selectedLevels.value,
      action: 'create', // Создаем новую запись
    });

    resetState();
  } catch (err: any) {
    ErrorHandler.handleWithToast(err, 'TrainingProgramSettings.addProgram');
  } finally {
    saving.value = false;
  }
};

const canGoToStep = (step: StepId): boolean => {
  if (step === 1) return true;
  if (step === 2) return selectedDiscipline.value !== null;
  if (step === 3) return selectedDiscipline.value !== null && selectedProgram.value !== null;
  return false;
};

const goToStep = (step: StepId) => {
  if (!canGoToStep(step)) return;
  currentStep.value = step;

  if (step === 2 && !programs.value.length && selectedDiscipline.value) {
    loadPrograms();
  } else if (step === 3 && !exercises.value.length && selectedProgram.value) {
    loadExercises();
  }
};

const handle3DMouseMove = (e: MouseEvent, cardId: string) => {
  const card = e.currentTarget as HTMLElement;
  if (!card) return;

  const rect = card.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const maxRotateX = 8;
  const maxRotateY = 8;

  const rotateY = ((mouseX / rect.width) - 0.5) * 2 * maxRotateY;
  const rotateX = -((mouseY / rect.height) - 0.5) * 2 * maxRotateX;

  const clampedRotateX = Math.max(-maxRotateX, Math.min(maxRotateX, rotateX));
  const clampedRotateY = Math.max(-maxRotateY, Math.min(maxRotateY, rotateY));

  pending3DUpdates.set(cardId, { rotateX: clampedRotateX, rotateY: clampedRotateY });

  if (raf3DId === null) {
    raf3DId = requestAnimationFrame(() => {
      pending3DUpdates.forEach((value, id) => {
        card3DHover.value[id] = value;
      });
      pending3DUpdates.clear();
      raf3DId = null;
    });
  }
};

const handle3DMouseLeave = (cardId: string) => {
  card3DHover.value[cardId] = { rotateX: 0, rotateY: 0 };
};

const getCard3DStyle = (cardId: string) => {
  const hover = card3DHover.value[cardId];
  if (!hover || (hover.rotateX === 0 && hover.rotateY === 0)) {
    return {};
  }

  return {
    transform: `perspective(1000px) rotateX(${hover.rotateX}deg) rotateY(${hover.rotateY}deg) translateZ(0)`,
    transition: 'transform 0.1s linear',
  };
};

const disciplineGradientsCache = new Map<string, ReturnType<typeof generateDisciplineGradient>>();

const getDisciplineGradientCached = (disciplineId: string, disciplineName: string): ReturnType<typeof generateDisciplineGradient> => {
  const key = `${disciplineId}_${disciplineName}`;
  if (!disciplineGradientsCache.has(key)) {
    const primaryColor = getDisciplineColor(disciplineId, disciplineName);
    disciplineGradientsCache.set(key, generateDisciplineGradient(primaryColor));
  }
  return disciplineGradientsCache.get(key)!;
};

const getDisciplineCardStyle = (_discipline: TrainingDiscipline | null) => {
  // Always use theme colors for consistency with presets
  return {
    '--program-border-color': 'var(--color-border)',
    '--program-title-color': 'var(--color-accent)',
    '--program-subtitle-color': 'var(--color-text-secondary)',
    '--program-bg-color': 'var(--color-bg)',
    '--program-bg-soft-color': 'var(--color-bg-secondary)',
    '--program-nav-color': 'var(--color-accent)',
    '--accent-color-base': 'var(--color-accent)',
    '--program-gradient-start': 'var(--color-bg)',
    '--program-gradient-mid': 'var(--color-bg-secondary)',
    '--program-gradient-end': 'var(--color-bg-elevated)',
  };
};

const getProgramCardStyle = (_program: TrainingProgram | null) => {
  // Always use theme colors for consistency with presets
  return {
    '--training-program-bg': 'var(--color-bg)',
    '--training-program-border': 'var(--color-border)',
    '--training-program-title-color': 'var(--color-text-primary)',
    '--training-program-description-color': 'var(--color-text-secondary)',
    '--accent-color-base': 'var(--color-accent)',
  };
};

// Removed: exerciseCardColors, _getColorFromString, _hexToRgba - unused color utilities

const exerciseCardShadowVariants = [
  { offsetX: 0, offsetY: 18, blur: 32, spread: -14, alpha: 0.18 },
  { offsetX: 12, offsetY: 20, blur: 38, spread: -16, alpha: 0.16 },
  { offsetX: -10, offsetY: 19, blur: 34, spread: -15, alpha: 0.17 },
  { offsetX: 8, offsetY: 22, blur: 40, spread: -16, alpha: 0.19 },
  { offsetX: -14, offsetY: 20, blur: 36, spread: -15, alpha: 0.18 },
];

const getExerciseCardStyle = (exercise: ProgramExercise | null, index: number) => {
  let color: string;
  let lightenedBg: string;

  if (!exercise) {
    // Use theme accent color instead of hardcoded rainbow
    color = 'var(--color-accent)';
    lightenedBg = 'var(--color-accent-light)';
  } else {
    const exerciseKey = exercise.exerciseKey || exercise.id;

    if (selectedDiscipline.value) {
      const disciplineGradient = getDisciplineGradientCached(selectedDiscipline.value.id, selectedDiscipline.value.name);
      color = getExerciseColor(exerciseKey, disciplineGradient.primary);
    } else {
      // Use theme accent as base, maybe vary slightly if needed, but keeping it consistent is safer for theming
      color = 'var(--color-accent)';
    }

    lightenedBg = 'var(--color-accent-light)';
  }

  const shadowVariant = exerciseCardShadowVariants[index % exerciseCardShadowVariants.length];
  const baseShadowColor = 'var(--color-accent-light)';
  const activeShadowColor = 'var(--color-accent)';
  const baseShadow = `${shadowVariant.offsetX}px ${shadowVariant.offsetY}px ${shadowVariant.blur}px ${shadowVariant.spread}px ${baseShadowColor}`;
  const ambientShadow = '0 8px 20px rgba(15, 23, 42, 0.08)';
  const activeShadow = `${shadowVariant.offsetX}px ${Math.max(shadowVariant.offsetY - 4, 8)}px ${shadowVariant.blur + 6}px ${shadowVariant.spread}px ${activeShadowColor}`;
  const liftShadow = '0 12px 32px rgba(15, 23, 42, 0.12)';

  return {
    '--exercise-card-color': color,
    '--exercise-card-bg': lightenedBg,
    '--exercise-card-icon-bg': lightenColor(color, 0.88),
    '--exercise-card-gradient-start': lightenedBg,
    '--exercise-card-gradient-mid': mixColors(lightenedBg, color, 98),
    '--exercise-card-gradient-end': 'var(--color-bg)',
    '--exercise-card-shadow': `${baseShadow}, ${ambientShadow}`,
    '--exercise-card-shadow-active': `${activeShadow}, ${liftShadow}`,
  };
};

watch(() => props.active, (isActive) => {
  if (isActive) {
    if (!initialized.value) {
      initialized.value = true;
      loadDisciplines();
      loadUserProgram(); // Загружаем сохраненную программу из БД
    }
  }
});

onMounted(() => {
  if (props.active && !initialized.value) {
    initialized.value = true;
    loadDisciplines();
    loadUserProgram(); // Загружаем сохраненную программу из БД
  }
});

watch(selectedDiscipline, (discipline, prev) => {
  if (!discipline) {
    programs.value = [];
    selectedProgram.value = null;
    exercises.value = [];
    selectedLevels.value = {};
    if (currentStep.value > 1) {
      currentStep.value = 1;
    }
    return;
  }

  if (!prev || discipline.id !== prev.id) {
    programs.value = [];
    selectedProgram.value = null;
    exercises.value = [];
    selectedLevels.value = {};
    programError.value = null;
    exercisesError.value = null;
    loadPrograms();
  }
});

watch(selectedProgram, (program, prev) => {
  if (!program) {
    exercises.value = [];
    selectedLevels.value = {};
    if (currentStep.value > 2) {
      currentStep.value = 2;
    }
    return;
  }

  if (!prev || program.id !== prev.id) {
    exercises.value = [];
    selectedLevels.value = {};
    exercisesError.value = null;
    loadExercises();
  }
});
</script>

<style scoped>
.training-settings {
  display: flex;
  flex-direction: column;
  /* 
   * КРИТИЧНО: Используем min-height: auto вместо 100%, чтобы контент
   * не растягивался больше необходимого. Это предотвращает лишний скролл
   * в секции "Настройки", где контента мало.
   */
  min-height: auto;
  background: var(--panel-surface-base, var(--color-bg-elevated));
  color: var(--color-text-primary);
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--color-border);
  /* Важно: контейнер должен быть видимым для правильной работы sticky */
  position: relative;
  isolation: isolate;
  /* Ensure border radius is applied */
  border-radius: var(--radius-xl) !important;
  overflow: hidden !important;
}

.training-settings__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.5rem 1.75rem 1.5rem;
}

.training-settings__titles {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.training-settings__title {
  font-size: 1.35rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.training-settings__subtitle {
  margin: 0;
  font-size: 0.925rem;
  color: var(--color-text-secondary);
  max-width: 460px;
}

.training-settings__reset {
  padding: 0.5rem 1rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: transparent;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  transition: all 0.2s ease;
}

.training-settings__reset:hover {
  color: var(--color-accent);
  border-color: var(--color-accent);
}


.training-settings__steps {
  position: sticky;
  /* 
   * КРИТИЧНО: Контейнер скроллится вместе с контентом до момента, когда 
   * расстояние от верха viewport (через header-content-panel) до верха 
   * контейнера становится равным его высоте (64px).
   * 
   * top: var(--nav-bar-height) означает, что контейнер останавливается 
   * на расстоянии 64px от верха скроллируемого контейнера (header-content-panel).
   * Это создает эффект: контейнер скроллится, пока его верхний край не 
   * достигнет позиции на расстоянии равном его высоте от верха.
   * 
   * После остановки остальной контент продолжает скроллиться под ним.
   */
  top: var(--nav-bar-height);
  z-index: 50;
  height: var(--nav-bar-height);
  min-height: var(--nav-bar-height);
  max-height: var(--nav-bar-height);
  background: var(--panel-surface-base, var(--color-bg-elevated));
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 clamp(1.25rem, 3vw, 1.75rem);
  width: 100%;
  border-bottom: 1px solid var(--color-border);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
  backdrop-filter: blur(8px);
  box-sizing: border-box;
  /* Оптимизация для sticky позиционирования */
  will-change: transform;
  backface-visibility: hidden;
  transform: translateZ(0);
  /* Плавный переход при остановке */
  transition: box-shadow 0.2s ease;
  --step-connector-color: rgba(156, 163, 175, 0.45);
  --step-circle-size: clamp(36px, 8vw, 44px);
  --step-node-width: clamp(80px, 20vw, 120px);
}

.steps-layout {
  display: grid;
  grid-template-columns: var(--step-node-width) 1fr var(--step-node-width) 1fr var(--step-node-width);
  grid-auto-flow: column;
  align-items: center;
  justify-items: center;
  width: 100%;
  max-width: min(100%, 640px);
  margin: 0 auto;
  column-gap: 0;
  row-gap: 0;
  height: 100%;
}

.step-indicator {
  grid-row: 1;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  width: var(--step-node-width);
  height: 100%;
  background: transparent;
  border: none;
  padding: 0;
  cursor: default;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.steps-layout > .step-connector {
  grid-row: 1;
  align-self: center;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.step-indicator--clickable {
  cursor: pointer;
}

.step-indicator--clickable:hover {
  opacity: 0.85;
}

.step-indicator__number {
  width: var(--step-circle-size);
  height: var(--step-circle-size);
  min-width: var(--step-circle-size);
  min-height: var(--step-circle-size);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--color-bg-secondary);
  border: 2px solid var(--color-border);
  color: var(--color-text-secondary);
  font-weight: 600;
  font-size: clamp(0.75rem, 1.8vw, 0.875rem);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
}

.step-indicator--active .step-indicator__number,
.step-indicator--completed .step-indicator__number {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-text-inverse);
}

.step-indicator__label {
  font-size: clamp(0.625rem, 1.5vw, 0.75rem);
  font-weight: 500;
  color: var(--color-text-secondary);
  text-align: center;
  margin: 0;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.step-indicator--active .step-indicator__label {
  color: var(--color-accent);
  font-weight: 600;
}

.step-connector {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 38px;
  width: 100%;
  opacity: 0;
  transform: translateY(6px);
  transition: opacity 0.3s ease, transform 0.3s ease;
  pointer-events: none;
}

.step-connector__line {
  position: relative;
  width: 100%;
  height: 0;
  border-top: 2px dashed var(--step-connector-color, rgba(156, 163, 175, 0.5));
}

.step-connector__arrow {
  position: absolute;
  top: 50%;
  right: clamp(-6px, -0.5vw, -2px);
  width: 12px;
  height: 12px;
  border-top: 2px solid var(--step-connector-color, rgba(156, 163, 175, 0.5));
  border-right: 2px solid var(--step-connector-color, rgba(156, 163, 175, 0.5));
  transform: translateY(-50%) rotate(45deg);
  background: var(--color-bg);
  border-radius: 2px;
}

.step-connector--active {
  opacity: 1;
  transform: translateY(0);
}

.step-connector--active .step-connector__line {
  border-top-color: var(--color-accent);
}

.step-connector--active .step-connector__arrow {
  border-top-color: var(--color-accent);
  border-right-color: var(--color-accent);
}

.training-settings__content {
  padding: 1.5rem 1.75rem;
  /* 
   * padding-bottom убран отсюда, так как он уже установлен в 
   * .panel-slide--settings для гарантии правильной нижней границы
   * на всех этапах (1, 2, 3)
   */
  display: flex;
  flex-direction: column;
  gap: 0;
  /* Плавная прокрутка */
  scroll-behavior: smooth;
  /* Оптимизация производительности */
  will-change: scroll-position;
  backface-visibility: hidden;
}

.settings-step {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.step-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.step-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.step-description {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  margin: 0;
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  gap: 1rem;
}

.retry-btn {
  padding: 0.6rem 1.2rem;
  border-radius: 999px;
  border: 1px solid var(--color-accent);
  background: transparent;
  color: var(--color-accent);
  font-weight: 500;
  transition: all 0.2s ease;
}

.retry-btn:hover {
  background: var(--color-accent-light, rgba(16, 163, 127, 0.08));
}

.disciplines-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem;
}

.program-button {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-start;
  width: 100%;
  padding: 1.5rem;
  background: var(--panel-surface-gradient, var(--gradient-surface));
  border-radius: 20px;
  border: 1px solid var(--color-border);
  color: var(--program-title-color, var(--color-text-primary));
  text-align: left;
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: var(--shadow-sm);
  backdrop-filter: blur(14px) saturate(175%);
  -webkit-backdrop-filter: blur(14px) saturate(175%);
}

.program-button:hover {
  border-color: var(--color-accent);
  box-shadow: none;
  transform: translateY(-2px);
}

.program-button.discipline-card--selected {
  transform: translateY(-4px);
  border-color: var(--color-accent);
  box-shadow: none;
}

.program-title {
  font-family: 'Inter', 'Roboto Flex', 'Google Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
  letter-spacing: -0.01em;
}

.program-subtitle {
  font-size: 0.9rem;
  color: var(--program-subtitle-color, var(--color-text-secondary));
  margin: 0;
  line-height: 1.4;
}

.programs-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}

.program-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: flex-start;
  width: 100%;
  padding: 1.5rem;
  border-radius: 20px;
  border: 1px solid var(--color-border);
  background: var(--panel-surface-gradient, var(--gradient-surface));
  color: var(--training-program-title-color, var(--color-text-primary));
  text-align: left;
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: none;
  backdrop-filter: blur(14px) saturate(175%);
  -webkit-backdrop-filter: blur(14px) saturate(175%);
}

.program-card:hover,
.program-card--selected {
  transform: translateY(-4px);
  border-color: var(--color-bg-elevated);
  box-shadow: none;
}

.program-card__check {
  position: absolute;
  top: 1.25rem;
  right: 1.25rem;
  color: var(--accent-color-base, var(--color-accent));
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
}

.discipline-card__check {
  color: var(--program-nav-color, var(--color-accent));
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
}

.training-program-title {
  font-family: 'Inter', 'Roboto Flex', 'Google Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
  letter-spacing: -0.01em;
}

.training-program-description {
  font-size: 0.9rem;
  color: var(--training-program-description-color, var(--color-text-secondary));
  margin: 0;
  line-height: 1.5;
}

.exercises-levels-list {
  display: grid;
  gap: 1rem;
}

.exercise-level-item {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.5rem;
  border-radius: 20px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  box-shadow: none;
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.exercise-level-item:hover {
  border-color: var(--color-accent);
  box-shadow: none;
  transform: translateY(-2px);
}

.exercise-level-item--selected {
  border-color: var(--color-accent);
  box-shadow: 0 8px 20px var(--color-accent-light);
}

.exercise-level-item--selected:hover {
  transform: translateY(-3px);
}

.exercise-level-header {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.program-exercise-icon {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-secondary);
  color: var(--exercise-card-color, var(--color-accent));
  border-radius: 16px;
  flex-shrink: 0;
  border: 1px solid var(--color-border);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  transform: rotate(-3deg);
  overflow: hidden;
}

/* Icon with image */
.program-exercise-icon--has-image {
  background: var(--color-bg-elevated);
  padding: 0;
}

.program-exercise-icon__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.exercise-level-item:hover .program-exercise-icon {
  transform: scale(1.08) rotate(3deg);
  border-color: var(--color-accent);
  box-shadow: 0 4px 16px var(--color-accent-light);
}

.exercise-level-item:hover .program-exercise-icon--has-image .program-exercise-icon__img {
  transform: scale(1.1);
}

.exercise-level-item:hover .program-exercise-icon:not(.program-exercise-icon--has-image) {
  background: var(--exercise-card-color, var(--color-accent));
  color: var(--color-accent-contrast);
}

.exercise-level-header__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.program-exercise-title {
  font-family: 'Inter', 'Roboto Flex', 'Google Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
  line-height: 1.3;
}

.program-exercise-meta {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.program-exercise-meta__label {
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  font-weight: 600;
}

.program-exercise-meta__value {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--exercise-card-color, var(--color-accent));
}

.exercise-level-controller {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--color-border);
}

.level-segments {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(24px, 1fr));
  gap: 0.5rem;
}

.level-segment {
  position: relative;
  min-width: 20px;
  height: 24px;
  border: none;
  border-radius: 6px;
  /* Make visible on dark background by default */
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  padding: 0;
  cursor: pointer;
}

.level-segment:hover {
  background: var(--color-surface-hover);
  transform: translateY(-2px);
  border-color: var(--color-border-strong);
}

.level-segment:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.level-segment--filled {
  background: var(--exercise-card-color, var(--color-accent));
  opacity: 0.5; /* Increased opacity for better visibility */
  border-color: transparent;
}

.level-segment--current {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
  box-shadow: 0 4px 12px var(--color-accent-light);
  border-color: transparent;
  opacity: 1;
  transform: scale(1.1);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.step-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 1.5rem;
}

.step-actions__buttons {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.step-confirm-btn {
  padding: 0.875rem 2rem;
  border-radius: 16px;
  border: none;
  background: linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-hover) 100%);
  color: var(--color-text-inverse);
  font-family: 'Inter', 'Roboto Flex', 'Google Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  font-weight: 600;
  font-size: 1rem;
  box-shadow: 0 8px 20px -4px var(--color-accent-light);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  letter-spacing: 0.01em;
}

.step-confirm-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 28px -6px var(--color-accent-light);
}

.step-confirm-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.step-confirm-btn--update {
  background: var(--gradient-accent);
  box-shadow: 0 8px 20px -4px var(--color-accent-light);
}

.step-confirm-btn--update:hover {
  box-shadow: 0 12px 28px -6px var(--color-accent-light);
}

.step-confirm-btn--add {
  /* DS-001: Use CSS variables instead of hardcoded colors */
  background: linear-gradient(135deg, var(--color-success, #10B981) 0%, var(--color-success-hover, #059669) 100%);
  box-shadow: 0 8px 20px -4px var(--color-success-light, rgba(16, 185, 129, 0.4));
}

.step-confirm-btn--add:hover {
  box-shadow: 0 12px 28px -6px var(--color-success-light, rgba(16, 185, 129, 0.5));
}

@media (max-width: 640px) {
  .programs-list {
    grid-template-columns: 1fr;
  }
  
  .disciplines-grid {
    grid-template-columns: 1fr;
  }
  
  .step-confirm-btn {
    width: 100%;
    justify-content: center;
  }
}

@media (max-width: 768px) {
  .training-settings {
    /* 
     * Убираем border-radius для нижних углов, чтобы граница была прямой
     */
    border-radius: 0;
  }

  .training-settings__header {
    padding: 1.25rem 1.25rem 1.25rem;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .training-settings__steps {
    padding: 0 clamp(1rem, 2.5vw, 1.5rem);
  }

  .training-settings__content {
    padding: 1.25rem 1.25rem;
    /* 
     * padding-bottom убран, так как он установлен в .panel-slide--settings
     * для гарантии правильной нижней границы на всех этапах
     */
  }

  .disciplines-grid {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  }

  .programs-list {
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }

  .exercise-level-item {
    padding: 1rem 1.1rem;
  }

  .program-exercise-icon {
    width: 42px;
    height: 42px;
  }

  .level-segments {
    grid-template-columns: repeat(auto-fit, minmax(14px, 1fr));
    gap: 0.3rem;
  }

  .level-segment {
    height: 14px;
  }
}
</style>
