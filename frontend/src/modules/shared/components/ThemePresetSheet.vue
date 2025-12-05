<template>
  <Teleport to="body">
    <Transition name="theme-sheet-fade">
      <div v-if="open" class="theme-sheet">
        <div class="theme-sheet__backdrop" @click="handleClose" />
        <Transition name="theme-sheet-panel">
          <section
            v-if="open"
            ref="panelRef"
            class="theme-sheet__panel"
            role="dialog"
            aria-modal="true"
            :aria-labelledby="titleId"
            :aria-describedby="descriptionId"
            tabindex="-1"
          >
            <header class="theme-sheet__header">
              <div class="theme-sheet__heading">
                <h2 :id="titleId" class="theme-sheet__title">Тема оформления</h2>
                <p :id="descriptionId" class="theme-sheet__subtitle">
                  Выберите палитру, которая лучше всего подходит под настроение.
                </p>
              </div>
              <button type="button" class="theme-sheet__close" @click="handleClose">
                <span class="visually-hidden">Закрыть окно выбора темы</span>
                <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                  <path
                    d="M6.225 4.811 4.811 6.225 10.586 12l-5.775 5.775 1.414 1.414L12 13.414l5.775 5.775 1.414-1.414L13.414 12l5.775-5.775-1.414-1.414L12 10.586 6.225 4.811Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </header>

            <ul class="theme-sheet__list">
              <li v-for="preset in presets" :key="preset.id">
                <button
                  type="button"
                  class="theme-sheet__preset"
                  :class="{ 'is-active': preset.id === currentPresetId }"
                  data-focus-target
                  @click="handleSelect(preset.id)"
                >
                  <span class="theme-sheet__swatch" :style="getSwatchStyle(preset)"></span>
                  <span class="theme-sheet__details">
                    <span class="theme-sheet__name">{{ preset.label }}</span>
                    <span class="theme-sheet__meta">{{ modeLabels[preset.mode] }}</span>
                  </span>
                  <span
                    v-if="preset.id === currentPresetId"
                    class="theme-sheet__check"
                    aria-hidden="true"
                  >
                    <svg viewBox="0 0 20 20" role="presentation" focusable="false">
                      <path
                        d="M16.707 5.293a1 1 0 0 1 0 1.414l-7.25 7.25a1 1 0 0 1-1.414 0l-3.25-3.25a1 1 0 0 1 1.414-1.414l2.543 2.543 6.543-6.543a1 1 0 0 1 1.414 0Z"
                        fill="currentColor"
                      />
                    </svg>
                  </span>
                </button>
              </li>
            </ul>

            <footer class="theme-sheet__footer">
              <p class="theme-sheet__hint">
                Поддерживается автоматическая синхронизация с системной темой, если выбор не сохранён вручную.
              </p>
            </footer>
          </section>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import type { ThemePreset, ThemePresetId } from '@/stores/app';

const props = defineProps<{
  open: boolean;
  presets: ThemePreset[];
  currentPresetId: ThemePresetId;
}>();

const emit = defineEmits<{
  (event: 'close'): void;
  (event: 'select', presetId: ThemePresetId): void;
}>();

const panelRef = ref<HTMLElement | null>(null);
const previouslyFocused = ref<HTMLElement | null>(null);
const isClient = typeof window !== 'undefined';
const titleId = 'theme-sheet-title';
const descriptionId = 'theme-sheet-description';

const modeLabels: Record<ThemePreset['mode'], string> = {
  dark: 'Тёмная палитра',
};

const handleClose = () => {
  emit('close');
};

const handleSelect = (presetId: ThemePresetId) => {
  emit('select', presetId);
};

const getSwatchStyle = (preset: ThemePreset) => {
  const accent = preset.cssVars['--gradient-accent-strong'] ?? preset.cssVars['--gradient-accent'];
  const surface = preset.cssVars['--panel-surface-gradient'] ?? preset.cssVars['--color-surface'];
  return {
    backgroundImage: `${surface}, ${accent}`,
  } as Record<string, string>;
};

const getFocusableElements = () => {
  if (!isClient || !panelRef.value) return [] as HTMLElement[];
  return Array.from(
    panelRef.value.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => !element.hasAttribute('disabled'));
};

const handleGlobalKeydown = (event: KeyboardEvent) => {
  if (!props.open) return;

  if (event.key === 'Escape') {
    event.preventDefault();
    handleClose();
    return;
  }

  if (event.key === 'Tab') {
    const focusable = getFocusableElements();
    if (!focusable.length) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (event.shiftKey) {
      if (!active || active === first || !panelRef.value?.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else if (active === last) {
      event.preventDefault();
      first.focus();
    }
  }
};

const focusPanel = () => {
  if (!isClient) return;
  nextTick(() => {
    const target =
      panelRef.value?.querySelector<HTMLElement>('[data-focus-target]') ?? panelRef.value;
    target?.focus();
  });
};

const toggleGlobalListeners = (shouldAttach: boolean) => {
  if (!isClient) return;
  const root = document.documentElement;
  if (shouldAttach) {
    window.addEventListener('keydown', handleGlobalKeydown);
    root.classList.add('is-theme-sheet-open');
  } else {
    window.removeEventListener('keydown', handleGlobalKeydown);
    root.classList.remove('is-theme-sheet-open');
  }
};

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      previouslyFocused.value = isClient ? (document.activeElement as HTMLElement | null) : null;
      focusPanel();
      toggleGlobalListeners(true);
    } else {
      toggleGlobalListeners(false);
      previouslyFocused.value?.focus?.();
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  toggleGlobalListeners(false);
});
</script>

