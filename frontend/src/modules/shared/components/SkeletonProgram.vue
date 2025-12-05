<template>
  <div class="skeleton-program" role="presentation" aria-hidden="true">
    <div class="skeleton-program__title"></div>
    <div class="skeleton-program__description"></div>
    <div class="skeleton-program__description skeleton-program__description--short"></div>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.skeleton-program {
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-lg);
  border-radius: var(--radius-lg);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  min-height: 220px;
  justify-content: center;
  align-items: center;
  position: relative;
  overflow: hidden;
  margin: 0 auto;
  animation: skeleton-pulse 2s ease-in-out infinite;
  box-shadow: var(--shadow-sm);
  will-change: opacity;
}

.skeleton-program::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, transparent 100%);
  border-radius: var(--radius-lg);
  pointer-events: none;
}

.skeleton-program__title {
  width: 65%;
  height: 1.625rem;
  border-radius: var(--radius-md);
  background: var(--color-bg-tertiary);
  opacity: 0.7;
}

.skeleton-program__description {
  width: 85%;
  height: 1rem;
  border-radius: var(--radius-sm);
  background: var(--color-bg-tertiary);
  opacity: 0.5;
}

.skeleton-program__description--short {
  width: 60%;
}

@media (max-width: 768px) {
  .skeleton-program {
    min-height: 200px;
    padding: var(--space-md);
  }
}

@media (max-width: 480px) {
  .skeleton-program {
    min-height: 180px;
  }
}
</style>
