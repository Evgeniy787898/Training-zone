export interface TrainingSessionExercise {
    exercise_key: string;
    actual?: {
        sets?: number;
        reps?: number;
        weight?: number;
        [key: string]: any;
    };
    target?: {
        sets?: number;
        reps?: number;
        weight?: number;
        [key: string]: any;
    };
    [key: string]: any;
}

export interface ProgressDelta {
    sets: number;
    reps: number;
    weight: number;
    hasChange: boolean;
    label: string;
}

/**
 * Calculates the difference between current and previous session for an exercise
 */
export function calculateProgressDelta(
    current: { sets?: number | string; reps?: number | string; weight?: number | string },
    previous?: TrainingSessionExercise | null
): ProgressDelta | null {
    if (!previous?.actual && !previous?.target) return null;

    const prevSets = previous.actual?.sets ?? previous.target?.sets ?? 0;
    const prevReps = previous.actual?.reps ?? previous.target?.reps ?? 0;
    const prevWeight = previous.actual?.weight ?? previous.target?.weight ?? 0;

    const currSets = Number(current.sets) || 0;
    const currReps = Number(current.reps) || 0;
    const currWeight = Number(current.weight) || 0;

    // Don't calculate delta if we don't have enough data
    if (currSets === 0 && currReps === 0 && currWeight === 0) return null;
    if (prevSets === 0 && prevReps === 0 && prevWeight === 0) return null;

    const deltaSets = currSets - prevSets;
    const deltaReps = currReps - prevReps;
    const deltaWeight = currWeight - prevWeight;

    const hasChange = deltaSets !== 0 || deltaReps !== 0 || deltaWeight !== 0;

    const parts: string[] = [];
    if (Math.abs(deltaWeight) > 0) parts.push(`${deltaWeight > 0 ? '+' : ''}${deltaWeight}кг`);
    if (Math.abs(deltaSets) > 0) parts.push(`${deltaSets > 0 ? '+' : ''}${deltaSets} подх.`);
    if (Math.abs(deltaReps) > 0) parts.push(`${deltaReps > 0 ? '+' : ''}${deltaReps} повт.`);

    return {
        sets: deltaSets,
        reps: deltaReps,
        weight: deltaWeight,
        hasChange,
        label: parts.join(', '),
    };
}

export function getProgressClass(delta: ProgressDelta | null): string {
    if (!delta || !delta.hasChange) return '';
    // Positive progress: more weight OR same weight+more reps OR same weight+same reps+more sets
    // This is a naive heuristic. 
    // Generally: more is green, less is red.
    // We check the "most significant" metric first.

    if (delta.weight > 0) return 'positive';
    if (delta.weight < 0) return 'negative';

    if (delta.reps > 0) return 'positive';
    if (delta.reps < 0) return 'negative';

    if (delta.sets > 0) return 'positive';
    if (delta.sets < 0) return 'negative';

    return '';
}
