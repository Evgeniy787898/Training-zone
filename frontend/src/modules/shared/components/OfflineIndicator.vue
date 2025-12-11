<template>
  <transition name="offline-slide">
    <div v-if="!isOnline" class="offline-indicator" role="alert" aria-live="assertive">
      <NeonIcon name="wifiOff" variant="amber" :size="20" className="offline-indicator__icon" />
      <span class="offline-indicator__text">Нет подключения к интернету</span>
    </div>
  </transition>
</template>

<script setup lang="ts">
import NeonIcon from '@/modules/shared/components/NeonIcon.vue';

defineProps<{
  isOnline: boolean;
}>();
</script>

<style scoped>
.offline-indicator {
  position: fixed;
  bottom: calc(var(--footer-height) + 1.5rem); /* Just above footer/nav */
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  
  display: flex;
  align-items: center;
  gap: 0.75rem;
  
  padding: 0.75rem 1.25rem;
  background: var(--color-surface);
  border: 1px solid var(--color-warning);
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-lg), 0 0 20px rgba(246, 195, 68, 0.15);
  
  color: var(--color-text-primary);
  font-size: 0.9rem;
  font-weight: 500;
  white-space: nowrap;
}

@media (min-width: 1200px) {
  .offline-indicator {
    bottom: 2rem;
  }
}

.offline-indicator__icon {
  flex-shrink: 0;
}

.offline-slide-enter-active,
.offline-slide-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.offline-slide-enter-from,
.offline-slide-leave-to {
  opacity: 0;
  transform: translate(-50%, 20px) scale(0.95);
}
</style>
