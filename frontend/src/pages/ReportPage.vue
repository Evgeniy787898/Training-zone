<template>
  <div class="page-shell report-page">
    <header class="page-header report-page__header">
      <div class="report-page__title">
        <h1 class="page-title">
          <AppIcon
            class="page-title__icon"
            name="checklist"
            variant="emerald"
            :size="28"
          />
          <span>Отчёт о тренировке</span>
        </h1>
        <span v-if="fallback || appStore.demoMode" class="badge badge--warning report-page__badge">пример данных</span>
      </div>
    </header>

    <section v-if="loading" class="surface-card surface-card--overlay report-page__loading">
      <SkeletonCard :lines="4" />
    </section>

    <section v-else-if="error && !session" class="surface-card surface-card--overlay report-page__error">
      <ErrorState
        title="Не удалось загрузить тренировку"
        :message="error.message"
        action-label="Попробовать ещё раз"
        @retry="loadSession"
      />
    </section>

    <section v-else class="report-page__content">
      <div v-if="session" class="surface-card report-session">
        <div class="report-session__header">
          <NeonIcon name="pulse" variant="lime" :size="40" />
          <div>
            <h2>{{ sessionTitle }}</h2>
            <p v-if="sessionFocus">{{ sessionFocus }}</p>
          </div>
        </div>
        <div class="report-session__meta">
          <span v-if="sessionDateLabel" class="report-session__badge">
            <NeonIcon name="calendar" variant="violet" :size="20" />
            {{ sessionDateLabel }}
          </span>
          <span class="report-session__badge">
            <NeonIcon name="info" variant="aqua" :size="20" />
            Источник: {{ fallback ? 'примерный план' : source || 'Supabase' }}
          </span>
        </div>
      </div>

      <div v-if="fallback || appStore.demoMode" class="surface-card report-preview">
        <div class="report-preview__header">
          <NeonIcon name="insight" variant="violet" :size="28" />
          <div>
            <h3>Предпросмотр отчёта</h3>
            <p>Сейчас показан примерный план. После запуска из Telegram все данные сохранятся в профиль.</p>
          </div>
        </div>
      </div>

      <form v-if="session" class="surface-card report-form" @submit.prevent="handleSubmit">
        <div class="report-form__grid form-grid">
          <FormField label="Статус тренировки" :for-id="statusFieldId">
            <select :id="statusFieldId" v-model="form.status" class="select">
              <option value="done">Выполнена</option>
              <option value="skipped">Пропущена</option>
            </select>
          </FormField>
          <FormField label="RPE" :for-id="rpeFieldId">
            <select :id="rpeFieldId" v-model="form.rpe" class="select">
              <option v-for="i in 10" :key="i" :value="String(i)">{{ i }}</option>
            </select>
          </FormField>
        </div>

        <FormField
          label="Общие заметки"
          :for-id="notesFieldId"
          hint="Расскажи о самочувствии, сложностях и том, что стоит улучшить"
        >
          <textarea
            :id="notesFieldId"
            v-model="form.notes"
            rows="3"
            placeholder="Самочувствие, сложности, что улучшить"
            class="textarea"
          />
        </FormField>

        <section class="report-exercises">
          <h3>Упражнения</h3>
          <article
            v-for="(exercise, index) in exercises"
            :key="exercise.key"
            class="report-exercise"
            role="group"
            :aria-labelledby="getExerciseTitleId(index)"
            :aria-describedby="exercise.target?.sets ? getExercisePlanId(index) : undefined"
          >
            <header class="report-exercise__header">
              <div
                class="report-exercise__title"
                :id="getExerciseTitleId(index)"
              >
                <NeonIcon name="target" variant="emerald" :size="22" />
                <span>{{ index + 1 }}. {{ exercise.name }}</span>
              </div>
              <span
                v-if="exercise.target?.sets"
                class="report-exercise__plan"
                :id="getExercisePlanId(index)"
              >
                План: {{ exercise.target.sets }} × {{ exercise.target.reps || '—' }}
              </span>
            </header>

            <div class="report-exercise__grid">
              <FormField
                label="Подходы"
                :for-id="getExerciseInputId(exercise.key, 'sets')"
              >
                <input
                  :id="getExerciseInputId(exercise.key, 'sets')"
                  type="number"
                  min="0"
                  v-model.number="form.exercises[exercise.key].sets"
                  class="input"
                />
              </FormField>
              <FormField
                label="Повторы"
                :for-id="getExerciseInputId(exercise.key, 'reps')"
              >
                <input
                  :id="getExerciseInputId(exercise.key, 'reps')"
                  type="number"
                  min="0"
                  v-model.number="form.exercises[exercise.key].reps"
                  class="input"
                />
              </FormField>
              <FormField
                label="RPE"
                :for-id="getExerciseInputId(exercise.key, 'rpe')"
              >
                <input
                  :id="getExerciseInputId(exercise.key, 'rpe')"
                  type="number"
                  min="1"
                  max="10"
                  v-model.number="form.exercises[exercise.key].rpe"
                  class="input"
                />
              </FormField>
            </div>

            <FormField
              label="Заметки"
              :for-id="getExerciseInputId(exercise.key, 'notes')"
              hint="Техника, ощущения, прогресс"
            >
              <textarea
                :id="getExerciseInputId(exercise.key, 'notes')"
                v-model="form.exercises[exercise.key].notes"
                rows="2"
                placeholder="Техника, ощущения, прогресс"
                class="textarea"
              />
            </FormField>
          </article>
        </section>

        <footer class="report-form__footer">
          <span class="report-form__source">
            <NeonIcon name="info" variant="neutral" :size="20" />
            Источник данных: {{ fallback ? 'примерный план' : source || 'Supabase' }}
          </span>
          <button type="submit" class="button button--primary cta-button" :disabled="saving">
            <NeonIcon :name="saving ? 'clock' : 'success'" :variant="saving ? 'neutral' : 'emerald'" :size="22" />
            <span>{{ saving ? 'Сохраняю отчёт…' : 'Сохранить отчёт' }}</span>
          </button>
        </footer>
      </form>

      <div v-else class="surface-card empty-state">
        <div class="empty-state__icon">🌙</div>
        <div class="empty-state__title">Сегодня день восстановления</div>
        <p class="empty-state__description">
          В плане нет тренировки — запиши ощущения вручную или попроси бота перенести занятие.
        </p>
        <button type="button" class="button button--ghost" @click="loadSession">
          <NeonIcon name="reset" variant="violet" :size="20" />
          Обновить план
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useAppStore } from '@/stores/app';
import { cachedApiClient as apiClient } from '@/services/cachedApi';
import NeonIcon from '@/modules/shared/components/NeonIcon.vue';
import AppIcon from '@/modules/shared/components/AppIcon.vue';
import ErrorState from '@/modules/shared/components/ErrorState.vue';
import SkeletonCard from '@/modules/shared/components/SkeletonCard.vue';
import FormField from '@/modules/shared/components/FormField.vue';

