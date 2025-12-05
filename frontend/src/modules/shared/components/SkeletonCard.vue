<template>
  <div class="skeleton-card" role="presentation" aria-hidden="true">
    <div v-for="i in lines" :key="i" class="skeleton-card__line"></div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  lines?: number;
}>();
</script>

<style scoped>
.skeleton-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.skeleton-card__line {
  inline-size: 100%;
  block-size: 0.9rem;
  border-radius: var(--radius-sm);
  background: var(--color-bg-tertiary);
  opacity: 0.5;
  animation: skeleton-pulse 2s ease-in-out infinite;
}
</style>
