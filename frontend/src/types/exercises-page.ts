import { generateDisciplineGradient } from '@/utils/colorUtils';
import type { TrainingProgram, ProgramExercise, TrainingDirection, ExerciseLevel } from './index';

export interface BaseProgram {
    id: string;
    title: string;
    subtitle: string;
    locked?: boolean;
    slug?: string;
    name?: string;
}

export interface DisplayProgram extends BaseProgram {
    color: string;
    gradient?: ReturnType<typeof generateDisciplineGradient>;
}

export type { TrainingProgram, ProgramExercise, TrainingDirection, ExerciseLevel };
