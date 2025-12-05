<template>
  <div class="form-field" :class="{ 'form-field--inline': inline }">
    <div v-if="label || optional || $slots['label-extra']" class="form-field__header">
      <label v-if="label" class="form-field__label" :for="forId">{{ label }}</label>
      <div v-if="$slots['label-extra']" class="form-field__label-extra">
        <slot name="label-extra" />
      </div>
      <span v-if="optional" class="form-field__optional">Опционально</span>
    </div>
    <div class="form-field__control">
      <slot />
    </div>
    <p v-if="hint" class="form-field__hint">{{ hint }}</p>
    <p v-if="error" class="form-field__error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
interface Props {
  label?: string;
  hint?: string;
  optional?: boolean;
  error?: string | null;
  forId?: string;
  inline?: boolean;
}

withDefaults(defineProps<Props>(), {
  label: undefined,
  hint: undefined,
  optional: false,
  error: null,
  forId: undefined,
  inline: false,
});
</script>
