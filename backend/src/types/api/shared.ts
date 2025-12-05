/**
 * SHARED API TYPES
 * This file serves as the Single Source of Truth for types shared between Backend and Frontend.
 * Frontend imports these types via @backend-types alias.
 */

// --- ENUMS & CONSTANTS ---

export const TrainingSessionStatus = {
    planned: 'planned',
    in_progress: 'in_progress',
    done: 'done',
    skipped: 'skipped',
    rest: 'rest',
} as const;

export type TrainingSessionStatusValue = (typeof TrainingSessionStatus)[keyof typeof TrainingSessionStatus];

export const sessionStatusValues: TrainingSessionStatusValue[] = [
    TrainingSessionStatus.planned,
    TrainingSessionStatus.in_progress,
    TrainingSessionStatus.done,
    TrainingSessionStatus.skipped,
    TrainingSessionStatus.rest,
];

// --- CORE ENTITIES ---

export interface ThemeColor {
    r: number;
    g: number;
    b: number;
}

export interface ThemePalette {
    accent: ThemeColor;
    background: ThemeColor;
    textPrimary: ThemeColor;
    textSecondary: ThemeColor;
}

export interface Profile {
    id: string;
    telegramId: string;
    firstName: string;
    lastName?: string;
    username?: string;
    preferences?: {
        training_frequency?: number;
        training_goal?: string;
        themePalette?: ThemePalette;
        [key: string]: any;
    };
    goals?: {
        description?: string;
        [key: string]: any;
    };
    cover_image?: string;
    [key: string]: any;
}

export interface Exercise {
    exercise_key: string;
    name?: string;
    image_url?: string;
    technique?: string;
    target?: {
        level?: string;
        sets?: number;
        [key: string]: any;
    };
    [key: string]: any;
}

export interface TrainingSessionExerciseTarget {
    level?: string | null;
    sets?: number | null;
    reps?: number | null;
    durationSeconds?: number | null;
    [key: string]: any;
}

export interface TrainingSessionExercise {
    id: string;
    exercise_key?: string;
    exerciseKey?: string;
    profileId?: string | null;
    exercise_id?: string | null;
    exerciseId?: string | null;
    exercise_level_id?: string | null;
    exerciseLevelId?: string | null;
    level_code?: string | null;
    levelCode?: string | null;
    name?: string | null;
    target?: TrainingSessionExerciseTarget | null;
    actual?: number | null;
    actualReps?: number | null;
    actualSets?: number | null;
    completed_duration_seconds?: number | null;
    images?: string[];
    image_url?: string | null;
    programId?: string | null;
    userProgramId?: string | null;
    disciplineId?: string | null;
    order?: number | null;
    [key: string]: any;
}

export interface TrainingSession {
    id: string;
    profileId: string;
    plannedAt?: string | null;
    date?: string | null;
    sessionType?: string;
    status: TrainingSessionStatusValue;
    notes?: string | null;
    comment?: string | null;
    disciplineId?: string | null;
    programId?: string | null;
    userProgramId?: string | null;
    tabataRounds?: number | null;
    tabataTotalSeconds?: number | null;
    workIntervalSeconds?: number | null;
    restIntervalSeconds?: number | null;
    restBetweenSetsSeconds?: number | null;
    restBetweenExercisesSeconds?: number | null;
    completedAt?: string | null;
    exercises?: TrainingSessionExercise[];
    [key: string]: any;
}

// --- API RESPONSES ---

export interface ApiResponse<T> {
    data: T;
    status: number;
    message?: string;
    [key: string]: any;
}

export interface AuthResponse {
    token: string;
    profileId: string;
    [key: string]: any;
}

export interface PinVerificationResponse {
    valid: boolean;
    [key: string]: any;
}

export interface SessionTodayResponse {
    session: TrainingSession | null;
    source?: string | null;
    cachedAt?: string | null;
}

export interface SessionWeekResponse {
    week_start: string;
    week_end: string;
    sessions: TrainingSession[];
    source?: string | null;
}

export interface StructuredNotes {
    [key: string]: any;
}

export interface CreateSessionPayload {
    planned_at: string;
    status?: TrainingSessionStatusValue;
    notes?: string;
    [key: string]: any;
}

export interface UpdateSessionPayload {
    planned_at?: string;
    status?: TrainingSessionStatusValue;
    notes?: string;
    [key: string]: any;
}

export interface SessionIdParams {
    sessionId: string;
}

export interface SessionsDateQuery {
    date?: string;
}
