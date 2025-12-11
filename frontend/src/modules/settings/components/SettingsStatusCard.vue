<template>
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
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '@/stores/app';
import NeonIcon from '@/modules/shared/components/NeonIcon.vue';
import LoadingState from '@/modules/shared/components/LoadingState.vue';
import StatusBadge from '@/modules/shared/components/StatusBadge.vue';
import DropdownMenu, { type DropdownItem } from '@/modules/shared/components/DropdownMenu.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import type { HealthCheckResult } from '@/services/healthCheck';

const appStore = useAppStore();
const router = useRouter();

let healthCheckModule: Promise<typeof import('@/services/healthCheck')> | null = null;
const loadHealthCheckModule = () => {
  if (!healthCheckModule) {
    healthCheckModule = import('@/services/healthCheck');
  }
  return healthCheckModule;
};

const healthCheckLoading = ref(false);
const healthCheckResult = ref<HealthCheckResult | null>(null);

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

const formatIso = (value: string | number): string => {
  try {
    const date = typeof value === 'number' ? new Date(value) : new Date(value);
    return date.toLocaleString();
  } catch {
    return String(value);
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

const checkNames: Record<string, string> = {
  api: 'API сервер',
  database: 'База данных',
  cache: 'Кеш',
  ai: 'AI Advisor',
  analytics: 'Аналитика',
  imageProcessor: 'Обработка изображений',
};

const getCheckName = (key: string): string => checkNames[key] || key;

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

  if ('latency' in check && typeof check.latency === 'number') {
    metrics.push({
      id: 'latency',
      label: 'Латентность',
      value: `${check.latency.toFixed(0)} мс`,
    });
  }

  return metrics;
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

const healthQuickActions = computed<DropdownItem[]>(() => [
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
</script>
