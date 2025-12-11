<template>
  <label class="base-toggle" :class="{ 'base-toggle--disabled': disabled }">
    <input
      type="checkbox"
      class="base-toggle__input"
      :checked="modelValue"
      :disabled="disabled"
      @change="handleChange"
    />
    <span class="base-toggle__track">
      <span class="base-toggle__thumb" />
    </span>
    <span v-if="$slots.default || label" class="base-toggle__label">
      <slot>{{ label }}</slot>
    </span>
  </label>
</template>

<script setup lang="ts">
/**
 * BaseToggle - Reusable toggle/switch component
 * Part of UI-001: Расширить атомарные компоненты
 */
import { hapticLight } from '@/utils/hapticFeedback';

const props = defineProps<{
  modelValue?: boolean;
  label?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  change: [value: boolean];
}>();

const handleChange = (event: Event) => {
  if (props.disabled) return;
  const target = event.target as HTMLInputElement;
  hapticLight();
  emit('update:modelValue', target.checked);
  emit('change', target.checked);
};
</script>

<style scoped>
.base-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm, 0.75rem);
  cursor: pointer;
  user-select: none;
}

.base-toggle--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.base-toggle__input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.base-toggle__track {
  position: relative;
  width: 44px;
  height: 24px;
  background: var(--color-bg-tertiary, rgba(255, 255, 255, 0.1));
  border-radius: 12px;
  transition: background 0.2s ease;
  border: 1px solid var(--color-border);
}

.base-toggle__thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  background: var(--color-text-secondary);
  border-radius: 50%;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.base-toggle__input:checked + .base-toggle__track {
  background: var(--color-accent);
  border-color: var(--color-accent);
}

.base-toggle__input:checked + .base-toggle__track .base-toggle__thumb {
  left: calc(100% - 20px);
  background: var(--color-accent-contrast, #fff);
}

.base-toggle__input:focus-visible + .base-toggle__track {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.base-toggle__label {
  font-size: var(--font-size-sm, 0.875rem);
  color: var(--color-text-primary);
}
</style>
