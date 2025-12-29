<template>
  <div
    class="stage-panel"
    :class="{ 'stage-panel--focus': focusMode }"
    role="tabpanel"
    id="stage-panel-timer"
    aria-labelledby="stage-tab-timer"
    data-animate="fade-up"
  >
    <div class="timer-controls-wrapper">
      <BaseButton
        v-if="!focusMode"
        class="timer-nav-btn"
        variant="ghost" 
        size="lg"
        :disabled="!hasPrev || isLocked"
        @click="$emit('prev-exercise')"
      >
        <AppIcon name="arrowLeft" :size="32" />
      </BaseButton>

      <div class="timer-placeholder-wrapper" v-if="!TabataTimer">
          Loading Timer...
      </div>
      <component 
        :is="TabataTimer"
        v-else
        :locked="isLocked"
        :exercise-name="primaryExerciseTitle"
        :settings="settings"
        :focus-mode="focusMode"
        @update:settings="$emit('update:settings', $event)"
        @time-update="$emit('time-update', $event)"
        @session-complete="$emit('session-complete')"
        @toggle-focus="$emit('toggle-focus')"
      />

      <BaseButton
        v-if="!focusMode"
        class="timer-nav-btn"
        variant="ghost"
        size="lg"
        :disabled="!hasNext || isLocked"
        @click="$emit('next-exercise')"
      >
        <AppIcon name="arrowRight" :size="32" />
      </BaseButton>
    </div>

    <div v-if="isLocked" class="stage-placeholder stage-placeholder--info">
      <p>Таймер доступен для настройки. Нажми «Приступить», чтобы начать отсчёт.</p>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, defineAsyncComponent, type PropType } from 'vue';

interface TabataSettings {
  work: number;
  rest: number;
  restBetweenSets: number;
  restBetweenExercises: number;
  rounds: number;
  [key: string]: unknown;
}

export default defineComponent({
  name: 'TodayTimerPanel',
  components: {
    BaseButton: defineAsyncComponent(() => import('@/components/ui/BaseButton.vue')),
    AppIcon: defineAsyncComponent(() => import('@/modules/shared/components/AppIcon.vue')),
  },
  props: {
    isLocked: { type: Boolean, required: true },
    primaryExerciseTitle: { type: String, required: true },
    settings: { type: Object as PropType<TabataSettings>, required: true },
    focusMode: { type: Boolean, required: true },
    hasPrev: { type: Boolean, default: false },
    hasNext: { type: Boolean, default: false },
  },
  emits: [
    'update:settings',
    'time-update',
    'session-complete',
    'toggle-focus',
    'prev-exercise',
    'next-exercise'
  ],
  setup() {
    // We register TabataTimer locally to control its loading
    const TabataTimer = defineAsyncComponent({
        loader: () => import('@/modules/today/components/TabataTimer.vue'),
        loadingComponent: undefined, // No loading component for now, or could use a spinner
        delay: 0
    });

    return {
        TabataTimer
    };
  }
});
</script>

<style scoped>
.timer-controls-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  width: 100%;
}

.timer-nav-btn {
  padding: var(--space-xs);
  color: var(--color-text-tertiary);
  transition: all 0.2s ease;
}

.timer-nav-btn:not(:disabled):hover {
  color: var(--color-text-primary);
  background: var(--color-bg-secondary);
}

.timer-nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.stage-placeholder {
    padding: 1rem;
    text-align: center;
    background: rgba(255,255,255,0.05);
    border-radius: 8px;
    font-size: 0.9rem;
    color: var(--color-text-secondary);
    margin-top: 1rem;
}
</style>
