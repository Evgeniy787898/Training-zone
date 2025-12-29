<template>
  <div class="ai-card ai-card--chart">
    <div class="ai-card__header">
      <span class="ai-card__icon">{{ icon || '📊' }}</span>
      <span class="ai-card__title">{{ title }}</span>
    </div>
    
    <!-- Bar Chart -->
    <div class="ai-chart" v-if="chartType === 'bar' && data?.length">
      <div 
        v-for="(item, idx) in data" 
        :key="idx" 
        class="ai-chart__bar-wrapper"
      >
        <div 
          class="ai-chart__bar" 
          :style="{ height: getBarHeight(item.value) + '%' }"
          :class="{ zero: item.value === 0 }"
        />
        <span class="ai-chart__label">{{ item.label }}</span>
      </div>
    </div>
    
    <!-- Line Chart -->
    <div class="ai-chart ai-chart--line" v-else-if="chartType === 'line' && data?.length">
      <svg viewBox="0 0 100 50" preserveAspectRatio="none">
        <polyline 
          :points="linePoints" 
          fill="none" 
          stroke="var(--color-accent)" 
          stroke-width="2"
        />
      </svg>
    </div>
    
    <!-- Empty state -->
    <div v-if="!data?.length" class="ai-chart__empty">
      Нет данных для отображения
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

export interface ChartItem {
  label: string;
  value: number;
}

const props = defineProps<{
  title: string;
  icon?: string;
  chartType: 'bar' | 'line';
  data: ChartItem[];
}>();

const maxValue = computed(() => {
  if (!props.data?.length) return 1;
  return Math.max(...props.data.map(d => d.value), 1);
});

const getBarHeight = (value: number) => {
  return (value / maxValue.value) * 100;
};

const linePoints = computed(() => {
  if (!props.data?.length) return '';
  const step = 100 / (props.data.length - 1 || 1);
  return props.data.map((d, i) => {
    const x = i * step;
    const y = 50 - (d.value / maxValue.value) * 45;
    return `${x},${y}`;
  }).join(' ');
});
</script>

<style scoped>
.ai-card--chart {
  background: var(--color-surface);
  border-radius: 16px;
  padding: 16px;
  margin: 12px 0;
  border: 1px solid var(--color-border);
}

.ai-card__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.ai-card__icon {
  font-size: 1.2rem;
}

.ai-card__title {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--color-text-primary);
}

.ai-chart {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  height: 100px;
  gap: 6px;
}

.ai-chart__bar-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}

.ai-chart__bar {
  width: 100%;
  max-width: 24px;
  background: var(--color-accent);
  border-radius: 4px 4px 0 0;
  transition: height 0.3s;
  min-height: 4px;
  margin-top: auto;
}

.ai-chart__bar.zero {
  background: var(--color-border);
}

.ai-chart__label {
  font-size: 0.65rem;
  color: var(--color-text-secondary);
  margin-top: 4px;
  text-align: center;
  white-space: nowrap;
}

.ai-chart--line {
  height: 60px;
}

.ai-chart--line svg {
  width: 100%;
  height: 100%;
}

.ai-chart__empty {
  text-align: center;
  color: var(--color-text-secondary);
  padding: 20px;
  font-size: 0.85rem;
}
</style>
