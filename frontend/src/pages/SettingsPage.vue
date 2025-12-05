<template>
  <div class="page-shell settings-page">
    <SectionHeading
      as="h1"
      title="Настройки"
      description="Контролируй стабильность сервиса, очищай кэш и сохраняй быстрые заметки ассистента."
      eyebrow="Управление"
    >
      <template #icon>
        <AppIcon class="page-title__icon" name="settings" variant="aqua" :size="30" />
      </template>
    </SectionHeading>

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
    </BaseCard>

    <BaseCard class="settings-card settings-card--status section-surface">
      <template #header>
        <div class="surface-card__header--split">
          <div class="surface-card__title">
            <NeonIcon name="heart" variant="amber" :size="26" class="settings-card__title-icon" />
            <span>Состояние приложения</span>
          </div>
          <div class="surface-card__header-actions">
            <StatusBadge
              v-if="overallStatus"
              :label="statusLabel(overallStatus)"
              :variant="statusVariant(overallStatus)"
              size="sm"
            />
            <DropdownMenu
              class="settings-card__dropdown"
              label="Быстрые действия"
              icon="spark"
              :items="healthQuickActions"
            />
          </div>
        </div>
        <p class="surface-card__subtitle">
          Следи за ключевыми сервисами и обновляй проверку при изменениях инфраструктуры.
        </p>
      </template>

      <LoadingState
        v-if="healthCheckLoading"
        class="settings-card__loader"
        title="Проверяю состояние…"
        description="Собираем статусы сервисов и кэшей"
        :skeleton-count="3"
        :skeleton-lines="2"
        inline
      />

      <div v-else-if="healthCheckResult" class="settings-status">
        <div class="settings-status__summary">
          <span class="settings-status__indicator" :class="`settings-status__indicator--${healthCheckResult.status}`"></span>
          <div class="settings-status__summary-text">
            <h3>Общее состояние</h3>
            <p>{{ statusHint(overallStatus) }}</p>
          </div>
          <span class="settings-status__metric">
            {{ formatIso(healthCheckResult.timestamp) }}
          </span>
        </div>

        <div class="settings-status__grid" role="list">
          <article
            v-for="([key, check]) in checkEntries"
            :key="key"
            class="settings-status__item"
            role="listitem"
          >
            <header class="settings-status__item-header">
              <span class="settings-status__item-title">{{ getCheckName(key) }}</span>
              <StatusBadge
                :label="statusLabel(check.status)"
                :variant="statusVariant(check.status)"
                size="sm"
              />
            </header>
            <p class="settings-status__item-description">{{ statusHint(check.status) }}</p>
            <dl
              v-if="getCheckMetrics(check).length"
              class="settings-status__item-meta"
            >
              <div
                v-for="metric in getCheckMetrics(check)"
                :key="metric.id"
                class="settings-status__metric-row"
              >
                <dt>{{ metric.label }}</dt>
                <dd>{{ metric.value }}</dd>
              </div>
            </dl>
            <p v-if="check.error" class="settings-status__error" role="status">
              {{ check.error }}
            </p>
          </article>
        </div>

        <div v-if="healthCheckResult.recommendations.length" class="settings-status__recommendations">
          <h4>Рекомендации</h4>
          <ul class="list-reset settings-status__recommendation-list">
            <li v-for="(recommendation, index) in healthCheckResult.recommendations" :key="index">
              <NeonIcon name="info" variant="aqua" :size="18" />
              <span>{{ recommendation }}</span>
            </li>
          </ul>
        </div>
      </div>

      <div v-else class="empty-state empty-state--inline">
        <div class="empty-state__icon">⚙️</div>
        <div class="empty-state__title">Нет данных проверки</div>
        <p class="empty-state__description">
          Запусти health-check, чтобы убедиться, что всё работает стабильно.
        </p>
      </div>

      <template #footer>
        <div class="settings-card__actions">
          <BaseButton
            variant="primary"
            @click="runHealthCheck"
            :loading="healthCheckLoading"
            loading-text="Проверяю…"
          >
            Обновить проверку
          </BaseButton>
        </div>
      </template>
    </BaseCard>

    <div class="page-grid page-grid--two settings-page__grid">
      <BaseCard class="settings-card">
        <template #header>
          <div class="surface-card__title">
            <NeonIcon name="chart" variant="lime" :size="26" class="settings-card__title-icon" />
            <span>Производительность</span>
          </div>
          <p class="surface-card__subtitle">
            Держи под контролем скорость API и рендера интерфейса.
          </p>
        </template>
        
        <div class="stat-grid">
          <StatCard
            label="Среднее время API"
            :value="formatMetric(performanceMetrics.avgApiResponseTime)"
            hint="за последнюю сессию"
            icon="pulse"
            intent="warning"
            variant="gradient"
            accent="warning"
            tooltip="Среднее время отклика критических эндпоинтов"
          />
          <StatCard
            label="Среднее время рендера"
            :value="formatMetric(performanceMetrics.avgRenderTime)"
            hint="интерфейс"
            icon="spark"
            tooltip="Средняя скорость отрисовки основного интерфейса"
          />
          <StatCard
            label="Метрик собрано"
            :value="performanceMetrics.totalMetrics"
            hint="за сутки"
            icon="stack"
            intent="success"
            tooltip="Количество записанных событий производительности"
          />
        </div>
        
        <template #footer>
          <div class="settings-card__actions">
            <BaseButton variant="ghost" @click="clearPerformanceMetrics">
              Очистить метрики
            </BaseButton>
          </div>
        </template>
      </BaseCard>

      <Suspense>
        <template #default>
          <AssistantInsightsSection />
        </template>
        <template #fallback>
          <BaseCard class="settings-card settings-card--assistant">
            <template #header>
              <div class="surface-card__header--split">
                <div class="surface-card__title">
                  <NeonIcon name="spark" variant="violet" :size="26" class="settings-card__title-icon" />
                  <span>Ассистент и заметки</span>
                </div>
                <span class="badge badge--neutral">Загрузка…</span>
              </div>
            </template>
            <LoadingState
              inline
              title="Готовим раздел ассистента…"
              description="Подключаем статистику и заметки"
              :skeleton-count="3"
              :skeleton-lines="2"
            />
          </BaseCard>
        </template>
      </Suspense>


      <BaseCard class="settings-card settings-card--cache">
        <template #header>
          <div class="surface-card__title">
            <NeonIcon name="database" variant="violet" :size="26" class="settings-card__title-icon" />
            <span>Кэш приложения</span>
          </div>
          <p class="surface-card__subtitle">
            Сбрасывай локальные данные, если нужно получить свежие ответы.
          </p>
        </template>

        <dl class="settings-cache" aria-live="polite">
          <div>
            <dt class="settings-cache__label">Элементов в кэше</dt>
            <dd class="settings-cache__value">{{ cacheSize }}</dd>
          </div>
        </dl>
        
        <template #footer>
          <div class="settings-card__actions">
            <BaseButton variant="warning" @click="clearCache">
              Очистить кэш
            </BaseButton>
          </div>
        </template>
      </BaseCard>

    </div>

    <BaseCard class="settings-card">
      <template #header>
        <div class="surface-card__title">
          <NeonIcon name="user" variant="aqua" :size="26" class="settings-card__title-icon" />
          <span>Аккаунт</span>
        </div>
        <p class="surface-card__subtitle">
          Завершай сессию, если нужно выйти из WebApp и обновить авторизацию.
        </p>
      </template>
      
      <div class="settings-account">
        <div>
          <span class="settings-account__title">Выход из аккаунта</span>
          <span class="settings-account__description">Сессия будет завершена после закрытия приложения в Telegram.</span>
        </div>
        <BaseButton variant="danger" @click="logout">
          Выйти
        </BaseButton>
      </div>
    </BaseCard>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, defineAsyncComponent } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '@/stores/app';
