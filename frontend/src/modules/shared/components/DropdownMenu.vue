<template>
  <div class="dropdown" ref="containerRef">
    <button
      ref="triggerRef"
      type="button"
      class="dropdown__trigger interactive-control"
      :aria-expanded="isOpen ? 'true' : 'false'"
      aria-haspopup="menu"
      :aria-label="ariaLabel || label"
      @click="toggleMenu"
      @keydown="onTriggerKeydown"
    >
      <span class="dropdown__trigger-content">
        <slot name="trigger">
          <AppIcon
            v-if="icon"
            class="dropdown__trigger-icon"
            :name="icon"
            variant="neutral"
            :size="20"
            aria-hidden="true"
          />
          <span class="dropdown__trigger-label">{{ label }}</span>
        </slot>
      </span>
      <AppIcon name="chevronDown" :size="16" class="dropdown__chevron" aria-hidden="true" />
    </button>

    <transition name="dropdown-scale">
      <div
        v-if="isOpen"
        ref="menuRef"
        class="dropdown__menu elevation-3"
        role="menu"
        @keydown="onMenuKeydown"
      >
        <ul class="dropdown__list" role="none">
          <li v-for="item in menuItems" :key="item.id" role="none">
            <button
              type="button"
              role="menuitem"
              class="dropdown__item interactive-control"
              :class="[`dropdown__item--${item.intent ?? 'default'}`, { 'is-highlighted': highlightedItemId === item.id } ]"
              :disabled="item.disabled"
              @click="selectItem(item)"
              @mouseenter="setHighlightedById(item.id)"
            >
              <AppIcon
                v-if="item.icon"
                class="dropdown__item-icon"
                :name="item.icon"
                :variant="getIconVariant(item.intent)"
                :size="18"
                aria-hidden="true"
              />
              <div class="dropdown__item-body">
                <span class="dropdown__item-label">{{ item.label }}</span>
                <span v-if="item.description" class="dropdown__item-description">{{ item.description }}</span>
              </div>
            </button>
          </li>
          <li v-if="!menuItems.length" class="dropdown__empty" role="presentation">
            Нет доступных действий
          </li>
        </ul>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AppIcon from './AppIcon.vue';
import type { IconName } from '../icons/registry';

export type DropdownItem = {
  id: string;
  label: string;
  description?: string;
  icon?: IconName;
  disabled?: boolean;
  intent?: 'default' | 'warning' | 'danger';
  action?: () => void | Promise<void>;
};

const props = defineProps<{
  label: string;
  items: DropdownItem[];
  icon?: IconName;
  ariaLabel?: string;
}>();

const emit = defineEmits<{
  select: [DropdownItem];
}>();

const containerRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLButtonElement | null>(null);
const menuRef = ref<HTMLDivElement | null>(null);
const isOpen = ref(false);
const highlightedIndex = ref(0);

const menuItems = computed(() => props.items);
const focusableItems = computed(() => menuItems.value.filter((item) => !item.disabled));
const highlightedItemId = computed(() => focusableItems.value[highlightedIndex.value]?.id ?? null);

const focusFirstItem = () => {
  highlightedIndex.value = 0;
  if (!focusableItems.value.length) {
    return;
  }
  void nextTick(() => {
    const menu = menuRef.value;
    const buttons = menu?.querySelectorAll<HTMLButtonElement>('.dropdown__item:not(:disabled)');
    buttons?.[0]?.focus();
  });
};

const setHighlightedById = (id: string) => {
  const idx = focusableItems.value.findIndex((item) => item.id === id);
  if (idx >= 0) {
    highlightedIndex.value = idx;
  }
};

const toggleMenu = () => {
  isOpen.value = !isOpen.value;
};

const closeMenu = () => {
  isOpen.value = false;
  triggerRef.value?.focus();
};

const getIconVariant = (intent?: DropdownItem['intent']) => {
  if (intent === 'danger') return 'violet';
  if (intent === 'warning') return 'amber';
  return 'aqua';
};

