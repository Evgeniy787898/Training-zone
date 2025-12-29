<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="modelValue"
        ref="modalRoot"
        class="app-modal"
        role="presentation"
        tabindex="-1"
        @keydown.esc.stop.prevent="handleEscape"
      >
        <div class="app-modal__backdrop" @click="handleBackdropClick" />
        <div
          class="app-modal__dialog elevation-5"
          :class="dialogClasses"
          role="dialog"
          :aria-modal="true"
          :aria-labelledby="titleId"
        >
          <header v-if="$slots.header || title" class="app-modal__header">
            <slot name="header">
              <div class="app-modal__title-group">
                <!-- <AppIcon v-if="icon" :name="icon" :variant="iconVariant" :size="28" /> -->
                <p v-if="eyebrow" class="app-modal__eyebrow">{{ eyebrow }}</p>
                <h2 v-if="title" :id="titleId" class="app-modal__title">{{ title }}</h2>
              </div>
            </slot>
            <BaseButton
              v-if="!persistent && !hideCloseButton"
              variant="ghost"
              size="sm"
              class="app-modal__close"
              @click="close"
              :aria-label="closeLabel"
            >
              <span aria-hidden="true" class="text-xl">✕</span>
            </BaseButton>
          </header>

          <div class="app-modal__body" :class="{ 'app-modal__body--flush': bodyFlush }">
            <slot />
          </div>

          <footer v-if="$slots.footer" class="app-modal__footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue';
import BaseButton from '@/components/ui/BaseButton.vue';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title?: string;
    eyebrow?: string;
    icon?: string;
    iconVariant?: 'lime' | 'emerald' | 'violet' | 'amber' | 'aqua' | 'neutral';
    size?: 'sm' | 'md' | 'lg' | 'xl';
    persistent?: boolean;
    bodyFlush?: boolean;
    hideCloseButton?: boolean;
    closeLabel?: string;
    position?: 'center' | 'bottom';
  }>(),
  {
    size: 'md',
    iconVariant: 'aqua',
    closeLabel: 'Закрыть модальное окно',
    bodyFlush: false,
    position: 'center',
  }
);

const emit = defineEmits<{
  'update:modelValue': [boolean];
  close: [];
}>();

const titleId = useId();
const modalRoot = ref<HTMLElement | null>(null);

const dialogClasses = computed(() => [
  `app-modal__dialog--${props.size}`,
  `app-modal__dialog--${props.position}`,
  { 'app-modal__dialog--flush': props.bodyFlush },
]);

let openModals = 0;

watch(
  () => props.modelValue,
  (open) => {
    if (typeof document === 'undefined') return;
    if (open) {
      openModals += 1;
      document.body.classList.add('app-modal-open');
      requestAnimationFrame(() => {
        modalRoot.value?.focus();
      });
    } else if (openModals > 0) {
      openModals -= 1;
      if (openModals === 0) {
        document.body.classList.remove('app-modal-open');
      }
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  if (typeof document === 'undefined') return;
  if (openModals > 0) {
    openModals -= 1;
    if (openModals === 0) {
      document.body.classList.remove('app-modal-open');
    }
  }
});

const close = () => {
  if (props.persistent) return;
  emit('update:modelValue', false);
  emit('close');
};

const handleBackdropClick = () => {
  if (props.persistent) return;
  close();
};

const handleEscape = () => {
  if (props.persistent) return;
  close();
};
</script>

<style scoped>
.app-modal {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: grid;
  place-items: center;
  padding: clamp(1rem, 3vw, 2.5rem);
}

/* Bottom sheet positioning override */
.app-modal:has(.app-modal__dialog--bottom) {
  place-items: end center;
  padding: 0;
}

.app-modal__backdrop {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--color-bg) 30%, rgba(2, 6, 23, 0.85));
  backdrop-filter: blur(8px);
  animation: modal-backdrop-in 220ms ease both;
}

.app-modal__dialog {
  position: relative;
  inline-size: min(100%, 36rem);
  max-block-size: calc(100dvh - clamp(2rem, 5vh, 4rem));
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  padding: clamp(1.5rem, 1.2rem + 1vw, 2.25rem);
  border-radius: clamp(20px, 4vw, 32px);
  border: 1px solid var(--color-border-subtle);
  box-shadow: var(--shadow-xl);
  background: var(--color-bg-modal);
  color: var(--color-text-primary);
  overflow: hidden;
  animation: modal-dialog-in 240ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

/* Bottom Sheet Styles */
.app-modal__dialog--bottom {
  inline-size: 100%;
  max-inline-size: 100%; /* Full width */
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  border-bottom: none;
  margin-bottom: 0;
  animation: modal-slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.app-modal__dialog--lg {
  inline-size: min(100%, 48rem);
}

.app-modal__dialog--xl {
  inline-size: min(100%, 64rem);
}

.app-modal__dialog--sm {
  inline-size: min(100%, 28rem);
}

.app-modal__dialog--flush {
  padding: 0;
}

.app-modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
}

.app-modal__title-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.app-modal__title {
  margin: 0;
  font-size: clamp(1.25rem, 1.1rem + 0.8vw, 1.8rem);
  font-weight: 600;
  color: var(--color-text-primary);
}

.app-modal__eyebrow {
  margin: 0;
  font-size: 0.85rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
}

.app-modal__close {
  /* Override BaseButton styles for circular close button */
  width: 2.5rem !important;
  height: 2.5rem !important;
  padding: 0 !important;
  border-radius: 9999px !important;
}

.app-modal__body {
  overflow-y: auto;
  padding-block: var(--space-sm);
  padding-inline: 0;
}

.app-modal__body--flush {
  padding: 0;
}

.app-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
  padding-top: var(--space-xs);
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 200ms ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

@keyframes modal-backdrop-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes modal-dialog-in {
  from {
    opacity: 0;
    transform: translateY(24px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes modal-slide-up {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}
</style>
