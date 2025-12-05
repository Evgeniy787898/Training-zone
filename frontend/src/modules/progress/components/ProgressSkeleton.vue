<template>
  <section class="progress-skeleton" role="status" aria-live="polite">
    <div class="progress-skeleton__stats">
      <div v-for="index in 3" :key="`metric-${index}`" class="progress-skeleton__metric">
        <div class="skeleton-icon"></div>
        <div class="progress-skeleton__metric-text">
          <div class="skeleton-line skeleton-line--value"></div>
          <div class="skeleton-line skeleton-line--label"></div>
        </div>
      </div>
    </div>

    <div class="surface-card progress-skeleton__card">
      <div class="skeleton-line skeleton-line--title"></div>
      <div class="progress-skeleton__chart">
        <div v-for="index in 7" :key="`bar-${index}`" class="progress-skeleton__bar"></div>
      </div>
    </div>

    <div class="surface-card progress-skeleton__card">
      <div class="skeleton-line skeleton-line--title"></div>
      <div class="progress-skeleton__list">
        <div v-for="index in 4" :key="`row-${index}`" class="progress-skeleton__row">
          <div class="skeleton-line skeleton-line--label"></div>
          <div class="progress-skeleton__track">
            <div class="progress-skeleton__value"></div>
          </div>
        </div>
      </div>
    </div>

    <div class="surface-card progress-skeleton__achievements">
      <div class="skeleton-line skeleton-line--title"></div>
      <div class="progress-skeleton__achievement-list">
        <SkeletonCard v-for="index in 3" :key="`achievement-${index}`" :lines="3" />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import SkeletonCard from '@/modules/shared/components/SkeletonCard.vue';
</script>

<style scoped>
.progress-skeleton {
  display: grid;
  gap: 1.25rem;
}

.progress-skeleton__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
  gap: 0.75rem;
}

.progress-skeleton__metric {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: var(--radius-lg, 16px);
  background: var(--color-bg-card);
}

.skeleton-icon {
  inline-size: 2.75rem;
  block-size: 2.75rem;
  border-radius: 12px;
  background: linear-gradient(120deg, var(--color-bg-secondary), var(--color-bg-elevated), var(--color-bg-secondary));
  background-size: 200% 100%;
  animation: skeleton-pulse 1.6s ease-in-out infinite;
}

.progress-skeleton__metric-text {
  flex: 1;
  display: grid;
  gap: 0.3rem;
}

.progress-skeleton__card {
  display: grid;
  gap: 1rem;
}

.progress-skeleton__chart {
  display: flex;
  gap: 0.65rem;
  align-items: flex-end;
  min-block-size: 6rem;
}

.progress-skeleton__bar {
  flex: 1;
  block-size: clamp(2.5rem, 5vw, 5.5rem);
  border-radius: var(--radius-md, 12px);
  background: linear-gradient(120deg, var(--color-bg-secondary), var(--color-bg-elevated), var(--color-bg-secondary));
  background-size: 200% 100%;
  animation: skeleton-pulse 1.6s ease-in-out infinite;
}

.progress-skeleton__list {
  display: grid;
  gap: 0.75rem;
}

.progress-skeleton__row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.progress-skeleton__track {
  flex: 1;
  block-size: 0.65rem;
  border-radius: 999px;
  background: var(--color-bg-secondary);
  overflow: hidden;
}

.progress-skeleton__value {
  inline-size: 55%;
  block-size: 100%;
  border-radius: inherit;
  background: linear-gradient(120deg, var(--color-bg-secondary), var(--color-bg-elevated), var(--color-bg-secondary));
  background-size: 200% 100%;
  animation: skeleton-pulse 1.6s ease-in-out infinite;
}

.progress-skeleton__achievements {
  display: grid;
  gap: 0.75rem;
}

.progress-skeleton__achievement-list {
  display: grid;
  gap: 0.75rem;
}

.skeleton-line {
  inline-size: 100%;
  block-size: 0.85rem;
  border-radius: var(--radius-sm, 8px);
  background: linear-gradient(120deg, var(--color-bg-secondary), var(--color-bg-elevated), var(--color-bg-secondary));
  background-size: 200% 100%;
  animation: skeleton-pulse 1.6s ease-in-out infinite;
}

.skeleton-line--title {
  block-size: 1rem;
  max-inline-size: 240px;
}

.skeleton-line--value {
  block-size: 1.2rem;
  max-inline-size: 120px;
}

.skeleton-line--label {
  max-inline-size: 160px;
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
