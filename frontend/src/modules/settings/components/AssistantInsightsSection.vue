<template>
  <section class="surface-card settings-card settings-card--assistant section-surface">
    <header class="surface-card__header surface-card__header--split">
      <div class="surface-card__title">
        <NeonIcon name="spark" variant="violet" :size="26" class="settings-card__title-icon" />
        <span>Ассистент и заметки</span>
      </div>
      <span class="badge" :class="assistantLatencyBadgeClass">
        {{ assistantLatencyStatusLabel }}
      </span>
    </header>
    <p class="surface-card__subtitle">
      Следи за латентностью ассистента и сохраняй быстрые заметки, чтобы не потерять инсайты.
    </p>

    <div v-if="assistantLatencyStatsValue" class="stat-grid">
      <StatCard
        label="Последний ответ"
        :value="formatLatency(assistantLatencyStatsValue.lastMs)"
        hint="мс"
        icon="spark"
        intent="success"
        variant="gradient"
        accent="success"
      />
      <StatCard
        label="Среднее время"
        :value="formatLatency(assistantLatencyStatsValue.averageMs)"
        hint="мс"
        icon="clock"
        intent="warning"
        variant="gradient"
        accent="warning"
      />
      <StatCard
        label="Замеров"
        :value="assistantLatencyStatsValue.samples || 0"
        hint="итерации"
        icon="pulse"
        intent="default"
        variant="gradient"
        accent="info"
      />
      <StatCard
        label="Медленных ответов"
        :value="formatSlowRatio(assistantLatencyStatsValue.slowRatio)"
        hint="доля"
        icon="alert"
        intent="danger"
        variant="gradient"
        accent="danger"
      />
    </div>

    <article
      v-if="assistantLatencyAlert"
      class="settings-assistant-alert"
      :class="`settings-assistant-alert--${assistantLatencyAlert.severity}`"
    >
      <header class="settings-assistant-alert__header">
        <NeonIcon :name="assistantLatencyAlertIcon" :variant="assistantLatencyAlertVariant" :size="22" />
        <div class="settings-assistant-alert__meta">
          <div class="settings-assistant-alert__title">{{ assistantLatencyAlertHeading }}</div>
          <time class="settings-assistant-alert__timestamp" :datetime="assistantLatencyAlert.triggeredAt">
            {{ formatIso(assistantLatencyAlert.triggeredAt) }}
          </time>
        </div>
      </header>
      <p class="settings-assistant-alert__message">{{ assistantLatencyAlert.message }}</p>
      <ul class="settings-assistant-alert__metrics list-reset">
        <li>
          <span class="settings-assistant-alert__metric-label">Порог</span>
          <span class="settings-assistant-alert__metric-value">{{ formatLatency(assistantLatencyAlert.thresholdMs) }}</span>
        </li>
        <li v-if="assistantLatencyAlert.latencyMs !== null">
          <span class="settings-assistant-alert__metric-label">Последний ответ</span>
          <span class="settings-assistant-alert__metric-value">{{ formatLatency(assistantLatencyAlert.latencyMs) }}</span>
        </li>
        <li v-if="assistantLatencyAlert.slowRatio !== null">
          <span class="settings-assistant-alert__metric-label">Доля медленных</span>
          <span class="settings-assistant-alert__metric-value">{{ formatSlowRatio(assistantLatencyAlert.slowRatio) }}</span>
        </li>
        <li v-if="assistantLatencyAlert.samples">
          <span class="settings-assistant-alert__metric-label">Замеров</span>
          <span class="settings-assistant-alert__metric-value">{{ assistantLatencyAlert.samples }}</span>
        </li>
      </ul>
    </article>

    <div v-if="assistantLatencyHistoryTail.length" class="settings-assistant-alert-history">
      <h4>История предупреждений</h4>
      <ul class="list-reset settings-assistant-alert-history__list">
        <li
          v-for="entry in assistantLatencyHistoryTail"
          :key="entry.triggeredAt"
          class="settings-assistant-alert-history__item"
        >
          <span class="settings-assistant-alert-history__badge" :class="`settings-assistant-alert-history__badge--${entry.severity}`">
            {{ entry.severity === 'error' ? 'ALERT' : 'WARN' }}
          </span>
          <time class="settings-assistant-alert-history__time" :datetime="entry.triggeredAt">
            {{ formatIso(entry.triggeredAt) }}
          </time>
          <span class="settings-assistant-alert-history__message">{{ entry.message }}</span>
        </li>
      </ul>
    </div>

    <p class="settings-card__hint" role="status">{{ assistantLatencyHint }}</p>

    <NoteList
      title="Заметки ассистента"
      subtitle="Сохраняй важные мысли, пока они свежи."
      :items="assistantNotes"
      :loading="assistantNotesLoading"
      :error="noteListError"
      :virtualized="assistantNotesVirtualized"
      :total-height="`${assistantNotesVirtualHeight}px`"
      :offset="`translateY(${assistantNotesVirtualOffset}px)`"
      aria-label="Заметки ассистента"
      @retry="reloadAssistantNotes"
    >
      <template #actions>
        <button
          type="button"
          class="button button--ghost"
          :disabled="addingNote || !newNoteContent.trim()"
          @click="handleAddNote"
        >
          {{ addingNote ? 'Добавляем…' : 'Сохранить' }}
        </button>
      </template>

      <template #form>
        <form class="settings-notes__form" @submit.prevent="handleAddNote">
          <FormField label="Заголовок" :label-for="noteTitleId" size="md">
            <input
              :id="noteTitleId"
              v-model="newNoteTitle"
              type="text"
              class="input"
              placeholder="Например: инсайт по технике"
            />
          </FormField>
          <FormField label="Содержимое" :label-for="noteContentId" size="md">
            <textarea
              :id="noteContentId"
              v-model="newNoteContent"
              class="textarea"
              rows="3"
              placeholder="Запиши важную мысль от ассистента"
            ></textarea>
          </FormField>
        </form>
      </template>

      <template #items>
        <article v-for="note in assistantNotes" :key="note.id" class="settings-notes__item" role="listitem">
          <div>
            <h4 class="settings-notes__item-title">{{ note.title || 'Без названия' }}</h4>
            <p class="settings-notes__item-content">{{ note.content }}</p>
          </div>
          <span class="settings-notes__item-meta">{{ formatIso(note.createdAt || (note as any).created_at) }}</span>
        </article>
      </template>

      <template #virtual-items>
        <article
          v-for="{ item: note, index } in assistantNotesVirtualItems"
          :key="note.id || `assistant-note-${index}`"
          class="settings-notes__item"
          role="listitem"
        >
          <div>
            <h4 class="settings-notes__item-title">{{ note.title || 'Без названия' }}</h4>
            <p class="settings-notes__item-content">{{ note.content }}</p>
          </div>
          <span class="settings-notes__item-meta">{{ formatIso(note.createdAt || (note as any).created_at) }}</span>
        </article>
      </template>

      <template #footer>
        <div v-if="assistantNotesLoading" class="settings-notes__status">
          <LoadingState title="Загружаем ещё…" description="Подгружаем следующую страницу заметок" :skeleton-count="1" inline />
        </div>
        <div v-else-if="noteListError" class="settings-notes__status">
          <p>
            Не удалось загрузить ещё заметки.
            <button type="button" class="button button--ghost" @click="loadMoreAssistantNotes">Повторить</button>
          </p>
        </div>
        <div v-else-if="assistantNotesHasMore" class="settings-notes__actions">
          <button type="button" class="button button--ghost" @click="loadMoreAssistantNotes">Загрузить ещё</button>
          <div ref="assistantNotesSentinel" class="settings-notes__sentinel" aria-hidden="true"></div>
        </div>
      </template>
    </NoteList>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAppStore } from '@/stores/app';
