<template>
  <button 
    class="ai-action-btn"
    :class="`ai-action-btn--${variant}`"
    @click="handleClick"
  >
    <span v-if="icon" class="ai-action-btn__icon">{{ icon }}</span>
    <span class="ai-action-btn__label">{{ label }}</span>
  </button>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

const props = defineProps<{
  label: string;
  icon?: string;
  action: 'navigate' | 'startWorkout' | 'openExercise' | 'custom';
  target?: string;
  variant?: 'primary' | 'secondary';
}>();

const emit = defineEmits<{
  click: [action: string, target?: string];
}>();

const router = useRouter();

const handleClick = () => {
  switch (props.action) {
    case 'navigate':
      if (props.target) {
        router.push(props.target);
      }
      break;
    case 'startWorkout':
      router.push('/workout');
      break;
    case 'openExercise':
      if (props.target) {
        router.push(`/exercises/${props.target}`);
      }
      break;
    default:
      emit('click', props.action, props.target);
  }
};
</script>

<style scoped>
.ai-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  margin: 4px;
}

.ai-action-btn--primary {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
}

.ai-action-btn--primary:hover {
  filter: brightness(1.1);
  transform: translateY(-2px);
}

.ai-action-btn--secondary {
  background: var(--color-surface-elevated);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.ai-action-btn--secondary:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.ai-action-btn__icon {
  font-size: 1.1rem;
}
</style>
