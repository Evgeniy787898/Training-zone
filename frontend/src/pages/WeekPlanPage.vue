<template>
  <div class="page-shell week-page">
    <header class="page-header week-page__header">
      <div>
        <h1 class="page-title">
          <AppIcon
            class="page-title__icon"
            name="calendar"
            variant="aqua"
            :size="28"
          />
          <span>План на неделю</span>
        </h1>
        <p class="page-subtitle">
          Посмотри, как распределены тренировки и дни восстановления, и мгновенно перейди к сегодняшнему дню.
        </p>
      </div>
    </header>

    <div class="week-page__controls">
      <button type="button" class="button button--ghost" @click="handleChangeWeek(-1)">
        <NeonIcon name="arrowLeft" variant="neutral" :size="20" />
        Назад
      </button>
      <span class="week-page__range">{{ weekRange }}</span>
      <button type="button" class="button button--ghost" @click="handleChangeWeek(1)">
        Вперёд
        <NeonIcon name="arrowRight" variant="neutral" :size="20" />
      </button>
    </div>

    <section v-if="loading" class="surface-card surface-card--overlay week-page__loading">
      <SkeletonCard :lines="5" />
    </section>

    <section v-else-if="error" class="surface-card surface-card--overlay week-page__error">
      <ErrorState :message="error.message" action-label="Обновить" @retry="loadWeek" />
    </section>

    <section v-else class="week-page__content">
      <div v-if="!hasAnySessions" class="surface-card surface-card--overlay week-page__empty">
        <div class="empty-state empty-state--inline">
          <div class="empty-state__icon">📅</div>
          <div class="empty-state__title">Нет расписания</div>
          <p class="empty-state__description">
            Для выбранной недели пока нет запланированных тренировок. Обнови данные после настройки программы.
          </p>
          <button type="button" class="button button--ghost" @click="loadWeek">Обновить</button>
        </div>
      </div>

      <template v-else>
      <ul class="week-grid" role="list">
        <li
          v-for="(day, index) in days"
          :key="index"
          class="surface-card week-card"
          :class="{
            'week-card--today': day.isToday,
            'week-card--completed': day.status === 'done',
            'week-card--rest': day.status === 'rest'
          }"
          role="article"
          :aria-label="describeDay(day)"
        >
          <header class="week-card__header">
            <div>
              <span class="week-card__day">{{ day.day }}</span>
              <span class="week-card__date">{{ day.date }}</span>
            </div>
            <NeonIcon
              v-if="day.isToday"
              name="spark"
              variant="lime"
              :size="20"
            />
            <NeonIcon
              v-else-if="day.status === 'done'"
              name="success"
              variant="emerald"
              :size="20"
            />
            <NeonIcon
              v-else-if="day.status === 'rest'"
              name="crescent"
              variant="emerald"
              :size="20"
            />
          </header>

          <div class="week-card__body">
            <span class="week-card__type">{{ day.session?.session_type || 'Отдых' }}</span>
            <span v-if="day.session?.focus" class="week-card__focus">
              <NeonIcon name="target" variant="violet" :size="16" />
              {{ day.session.focus }}
            </span>
          </div>
        </li>
      </ul>

      <section class="surface-card week-summary" aria-label="Итоги недели">
        <dl class="week-summary__grid">
          <div class="week-summary__stat">
            <dt class="week-summary__label">Выполнено</dt>
            <dd class="week-summary__value">{{ completed }}/{{ planned }}</dd>
          </div>
          <div class="week-summary__stat">
            <dt class="week-summary__label">Источник</dt>
            <dd class="week-summary__value">{{ source === 'database' ? 'Supabase' : source || 'database' }}</dd>
          </div>
        </dl>
        <div class="week-summary__actions">
          <button type="button" class="button button--primary cta-button" @click="goToToday">
            Перейти к «Сегодня»
          </button>
        </div>
      </section>
      </template>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { format, addDays, startOfWeek, isToday, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useRouter } from 'vue-router';