import { cachedApiClient as apiClient } from '@/services/cachedApi';
import NeonIcon from '@/modules/shared/components/NeonIcon.vue';
import LoadingState from '@/modules/shared/components/LoadingState.vue';
import FormField from '@/modules/shared/components/FormField.vue';
import StatCard from '@/modules/shared/components/StatCard.vue';
import NoteList from '@/modules/shared/components/NoteList.vue';
import type { AssistantNote } from '@/types';
import { useLazyList } from '@/composables/useLazyList';
import { useVirtualScroller } from '@/composables/useVirtualScroller';

const appStore = useAppStore();

const formatIso = (value: string | number): string => {
  try {
    const date = typeof value === 'number' ? new Date(value) : new Date(value);
    return date.toLocaleString();
  } catch {
    return String(value);
  }
};

const assistantSessionState = computed(() => appStore.assistantSessionState);
const assistantLatencyStatsValue = computed(() => appStore.assistantLatencyStats);
const assistantLatencyAlert = computed(() => assistantSessionState.value?.latencyAlert ?? null);
const assistantLatencyHistory = computed(() => assistantSessionState.value?.latencyAlertHistory ?? []);
const assistantLatencyHistoryTail = computed(() => assistantLatencyHistory.value.slice(1));
const assistantLatencyAlertVariant = computed(() => assistantLatencyAlert.value?.severity === 'error' ? 'violet' : 'amber');
const assistantLatencyAlertHeading = computed(() => {
  if (!assistantLatencyAlert.value) {
    return 'Латентность ассистента стабильна';
  }
  return assistantLatencyAlert.value.severity === 'error'
    ? 'Требуется внимание'
    : 'Есть предупреждения';
});
const assistantLatencyAlertIcon = computed(() => assistantLatencyAlert.value?.severity === 'error' ? 'alert' : 'info');

