<template>
  <component
    :is="tag"
    :to="to"
    :type="tag === 'button' ? type : undefined"
    class="base-button"
    :class="[
      `base-button--${variant}`,
      `base-button--${size}`,
      { 'base-button--block': block },
      { 'base-button--loading': loading },
      { 'base-button--icon-only': icon && !$slots.default }
    ]"
    :disabled="disabled || loading"
    v-bind="$attrs"
  >
    <span v-if="loading" class="base-button__loader">
      <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </span>
    
    <AppIcon 
      v-if="icon && !loading" 
      :name="icon" 
      class="base-button__icon"
      :class="{ 'mr-2': $slots.default }"
      :size="iconSize"
    />
    
    <span v-if="$slots.default" class="base-button__content" :class="{ 'opacity-0': loading && !loadingText }">
      <slot>{{ loadingText }}</slot>
    </span>
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import AppIcon from '@/modules/shared/components/AppIcon.vue';
import type { IconName } from '@/modules/shared/icons/registry';

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'warning' | 'outline';
    size?: 'sm' | 'md' | 'lg';
    type?: 'button' | 'submit' | 'reset';
    block?: boolean;
    disabled?: boolean;
    loading?: boolean;
    loadingText?: string;
    icon?: IconName;
    to?: string | object;
  }>(),
  {
    variant: 'primary',
    size: 'md',
    type: 'button',
    block: false,
    disabled: false,
    loading: false,
  }
);

const tag = computed(() => (props.to ? RouterLink : 'button'));

const iconSize = computed(() => {
  switch (props.size) {
    case 'sm': return 16;
    case 'lg': return 24;
    default: return 20;
  }
});
</script>

<style scoped>
.base-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  font-weight: 500;
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease, opacity 0.2s ease;
  cursor: pointer;
  border: 1px solid transparent;
  text-decoration: none;
  position: relative;
  white-space: nowrap;
  user-select: none;
}

.base-button:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.base-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

/* Sizes */
.base-button--sm {
  height: 2rem;
  padding: 0 0.75rem;
  font-size: var(--font-size-xs);
}

.base-button--md {
  height: 2.25rem; /* Slightly smaller than 2.5rem for tighter UI */
  padding: 0 1rem;
  font-size: var(--font-size-sm);
}

.base-button--lg {
  height: 2.75rem;
  padding: 0 1.25rem;
  font-size: var(--font-size-base);
}

.base-button--block {
  display: flex;
  width: 100%;
}

.base-button--icon-only {
  padding: 0;
  width: 2.25rem; /* Match height of md */
}
.base-button--sm.base-button--icon-only { width: 2rem; }
.base-button--lg.base-button--icon-only { width: 2.75rem; }

/* Variants */
.base-button--primary {
  background-color: var(--color-accent);
  color: var(--color-accent-contrast);
}
.base-button--primary:hover:not(:disabled) {
  background-color: var(--color-accent-hover);
}

.base-button--secondary {
  background-color: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border-color: var(--color-border);
}
.base-button--secondary:hover:not(:disabled) {
  background-color: var(--color-border-subtle);
  border-color: var(--color-border-strong);
}

.base-button--ghost {
  background-color: transparent;
  color: var(--color-text-secondary);
}
.base-button--ghost:hover:not(:disabled) {
  background-color: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

.base-button--outline {
  background-color: transparent;
  border-color: var(--color-border);
  color: var(--color-text-primary);
}
.base-button--outline:hover:not(:disabled) {
  border-color: var(--color-text-secondary);
  background-color: var(--color-bg-secondary);
}

.base-button--danger {
  background-color: var(--color-danger);
  color: white;
}
.base-button--danger:hover:not(:disabled) {
  filter: brightness(0.9);
}

.base-button--warning {
  background-color: var(--color-warning);
  color: white;
}
.base-button--warning:hover:not(:disabled) {
  filter: brightness(0.9);
}

.base-button__loader {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
}
</style>
