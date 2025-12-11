import { onMounted, onUnmounted, watch, type Ref } from 'vue';
import { SwipeGesture, type SwipeDirection } from '@/utils/swipeGestures';
import { hapticSelection } from '@/utils/hapticFeedback';
import type { DisplayProgram, TrainingProgram } from '@/types/exercises-page';

export function useExercisesGestures(
    disciplineCardRef: Ref<HTMLElement | null>,
    trainingProgramCardRef: Ref<HTMLElement | null>,
    currentProgram: Ref<DisplayProgram | null>,
    currentTrainingProgram: Ref<TrainingProgram | null>,
    hasNext: Ref<boolean>,
    hasPrev: Ref<boolean>,
    hasNextTrainingProgram: Ref<boolean>,
    hasPrevTrainingProgram: Ref<boolean>,
    selectNextProgram: () => void,
    selectPrevProgram: () => void,
    selectNextTrainingProgram: () => void,
    selectPrevTrainingProgram: () => void
) {
    // Swipe Gesture Instances
    let disciplineSwipe: SwipeGesture | null = null;
    let trainingProgramSwipe: SwipeGesture | null = null;

    onMounted(() => {
        // Инициализация swipe жестов для карточек направлений
        watch(
            () => disciplineCardRef.value,
            (element) => {
                if (disciplineSwipe) {
                    disciplineSwipe.destroy();
                    disciplineSwipe = null;
                }

                if (element && currentProgram.value && !currentProgram.value.locked) {
                    disciplineSwipe = new SwipeGesture(element, {
                        threshold: 50,
                        velocityThreshold: 0.3,
                        direction: 'horizontal',
                        preventDefault: true,
                        onSwipe: (direction: SwipeDirection) => {
                            if (direction === 'left' && hasNext.value) {
                                hapticSelection();
                                selectNextProgram();
                            } else if (direction === 'right' && hasPrev.value) {
                                hapticSelection();
                                selectPrevProgram();
                            }
                        },
                    });
                }
            },
            { immediate: true }
        );

        // Инициализация swipe жестов для карточек программ тренировок
        watch(
            () => trainingProgramCardRef.value,
            (element) => {
                if (trainingProgramSwipe) {
                    trainingProgramSwipe.destroy();
                    trainingProgramSwipe = null;
                }

                if (element && currentTrainingProgram.value) {
                    trainingProgramSwipe = new SwipeGesture(element, {
                        threshold: 50,
                        velocityThreshold: 0.3,
                        direction: 'horizontal',
                        preventDefault: true,
                        onSwipe: (direction: SwipeDirection) => {
                            if (direction === 'left' && hasNextTrainingProgram.value) {
                                // Виброотклик убран
                                selectNextTrainingProgram();
                            } else if (direction === 'right' && hasPrevTrainingProgram.value) {
                                // Виброотклик убран
                                selectPrevTrainingProgram();
                            }
                        },
                    });
                }
            },
            { immediate: true }
        );
    });

    onUnmounted(() => {
        if (disciplineSwipe) {
            disciplineSwipe.destroy();
            disciplineSwipe = null;
        }
        if (trainingProgramSwipe) {
            trainingProgramSwipe.destroy();
            trainingProgramSwipe = null;
        }
    });

    return {
        // Returns nothing as it sets up side effects
    };
}