import { clearAllCaches, invalidateProgramContextCaches } from '@/services/cacheManager';
import NeonIcon from '@/modules/shared/components/NeonIcon.vue';
import AppIcon from '@/modules/shared/components/AppIcon.vue';
import LoadingState from '@/modules/shared/components/LoadingState.vue';
import SectionHeading from '@/modules/shared/components/SectionHeading.vue';
import StatCard from '@/modules/shared/components/StatCard.vue';
import StatusBadge from '@/modules/shared/components/StatusBadge.vue';
import DropdownMenu, { type DropdownItem } from '@/modules/shared/components/DropdownMenu.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import type { HealthCheckResult } from '@/services/healthCheck';
const AssistantInsightsSection = defineAsyncComponent({
  loader: () => import('@/modules/settings/components/AssistantInsightsSection.vue'),
  suspensible: true,
});

const appStore = useAppStore();
const router = useRouter();
type PerformanceMonitorInstance = (typeof import('@/services/performance'))['default'];
let performanceMonitorRef: PerformanceMonitorInstance | null = null;
const loadPerformanceMonitor = async (): Promise<PerformanceMonitorInstance> => {
  if (!performanceMonitorRef) {
    const module = await import('@/services/performance');
    performanceMonitorRef = module.default;
  }
  return performanceMonitorRef;
};

