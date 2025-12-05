<template>
  <button
    class="hero-status-icon"
    :class="[`hero-status-icon--${status}`, { 'is-clickable': clickable }]"
    @click="handleClick"
    :aria-label="statusLabel"
    type="button"
  >
    <div class="hero-status-icon__inner">
      <div class="hero-status-icon__pulse" v-if="status === 'training'"></div>
      <div class="hero-status-icon__content">
        <span class="hero-status-icon__emoji" aria-hidden="true">{{ statusEmoji }}</span>
      </div>
    </div>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  status: 'training' | 'rest' | 'completed' | 'pending';
  clickable?: boolean;
}>();

const emit = defineEmits<{
  click: [];
}>();

const statusEmoji = computed(() => {
  switch (props.status) {
    case 'training':
      return '💪';
    case 'rest':
      return '😴';
    case 'completed':
      return '✅';
    case 'pending':
      return '⏳';
    default:
      return '💪';
  }
});

const statusLabel = computed(() => {
  switch (props.status) {
    case 'training':
      return 'Время тренировки';
    case 'rest':
      return 'День отдыха';
    case 'completed':
      return 'Тренировка завершена';
    case 'pending':
      return 'Ожидание тренировки';
    default:
      return 'Статус тренировки';
  }
});

const handleClick = () => {
  if (props.clickable) {
    emit('click');
  }
};
</script>

<style scoped>
.hero-status-icon {
  position: relative;
  inline-size: clamp(3.2rem, 3rem + 1vw, 3.6rem);
  block-size: clamp(3.2rem, 3rem + 1vw, 3.6rem);
  border: none;
  background: transparent;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: var(--transition-base);
}

.hero-status-icon.is-clickable:hover,
.hero-status-icon.is-clickable:focus-visible {
  outline: none;
  transform: translateY(-0.08rem) scale(1.02);
  box-shadow: 0 0 1.6rem var(--color-accent-light);
}

.hero-status-icon__inner {
  position: relative;
  inline-size: 100%;
  block-size: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-status-icon__pulse {
  position: absolute;
  inset: calc(var(--space-xxs) * -0.9);
  border: 0.14rem solid var(--color-accent);
  border-radius: 50%;
  animation: pulse 2.8s infinite;
  opacity: 0.85;
}

.hero-status-icon__content {
  position: relative;
  z-index: 1;
  inline-size: clamp(2.35rem, 2.1rem + 0.9vw, 2.9rem);
  block-size: clamp(2.35rem, 2.1rem + 0.9vw, 2.9rem);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0.14rem solid var(--color-accent);
  background: linear-gradient(160deg, var(--color-accent-light), var(--color-bg-elevated));
  backdrop-filter: blur(12px);
  box-shadow: 0 0 1.4rem var(--color-accent-light);
  transition: var(--transition-base);
}

.hero-status-icon--rest .hero-status-icon__content {
  border-color: rgba(120, 170, 255, 0.6);
  background: linear-gradient(160deg, rgba(120, 170, 255, 0.3), var(--color-bg-elevated));
  box-shadow: 0 0 1.4rem rgba(120, 170, 255, 0.35);
}

.hero-status-icon--rest .hero-status-icon__pulse {
  border-color: rgba(120, 170, 255, 0.45);
}

.hero-status-icon--completed .hero-status-icon__content {
  border-color: rgba(91, 229, 132, 0.6);
  background: linear-gradient(160deg, rgba(91, 229, 132, 0.3), var(--color-bg-elevated));
  box-shadow: 0 0 1.4rem rgba(91, 229, 132, 0.35);
}

.hero-status-icon--completed .hero-status-icon__pulse {
  border-color: rgba(91, 229, 132, 0.45);
}

.hero-status-icon--pending .hero-status-icon__content {
  border-color: rgba(246, 195, 68, 0.6);
  background: linear-gradient(160deg, rgba(246, 195, 68, 0.32), var(--color-bg-elevated));
  box-shadow: 0 0 1.4rem rgba(246, 195, 68, 0.35);
}

.hero-status-icon--pending .hero-status-icon__pulse {
  border-color: rgba(246, 195, 68, 0.45);
}

.hero-status-icon__emoji {
  font-size: clamp(1.1rem, 1rem + 0.5vw, 1.4rem);
  line-height: 1;
}

@keyframes pulse {
  0% {
    transform: scale(1);
    opacity: 0.9;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.4;
  }
  100% {
    transform: scale(1);
    opacity: 0.9;
  }
}
</style>
