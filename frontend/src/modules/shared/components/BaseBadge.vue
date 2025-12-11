<template>
  <span class="base-badge" :class="badgeClasses">
    <slot>{{ label }}</slot>
  </span>
</template>

<script setup lang="ts">
/**
 * BaseBadge - Reusable badge/tag component
 * Part of UI-001: Расширить атомарные компоненты
 */
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  label?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  rounded?: boolean;
}>(), {
  variant: 'default',
  size: 'md',
  rounded: false,
});

const badgeClasses = computed(() => [
  `base-badge--${props.variant}`,
  `base-badge--${props.size}`,
  { 'base-badge--rounded': props.rounded },
]);
</script>

<style scoped>
.base-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  white-space: nowrap;
  border-radius: var(--radius-sm, 6px);
  transition: all 0.2s ease;
}

/* Sizes */
.base-badge--sm {
  padding: 2px 6px;
  font-size: 0.7rem;
}

.base-badge--md {
  padding: 4px 10px;
  font-size: 0.75rem;
}

.base-badge--lg {
  padding: 6px 14px;
  font-size: 0.875rem;
}

/* Variants */
.base-badge--default {
  background: var(--color-bg-tertiary, rgba(255, 255, 255, 0.1));
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}

.base-badge--success {
  background: color-mix(in srgb, var(--color-success, #22c55e) 15%, transparent);
  color: var(--color-success, #22c55e);
  border: 1px solid color-mix(in srgb, var(--color-success, #22c55e) 30%, transparent);
}

.base-badge--warning {
  background: color-mix(in srgb, var(--color-warning, #f59e0b) 15%, transparent);
  color: var(--color-warning, #f59e0b);
  border: 1px solid color-mix(in srgb, var(--color-warning, #f59e0b) 30%, transparent);
}

.base-badge--danger {
  background: color-mix(in srgb, var(--color-danger, #ef4444) 15%, transparent);
  color: var(--color-danger, #ef4444);
  border: 1px solid color-mix(in srgb, var(--color-danger, #ef4444) 30%, transparent);
}

.base-badge--info {
  background: color-mix(in srgb, var(--color-info, #3b82f6) 15%, transparent);
  color: var(--color-info, #3b82f6);
  border: 1px solid color-mix(in srgb, var(--color-info, #3b82f6) 30%, transparent);
}

.base-badge--accent {
  background: color-mix(in srgb, var(--color-accent) 15%, transparent);
  color: var(--color-accent);
  border: 1px solid color-mix(in srgb, var(--color-accent) 30%, transparent);
}

/* Rounded */
.base-badge--rounded {
  border-radius: var(--radius-full, 9999px);
}
</style>