import { useAppStore } from '@/stores/app';
import { cachedApiClient as apiClient } from '@/services/cachedApi';
import { useCachedRequest } from '@/composables/useCachedRequest';
import type { SessionWeekResponse, TrainingSession } from '@/types';
import NeonIcon from '@/modules/shared/components/NeonIcon.vue';
import AppIcon from '@/modules/shared/components/AppIcon.vue';
import ErrorState from '@/modules/shared/components/ErrorState.vue';
import SkeletonCard from '@/modules/shared/components/SkeletonCard.vue';

const router = useRouter();
const appStore = useAppStore();
const { showToast, ensureProgramContext } = appStore;

interface WeekDayView {
  day: string;
  date: string;
  isToday: boolean;
  status: string;
  session: TrainingSession | null;
}

const referenceDate = ref(new Date());
const sessions = ref<TrainingSession[]>([]);
const week = ref<{ start: string; end: string } | null>(null);
const source = ref<string | null>('database');

const {
  loading,
  error,
  execute: fetchWeekPlan,
} = useCachedRequest<SessionWeekResponse, [string | undefined]>(
  (date) => apiClient.getWeekPlan(date),
  {
    initialValueFactory: () => ({
      week_start: '',
      week_end: '',
      sessions: [],
      source: null,
    }),
    createKey: (date) => `weekPlan:${date || 'current'}`,
  },
);

const hasAnySessions = computed(() => sessions.value.length > 0);

const weekRange = computed(() => {
  if (week.value) {
    return `${format(parseISO(week.value.start), 'd MMM', { locale: ru })} — ${format(parseISO(week.value.end), 'd MMM', { locale: ru })}`;
  }
  return format(referenceDate.value, 'd MMM', { locale: ru });
});

const sessionsByDate = computed(() => {
  const map = new Map<string, any>();
  sessions.value.forEach(session => {
    const rawDate = session?.date || session?.plannedAt || session?.planned_at;
    if (!rawDate) return;
    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) return;
    const dateKey = format(parsed, 'yyyy-MM-dd');
    map.set(dateKey, session);
  });
  return map;
});

const weekStartDate = computed(() => {
  return week.value?.start ? parseISO(week.value.start) : startOfWeek(referenceDate.value, { weekStartsOn: 1 });
});

const days = computed<WeekDayView[]>(() => {
  return Array.from({ length: 7 }).map((_, index) => {
    const dayDate = addDays(weekStartDate.value, index);
    const dateKey = format(dayDate, 'yyyy-MM-dd');
    const session = sessionsByDate.value.get(dateKey);

    const normalisedStatus = session?.status === 'rest' || !session?.status ? 'training' : session.status;

    return {
      day: format(dayDate, 'EE', { locale: ru }),
      date: format(dayDate, 'd MMM', { locale: ru }),
      isToday: isToday(dayDate),
      status: normalisedStatus,
      session: session ?? null,
    } satisfies WeekDayView;
  });
});

const planned = computed(() => {
  return days.value.filter(day => day.status !== 'rest').length;
});

const completed = computed(() => {
  return days.value.filter(day => day.session?.status === 'done').length;
});

const goToToday = () => {
  router.push('/today');
};

const describeDay = (day: WeekDayView) => {
  const type = day.session?.session_type || 'Отдых';
  const focus = day.session?.focus ? `, фокус ${day.session.focus}` : '';
  const statusLabel =
    day.status === 'done'
      ? ', выполнено'
      : day.status === 'rest'
        ? ', день восстановления'
        : '';
  return `${day.day} ${day.date}. ${type}${focus}${statusLabel}`;
};

let pendingReload = false;

const loadWeek = async () => {
  if (loading.value) {
    pendingReload = true;
    return;
  }

  const dateStr = format(referenceDate.value, 'yyyy-MM-dd');

  try {
    const data = await fetchWeekPlan(dateStr);
    sessions.value = data.sessions || [];
    week.value = { start: data.week_start, end: data.week_end };
    source.value = data.source || 'database';
  } catch (err: any) {
    showToast({
      title: 'Не удалось загрузить план',
      message: err.message,
      type: 'error',
    });
  }
};

const handleChangeWeek = (direction: number) => {
  const newDate = new Date(referenceDate.value);
  newDate.setDate(newDate.getDate() + direction * 7);
  referenceDate.value = newDate;
};

watch(referenceDate, () => {
  loadWeek();
});

