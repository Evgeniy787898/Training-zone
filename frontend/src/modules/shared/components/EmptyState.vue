<template>
  <div class="state state--empty" role="status">
    <div class="state__icon">
      <slot name="icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2" opacity="0.3"/>
          <path d="M9 9h6M9 12h4M9 15h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </slot>
    </div>
    <h3 class="state__title">{{ title || 'Здесь пока пусто' }}</h3>
    <p v-if="message" class="state__message">{{ message }}</p>
    <button
      v-if="actionLabel"
      type="button"
      class="state__action"
      @click="handleAction"
    >
      <span class="state__action-text">{{ actionLabel }}</span>
      <slot name="action-icon">
        <svg class="state__action-icon" width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M12 5v14m-7-7h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </slot>
    </button>
  </div>
</template>

<script setup lang="ts">
/**
 * EmptyState - Unified empty state component
 * Implements UI-005: Компонент EmptyState
 *
 * Usage:
 * <EmptyState
 *   title="Нет тренировок"
 *   message="Добавьте первую тренировку"
 *   actionLabel="Создать"
 *   @action="createTraining"
 * />
 */
import { hapticSelection } from '@/utils/hapticFeedback';

defineProps<{
  title?: string;
  message?: string;
  actionLabel?: string;
}>();

const emit = defineEmits<{
  action: [];
}>();

const handleAction = () => {
  hapticSelection();
  emit('action');
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
  border: 1.5px dashed var(--color-border);
  background: linear-gradient(135deg, var(--color-bg-secondary) 0%, var(--color-bg) 100%);
  color: var(--color-text-primary);
  text-align: center;
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  animation: emptyFadeIn 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes emptyFadeIn {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.state--empty {
  border-color: var(--color-border-subtle);
  background: linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 3%, var(--color-bg)) 0%, var(--color-bg) 100%);
}

.state__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  margin-bottom: var(--space-sm, 0.75rem);
  color: var(--color-text-muted);
  opacity: 0.6;
  animation: iconFloat 3s ease-in-out infinite;
}

@keyframes iconFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

.state__title {
  margin: 0;
  font-size: clamp(1rem, 0.95rem + 0.4vw, 1.25rem);
  font-weight: 600;
  color: var(--color-text-primary);
}

.state__message {
  margin: 0;
  font-size: clamp(0.875rem, 0.85rem + 0.25vw, 1rem);
  color: var(--color-text-secondary);
  max-width: 280px;
  line-height: 1.5;
}

.state__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs, 0.5rem);
  padding: var(--space-sm, 0.75rem) var(--space-lg, 1.5rem);
  min-height: 44px;
  border-radius: var(--radius-md, 12px);
  border: 1.5px solid var(--color-accent);
  background: linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-hover) 100%);
  color: var(--color-accent-contrast);
  font-family: var(--font-family-base, 'Inter', sans-serif);
  font-size: clamp(0.875rem, 0.85rem + 0.25vw, 1rem);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 
    0 2px 8px rgba(16, 163, 127, 0.25),
    0 1px 4px rgba(16, 163, 127, 0.15);
}

.state__action:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 
    0 6px 20px rgba(16, 163, 127, 0.35),
    0 3px 10px rgba(16, 163, 127, 0.25);
}

.state__action:active {
  transform: translateY(-1px) scale(1);
}

.state__action-text {
  position: relative;
  z-index: 1;
}

.state__action-icon {
  position: relative;
  z-index: 1;
  transition: transform 0.3s ease;
}

.state__action:hover .state__action-icon {
  transform: rotate(90deg);
}

/* Responsive */
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
