<template>
  <span
    ref="triggerRef"
    class="tooltip"
    :aria-describedby="isVisible ? tooltipId : undefined"
    @mouseenter="show"
    @mouseleave="hide"
    @focus="show"
    @blur="hide"
    @keydown.escape.prevent="hide"
    tabindex="0"
  >
    <slot />
    <transition name="tooltip-fade">
      <span
        v-if="isVisible"
        :id="tooltipId"
        class="tooltip__content"
        role="tooltip"
      >
        <slot name="content">{{ text }}</slot>
      </span>
    </transition>
  </span>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

const props = defineProps<{ text: string }>();
const text = computed(() => props.text);

const triggerRef = ref<HTMLElement | null>(null);
const isVisible = ref(false);
const tooltipId = `tooltip-${Math.random().toString(36).slice(2, 8)}`;
let hideTimeout: number | null = null;

const show = () => {
  if (hideTimeout) {
    window.clearTimeout(hideTimeout);
    hideTimeout = null;
  }
  isVisible.value = true;
};

const hide = () => {
  hideTimeout = window.setTimeout(() => {
    isVisible.value = false;
  }, 80);
};

onMounted(() => {
  triggerRef.value?.setAttribute('data-has-tooltip', '');
});

onBeforeUnmount(() => {
  if (hideTimeout) {
    window.clearTimeout(hideTimeout);
  }
});
</script>

<style scoped>
.tooltip {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.tooltip__content {
  position: absolute;
  bottom: calc(100% + 0.35rem);
  left: 50%;
  transform: translateX(-50%);
  background: color-mix(in srgb, var(--color-surface) 90%, rgba(0, 0, 0, 0.85));
  color: var(--color-text-primary);
  padding: 0.35rem 0.55rem;
  border-radius: var(--radius-lg);
  font-size: var(--font-size-xs);
  box-shadow: var(--shadow-lg);
  white-space: nowrap;
  z-index: 30;
}

.tooltip__content::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border-width: 6px;
  border-style: solid;
  border-color: color-mix(in srgb, var(--color-surface) 90%, rgba(0, 0, 0, 0.85)) transparent transparent transparent;
}

@media (max-width: 640px) {
  .tooltip__content {
    bottom: auto;
    top: calc(100% + 0.35rem);
  }

  .tooltip__content::after {
    top: -6px;
    transform: translateX(-50%) rotate(180deg);
  }
}

.tooltip-fade-enter-from,
.tooltip-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, 4px);
}

.tooltip-fade-enter-active,
.tooltip-fade-leave-active {
  transition: var(--duration-sm) ease;
}
</style>