const appStore = useAppStore();
const { showToast, refreshProfile } = appStore;

interface Exercise {
  key: string;
  name: string;
  target?: {
    sets?: number;
    reps?: number;
  };
}

const loading = ref(true);
const error = ref<Error | null>(null);
const session = ref<any>(null);
const source = ref<string | null>(null);
const fallback = ref(false);
const saving = ref(false);

const statusFieldId = 'report-status';
const rpeFieldId = 'report-rpe';
const notesFieldId = 'report-notes';

const getExerciseInputId = (key: string, field: string) => `report-${key}-${field}`;

const getExerciseTitleId = (index: number) => `report-exercise-title-${index}`;
const getExercisePlanId = (index: number) => `report-exercise-plan-${index}`;

const form = ref({
  status: 'done',
  rpe: '7',
  notes: '',
  exercises: {} as Record<string, { sets: number | string; reps: number | string; rpe: number | string; notes: string }>,
});

const exercises = computed<Exercise[]>(() => {
  return (session.value?.exercises || []).map((exercise: any, index: number) => ({
    key: exercise.exercise_key || `exercise_${index}`,
    name: exercise.name || exercise.exercise_key || `Упражнение ${index + 1}`,
    target: exercise.target,
  }));
});

const sessionTitle = computed(() => {
  return session.value?.session_type || session.value?.title || session.value?.name || 'Тренировка';
});

const sessionFocus = computed(() => {
  return session.value?.focus || session.value?.goal || session.value?.description || null;
});

const sessionDateLabel = computed(() => {
  const rawDate = session.value?.date || session.value?.scheduled_for || session.value?.scheduled_at;
  if (!rawDate) return null;
  try {
    return format(parseISO(rawDate), 'd MMMM, EEEE', { locale: ru });
  } catch {
    return rawDate;
  }
});

