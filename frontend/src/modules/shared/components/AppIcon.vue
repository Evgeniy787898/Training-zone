<template>
  <span
    :class="['app-icon', `app-icon--${tone}`, `app-icon--${variant}`]"
    :style="{ '--app-icon-size': iconSize }"
    v-bind="label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': 'true' }"
  >
    <component :is="iconComponent" class="app-icon__svg" />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { resolveIconComponent, type IconName } from '../icons/registry';

interface Props {
  name: IconName;
  size?: number | string;
  variant?: 'lime' | 'emerald' | 'violet' | 'amber' | 'aqua' | 'neutral' | 'accent' | 'success' | 'warning' | 'error' | 'info';
  tone?: 'solid' | 'ghost' | 'muted';
  label?: string;
}

const props = withDefaults(defineProps<Props>(), {
  size: 20,
  variant: 'lime',
  tone: 'solid',
  label: undefined,
});

const iconSize = computed(() => {
  return typeof props.size === 'number' ? `${props.size / 16}rem` : props.size;
});

const iconComponent = computed(() => resolveIconComponent(props.name));
</script>

<style scoped>
.app-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  inline-size: var(--app-icon-size);
  block-size: var(--app-icon-size);
  color: currentColor;
  transition: var(--transition-base, 150ms ease);
}

.app-icon--solid {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05), 0 0.35rem 1.2rem rgba(0, 0, 0, 0.25);
  padding: 0.35rem;
}

.app-icon--ghost {
  border-radius: 0.65rem;
  padding: 0.15rem;
}

.app-icon--muted {
  opacity: 0.75;
}

.app-icon__svg {
  inline-size: 100%;
  block-size: 100%;
}

.app-icon--lime {
  color: var(--color-success);
}

.app-icon--emerald {
  color: var(--color-success);
}

.app-icon--violet {
  color: var(--color-accent);
}

.app-icon--amber {
  color: var(--color-warning);
}

.app-icon--aqua {
  color: var(--color-info);
}

.app-icon--neutral {
  color: var(--color-text-secondary);
}

.app-icon--accent {
  color: var(--color-accent);
}

.app-icon--success {
  color: var(--color-success);
}

.app-icon--warning {
  color: var(--color-warning);
}

.app-icon--error {
  color: var(--color-danger);
}

.app-icon--info {
  color: var(--color-info);
}
</style>
