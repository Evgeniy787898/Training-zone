<template>
  <section
    class="surface-card surface-card--overlay tabata"
    :class="[
      `tabata--${phaseLabel.type}`,
      { 'tabata--focus-active': focusMode }
    ]"
    aria-label="Таймер Табата"
  >
    <header class="tabata__header">
      <div class="tabata__title-block">
        <h4 class="tabata__title">Табата</h4>
        <span class="tabata__badge">{{ phaseLabel.text }}</span>
      </div>
      <button
        type="button"
        class="tabata__focus-toggle"
        :class="{ 'tabata__focus-toggle--active': focusMode }"
        :aria-pressed="focusMode ? 'true' : 'false'"
        :disabled="locked"
        @click="emit('toggle-focus')"
      >
        {{ focusMode ? 'Выключить фокус' : 'Режим фокуса' }}
      </button>
      <span class="tabata__round" :data-phase="phaseLabel.type">{{ currentRoundLabel }}</span>
    </header>

    <div class="tabata__dial" :style="progressStyle">
      <div class="tabata__dial-core">
        <span class="tabata__exercise" :title="exerciseName">{{ exerciseName }}</span>
        <span class="tabata__timer">{{ formattedRemaining }}</span>
      </div>
    </div>

    <div class="tabata__actions">
      <button
        type="button"
        class="tabata__control tabata__control--primary"
        @click="toggleTimer"
        :disabled="locked || isComplete"
      >
        {{ primaryLabel }}
      </button>
      <button
        type="button"
        class="tabata__control tabata__control--secondary"
        @click="handleSecondary"
        :disabled="locked"
      >
        {{ secondaryLabel }}
      </button>
    </div>

    <form class="tabata__settings" @submit.prevent>
      <fieldset class="tabata__fieldset" :disabled="locked">
        <legend>Настройки интервалов</legend>
        <label>
          <span>Работа в подходе (сек)</span>
          <input
            type="number"
            min="10"
            max="180"
            :value="localSettings.work"
            @change="updateSetting('work', $event)"
          />
        </label>
        <label>
          <span>Отдых в подходе (сек)</span>
          <input
            type="number"
            min="0"
            max="180"
            :value="localSettings.rest"
            @change="updateSetting('rest', $event)"
          />
        </label>
        <label>
          <span>Отдых между подходами (сек)</span>
          <input
            type="number"
            min="0"
            max="300"
            :value="localSettings.restBetweenSets"
            @change="updateSetting('restBetweenSets', $event)"
          />
        </label>
        <label>
          <span>Отдых между упражнениями (сек)</span>
          <input
            type="number"
            min="0"
            max="600"
            :value="localSettings.restBetweenExercises"
            @change="updateSetting('restBetweenExercises', $event)"
          />
        </label>
        <label>
          <span>Количество подходов</span>
          <input
            type="number"
            min="1"
            max="20"
            :value="localSettings.rounds"
            @change="updateSetting('rounds', $event)"
          />
        </label>
      </fieldset>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';

interface TabataSettings {
  work: number;
  rest: number;
  restBetweenSets: number;
  restBetweenExercises: number;
  rounds: number;
}

type PhaseType = 'work' | 'rest' | 'betweenSets' | 'betweenExercises' | 'complete';

type Phase = {
  type: PhaseType;
  duration: number;
};

const props = withDefaults(
  defineProps<{
    locked?: boolean;
    exerciseName: string;
    settings: TabataSettings;
    focusMode?: boolean;
  }>(),
  {
    locked: false,
    focusMode: false,
  }
);

const emit = defineEmits<{
  'update:settings': [TabataSettings];
  'time-update': [elapsedSeconds: number];
  'session-complete': [];
  'toggle-focus': [];
}>();

const focusMode = computed(() => props.focusMode ?? false);

const localSettings = reactive<TabataSettings>({ ...props.settings });
const phaseQueue = ref<Phase[]>([]);
const currentPhaseIndex = ref(0);
const remaining = ref(0);
const running = ref(false);
let intervalId: ReturnType<typeof setInterval> | null = null;

const phase = computed(() => phaseQueue.value[currentPhaseIndex.value] ?? null);
const isComplete = computed(() => currentPhaseIndex.value >= phaseQueue.value.length);
const totalRounds = computed(() => Math.max(1, localSettings.rounds || 1));
const activeRound = computed(() => {
  let round = 0;
  let workCount = 0;
  for (let i = 0; i <= currentPhaseIndex.value && i < phaseQueue.value.length; i += 1) {
    if (phaseQueue.value[i]?.type === 'work') {
      workCount += 1;
      round = workCount;
    }
  }
  return Math.min(round || 1, totalRounds.value);
});