type AssistantLatencyTone = 'healthy' | 'degraded' | 'slow' | 'unknown';
const assistantLatencyStatus = computed<AssistantLatencyTone>(() => {
  const stats = assistantLatencyStatsValue.value;
  const alert = assistantLatencyAlert.value;
  if (!stats && !alert) return 'unknown';
  if (alert?.severity === 'error') return 'slow';
  if (alert) return 'degraded';
  if ((stats?.slowRatio ?? 0) > 0.2) return 'degraded';
  if ((stats?.averageMs ?? 0) > 2500) return 'degraded';
  if ((stats?.lastMs ?? 0) > 3000) return 'slow';
  return 'healthy';
});

const assistantLatencyBadgeClass = computed(() => {
  switch (assistantLatencyStatus.value) {
    case 'healthy':
      return 'badge--success';
    case 'degraded':
      return 'badge--warning';
    case 'slow':
      return 'badge--danger';
    default:
      return 'badge--neutral';
  }
});

const assistantLatencyStatusLabel = computed(() => {
  switch (assistantLatencyStatus.value) {
    case 'healthy':
      return 'Стабильно';
    case 'degraded':
      return 'Нужен контроль';
    case 'slow':
      return 'Замедления';
    default:
      return 'Нет данных';
  }
});

const assistantLatencyHint = computed(() => {
  if (assistantLatencyAlert.value) {
    return assistantLatencyAlert.value.message;
  }
  switch (assistantLatencyStatus.value) {
    case 'healthy':
      return 'Ответы ассистента укладываются в рабочие пределы.';
    case 'degraded':
      return 'Среднее время ответа выросло — стоит проверить нагрузку.';
    case 'slow':
      return 'Последний ответ превысил порог, возможны задержки.';
    default:
      return 'Ассистент ещё не собирал статистику.';
  }
});

const formatLatency = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return `${Math.round(value)} мс`;
};

const formatSlowRatio = (ratio: number | null | undefined): string => {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) {
    return '—';
  }
  return `${Math.round(ratio * 100)}%`;
};

const {
  items: assistantNotes,
  loading: assistantNotesLoading,
  error: assistantNotesError,
  hasMore: assistantNotesHasMore,
  sentinelRef: assistantNotesSentinel,
  reload: reloadAssistantNotes,
  loadMore: loadMoreAssistantNotes,
} = useLazyList<AssistantNote>({
  pageSize: 10,
  immediate: true,
  limiterKey: 'assistant-notes',
  throttleMs: 750,
  debounceMs: 200,
  fetchPage: async (page, pageSize) => {
    const response = await apiClient.getAssistantNotes({ page, pageSize });
    const notes = Array.isArray(response?.notes) ? response.notes : [];
    const pagination = response?.pagination;
    return {
      items: notes,
      hasMore: pagination ? Boolean(pagination.has_more) : notes.length === pageSize,
    };
  },
});

const noteListError = computed<Error | null>(() => {
  const rawError = assistantNotesError.value as unknown;
  if (!rawError) {
    return null;
  }
  if (rawError instanceof Error) {
    return rawError;
  }
  if (typeof rawError === 'string') {
    return new Error(rawError);
  }
  return new Error('Не удалось загрузить заметки');
});

const assistantNotesVirtual = useVirtualScroller<AssistantNote>({
  items: assistantNotes,
  estimateSize: 128,
  overscan: 6,
  disabledThreshold: 12,
});
const assistantNotesVirtualItems = assistantNotesVirtual.virtualItems;
const assistantNotesVirtualized = assistantNotesVirtual.isVirtualized;
const assistantNotesVirtualHeight = assistantNotesVirtual.totalHeight;
const assistantNotesVirtualOffset = assistantNotesVirtual.offsetTop;

const addingNote = ref(false);
const newNoteTitle = ref('');
const newNoteContent = ref('');
const noteTitleId = 'settings-note-title';
const noteContentId = 'settings-note-content';

