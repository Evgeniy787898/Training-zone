<template>
  <div class="skeleton-discipline" role="presentation" aria-hidden="true">
    <div class="skeleton-discipline__title"></div>
    <div class="skeleton-discipline__subtitle"></div>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.skeleton-discipline {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-lg);
  border-radius: var(--radius-lg);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  min-height: 240px;
  justify-content: center;
  align-items: center;
  position: relative;
  overflow: hidden;
  animation: skeleton-pulse 2s ease-in-out infinite;
  box-shadow: var(--shadow-sm);
  will-change: opacity;
}

.skeleton-discipline::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, transparent 100%);
  border-radius: var(--radius-lg);
  pointer-events: none;
}

.skeleton-discipline__title {
  width: 70%;
  height: 1.75rem;
  border-radius: var(--radius-md);
  background: var(--color-bg-tertiary);
  opacity: 0.7;
}

.skeleton-discipline__subtitle {
  width: 90%;
  height: 1.125rem;
  border-radius: var(--radius-sm);
  background: var(--color-bg-tertiary);
  opacity: 0.5;
}

@media (max-width: 768px) {
  .skeleton-discipline {
    min-height: 210px;
    padding: var(--space-md);
  }
}

@media (max-width: 480px) {
  .skeleton-discipline {
    min-height: 180px;
  }
}
</style>