<style scoped>
.theme-sheet-fade-enter-active,
.theme-sheet-fade-leave-active {
  transition: opacity 0.2s ease;
}

.theme-sheet-fade-enter-from,
.theme-sheet-fade-leave-to {
  opacity: 0;
}

.theme-sheet-panel-enter-active,
.theme-sheet-panel-leave-active {
  transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease;
}

.theme-sheet-panel-enter-from,
.theme-sheet-panel-leave-to {
  opacity: 0;
  transform: translateY(16px);
}

.theme-sheet {
  position: fixed;
  inset: 0;
  z-index: 400;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 1.5rem 1rem 2.5rem;
}

.theme-sheet__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(18px);
}

.theme-sheet__panel {
  position: relative;
  width: min(480px, 100%);
  max-height: min(520px, 100%);
  padding: 1.5rem;
  background: var(--panel-surface-base, var(--color-bg-elevated));
  background-image: var(--panel-surface-gradient, var(--gradient-surface));
  border-radius: 24px;
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  overflow: hidden;
}

.theme-sheet__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.theme-sheet__heading {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.theme-sheet__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text-primary);
}

.theme-sheet__subtitle {
  margin: 0;
  font-size: 0.95rem;
  color: var(--color-text-secondary);
}

.theme-sheet__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1px solid var(--color-border);
  background: var(--color-surface-glass);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: var(--transition-fast);
}

.theme-sheet__close:hover {
  color: var(--color-text-primary);
  border-color: var(--color-border-strong);
  background: var(--color-surface-hover);
}

.theme-sheet__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.75rem;
}

.theme-sheet__preset {
  width: 100%;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 1rem;
  padding: 0.9rem 1rem;
  border-radius: 18px;
  border: 1px solid transparent;
  background: var(--color-surface-glass);
  color: var(--color-text-primary);
  text-align: left;
  cursor: pointer;
  transition: transform var(--transition-fast),
    box-shadow var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast);
  box-shadow: var(--shadow-xs);
  position: relative;
  overflow: hidden;
  --pointer-x: 0;
  --pointer-y: 0;
  --pointer-strength: 0;
  --pointer-active: 0;
  --surface-accent: var(--color-accent);
  will-change: transform, box-shadow;
}

.theme-sheet__preset:hover {
  box-shadow: var(--shadow-sm);
  border-color: var(--color-border);
  --pointer-active: 1;
}

.theme-sheet__preset:focus-visible {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 32%, transparent), var(--shadow-sm);
  --pointer-active: 1;
}

.theme-sheet__preset.is-active {
  border-color: var(--color-accent);
  box-shadow: var(--shadow-md);
  background: var(--gradient-accent);
  --surface-accent: var(--color-accent);
}

.theme-sheet__preset::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background: radial-gradient(
    circle at calc(50% + var(--pointer-x) * 40%) calc(50% + var(--pointer-y) * 40%),
    color-mix(in srgb, var(--surface-accent) calc(var(--pointer-strength) * 34%), transparent) 0%,
    transparent 70%
  );
  opacity: calc(var(--pointer-active) * var(--pointer-strength) * 0.38);
  transition: opacity 0.24s ease;
}

.theme-sheet__preset[data-surface-interactive='coarse'] {
  transform: translate3d(
      calc(var(--pointer-x) * -3px),
      calc(var(--pointer-strength) * -6px),
      0
    );
  box-shadow: 0 16px 28px color-mix(
      in srgb,
      var(--color-text-primary) calc(10% + var(--pointer-strength) * 18%),
      transparent
    );
}

.theme-sheet__preset[data-surface-interactive='coarse']::after {
  opacity: calc(var(--pointer-active) * var(--pointer-strength) * 0.32);
}

@media (hover: hover) and (pointer: fine) {
  .theme-sheet__preset {
    transform: perspective(1100px)
      rotateX(calc(var(--pointer-y) * -2deg))
      rotateY(calc(var(--pointer-x) * 2.6deg))
      translate3d(0, calc(var(--pointer-strength) * -4px), 0);
  }
}

.theme-sheet__swatch {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  border: 1px solid var(--color-border-subtle);
  background-size: cover;
  background-position: center;
}

.theme-sheet__details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.theme-sheet__name {
  font-weight: 600;
  font-size: 1.05rem;
  color: var(--color-text-primary);
}

.theme-sheet__meta {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.theme-sheet__check {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-accent);
  background: var(--color-accent-light);
  border-radius: 50%;
}

.theme-sheet__footer {
  margin-top: auto;
}

.theme-sheet__hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 640px) {
  .theme-sheet {
    align-items: flex-end;
    padding: 1rem 0.5rem 1.5rem;
  }

  .theme-sheet__panel {
    width: 100%;
    border-radius: 20px 20px 12px 12px;
  }
}
</style>
