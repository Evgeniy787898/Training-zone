<template>
  <div
    :class="['skeleton-loader', { 'skeleton-shimmer': animated }]"
    :style="skeletonStyle"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  width?: string | number;
  height?: string | number;
  circle?: boolean;
  animated?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  width: '100%',
  height: '1rem',
  circle: false,
  animated: true,
});

const skeletonStyle = computed(() => ({
  width: typeof props.width === 'number' ? `${props.width}px` : props.width,
  height: typeof props.height === 'number' ? `${props.height}px` : props.height,
  borderRadius: props.circle ? '50%' : 'var(--radius-md)',
}));
</script>

<style scoped>
.skeleton-loader {
  background: linear-gradient(
    90deg,
    var(--color-bg-secondary) 0%,
    var(--color-border-subtle) 50%,
    var(--color-bg-secondary) 100%
  );
  background-size: 200% 100%;
  display: inline-block;
}

.skeleton-shimmer {
  animation: shimmer 1.5s ease-in-out infinite;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-shimmer {
    animation: none;
    background: var(--color-bg-secondary);
  }
}
</style>
