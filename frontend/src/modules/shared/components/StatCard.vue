<template>
<article
    class="stat-card"
    :data-intent="intent"
    :data-size="size"
    :data-variant="variant"
    :data-accent="accent"
    data-surface-interactive="fine"
  >
    <header v-if="hasHeader" class="stat-card__header">
      <div v-if="hasIcon" class="stat-card__icon">
        <slot name="icon">
          <AppIcon :name="icon as IconName" :size="28" variant="aqua" tone="ghost" />
        </slot>
      </div>
      <div class="stat-card__meta">
        <p class="stat-card__label">{{ label }}</p>
        <div v-if="hint || tooltip" class="stat-card__hint-row">
          <p v-if="hint" class="stat-card__hint">{{ hint }}</p>
          <Tooltip
            v-if="tooltip"
            :text="tooltip"
            class="stat-card__hint-tooltip"
          >
            <AppIcon name="info" variant="aqua" tone="ghost" :size="18" />
          </Tooltip>
        </div>
      </div>
    </header>

    <div class="stat-card__value-row">
      <span class="stat-card__value">{{ formattedValue }}</span>
      <span v-if="unit" class="stat-card__unit">{{ unit }}</span>
      <slot name="value" />
    </div>

    <footer v-if="showTrend" class="stat-card__trend">
      <span class="trend-badge" :data-direction="trendDirection">
        {{ trendValue }}
      </span>
      <span class="stat-card__trend-label">{{ trendLabel }}</span>
    </footer>

    <slot />
  </article>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue';
import AppIcon from './AppIcon.vue';
import Tooltip from './Tooltip.vue';
import type { IconName } from '../icons/registry';

type TrendDirection = 'up' | 'down' | 'neutral';

type Intent = 'default' | 'success' | 'warning' | 'danger';
type Accent = 'primary' | 'info' | 'success' | 'warning' | 'danger';

interface Props {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  tooltip?: string;
  icon?: IconName;
  intent?: Intent;
  size?: 'md' | 'lg';
  variant?: 'surface' | 'gradient';
  accent?: Accent;
  trendValue?: string;
  trendLabel?: string;
  trendDirection?: TrendDirection;
}

const props = withDefaults(defineProps<Props>(), {
  unit: undefined,
  hint: undefined,
  tooltip: undefined,
  icon: undefined,
  intent: 'default',
  size: 'md',
  variant: 'surface',
  accent: 'primary',
  trendValue: undefined,
  trendLabel: undefined,
  trendDirection: 'neutral',
});

const slots = useSlots();

const formattedValue = computed(() => {
  if (typeof props.value === 'number') {
    return new Intl.NumberFormat('ru-RU').format(props.value);
  }
  return props.value;
});

const hasIcon = computed(() => Boolean(props.icon) || Boolean(slots.icon));
const hasHeader = computed(() => hasIcon.value || Boolean(props.hint) || Boolean(props.tooltip));
const showTrend = computed(() => Boolean(props.trendValue) || Boolean(props.trendLabel));
</script>

<style scoped>
.stat-card {
  --stat-card-accent: var(--color-accent);
  --stat-card-gradient: linear-gradient(135deg, var(--color-accent), var(--color-accent-hover));
  position: relative;
  border-radius: var(--radius-2xl, 1.25rem);
  padding: clamp(1rem, 2vw, 1.35rem);
  background:
    linear-gradient(var(--color-bg-elevated), var(--color-bg-elevated)) padding-box,
    linear-gradient(130deg, color-mix(in srgb, var(--stat-card-accent) 70%, transparent), transparent) border-box;
  border: 1px solid transparent;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  box-shadow: 0 18px 30px rgba(0, 0, 0, 0.35);
}

.stat-card[data-variant='gradient'] {
  background: var(--stat-card-gradient);
  border-color: color-mix(in srgb, rgba(255, 255, 255, 0.65) 35%, transparent);
  box-shadow: 0 25px 45px rgba(11, 15, 32, 0.45);
}

