<template>
  <section class="route-skeleton" role="status" aria-live="polite">
    <div class="route-skeleton__header">
      <div class="route-skeleton__avatar" aria-hidden="true"></div>
      <div class="route-skeleton__titles">
        <div class="route-skeleton__title"></div>
        <div class="route-skeleton__subtitle"></div>
      </div>
    </div>

    <div class="route-skeleton__grid">
      <SkeletonCard v-for="index in 3" :key="index" :lines="4" />
    </div>
  </section>
</template>

<script setup lang="ts">
import SkeletonCard from '@/modules/shared/components/SkeletonCard.vue';
</script>

<style scoped>
.route-skeleton {
  display: grid;
  gap: 1rem;
  padding: 1.25rem;
  border: 1px solid var(--color-border-subtle);
  border-radius: 12px;
  background: var(--surface, #fff);
  box-shadow: var(--shadow-sm, 0 8px 20px rgba(0, 0, 0, 0.04));
}

.route-skeleton__header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.route-skeleton__avatar {
  inline-size: 3rem;
  block-size: 3rem;
  border-radius: 50%;
  background: linear-gradient(120deg, rgba(232, 234, 237, 0.08), rgba(255, 255, 255, 0.15), rgba(232, 234, 237, 0.08));
  background-size: 200% 100%;
  animation: skeleton-pulse 1.6s ease-in-out infinite;
}

.route-skeleton__titles {
  flex: 1;
  display: grid;
  gap: 0.4rem;
}

.route-skeleton__title,
.route-skeleton__subtitle {
  inline-size: 100%;
  block-size: 0.9rem;
  border-radius: var(--radius-sm, 8px);
  background: linear-gradient(120deg, rgba(232, 234, 237, 0.08), rgba(255, 255, 255, 0.15), rgba(232, 234, 237, 0.08));
  background-size: 200% 100%;
  animation: skeleton-pulse 1.6s ease-in-out infinite;
}

.route-skeleton__title {
  block-size: 1.1rem;
  max-inline-size: 16rem;
}

.route-skeleton__subtitle {
  max-inline-size: 22rem;
}

.route-skeleton__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: 1rem;
}

@keyframes skeleton-pulse {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