let healthCheckModule: Promise<typeof import('@/services/healthCheck')> | null = null;
const loadHealthCheckModule = () => {
  if (!healthCheckModule) {
    healthCheckModule = import('@/services/healthCheck');
  }
  return healthCheckModule;
};

const formatIso = (value: string | number): string => {
  try {
    const date = typeof value === 'number' ? new Date(value) : new Date(value);
    return date.toLocaleString();
  } catch {
    return String(value);
  }
};

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

const healthCheckLoading = ref(false);
const healthCheckResult = ref<HealthCheckResult | null>(null);
const cacheSize = ref(0);

const healthQuickActions = computed((): DropdownItem[] => [
  {
    id: 'refresh',
    label: healthCheckLoading.value ? 'Проверяю…' : 'Повторить проверку',
    description: 'Запустить health-check прямо сейчас',
    icon: 'spark',
    disabled: healthCheckLoading.value,
    action: runHealthCheck,
  },
  {
    id: 'analytics',
    label: 'Открыть метрики',
    description: 'Перейти к разделу «Аналитика»',
    icon: 'chart',
    action: () => {
      void router.push({ name: 'Analytics' });
    },
  },
  {
    id: 'report',
    label: 'Создать отчёт',
    description: 'Собрать отчёт о прогрессе',
    icon: 'report',
    action: () => {
      void router.push({ name: 'Report' });
    },
  },
]);

const performanceMetrics = ref({
  avgApiResponseTime: 0,
  avgRenderTime: 0,
  totalMetrics: 0
});

type StatusTone = 'healthy' | 'degraded' | 'unhealthy';
type HealthCheckMap = HealthCheckResult['checks'];
type HealthCheckKey = keyof HealthCheckMap;

const overallStatus = computed<StatusTone | null>(() => healthCheckResult.value?.status ?? null);
type StatusVariant = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const statusVariant = (status: StatusTone | null): StatusVariant => {
  switch (status) {
    case 'healthy':
      return 'success';
    case 'degraded':
      return 'warning';
    case 'unhealthy':
      return 'danger';
    default:
      return 'neutral';
  }
};

const checkEntries = computed<Array<[HealthCheckKey, HealthCheckMap[HealthCheckKey]]>>(() => {
  if (!healthCheckResult.value) {
    return [];
  }
  return Object.entries(healthCheckResult.value.checks) as Array<[
    HealthCheckKey,
    HealthCheckMap[HealthCheckKey]
  ]>;
});

const statusLabel = (status: StatusTone) => {
  switch (status) {
    case 'healthy':
      return 'Отлично';
    case 'degraded':
      return 'Нужно внимание';
    case 'unhealthy':
      return 'Проблемы';
  }
};

