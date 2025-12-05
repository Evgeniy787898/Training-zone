<template>
  <div class="base-input-wrapper" :class="{ 'base-input-wrapper--error': error }">
    <label v-if="label" :for="id" class="base-input__label">
      {{ label }}
      <span v-if="required" class="text-danger">*</span>
    </label>
    
    <div class="base-input__container">
      <AppIcon 
        v-if="icon" 
        :name="icon" 
        class="base-input__icon"
        :size="20"
      />
      
      <input
        :id="id"
        ref="inputRef"
        :value="modelValue"
        :type="type"
        :placeholder="placeholder"
        :disabled="disabled"
        :required="required"
        :min="min"
        :max="max"
        :step="step"
        class="base-input"
        :class="[
          { 'base-input--has-icon': icon },
          { 'base-input--error': error }
        ]"
        v-bind="$attrs"
        @input="handleInput"
        @blur="$emit('blur', $event)"
        @focus="$emit('focus', $event)"
      />
      
      <div v-if="$slots.append" class="base-input__append">
        <slot name="append" />
      </div>
    </div>
    
    <p v-if="error" class="base-input__error-text">{{ error }}</p>
    <p v-else-if="hint" class="base-input__hint">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
import { useId, ref } from 'vue';
import AppIcon from '@/modules/shared/components/AppIcon.vue';
import type { IconName } from '@/modules/shared/icons/registry';

const props = withDefaults(
  defineProps<{
    modelValue: string | number | null;
    label?: string;
    placeholder?: string;
    type?: string;
    error?: string;
    hint?: string;
    icon?: IconName;
    disabled?: boolean;
    required?: boolean;
    min?: string | number;
    max?: string | number;
    step?: string | number;
    id?: string;
  }>(),
  {
    type: 'text',
    modelValue: '',
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
const inputRef = ref<HTMLInputElement | null>(null);

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', target.value);
};

defineExpose({
  focus: () => inputRef.value?.focus(),
  blur: () => inputRef.value?.blur(),
});
</script>

<style scoped>
.base-input-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  width: 100%;
}

.base-input__label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-primary);
}

.base-input__container {
  position: relative;
  display: flex;
  align-items: center;
}

.base-input {
  width: 100%;
  padding: var(--space-sm) var(--space-md);  /* 0.625rem → 0.75rem (close enough) */
  font-size: var(--font-size-base);
  line-height: 1.5;
  color: var(--color-text-primary);
  background-color: var(--color-bg);
  border: 1px solid var(--color-border); /* Thinner border by default */
  border-radius: var(--radius-md);
  transition: border-color 0.2s ease, box-shadow 0.2s ease; /* Optimized transition */
  appearance: none; /* Remove default browser styles */
}

.base-input--has-icon {
  padding-left: 2.5rem;
}

.base-input:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent-subtle); /* Ring focus */
}

.base-input:disabled {
  background-color: var(--color-bg-secondary);
  color: var(--color-text-muted);
  cursor: not-allowed;
  border-color: var(--color-border-subtle);
}

.base-input--error {
  border-color: var(--color-danger);
}

.base-input--error:focus {
  border-color: var(--color-danger);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-danger) 10%, transparent);
}

.base-input__icon {
  position: absolute;
  left: 0.75rem;
  color: var(--color-text-secondary);
  pointer-events: none;
}

.base-input__append {
  position: absolute;
  right: 0.75rem;
  display: flex;
  align-items: center;
}

.base-input__error-text {
  font-size: var(--font-size-xs);
  color: var(--color-danger);
  margin: 0;
}

.base-input__hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin: 0;
}

.text-danger {
  color: var(--color-danger);
}
</style>
