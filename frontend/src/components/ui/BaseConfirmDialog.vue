<template>
  <ModalDialog
    v-model="modelValue"
    :title="title"
    :icon="icon"
    :icon-variant="iconVariant"
    size="sm"
    :persistent="loading"
  >
    <p class="confirm-dialog__message">{{ message }}</p>
    
    <template #footer>
      <BaseButton
        variant="ghost"
        :disabled="loading"
        @click="handleCancel"
      >
        {{ cancelLabel }}
      </BaseButton>
      <BaseButton
        :variant="confirmVariant"
        :loading="loading"
        @click="handleConfirm"
      >
        {{ confirmLabel }}
      </BaseButton>
    </template>
  </ModalDialog>
</template>

<script setup lang="ts">
/**
 * BaseConfirmDialog - Confirmation dialog component
 * COMP-06: Подтверждение действий
 */
import ModalDialog from '@/modules/shared/components/ModalDialog.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import type { IconName } from '@/modules/shared/icons/registry';

withDefaults(
  defineProps<{
    modelValue: boolean;
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    confirmVariant?: 'primary' | 'danger' | 'ghost';
    icon?: IconName;
    iconVariant?: 'lime' | 'emerald' | 'violet' | 'amber' | 'aqua' | 'neutral';
    loading?: boolean;
  }>(),
  {
    title: 'Подтверждение',
    confirmLabel: 'Подтвердить',
    cancelLabel: 'Отмена',
    confirmVariant: 'primary',
    loading: false,
  }
);

const emit = defineEmits<{
  'update:modelValue': [boolean];
  'confirm': [];
  'cancel': [];
}>();

const handleConfirm = () => {
  emit('confirm');
};

const handleCancel = () => {
  emit('update:modelValue', false);
  emit('cancel');
};
</script>

<style scoped>
.confirm-dialog__message {
  margin: 0;
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  line-height: 1.6;
}
</style>
