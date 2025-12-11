<template>
  <div class="base-input" :class="inputClasses">
    <label v-if="label" :for="inputId" class="base-input__label">
      {{ label }}
      <span v-if="required" class="base-input__required">*</span>
    </label>
    <div class="base-input__wrapper">
      <span v-if="$slots.prefix" class="base-input__prefix">
        <slot name="prefix" />
      </span>
      <input
        :id="inputId"
        ref="inputRef"
        class="base-input__field"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :required="required"
        :autocomplete="autocomplete"
        @input="handleInput"
        @focus="focused = true"
        @blur="focused = false"
      />
      <span v-if="$slots.suffix" class="base-input__suffix">
        <slot name="suffix" />
      </span>
    </div>
    <p v-if="error" class="base-input__error">{{ error }}</p>
    <p v-else-if="hint" class="base-input__hint">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
/**
 * BaseInput - Reusable input component
 * Part of UI-001: Расширить атомарные компоненты
 */
import { ref, computed, useId } from 'vue';
import { hapticLight } from '@/utils/hapticFeedback';

const props = withDefaults(defineProps<{
  modelValue?: string | number;
  label?: string;
  placeholder?: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  error?: string;
  hint?: string;
  autocomplete?: string;
}>(), {
  type: 'text',
  modelValue: '',
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const inputId = useId();
const inputRef = ref<HTMLInputElement | null>(null);
const focused = ref(false);

const inputClasses = computed(() => ({
  'base-input--focused': focused.value,
  'base-input--disabled': props.disabled,
  'base-input--error': !!props.error,
}));

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', target.value);
};

const focus = () => {
  hapticLight();
  inputRef.value?.focus();
};

defineExpose({ focus, inputRef });
</script>

<style scoped>
.base-input {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs, 0.5rem);
}

.base-input__label {
  font-size: var(--font-size-sm, 0.875rem);
  font-weight: 500;
  color: var(--color-text-primary);
}

.base-input__required {
  color: var(--color-danger, #ef4444);
  margin-left: 2px;
}

.base-input__wrapper {
  display: flex;
  align-items: center;
  gap: var(--space-xs, 0.5rem);
  padding: 0 var(--space-sm, 0.75rem);
  background: var(--color-bg-secondary);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md, 12px);
  transition: all 0.2s ease;
}

.base-input--focused .base-input__wrapper {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 20%, transparent);
}

.base-input--error .base-input__wrapper {
  border-color: var(--color-danger, #ef4444);
}

.base-input--disabled .base-input__wrapper {
  opacity: 0.5;
  cursor: not-allowed;
}

.base-input__field {
  flex: 1;
  padding: var(--space-sm, 0.75rem) 0;
  background: transparent;
  border: none;
  outline: none;
  font-family: inherit;
  font-size: var(--font-size-base, 1rem);
  color: var(--color-text-primary);
}

.base-input__field::placeholder {
  color: var(--color-text-muted);
}

.base-input__field:disabled {
  cursor: not-allowed;
}

.base-input__prefix,
.base-input__suffix {
  display: flex;
  align-items: center;
  color: var(--color-text-secondary);
}

.base-input__error {
  margin: 0;
  font-size: var(--font-size-sm, 0.875rem);
  color: var(--color-danger, #ef4444);
}

.base-input__hint {
  margin: 0;
  font-size: var(--font-size-sm, 0.875rem);
  color: var(--color-text-muted);
}
</style>
