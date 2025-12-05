<template>
  <component 
    :is="tag"
    class="base-card"
    :class="[
      `base-card--padding-${padding}`,
      { 'base-card--flat': flat },
      { 'base-card--hoverable': hoverable }
    ]"
  >
    <header v-if="$slots.header || title" class="base-card__header">
      <slot name="header">
        <h3 v-if="title" class="base-card__title">{{ title }}</h3>
        <p v-if="subtitle" class="base-card__subtitle">{{ subtitle }}</p>
      </slot>
    </header>
    
    <div class="base-card__content">
      <slot />
    </div>
    
    <footer v-if="$slots.footer" class="base-card__footer">
      <slot name="footer" />
    </footer>
  </component>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string;
    subtitle?: string;
    padding?: 'none' | 'sm' | 'md' | 'lg';
    flat?: boolean;
    hoverable?: boolean;
    tag?: string;
  }>(),
  {
    padding: 'md',
    flat: false,
    hoverable: false,
    tag: 'div',
  }
);
</script>

<style scoped>
.base-card {
  background-color: var(--color-bg-secondary);
  border: 1px solid transparent; /* Default no border for cleaner look, or use var(--color-border-subtle) */
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.base-card--flat {
  box-shadow: none;
  background-color: transparent;
  border-color: transparent;
}

.base-card--hoverable:hover {
  border-color: var(--color-border-subtle);
  background-color: var(--color-bg-elevated);
  box-shadow: var(--shadow-sm);
  transform: translateY(-1px);
}

/* Padding variants */
.base-card--padding-none .base-card__content { padding: 0; }
.base-card--padding-sm .base-card__content { padding: var(--space-sm); }
.base-card--padding-md .base-card__content { padding: var(--space-md); }
.base-card--padding-lg .base-card__content { padding: var(--space-lg); }

.base-card__header {
  padding: var(--space-md) var(--space-md) 0;
  margin-bottom: var(--space-sm);
}

.base-card__title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
  line-height: 1.3;
}

.base-card__subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: var(--space-2xs) 0 0;
}

.base-card__footer {
  padding: var(--space-sm) var(--space-md);
  border-top: 1px solid var(--color-border-subtle);
  background-color: color-mix(in srgb, var(--color-surface) 50%, transparent);
}
</style>
