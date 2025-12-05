<template>
  <Transition name="fade">
    <div v-if="isActive" class="progress-indicator elevation-2" role="status" aria-live="polite">
      <div class="progress-indicator__bar"></div>
      <div class="progress-indicator__pulse"></div>
      <span class="progress-indicator__label">Подготавливаем данные…</span>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { useProgressState } from '@/services/progressTracker';

const { isActive } = useProgressState();
</script>

<style scoped>
.progress-indicator {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  background-image: linear-gradient(var(--panel-surface-base), var(--panel-surface-base)), var(--gradient-accent);
  background-origin: border-box;
  border: 1px solid transparent;
  backdrop-filter: blur(12px);
  box-shadow: 0 18px 45px color-mix(in srgb, var(--color-accent) 15%, transparent);
  z-index: 2000;
}

.progress-indicator__bar {
  position: relative;
  flex: 1;
  height: 4px;
  overflow: hidden;
  background: color-mix(in srgb, var(--color-border) 35%, transparent);
  border-radius: 999px;
}

.progress-indicator__bar::after {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--gradient-accent-strong);
  animation: progress-stripe 1.4s ease-in-out infinite;
  box-shadow: 0 0 18px color-mix(in srgb, var(--color-accent) 25%, transparent);
}

.progress-indicator__pulse {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--gradient-accent-highlight);
  box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.3);
  animation: pulse 1.8s ease-out infinite;
}

.progress-indicator__label {
  font-size: 14px;
  color: var(--color-text-primary);
  white-space: nowrap;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@keyframes progress-stripe {
  0% {
    transform: translateX(-60%);
  }
  50% {
    transform: translateX(0%);
  }
  100% {
    transform: translateX(60%);
  }
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.38);
  }
  70% {
    box-shadow: 0 0 0 14px rgba(37, 99, 235, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(37, 99, 235, 0);
  }
}
</style>
