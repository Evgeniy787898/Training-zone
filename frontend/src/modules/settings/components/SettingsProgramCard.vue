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
      v-if="programLoadingState"
      class="settings-card__loader"
      title="Синхронизирую программу…"
      description="Подтягиваем текущий план и уровни упражнений"
      :skeleton-count="2"
      :skeleton-lines="3"
      inline
    />

    <div v-else-if="userProgramValue" class="settings-program">
      <dl class="settings-program__details">
        <div>
          <dt>Программа</dt>
          <dd>{{ userProgramValue.program?.title || userProgramValue.program?.name || 'Без названия' }}</dd>
        </div>
        <div>
          <dt>Направление</dt>
          <dd>{{ userProgramValue.discipline?.name || 'Не выбрано' }}</dd>
        </div>
        <div>
          <dt>Выбрана</dt>
          <dd>{{ programSelectedAtLabel }}</dd>
        </div>
      </dl>
      <p v-if="programSourceHint" class="settings-program__hint" role="status">
        {{ programSourceHint }}
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
        <BaseButton variant="secondary" @click="goToPrograms">
          {{ userProgramValue ? 'Сменить программу' : 'Выбрать программу' }}
        </BaseButton>
      </div>
    </template>
  </BaseCard>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '@/stores/app';
import NeonIcon from '@/modules/shared/components/NeonIcon.vue';
import AppIcon from '@/modules/shared/components/AppIcon.vue';
import LoadingState from '@/modules/shared/components/LoadingState.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCard from '@/components/ui/BaseCard.vue';

const appStore = useAppStore();
const router = useRouter();

const programLoadingState = computed(() => appStore.programLoading);
const userProgramValue = computed(() => appStore.userProgram);

const programSourceValue = computed(() => appStore.programSource);

const programSourceBadgeLabel = computed(() => {
  const source = programSourceValue.value;
  if (!source) return 'Нет данных';
  if (source === 'database') return 'Supabase';
  if (source === 'legacy_sql') return 'Резервный SQL';
  if (source === 'schema_unavailable') return 'Резервный план';
  return source;
});

const programSourceBadgeClass = computed(() => {
  const source = programSourceValue.value;
  if (!source) return 'badge--neutral';
  return source === 'database' ? 'badge--success' : 'badge--warning';
});

type ProgramWithSelection = typeof userProgramValue.value extends infer T ? T & { selectedAt?: string | null } : never;

const formatIso = (value: string | number): string => {
  try {
    const date = typeof value === 'number' ? new Date(value) : new Date(value);
    return date.toLocaleString();
  } catch {
    return String(value);
  }
};

const programSelectedAt = computed(() => {
  const program = userProgramValue.value as ProgramWithSelection | null;
  if (!program) {
    return null;
  }
  const manualSelection = 'selectedAt' in program ? program.selectedAt ?? null : null;
  return manualSelection ?? program.updatedAt ?? program.createdAt ?? null;
});

const programSelectedAtLabel = computed(() => {
  return programSelectedAt.value ? formatIso(programSelectedAt.value) : '—';
});

const programSourceHint = computed(() => {
  const source = programSourceValue.value;
  if (!source || source === 'database') {
    return null;
  }
  if (source === 'legacy_sql') {
    return 'Данные загружены из резервной SQL-схемы. После миграции обнови программу для синхронизации.';
  }
  if (source === 'schema_unavailable') {
    return 'Показан примерный план без связанной базы. Проверь подключение Supabase перед стартом тренировки.';
  }
  return null;
});

const goToPrograms = () => {
  router.push('/exercises');
};
</script>
