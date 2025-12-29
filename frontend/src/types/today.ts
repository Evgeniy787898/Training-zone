import type { ExerciseImageSource } from '@/utils/exerciseImages';

export type StageId = 'workout' | 'timer' | 'results';

export type PlanExercise = {
    key: string;
    name?: string | null;
    level?: string | number | null;
    levelLabel?: string | null;
    sets?: number | null;
    reps?: number | null;
    images?: string[];
};

export type ProgramDay = {
    rawDay: string | null;
    dayKey: string | null;
    cycleIndex: number | null;
    label?: string | null;
    isRestDay: boolean;
    exercises: PlanExercise[];
};

export type ExerciseCard = {
    key: string;
    exerciseTitle?: string;
    levelTitle?: string;  // Actual name of the level (e.g. 'Колено к локтю')
    levelLabel: string;   // Level number (e.g. 'Уровень 1.1')
    sets: number;
    reps: number;
    images: ExerciseImageSource[];
    imageUrl?: string;
    levelCode?: string;
    levelId?: string;
    tierLabel?: string | null;
    iconUrl?: string | null; // Parent exercise icon URL
};

export type MissingExercise = {
    key: string;
    name?: string;
    reason: string;
};
