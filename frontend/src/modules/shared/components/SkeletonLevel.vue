<template>
  <div class="skeleton-level" role="presentation" aria-hidden="true">
    <div class="skeleton-level__title"></div>
    <div class="skeleton-level__image"></div>
    <div class="skeleton-level__line"></div>
    <div class="skeleton-level__line skeleton-level__line--short"></div>
    <div class="skeleton-level__sublevel">
      <div class="skeleton-level__sublevel-item"></div>
      <div class="skeleton-level__sublevel-item"></div>
      <div class="skeleton-level__sublevel-item"></div>
    </div>
    <div class="skeleton-level__line"></div>
    <div class="skeleton-level__line skeleton-level__line--medium"></div>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.skeleton-level {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-lg, 1.5rem);
  padding: 2.618rem 1.618rem; /* золотое сечение */
  position: relative;
}

.skeleton-level__title {
  width: 60%;
  height: 1.875rem;
  border-radius: 10px;
  background: linear-gradient(
    90deg,
    rgba(229, 231, 235, 0.75) 0%,
    rgba(243, 244, 246, 0.92) 45%,
    rgba(249, 250, 251, 0.98) 50%,
    rgba(243, 244, 246, 0.92) 55%,
    rgba(229, 231, 235, 0.75) 100%
  );
  background-size: 300% 100%;
  /* Shimmer + пульсация */
  animation: 
    skeleton-shimmer 2.6s cubic-bezier(0.4, 0, 0.6, 1) infinite,
    skeleton-fade-pulse 3.4s ease-in-out infinite;
  will-change: background-position, opacity;
  backface-visibility: hidden;
  position: relative;
  z-index: 1;
}

.skeleton-level__image {
  width: 100%;
  height: 320px;
  border-radius: 20px;
  background: linear-gradient(
    90deg,
    rgba(229, 231, 235, 0.68) 0%,
    rgba(243, 244, 246, 0.88) 45%,
    rgba(249, 250, 251, 0.95) 50%,
    rgba(243, 244, 246, 0.88) 55%,
    rgba(229, 231, 235, 0.68) 100%
  );
  background-size: 300% 100%;
  position: relative;
  overflow: hidden;
  /* Shimmer + пульсация */
  animation: 
    skeleton-shimmer 2.8s cubic-bezier(0.4, 0, 0.6, 1) infinite,
    skeleton-pulse 3.2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  animation-delay: 0.2s, 0.2s;
  box-shadow: 
    0 1px 3px rgba(0, 0, 0, 0.05),
    0 1px 2px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(229, 231, 235, 0.3);
  will-change: background-position, opacity, transform;
  backface-visibility: hidden;
}

/* Пульсирующее свечение для изображения */
.skeleton-level__image::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, transparent 100%);
  border-radius: 20px;
  animation: skeleton-pulse-glow 3.2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  pointer-events: none;
}

.skeleton-level__line {
  width: 100%;
  height: 1.125rem;
  border-radius: 8px;
  background: linear-gradient(
    90deg,
    rgba(229, 231, 235, 0.65) 0%,
    rgba(243, 244, 246, 0.85) 45%,
    rgba(249, 250, 251, 0.95) 50%,
    rgba(243, 244, 246, 0.85) 55%,
    rgba(229, 231, 235, 0.65) 100%
  );
  background-size: 300% 100%;
  /* Shimmer + пульсация */
  animation: 
    skeleton-shimmer 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite,
    skeleton-fade-pulse 3s ease-in-out infinite;
  will-change: background-position, opacity;
  backface-visibility: hidden;
  position: relative;
  z-index: 1;
}

.skeleton-level__line--short {
  width: 70%;
  animation-delay: 0.35s, 0.35s;
}

.skeleton-level__line--medium {
  width: 85%;
  animation-delay: 0.5s, 0.5s;
}

.skeleton-level__sublevel {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm, 0.75rem);
  padding: 0.809rem 1.309rem; /* золотое сечение */
  background: linear-gradient(135deg, rgba(249, 250, 251, 0.8) 0%, rgba(255, 255, 255, 0.95) 100%);
  border-radius: 14px;
  border: 1px solid rgba(229, 231, 235, 0.3);
  position: relative;
  overflow: hidden;
  /* Легкая пульсация контейнера */
  animation: skeleton-pulse 2.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  box-shadow: 
    0 1px 2px rgba(0, 0, 0, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.95);
  will-change: opacity, transform;
  backface-visibility: hidden;
}

.skeleton-level__sublevel-item {
  width: 100%;
  height: 2.618rem; /* золотое сечение */
  border-radius: 10px;
  background: linear-gradient(
    90deg,
    rgba(229, 231, 235, 0.7) 0%,
    rgba(243, 244, 246, 0.88) 45%,
    rgba(249, 250, 251, 0.95) 50%,
    rgba(243, 244, 246, 0.88) 55%,
    rgba(229, 231, 235, 0.7) 100%
  );
  background-size: 300% 100%;
  /* Shimmer + пульсация */
  animation: 
    skeleton-shimmer 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite,
    skeleton-fade-pulse 3.2s ease-in-out infinite;
  position: relative;
  z-index: 1;
  will-change: background-position, opacity;
  backface-visibility: hidden;
}

.skeleton-level__sublevel-item:nth-child(2) {
  animation-delay: 0.25s, 0.25s;
}

.skeleton-level__sublevel-item:nth-child(3) {
  animation-delay: 0.5s, 0.5s;
}

/* Отключение анимаций для prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  .skeleton-level__title,
  .skeleton-level__image,
  .skeleton-level__image::before,
  .skeleton-level__line,
  .skeleton-level__sublevel,
  .skeleton-level__sublevel-item {
    animation: none !important;
    opacity: 0.9 !important;
  }
}

/* Responsive */
@media (max-width: 768px) {
  .skeleton-level {
    padding: 2.118rem 1.309rem;
    gap: var(--space-md, 1rem);
  }
  
  .skeleton-level__title {
    height: 1.625rem;
  }
  
  .skeleton-level__image {
    height: 240px;
    border-radius: 16px;
  }
  
  .skeleton-level__line {
    height: 1rem;
  }
  
  .skeleton-level__sublevel-item {
    height: 2.236rem;
  }
}

@media (max-width: 480px) {
  .skeleton-level {
    padding: 1.618rem 1.118rem;
    gap: var(--space-sm, 0.75rem);
  }
  
  .skeleton-level__title {
    height: 1.5rem;
  }
  
  .skeleton-level__image {
    height: 200px;
    border-radius: 14px;
  }
  
  .skeleton-level__line {
    height: 0.9375rem;
  }
  
  .skeleton-level__sublevel {
    padding: 0.618rem 1rem;
  }
  
  .skeleton-level__sublevel-item {
    height: 2rem;
  }
}

@media (max-width: 360px) {
  .skeleton-level {
    padding: 1.309rem 1rem;
  }
  
  .skeleton-level__image {
    height: 180px;
    border-radius: 12px;
  }
  
  .skeleton-level__sublevel-item {
    height: 1.809rem;
  }
}
</style>
