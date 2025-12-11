<template>
  <li
    class="surface-card week-card"
    :class="{
      'week-card--today': isToday,
      'week-card--completed': status === 'done',
      'week-card--rest': status === 'rest'
    }"
    role="article"
    :aria-label="ariaDescription"
  >
    <header class="week-card__header">
      <div>
        <span class="week-card__day">{{ dayName }}</span>
        <span class="week-card__date">{{ date }}</span>
      </div>
      <NeonIcon
        v-if="isToday"
        name="spark"
        variant="lime"
        :size="20"
      />
      <NeonIcon
        v-else-if="status === 'done'"
        name="success"
        variant="emerald"
        :size="20"
      />
      <NeonIcon
        v-else-if="status === 'rest'"
        name="crescent"
        variant="emerald"
        :size="20"
      />
    </header>

    <div class="week-card__body">
      <span class="week-card__type">{{ session?.session_type || 'Отдых' }}</span>
      <span v-if="session?.focus" class="week-card__focus">
        <NeonIcon name="target" variant="violet" :size="16" />
        {{ session.focus }}
      </span>
      <span v-if="session && status !== 'rest'" class="week-card__volume">
        <NeonIcon name="calendar" variant="aqua" :size="22" />
        {{ sessionVolume }}
      </span>
    </div>

    <footer v-if="session" class="week-card__footer">
      <button
        type="button"
        class="button button--ghost button--sm week-card__toggle"
        :class="{ 'week-card__toggle--rest': session.status === 'rest' }"
        @click.stop="$emit('toggle-rest')"
        :disabled="disabled"
      >
        <NeonIcon :name="session.status === 'rest' ? 'dumbbell' : 'crescent'" variant="muted" :size="16" />
        {{ session.status === 'rest' ? 'Тренировка' : 'Отдых' }}
      </button>
    </footer>
  </li>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { TrainingSession } from '@/types';
import NeonIcon from '@/modules/shared/components/NeonIcon.vue';

interface Props {
  /** День недели (ПН, ВТ...) */
  dayName: string;
  /** Дата (01.12) */
  date: string;
  /** Сегодняшний день */
  isToday?: boolean;
  /** Статус: 'done' | 'rest' | 'pending' */
  status: string;
  /** Данные сессии */
  session: TrainingSession | null;
  /** Заблокирована ли кнопка переключения */
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isToday: false,
  disabled: false,
});

defineEmits<{
  (e: 'toggle-rest'): void;
}>();

const ariaDescription = computed(() => {
  const dayType = props.status === 'rest' ? 'день отдыха' : 'тренировка';
  const todayMark = props.isToday ? 'сегодня, ' : '';
  return `${todayMark}${props.dayName} ${props.date}: ${dayType}`;
});

const sessionVolume = computed(() => {
  if (!props.session) return '';
  const exercises = props.session.exercises?.length || 0;
  const sets = props.session.exercises?.reduce((sum, ex) => sum + (ex.sets?.length || 0), 0) || 0;
  return `${exercises} упр. / ${sets} подх.`;
});
</script>

<style scoped>
.week-card {
  display: flex;
  flex-direction: column;
  padding: var(--space-md);
  border-radius: var(--radius-lg);
  transition: transform 0.2s, box-shadow 0.2s;
  min-height: 140px;
}

.week-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.week-card--today {
  border-left: 3px solid var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 5%, var(--color-bg-elevated));
}

.week-card--completed {
  opacity: 0.85;
}

.week-card--rest {
  background: var(--color-bg-card);
}

.week-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-sm);
}

.week-card__day {
  display: block;
  font-weight: 700;
  font-size: 0.875rem;
  color: var(--color-text-primary);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.week-card__date {
  display: block;
  font-size: 0.75rem;
  color: var(--color-text-tertiary);
  margin-top: 2px;
}

.week-card__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.week-card__type {
  font-weight: 600;
  font-size: 0.9375rem;
  color: var(--color-text-secondary);
}

.week-card__focus {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: 0.8125rem;
  color: var(--color-text-tertiary);
}

.week-card__volume {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: 0.75rem;
  color: var(--color-text-tertiary);
  margin-top: auto;
}

.week-card__footer {
  margin-top: var(--space-sm);
  padding-top: var(--space-sm);
  border-top: 1px solid var(--color-border-subtle);
}

.week-card__toggle {
  width: 100%;
  justify-content: center;
  gap: var(--space-xs);
}

.week-card__toggle--rest {
  color: var(--color-text-tertiary);
}
</style>
