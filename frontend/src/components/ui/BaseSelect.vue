<template>
  <div class="base-select-wrapper" :class="{ 'base-select-wrapper--error': error }">
    <label v-if="label" :for="id" class="base-select__label">
      {{ label }}
      <span v-if="required" class="text-danger">*</span>
    </label>
    
    <div class="base-select__container">
      <select
        :id="id"
        ref="selectRef"
        :value="modelValue"
        :disabled="disabled"
        :required="required"
        class="base-select"
        :class="{ 'base-select--error': error, 'base-select--placeholder': !modelValue }"
        v-bind="$attrs"
        @change="handleChange"
        @blur="$emit('blur', $event)"
        @focus="$emit('focus', $event)"
      >
        <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
        <option
          v-for="option in options"
          :key="getOptionValue(option)"
          :value="getOptionValue(option)"
        >
          {{ getOptionLabel(option) }}
        </option>
      </select>
      
      <div class="base-select__arrow">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </div>
    
    <p v-if="error" class="base-select__error-text">{{ error }}</p>
    <p v-else-if="hint" class="base-select__hint">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
import { useId, ref } from 'vue';

export interface SelectOption {
  value: string | number;
  label: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: string | number | null;
    options: (string | number | SelectOption)[];
    label?: string;
    placeholder?: string;
    error?: string;
    hint?: string;
    disabled?: boolean;
    required?: boolean;
    id?: string;
  }>(),
  {
    modelValue: null,
    disabled: false,
    required: false,
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: string | number];
  'blur': [event: FocusEvent];
  'focus': [event: FocusEvent];
}>();

const id = props.id || useId();
const selectRef = ref<HTMLSelectElement | null>(null);

const getOptionValue = (option: string | number | SelectOption): string | number => {
  if (typeof option === 'object') return option.value;
  return option;
};

const getOptionLabel = (option: string | number | SelectOption): string => {
  if (typeof option === 'object') return option.label;
  return String(option);
};

const handleChange = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  emit('update:modelValue', target.value);
};

defineExpose({
  focus: () => selectRef.value?.focus(),
  blur: () => selectRef.value?.blur(),
});
</script>

<style scoped>
.base-select-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  width: 100%;
}

.base-select__label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-primary);
}

.base-select__container {
  position: relative;
  display: flex;
  align-items: center;
}

.base-select {
  width: 100%;
  padding: var(--space-sm) var(--space-xl) var(--space-sm) var(--space-md);
  font-size: var(--font-size-base);
  line-height: 1.5;
  color: var(--color-text-primary);
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  appearance: none;
  cursor: pointer;
}

.base-select--placeholder {
  color: var(--color-text-muted);
}

.base-select:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent-subtle);
}

.base-select:disabled {
  background-color: var(--color-bg-secondary);
  color: var(--color-text-muted);
  cursor: not-allowed;
  border-color: var(--color-border-subtle);
}

.base-select--error {
  border-color: var(--color-danger);
}

.base-select--error:focus {
  border-color: var(--color-danger);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-danger) 10%, transparent);
}

.base-select__arrow {
  position: absolute;
  right: 0.75rem;
  color: var(--color-text-secondary);
  pointer-events: none;
  display: flex;
  align-items: center;
}

.base-select__error-text {
  font-size: var(--font-size-xs);
  color: var(--color-danger);
  margin: 0;
}

.base-select__hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin: 0;
}

.text-danger {
  color: var(--color-danger);
}
</style>
