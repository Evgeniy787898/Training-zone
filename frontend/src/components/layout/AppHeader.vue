<template>
  <header 
    ref="headerRef"
    class="app-header"
    :style="headerStyle"
  >
    <div class="header-content">
      <div class="header-logo-group">
        <button
          ref="logoButtonRef"
          type="button"
          class="header-logo"
          aria-label="Train Zone: настройка акцентных цветов"
          title="Настройки темы"
          :aria-expanded="showThemeCustomizer ? 'true' : 'false'"
          aria-controls="theme-customizer"
          @click="toggleThemeCustomizer"
        >
          <span class="header-logo__brand" aria-hidden="true">
            <span class="header-logo__img"></span>
          </span>
        </button>
      </div>

      <div class="header-actions">
        <button
          type="button"
          class="header-action-btn header-action-btn--status"
          :class="{ 
            'header-action-btn--active': heroStatus === 'training',
            'header-action-btn--rest': heroStatus === 'rest'
          }"
          @click="$emit('adviceClick')"
          :aria-pressed="heroStatus === 'training' ? 'true' : 'false'"
          aria-label="Открыть совет на день"
          :title="heroStatus === 'training' ? 'День тренировки' : 'День отдыха'"
        >
          <span class="header-action-btn__date">
            <span class="header-action-btn__day">{{ currentDay }}</span>
            <span class="header-action-btn__month">{{ currentMonth }}</span>
          </span>
          <span class="header-action-btn__hover-text">
            {{ heroStatus === 'training' ? 'GO' : 'ZZZ' }}
          </span>
        </button>
      </div>
    </div>

    <!-- Theme Customizer (Full Width) -->
    <div
      v-if="showThemeCustomizer"
      ref="customizerRef"
      id="theme-customizer"
      class="header-customizer-container"
    >
      <ThemeCustomizerPopover @close="closeThemeCustomizer" />
    </div>

    <!-- Pull Indicator -->
    <div 
      ref="headerPullIndicatorRef"
      class="header-pull-indicator"
      :class="{ 'header-pull-indicator--active': isDragging }"
      @mousedown="$emit('dragStart', $event)"
      @touchstart="$emit('dragStart', $event)"
      @click="$emit('toggleHero')"
      role="button"
      :aria-expanded="heroExpanded"
      aria-label="Потяните чтобы раскрыть панель"
    >
      <div class="header-pull-indicator__bar"></div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, type CSSProperties } from 'vue';
import { createLazyComponent } from '@/utils/lazyComponent';

const ThemeCustomizerPopover = createLazyComponent(() => import('@/modules/shared/components/ThemeCustomizerPopover.vue'));

const props = defineProps<{
  heroStatus: string | null;
  heroExpanded: boolean;
  isDragging: boolean;
  headerStyle: CSSProperties;
  currentDay: string;
  currentMonth: string;
}>();

const emit = defineEmits<{
  (e: 'dragStart', event: MouseEvent | TouchEvent): void;
  (e: 'toggleHero'): void;
  (e: 'adviceClick'): void;
}>();

// Refs
const headerRef = ref<HTMLElement | null>(null);
const headerPullIndicatorRef = ref<HTMLElement | null>(null);
const logoButtonRef = ref<HTMLButtonElement | null>(null);
const customizerRef = ref<HTMLElement | null>(null);

// State
const showThemeCustomizer = ref(false);

// Methods
const closeThemeCustomizer = () => {
  showThemeCustomizer.value = false;
};

const toggleThemeCustomizer = () => {
  if (!showThemeCustomizer.value && props.heroExpanded) {
    emit('toggleHero');
  }
  showThemeCustomizer.value = !showThemeCustomizer.value;
};

const handleDocumentClick = (event: MouseEvent) => {
  if (!showThemeCustomizer.value) return;
  const target = event.target as Node | null;
  if (!target) return;
  if (
    customizerRef.value &&
    customizerRef.value.contains(target)
  ) {
    return;
  }
  if (logoButtonRef.value && logoButtonRef.value.contains(target)) {
    return;
  }
  closeThemeCustomizer();
};

const handleEscapeKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    closeThemeCustomizer();
  }
};

onMounted(() => {
  document.addEventListener('click', handleDocumentClick, true);
  document.addEventListener('keydown', handleEscapeKey);
});

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick, true);
  document.removeEventListener('keydown', handleEscapeKey);
});

// Expose refs for parent to use in useHeroPanel
defineExpose({
  headerRef,
  headerPullIndicatorRef,
  logoButtonRef,
  // Also commonly used in logic:
  closeThemeCustomizer,
  toggleThemeCustomizer
});
</script>

