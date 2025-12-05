<template>
  <div v-if="session" ref="planRoot" class="session-plan">
    <section v-if="exercises.length" class="surface-card surface-card--overlay session-plan__overview" aria-label="Обзор тренировки">
      <p class="session-plan__label">Сегодня:</p>
      <ul class="session-plan__list">
        <li v-for="ex in exercises" :key="ex.exercise_key">{{ getBasicExerciseName(ex.exercise_key) }}</li>
      </ul>
      <StatusBadge
        v-if="completed"
        label="Выполнено"
        variant="success"
        size="sm"
        subtle
      />
    </section>

    <section class="surface-card surface-card--overlay session-plan__block" aria-label="Разминка">
      <h4 class="session-plan__block-title">Разминка</h4>
      <p class="session-plan__block-text">Детали разминки будут добавлены позже</p>
    </section>

    <div class="session-plan__exercises">
      <article
        v-for="(exercise, index) in exercises"
        :key="exercise.exercise_key || `exercise_${index}`"
        class="surface-card surface-card--overlay session-exercise"
      >
        <figure class="session-exercise__media" :style="{ backgroundImage: `url(${exercise.image_url || fallbackImage})` }">
          <figcaption class="session-exercise__caption">
            <span class="session-exercise__name">{{ getExerciseName(exercise) }}</span>
          </figcaption>
          <span class="session-exercise__level">{{ levelName(exercise) }} уровень</span>
          <div class="session-exercise__sets" role="group" :aria-label="`Подходы для упражнения ${getExerciseName(exercise)}`">
            <label
              v-for="setIndex in getSets(exercise)"
              :key="setIndex"
              class="session-exercise__set"
            >
              <span class="sr-only">Подход {{ setIndex }}</span>
              <input
                type="number"
                min="0"
                :value="getValue(exercise, setIndex - 1)"
                :disabled="locked"
                class="session-exercise__input"
                placeholder="0"
                :aria-label="`Повторения для подхода ${setIndex} упражнения ${getExerciseName(exercise)}`"
                @input="handleRepChange(exercise.exercise_key || `exercise_${index}`, setIndex - 1, $event)"
              />
            </label>
          </div>
          <div class="session-exercise__progress" aria-hidden="true">
            <span
              v-for="i in 3"
              :key="i"
              class="session-exercise__dot"
              :class="{ 'is-active': getSublevel(exercise) >= (4 - i) }"
            ></span>
          </div>
        </figure>

        <div v-if="exercise.technique" class="session-exercise__technique">
          <p>{{ exercise.technique }}</p>
        </div>
      </article>
    </div>

    <section class="surface-card surface-card--overlay session-plan__block" aria-label="Заминка">
      <h4 class="session-plan__block-title">Заминка</h4>
      <p class="session-plan__block-text">Детали заминки будут добавлены позже</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useInteractiveSurfaces } from '@/composables/useInteractiveSurfaces';
import StatusBadge from '@/modules/shared/components/StatusBadge.vue';

const LEVEL_NAMES: Record<string, string> = {
  '1': 'Первый', '2': 'Второй', '3': 'Третий', '4': 'Четвертый', '5': 'Пятый',
  '6': 'Шестой', '7': 'Седьмой', '8': 'Восьмой', '9': 'Девятый', '10': 'Десятый',
};

const props = defineProps<{
  session: any;
  history?: Record<string, any>;
  locked?: boolean;
  initialValues?: Record<string, number>;
  completed?: boolean;
}>();

const emit = defineEmits<{
  'exercise-change': [key: string, value: number];
}>();

const exerciseValues = ref<Record<string, number>>(props.initialValues || {});
const planRoot = ref<HTMLElement | null>(null);

useInteractiveSurfaces(planRoot);

watch(() => props.initialValues, (newVal) => {
  exerciseValues.value = { ...(newVal || {}) };
}, { deep: true });

const fallbackImage = 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&auto=format&fit=crop&q=80';

const exercises = Array.isArray(props.session?.exercises) ? props.session.exercises : [];

const parseLevel = (levelStr: string) => {
  if (!levelStr) return { level: '1', sublevel: '1' };
  const parts = levelStr.split('.');
  return { level: parts[0] || '1', sublevel: parts[1] || '1' };
};

const levelName = (exercise: any) => {
  const level = parseLevel(exercise.target?.level || '1.1');
  return LEVEL_NAMES[level.level] || 'Первый';
};

const getSublevel = (exercise: any) => {
  const level = parseLevel(exercise.target?.level || '1.1');
  return parseInt(level.sublevel, 10);
};

const getSets = (exercise: any) => {
  return exercise.target?.sets || 3;
};

const getValue = (exercise: any, setIndex: number) => {
  const key = `${exercise.exercise_key}_${setIndex}`;
  return exerciseValues.value[key] ?? '';
};

