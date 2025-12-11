<template>
  <BaseCard class="settings-card settings-card--program section-surface">
    <template #header>
      <div class="surface-card__header-content">
        <div class="surface-card__title">
          <NeonIcon name="dumbbell" variant="lime" :size="26" class="settings-card__title-icon" />
          <span>Программа тренировок</span>
        </div>
        <span class="badge" :class="programSourceBadgeClass">
          {{ programSourceBadgeLabel }}
        </span>
      </div>
      <p class="surface-card__subtitle">
        Синхронизированная программа помогает Today и отчётам подгружать упражнения без задержек.
      </p>
    </template>

    <LoadingState
      v-if="loading"
      class="settings-card__loader"
      title="Синхронизирую программу…"
      description="Подтягиваем текущий план и уровни упражнений"
      :skeleton-count="2"
      :skeleton-lines="3"
      inline
    />

    <div v-else-if="userProgram" class="settings-program">
      <dl class="settings-program__details">
        <div>
          <dt>Программа</dt>
          <dd>{{ userProgram.program?.title || userProgram.program?.name || 'Без названия' }}</dd>
        </div>
        <div>
          <dt>Направление</dt>
          <dd>{{ userProgram.discipline?.name || 'Не выбрано' }}</dd>
        </div>
        <div>
          <dt>Выбрана</dt>
          <dd>{{ selectedAtLabel }}</dd>
        </div>
      </dl>
      <p v-if="sourceHint" class="settings-program__hint" role="status">
        {{ sourceHint }}
      </p>
    </div>

    <div v-else class="empty-state empty-state--inline">
      <AppIcon class="empty-state__icon" name="target" variant="emerald" tone="ghost" :size="30" />
      <div class="empty-state__title">Программа не выбрана</div>
      <p class="empty-state__description">
        Открой вкладку «Программы тренировок», чтобы выбрать план и получить рекомендации.
      </p>
    </div>

    <template #footer>
      <div class="settings-card__actions">
        <BaseButton variant="secondary" @click="$emit('change-program')">
          {{ userProgram ? 'Сменить программу' : 'Выбрать программу' }}
        </BaseButton>
      </div>
    </template>
  </BaseCard>
</template>

<script setup lang="ts">
/**
 * ProfileWidget - Training Program Card for SettingsPage
 * Extracted as part of SETT-R02 decomposition
 */
import { computed } from 'vue';
import NeonIcon from '@/modules/shared/components/NeonIcon.vue';
import AppIcon from '@/modules/shared/components/AppIcon.vue';
import LoadingState from '@/modules/shared/components/LoadingState.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCard from '@/components/ui/BaseCard.vue';

interface UserProgram {
  program?: { title?: string; name?: string } | null;
  discipline?: { name?: string } | null;
  selectedAt?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
}

const props = defineProps<{
  loading: boolean;
  userProgram: UserProgram | null;
  programSource: string | null;
}>();

defineEmits<{
  (e: 'change-program'): void;
}>();

const programSourceBadgeLabel = computed(() => {
  const source = props.programSource;
  if (!source) return 'Нет данных';
  if (source === 'database') return 'Supabase';
  if (source === 'legacy_sql') return 'Резервный SQL';
  if (source === 'schema_unavailable') return 'Резервный план';
  return source;
});

const programSourceBadgeClass = computed(() => {
  const source = props.programSource;
  if (!source) return 'badge--neutral';
  return source === 'database' ? 'badge--success' : 'badge--warning';
});

const selectedAt = computed(() => {
  const program = props.userProgram;
  if (!program) return null;
  return program.selectedAt ?? program.updatedAt ?? program.createdAt ?? null;
});

const selectedAtLabel = computed(() => {
  if (!selectedAt.value) return '—';
  try {
    const date = new Date(selectedAt.value);
    return date.toLocaleString();
  } catch {
    return String(selectedAt.value);
  }
});

const sourceHint = computed(() => {
  const source = props.programSource;
  if (!source || source === 'database') return null;
  if (source === 'legacy_sql') {
    return 'Данные загружены из резервной SQL-схемы. После миграции обнови программу для синхронизации.';
  }
  if (source === 'schema_unavailable') {
    return 'Показан примерный план без связанной базы. Проверь подключение Supabase перед стартом тренировки.';
  }
  return null;
});
</script>