const statusHint = (status: StatusTone | null) => {
  switch (status) {
    case 'healthy':
      return 'Все сервисы работают стабильно.';
    case 'degraded':
      return 'Есть замедления или нестабильные сервисы — стоит проверить подробнее.';
    case 'unhealthy':
      return 'Критические ошибки. Требуется срочная диагностика.';
    default:
      return 'Данных ещё нет — запусти проверку.';
  }
};

async function runHealthCheck() {
  healthCheckLoading.value = true;
  try {
    const module = await loadHealthCheckModule();
    healthCheckResult.value = await module.default.runHealthCheck();
  } catch (error) {
    console.error('Health check failed:', error);
    appStore.showToast({
      title: 'Ошибка',
      message: 'Не удалось выполнить проверку состояния приложения',
      type: 'error'
    });
  } finally {
    healthCheckLoading.value = false;
  }
}

const updatePerformanceMetrics = async () => {
  const monitor = await loadPerformanceMonitor();
  const metrics = monitor.getMetrics();

  // Calculate average API response time
  const apiMetrics = metrics.filter(m => m.name.startsWith('api_') && !m.name.includes('_error'));
  const avgApiResponseTime = apiMetrics.length > 0
    ? apiMetrics.reduce((sum, m) => sum + m.value, 0) / apiMetrics.length
    : 0;

  // Calculate average render time
  const renderMetrics = metrics.filter(m => m.name.startsWith('render_'));
  const avgRenderTime = renderMetrics.length > 0
    ? renderMetrics.reduce((sum, m) => sum + m.value, 0) / renderMetrics.length
    : 0;

  performanceMetrics.value = {
    avgApiResponseTime,
    avgRenderTime,
    totalMetrics: metrics.length
  };
};

const formatMetric = (value: number): string => {
  if (value < 1) return '<1 мс';
  return `${Math.round(value)} мс`;
};