watch(
  () => appStore.programRevision,
  () => {
    loadWeek();
  },
);

watch(loading, (isLoading) => {
  if (!isLoading && pendingReload) {
    pendingReload = false;
    loadWeek();
  }
});

onMounted(async () => {
  try {
    await ensureProgramContext({ includeLevels: false });
  } catch (err) {
    console.warn('[WeekPlanPage] Failed to warm program context', err);
  } finally {
    loadWeek();
  }
});
</script>

<style scoped>
.week-page {
  gap: clamp(1.5rem, 4vw, 2.5rem);
}

.week-page__controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}

.week-page__controls .button {
  gap: var(--space-xs);
}

.week-page__range {
  font-weight: 600;
  font-size: var(--font-size-lg);
  color: var(--color-text-primary);
}

.week-page__content {
  display: flex;
  flex-direction: column;
  gap: clamp(1.5rem, 4vw, 2.25rem);
}

.week-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: clamp(0.75rem, 2vw, 1.25rem);
  list-style: none;
  padding: 0;
  margin: 0;
}

.week-grid > li {
  margin: 0;
}

.week-card {
  gap: clamp(0.65rem, 0.45rem + 1vw, 1.1rem);
  padding: clamp(1.05rem, 0.9rem + 1vw, 1.6rem);
  border-radius: var(--radius-xl);
  border: 1px solid color-mix(in srgb, var(--color-border) 62%, transparent);
  background-image: linear-gradient(
      150deg,
      color-mix(in srgb, var(--surface-accent, var(--color-accent)) 12%, transparent) 0%,
      transparent 68%
    ),
    var(--panel-surface-gradient);
  --surface-accent: color-mix(in srgb, var(--color-accent) 52%, var(--color-border));
}

.week-card--today {
  border-color: color-mix(in srgb, var(--color-accent) 55%, transparent);
  box-shadow: 0 22px 48px color-mix(in srgb, var(--surface-accent) 24%, transparent);
  --surface-accent: color-mix(in srgb, var(--color-accent) 68%, var(--color-border));
}

.week-card--completed {
  border-color: color-mix(in srgb, var(--color-success) 48%, transparent);
  --surface-accent: color-mix(in srgb, var(--color-success) 62%, var(--color-border));
}

.week-card--rest {
  border-style: dashed;
  border-color: color-mix(in srgb, var(--color-info) 42%, transparent);
  background-image: linear-gradient(
      150deg,
      color-mix(in srgb, var(--surface-accent, var(--color-info)) 10%, transparent) 0%,
      transparent 70%
    ),
    var(--panel-surface-gradient);
  --surface-accent: color-mix(in srgb, var(--color-info) 58%, var(--color-border));
}

.week-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}

.week-card__day {
  font-weight: 600;
  text-transform: uppercase;
  font-size: var(--font-size-xs);
  letter-spacing: 0.08em;
  color: var(--color-text-secondary);
}

.week-card__date {
  display: block;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
}

.week-card__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  color: var(--color-text-secondary);
}

.week-card__type {
  font-weight: 600;
  color: color-mix(in srgb, var(--surface-accent, var(--color-accent)) 55%, var(--color-text-primary));
}

.week-card__focus {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);  /* 0.4→0.5 */
  font-size: var(--font-size-xs);
  color: color-mix(in srgb, var(--surface-accent, var(--color-accent)) 42%, var(--color-text-secondary));
}

.week-summary {
  gap: var(--space-lg);
  --surface-accent: color-mix(in srgb, var(--color-accent) 42%, var(--color-border));
}

.week-summary__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--space-md);
  margin: 0;
  list-style: none;
  padding: 0;
}

.week-summary__stat {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
}

.week-summary__label {
  display: block;
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-secondary);
}

.week-summary__value {
  display: block;
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: color-mix(in srgb, var(--surface-accent, var(--color-accent)) 55%, var(--color-text-primary));
}

.week-summary__actions {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 720px) {
  .week-page__controls {
    flex-direction: column;
    align-items: stretch;
  }

  .week-page__range {
    width: 100%;
    text-align: center;
  }

  .week-summary__actions {
    justify-content: stretch;
  }

  .week-summary__actions .button {
    width: 100%;
  }
}
</style>
