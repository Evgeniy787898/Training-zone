<template>
  <div class="page-shell analytics-page">
    <!-- Background -->
    <div class="page-bg">
      <div class="page-bg__grid"></div>
      <div class="page-bg__glow page-bg__glow--1"></div>
      <div class="page-bg__glow page-bg__glow--2"></div>
    </div>
    <SectionHeading
      as="h1"
      title="Аналитика и отчёты"
      description="Наблюдай за регулярностью, объёмом и нагрузкой, чтобы вовремя корректировать тренировочный план."
      eyebrow="Обзор"
    >
      <template #icon>
        <AppIcon class="page-title__icon" name="analytics" variant="aqua" :size="30" />
      </template>
    </SectionHeading>

    <section v-if="loading" class="analytics-page__loading">
      <AnalyticsSkeleton />
    </section>

    <section v-else-if="error" class="surface-card surface-card--overlay analytics-page__error">
      <ErrorState :message="error" action-label="Обновить" @retry="loadAnalytics" />
    </section>

    <section v-else class="analytics-page__content">
      <div class="stat-grid section-surface section-surface--muted">
        <StatCard
          label="Регулярность"
          :value="adherence"
          unit="%"
          hint="за последние 30 дней"
          icon="target"
          intent="success"
          variant="gradient"
          accent="success"
        />
        <StatCard
          label="Средний объём"
          :value="averageVolume"
          hint="на тренировку"
          icon="dumbbell"
          intent="default"
          size="lg"
          variant="gradient"
          accent="info"
        />
        <StatCard
          label="Тяжёлых сессий"
          :value="heavyShare"
          unit="%"
          hint="RPE 8+"
          icon="pulse"
          intent="warning"
          variant="gradient"
          accent="warning"
        />
      </div>

      <section class="surface-card analytics-card minimal-card section-surface">
        <header class="surface-card__header">
          <div class="surface-card__title">
            <AppIcon class="analytics-card__icon" name="chart" variant="amber" :size="26" tone="ghost" />
            <span>Объём за 30 дней</span>
          </div>
          <span class="badge badge--neutral">{{ volumeSummary?.period_sessions || 0 }} тренировок</span>
        </header>

        <div v-if="volumeChart.length === 0" class="empty-state empty-state--inline">
          <AppIcon class="empty-state__icon" name="info" variant="neutral" tone="ghost" :size="28" />
          <div class="empty-state__title">Недостаточно данных</div>
          <p class="empty-state__description">Отмечай тренировки, чтобы появился график динамики объёма.</p>
        </div>
        <div v-else class="analytics-chart">
          <div class="analytics-chart__container">
            <Line :data="chartData" :options="chartOptions" />
          </div>
          <div class="analytics-chart__meta">
            Всего тренировок: <strong>{{ volumeSummary?.period_sessions || 0 }}</strong>
          </div>
        </div>
      </section>

      <section class="surface-card analytics-card minimal-card section-surface">
        <header class="surface-card__header">
          <div class="surface-card__title">
            <AppIcon class="analytics-card__icon" name="pulse" variant="violet" :size="26" tone="ghost" />
            <span>Распределение RPE</span>
          </div>
        </header>

        <div v-if="rpeChart.length === 0" class="empty-state empty-state--inline">
          <AppIcon class="empty-state__icon" name="navigation" variant="neutral" tone="ghost" :size="28" />
          <div class="empty-state__title">Пока без RPE</div>
          <p class="empty-state__description">Отправляй отчёты, чтобы я мог анализировать нагрузку по ощущениям.</p>
        </div>
        <div v-else class="analytics-rpe">
          <div
            v-for="item in rpeChart"
            :key="item.label"
            class="analytics-rpe__row"
          >
            <span class="analytics-rpe__label">{{ item.label }}</span>
            <div class="analytics-rpe__track">
              <div
                class="analytics-rpe__value"
                :style="{ width: `${maxRpe ? (item.value / maxRpe) * 100 : 0}%` }"
              >
                <span v-if="item.value > 0">{{ item.value }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="surface-card analytics-card minimal-card section-surface">
        <header class="surface-card__header">
          <div class="surface-card__title">
            <AppIcon class="analytics-card__icon" name="trophy" variant="amber" :size="26" tone="ghost" />
            <span>Достижения</span>
          </div>
        </header>

        <LoadingState
          v-if="achievementsLoading"
          title="Подгружаем достижения"
          description="Сначала отрисовываем общую аналитику, затем подтянем награды"
          :skeleton-count="2"
          :skeleton-lines="2"
        />

        <div v-else-if="achievements.length === 0" class="empty-state empty-state--inline">
          <AppIcon class="empty-state__icon" name="rocket" variant="aqua" tone="ghost" :size="30" />
          <div class="empty-state__title">Награды ждут</div>
          <p class="empty-state__description">Выполняй тренировки — и я отмечу ключевые достижения.</p>
        </div>
          <div
            v-else
            class="list-reset analytics-achievements"
            :class="{ 'analytics-achievements--virtual': achievementsVirtual.isVirtualized }"
            ref="achievementsContainerRef"
            role="list"
          >
          <div
            v-if="achievementsVirtual.isVirtualized"
            class="analytics-achievements__virtual-spacer"
            :style="{ height: `${achievementsTotalHeight}px` }"
          >
            <div
              class="analytics-achievements__virtual-content"
              :style="{ transform: `translateY(${achievementsOffsetTop}px)` }"
            >
              <div
                v-for="entry in virtualAchievements"
                :key="entry.item.id"
                class="analytics-achievements__item"
                role="listitem"
              >
                <AppIcon class="analytics-achievements__icon" name="star" variant="amber" :size="24" tone="ghost" />
                <div>
                  <div class="analytics-achievements__title">{{ entry.item.title }}</div>
                  <div v-if="entry.item.description" class="analytics-achievements__description">
                    {{ entry.item.description }}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <template v-else>
            <div
              v-for="achievement in achievements"
              :key="achievement.id"
              class="analytics-achievements__item"
              role="listitem"
            >
              <AppIcon class="analytics-achievements__icon" name="star" variant="amber" :size="24" tone="ghost" />
              <div>
                <div class="analytics-achievements__title">{{ achievement.title }}</div>
                <div v-if="achievement.description" class="analytics-achievements__description">
                  {{ achievement.description }}
                </div>
              </div>
            </div>
          </template>
        </div>
      </section>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAppStore } from '@/stores/app';
