<template>
  <span
    :class="[
      'neon-icon',
      variantClasses[variant],
      className
    ]"
    :style="{ '--icon-size': iconSize }"
    aria-hidden="true"
  >
    <component :is="iconComponent" class="neon-icon__svg" />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { resolveIconComponent, type IconName } from '../icons/registry';

interface Props {
  name: IconName;
  size?: number | string;
  variant?: 'lime' | 'emerald' | 'violet' | 'amber' | 'aqua' | 'neutral';
  className?: string;
}

const props = withDefaults(defineProps<Props>(), {
  size: 20,
  variant: 'lime',
  className: '',
});

const variantClasses = {
  lime: 'neon-icon--lime',
  emerald: 'neon-icon--emerald',
  violet: 'neon-icon--violet',
  amber: 'neon-icon--amber',
  aqua: 'neon-icon--aqua',
  neutral: 'neon-icon--neutral',
};

const iconSize = computed(() => {
  return typeof props.size === 'number'
    ? `${props.size / 16}rem`
    : props.size;
});

const iconComponent = computed(() => resolveIconComponent(props.name));
</script>
<style scoped>
.neon-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  inline-size: var(--icon-size);
  block-size: var(--icon-size);
  border-radius: 50%;
  background: radial-gradient(150deg, rgba(66, 133, 244, 0.22), rgba(11, 11, 11, 0.92));
  box-shadow: 0 0 1.4rem rgba(66, 133, 244, 0.35);
  transition: var(--transition-base);
}

.neon-icon__svg {
  inline-size: clamp(60%, 55% + 6vw, 80%);
  block-size: clamp(60%, 55% + 6vw, 80%);
}

.neon-icon--lime {
  color: var(--color-success);
  box-shadow: 0 0 1.4rem rgba(91, 229, 132, 0.35);
}

.neon-icon--emerald {
  color: var(--color-success);
  box-shadow: 0 0 1.4rem rgba(77, 208, 163, 0.35);
}

.neon-icon--violet {
  color: rgba(188, 134, 255, 0.95);
  box-shadow: 0 0 1.4rem rgba(156, 39, 176, 0.4);
}

.neon-icon--amber {
  color: var(--color-warning);
  box-shadow: 0 0 1.4rem rgba(246, 195, 68, 0.4);
}

.neon-icon--aqua {
  color: rgba(120, 170, 255, 0.95);
  box-shadow: 0 0 1.4rem rgba(120, 170, 255, 0.4);
}

.neon-icon--neutral {
  color: var(--color-text-secondary);
  box-shadow: 0 0 1.2rem rgba(232, 234, 237, 0.18);
}
</style>
