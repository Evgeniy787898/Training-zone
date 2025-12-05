<template>
  <section class="today-skeleton" role="status" aria-live="polite">
    <div class="surface-card today-skeleton__hero">
      <div class="skeleton-line skeleton-line--title"></div>
      <div class="skeleton-line skeleton-line--subtitle"></div>
      <div class="skeleton-pill"></div>
    </div>

    <div class="today-skeleton__stage-nav" aria-hidden="true">
      <div v-for="index in 4" :key="`stage-${index}`" class="skeleton-pill skeleton-pill--tab"></div>
    </div>

    <div class="today-skeleton__content">
      <div class="today-skeleton__exercise-header">
        <div class="skeleton-line skeleton-line--label"></div>
        <div class="skeleton-line skeleton-line--value"></div>
      </div>

      <div class="today-skeleton__exercise-list">
        <SkeletonCard v-for="index in 3" :key="`card-${index}`" :lines="5" />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import SkeletonCard from '@/modules/shared/components/SkeletonCard.vue';
</script>

<style scoped>
.today-skeleton {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.today-skeleton__hero {
  display: grid;
  gap: 0.75rem;
}

.today-skeleton__stage-nav {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}

.today-skeleton__content {
  display: grid;
  gap: 1rem;
}

.today-skeleton__exercise-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.today-skeleton__exercise-list {
  display: grid;
  gap: 1rem;
}

.skeleton-line {
  inline-size: 100%;
  block-size: 0.9rem;
  border-radius: var(--radius-sm, 8px);
  background: var(--skeleton-sheen, linear-gradient(120deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.08)));
  background-size: 200% 100%;
  animation: skeleton-pulse 1.6s ease-in-out infinite;
}

.skeleton-line--title {
  block-size: 1.3rem;
  max-inline-size: 240px;
}

.skeleton-line--subtitle {
  max-inline-size: 320px;
}

.skeleton-line--label {
  max-inline-size: 180px;
}

.skeleton-line--value {
  max-inline-size: 140px;
}

.skeleton-pill {
  inline-size: clamp(120px, 30%, 200px);
  block-size: 2.5rem;
  border-radius: 999px;
  background: var(--skeleton-sheen, linear-gradient(120deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.08)));
  background-size: 200% 100%;
  animation: skeleton-pulse 1.6s ease-in-out infinite;
}

.skeleton-pill--tab {
  inline-size: 6.25rem;
  block-size: 2.25rem;
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
