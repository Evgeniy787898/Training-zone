<template>
  <div 
    class="header-content-panel"
    :class="{ 'header-content-panel--expanded': heroExpanded }"
    :style="contentPanelStyle"
  >
    <TrainingProgramPanel
      ref="programPanelRef"
      :discipline-name="disciplineName"
      :discipline-image="disciplineImage"
      :program-name="programName"
      :exercises="exercises"
      :current-levels="currentLevels"
      @program-selected="$emit('programSelected', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, type CSSProperties } from 'vue';
import { createLazyComponent } from '@/utils/lazyComponent';
import type { ProgramLevel } from '@/modules/training/types';

const TrainingProgramPanel = createLazyComponent(() => import('@/modules/training/components/TrainingProgramPanel.vue'));

type TrainingProgramPanelExpose = {
  focusProgress: () => void;
};

defineProps<{
  heroExpanded: boolean;
  contentPanelStyle: CSSProperties;
  disciplineName: string;
  disciplineImage: string;
  programName?: string;
  exercises: any[]; // Using any[] for now to match implicit source type, ideally strictly typed
  currentLevels: Record<string, ProgramLevel>;
}>();

defineEmits<{
  (e: 'programSelected', data: { discipline: string, program: string, level: ProgramLevel }): void;
}>();

const programPanelRef = ref<TrainingProgramPanelExpose | null>(null);

const focusProgress = () => {
  programPanelRef.value?.focusProgress();
};

defineExpose({
  focusProgress
});
</script>

<style scoped>
/* Content Panel - Expandable Area */
.header-content-panel {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 99; /* Just below header */
  background: var(--panel-surface-base, var(--color-bg-elevated));
  background-image: var(--panel-surface-gradient, var(--gradient-surface));
  backdrop-filter: blur(12px);
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  /* Optimization */
  will-change: height, transform;
  backface-visibility: hidden;
  transform: translateZ(0);
  touch-action: pan-y;
  /* Hardware acceleration for smooth animation on mobile */
  transform: translate3d(0, 0, 0); 
}

.header-content-panel--expanded {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
</style>