import { cachedApiClient as apiClient } from '@/services/cachedApi';
import type { Achievement, VolumeTrendReport, RpeDistributionReport } from '@/types';
import LoadingState from '@/modules/shared/components/LoadingState.vue';
import AnalyticsSkeleton from '@/modules/analytics/components/AnalyticsSkeleton.vue';
import ErrorState from '@/modules/shared/components/ErrorState.vue';
import AppIcon from '@/modules/shared/components/AppIcon.vue';
import SectionHeading from '@/modules/shared/components/SectionHeading.vue';
import StatCard from '@/modules/shared/components/StatCard.vue';
import { useVirtualScroller } from '@/composables/useVirtualScroller';
import { runProgressiveTasks } from '@/features/core/progressiveContent';
import { useCachedRequest } from '@/composables/useCachedRequest';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'vue-chartjs';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const appStore = useAppStore();
const { profileSummary, showToast } = appStore;

const loading = ref(true);
const error = ref<string | null>(null);
const achievementsLoading = ref(true);

const {
  data: volumeData,
  execute: fetchVolumeReport,
} = useCachedRequest<VolumeTrendReport | null, [string | undefined]>(
  async (range = '30d') => apiClient.getReport<VolumeTrendReport>('volume_trend', { range }),
  {
    initialValue: null,
    createKey: (range = '30d') => `analytics-volume:${range}`,
  },
);