const formatMemoryUsage = (bytes: number): string => {
  if (!Number.isFinite(bytes)) {
    return '—';
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
};

type HealthCheckMetricRow = { id: string; label: string; value: string };

const getCheckMetrics = (check: HealthCheckMap[HealthCheckKey]): HealthCheckMetricRow[] => {
  const metrics: HealthCheckMetricRow[] = [];

  if ('responseTime' in check && typeof check.responseTime === 'number') {
    metrics.push({
      id: 'response',
      label: 'Время ответа',
      value: `${check.responseTime.toFixed(0)} мс`,
    });
  }

  if ('size' in check && typeof check.size === 'number') {
    metrics.push({
      id: 'cache-size',
      label: 'Размер кэша',
      value: `${check.size.toLocaleString('ru-RU')} элементов`,
    });
  }

  if ('metrics' in check && check.metrics) {
    const { avgApiResponseTime, avgRenderTime, memoryUsage } = check.metrics;
    if (typeof avgApiResponseTime === 'number' && avgApiResponseTime > 0) {
      metrics.push({
        id: 'avg-api',
        label: 'Среднее время API',
        value: formatMetric(avgApiResponseTime),
      });
    }
    if (typeof avgRenderTime === 'number' && avgRenderTime > 0) {
      metrics.push({
        id: 'avg-render',
        label: 'Среднее время рендера',
        value: formatMetric(avgRenderTime),
      });
    }
    if (typeof memoryUsage === 'number' && memoryUsage > 0) {
      metrics.push({
        id: 'memory',
        label: 'Память',
        value: formatMemoryUsage(memoryUsage),
      });
    }
  }

  if ('authenticated' in check && typeof check.authenticated === 'boolean') {
    metrics.push({
      id: 'auth',
      label: 'Авторизация',
      value: check.authenticated ? 'Да' : 'Нет',
    });
  }

  return metrics;
};

const clearPerformanceMetrics = async () => {
  const monitor = await loadPerformanceMonitor();
  monitor.clearMetrics();
  await updatePerformanceMetrics();
  appStore.showToast({
    title: 'Успех',
    message: 'Метрики производительности очищены',
    type: 'success'
  });
};

const clearCache = () => {
  try {
    clearAllCaches();
    invalidateProgramContextCaches({ includeGlobal: true });
    cacheSize.value = 0;
    appStore.showToast({
      title: 'Успех',
      message: 'Кэш приложения очищен',
      type: 'success'
    });
  } catch (error) {
    appStore.showToast({
      title: 'Ошибка',
      message: 'Не удалось очистить кэш',
      type: 'error'
    });
  }
};

const logout = () => {
  appStore.showToast({
    title: 'Выход',
    message: 'Завершите работу через Telegram (закройте WebApp).',
    type: 'info'
  });
};



const getCheckName = (key: string): string => {
  const names: Record<string, string> = {
    api: 'API соединение',
    cache: 'Кэш',
    performance: 'Производительность',
    auth: 'Аутентификация'
  };
  return names[key] || key;
};

onMounted(() => {
  appStore.ensureProgramContext({ includeLevels: false }).catch((error) => {
    console.warn('[SettingsPage] Failed to warm program context', error);
  });

  appStore.refreshAssistantSessionState({ force: true }).catch((error) => {
    console.warn('[SettingsPage] Failed to refresh assistant latency stats', error);
  });
  appStore.ensureAssistantSessionMonitor();

  runHealthCheck();
  void updatePerformanceMetrics();

  // Update cache size (placeholder)
  cacheSize.value = 0;

});
</script>

<style scoped>
.settings-page {
  gap: clamp(1.75rem, 4vw, 3rem);
}

.settings-page__title-icon :deep(svg) {
  width: 24px;
  height: 24px;
}

.settings-card { 
  gap: clamp(1rem, 3vw, 1.75rem);
}

.settings-card--program {
  gap: clamp(1rem, 3vw, 1.75rem);
}

.settings-card--status {
  gap: clamp(1.25rem, 3vw, 2rem);
}

.settings-card__title-icon {
  filter: drop-shadow(0 6px 12px rgba(14, 116, 144, 0.25));
}

.surface-card__header--split {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.surface-card__header-actions {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
}

.settings-card__dropdown :deep(.dropdown__trigger) {
  padding-inline: 0.85rem;
  background: color-mix(in srgb, var(--color-surface-card) 92%, transparent);
}

.settings-card__loader {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  min-height: 120px;
}

.settings-program {
  display: flex;
  flex-direction: column;
  gap: clamp(0.75rem, 2vw, 1.25rem);
}

.settings-program__details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: clamp(0.75rem, 2vw, 1.25rem);
  margin: 0;
}

.settings-program__details dt {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
  margin-bottom: 0.35rem;
}

.settings-program__details dd {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text-primary);
}

.settings-program__hint {
  margin: 0;
  font-size: var(--font-size-sm);
  color: color-mix(in srgb, var(--color-warning) 55%, var(--color-text-secondary));
}

.settings-card__hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: -0.25rem 0 0;
}

.settings-status__item-meta {
  display: grid;
  gap: var(--space-xs);
  margin: 0;
  padding: 0;
}

.settings-status__metric-row {
  display: flex;
  justify-content: space-between;
  gap: var(--space-sm);
}

.settings-status__item-meta dt {
  margin: 0;
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-secondary);
}

.settings-status__item-meta dd {
  margin: 0;
  font-weight: 600;
  color: var(--color-text-primary);
}

.settings-card__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
  margin-top: var(--space-md);
}

.settings-cache {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  padding: 0.75rem 1rem;
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--color-surface) 55%, transparent);
  border: 1px solid var(--color-border-subtle);
}

.settings-cache__label {
  display: block;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.settings-cache__value {
  font-size: clamp(1.5rem, 3vw, 2.25rem);
  font-weight: 700;
  color: var(--color-text-primary);
}
@media (max-width: 920px) {
  .settings-account {
    flex-direction: column;
    align-items: stretch;
  }

  .settings-card__actions {
    justify-content: stretch;
  }

  .settings-card__actions .button {
    width: 100%;
  }
}

@media (max-width: 640px) {
  .settings-status__summary {
    flex-direction: column;
    align-items: flex-start;
  }

  .settings-status__metric {
    margin-left: 0;
  }
}

</style>