const handleOutsideClick = (event: MouseEvent) => {
  if (!containerRef.value?.contains(event.target as Node)) {
    isOpen.value = false;
  }
};

const handleEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    isOpen.value = false;
    triggerRef.value?.focus();
  }
};

const onTriggerKeydown = (event: KeyboardEvent) => {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    if (!isOpen.value) {
      isOpen.value = true;
    }
    focusFirstItem();
  }
};

const onMenuKeydown = (event: KeyboardEvent) => {
  const buttons = Array.from(menuRef.value?.querySelectorAll<HTMLButtonElement>('.dropdown__item:not(:disabled)') ?? []);
  if (!buttons.length) {
    return;
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    highlightedIndex.value = (highlightedIndex.value + 1) % buttons.length;
    buttons[highlightedIndex.value]?.focus();
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    highlightedIndex.value = (highlightedIndex.value - 1 + buttons.length) % buttons.length;
    buttons[highlightedIndex.value]?.focus();
  } else if (event.key === 'Home') {
    event.preventDefault();
    highlightedIndex.value = 0;
    buttons[0]?.focus();
  } else if (event.key === 'End') {
    event.preventDefault();
    highlightedIndex.value = buttons.length - 1;
    buttons[buttons.length - 1]?.focus();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    closeMenu();
  }
};

const selectItem = async (item: DropdownItem) => {
  await item.action?.();
  emit('select', item);
  isOpen.value = false;
};

watch(isOpen, (value) => {
  if (value) {
    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    focusFirstItem();
  } else {
    document.removeEventListener('click', handleOutsideClick);
    document.removeEventListener('keydown', handleEscape);
  }
});

onMounted(() => {
  if (isOpen.value) {
    focusFirstItem();
  }
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleOutsideClick);
  document.removeEventListener('keydown', handleEscape);
});
</script>

<style scoped>
.dropdown {
  position: relative;
  display: inline-flex;
}

.dropdown__trigger {
  gap: 0.5rem;
  font-size: var(--font-size-sm);
  font-weight: 600;
  text-transform: none;
  padding: 0.45rem 0.9rem;
  border-radius: var(--radius-full);
  min-width: 0;
}

.dropdown__trigger-label {
  white-space: nowrap;
}

.dropdown__chevron {
  transition: transform var(--duration-sm) ease;
}

.dropdown__trigger[aria-expanded='true'] .dropdown__chevron {
  transform: rotate(180deg);
}

.dropdown__menu {
  position: absolute;
  top: calc(100% + 0.4rem);
  right: 0;
  min-width: 220px;
  border-radius: var(--radius-2xl);
  background: color-mix(in srgb, var(--color-surface-card) 90%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-border-subtle) 75%, transparent);
  padding: 0.4rem;
  z-index: 15;
}

.dropdown__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.dropdown__item {
  width: 100%;
  justify-content: flex-start;
  gap: 0.75rem;
  text-align: left;
  padding: 0.55rem 0.8rem;
}

.dropdown__item.is-highlighted,
.dropdown__item:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 45%, transparent);
}

.dropdown__item-icon {
  flex-shrink: 0;
}

.dropdown__item-body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.15rem;
}

.dropdown__item-label {
  font-weight: 600;
}

.dropdown__item-description {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.dropdown__item--danger {
  --interactive-control-bg: color-mix(in srgb, var(--color-danger) 12%, transparent);
  --interactive-control-border: color-mix(in srgb, var(--color-danger) 40%, transparent);
}

.dropdown__item--warning {
  --interactive-control-bg: color-mix(in srgb, var(--color-warning) 12%, transparent);
  --interactive-control-border: color-mix(in srgb, var(--color-warning) 35%, transparent);
}

.dropdown__empty {
  padding: 0.6rem 0.9rem;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.dropdown-scale-enter-from,
.dropdown-scale-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}

.dropdown-scale-enter-active,
.dropdown-scale-leave-active {
  transition: var(--duration-sm) ease;
}
</style>
