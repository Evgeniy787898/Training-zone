<template>
  <section class="analytics-skeleton" role="status" aria-live="polite">
    <div class="analytics-skeleton__stats">
      <div v-for="index in 3" :key="`stat-${index}`" class="skeleton-stat">
        <div class="skeleton-line skeleton-line--label"></div>
        <div class="skeleton-line skeleton-line--value"></div>
      </div>
    </div>

    <div class="surface-card analytics-skeleton__card">
      <div class="skeleton-line skeleton-line--title"></div>
      <div class="analytics-skeleton__chart">
        <div v-for="index in 8" :key="`bar-${index}`" class="analytics-skeleton__bar"></div>
      </div>
    </div>

    <div class="surface-card analytics-skeleton__card">
      <div class="skeleton-line skeleton-line--title"></div>
      <div class="analytics-skeleton__rows">
        <div v-for="index in 4" :key="`row-${index}`" class="analytics-skeleton__row">
          <div class="skeleton-line skeleton-line--label"></div>
          <div class="analytics-skeleton__track">
            <div class="analytics-skeleton__value"></div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.analytics-skeleton {
  display: grid;
  gap: 1.25rem;
}

.analytics-skeleton__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: 0.75rem;
}

.skeleton-stat {
  padding: 1rem;
  border-radius: var(--radius-lg, 16px);
  background: var(--color-bg-card);
  display: grid;
  gap: 0.5rem;
}

.analytics-skeleton__card {
  display: grid;
  gap: 1rem;
}

.analytics-skeleton__chart {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 0.5rem;
  min-block-size: 6rem;
}

.analytics-skeleton__bar {
  border-radius: var(--radius-md, 12px);
  background: linear-gradient(120deg, var(--color-bg-secondary), var(--color-bg-elevated), var(--color-bg-secondary));
  background-size: 200% 100%;
  animation: skeleton-pulse 1.6s ease-in-out infinite;
  min-block-size: calc(2.5rem + (var(--index, 1) * 0.2rem));
}

.analytics-skeleton__rows {
  display: grid;
  gap: 0.75rem;
}

.analytics-skeleton__row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.analytics-skeleton__track {
  flex: 1;
  block-size: 0.7rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.analytics-skeleton__value {
  block-size: 100%;
  inline-size: 65%;
  border-radius: inherit;
  background: var(--skeleton-sheen, linear-gradient(120deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.35), rgba(255, 255, 255, 0.2)));
  background-size: 200% 100%;
  animation: skeleton-pulse 1.6s ease-in-out infinite;
}

.skeleton-line {
  inline-size: 100%;
  block-size: 0.85rem;
  border-radius: var(--radius-sm, 8px);
  background: var(--skeleton-sheen, linear-gradient(120deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.08)));
  background-size: 200% 100%;
  animation: skeleton-pulse 1.6s ease-in-out infinite;
}

.skeleton-line--title {
  block-size: 1rem;
  max-inline-size: 220px;
}

.skeleton-line--value {
  block-size: 1.2rem;
  max-inline-size: 140px;
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
