<template>
  <TransitionGroup name="toast" tag="div" class="toast-stack">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      :class="['toast', `toast--${toast.type}`, { 'toast--with-action': toast.action }]"
      @click="toast.action?.onClick"
    >
      <!-- Иконка -->
      <div class="toast__icon">
        <NeonIcon :name="getIconName(toast.type)" :size="20" />
      </div>
      
      <!-- Контент -->
      <div class="toast__content">
        <h4 class="toast__title">{{ toast.title }}</h4>
        <p v-if="toast.message" class="toast__message">{{ toast.message }}</p>
      </div>
      
      <!-- Действие -->
      <button 
        v-if="toast.action" 
        class="toast__action"
        @click.stop="handleAction(toast)"
      >
        {{ toast.action.label }}
      </button>
      
      <!-- Закрыть -->
      <button class="toast__close" @click.stop="removeToast(toast.id)">
        <NeonIcon name="close" :size="16" variant="neutral" />
      </button>
      
      <!-- Прогресс-бар -->
      <div 
        v-if="toast.duration && toast.duration > 0"
        class="toast__progress" 
        :style="{ 
          animationDuration: `${toast.duration}ms`,
          animationPlayState: toast.paused ? 'paused' : 'running'
        }"
      />
    </div>
  </TransitionGroup>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useAppStore, type Toast } from '@/stores/app';
import NeonIcon from '@/components/NeonIcon.vue';

const appStore = useAppStore();
const { toasts } = storeToRefs(appStore);
const { removeToast } = appStore;

const getIconName = (type: string) => {
  switch (type) {
    case 'success': return 'check-circle';
    case 'error': return 'alert-circle';
    case 'warning': return 'alert-triangle';
    case 'info': default: return 'info';
  }
};

const handleAction = (toast: Toast) => {
  if (toast.action) {
    toast.action.onClick();
    removeToast(toast.id);
  }
};
</script>

<style scoped>
.toast-stack {
  position: fixed;
  top: env(safe-area-inset-top, 16px);
  left: 16px;
  right: 16px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--color-surface-elevated);
  border-radius: 16px;
  box-shadow: 
    0 4px 24px rgba(0, 0, 0, 0.25),
    0 0 0 1px rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(16px);
  pointer-events: auto;
  position: relative;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.toast:hover {
  transform: translateY(-2px);
}

.toast::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--toast-accent);
}

.toast--info { --toast-accent: var(--color-accent); }
.toast--success { --toast-accent: var(--color-success); }
.toast--warning { --toast-accent: var(--color-warning); }
.toast--error { --toast-accent: var(--color-danger); }

.toast__icon {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--toast-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.toast__content {
  flex: 1;
  min-width: 0;
}

.toast__title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
  line-height: 1.3;
}

.toast__message {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  margin: 4px 0 0;
  line-height: 1.4;
}

.toast__action {
  flex-shrink: 0;
  padding: 8px 14px;
  border-radius: 8px;
  background: var(--toast-accent);
  color: white;
  font-size: 0.8rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: opacity 0.2s;
}

.toast__action:hover {
  opacity: 0.9;
}

.toast__close {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.5;
  transition: opacity 0.2s, background 0.2s;
}

.toast__close:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.1);
}

.toast__progress {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 3px;
  background: var(--toast-accent);
  animation: progress linear forwards;
  transform-origin: left;
}

@keyframes progress {
  from { width: 100%; }
  to { width: 0%; }
}

/* Анимации появления/исчезновения */
.toast-enter-active {
  animation: toast-in 0.3s ease-out;
}

.toast-leave-active {
  animation: toast-out 0.2s ease-in;
  position: absolute; /* Для корректного удаления из потока */
  width: 100%;
}

.toast-move {
  transition: transform 0.3s ease;
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes toast-out {
  to {
    opacity: 0;
    transform: translateX(100px);
  }
}
</style>