const {
  data: rpeData,
  execute: fetchRpeReport,
} = useCachedRequest<RpeDistributionReport | null, [string | undefined]>(
  async (range = '30d') => apiClient.getReport<RpeDistributionReport>('rpe_distribution', { range }),
  {
    initialValue: null,
    createKey: (range = '30d') => `analytics-rpe:${range}`,
  },
);

const normalizeAchievementsResponse = (payload: unknown): Achievement[] => {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is Achievement => Boolean(item && (item as Achievement).id));
  }
  if (payload && typeof payload === 'object' && 'achievements' in (payload as Record<string, unknown>)) {
    const list = (payload as { achievements?: Achievement[] }).achievements;
    return Array.isArray(list) ? list : [];
  }
  return [];
};

const {
  data: achievements,
  execute: fetchAchievements,
} = useCachedRequest<Achievement[], []>(
  async () => {
    const response = await apiClient.getAchievements();
    return normalizeAchievementsResponse(response);
  },
  {
    initialValueFactory: () => [],
    createKey: () => 'analytics-achievements',
  },
);

const ACHIEVEMENT_ITEM_ESTIMATE = 80;
const achievementsVirtual = useVirtualScroller<Achievement>({
  items: achievements,
  estimateSize: ACHIEVEMENT_ITEM_ESTIMATE,
  overscan: 6,
  disabledThreshold: 12,
});
const achievementsContainerRef = achievementsVirtual.containerRef;
const virtualAchievements = computed(() => achievementsVirtual.virtualItems.value);
const achievementsTotalHeight = computed(() => achievementsVirtual.totalHeight.value);
const achievementsOffsetTop = computed(() => achievementsVirtual.offsetTop.value);

const adherence = computed(() => profileSummary?.adherence?.adherence_percent || 0);
const averageVolume = computed(() => volumeData.value?.summary?.average_volume || 0);
const heavyShare = computed(() => rpeData.value?.summary?.heavy_share || 0);
const volumeChart = computed(() => volumeData.value?.chart || []);
const volumeSummary = computed(() => volumeData.value?.summary);
const rpeChart = computed(() => rpeData.value?.chart || []);

const maxRpe = computed(() => {
  if (rpeChart.value.length === 0) return 1;
  return Math.max(...rpeChart.value.map((item: any) => item.value));
});

const chartData = computed(() => {
  const labels = volumeChart.value.map((item: any) => item.label);
  const data = volumeChart.value.map((item: any) => item.volume);

  return {
    labels,
    datasets: [
      {
        label: 'Объём (кг)',
        backgroundColor: (ctx: any) => {
          const canvas = ctx.chart.ctx;
          const gradient = canvas.createLinearGradient(0, 0, 0, 300);
          gradient.addColorStop(0, 'rgba(96, 165, 250, 0.4)');
          gradient.addColorStop(1, 'rgba(96, 165, 250, 0)');
          return gradient;
        },
        borderColor: '#60a5fa',
        pointBackgroundColor: '#60a5fa',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#60a5fa',
        data,
        fill: true,
        tension: 0.4,
      },
    ],
  };
});

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      mode: 'index' as const,
      intersect: false,
      backgroundColor: 'rgba(15, 23, 42, 0.9)',
      titleColor: '#f8fafc',
      bodyColor: '#cbd5e1',
      borderColor: 'rgba(148, 163, 184, 0.2)',
      borderWidth: 1,
      padding: 10,
      displayColors: false,
      callbacks: {
        label: (context: any) => `Объём: ${context.parsed.y} кг`,
      },
    },
  },
  scales: {
    x: {
      grid: {
        display: false,
        drawBorder: false,
      },
      ticks: {
        color: '#94a3b8',
        font: {
          size: 11,
        },
        maxTicksLimit: window.innerWidth < 640 ? 5 : 8,
      },
    },
    y: {
      grid: {
        color: 'rgba(148, 163, 184, 0.1)',
        drawBorder: false,
      },
      ticks: {
        color: '#94a3b8',
        font: {
          size: 10,
        },
        maxTicksLimit: 5,
      },
      beginAtZero: true,
    },
  },
  interaction: {
    mode: 'nearest' as const,
    axis: 'x' as const,
    intersect: false,
  },
}));

