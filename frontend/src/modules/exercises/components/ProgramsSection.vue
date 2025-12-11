<template>
  <div ref="sectionRef" class="programs-section" :style="parallaxStyle">
    <div class="program-card-wrapper" :style="currentProgram && getProgramStyles ? getProgramStyles(currentProgram) : undefined">
      <div class="programs-container">
        <!-- Flip Container with 3D transform -->
        <div class="card-flip-container" :class="{ 'flipped': isFlipped }">
          <transition
            :name="disciplineSlideDirection === 'next' ? 'discipline-slide-next' : 'discipline-slide-prev'"
            mode="out-in"
          >
            <div
              v-if="currentProgram"
              :key="currentProgram.id"
              class="card-flip-inner"
            >
              <!-- FRONT SIDE: Direction Card -->
              <div class="card-flip-front">
                <DisciplineCard
                  ref="disciplineCardComponent"
                  :program="currentProgram"
                  :styles="[ (getProgramStyles ? getProgramStyles(currentProgram) : {}), getCard3DStyle(`discipline-${currentProgram.id}`) ]"
                  :flipped="isFlipped"
                  :has-prev="hasPrevProgram"
                  :has-next="hasNextProgram"
                  @click="$emit('flip')"
                  @prev="$emit('prev-program')"
                  @next="$emit('next-program')"
                  @card-mousemove="(e: any) => handle3DMouseMove(e, `discipline-${currentProgram?.id}`)"
                  @card-mouseleave="() => handle3DMouseLeave(`discipline-${currentProgram?.id}`)"
                />
              </div>

              <!-- BACK SIDE: Programs List -->
              <div class="card-flip-back">
                <div ref="backContainerRef" class="programs-back-container" :style="parallaxBackStyle">
                  <transition
                    :name="trainingSlideDirection === 'next' ? 'program-slide-next' : 'program-slide-prev'"
                    mode="out-in"
                  >
                    <template v-if="trainingProgramsLoading">
                      <SkeletonProgram key="skeleton-program" />
                    </template>
                    <template v-else-if="trainingProgramsError">
                      <ErrorState
                        key="training-programs-error"
                        :message="trainingProgramsError"
                        action-label="Попробовать снова"
                        @retry="$emit('retry-training')"
                      />
                    </template>
                    <template v-else-if="trainingPrograms.length > 0">
                      <TrainingProgramCard
                        v-if="currentTrainingProgram"
                        key="training-program-card"
                        ref="trainingProgramCardComponent"
                        :program="currentTrainingProgram"
                        :styles="[ (getTrainingProgramStyles ? getTrainingProgramStyles(currentTrainingProgram) : {}), getCard3DStyle(`program-${currentTrainingProgram.id}`) ]"
                        :has-prev="hasPrevTraining"
                        :has-next="hasNextTraining"
                        :is-active="activeProgramId === currentTrainingProgram.id"
                        :is-activating="isActivating"
                        @prev="$emit('prev-training')"
                        @next="$emit('next-training')"
                        @activate="$emit('set-active-program', currentTrainingProgram.id)"
                        @card-mousemove="(e: any) => handle3DMouseMove(e, `program-${currentTrainingProgram?.id}`)"
                        @card-mouseleave="() => handle3DMouseLeave(`program-${currentTrainingProgram?.id}`)"
                      />
                    </template>
                    <template v-else>
                      <div key="training-programs-empty" class="empty-state empty-state--inline">
                        <div class="empty-state__icon">📘</div>
                        <div class="empty-state__title">Нет программ</div>
                        <p class="empty-state__description">
                          Для выбранного направления пока нет программ.
                        </p>
                      </div>
                    </template>
                  </transition>
                </div>
              </div>
            </div>
            <SkeletonDiscipline
              v-else
              key="skeleton-discipline"
            />
          </transition>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { StyleValue } from 'vue';
import { DisplayProgram, TrainingProgram } from '@/types/exercises-page';
import DisciplineCard from './DisciplineCard.vue';
import TrainingProgramCard from './TrainingProgramCard.vue';
import SkeletonProgram from '@/modules/shared/components/SkeletonProgram.vue';
import SkeletonDiscipline from '@/modules/shared/components/SkeletonDiscipline.vue';
import ErrorState from '@/modules/shared/components/ErrorState.vue';
import { useCard3D } from '@/composables/useCard3D';

defineProps<{
  // Data
  currentProgram: DisplayProgram | null;
  trainingPrograms: TrainingProgram[];
  currentTrainingProgram: TrainingProgram | null;
  
  // State
  isFlipped: boolean;
  trainingProgramsLoading: boolean;
  trainingProgramsError: string | null;
  
  // Navigation
  hasPrevProgram: boolean;
  hasNextProgram: boolean;
  hasPrevTraining: boolean;
  hasNextTraining: boolean;
  
  // Directions
  disciplineSlideDirection: 'next' | 'prev';
  trainingSlideDirection: 'next' | 'prev';
  
  // Styles
  parallaxStyle?: StyleValue;
  parallaxBackStyle?: StyleValue;
  
  // Handlers passed as props or slots?
  // We use events for navigation.
  
  // Utils (passed as function props to avoid duplication logic?)
  // Or we can import them if they are pure utils.
  // The 'getProgramStyles' in Page used color mix logic.
  // We can accept the FUNCTION or the STYLES object directly.
  // Accepting function allows dynamic calculation.
  getProgramStyles?: (p: DisplayProgram) => StyleValue;
  getTrainingProgramStyles?: (p: TrainingProgram) => StyleValue;
  
  // User Context
  activeProgramId?: string; // ID of the currently active program for the user
  isActivating?: boolean;
}>();

