<template>
  <div class="skeleton-exercise" role="presentation" aria-hidden="true">
    <div class="skeleton-exercise__icon"></div>
    <div class="skeleton-exercise__content">
      <div class="skeleton-exercise__title"></div>
      <div class="skeleton-exercise__description"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.skeleton-exercise {
  width: 100%;
  display: flex;
  gap: var(--space-md);
  padding: var(--space-lg);
  border-radius: var(--radius-lg);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  min-height: 88px;
  align-items: center;
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
  animation: skeleton-pulse 2s ease-in-out infinite;
  box-shadow: var(--shadow-sm);
  will-change: opacity;
}

.skeleton-exercise::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, transparent 100%);
  border-radius: var(--radius-lg);
  pointer-events: none;
}

.skeleton-exercise__icon {
  width: 52px;
  height: 52px;
  min-width: 52px;
  border-radius: var(--radius-md);
  background: var(--color-bg-tertiary);
  opacity: 0.6;
  position: relative;
  z-index: 1;
  border: 1px solid var(--color-border);
}

.skeleton-exercise__content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  min-width: 0;
  position: relative;
  z-index: 1;
}

.skeleton-exercise__title {
  width: 70%;
  height: 1.375rem;
  border-radius: var(--radius-md);
  background: var(--color-bg-tertiary);
  opacity: 0.7;
}

.skeleton-exercise__description {
  width: 90%;
  height: 1.0625rem;
  border-radius: var(--radius-sm);
  background: var(--color-bg-tertiary);
  opacity: 0.5;
}

@media (max-width: 768px) {
  .skeleton-exercise {
    min-height: 80px;
    padding: var(--space-md);
  }
  
  .skeleton-exercise__icon {
    width: 48px;
    height: 48px;
    min-width: 48px;
  }
}

@media (max-width: 480px) {
  .skeleton-exercise {
    min-height: 72px;
    padding: var(--space-sm);
    gap: var(--space-sm);
  }
  
  .skeleton-exercise__icon {
    width: 44px;
    height: 44px;
    min-width: 44px;
  }
}
</style>
