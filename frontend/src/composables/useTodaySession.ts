import { computed, ref, watch } from 'vue';
import { format, startOfDay, differenceInCalendarDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { storeToRefs } from 'pinia';
import { useAppStore } from '@/stores/app';
import { cachedApiClient as apiClient } from '@/services/cachedApi';
import { createStableShallowRef } from '@/utils/reactivity';
import { memoizeOne } from '@/utils/memoize';
import { extractProgramPlan } from '@/utils/programParser';
import { pickLevel, collectImages } from '@/utils/levelLogic';
import { normalizeDayKey, weekDayOrder } from '@/utils/dayNormalization';
import type { TrainingSession, ProgramExercise as ProgramExerciseType, UserProgramSnapshot } from '@/types';
import type { ProgramDay, PlanExercise, ExerciseCard, MissingExercise } from '@/types/today';

export function useTodaySession() {
    const appStore = useAppStore();
    const { programRevision, exerciseLevels: storeExerciseLevels } = storeToRefs(appStore);

    const selectedDate = ref(new Date());
    const loading = ref(true);
    const error = ref<Error | null>(null);

    const { state: userProgram, sync: syncUserProgram } = createStableShallowRef<UserProgramSnapshot | null>(null);
    const { state: programPlan, sync: syncProgramPlan } = createStableShallowRef<ProgramDay[]>([]);
    const { state: programExercises, sync: syncProgramExercises } = createStableShallowRef<ProgramExerciseType[]>([]);
    const { state: session, sync: syncSession } = createStableShallowRef<TrainingSession | null>(null);
    const sessionSource = ref<string | null>(null);
    const initialLoadComplete = ref(false);
    const programContextReady = ref(false);

    const memoizedExtractProgramPlan = memoizeOne(extractProgramPlan);

    const exerciseLevels = computed(() => storeExerciseLevels.value || new Map());
    const hasProgram = computed(() => Boolean(userProgram.value?.program?.id));

    const syncProgramFromStore = () => {
        const snapshot = appStore.getProgramContextSnapshot();
        syncUserProgram(snapshot.userProgram ?? null);
        syncProgramPlan(memoizedExtractProgramPlan(snapshot.userProgram?.program?.programData));
        syncProgramExercises(Array.isArray(snapshot.exercises) ? snapshot.exercises : []);
    };

    const planByDay = computed(() => {
        const map = new Map<string, ProgramDay>();
        for (const day of programPlan.value) {
            if (day.dayKey) {
                map.set(day.dayKey, day);
            }
        }
        return map;
    });

    const planByCycleIndex = computed(() => {
        const map = new Map<number, ProgramDay>();
        for (const day of programPlan.value) {
            if (day.cycleIndex !== null) {
                map.set(day.cycleIndex, day);
            }
        }
        return map;
    });

    const activeProgram = computed(() => userProgram.value?.program);

    const programStartDate = computed(() => {
        const start = activeProgram.value?.startedAt || (userProgram.value as any)?.startedAt;
        return start ? startOfDay(new Date(start)) : null;
    });

    const isBeforeProgramStart = computed(() => {
        if (!programStartDate.value) return false;
        return startOfDay(selectedDate.value).getTime() < programStartDate.value.getTime();
    });

    const programStartLabel = computed(() => (programStartDate.value ? format(programStartDate.value, 'd MMMM yyyy', { locale: ru }) : ''));

    const cyclePlanLength = computed(() => {
        let maxIndex = -1;
        for (const day of programPlan.value) {
            if (day.cycleIndex !== null && day.cycleIndex > maxIndex) {
                maxIndex = day.cycleIndex;
            }
        }
        return maxIndex + 1;
    });

    const hasExplicitWeekdays = computed(() => {
        return programPlan.value.some((day) => {
            const key = day.dayKey?.toLowerCase();
            if (!key) return false;
            return weekDayOrder.includes(key as any);
        });
    });

    const selectedDayKey = computed(
        () => normalizeDayKey(weekDayOrder[selectedDate.value.getDay()]) ?? weekDayOrder[selectedDate.value.getDay()],
    );

    const todaysCycleIndex = computed(() => {
        if (!programStartDate.value || !planByCycleIndex.value.size) return null;
        const diff = differenceInCalendarDays(startOfDay(selectedDate.value), programStartDate.value);
        if (diff < 0) return null;
        const length = cyclePlanLength.value;
        if (length <= 0) return null;
        return diff % length;
    });

    const todaysPlan = computed(() => {
        if (hasExplicitWeekdays.value) {
            if (selectedDayKey.value) {
                return planByDay.value.get(selectedDayKey.value) ?? null;
            }
            return null;
        }

        const cycleIndex = todaysCycleIndex.value;
        if (cycleIndex !== null) {
            return planByCycleIndex.value.get(cycleIndex) ?? null;
        }
        return null;
    });

    const todaysExercises = computed<PlanExercise[]>(() => {
        if (todaysPlan.value?.exercises?.length) {
            return todaysPlan.value.exercises;
        }
        return [];
    });

    const isTrainingDay = computed(() => {
        if (todaysPlan.value?.isRestDay) {
            return false;
        }
        return todaysExercises.value.length > 0;
    });

    const isRestDay = computed(() => {
        if (!hasProgram.value) return false;
        if (session.value?.status === 'rest') return true;
        if (todaysPlan.value?.isRestDay) return true;
        if (hasExplicitWeekdays.value && !todaysPlan.value) return true;
        return !isTrainingDay.value;
    });

    const isPastDate = computed(() => startOfDay(selectedDate.value).getTime() < startOfDay(new Date()).getTime());
    const showHistoricalPlaceholder = computed(() => isPastDate.value && !session.value && isTrainingDay.value);

    const exercisesByKey = computed(() => {
        const map = new Map<string, ProgramExerciseType>();
        for (const exercise of programExercises.value) {
            const key = exercise.exerciseKey || (exercise as any).key;
            if (key) {
                map.set(key, exercise);
            }
        }
        return map;
    });

    const resolveLevelReference = (exerciseKey: string): number | null => {
        const map = userProgram.value?.currentLevels || userProgram.value?.initialLevels || {};
        const raw = map?.[exerciseKey];
        if (raw === undefined || raw === null) {
            return null;
        }
        if (typeof raw === 'number' && Number.isFinite(raw)) {
            return raw;
        }
        if (typeof raw === 'object') {
            if (typeof raw.level === 'number' && Number.isFinite(raw.level)) {
                return raw.level;
            }
            if (typeof raw.currentLevel === 'number' && Number.isFinite(raw.currentLevel)) {
                return raw.currentLevel;
            }
        }
        if (typeof raw === 'string') {
            const parsed = Number(raw);
            return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
    };

    const exercisePreparation = computed(() => {
        const cards: ExerciseCard[] = [];
        const missing: MissingExercise[] = [];

        if (!hasProgram.value) {
            return { cards, missing };
        }

        if (!todaysExercises.value.length) {
            return { cards, missing };
        }

        todaysExercises.value.forEach((planExercise: PlanExercise) => {
            const exerciseKey = planExercise.key;
            if (!exerciseKey) return;
            const exercise = exercisesByKey.value.get(exerciseKey) as ProgramExerciseType | undefined;
            const levels = exerciseLevels.value.get(exerciseKey) ?? [];
            const levelReference = planExercise.level ?? resolveLevelReference(exerciseKey);
            const level = pickLevel(levels, levelReference ?? undefined);

            const exerciseTitle = exercise ? (exercise as ProgramExerciseType).title : undefined;
            const hasPlanDetails = Boolean(planExercise.level || planExercise.levelLabel || planExercise.sets || planExercise.reps);

            if (!exercise && !level && !hasPlanDetails) {
                missing.push({
                    key: exerciseKey,
                    name: planExercise.name || exerciseTitle,
                    reason: 'Данные упражнения недоступны',
                });
                return;
            }

            const sets = typeof planExercise.sets === 'number' ? planExercise.sets : Number(level?.sets ?? exercise?.sets ?? 3);
            const reps = typeof planExercise.reps === 'number' ? planExercise.reps : Number(level?.reps ?? exercise?.reps ?? 10);

            const images = collectImages(level, exercise, planExercise.images || []);

            const levelLabel =
                planExercise.levelLabel ??
                (level?.level ? `Уровень ${level.level}` : undefined) ??
                exercise?.difficulty ??
                'Базовый';

            const tierLabel = (level as any)?.tierLabel ?? (exercise as any)?.tierLabel ?? null;

            cards.push({
                key: exerciseKey,
                exerciseTitle: exerciseTitle || planExercise.name || undefined,
                levelTitle: level?.title || level?.name || undefined,
                levelLabel: String(levelLabel),
                sets,
                reps,
                images,
                levelCode: level ? String(level.level) : undefined,
                levelId: level?.id,
                tierLabel,
                iconUrl: exercise?.iconUrl ?? null, // Parent exercise icon for stepper
            });
        });

        return { cards, missing };
    });

    const handleDateChange = async (date: Date) => {
        selectedDate.value = date;
        const dateStr = startOfDay(date).toISOString();
        loading.value = true;
        error.value = null;

        // Reset session state before loading
        syncSession(null);

        try {
            const response = await apiClient.getTodaySession(dateStr);
            // SessionTodayResponse = { session: TrainingSession | null, source?, cachedAt? }
            // When session is null, we should pass null, not the wrapper object
            const sessionData = 'session' in response ? response.session : response;
            syncSession(sessionData as TrainingSession | null);
        } catch (err: any) {
            console.error('Failed to load session:', err);
            // If 404, it just means no session exists
            if (err.response && err.response.status === 404) {
                syncSession(null);
            } else {
                error.value = err;
            }
        } finally {
            loading.value = false;
            initialLoadComplete.value = true;
        }
    };

    const applyOptimisticSessionUpdate = async <T>(
        patch: Partial<TrainingSession>,
        action: () => Promise<T>,
    ) => {
        const previous = session.value ? { ...session.value } : null;

        if (session.value) {
            syncSession({ ...session.value, ...patch });
        }

        try {
            const result = await action();
            const nextSession = (result as any)?.session ?? result;
            if (nextSession) {
                syncSession(nextSession as TrainingSession);
            }
            return nextSession as T;
        } catch (error) {
            if (previous) {
                syncSession(previous);
            }
            throw error;
        }
    };

    const reloadAll = () => handleDateChange(selectedDate.value);

    const ensureSession = async (status: 'planned' | 'in_progress' | 'done'): Promise<string> => {
        if (session.value?.id) {
            if (status && session.value.status !== status) {
                try {
                    const response = await applyOptimisticSessionUpdate({ status } as any, () =>
                        apiClient.updateSession(session.value!.id, { status }),
                    );
                    syncSession((response as any)?.session ?? session.value);
                    sessionSource.value = 'database';
                } catch (err) {
                    console.warn('Could not update session status', err);
                }
            }
            return session.value.id;
        }

        const planned = new Date(selectedDate.value);
        planned.setHours(10, 0, 0, 0);

        const created = await apiClient.createSession({
            planned_at: planned.toISOString(),
            status,
        });

        syncSession((created as any)?.session ?? created);
        sessionSource.value = (created as any)?.source ?? 'database';

        if (!session.value?.id) {
            throw new Error('Session ID missing after creation');
        }

        return session.value.id;
    };

    // Initial Sync
    console.log('[useTodaySession] Starting initialization...');
    try {
        syncProgramFromStore();
        programContextReady.value = true;
        console.log('[useTodaySession] syncProgramFromStore success, hasProgram:', Boolean(userProgram.value?.program?.id));
    } catch (err: any) {
        console.error('[useTodaySession] Failed to sync program from store:', err);
        programContextReady.value = true; // Still mark as ready even on error
        error.value = err;
        loading.value = false; // CRITICAL: Set loading to false on error!
    }

    // Initial load: fetch session for today's date
    if (!error.value) {
        console.log('[useTodaySession] Calling handleDateChange for initial load...');
        handleDateChange(selectedDate.value).catch(err => {
            console.error('[useTodaySession] Failed initial session load:', err);
        });
    } else {
        console.log('[useTodaySession] Skipping initial load due to error');
    }

    // Watch for program updates
    watch(programRevision, () => {
        try {
            syncProgramFromStore();
        } catch (err) {
            console.error('Failed to sync program on revision update:', err);
        }
    });

    return {
        selectedDate,
        loading,
        initialLoadComplete,
        programContextReady,
        error,
        session,
        sessionSource,
        userProgram,
        programPlan,
        programExercises,
        exerciseLevels,

        // Computed
        todaysExercises,
        exercisePreparation,
        todaysPlan,
        hasProgram,
        isTrainingDay,
        isRestDay,
        isPastDate,
        showHistoricalPlaceholder,
        programStartDate,
        isBeforeProgramStart,
        programStartLabel,
        exercisesByKey,
        planByDay,
        planByCycleIndex,
        cyclePlanLength,
        hasExplicitWeekdays,
        selectedDayKey,
        todaysCycleIndex,

        // Methods
        handleDateChange,
        syncProgramFromStore,
        reloadAll,
        syncSession,
        applyOptimisticSessionUpdate,
        ensureSession
    };
}

