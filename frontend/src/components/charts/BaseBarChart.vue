<template>
  <div class="chart-container">
    <Bar :data="chartData" :options="chartOptions" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  ChartOptions,
  ChartData
} from 'chart.js';
import { Bar } from 'vue-chartjs';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const props = defineProps<{
  data: ChartData<'bar'>;
  options?: ChartOptions<'bar'>;
}>();

const chartData = computed(() => props.data);

const defaultOptions = computed<ChartOptions<'bar'>>(() => {
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
        labels: {
          color: textColor,
          font: {
            family: getComputedStyle(root).getPropertyValue('--font-family-base').trim(),
          }
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
    scales: {
      x: {
        grid: {
          color: borderColor,
          display: false,
        },
        ticks: {
          color: textColor,
        }
      },
      y: {
        grid: {
          color: borderColor,
        },
        ticks: {
          color: textColor,
        }
      }
    }
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
}
</style>
