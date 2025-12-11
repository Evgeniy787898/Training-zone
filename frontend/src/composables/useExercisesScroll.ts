import { ref, computed, type Ref, watch } from 'vue';
import type { ProgramExercise } from '@/types/exercises-page';

const PAGE_SIZE = 20;

export function useExercisesScroll(programExercises: Ref<ProgramExercise[]>) {
    // Keep this ref to maintain compatibility or for scroll position restoration if needed
    const exercisesScrollContainerRef = ref<HTMLElement | null>(null);
    const visibleCount = ref(PAGE_SIZE);

    // Watch for program changes to reset visible count
    watch(programExercises, (newVal, oldVal) => {
        // If the array identity changed or length changed significantly (filtering), reset
        if (newVal !== oldVal) {
            visibleCount.value = PAGE_SIZE;
            if (exercisesScrollContainerRef.value) {
                exercisesScrollContainerRef.value.scrollTop = 0;
            }
        }
    });

    const visibleExercises = computed(() => {
        return programExercises.value.slice(0, visibleCount.value).map((exercise, index) => ({
            exercise,
            index
        }));
    });

    const hasMore = computed(() => visibleCount.value < programExercises.value.length);

    const loadMore = () => {
        if (hasMore.value) {
            visibleCount.value += PAGE_SIZE;
        }
    };

    // Stubs to maintain compatibility if needed, or we can just remove them and update component
    const exercisesListHeight = computed(() => 0);
    const exercisesOffsetY = computed(() => 0);
    const exercisesScrollTop = ref(0);
    const exercisesViewportHeight = ref(0);

    const initExercisesVirtualScroll = () => { /* no-op */ };
    const cleanupExercisesVirtualScroll = () => { /* no-op */ };

    return {
        exercisesScrollContainerRef,
        visibleExerciseIndices: computed(() => ({ start: 0, end: visibleCount.value })), // approximation
        visibleExercises,
        exercisesListHeight,
        exercisesOffsetY,
        exercisesScrollTop,
        exercisesViewportHeight,
        initExercisesVirtualScroll,
        cleanupExercisesVirtualScroll,
        loadMore,
        hasMore
    };
}