const buildFormFromSession = (sess: any) => {
  if (!sess) {
    return { status: 'done', rpe: '7', notes: '', exercises: {} };
  }

  const exercises: Record<string, any> = {};
  (sess.exercises || []).forEach((exercise: any, index: number) => {
    const key = exercise.exercise_key || `exercise_${index}`;
    exercises[key] = {
      sets: exercise.actual?.sets ?? exercise.target?.sets ?? '',
      reps: exercise.actual?.reps ?? exercise.target?.reps ?? '',
      rpe: exercise.rpe ?? sess.rpe ?? 7,
      notes: exercise.notes || '',
    };
  });

  return {
    status: sess.status === 'skipped' ? 'skipped' : 'done',
    rpe: String(sess.rpe || 7),
    notes: sess.notes || '',
    exercises,
  };
};

const loadSession = async () => {
  loading.value = true;
  error.value = null;

  try {
    const today = format(new Date(), 'yyyy-MM-dd');
    const data = await apiClient.getTodaySession(today);
    session.value = data.session;
    source.value = data.source ?? null;
    fallback.value = data.source !== 'database';
  } catch (err: any) {
    error.value = err;
    const notFound = err?.code === 'NOT_FOUND_ERROR' || err?.response?.status === 404;
    showToast({
      title: notFound ? 'Нет данных за сегодня' : 'Не удалось загрузить тренировку',
      message: notFound
        ? 'Для отчёта нужна зафиксированная тренировка. Открой раздел «Сегодня» и отметь выполнение.'
        : 'Не получилось получить актуальную тренировку. Попробуй обновить страницу позже.',
      type: notFound ? 'info' : 'warning',
      traceId: err.traceId,
    });
  } finally {
    loading.value = false;
  }
};

watch(session, (newSession) => {
  if (newSession) {
    form.value = buildFormFromSession(newSession);
  }
}, { immediate: true });

const handleSubmit = async () => {
  if (!session.value?.id) {
    showToast({
      title: 'Демо режим',
      message: 'В режиме предпросмотра отчёт не отправляется на сервер. Открой приложение из Telegram для реального отчёта.',
      type: 'warning',
    });
    return;
  }

  saving.value = true;
  try {
    const exercisesPayload = exercises.value.map((exercise) => {
      const formEntry = form.value.exercises[exercise.key] || { sets: '', reps: '', notes: '', rpe: form.value.rpe };
      const actualSets = formEntry.sets !== '' ? Number(formEntry.sets) : undefined;
      const actualReps = formEntry.reps !== '' ? Number(formEntry.reps) : undefined;
      const payload: any = {
        exercise_key: exercise.key,
        target: exercise.target || {},
        state: form.value.status === 'skipped' ? 'skipped' : 'done',
      };

      if (actualSets !== undefined && !Number.isNaN(actualSets)) {
        payload.actual = { ...(payload.actual || {}), sets: actualSets };
      }
      if (actualReps !== undefined && !Number.isNaN(actualReps)) {
        payload.actual = { ...(payload.actual || {}), reps: actualReps };
      }
      if (formEntry.notes) {
        payload.notes = formEntry.notes;
      }
      if (formEntry.rpe) {
        const value = Number(formEntry.rpe);
        if (!Number.isNaN(value)) {
          payload.rpe = value;
        }
      }
      return payload;
    });

    const payload: any = {
      status: form.value.status,
      completed_at: new Date().toISOString(),
      rpe: Number(form.value.rpe),
      notes: form.value.notes || undefined,
    };

    if (form.value.status === 'skipped' || exercisesPayload.some(item => item.actual || item.notes || item.rpe)) {
      payload.exercises = exercisesPayload;
    }

    const data = await apiClient.updateSession(session.value.id, payload);

    showToast({
      title: 'Отчёт сохранён',
      message: data.next_steps || 'Тренировка обновлена. Продолжай в том же духе!',
      type: 'success',
    });

    await Promise.all([loadSession(), refreshProfile()]);
  } catch (err: any) {
    showToast({
      title: 'Не удалось сохранить отчёт',
      message: err.message,
      type: 'error',
      traceId: err.traceId,
    });
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  loadSession();
});
</script>

<style scoped>
.report-page {
  gap: clamp(1.5rem, 4vw, 2.5rem);
}