.stat-card[data-variant='gradient'] .stat-card__label,
.stat-card[data-variant='gradient'] .stat-card__hint,
.stat-card[data-variant='gradient'] .stat-card__unit,
.stat-card[data-variant='gradient'] .stat-card__trend-label {
  color: rgba(255, 255, 255, 0.78);
}

.stat-card[data-variant='gradient'] .stat-card__value {
  color: #fff;
}

.stat-card[data-variant='gradient'] .stat-card__icon {
  background: rgba(255, 255, 255, 0.18);
}

.stat-card[data-variant='gradient'] .trend-badge {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.stat-card[data-variant='gradient'] .trend-badge[data-direction='down'] {
  background: color-mix(in srgb, var(--color-danger) 35%, transparent);
  color: #fff;
}

.stat-card[data-variant='gradient'] .trend-badge[data-direction='up'] {
  background: color-mix(in srgb, var(--color-success) 35%, transparent);
  color: #fff;
}

.stat-card[data-variant='gradient'][data-accent='info'] {
  --stat-card-gradient: linear-gradient(135deg, var(--color-info), color-mix(in srgb, var(--color-info) 70%, var(--color-bg)));
}

.stat-card[data-variant='gradient'][data-accent='success'] {
  --stat-card-gradient: linear-gradient(135deg, var(--color-success), color-mix(in srgb, var(--color-success) 55%, var(--color-bg)));
}

.stat-card[data-variant='gradient'][data-accent='warning'] {
  --stat-card-gradient: linear-gradient(135deg, var(--color-warning), color-mix(in srgb, var(--color-warning) 60%, var(--color-bg)));
}

.stat-card[data-variant='gradient'][data-accent='danger'] {
  --stat-card-gradient: linear-gradient(135deg, var(--color-danger), color-mix(in srgb, var(--color-danger) 60%, var(--color-bg)));
}

.stat-card[data-intent='success'] {
  --stat-card-accent: var(--color-success);
}

.stat-card[data-intent='warning'] {
  --stat-card-accent: var(--color-warning);
}

.stat-card[data-intent='danger'] {
  --stat-card-accent: var(--color-danger);
}

.stat-card[data-size='lg'] {
  padding-block: clamp(1.25rem, 2.5vw, 1.75rem);
}

.stat-card__header {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.stat-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  inline-size: 2.5rem;
  block-size: 2.5rem;
  border-radius: 0.85rem;
  background: color-mix(in srgb, var(--stat-card-accent) 15%, transparent);
}

.stat-card__meta {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.stat-card__hint-row {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.stat-card__hint-tooltip :deep(.app-icon) {
  cursor: help;
}

.stat-card__label {
  font-size: var(--font-size-sm, 0.95rem);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-secondary);
}

.stat-card__hint {
  font-size: var(--font-size-xs, 0.85rem);
  color: color-mix(in srgb, var(--color-text-secondary) 75%, transparent);
}

.stat-card__value-row {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.stat-card__value {
  font-size: clamp(1.8rem, 3.2vw, 2.6rem);
  font-weight: 700;
  line-height: 1;
  color: var(--color-text-primary);
}

.stat-card__unit {
  font-size: var(--font-size-base, 1rem);
  color: var(--color-text-secondary);
}

.stat-card__trend {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: var(--font-size-sm, 0.95rem);
  color: var(--color-text-secondary);
}

.trend-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.8rem;
  border-radius: 999px;
  font-size: var(--font-size-xs, 0.85rem);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  background: color-mix(in srgb, var(--stat-card-accent) 25%, transparent);
  color: var(--stat-card-accent);
}

.trend-badge[data-direction='down'] {
  background: color-mix(in srgb, var(--color-danger) 18%, transparent);
  color: var(--color-danger);
}

.trend-badge[data-direction='up'] {
  background: color-mix(in srgb, var(--color-success) 20%, transparent);
  color: var(--color-success);
}
</style>