const phaseLabel = computed(() => {
  if (isComplete.value) {
    return { type: 'complete', text: 'Готово' } as const;
  }
  if (!phase.value) {
    return { type: 'work', text: 'Подготовка' } as const;
  }
  switch (phase.value.type) {
    case 'work':
      return { type: 'work', text: 'Работа' } as const;
    case 'rest':
      return { type: 'rest', text: 'Отдых' } as const;
    case 'betweenSets':
      return { type: 'rest', text: 'Пауза между подходами' } as const;
    case 'betweenExercises':
      return { type: 'rest', text: 'Смена упражнения' } as const;
    default:
      return { type: 'work', text: 'Работа' } as const;
  }
});

const formattedRemaining = computed(() => formatTime(remaining.value));
const currentRoundLabel = computed(() => {
  if (phaseLabel.value.type === 'complete') {
    return 'Сессия завершена';
  }
  return `Подход ${activeRound.value} из ${totalRounds.value}`;
});

const totalDuration = computed(() => phaseQueue.value.reduce((sum, item) => sum + (item.duration || 0), 0));

const progress = computed(() => {
  if (!phase.value || !phase.value.duration) return 0;
  const elapsedPhase = phase.value.duration - remaining.value;
  return Math.min(1, Math.max(0, elapsedPhase / phase.value.duration));
});

const elapsedSeconds = computed(() => {
  let elapsed = 0;
  for (let i = 0; i < currentPhaseIndex.value; i += 1) {
    elapsed += phaseQueue.value[i]?.duration ?? 0;
  }
  if (phase.value) {
    elapsed += (phase.value.duration ?? 0) - remaining.value;
  }
  return Math.max(0, Math.min(elapsed, totalDuration.value));
});

const progressStyle = computed(() => ({
  background: `conic-gradient(var(--color-accent) ${progress.value * 360}deg, color-mix(in srgb, var(--color-border) 60%, transparent) 0deg)`
}));

const primaryLabel = computed(() => {
  if (isComplete.value) return 'Завершено';
  if (running.value) return 'Пауза';
  if (!phase.value || (phase.value && remaining.value === phase.value.duration)) return 'Старт';
  return 'Продолжить';
});

const secondaryLabel = computed(() => {
  if (running.value) return 'Пропустить';
  if (isComplete.value) return 'Перезапустить';
  return 'Сброс';
});

const updateSetting = (key: keyof TabataSettings, event: Event) => {
  const value = Number((event.target as HTMLInputElement).value) || 0;
  const clamped = clampSetting(key, value);
  (localSettings as any)[key] = clamped;
  emit('update:settings', { ...localSettings });
  rebuildPhases();
};

const clampSetting = (key: keyof TabataSettings, value: number) => {
  switch (key) {
    case 'work':
      return Math.min(180, Math.max(10, value));
    case 'rest':
      return Math.min(180, Math.max(0, value));
    case 'restBetweenSets':
      return Math.min(300, Math.max(0, value));
    case 'restBetweenExercises':
      return Math.min(600, Math.max(0, value));
    case 'rounds':
      return Math.min(20, Math.max(1, value));
    default:
      return value;
  }
};

const rebuildPhases = () => {
  const phases: Phase[] = [];
  const rounds = Math.max(1, localSettings.rounds || 1);
  for (let i = 0; i < rounds; i += 1) {
    phases.push({ type: 'work', duration: localSettings.work });
    if (localSettings.rest > 0) {
      phases.push({ type: 'rest', duration: localSettings.rest });
    }
    if (i < rounds - 1 && localSettings.restBetweenSets > 0) {
      phases.push({ type: 'betweenSets', duration: localSettings.restBetweenSets });
    }
  }
  if (localSettings.restBetweenExercises > 0) {
    phases.push({ type: 'betweenExercises', duration: localSettings.restBetweenExercises });
  }
  phaseQueue.value = phases;
  currentPhaseIndex.value = 0;
  remaining.value = phases[0]?.duration ?? 0;
  running.value = false;
  clearTimer();
};

const toggleTimer = () => {
  if (props.locked || isComplete.value) {
    return;
  }
  if (!phase.value || !phaseQueue.value.length) {
    rebuildPhases();
  }
  running.value = !running.value;
  if (running.value) {
    startTimer();
  } else {
    clearTimer();
  }
};

const handleSecondary = () => {
  if (props.locked) return;
  if (running.value) {
    advancePhase();
    return;
  }
  rebuildPhases();
};

const startTimer = () => {
  clearTimer();
  intervalId = setInterval(() => {
    if (!phase.value) {
      finishSession();
      return;
    }
    if (remaining.value > 0) {
      remaining.value -= 1;
      return;
    }
    advancePhase();
  }, 1000);
};

const advancePhase = () => {
  if (currentPhaseIndex.value >= phaseQueue.value.length) {
    finishSession();
    return;
  }
  currentPhaseIndex.value += 1;
  if (currentPhaseIndex.value >= phaseQueue.value.length) {
    finishSession();
    return;
  }
  remaining.value = phaseQueue.value[currentPhaseIndex.value].duration;
};

