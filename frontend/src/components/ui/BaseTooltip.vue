<template>
  <div 
    class="base-tooltip-wrapper"
    @mouseenter="showTooltip"
    @mouseleave="hideTooltip"
    @focusin="showTooltip"
    @focusout="hideTooltip"
  >
    <slot />
    
    <Transition name="tooltip-fade">
      <div 
        v-if="visible && content"
        class="base-tooltip"
        :class="[`base-tooltip--${position}`]"
        role="tooltip"
        :id="tooltipId"
      >
        <span class="base-tooltip__content">{{ content }}</span>
        <span class="base-tooltip__arrow" />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
/**
 * BaseTooltip - Hover/focus tooltip component
 * COMP-05: Hover/focus tooltips
 */
import { ref, useId } from 'vue';

const props = withDefaults(
  defineProps<{
    content: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
    delay?: number;
  }>(),
  {
    position: 'top',
    delay: 300,
  }
);

const visible = ref(false);
const tooltipId = useId();
let showTimeout: ReturnType<typeof setTimeout> | null = null;

const showTooltip = () => {
  if (showTimeout) clearTimeout(showTimeout);
  showTimeout = setTimeout(() => {
    visible.value = true;
  }, props.delay);
};

const hideTooltip = () => {
  if (showTimeout) clearTimeout(showTimeout);
  visible.value = false;
};
</script>

<style scoped>
.base-tooltip-wrapper {
  position: relative;
  display: inline-flex;
}

.base-tooltip {
  position: absolute;
  z-index: var(--z-tooltip, 1500);
  padding: 6px 10px;
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: var(--color-text-primary);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
  white-space: nowrap;
  pointer-events: none;
}

.base-tooltip__content {
  display: block;
}

.base-tooltip__arrow {
  position: absolute;
  width: 8px;
  height: 8px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  transform: rotate(45deg);
}

/* Position: Top */
.base-tooltip--top {
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
}

.base-tooltip--top .base-tooltip__arrow {
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%) rotate(45deg);
  border-top: none;
  border-left: none;
}

/* Position: Bottom */
.base-tooltip--bottom {
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
}

.base-tooltip--bottom .base-tooltip__arrow {
  top: -5px;
  left: 50%;
  transform: translateX(-50%) rotate(45deg);
  border-bottom: none;
  border-right: none;
}

/* Position: Left */
.base-tooltip--left {
  right: calc(100% + 8px);
  top: 50%;
  transform: translateY(-50%);
}

.base-tooltip--left .base-tooltip__arrow {
  right: -5px;
  top: 50%;
  transform: translateY(-50%) rotate(45deg);
  border-left: none;
  border-bottom: none;
}

/* Position: Right */
.base-tooltip--right {
  left: calc(100% + 8px);
  top: 50%;
  transform: translateY(-50%);
}

.base-tooltip--right .base-tooltip__arrow {
  left: -5px;
  top: 50%;
  transform: translateY(-50%) rotate(45deg);
  border-right: none;
  border-top: none;
}

/* Transition */
.tooltip-fade-enter-active,
.tooltip-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.tooltip-fade-enter-from,
.tooltip-fade-leave-to {
  opacity: 0;
}

.tooltip-fade-enter-from.base-tooltip--top,
.tooltip-fade-leave-to.base-tooltip--top {
  transform: translateX(-50%) translateY(4px);
}

.tooltip-fade-enter-from.base-tooltip--bottom,
.tooltip-fade-leave-to.base-tooltip--bottom {
  transform: translateX(-50%) translateY(-4px);
}
</style>