const handleRepChange = (exerciseKey: string, setIndex: number, event: Event) => {
  const target = event.target as HTMLInputElement;
  const key = `${exerciseKey}_${setIndex}`;
  const numValue = Number(target.value) || 0;
  exerciseValues.value[key] = numValue;
  emit('exercise-change', key, numValue);
};

const getBasicExerciseName = (exerciseKey: string) => {
  const exerciseNameMap: Record<string, string> = {
    'pullups': 'Подтягивания',
    'squats': 'Приседания',
    'pushups': 'Отжимания',
    'leg_raises': 'Подъёмы ног',
    'bridge': 'Мостик',
    'handstand': 'Стойка на руках',
  };
  return exerciseNameMap[exerciseKey] || exerciseKey;
};

const getExerciseName = (exercise: any) => {
  return exercise.name || getBasicExerciseName(exercise.exercise_key || '');
};
</script>

<style scoped>
.session-plan {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.session-plan__overview {
  gap: var(--space-sm);
  padding: clamp(1.4rem, 1.15rem + 1vw, 1.9rem);
  background-image: linear-gradient(145deg, color-mix(in srgb, var(--color-accent) 10%, transparent) 0%, transparent 70%),
    var(--panel-surface-gradient);
}

.session-plan__label {
  margin: 0;
  font-size: clamp(0.9rem, 0.85rem + 0.4vw, 1.05rem);
  color: var(--color-text-secondary);
  letter-spacing: 0.02em;
}

.session-plan__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xxs);
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--color-text-primary);
  font-size: clamp(1rem, 0.95rem + 0.4vw, 1.2rem);
}

.session-plan__block {
  gap: var(--space-xxs);
  padding: clamp(1.4rem, 1.15rem + 1vw, 1.9rem);
  background-image: linear-gradient(150deg, color-mix(in srgb, var(--color-info) 8%, transparent) 0%, transparent 70%),
    var(--panel-surface-gradient);
}

.session-plan__block-title {
  margin: 0;
  font-size: clamp(1rem, 0.95rem + 0.4vw, 1.2rem);
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--color-text-primary);
}

.session-plan__block-text {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: clamp(0.85rem, 0.8rem + 0.35vw, 1rem);
}

.session-plan__exercises {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.session-exercise {
  gap: var(--space-sm);
  padding: 0;
  overflow: hidden;
}

.session-exercise__media {
  position: relative;
  min-block-size: clamp(12rem, 10rem + 12vw, 18rem);
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: var(--space-sm);
}

.session-exercise__media::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, color-mix(in srgb, var(--color-bg) 20%, transparent) 0%, rgba(5, 7, 12, 0.85) 75%);
}

.session-exercise__caption {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-xxs);
  align-items: center;
}

.session-exercise__name {
  font-size: clamp(1.05rem, 1rem + 0.45vw, 1.25rem);
  font-weight: 600;
  color: var(--color-text-inverse);
}

.session-exercise__level {
  position: absolute;
  top: var(--space-sm);
  right: var(--space-sm);
  z-index: 1;
  padding: var(--space-xxs) var(--space-xs);
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-accent) 25%, transparent);
  color: var(--color-text-inverse);
  font-size: clamp(0.75rem, 0.72rem + 0.25vw, 0.85rem);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.session-exercise__sets {
  position: relative;
  z-index: 1;
  display: flex;
  gap: var(--space-xs);
  margin-top: var(--space-md);
}

.session-exercise__set {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xxs);
}

.session-exercise__input {
  inline-size: 3.25rem;
  padding: var(--space-xxs) var(--space-xs);
  border-radius: var(--radius-sm);
  border: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
  background: color-mix(in srgb, var(--color-bg-elevated) 80%, transparent);
  color: var(--color-text-primary);
  font-weight: 600;
  text-align: center;
  font-size: clamp(0.9rem, 0.85rem + 0.35vw, 1rem);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.session-exercise__input:focus-visible {
  outline: none;
  border-color: color-mix(in srgb, var(--color-accent) 45%, transparent);
  box-shadow: 0 12px 28px color-mix(in srgb, var(--color-accent) 18%, transparent);
}

.session-exercise__progress {
  position: absolute;
  right: var(--space-sm);
  bottom: var(--space-sm);
  display: flex;
  gap: var(--space-xxs);
  z-index: 1;
}

.session-exercise__dot {
  inline-size: 0.5rem;
  block-size: 0.5rem;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-text-inverse) 35%, transparent);
  opacity: 0.4;
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.session-exercise__dot.is-active {
  opacity: 1;
  transform: scale(1.1);
  background: color-mix(in srgb, var(--color-accent) 60%, transparent);
}

.session-exercise__technique {
  padding: var(--space-sm) var(--space-md);
  border-top: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
  background: color-mix(in srgb, var(--color-bg-elevated) 75%, transparent);
  color: var(--color-text-secondary);
  font-size: clamp(0.85rem, 0.8rem + 0.35vw, 1rem);
}

.session-exercise__technique p {
  margin: 0;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
</style>
