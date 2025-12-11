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
            :items="quickActions"
          />
        </div>
      </div>
      <p class="surface-card__subtitle">
        Следи за ключевыми сервисами и обновляй проверку при изменениях инфраструктуры.
      </p>
    </template>

    <LoadingState
      v-if="loading"
      class="settings-card__loader"
      title="Проверяю состояние…"
      description="Собираем статусы сервисов и кэшей"
      :skeleton-count="3"
      :skeleton-lines="2"
      inline
    />

    <div v-else-if="result" class="settings-status">
      <div class="settings-status__summary">
        <span class="settings-status__indicator" :class="`settings-status__indicator--${result.status}`"></span>
        <div class="settings-status__summary-text">
          <h3>Общее состояние</h3>
          <p>{{ statusHint(overallStatus) }}</p>
        </div>
        <span class="settings-status__metric">
          {{ formatTimestamp(result.timestamp) }}
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

      <div v-if="result.recommendations.length" class="settings-status__recommendations">
        <h4>Рекомендации</h4>
        <ul class="list-reset settings-status__recommendation-list">
          <li v-for="(recommendation, index) in result.recommendations" :key="index">
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
          @click="$emit('refresh')"
          :loading="loading"
          loading-text="Проверяю…"
        >
          Обновить проверку
        </BaseButton>
      </div>
    </template>
  </BaseCard>
</template>

<script setup lang="ts">
/**
 * SystemStatusWidget - Health Check Status Card
 * Extracted as part of SETT-R04 decomposition
 */
import { computed } from 'vue';
import NeonIcon from '@/modules/shared/components/NeonIcon.vue';
import LoadingState from '@/modules/shared/components/LoadingState.vue';
import StatusBadge from '@/modules/shared/components/StatusBadge.vue';
import DropdownMenu, { type DropdownItem } from '@/modules/shared/components/DropdownMenu.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import type { HealthCheckResult } from '@/services/healthCheck';

type StatusTone = 'healthy' | 'degraded' | 'unhealthy';
type HealthCheckMap = HealthCheckResult['checks'];
type HealthCheckKey = keyof HealthCheckMap;
type StatusVariant = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
type HealthCheckMetricRow = { id: string; label: string; value: string };

const props = defineProps<{
  loading: boolean;
  result: HealthCheckResult | null;
  quickActions: DropdownItem[];
}>();

defineEmits<{
  (e: 'refresh'): void;
}>();

const overallStatus = computed<StatusTone | null>(() => props.result?.status ?? null);

const checkEntries = computed<Array<[HealthCheckKey, HealthCheckMap[HealthCheckKey]]>>(() => {
  if (!props.result) return [];
  return Object.entries(props.result.checks) as Array<[HealthCheckKey, HealthCheckMap[HealthCheckKey]]>;
});

const statusVariant = (status: StatusTone | null): StatusVariant => {
  switch (status) {
    case 'healthy': return 'success';
    case 'degraded': return 'warning';
    case 'unhealthy': return 'danger';
    default: return 'neutral';
  }
};

const statusLabel = (status: StatusTone) => {
  switch (status) {
    case 'healthy': return 'Отлично';
    case 'degraded': return 'Нужно внимание';
    case 'unhealthy': return 'Проблемы';
  }
};

const statusHint = (status: StatusTone | null) => {
  switch (status) {
    case 'healthy': return 'Все сервисы работают стабильно.';
    case 'degraded': return 'Есть замедления или нестабильные сервисы — стоит проверить подробнее.';
    case 'unhealthy': return 'Критические ошибки. Требуется срочная диагностика.';
    default: return 'Данных ещё нет — запусти проверку.';
  }
};

const getCheckName = (key: string): string => {
  const names: Record<string, string> = {
    api: 'API Backend',
    cache: 'Кэш (Redis)',
    telegram: 'Telegram API',
    microservices: 'Микросервисы',
    performance: 'Производительность',
  };
  return names[key] || key;
};

const formatMetric = (value: number): string => {
  if (value < 1) return '<1 мс';
  return `${Math.round(value)} мс`;
};

const formatMemoryUsage = (bytes: number): string => {
  if (!Number.isFinite(bytes)) return '—';
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
};

const formatTimestamp = (value: string | number): string => {
  try {
    const date = typeof value === 'number' ? new Date(value) : new Date(value);
    return date.toLocaleString();
  } catch {
    return String(value);
  }
};

const getCheckMetrics = (check: HealthCheckMap[HealthCheckKey]): HealthCheckMetricRow[] => {
  const metrics: HealthCheckMetricRow[] = [];

  if ('responseTime' in check && typeof check.responseTime === 'number') {
    metrics.push({ id: 'response', label: 'Время ответа', value: `${check.responseTime.toFixed(0)} мс` });
  }

  if ('size' in check && typeof check.size === 'number') {
    metrics.push({ id: 'cache-size', label: 'Размер кэша', value: `${check.size.toLocaleString('ru-RU')} элементов` });
  }

  if ('metrics' in check && check.metrics) {
    const { avgApiResponseTime, avgRenderTime, memoryUsage } = check.metrics;
    if (typeof avgApiResponseTime === 'number' && avgApiResponseTime > 0) {
      metrics.push({ id: 'avg-api', label: 'Среднее время API', value: formatMetric(avgApiResponseTime) });
    }
    if (typeof avgRenderTime === 'number' && avgRenderTime > 0) {
      metrics.push({ id: 'avg-render', label: 'Среднее время рендера', value: formatMetric(avgRenderTime) });
    }
    if (typeof memoryUsage === 'number' && memoryUsage > 0) {
      metrics.push({ id: 'memory', label: 'Память', value: formatMemoryUsage(memoryUsage) });
    }
  }

  if ('authenticated' in check && typeof check.authenticated === 'boolean') {
    metrics.push({ id: 'auth', label: 'Авторизация', value: check.authenticated ? 'Да' : 'Нет' });
  }

  return metrics;
};
</script>
