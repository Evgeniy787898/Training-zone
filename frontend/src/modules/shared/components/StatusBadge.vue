<template>
  <span
    class="status-badge"
    :data-variant="variant"
    :data-size="size"
    :data-pill="pill"
    :data-subtle="subtle"
    role="status"
    :aria-label="ariaLabel"
  >
    <AppIcon
      v-if="resolvedIcon"
      class="status-badge__icon"
      :name="resolvedIcon"
      :data-variant="variant"
    />
    <span class="status-badge__content">
      <span class="status-badge__label">{{ label }}</span>
      <slot name="description">
        <span v-if="description" class="status-badge__description">{{ description }}</span>
      </slot>
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '@/modules/shared/components/AppIcon.vue';
import type { IconName } from '@/modules/shared/icons/registry';

export type StatusBadgeVariant = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export type StatusBadgeSize = 'md' | 'sm';

interface Props {
  label: string;
  description?: string;
  variant?: StatusBadgeVariant;
  size?: StatusBadgeSize;
  icon?: IconName | null;
  pill?: boolean;
  subtle?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  description: undefined,
  variant: 'neutral',
  size: 'md',
  icon: null,
  pill: true,
  subtle: false,
});

const VARIANT_ICONS: Record<StatusBadgeVariant, IconName> = {
  neutral: 'info',
  info: 'info',
  success: 'success',
  warning: 'alert',
  danger: 'alert',
};

const resolvedIcon = computed<IconName | null>(() => props.icon ?? VARIANT_ICONS[props.variant]);

const ariaLabel = computed(() => {
  if (props.description) {
    return `${props.label}. ${props.description}`;
  }
  return props.label;
});
</script>

<style scoped>
.status-badge {
  --status-badge-color: var(--color-text-secondary);
  --status-badge-color-strong: var(--color-text-primary);
  --status-badge-bg: color-mix(in srgb, var(--status-badge-color) 20%, transparent);
  --status-badge-border: color-mix(in srgb, var(--status-badge-color) 45%, transparent);
  display: inline-flex;
  align-items: center;
  gap: var(--space-xxs);
  padding: var(--space-xxs) var(--space-sm);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--status-badge-color-strong);
  background: var(--status-badge-bg);
  border: 1px solid var(--status-badge-border);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--status-badge-color) 20%, transparent);
  transition: var(--transition-base);
}

.status-badge[data-pill='false'] {
  border-radius: var(--radius-md);
  text-transform: none;
  letter-spacing: 0.01em;
}

.status-badge[data-size='sm'] {
  padding-block: var(--space-xxs);
  padding-inline: var(--space-xs) var(--space-sm);
  font-size: 0.72rem;
}

.status-badge[data-size='md'] {
  font-size: 0.78rem;
}

.status-badge[data-subtle='true'] {
  --status-badge-bg: color-mix(in srgb, var(--status-badge-color) 12%, transparent);
  --status-badge-border: color-mix(in srgb, var(--status-badge-color) 25%, transparent);
}

.status-badge[data-variant='info'] {
  --status-badge-color: var(--color-info);
  --status-badge-color-strong: color-mix(in srgb, var(--status-badge-color) 65%, white);
}

.status-badge[data-variant='success'] {
  --status-badge-color: var(--color-success);
  --status-badge-color-strong: color-mix(in srgb, var(--color-success) 65%, white);
}

.status-badge[data-variant='warning'] {
  --status-badge-color: var(--color-warning);
  --status-badge-color-strong: color-mix(in srgb, var(--color-warning) 65%, white);
}

.status-badge[data-variant='danger'] {
  --status-badge-color: var(--color-danger);
  --status-badge-color-strong: color-mix(in srgb, var(--color-danger) 70%, white);
}

.status-badge__content {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
}

.status-badge__label {
  white-space: nowrap;
}

.status-badge__description {
  font-size: 0.65rem;
  text-transform: none;
  letter-spacing: 0.01em;
  color: color-mix(in srgb, var(--status-badge-color-strong) 65%, var(--color-text-secondary));
}

.status-badge__icon {
  width: 1.15rem;
  height: 1.15rem;
  color: var(--status-badge-color-strong);
}

@media (max-width: 640px) {
  .status-badge {
    font-size: 0.7rem;
  }

  .status-badge__description {
    font-size: 0.62rem;
  }
}
</style>
