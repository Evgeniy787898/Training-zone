import type { ExerciseCard } from '@/types/today';

export const evaluateResultStatus = (card: ExerciseCard, actual: number) => {
    if (!actual) return 'pending' as const;
    const target = card.reps ?? 0;
    return actual >= target ? ('success' as const) : ('danger' as const);
};
