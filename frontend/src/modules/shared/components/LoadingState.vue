<template>
  <section
    class="loading-state surface-card surface-card--overlay"
    :class="{ 'loading-state--inline': inline }"
    role="status"
    aria-live="polite"
  >
    <div class="loading-state__header">
      <span class="loading-state__icon" aria-hidden="true">⏳</span>
      <div class="loading-state__text">
        <p class="loading-state__title">{{ title }}</p>
        <p v-if="description" class="loading-state__description">{{ description }}</p>
      </div>
    </div>

    <div v-if="showSkeletons" class="loading-state__skeletons">
      <SkeletonCard
        v-for="index in skeletonCount"
        :key="index"
        :lines="skeletonLines"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import SkeletonCard from '@/modules/shared/components/SkeletonCard.vue';

interface Props {
  title?: string;
  description?: string;
  skeletonCount?: number;
  skeletonLines?: number;
  inline?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Загружаем данные…',
  description: '',
  skeletonCount: 1,
  skeletonLines: 4,
  inline: false
});

const showSkeletons = computed(() => props.skeletonCount > 0);
</script>

<style scoped>
.loading-state {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.25rem;
  border: 1px solid var(--border-subtle, var(--color-border-subtle));
  background: var(--surface, var(--color-bg));
  border-radius: 12px;
  box-shadow: var(--shadow-sm, 0 4px 12px rgba(0, 0, 0, 0.06));
}

.loading-state--inline {
  border: 1px dashed var(--border-subtle, var(--color-border-subtle));
  background: var(--surface-subtle, var(--color-bg-secondary));
}

.loading-state__header {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.loading-state__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: var(--surface-subtle, var(--color-bg-secondary));
  font-size: 1.25rem;
}

.loading-state__text {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.loading-state__title {
  margin: 0;
  font-weight: 700;
  color: var(--text-primary, var(--color-text-primary));
  font-size: 1rem;
}

.loading-state__description {
  margin: 0;
  color: var(--text-secondary, var(--color-text-secondary));
  font-size: 0.95rem;
}

.loading-state__skeletons {
  display: grid;
  gap: 0.75rem;
}
</style>
