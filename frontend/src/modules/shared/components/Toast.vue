<template>
  <div class="toast-stack" role="region" aria-live="polite">
    <transition name="toast-fade" mode="out-in">
      <article
        v-if="toast"
        :key="toast.message"
        class="toast"
        :class="`toast--${toast.type || 'info'}`"
      >
        <div class="toast__body">
          <div class="toast__content">
            <h4 class="toast__title">{{ toast.title }}</h4>
            <p class="toast__message">{{ toast.message }}</p>
            <p v-if="toast.traceId" class="toast__trace">Trace ID: {{ toast.traceId }}</p>
          </div>
          <button
            type="button"
            class="toast__close"
            @click="clearToast"
            aria-label="Закрыть уведомление"
          >
            ✕
          </button>
        </div>
      </article>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useAppStore } from '@/stores/app';

const appStore = useAppStore();
const { toast } = storeToRefs(appStore);
const { clearToast } = appStore;
</script>

<style scoped>
.toast-stack {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.toast {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg-elevated);
  backdrop-filter: blur(12px);
  box-shadow: var(--shadow-lg);
  color: var(--color-text-primary);
  min-inline-size: clamp(14rem, 10rem + 20vw, 24rem);
}

.toast--success {
  border-color: rgba(91, 229, 132, 0.45);
  box-shadow: 0 0 1.8rem rgba(91, 229, 132, 0.3);
}

.toast--error {
  border-color: rgba(255, 107, 107, 0.55);
  box-shadow: 0 0 1.8rem rgba(255, 107, 107, 0.3);
}

.toast--warning {
  border-color: rgba(246, 195, 68, 0.45);
  box-shadow: 0 0 1.8rem rgba(246, 195, 68, 0.3);
}

.toast--info {
  border-color: var(--color-accent);
  box-shadow: 0 0 1.8rem var(--color-accent-light);
}

.toast__body {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--space-sm);
  align-items: start;
}

.toast__content {
  display: flex;
  flex-direction: column;
  gap: var(--space-xxs);
}

.toast__title {
  margin: 0;
  font-size: clamp(0.95rem, 0.9rem + 0.35vw, 1.15rem);
  font-weight: 600;
  letter-spacing: 0.01em;
}

.toast__message {
  margin: 0;
  font-size: clamp(0.8rem, 0.75rem + 0.35vw, 0.95rem);
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.toast__trace {
  margin: 0;
  font-size: clamp(0.7rem, 0.68rem + 0.25vw, 0.8rem);
  color: var(--color-text-muted);
}

.toast__close {
  inline-size: clamp(2.1rem, 1.9rem + 0.4vw, 2.4rem);
  block-size: clamp(2.1rem, 1.9rem + 0.4vw, 2.4rem);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  transition: var(--transition-base);
}

.toast__close:hover,
.toast__close:focus-visible {
  outline: none;
  color: var(--color-text-primary);
  border-color: var(--color-accent);
  box-shadow: 0 0 1.4rem var(--color-accent-light);
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: var(--transition-base);
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translate3d(20%, 0, 0);
}
</style>
