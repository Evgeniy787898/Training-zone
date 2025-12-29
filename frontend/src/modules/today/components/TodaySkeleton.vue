<template>
  <section class="today-skeleton" role="status" aria-live="polite" aria-label="Загрузка...">
    <!-- Action Bar Skeleton -->
    <div class="skeleton-action-bar">
      <div class="skeleton-text skeleton-text--discipline"></div>
      <div class="skeleton-dot"></div>
      <div class="skeleton-text skeleton-text--program"></div>
      <div class="skeleton-btn"></div>
    </div>

    <!-- Exercise Cards Carousel Skeleton -->
    <div class="skeleton-carousel">
      <div 
        v-for="i in 2" 
        :key="`card-${i}`" 
        class="skeleton-card"
        :style="{ animationDelay: `${i * 0.15}s` }"
      >
        <div class="skeleton-card__image"></div>
        <div class="skeleton-card__body">
          <div class="skeleton-text skeleton-text--title"></div>
          <div class="skeleton-text skeleton-text--subtitle"></div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.today-skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0;
}

/* Action Bar */
.skeleton-action-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
}

.skeleton-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
}

.skeleton-btn {
  width: 80px;
  height: 32px;
  border-radius: 8px;
  background: linear-gradient(90deg, 
    rgba(255, 255, 255, 0.06) 0%, 
    rgba(255, 255, 255, 0.12) 50%, 
    rgba(255, 255, 255, 0.06) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

/* Exercise Cards Carousel */
.skeleton-carousel {
  display: flex;
  gap: 0.75rem;
  padding: 0 0.75rem;
  overflow: hidden;
}

.skeleton-card {
  flex: 0 0 calc(50% - 0.375rem);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  padding: 0.5rem;
  animation: fadeIn 0.4s ease-out both;
}

.skeleton-card__image {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 10px;
  background: linear-gradient(90deg, 
    rgba(255, 255, 255, 0.05) 0%, 
    rgba(255, 255, 255, 0.12) 50%, 
    rgba(255, 255, 255, 0.05) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

.skeleton-card__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0;
}

/* Skeleton Text Lines */
.skeleton-text {
  height: 12px;
  border-radius: 6px;
  background: linear-gradient(90deg, 
    rgba(255, 255, 255, 0.06) 0%, 
    rgba(255, 255, 255, 0.15) 50%, 
    rgba(255, 255, 255, 0.06) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

.skeleton-text--discipline {
  width: 80px;
  height: 14px;
}

.skeleton-text--program {
  width: 100px;
  height: 10px;
}

.skeleton-text--title {
  width: 85%;
  height: 14px;
}

.skeleton-text--subtitle {
  width: 60%;
  height: 10px;
}

/* Animations */
@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