defineEmits<{
  (e: 'flip'): void;
  (e: 'prev-program'): void;
  (e: 'next-program'): void;
  (e: 'prev-training'): void;
  (e: 'next-training'): void;
  (e: 'retry-training'): void;
  (e: 'set-active-program', programId: string): void;
}>();

const { getCard3DStyle, handle3DMouseMove, handle3DMouseLeave } = useCard3D();

// Refs
const sectionRef = ref<HTMLElement | null>(null);
const backContainerRef = ref<HTMLElement | null>(null);
const disciplineCardComponent = ref<InstanceType<typeof DisciplineCard> | null>(null);
const trainingProgramCardComponent = ref<InstanceType<typeof TrainingProgramCard> | null>(null);

defineExpose({
  sectionElement: computed(() => sectionRef.value),
  backContainerElement: computed(() => backContainerRef.value),
  disciplineCardElement: computed(() => disciplineCardComponent.value?.cardElement),
  trainingProgramCardElement: computed(() => trainingProgramCardComponent.value?.cardElement)
});
</script>

<style scoped>
.programs-section {
  width: 100%;
  margin-top: var(--space-lg);
  padding: 0 var(--space-md);
  position: relative;
  overflow: visible;
  will-change: transform;
  backface-visibility: hidden;
  transform-style: preserve-3d;
}

.card-flip-container {
  perspective: 1200px;
  width: 100%;
  position: relative;
  /* Container needs min-height to prevent collapse */
  min-height: 220px;
}

.card-flip-inner {
  position: relative;
  width: 100%;
  min-height: 220px;
  transition: transform 0.7s cubic-bezier(0.4, 0, 0.2, 1);
  transform-style: preserve-3d;
}

.card-flip-container.flipped .card-flip-inner {
  transform: rotateY(180deg);
}

.card-flip-front,
.card-flip-back {
  position: absolute;
  width: 100%;
  top: 0;
  left: 0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.card-flip-front {
  transform: rotateY(0deg);
  z-index: 2;
}

.card-flip-back {
  transform: rotateY(180deg);
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.programs-back-container {
  width: 100%;
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.programs-container {
  position: relative;
  width: 100%;
  min-height: 120px;
  overflow: visible;
  opacity: 0;
  transform: translateY(20px) scale(0.98);
  transition: 
    opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  animation: fadeIn 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

@keyframes fadeIn {
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Transitions */
.discipline-slide-next-enter-active,
.discipline-slide-next-leave-active,
.discipline-slide-prev-enter-active,
.discipline-slide-prev-leave-active,
.program-slide-next-enter-active,
.program-slide-next-leave-active,
.program-slide-prev-enter-active,
.program-slide-prev-leave-active {
  transition: 
    transform 0.12s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.1s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform, opacity;
  backface-visibility: hidden;
  transform-style: preserve-3d;
  /* Принудительное GPU ускорение */
  -webkit-transform: translateZ(0);
  transform: translateZ(0);
  -webkit-perspective: 1000;
  perspective: 1000;
  /* Изоляция слоя для GPU */
  isolation: isolate;
  /* Отключаем pointer-events во время transition для предотвращения конфликтов */
  pointer-events: none;
}

.discipline-slide-next-enter-from,
.program-slide-next-enter-from {
  transform: translate3d(100%, 0, 0) translateZ(0);
  opacity: 0;
}

.discipline-slide-next-leave-to,
.program-slide-next-leave-to {
  transform: translate3d(-100%, 0, 0) translateZ(0);
  opacity: 0;
}

.discipline-slide-next-enter-to,
.program-slide-next-enter-to {
  transform: translate3d(0, 0, 0) translateZ(0) !important;
  opacity: 1 !important;
  pointer-events: auto !important;
}

.discipline-slide-next-leave-from,
.program-slide-next-leave-from {
  transform: translate3d(0, 0, 0) translateZ(0);
  opacity: 1;
  pointer-events: auto;
}

.discipline-slide-prev-enter-from,
.program-slide-prev-enter-from {
  transform: translate3d(-100%, 0, 0) translateZ(0);
  opacity: 0;
}

.discipline-slide-prev-leave-to,
.program-slide-prev-leave-to {
  transform: translate3d(100%, 0, 0) translateZ(0);
  opacity: 0;
}

.discipline-slide-prev-enter-to,
.program-slide-prev-enter-to {
  transform: translate3d(0, 0, 0) translateZ(0) !important;
  opacity: 1 !important;
  pointer-events: auto !important;
}

.discipline-slide-prev-leave-from,
.program-slide-prev-leave-from {
  transform: translate3d(0, 0, 0) translateZ(0);
  opacity: 1;
  pointer-events: auto;
}

/* Reduced Motion */
@media (prefers-reduced-motion: reduce) {
  .programs-section {
    transform: none !important;
    will-change: auto !important;
  }
}

@media (max-width: 360px) {
  .programs-container {
    min-height: 170px;
  }
}
</style>