const finishSession = () => {
  clearTimer();
  running.value = false;
  currentPhaseIndex.value = phaseQueue.value.length;
  remaining.value = 0;
  emit('time-update', elapsedSeconds.value);
  emit('session-complete');
};

const clearTimer = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
};

const formatTime = (value: number) => {
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

watch(
  () => props.settings,
  (next) => {
    Object.assign(localSettings, next);
    rebuildPhases();
  },
  { deep: true }
);

watch(() => props.locked, (locked) => {
  if (locked) {
    running.value = false;
    clearTimer();
  }
});

watch(elapsedSeconds, (seconds) => {
  emit('time-update', seconds);
});

rebuildPhases();

onBeforeUnmount(() => {
  clearTimer();
});
</script>

<style scoped>
.tabata {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: clamp(1rem, 2.5vw, 1.5rem);
  transition: box-shadow 0.2s ease;
}

.tabata--focus-active {
  box-shadow: 0 20px 40px -22px color-mix(in srgb, var(--color-accent) 55%, transparent);
}

.tabata__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: clamp(0.5rem, 2vw, 1rem);
}

.tabata__title-block {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.tabata__title {
  margin: 0;
  font-size: clamp(1rem, 2.6vw, 1.2rem);
}

.tabata__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.35rem 0.75rem;
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--color-accent) 18%, transparent);
  color: var(--color-accent);
  font-weight: 600;
  font-size: clamp(0.75rem, 2vw, 0.9rem);
}

.tabata__focus-toggle {
  margin-left: auto;
  border: none;
  border-radius: var(--radius-md);
  padding: 0.35rem 0.75rem;
  background: color-mix(in srgb, var(--color-border) 65%, transparent);
  color: var(--color-text-secondary);
  font-size: clamp(0.75rem, 2vw, 0.9rem);
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}

.tabata__focus-toggle:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tabata__focus-toggle:hover,
.tabata__focus-toggle:focus-visible {
  background: color-mix(in srgb, var(--color-accent) 18%, transparent);
  color: var(--color-accent);
  outline: none;
}

.tabata__focus-toggle--active {
  background: color-mix(in srgb, var(--color-accent) 28%, transparent);
  color: var(--color-accent);
}

.tabata__round {
  font-size: clamp(0.82rem, 2vw, 0.95rem);
  color: var(--color-text-secondary);
  margin-left: clamp(0.35rem, 1.5vw, 0.75rem);
}

.tabata__dial {
  position: relative;
  width: min(260px, 60vw);
  aspect-ratio: 1;
  margin: 0 auto;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--color-border) 55%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-border) 65%, transparent);
}

.tabata__dial-core {
  width: 76%;
  height: 76%;
  border-radius: 50%;
  background: var(--color-bg-elevated);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 1.2rem;
  box-shadow: 0 14px 36px rgba(15, 23, 42, 0.12);
  text-align: center;
}

.tabata__exercise {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: clamp(0.85rem, 2.4vw, 1rem);
  color: var(--color-text-secondary);
}

.tabata__timer {
  font-size: clamp(1.8rem, 5vw, 2.6rem);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.tabata__actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(1rem, 2vw, 1.5rem);
}

.tabata__control {
  flex: 1;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-lg);
  border: none;
  font-weight: 600;
  font-size: clamp(0.85rem, 2vw, 1rem);
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.tabata__control:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.tabata__control--primary {
  background: var(--gradient-accent-strong);
  color: var(--color-accent-contrast);
  box-shadow: 0 18px 32px rgba(37, 99, 235, 0.25);
}

.tabata__control--secondary {
  background: color-mix(in srgb, var(--color-border) 60%, transparent);
  color: var(--color-text-primary);
}

.tabata__control:hover,
.tabata__control:focus-visible {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
  outline: none;
}

.tabata__settings {
  display: flex;
  flex-direction: column;
}

.tabata__fieldset {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem 1rem;
  border: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent);
  border-radius: var(--radius-xl);
  padding: clamp(0.75rem, 2vw, 1.1rem);
  background: color-mix(in srgb, var(--color-surface) 55%, transparent);
}

.tabata__fieldset legend {
  font-size: clamp(0.9rem, 2vw, 1rem);
  font-weight: 600;
  padding: 0 0.25rem;
}

.tabata__fieldset label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: clamp(0.8rem, 2vw, 0.9rem);
}

.tabata__fieldset input {
  border-radius: var(--radius-md);
  border: 1px solid color-mix(in srgb, var(--color-border) 85%, transparent);
  padding: 0.4rem 0.6rem;
  font-size: clamp(0.8rem, 2vw, 0.9rem);
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);
}

@media (max-width: 640px) {
  .tabata__dial {
    width: min(220px, 80vw);
  }

  .tabata__fieldset {
    grid-template-columns: 1fr;
  }
}
</style>
