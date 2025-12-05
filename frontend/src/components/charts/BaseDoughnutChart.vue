<template>
  <div class="chart-container">
    <Doughnut :data="chartData" :options="chartOptions" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartOptions,
  ChartData
} from 'chart.js';
import { Doughnut } from 'vue-chartjs';

ChartJS.register(ArcElement, Tooltip, Legend);

const props = defineProps<{
  data: ChartData<'doughnut'>;
  options?: ChartOptions<'doughnut'>;
}>();

const chartData = computed(() => props.data);

const defaultOptions = computed<ChartOptions<'doughnut'>>(() => {
  const root = document.documentElement;
  const textColor = getComputedStyle(root).getPropertyValue('--color-text-primary').trim();
  const textSecondary = getComputedStyle(root).getPropertyValue('--color-text-secondary').trim();
  const bgModal = getComputedStyle(root).getPropertyValue('--color-bg-modal').trim();
  const borderColor = getComputedStyle(root).getPropertyValue('--color-border').trim();

  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: textColor,
          font: {
            family: getComputedStyle(root).getPropertyValue('--font-family-base').trim(),
          },
          padding: 20,
          usePointStyle: true,
        }
      },
      tooltip: {
        backgroundColor: bgModal,
        titleColor: textColor,
        bodyColor: textSecondary,
        borderColor: borderColor,
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
      }
    },
    cutout: '60%',
  };
});

const chartOptions = computed(() => ({
  ...defaultOptions.value,
  ...props.options,
}));
</script>

<style scoped>
.chart-container {
  position: relative;
  height: 100%;
  width: 100%;
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
