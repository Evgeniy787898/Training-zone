import { z } from 'zod';

export const TrainingSessionStatus = {
    planned: 'planned',
    in_progress: 'in_progress',
    done: 'done',
    skipped: 'skipped',
} as const;

export type TrainingSessionStatusValue = (typeof TrainingSessionStatus)[keyof typeof TrainingSessionStatus];

export type StructuredNotes = {
    comment?: string;
    program?: {
        id?: string;
        selectionId?: string;
        disciplineId?: string;
    } | null;
    timer?: Record<string, any> | null;
    results?: Array<Record<string, any>>;
};

export const sessionStatusValues: TrainingSessionStatusValue[] = [
    TrainingSessionStatus.planned,
    TrainingSessionStatus.in_progress,
    TrainingSessionStatus.done,
    TrainingSessionStatus.skipped,
];



