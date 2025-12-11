<template>
  <div
    class="stage-panel"
    role="tabpanel"
    id="stage-panel-results"
    aria-labelledby="stage-tab-results"
    data-animate="fade-up"
  >
    <div v-if="isLocked" class="stage-placeholder stage-placeholder--info">
      <p>Раздел доступен для просмотра. Начни тренировку, чтобы зафиксировать результаты.</p>
    </div>

    <!-- Explicitly check if components are loaded if needed, but async comp handles it -->
    <component
      :is="SessionResults"
      v-if="!isLocked || true"
      :cards="exerciseCards"
      :model-value="exerciseResults"
      @update:model-value="$emit('update:exerciseResults', $event)"
      :is-spark-active="isSparkActive"
    />

    <component
      :is="SessionControls"
      v-if="!isLocked || true"
      :comment="summaryComment"
      @update:comment="$emit('update:summaryComment', $event)"
      :saving="saving"
      :suggestions="postWorkoutSuggestions"
      @submit="$emit('complete-training')"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent, defineAsyncComponent } from 'vue';

export default defineComponent({
  name: 'TodayResultsPanel',
  props: {
    isLocked: { type: Boolean, required: true },
    exerciseCards: { type: Array, required: true },
    exerciseResults: { type: Object, required: true },
    summaryComment: { type: String, required: true },
    saving: { type: Boolean, required: true },
    postWorkoutSuggestions: { type: Array, required: true },
    isSparkActive: { type: Function, required: true },
  },
  emits: [
    'update:exerciseResults',
    'update:summaryComment',
    'complete-training'
  ],
  setup() {
    const SessionResults = defineAsyncComponent(() => import('@/modules/today/components/SessionResults.vue'));
    const SessionControls = defineAsyncComponent(() => import('@/modules/today/components/SessionControls.vue'));

    return {
      SessionResults,
      SessionControls
    };
  }
});
</script>

<style scoped>
.stage-panel {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.stage-placeholder {
    padding: 1rem;
    text-align: center;
    background: rgba(255,255,255,0.05);
    border-radius: 8px;
    font-size: 0.9rem;
    color: var(--color-text-secondary);
}
</style>
