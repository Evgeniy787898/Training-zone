import { watch, type Ref, type ShallowRef } from 'vue';
import { debounce } from '@/utils/debounce';

interface TimerSettings {
    work: number;
    rest: number;
    restBetweenSets: number;
    restBetweenExercises: number;
    rounds: number;
}

interface SessionData {
    trainingStarted: boolean;
    trainingCompleted: boolean;
    activeStage: string;
    summaryComment: string;
    exerciseResults: Record<string, number>;
    timerSettings: TimerSettings;
    tabataElapsed: number;
}

interface SessionPersistenceOptions {
    storageKey: Ref<string>;
    session: ShallowRef<{ status: string; notes?: any } | null>;
    loading: Ref<boolean>;
    trainingStarted: Ref<boolean>;
    trainingCompleted: Ref<boolean>;
    activeStage: Ref<string>;
    summaryComment: Ref<string>;
    exerciseResults: Ref<Record<string, number>>;
    timerSettings: Ref<TimerSettings>;
    tabataElapsed: Ref<number>;
}

export function useSessionPersistence(options: SessionPersistenceOptions) {
    const {
        storageKey,
        session,
        loading,
        trainingStarted,
        trainingCompleted,
        activeStage,
        summaryComment,
        exerciseResults,
        timerSettings,
        tabataElapsed
    } = options;

    const parseSessionNotes = (notes: any) => {
        if (!notes) return null;
        if (typeof notes === 'string') {
            try {
                return JSON.parse(notes);
            } catch (err) {
                console.warn('Unable to parse saved session notes', err);
                return null;
            }
        }
        if (typeof notes === 'object') return notes;
        return null;
    };

    const applySessionNotes = (notes: Record<string, any>) => {
        if (!notes) return;
        if (typeof notes.comment === 'string') {
            summaryComment.value = notes.comment;
        }
        if (Array.isArray(notes.results)) {
            const next: Record<string, number> = { ...exerciseResults.value };
            notes.results.forEach((result: any) => {
                if (result?.exerciseKey) {
                    next[result.exerciseKey] = Number(result.actual) || 0;
                }
            });
            exerciseResults.value = next;
        }
        if (notes.timer) {
            timerSettings.value = {
                ...timerSettings.value,
                ...notes.timer,
            };
            if (typeof notes.timer.elapsedSeconds === 'number') {
                tabataElapsed.value = notes.timer.elapsedSeconds;
            }
        }
        if (typeof notes.trainingStarted === 'boolean') {
            trainingStarted.value = notes.trainingStarted;
        }
        if (typeof notes.trainingCompleted === 'boolean') {
            trainingCompleted.value = notes.trainingCompleted;
        }
    };

    const loadPersistedState = () => {
        if (typeof window === 'undefined') return;
        try {
            const raw = window.localStorage.getItem(storageKey.value);
            const sessionNotes = parseSessionNotes(session.value?.notes);

            if (!raw) {
                trainingStarted.value = session.value?.status === 'in_progress';
                trainingCompleted.value = session.value?.status === 'done';
                activeStage.value = trainingCompleted.value ? 'results' : 'workout';
                summaryComment.value = '';
                exerciseResults.value = {};
                // Reset timer to defaults if needed, but preserve rounds if set
                timerSettings.value = {
                    work: 40,
                    rest: 20,
                    restBetweenSets: 30,
                    restBetweenExercises: 45,
                    rounds: timerSettings.value.rounds,
                };
                tabataElapsed.value = 0;

                if (sessionNotes) {
                    applySessionNotes(sessionNotes);
                }
                return;
            }

            const data = JSON.parse(raw) as Partial<SessionData>;
            trainingStarted.value = Boolean(data.trainingStarted);
            trainingCompleted.value = Boolean(data.trainingCompleted ?? session.value?.status === 'done');
            activeStage.value = data.activeStage ?? 'workout';
            summaryComment.value = data.summaryComment ?? '';
            exerciseResults.value = data.exerciseResults ?? {};
            timerSettings.value = { ...timerSettings.value, ...(data.timerSettings ?? {}) };
            tabataElapsed.value = data.tabataElapsed ?? 0;

            if (session.value?.status === 'done' && sessionNotes) {
                applySessionNotes(sessionNotes);
            }
        } catch (err) {
            console.warn('Unable to load persisted training state', err);
        }
    };

    const persistUserState = () => {
        if (typeof window === 'undefined' || loading.value) return;
        const payload: SessionData = {
            trainingStarted: trainingStarted.value,
            trainingCompleted: trainingCompleted.value,
            activeStage: activeStage.value,
            summaryComment: summaryComment.value,
            exerciseResults: exerciseResults.value,
            timerSettings: timerSettings.value,
            tabataElapsed: tabataElapsed.value,
        };
        window.localStorage.setItem(storageKey.value, JSON.stringify(payload));
    };

    const debouncedPersistUserState = debounce(persistUserState, 350);

    // Set up watchers
    // Set up watchers to auto-save when state changes
    watch(storageKey, () => {
        loadPersistedState();
    });

    watch(
        [
            trainingStarted,
            trainingCompleted,
            activeStage,
            summaryComment,
            timerSettings, // nested object
            exerciseResults, // nested object
        ],
        () => {
            debouncedPersistUserState();
        },
        { deep: true }
    );

    // Watch tabataElapsed separately or partially throttled if needed,
    // but for now we debounce it same as everything else.
    // Note: If the timer ticks every second, this will keep triggering persistence.
    // The debounce (350ms) might be too short if we want to avoid disk thrashing on every second.
    // However, for valid local persistence of a running timer, we do need frequent updates.
    // We'll trust the debounce to handle "bursts" of inputs, but for a steady 1s tick,
    // it effectively writes every second unless we increase debounce or throttle.
    // Let's stick to the plan: persist it.
    watch(tabataElapsed, () => {
        debouncedPersistUserState();
    });

    return {
        loadPersistedState,
        persistUserState,
        debouncedPersistUserState,
        savePersistedState: ({ immediate = false } = {}) => {
            if (immediate) {
                persistUserState();
            } else {
                debouncedPersistUserState();
            }
        }
    };
}
