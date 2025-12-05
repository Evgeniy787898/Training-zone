<template>
  <component :is="tag" class="error-boundary" :key="boundaryKey">
    <slot v-if="!state.hasError" />
    <div v-else class="error-boundary__fallback" role="alert">
      <slot name="fallback" :error="state.error" :reset="reset">
        <h2 class="error-boundary__title">Возникла ошибка на экране</h2>
        <p class="error-boundary__message">
          Пожалуйста, попробуйте обновить страницу. Если проблема повторяется, сообщите в поддержку.
        </p>
        <div class="error-boundary__actions">
          <button type="button" class="error-boundary__button" @click="reset">
            Попробовать снова
          </button>
        </div>
      </slot>
    </div>
  </component>
</template>

<script setup lang="ts">
import { reactive, watch, onErrorCaptured } from 'vue';

const props = withDefaults(
  defineProps<{ tag?: string; boundaryKey?: string | number }>(),
  {
    tag: 'div',
    boundaryKey: undefined,
  },
);

const state = reactive<{ hasError: boolean; error: unknown | null }>({
  hasError: false,
  error: null,
});

const reset = () => {
  state.hasError = false;
  state.error = null;
};

watch(
  () => props.boundaryKey,
  () => {
    reset();
  },
);

onErrorCaptured((err) => {
  state.hasError = true;
  state.error = err;
  return false;
});

defineExpose({ reset });
</script>

<style scoped>
.error-boundary {
  width: 100%;
  height: 100%;
}

.error-boundary__fallback {
  padding: 32px 24px;
  display: grid;
  gap: 12px;
  border: 1px solid var(--color-border-subtle);
  border-radius: 12px;
  background: var(--color-bg-secondary);
}

.error-boundary__title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.error-boundary__message {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-muted);
}

.error-boundary__actions {
  display: flex;
  gap: 8px;
}

.error-boundary__button {
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--accent, var(--color-accent));
  color: var(--color-accent-contrast);
  border: none;
  cursor: pointer;
  font-weight: 600;
  transition: transform 120ms ease, box-shadow 120ms ease;
}

.error-boundary__button:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 22px rgba(79, 70, 229, 0.28);
}

.error-boundary__button:active {
  transform: translateY(0);
  box-shadow: none;
}
</style>
