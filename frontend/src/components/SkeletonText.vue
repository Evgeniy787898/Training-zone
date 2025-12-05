<template>
  <div class="skeleton-text">
    <SkeletonLoader
      v-for="i in lines"
      :key="i"
      :width="getLineWidth(i)"
      height="0.875rem"
      :animated="animated"
      class="skeleton-text-line"
    />
  </div>
</template>

<script setup lang="ts">
import SkeletonLoader from './SkeletonLoader.vue';

interface Props {
  lines?: number;
  width?: string;
  animated?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  lines: 3,
  width: '100%',
  animated: true,
});

function getLineWidth(lineNumber: number): string {
  // Last line is typically shorter
  if (lineNumber === props.lines) {
    return '70%';
  }
  return props.width;
}
</script>

<style scoped>
.skeleton-text {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.skeleton-text-line {
  width: 100%;
}
</style>
