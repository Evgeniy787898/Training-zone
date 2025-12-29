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
import { computed, h } from 'vue';

interface Props {
  name: string;
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

const iconSvg = computed(() => {
  const icons: Record<string, any> = {
    pulse: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' }, [
      h('polyline', { points: '3 13 7 13 10 5 14 19 17 13 21 13', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
    ]),
    crescent: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' }, [
      h('path', { d: 'M14.5 3a8.5 8.5 0 1 0 0 18 7 7 0 0 1-6.5-9.5A7 7 0 0 1 14.5 3Z', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
    ]),
    target: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6' }, [
      h('circle', { cx: '12', cy: '12', r: '8' }),
      h('circle', { cx: '12', cy: '12', r: '3' }),
      h('path', { d: 'M12 4v2M20 12h-2M12 20v-2M6 12H4', 'stroke-linecap': 'round' }),
    ]),
    rocket: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4' }, [
      h('path', { d: 'M12 3c3.5 0 5.5 2 5.5 5.5S14 18 12 21c-2-3-5.5-8.5-5.5-12.5S8.5 3 12 3Z', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
      h('circle', { cx: '12', cy: '9', r: '1.5', 'stroke-width': '1.2' }),
      h('path', { d: 'M9.5 14.5 5 19l4.5-1 2 3 2-3 4.5 1-4.5-4.5', 'stroke-width': '1.2', 'stroke-linecap': 'round' }),
    ]),
    trophy: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4' }, [
      h('path', { d: 'M7 4h10v3a5 5 0 0 1-5 5 5 5 0 0 1-5-5V4Z', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
      h('path', { d: 'M9 12v2a3 3 0 0 0 3 3 3 3 0 0 0 3-3v-2', 'stroke-linecap': 'round' }),
      h('path', { d: 'M10 17h4v3h-4Z', 'stroke-linejoin': 'round' }),
    ]),
    chart: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6' }, [
      h('path', { d: 'M5 5v14h14', 'stroke-linecap': 'round' }),
      h('rect', { x: '8', y: '11', width: '2.5', height: '5', rx: '1', fill: 'currentColor' }),
      h('rect', { x: '12', y: '8', width: '2.5', height: '8', rx: '1', fill: 'currentColor' }),
      h('rect', { x: '16', y: '6', width: '2.5', height: '10', rx: '1', fill: 'currentColor' }),
    ]),
    lightbulb: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6' }, [
      h('path', { d: 'M9 21h6M12 3a5 5 0 0 1 5 5c0 3-1 4-1 4H8s-1-1-1-4a5 5 0 0 1 5-5Z', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
    ]),
    info: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6' }, [
      h('circle', { cx: '12', cy: '12', r: '8' }),
      h('path', { d: 'M12 10v5', 'stroke-linecap': 'round' }),
      h('circle', { cx: '12', cy: '8', r: '1', fill: 'currentColor' }),
    ]),
    'check-circle': () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6' }, [
      h('path', { d: 'M22 11.08V12a10 10 0 1 1-5.93-9.14', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
      h('polyline', { points: '22 4 12 14.01 9 11.01', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
    ]),
    'alert-circle': () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6' }, [
      h('circle', { cx: '12', cy: '12', r: '10' }),
      h('line', { x1: '12', y1: '8', x2: '12', y2: '12' }),
      h('line', { x1: '12', y1: '16', x2: '12.01', y2: '16' }),
    ]),
    'alert-triangle': () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6' }, [
      h('path', { d: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
      h('line', { x1: '12', y1: '9', x2: '12', y2: '13', 'stroke-linecap': 'round' }),
      h('line', { x1: '12', y1: '17', x2: '12.01', y2: '17', 'stroke-linecap': 'round' }),
    ]),
    close: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
      h('line', { x1: '18', y1: '6', x2: '6', y2: '18', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
      h('line', { x1: '6', y1: '6', x2: '18', y2: '18', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
    ]),
    // add more icons as needed
  };
  return icons[props.name] || icons.pulse;
});

const iconComponent = computed(() => {
  return iconSvg.value;
});
</script>
<style scoped>
.neon-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  inline-size: var(--icon-size);
  block-size: var(--icon-size);
  border-radius: var(--radius-md);
  background: var(--color-bg-tertiary);
  box-shadow: var(--shadow-sm);
  transition: var(--transition-base);
  border: 1px solid var(--color-border);
}

.neon-icon__svg {
  inline-size: 60%;
  block-size: 60%;
}

.neon-icon--lime {
  color: var(--color-success);
  background: color-mix(in srgb, var(--color-success) 10%, var(--color-bg-tertiary));
  border-color: color-mix(in srgb, var(--color-success) 20%, transparent);
}

.neon-icon--emerald {
  color: var(--color-success);
  background: color-mix(in srgb, var(--color-success) 10%, var(--color-bg-tertiary));
  border-color: color-mix(in srgb, var(--color-success) 20%, transparent);
}

.neon-icon--violet {
  color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 10%, var(--color-bg-tertiary));
  border-color: color-mix(in srgb, var(--color-accent) 20%, transparent);
}

.neon-icon--amber {
  color: var(--color-warning);
  background: color-mix(in srgb, var(--color-warning) 10%, var(--color-bg-tertiary));
  border-color: color-mix(in srgb, var(--color-warning) 20%, transparent);
}

.neon-icon--aqua {
  color: var(--color-info);
  background: color-mix(in srgb, var(--color-info) 10%, var(--color-bg-tertiary));
  border-color: color-mix(in srgb, var(--color-info) 20%, transparent);
}

.neon-icon--neutral {
  color: var(--color-text-secondary);
  background: var(--color-bg-tertiary);
  border-color: var(--color-border);
}
</style>