.report-page__title {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.report-page__badge {
  align-self: center;
}

.report-page__loading,
.report-page__error {
  min-height: 200px;
}

.report-page__content {
  display: flex;
  flex-direction: column;
  gap: clamp(1.5rem, 4vw, 2.25rem);
}

.report-session {
  gap: var(--space-md);
}

.report-session__header {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.report-session__header h2 {
  margin: 0 0 0.35rem;
  font-size: var(--font-size-xl);
  font-weight: 600;
}

.report-session__header p {
  margin: 0;
  color: var(--color-text-secondary);
}

.report-session__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.report-session__badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-2xs) var(--space-sm);  /* 0.35→0.25, 0.65→0.75 */
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--color-surface) 55%, transparent);
  border: 1px solid var(--color-border-subtle);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.report-preview {
  gap: var(--space-md);
}

.report-preview__header {
  display: flex;
  align-items: flex-start;
  gap: var(--space-md);
}

.report-preview__header h3 {
  margin: 0 0 0.25rem;
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.report-preview__header p {
  margin: 0;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.report-form {
  gap: clamp(1.25rem, 3vw, 1.75rem);
}

.report-form__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-md);
}

.report-exercises {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.report-exercises h3 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.report-exercise {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: clamp(1rem, 2vw, 1.4rem);
  border-radius: var(--radius-xl);
  --pointer-x: 0;
  --pointer-y: 0;
  --pointer-strength: 0;
  --pointer-active: 0;
  background: linear-gradient(
      150deg,
      color-mix(in srgb, var(--panel-surface-base) 94%, transparent) 0%,
      color-mix(in srgb, var(--color-bg-secondary) 45%, transparent) 100%
    );
  border: 1px solid color-mix(in srgb, var(--color-border) 55%, transparent);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--color-border) 35%, transparent),
    0 10px 24px color-mix(in srgb, var(--color-surface) 35%, transparent);
  transform: translate3d(
      calc(var(--pointer-x, 0) * 4px),
      calc(var(--pointer-y, 0) * 4px),
      0
    )
    scale(calc(1 + var(--pointer-strength, 0) * 0.025));
  transition:
    transform 0.35s cubic-bezier(0.23, 1, 0.32, 1),
    border-color 0.3s ease,
    box-shadow 0.3s ease,
    background 0.3s ease;
  overflow: hidden;
  isolation: isolate;
  touch-action: manipulation;
}

.report-exercise::before {
  content: '';
  position: absolute;
  inset: -20% -30% -40% -30%;
  background: radial-gradient(
    circle at calc(50% + var(--pointer-x, 0) * 30%),
    color-mix(in srgb, var(--color-accent) 20%, transparent) 0%,
    transparent 70%
  );
  opacity: calc(var(--pointer-strength, 0) * 0.45);
  transform: translate3d(
      calc(var(--pointer-x, 0) * 10px),
      calc(var(--pointer-y, 0) * 12px),
      0
    );
  transition: opacity 0.35s ease, transform 0.35s ease;
  z-index: 0;
}

.report-exercise::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--color-surface) 45%, transparent) 0%,
    transparent 40%
  );
  opacity: calc(0.35 + var(--pointer-strength, 0) * 0.35);
  pointer-events: none;
  transition: opacity 0.35s ease;
  z-index: 0;
}

.report-exercise:focus-within,
.report-exercise:hover,
.report-exercise[data-surface-interactive] {
  border-color: color-mix(in srgb, var(--color-accent) 55%, var(--color-border));
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--color-border-strong) 45%, transparent),
    0 18px 32px color-mix(in srgb, var(--color-accent) 14%, transparent);
}

.report-exercise[data-surface-interactive='coarse'] {
  transform: translate3d(
      calc(var(--pointer-x, 0) * 8px),
      calc(var(--pointer-y, 0) * 10px),
      0
    )
    scale(calc(1 + var(--pointer-strength, 0) * 0.035));
}

@media (prefers-reduced-motion: reduce) {
  .report-exercise,
  .report-exercise::before,
  .report-exercise::after {
    transition: none;
    transform: none;
  }
}

.report-exercise__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  position: relative;
  z-index: 1;
}

.report-exercise__title {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);  /* 0.6→0.75 close */
  font-weight: 600;
  color: var(--color-text-primary);
  position: relative;
  z-index: 1;
}

.report-exercise__plan {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  position: relative;
  z-index: 1;
}

.report-exercise__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--space-md);
  position: relative;
  z-index: 1;
}

.report-form__footer {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid var(--color-border-subtle);
  padding-top: var(--space-md);
}

.report-form__source {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.report-page .empty-state {
  gap: var(--space-md);
}

.report-page .empty-state .button {
  width: auto;
}

@media (max-width: 680px) {
  .report-form__footer {
    flex-direction: column;
    align-items: stretch;
  }

  .report-form__footer .button {
    width: 100%;
  }
}
</style>