const loadCoreAnalytics = async () => {
  await Promise.all([fetchVolumeReport('30d'), fetchRpeReport('30d')]);
};

const loadAchievements = async () => {
  achievementsLoading.value = true;
  try {
    await fetchAchievements();
  } catch (err: any) {
    showToast({
      title: 'Не удалось загрузить достижения',
      message: err.message ?? 'Попробуйте обновить страницу позже.',
      type: 'error',
    });
  } finally {
    achievementsLoading.value = false;
  }
};

const loadAnalytics = async () => {
  loading.value = true;
  error.value = null;
  achievementsLoading.value = true;

  try {
    await loadCoreAnalytics();
    runProgressiveTasks([
      {
        run: loadAchievements,
      },
    ]);
  } catch (err: any) {
    error.value = err.message || 'Не удалось загрузить аналитику';
    showToast({
      title: 'Ошибка загрузки',
      message: err.message,
      type: 'error',
    });
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadAnalytics();
});
</script>

<style scoped>
.analytics-page {
  position: relative;
  gap: clamp(1.5rem, 4vw, 2.5rem);
}

/* Background */
.page-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}
.page-bg__grid {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
  background-size: 28px 28px;
}
.page-bg__glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.25;
}
.page-bg__glow--1 { width: 180px; height: 180px; top: -40px; right: -20px; background: var(--color-accent); }
.page-bg__glow--2 { width: 140px; height: 140px; bottom: 25%; left: -30px; background: #a855f7; }

.analytics-page__loading,
.analytics-page__error {
  display: grid;
  gap: var(--space-md);
}

.analytics-page__content {
  display: flex;
  flex-direction: column;
  gap: clamp(1.5rem, 4vw, 2.25rem);
}

.analytics-card {
  gap: clamp(1rem, 3vw, 1.75rem);
}

.analytics-card__icon {
  font-size: 1.5rem;
}

.analytics-chart {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.analytics-chart__container {
  position: relative;
  height: 240px;
  width: 100%;
}

.analytics-chart__meta {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  text-align: right;
  margin-top: -0.5rem;
}

.analytics-rpe {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.analytics-rpe__row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.analytics-rpe__label {
  width: 120px;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.analytics-rpe__track {
  flex: 1;
  height: 24px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--color-surface) 60%, transparent);
  overflow: hidden;
  position: relative;
}

.analytics-rpe__value {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 0.5rem;
  height: 100%;
  border-radius: var(--radius-full);
  background: var(--gradient-info-strong);
  color: var(--color-accent-contrast);
  font-size: var(--font-size-xs);
  font-weight: 600;
  transition: width 0.3s ease;
}

.analytics-achievements {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.analytics-achievements--virtual {
  max-height: 440px;
  overflow-y: auto;
  position: relative;
  padding-right: 0.25rem;
}

.analytics-achievements__virtual-spacer {
  position: relative;
  width: 100%;
}

.analytics-achievements__virtual-content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.analytics-achievements__item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border-subtle);
  background: color-mix(in srgb, var(--color-bg-elevated) 92%, transparent);
}

.analytics-achievements__icon {
  font-size: 1.5rem;
}

.analytics-achievements__title {
  font-weight: 600;
  color: var(--color-text-primary);
}

.analytics-achievements__description {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

@media (max-width: 600px) {
  .analytics-rpe__label {
    width: 90px;
  }
}
</style>
