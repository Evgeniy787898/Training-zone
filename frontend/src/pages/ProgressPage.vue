<template>
  <div class="progress-page">
    <header class="progress-page__header">
      <h1 class="text-2xl font-bold mb-2">Мой прогресс</h1>
      <p class="text-muted">Статистика тренировок и достижения</p>
    </header>

    <div class="progress-page__filters">
      <!-- Filters will go here -->
    </div>

    <div class="progress-page__grid">
      <!-- Sessions Trend -->
      <BaseCard title="Динамика тренировок" class="col-span-full lg:col-span-2">
        <div class="h-80">
          <BaseLineChart 
            v-if="sessionsTrend" 
            :data="sessionsTrend.data" 
            :options="sessionsTrend.options" 
          />
          <div v-else-if="loading.sessionsTrend" class="flex items-center justify-center h-full">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
          </div>
          <div v-else class="flex items-center justify-center h-full text-muted">
            Нет данных за выбранный период
          </div>
        </div>
      </BaseCard>

      <!-- Discipline Breakdown -->
      <BaseCard title="По дисциплинам" class="col-span-full md:col-span-1">
        <div class="h-64">
          <BaseDoughnutChart 
            v-if="disciplineBreakdown" 
            :data="disciplineBreakdown.data" 
            :options="disciplineBreakdown.options" 
          />
          <div v-else-if="loading.disciplineBreakdown" class="flex items-center justify-center h-full">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
          </div>
          <div v-else class="flex items-center justify-center h-full text-muted">
            Нет данных
          </div>
        </div>
      </BaseCard>

      <!-- Program Completion -->
      <BaseCard title="Завершение программ" class="col-span-full md:col-span-1">
        <div class="h-64">
          <BaseBarChart 
            v-if="programCompletion" 
            :data="programCompletion.data" 
            :options="programCompletion.options" 
          />
          <div v-else-if="loading.programCompletion" class="flex items-center justify-center h-full">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
          </div>
          <div v-else class="flex items-center justify-center h-full text-muted">
            Нет данных
          </div>
        </div>
      </BaseCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import BaseLineChart from '@/components/charts/BaseLineChart.vue';
import BaseBarChart from '@/components/charts/BaseBarChart.vue';
import BaseDoughnutChart from '@/components/charts/BaseDoughnutChart.vue';
import { apiClient } from '@/services/api';
import type { VisualizationResponse } from '@/types';
import ErrorHandler from '@/services/errorHandler';

const sessionsTrend = ref<VisualizationResponse | null>(null);
const disciplineBreakdown = ref<VisualizationResponse | null>(null);
const programCompletion = ref<VisualizationResponse | null>(null);

const loading = ref({
  sessionsTrend: false,
  disciplineBreakdown: false,
  programCompletion: false,
});

const loadData = async () => {
  try {
    // Load Sessions Trend
    loading.value.sessionsTrend = true;
    sessionsTrend.value = await apiClient.getAnalyticsVisualization('sessions_trend');
  } catch (error) {
    ErrorHandler.handleWithToast(error, 'loadSessionsTrend');
  } finally {
    loading.value.sessionsTrend = false;
  }

  try {
    // Load Discipline Breakdown
    loading.value.disciplineBreakdown = true;
    disciplineBreakdown.value = await apiClient.getAnalyticsVisualization('discipline_breakdown');
  } catch (error) {
    ErrorHandler.handleWithToast(error, 'loadDisciplineBreakdown');
  } finally {
    loading.value.disciplineBreakdown = false;
  }

  try {
    // Load Program Completion
    loading.value.programCompletion = true;
    programCompletion.value = await apiClient.getAnalyticsVisualization('program_completion');
  } catch (error) {
    ErrorHandler.handleWithToast(error, 'loadProgramCompletion');
  } finally {
    loading.value.programCompletion = false;
  }
};

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.progress-page {
  padding: var(--space-md);
  max-width: 1200px;
  margin: 0 auto;
}

.progress-page__header {
  margin-bottom: var(--space-lg);
}

.progress-page__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-md);
}

.col-span-full {
  grid-column: 1 / -1;
}

@media (min-width: 1024px) {
  .lg\:col-span-2 {
    grid-column: span 2;
  }
}

@media (min-width: 768px) {
  .md\:col-span-1 {
    grid-column: span 1;
  }
}
</style>
