<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    class="trainer-icon"
    :class="`trainer-icon--${variant}`"
  >
    <!-- Left hemisphere -->
    <path
      d="M9.5 2C7.5 2 6 3.5 6 5.5c0 1-.5 1.5-1 2C4 8 3 9 3 10.5c0 1.5 1 2.5 2 3 0 1 .5 2 1.5 2.5S8 17 8 18c0 .5.5 1.5 1.5 2 .5.3 1.5.5 2.5.5"
      :stroke="strokeColor"
      stroke-width="1.5"
      stroke-linecap="round"
      :fill="fillColor"
    />
    <!-- Right hemisphere -->
    <path
      d="M14.5 2C16.5 2 18 3.5 18 5.5c0 1 .5 1.5 1 2 1 .5 2 1.5 2 3 0 1.5-1 2.5-2 3 0 1-.5 2-1.5 2.5S16 17 16 18c0 .5-.5 1.5-1.5 2-.5.3-1.5.5-2.5.5"
      :stroke="strokeColor"
      stroke-width="1.5"
      stroke-linecap="round"
      :fill="fillColor"
    />
    <!-- Center line (corpus callosum) -->
    <path
      d="M12 2v18"
      :stroke="strokeColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-dasharray="2 2"
      opacity="0.6"
    />
    <!-- Left convolutions -->
    <path d="M5.5 7c1.2 0 2.2.8 2.8 1.5" :stroke="strokeColor" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M4.5 11c1 0 2 .5 3 1.2" :stroke="strokeColor" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M6.5 15c.8 0 1.5.4 2 .8" :stroke="strokeColor" stroke-width="1.2" stroke-linecap="round"/>
    <!-- Right convolutions -->
    <path d="M18.5 7c-1.2 0-2.2.8-2.8 1.5" :stroke="strokeColor" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M19.5 11c-1 0-2 .5-3 1.2" :stroke="strokeColor" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M17.5 15c-.8 0-1.5.4-2 .8" :stroke="strokeColor" stroke-width="1.2" stroke-linecap="round"/>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  size?: number;
  variant?: 'primary' | 'neutral' | 'accent';
}

const props = withDefaults(defineProps<Props>(), {
  size: 24,
  variant: 'primary',
});

const strokeColor = computed(() => {
  switch (props.variant) {
    case 'accent':
      return 'var(--color-accent)';
    case 'neutral':
      return 'currentColor';
    default:
      return 'var(--color-accent)';
  }
});

const fillColor = computed(() => {
  switch (props.variant) {
    case 'accent':
      return 'var(--color-accent-subtle)';
    case 'neutral':
      return 'transparent';
    default:
      return 'var(--color-accent-subtle)';
  }
});
</script>

<style scoped>
.trainer-icon {
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.trainer-icon--primary {
  filter: drop-shadow(0 0 4px var(--color-accent-light));
}

.trainer-icon--accent {
  filter: drop-shadow(0 0 6px var(--color-accent));
}
</style>
