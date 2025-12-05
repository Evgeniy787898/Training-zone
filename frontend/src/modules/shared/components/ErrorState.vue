<template>
  <div class="state state--error" role="alert">
    <div class="state__icon">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity="0.3"/>
        <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
  </div>
    <p class="state__message">{{ message || 'Произошла ошибка' }}</p>
    <button
      type="button"
      class="state__action"
      @click="handleRetry"
    >
      <span class="state__action-text">{{ actionLabel || 'Попробовать ещё раз' }}</span>
      <svg class="state__action-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 4v6h6M23 20v-6h-6M3.51 9a9 9 0 0114.85 3.36M20.49 15a9 9 0 01-14.85-3.36" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { hapticSelection } from '@/utils/hapticFeedback';

defineProps<{
  message?: string;
  actionLabel?: string;
}>();

const emit = defineEmits<{
  retry: [];
}>();

const isRetrying = ref(false);

const handleRetry = () => {
  if (isRetrying.value) return;
  
  hapticSelection();
  isRetrying.value = true;
  
  emit('retry');
  
  // Сбрасываем состояние через небольшую задержку
  setTimeout(() => {
    isRetrying.value = false;
  }, 1000);
};
</script>

<style scoped>
.state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-md, 1rem);
  padding: var(--space-xl, 2rem);
  border-radius: var(--radius-lg, 16px);
  border: 1.5px solid var(--color-border);
  background: linear-gradient(135deg, var(--color-bg-secondary) 0%, var(--color-bg) 100%);
  color: var(--color-text-primary);
  text-align: center;
  position: relative;
  overflow: hidden;
  /* Glassmorphism */
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  /* Мягкая тень */
  box-shadow: 
    0 4px 16px rgba(0, 0, 0, 0.08),
    0 2px 8px rgba(0, 0, 0, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  /* Анимация появления */
  animation: errorFadeIn 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes errorFadeIn {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Particle effect overlay */
.state::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle at 30% 30%, rgba(239, 68, 68, 0.05) 0%, transparent 50%),
              radial-gradient(circle at 70% 70%, rgba(239, 68, 68, 0.03) 0%, transparent 50%);
  pointer-events: none;
  opacity: 0;
  animation: errorPulse 3s ease-in-out infinite;
}

@keyframes errorPulse {
  0%, 100% { opacity: 0; }
  50% { opacity: 1; }
}

.state--error {
  border-color: var(--color-danger);
  background: linear-gradient(135deg, color-mix(in srgb, var(--color-danger) 5%, var(--color-bg)) 0%, var(--color-bg) 100%);
}

.state__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  margin-bottom: var(--space-sm, 0.75rem);
  color: var(--color-danger);
  animation: iconBounce 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

@keyframes iconBounce {
  0% {
    opacity: 0;
    transform: scale(0.3) rotate(-180deg);
  }
  50% {
    transform: scale(1.1) rotate(5deg);
  }
  100% {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
}

.state__message {
  margin: 0;
  font-size: clamp(0.95rem, 0.9rem + 0.4vw, 1.15rem);
  font-weight: 500;
  line-height: 1.6;
  color: var(--color-text-primary);
  animation: messageFadeIn 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.2s both;
}

@keyframes messageFadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.state__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs, 0.5rem);
  padding: var(--space-sm, 0.75rem) var(--space-lg, 1.5rem);
  min-height: 48px;
  border-radius: var(--radius-md, 12px);
  border: 1.5px solid var(--color-accent);
  background: linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-hover) 100%);
  color: var(--color-accent-contrast);
  font-family: var(--font-family-base, 'Inter', sans-serif);
  font-size: clamp(0.875rem, 0.85rem + 0.25vw, 1rem);
  font-weight: 600;
  letter-spacing: 0.01em;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  position: relative;
  overflow: hidden;
  /* Glassmorphism для кнопки */
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  /* Мягкая тень */
  box-shadow: 
    0 2px 8px rgba(16, 163, 127, 0.25),
    0 1px 4px rgba(16, 163, 127, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  animation: buttonFadeIn 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.3s both;
}

@keyframes buttonFadeIn {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Shimmer effect на кнопке */
.state__action::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  transition: left 0.5s;
}

.state__action:hover::before {
  left: 100%;
}

.state__action:hover,
.state__action:focus-visible {
  outline: none;
  transform: translateY(-2px) scale(1.02);
  box-shadow: 
    0 6px 20px rgba(16, 163, 127, 0.35),
    0 3px 10px rgba(16, 163, 127, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
  background: linear-gradient(135deg, var(--color-accent-hover) 0%, color-mix(in srgb, var(--color-accent-hover) 85%, black) 100%);
  border-color: var(--color-accent-hover);
}

.state__action:active {
  transform: translateY(-1px) scale(1);
}

.state__action:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  pointer-events: none;
}

.state__action-text {
  position: relative;
  z-index: 1;
}

.state__action-icon {
  position: relative;
  z-index: 1;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.state__action:hover .state__action-icon {
  transform: rotate(180deg);
}

/* Responsive */
@media (max-width: 768px) {
  .state {
    padding: var(--space-lg, 1.5rem);
    border-radius: var(--radius-md, 12px);
  }
  
  .state__icon {
    width: 56px;
    height: 56px;
  }
}

@media (max-width: 480px) {
  .state {
    padding: var(--space-md, 1rem);
  }
  
  .state__icon {
    width: 48px;
    height: 48px;
  }
}
</style>
