<template>
  <div class="direction-flip-toggle">
    <button 
      type="button"
      :class="['flip-toggle-btn', { 'active': !modelValue }]"
      @click="$emit('update:modelValue', false)"
    >
      Направление
    </button>
    <button 
      type="button"
      :class="['flip-toggle-btn', { 'active': modelValue }]"
      @click="$emit('update:modelValue', true)"
    >
      Программы
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: boolean;
}>();

defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();
</script>

<style scoped>
/* Компактный Flip Toggle - по центру между заголовком и карточками */
.direction-flip-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-lg);
  /* Равные отступы сверху и снизу для центрирования */
  margin: var(--space-lg) auto var(--space-lg) auto;
  padding: 0;
}

.flip-toggle-btn {
  padding: var(--space-xs) var(--space-lg);
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  font-family: var(--font-family-base, 'Inter', sans-serif);
  font-size: 0.9375rem;
  font-weight: 500;
  border-radius: 0;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
  position: relative;
  border-bottom: 2px solid transparent;
}

.flip-toggle-btn.active {
  color: var(--color-accent);
  background: transparent;
  border-bottom-color: var(--color-accent);
}

.flip-toggle-btn:hover:not(.active) {
  color: var(--color-text-primary);
}

@media (max-width: 768px) {
  .direction-flip-toggle {
    margin: var(--space-md) auto var(--space-md) auto;
  }
}

@media (max-width: 480px) {
  .direction-flip-toggle {
    margin: var(--space-sm) auto var(--space-sm) auto;
  }
}
</style>
