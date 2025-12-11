import { ref, computed, watch, readonly, nextTick, type Ref } from 'vue';
import { cachedApiClient } from '@/services/cachedApi';
import ErrorHandler from '@/services/errorHandler';
import { invalidateProgramContextCaches } from '@/services/cacheManager';
import { getDisciplineColor, generateDisciplineGradient } from '@/utils/colorUtils';
import { useBatchUpdates } from '@/composables/useBatchUpdates';


import type {
    BaseProgram,
    DisplayProgram,
    TrainingDirection,
    TrainingProgram,
    ProgramExercise
} from '@/types/exercises-page';

export function useExercisesData(
    isProgramsSectionVisible: Ref<boolean>,
    isExercisesSectionVisible: Ref<boolean>,
    hooks: {
        onExercisesLoaded?: () => void;
    } = {}
) {
    const { batchRAF, batchNextTick } = useBatchUpdates();



    // ==================== STATE ====================
    const loading = ref(true);
    const error = ref<any>(null);
    const disciplineVisible = ref(false);
    const programsVisible = ref(false);
    const exercisesVisible = ref(false);

    // Data
    const programs = ref<BaseProgram[]>([]); // Training Directions mapped to BaseProgram
    const trainingPrograms = ref<TrainingProgram[]>([]);
    const programExercises = ref<ProgramExercise[]>([]);

    // Navigation Indices
    const visibleIndex = ref(0); // Discipline Index
    const prevVisibleIndex = ref(0);
    const activeProgram = ref(''); // Active Discipline ID

    const visibleTrainingProgramIndex = ref(0);
    const prevTrainingProgramIndex = ref(0);

    // Loading States
    const trainingProgramsLoading = ref(false);
    const trainingProgramsError = ref<string | null>(null);
    const programExercisesLoading = ref(false);
    const programExercisesError = ref<string | null>(null);

    // Flags
    const shouldLoadProgramsImmediately = ref(true);
    const shouldLoadExercisesImmediately = ref(true);
    let isTransitioningDisciplines = false;
    let isTransitioningPrograms = false;

    // ==================== COMPUTED ====================
    const coloredPrograms = computed<DisplayProgram[]>(() =>
        programs.value.map((program) => {
            const programName = program.name ?? program.title;
            const primaryColor = getDisciplineColor(program.id, programName);
            const gradient = generateDisciplineGradient(primaryColor);

            return {
                ...program,
                color: primaryColor,
                gradient,
            };
        }),
    );

    const displayPrograms = computed<DisplayProgram[]>(() => coloredPrograms.value);

    const currentProgram = computed<DisplayProgram | null>(() => {
        if (!displayPrograms.value.length) return null;
        return displayPrograms.value[visibleIndex.value] ?? null;
    });

    const activeProgramColor = computed(() => currentProgram.value?.color ?? '#10A37F');

    const hasPrev = computed(() => displayPrograms.value.length > 0 && visibleIndex.value > 0);
    const hasNext = computed(
        () => displayPrograms.value.length > 0 && visibleIndex.value < displayPrograms.value.length - 1,
    );

    const disciplineSlideDirection = computed(() => {
        return visibleIndex.value > prevVisibleIndex.value ? 'next' : 'prev';
    });

    // Training Programs Computed
    const currentTrainingProgram = computed(() => {
        return trainingPrograms.value[visibleTrainingProgramIndex.value] || null;
    });

    const hasPrevTrainingProgram = readonly(computed(() => {
        return visibleTrainingProgramIndex.value > 0;
    }));

    const hasNextTrainingProgram = readonly(computed(() => {
        return visibleTrainingProgramIndex.value < trainingPrograms.value.length - 1;
    }));

    const slideDirection = computed(() => {
        return visibleTrainingProgramIndex.value > prevTrainingProgramIndex.value ? 'next' : 'prev';
    });

    // ==================== METHODS ====================

    const clampIndex = (index: number) => {
        const maxIndex = displayPrograms.value.length - 1;
        if (maxIndex < 0) return -1;
        return Math.min(Math.max(index, 0), maxIndex);
    };

    const setVisibleIndex = (index: number) => {
        if (!displayPrograms.value.length) {
            visibleIndex.value = 0;
            activeProgram.value = '';
            return;
        }
        const nextIndex = clampIndex(index);
        prevVisibleIndex.value = visibleIndex.value;
        visibleIndex.value = nextIndex;
        const program = nextIndex >= 0 ? displayPrograms.value[nextIndex] : null;
        activeProgram.value = program?.id ?? '';
    };

    const syncActiveProgram = () => {
        if (!programs.value.length) {
            activeProgram.value = '';
            setVisibleIndex(0);
            return;
        }

        if (!programs.value.find(program => program.id === activeProgram.value && !program.locked)) {
            const firstUnlocked = programs.value.find(program => !program.locked);
            activeProgram.value = firstUnlocked ? firstUnlocked.id : programs.value[0].id;
        }

        const nextIndex = displayPrograms.value.findIndex(
            item => item.id === activeProgram.value,
        );
        setVisibleIndex(nextIndex === -1 ? 0 : nextIndex);
    };

    const selectPrevProgram = () => {
        if (!hasPrev.value || isTransitioningDisciplines) return;
        isTransitioningDisciplines = true;
        requestAnimationFrame(() => {
            setVisibleIndex(visibleIndex.value - 1);
        });
        setTimeout(() => {
            isTransitioningDisciplines = false;
        }, 120);
    };

    const selectNextProgram = () => {
        if (!hasNext.value || isTransitioningDisciplines) return;
        isTransitioningDisciplines = true;
        batchRAF(() => {
            setVisibleIndex(visibleIndex.value + 1);
        });
        setTimeout(() => {
            isTransitioningDisciplines = false;
        }, 120);
    };

    // State Cleaning
    const clearTrainingProgramsState = () => {
        trainingPrograms.value = [];
        visibleTrainingProgramIndex.value = 0;
        programExercises.value = [];
        programExercisesLoading.value = false;
        trainingProgramsError.value = null;
        programExercisesError.value = null;
        lastProgramsDisciplineId = null;
        lastProgramsPromise = null;
        lastExercisesRequestKey = null;
        lastExercisesPromise = null;
        // Note: Hooks and external cleanup should be handled by the component via watchers if needed
        // But for "programExercises" we can trigger a clear event? 
        // Actually, setting programExercises = [] will trigger watchers in component (e.g. usage in templates)
    };

    const isValidIndex = (index: number, arrayLength: number): boolean => {
        return index >= 0 && index < arrayLength;
    };

    // ==================== DATA LOADING ====================

    // Caches for promises to prevent duplicate requests
    let lastProgramsDisciplineId: string | null = null;
    let lastProgramsPromise: Promise<TrainingProgram[]> | null = null;

    const loadTrainingPrograms = async (disciplineId: string | null) => {
        if (!disciplineId) {
            trainingPrograms.value = [];
            trainingProgramsError.value = null;
            visibleTrainingProgramIndex.value = 0;
            lastProgramsDisciplineId = null;
            lastProgramsPromise = null;
            return [];
        }

        if (lastProgramsDisciplineId === disciplineId && lastProgramsPromise) {
            return lastProgramsPromise;
        }

        trainingProgramsLoading.value = true;
        trainingProgramsError.value = null;
        programsVisible.value = false;
        lastProgramsDisciplineId = disciplineId;

        const requestPromise = (async () => {
            try {
                const programsData = await cachedApiClient.getTrainingPrograms(disciplineId);
                const normalizedPrograms = Array.isArray(programsData) ? programsData : [];
                const previousIndex = visibleTrainingProgramIndex.value;
                trainingPrograms.value = normalizedPrograms;

                if (trainingPrograms.value.length === 0) {
                    visibleTrainingProgramIndex.value = 0;
                    programExercises.value = [];
                    exercisesVisible.value = false;
                } else {
                    const nextIndex = Math.min(Math.max(previousIndex, 0), trainingPrograms.value.length - 1);
                    visibleTrainingProgramIndex.value = nextIndex;

                    if (nextIndex === previousIndex || previousIndex >= trainingPrograms.value.length) {
                        batchRAF(() => {
                            programExercisesLoading.value = true;
                            exercisesVisible.value = false;
                        });
                        void loadProgramExercises(trainingPrograms.value[nextIndex]?.id, disciplineId);
                    }
                }

                await nextTick();
                trainingProgramsLoading.value = false;
                setTimeout(() => {
                    programsVisible.value = true;
                }, 300);
                return trainingPrograms.value;
            } catch (err: any) {
                ErrorHandler.handleWithToast(err, 'useExercisesData.loadTrainingPrograms');
                trainingProgramsError.value = err instanceof Error ? err.message : 'Не удалось загрузить программы';
                trainingPrograms.value = [];
                visibleTrainingProgramIndex.value = 0;
                throw err;
            } finally {
                if (trainingProgramsLoading.value) {
                    batchRAF(() => {
                        trainingProgramsLoading.value = false;
                    });
                }
                if (lastProgramsDisciplineId === disciplineId) {
                    lastProgramsDisciplineId = null;
                    lastProgramsPromise = null;
                }
            }
        })();

        lastProgramsPromise = requestPromise;
        return requestPromise;
    };

    let lastExercisesRequestKey: string | null = null;
    let lastExercisesPromise: Promise<ProgramExercise[]> | null = null;

    const loadProgramExercises = async (programId?: string, disciplineId?: string) => {
        if (!programId && !disciplineId) {
            programExercises.value = [];
            programExercisesError.value = null;
            lastExercisesRequestKey = null;
            lastExercisesPromise = null;
            return;
        }

        const requestKey = `${programId || ''}_${disciplineId || ''} `;

        if (lastExercisesRequestKey === requestKey && lastExercisesPromise) {
            return lastExercisesPromise;
        }

        batchRAF(() => {
            programExercisesLoading.value = true;
            exercisesVisible.value = false;
        });
        programExercisesError.value = null;
        lastExercisesRequestKey = requestKey;

        const requestPromise = (async () => {
            try {
                const exercisesData = await cachedApiClient.getProgramExercises(programId, disciplineId);
                batchRAF(() => {
                    programExercises.value = Array.isArray(exercisesData) ? exercisesData : [];
                });

                batchNextTick(() => {
                    programExercisesLoading.value = false;
                });

                // Trigger hook for VScroll init
                batchRAF(() => {
                    hooks.onExercisesLoaded?.();
                });

                setTimeout(() => {
                    batchRAF(() => {
                        exercisesVisible.value = true;
                    });
                }, 300);

                return programExercises.value;
            } catch (err: any) {
                ErrorHandler.handleWithToast(err, 'useExercisesData.loadProgramExercises');
                // Do NOT return empty array here to break promise chain? No, consistent error handling.
                // Original code didn't throw but returned empty in finally? Original code caught error, handled with toast.
                // And assigned empty array inside if (err). 
                // Wait, original code (Step 904): 
                // catch (err) { ErrorHandler... } // No return value specified, likely undefined/void.
                // But programExercises.value was NOT cleared in catch block in original (it logs and toast).
                // I should stick to original behavior.
                // Original: `programExercises.value = Array.isArray(exercisesData) ? exercisesData : []; ` happened BEFORE catch if success.
                return programExercises.value; // Return whatever state
            } finally {
                // Original didn't have finally block for loading?
                // Ah, it had `batchNextTick(() => { programExercisesLoading.value = false; }); ` in try block.
                // And `return programExercises.value`.
                // I'll stick to try block success flow.
            }
        })();

        lastExercisesPromise = requestPromise;
        return requestPromise;
    };

    const loadCatalog = async () => {
        loading.value = true;
        error.value = null;
        disciplineVisible.value = false;
        programsVisible.value = false;
        exercisesVisible.value = false;

        try {
            console.log('[ExercisesPage] Clearing training programs cache before loading catalog');
            invalidateProgramContextCaches({ includeGlobal: true });

            const directionsData = await cachedApiClient.getTrainingDisciplines();

            programs.value = directionsData.map((d: TrainingDirection) => ({
                id: d.id,
                slug: d.slug,
                title: d.name,
                subtitle: d.description || '',
                locked: !d.isActive,
            }));

            syncActiveProgram();
            disciplineVisible.value = true;
            loading.value = false;

            // Preload first discipline programs
            if (displayPrograms.value.length > 0 && visibleIndex.value >= 0) {
                const firstProgram = displayPrograms.value[visibleIndex.value];
                if (firstProgram) {
                    setTimeout(async () => {
                        await loadTrainingPrograms(firstProgram.id).catch((err) => {
                            ErrorHandler.handleWithToast(err, 'ExercisesPage.preloadFirstDiscipline');
                        });
                    }, 200);
                }
            }
        } catch (err: any) {
            error.value = err;
            loading.value = false;
            const appError = ErrorHandler.handle(err, 'loadCatalog');
            ErrorHandler.showToast(appError);
        }
    };

    const selectPrevTrainingProgram = () => {
        if (!hasPrevTrainingProgram.value || trainingPrograms.value.length === 0 || isTransitioningPrograms) return;

        prevTrainingProgramIndex.value = visibleTrainingProgramIndex.value;
        const newIndex = Math.max(0, visibleTrainingProgramIndex.value - 1);

        if (newIndex >= 0 && newIndex < trainingPrograms.value.length) {
            isTransitioningPrograms = true;
            visibleTrainingProgramIndex.value = newIndex;
            setTimeout(() => {
                isTransitioningPrograms = false;
            }, 350);
        }
    };

    const selectNextTrainingProgram = () => {
        if (!hasNextTrainingProgram.value || trainingPrograms.value.length === 0 || isTransitioningPrograms) return;

        prevTrainingProgramIndex.value = visibleTrainingProgramIndex.value;
        const newIndex = Math.min(trainingPrograms.value.length - 1, visibleTrainingProgramIndex.value + 1);

        if (newIndex >= 0 && newIndex < trainingPrograms.value.length) {
            isTransitioningPrograms = true;
            visibleTrainingProgramIndex.value = newIndex;
            setTimeout(() => {
                isTransitioningPrograms = false;
            }, 350);
        }
    };

    // ==================== WATCHERS ====================
    watch(programs, () => {
        syncActiveProgram();
    });

    watch(visibleIndex, (newIndex, oldIndex) => {
        if (oldIndex !== undefined) {
            prevVisibleIndex.value = oldIndex;
        }
        programsVisible.value = false;
        exercisesVisible.value = false;

        if (!isValidIndex(newIndex, displayPrograms.value.length)) {
            clearTrainingProgramsState();
            return;
        }

        const program = displayPrograms.value[newIndex];
        if (program) {
            if (shouldLoadProgramsImmediately.value || isProgramsSectionVisible.value) {
                requestAnimationFrame(async () => {
                    await loadTrainingPrograms(program.id);
                    if (shouldLoadProgramsImmediately.value) {
                        shouldLoadProgramsImmediately.value = false;
                    }
                });
            }
        } else {
            clearTrainingProgramsState();
        }
    }, { immediate: true });

    watch(visibleTrainingProgramIndex, (newIndex, oldIndex) => {
        if (oldIndex !== undefined) {
            prevTrainingProgramIndex.value = oldIndex;
        }
        exercisesVisible.value = false;

        if (!isValidIndex(newIndex, trainingPrograms.value.length)) {
            programExercises.value = [];
            programExercisesLoading.value = false;
            return;
        }

        const program = trainingPrograms.value[newIndex];
        if (program) {
            nextTick(async () => {
                await loadProgramExercises(program.id, undefined);
                if (shouldLoadExercisesImmediately.value) {
                    shouldLoadExercisesImmediately.value = false;
                }
            });
        } else {
            programExercises.value = [];
            programExercisesLoading.value = false;
            programExercisesError.value = null;
            lastExercisesRequestKey = null;
            lastExercisesPromise = null;
        }
    });

    // Intersection Observers Logic
    watch(isProgramsSectionVisible, (isVisible) => {
        if (isVisible && !shouldLoadProgramsImmediately.value) {
            const program = displayPrograms.value[visibleIndex.value];
            if (program && !trainingProgramsLoading.value && trainingPrograms.value.length === 0) {
                requestAnimationFrame(async () => {
                    await loadTrainingPrograms(program.id);
                });
            }
        }
    });

    watch(isExercisesSectionVisible, (isVisible) => {
        if (isVisible && !shouldLoadExercisesImmediately.value) {
            const program = trainingPrograms.value[visibleTrainingProgramIndex.value];
            if (program && !programExercisesLoading.value && programExercises.value.length === 0) {
                requestAnimationFrame(async () => {
                    await loadProgramExercises(program.id);
                });
            }
        }
    });

    return {
        // State
        loading,
        error,
        disciplineVisible, programsVisible, exercisesVisible,
        programs, trainingPrograms, programExercises,
        visibleIndex, prevVisibleIndex, activeProgram,
        visibleTrainingProgramIndex, prevTrainingProgramIndex,
        trainingProgramsLoading, trainingProgramsError,
        programExercisesLoading, programExercisesError,
        activeProgramColor,

        // Computed
        displayPrograms, currentProgram, currentTrainingProgram,
        hasPrev, hasNext, hasPrevTrainingProgram, hasNextTrainingProgram,
        disciplineSlideDirection, slideDirection,

        // Methods
        loadCatalog, loadTrainingPrograms, loadProgramExercises,
        selectPrevProgram, selectNextProgram,
        selectPrevTrainingProgram, selectNextTrainingProgram,
        setVisibleIndex,

        // Utils (if needed)
        clearTrainingProgramsState,
    };
}
