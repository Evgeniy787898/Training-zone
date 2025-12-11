<template>
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
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAppStore } from '@/stores/app';
import NeonIcon from '@/modules/shared/components/NeonIcon.vue';
import StatCard from '@/modules/shared/components/StatCard.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCard from '@/components/ui/BaseCard.vue';

const appStore = useAppStore();

type PerformanceMonitorInstance = (typeof import('@/services/performance'))['default'];
let performanceMonitorRef: PerformanceMonitorInstance | null = null;

const loadPerformanceMonitor = async (): Promise<PerformanceMonitorInstance> => {
  if (!performanceMonitorRef) {
    const module = await import('@/services/performance');
    performanceMonitorRef = module.default;
  }
  return performanceMonitorRef;
};

const performanceMetrics = ref({
  avgApiResponseTime: 0,
  avgRenderTime: 0,
  totalMetrics: 0
});

const formatMetric = (value: number): string => {
  if (value < 1) return '<1 мс';
  return `${Math.round(value)} мс`;
};

const updatePerformanceMetrics = async () => {
  const monitor = await loadPerformanceMonitor();
  const metrics = monitor.getMetrics();

  const apiMetrics = metrics.filter(m => m.name.startsWith('api_') && !m.name.includes('_error'));
  const avgApiResponseTime = apiMetrics.length > 0
    ? apiMetrics.reduce((sum, m) => sum + m.value, 0) / apiMetrics.length
    : 0;

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

const clearPerformanceMetrics = async () => {
  try {
    const monitor = await loadPerformanceMonitor();
    monitor.clearMetrics();
    performanceMetrics.value = {
      avgApiResponseTime: 0,
      avgRenderTime: 0,
      totalMetrics: 0,
    };
    appStore.showToast({
      title: 'Метрики очищены',
      message: '',
      type: 'success',
    });
  } catch (error) {
    console.error('Failed to clear performance metrics:', error);
  }
};

onMounted(() => {
  updatePerformanceMetrics();
});
</script>
