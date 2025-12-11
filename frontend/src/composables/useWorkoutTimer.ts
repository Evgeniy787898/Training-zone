import { ref, readonly } from 'vue';

export function useWorkoutTimer() {
    const timerSettings = ref({
        work: 40,
        rest: 20,
        restBetweenSets: 30,
        restBetweenExercises: 45,
        rounds: 4,
    });

    const tabataElapsed = ref(0);
    const timerFocusMode = ref(false);
    const sparkState = ref<Record<string, number>>({});
    const sparkTimers = new Map<string, ReturnType<typeof setTimeout>>();

    const updateTimerSettings = (next: Partial<typeof timerSettings.value>) => {
        timerSettings.value = { ...timerSettings.value, ...next };
    };

    const updateTimerElapsed = (elapsed: number) => {
        tabataElapsed.value = elapsed;
    };

    const toggleFocusMode = () => {
        timerFocusMode.value = !timerFocusMode.value;
    };

    const disableFocusMode = () => {
        timerFocusMode.value = false;
    };

    const isSparkActive = (key: string) => Boolean(sparkState.value[key]);

    const scheduleSpark = (key: string) => {
        const stamp = Date.now();
        sparkState.value = { ...sparkState.value, [key]: stamp };

        const pending = sparkTimers.get(key);
        if (pending) {
            clearTimeout(pending);
        }

        const timeout = setTimeout(() => {
            const next = { ...sparkState.value };
            if (next[key] === stamp) {
                delete next[key];
                sparkState.value = next;
            }
            sparkTimers.delete(key);
        }, 900);

        sparkTimers.set(key, timeout);
    };

    // Cleanup function to be called on unmount
    const cleanupTimers = () => {
        sparkTimers.forEach((timeout) => clearTimeout(timeout));
        sparkTimers.clear();
        timerFocusMode.value = false;
    };

    return {
        timerSettings,
        tabataElapsed,
        timerFocusMode,
        sparkState: readonly(sparkState), // Readonly to prevent outside mutation without scheduleSpark

        updateTimerSettings,
        updateTimerElapsed,
        toggleFocusMode,
        disableFocusMode,
        isSparkActive,
        scheduleSpark,
        cleanupTimers
    };
}