const handleAddNote = async () => {
  if (!newNoteContent.value.trim()) return;
  addingNote.value = true;
  try {
    await apiClient.createAssistantNote({
      title: newNoteTitle.value.trim() || undefined,
      content: newNoteContent.value.trim(),
    });
    newNoteTitle.value = '';
    newNoteContent.value = '';
    await reloadAssistantNotes();
    appStore.showToast({
      title: 'Готово',
      message: 'Заметка сохранена',
      type: 'success',
    });
  } catch (error) {
    console.error('Failed to add assistant note', error);
    appStore.showToast({
      title: 'Ошибка',
      message: 'Не удалось сохранить заметку',
      type: 'error',
    });
  } finally {
    addingNote.value = false;
  }
};
</script>

<style scoped>
.settings-card--assistant {
  gap: clamp(1.5rem, 4vw, 2rem);
}

.settings-card--assistant .stat-grid {
  margin-top: 0.5rem;
}

.settings-assistant-alert {
  position: relative;
  padding: 1.25rem;
  border-radius: var(--radius-xl);
  border: 1px solid color-mix(in srgb, var(--color-border) 55%, transparent);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--color-surface) 90%, transparent),
    color-mix(in srgb, var(--color-alt-surface) 40%, transparent)
  );
  overflow: hidden;
}

.settings-assistant-alert::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle, color-mix(in srgb, var(--color-warning) 18%, transparent), transparent 60%);
  opacity: 0.45;
  pointer-events: none;
}

.settings-assistant-alert--error::before {
  background: radial-gradient(circle, color-mix(in srgb, var(--color-danger) 24%, transparent), transparent 60%);
}

.settings-assistant-alert__header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  position: relative;
  z-index: 1;
}

.settings-assistant-alert__title {
  font-weight: 600;
}

.settings-assistant-alert__timestamp {
  display: block;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.settings-assistant-alert__message {
  margin: 0.75rem 0;
  position: relative;
  z-index: 1;
  color: var(--color-text-secondary);
}

.settings-assistant-alert__metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 0.75rem;
  position: relative;
  z-index: 1;
}

.settings-assistant-alert__metric-label {
  display: block;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.settings-assistant-alert__metric-value {
  font-weight: 600;
  font-size: var(--font-size-lg);
}

.settings-assistant-alert-history {
  width: 100%;
}

.settings-assistant-alert-history__list {
  display: grid;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.settings-assistant-alert-history__item {
  display: grid;
  grid-template-columns: auto auto 1fr;
  gap: 0.5rem;
  align-items: center;
  font-size: var(--font-size-sm);
  padding: 0.5rem 0.25rem;
}

.settings-assistant-alert-history__badge {
  padding: 0.1rem 0.5rem;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: 600;
  background: color-mix(in srgb, var(--color-warning) 14%, transparent);
  color: color-mix(in srgb, var(--color-warning) 55%, var(--color-text-primary));
}

.settings-assistant-alert-history__badge--error {
  background: color-mix(in srgb, var(--color-danger) 14%, transparent);
  color: color-mix(in srgb, var(--color-danger) 60%, var(--color-text-primary));
}

.settings-assistant-alert-history__time {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.settings-assistant-alert-history__message {
  color: var(--color-text-secondary);
}

.settings-notes {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.settings-notes__header {
  display: flex;
  justify-content: space-between;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.settings-notes__form {
  display: grid;
  gap: var(--space-sm);
}

.settings-notes__list-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.settings-notes__list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: 360px;
  overflow: auto;
}

.settings-notes__item {
  display: flex;
  justify-content: space-between;
  gap: var(--space-sm);
  padding: 0.85rem 1.1rem;
  border-radius: var(--radius-lg);
  border: 1px solid color-mix(in srgb, var(--color-border) 55%, transparent);
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--panel-surface-base) 90%, transparent) 0%,
    color-mix(in srgb, var(--color-bg-secondary) 35%, transparent) 100%
  );
  box-shadow: 0 12px 22px color-mix(in srgb, var(--color-surface) 18%, transparent);
}

.settings-notes__item-title {
  margin: 0;
  font-weight: 600;
}

.settings-notes__item-content {
  margin: 0.35rem 0 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.settings-notes__item-meta {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.settings-notes__status {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.settings-notes__actions {
  display: flex;
  justify-content: flex-end;
}

.settings-notes__sentinel {
  width: 100%;
  height: 1px;
}

@media (max-width: 720px) {
  .settings-notes__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .settings-notes__item {
    flex-direction: column;
  }
}
</style>