<style scoped>
/* Header - Sticky Navigation */
.app-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  height: var(--header-height);
  min-height: var(--header-height);
  max-height: var(--header-height);
  background: var(--panel-surface-base, var(--color-bg-elevated));
  background-image: var(--panel-surface-gradient, var(--gradient-surface));
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  backdrop-filter: saturate(180%) blur(16px);
  /* Optimization */
  will-change: transform;
  backface-visibility: hidden;
  transform: translateZ(0);
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    background-color var(--transition-base),
    border-color var(--transition-base);
  touch-action: pan-y;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  cursor: default;
  display: flex;
  flex-direction: column;
  overflow: visible;
}

.app-header:active {
  cursor: default;
}

.header-content {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 1;
  height: 100%;
  padding: 0 1.5rem;
  max-width: var(--max-width-content);
  margin: 0 auto;
  width: 100%;
  z-index: 1;
  pointer-events: auto;
  transition: padding var(--transition-base);
}

.header-content * {
  pointer-events: auto;
}

.header-logo-group {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.header-customizer-container {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 90;
}

.header-logo {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  color: #fff;
  cursor: pointer;
  line-height: 1;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.header-logo:hover {
  transform: scale(1.02);
}

.header-logo:hover .header-logo__train {
  color: var(--color-accent);
  text-shadow: 0 0 20px var(--color-accent-light);
}

.header-logo:hover .header-logo__zone {
  color: var(--color-accent-contrast);
  text-shadow: 0 0 20px var(--color-accent-light);
}

.header-logo:active {
  transform: scale(0.97);
}

.header-logo:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 3px;
}

.header-logo__brand {
  display: flex;
  align-items: center;
}

.header-logo__img {
  display: block;
  width: 140px;
  height: 58px;
  background-color: #fff;
  mask-image: url('/img/logo-train-zone.png');
  -webkit-mask-image: url('/img/logo-train-zone.png');
  mask-size: contain;
  -webkit-mask-size: contain;
  mask-repeat: no-repeat;
  -webkit-mask-repeat: no-repeat;
  mask-position: center left;
  -webkit-mask-position: center left;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.header-logo:hover .header-logo__img {
  background: var(--gradient-accent);
  transform: scale(1.02);
  filter: drop-shadow(0 0 8px var(--color-accent-light));
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-action-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.header-action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
}

.header-action-btn:active {
  transform: translateY(1px) scale(0.96);
}

.header-action-btn__date {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1;
  transition: transform 0.3s var(--transition-bounce), opacity 0.2s ease;
}

.header-action-btn:hover .header-action-btn__date {
  transform: translateY(-150%);
  opacity: 0;
}

.header-action-btn__day {
  font-size: 1.125rem;
  font-weight: 700;
  margin-bottom: -2px;
}

.header-action-btn__month {
  font-size: 0.5625rem;
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.header-action-btn__hover-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, 50%) scale(0.8);
  font-size: 0.875rem;
  font-weight: 800;
  opacity: 0;
  transition: all 0.3s var(--transition-bounce);
  letter-spacing: 0.05em;
}

.header-action-btn:hover .header-action-btn__hover-text {
  transform: translate(-50%, -50%) scale(1);
  opacity: 1;
}

.header-action-btn--status {
  width: auto;
  height: 44px;
  padding: 0 4px;
  min-width: 44px;
}

.header-action-btn--active {
  border-color: rgba(var(--color-accent-rgb), 0.3);
  background: rgba(var(--color-accent-rgb), 0.1);
  color: var(--color-accent);
}

.header-action-btn--active:hover {
  background: rgba(var(--color-accent-rgb), 0.2);
  border-color: var(--color-accent);
  box-shadow: 0 0 16px rgba(var(--color-accent-rgb), 0.2);
}

.header-action-btn--rest {
  border-color: rgba(var(--color-text-secondary-rgb), 0.3);
  background: rgba(var(--color-surface-rgb), 0.5);
  color: var(--color-text-secondary);
}

.header-pull-indicator {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 120px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  z-index: 10;
  opacity: 0.6;
  transition: opacity 0.2s ease;
  touch-action: none;
}

.header-pull-indicator:hover,
.header-pull-indicator:active,
.header-pull-indicator--active {
  opacity: 1;
}

.header-pull-indicator--active {
  cursor: grabbing;
}

.header-pull-indicator__bar {
  width: 32px;
  height: 4px;
  background-color: var(--color-border);
  border-radius: 2px;
  transition: background-color 0.2s ease, width 0.2s ease;
}

.header-pull-indicator:hover .header-pull-indicator__bar,
.header-pull-indicator--active .header-pull-indicator__bar {
  background-color: var(--color-text-secondary);
  width: 40px;
}
</style>
