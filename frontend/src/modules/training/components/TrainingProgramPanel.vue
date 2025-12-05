<template>
  <div class="training-program-panel">
    <div class="panel-toggle-container">
      <div class="panel-toggle" role="tablist" aria-label="Переключатель панели программы">
        <div class="panel-toggle__track">
          <div class="panel-toggle__thumb" :style="thumbStyle" aria-hidden="true"></div>
          <button
            v-for="tab in tabs"
            :key="tab.id"
            :id="`panel-toggle-${tab.id}`"
            type="button"
            class="panel-toggle__option"
            :class="{ 'panel-toggle__option--active': activeTab === tab.id }"
            @click="setActiveTab(tab.id)"
            :aria-selected="activeTab === tab.id"
            :aria-controls="`panel-slide-${tab.id}`"
            role="tab"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>
    </div>

    <div class="panel-slider">
      <div class="panel-slider__inner" :style="sliderStyle">
        <section
          id="panel-slide-progress"
          class="panel-slide panel-slide--progress"
          :class="{ 'panel-slide--hidden': activeTab !== 'progress' && !isAnimating }"
          role="tabpanel"
          :aria-hidden="activeTab !== 'progress'"
          aria-labelledby="panel-toggle-progress"
        >
          <TrainingProgramDrawer v-bind="progressProps" />
        </section>
        <section
          id="panel-slide-settings"
          class="panel-slide panel-slide--settings"
          :class="{ 'panel-slide--hidden': activeTab !== 'settings' && !isAnimating }"
          role="tabpanel"
          :aria-hidden="activeTab !== 'settings'"
          aria-labelledby="panel-toggle-settings"
        >
          <TrainingProgramSettings
            :active="activeTab === 'settings'"
            @program-selected="handleProgramSelected"
          />
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, nextTick, type CSSProperties } from 'vue';
import TrainingProgramDrawer from './TrainingProgramDrawer.vue';
import TrainingProgramSettings from './TrainingProgramSettings.vue';

const props = defineProps<{
  disciplineName?: string;
  disciplineImage?: string;
  programName?: string;
  exercises?: any[];
  currentLevels?: Record<string, number>;
}>();

const emit = defineEmits<{
  'program-selected': [data: any];
}>();

const tabs = [
  { id: 'progress', label: 'Прогресс' },
  { id: 'settings', label: 'Настройки' },
] as const;

type TabId = typeof tabs[number]['id'];

const activeTab = ref<TabId>('progress');

const sliderStyle = computed(() => ({
  transform: activeTab.value === 'progress' ? 'translateX(0%)' : 'translateX(-50%)',
  transition: 'transform 450ms cubic-bezier(0.34, 1.56, 0.64, 1)',
}));

const thumbGradients: Record<TabId, string> = {
  progress: 'var(--gradient-accent-strong)',
  settings: 'var(--gradient-info-strong)',
};

const thumbStyle = computed<CSSProperties>(() => {
  const style: CSSProperties = {
    top: '4px',
    bottom: '4px',
    transition: 'all 450ms cubic-bezier(0.34, 1.56, 0.64, 1)',
    background: thumbGradients[activeTab.value],
    boxShadow: '0 18px 32px var(--color-accent-light), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
  };

  if (activeTab.value === 'progress') {
    style.left = '4px';
    style.right = 'calc(50% + 2px)';
  } else {
    style.left = 'calc(50% - 2px)';
    style.right = '4px';
  }

  return style;
});

const progressProps = computed(() => ({
  disciplineName: props.disciplineName,
  disciplineImage: props.disciplineImage,
  programName: props.programName,
  exercises: props.exercises,
  currentLevels: props.currentLevels || {},
}));

const isAnimating = ref(false);
let animationTimeout: ReturnType<typeof setTimeout> | null = null;

const setActiveTab = (tab: TabId) => {
  if (activeTab.value === tab) return;
  
  isAnimating.value = true;
  if (animationTimeout) clearTimeout(animationTimeout);
  
  activeTab.value = tab;
  
  // Сбрасываем скролл наверх при переключении табов
  nextTick(() => {
    const contentPanel = document.querySelector('.header-content-panel');
    if (contentPanel) {
      contentPanel.scrollTop = 0;
    }
  });

  animationTimeout = setTimeout(() => {
    isAnimating.value = false;
    animationTimeout = null;
  }, 450); // Match transition duration
};

const handleProgramSelected = (data: any) => {
  emit('program-selected', data);
  activeTab.value = 'progress';
};

defineExpose({
  focusProgress: () => setActiveTab('progress'),
  focusSettings: () => setActiveTab('settings'),
});
</script>

<style scoped>
.training-program-panel {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-height: 100%;
  padding: 0;
  justify-content: flex-start;
  align-items: stretch;
}

.panel-toggle-container {
  position: sticky;
  top: 0;
  z-index: 10;
  height: var(--nav-bar-height);
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  background: var(--color-bg-elevated); /* Solid background */
  border-bottom: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
  box-sizing: border-box;
}

.panel-toggle {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  padding: 0;
  margin: 0;
}

.panel-toggle__track {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: min(360px, 94vw);
  height: 40px; /* Slightly smaller height */
  padding: 4px;
  background: var(--color-bg-card); /* Distinct track background */
  border-radius: 999px;
  border: 1px solid var(--color-border);
  overflow: hidden;
  box-sizing: border-box;
}

.panel-toggle__thumb {
  position: absolute;
  border-radius: 999px;
  pointer-events: none;
  box-shadow: var(--shadow-sm);
}

.panel-toggle__option {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 0 1rem;
  border-radius: 999px;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  font-size: 0.875rem;
  font-weight: 500;
  letter-spacing: 0.01em;
  color: var(--color-text-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.panel-toggle__option:hover {
  color: var(--color-text-primary);
}

.panel-toggle__option:active {
  transform: scale(0.98);
}

.panel-toggle__option--active {
  color: var(--color-accent-contrast); /* Always contrast on active thumb */
  font-weight: 600;
}

.panel-slider {
  flex: 1;
  min-height: 0;
  overflow: visible;
}

.panel-slider__inner {
  display: flex;
  width: 200%;
  height: auto;
  align-items: flex-start; /* Align items to top so they don't stretch */
}

.panel-slide {
  flex: 0 0 50%;
  overflow: visible;
  padding: 0;
  position: relative;
}

.panel-slide--hidden {
  height: 0 !important;
  min-height: 0 !important;
  overflow: hidden !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  margin: 0 !important;
}

.panel-slide--progress,
.panel-slide--settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  height: auto;
}

.panel-slide--progress {
  min-height: 100%;
  padding: var(--space-md) var(--space-md) var(--space-xl) var(--space-md);
}

.panel-slide--settings {
  min-height: auto;
  padding: var(--space-md) var(--space-md) var(--space-xl) var(--space-md);
}

@media (max-width: 768px) {
  .panel-toggle-container {
    height: var(--nav-bar-height);
  }

  .panel-toggle__track {
    width: min(320px, 92vw);
    height: 36px;
    padding: 3px;
  }

  .panel-toggle__option {
    padding: 0 0.875rem;
    font-size: 0.8125rem;
  }
}
</style>
