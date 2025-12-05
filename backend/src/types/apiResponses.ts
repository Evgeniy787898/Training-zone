import type { AchievementsCachePayload } from '../modules/profile/achievementsFeed.js';
import type { ProfileSummaryPayload } from '../modules/profile/profileSummary.js';
import type { PaginationMeta } from './pagination.js';

export interface AchievementSummary {
    id: string;
    profileId: string;
    title: string;
    description: string | null;
    awardedAt: string | Date;
    triggerSource: string | null;
}

export interface AchievementsResponse extends Omit<AchievementsCachePayload, 'achievements'> {
    achievements: Array<Partial<AchievementSummary>>;
    cached?: boolean;
}

export interface TelegramAuthResponse {
    token: string;
    profileId: string;
    user: Record<string, unknown> | null;
    csrfToken: string;
}

export interface VerifyPinResponse {
    valid: boolean;
    message: string;
    token?: string;
    profileId?: string;
    csrfToken?: string;
}

export interface AssistantReplyLatencyStats {
    last_ms: number | null;
    average_ms: number | null;
    samples: number;
    slow_threshold_ms: number | null;
    slow_turns: number;
    slow_ratio: number | null;
    worst_ms: number | null;
    last_updated_at: string | null;
}

export interface AssistantReplyResponse {
    reply: string | null;
    intent: string;
    confidence: number;
    candidates: Array<{ intent: string; confidence: number }>;
    saved: boolean;
    latency_ms: number;
    latency_stats: AssistantReplyLatencyStats;
    slow_response: boolean;
    latency_alert: Record<string, unknown> | null;
}

export interface AssistantCommandInterpretationResponse {
    intent: string;
    raw_intent: string | null;
    confidence: number;
    candidates: Array<{ intent: string; confidence: number }>;
    entities: Record<string, unknown>;
    slots: Record<string, unknown>;
    needs_clarification: boolean;
    follow_up: string | null;
    history: string[];
    profile_id: string | null;
}

export interface AssistantNoteSummary {
    id: string;
    profileId: string;
    title: string | null;
    content: string;
    tags: string[];
    source: string;
    metadata: Record<string, unknown>;
    createdAt: string | Date;
}

export interface AssistantNotesResponse {
    notes: AssistantNoteSummary[];
}

export interface AssistantNoteResponse {
    note: AssistantNoteSummary;
}

export interface AssistantAdviceResponse {
    advice: string;
    nextSteps: string[];
    tips: string[];
    metadata: Record<string, unknown>;
}

export interface AssistantStateSnapshot {
    status: string;
    last_user_message_at: string | null;
    last_assistant_message_at: string | null;
    last_intent: string | null;
    last_mode: string | null;
    total_user_messages: number;
    total_assistant_messages: number;
    total_turns: number;
    closed_at: string | null;
    closed_reason: string | null;
    closed_summary: string | null;
    last_updated_at: string | null;
    last_latency_ms: number | null;
    slow_response: boolean;
    latency_stats: AssistantReplyLatencyStats | null;
    latency_alert: Record<string, unknown> | null;
    latency_alert_history: Record<string, unknown>[];
}

export interface AssistantStateResponse {
    state: AssistantStateSnapshot;
    updated_at: string | null;
    expires_at: string | null;
}

export interface DailyAdviceResponse {
    type: string;
    shortText: string;
    fullText: string;
    ideas: string[];
    icon: string;
    theme: string;
}

export type ProfileSummaryResponse = ProfileSummaryPayload;

export interface ProfilePreferencesResponse {
    profile: {
        id: string;
        notificationTime?: string | null;
        timezone?: string | null;
        preferences?: unknown;
        notificationsPaused?: boolean | null;
        [key: string]: unknown;
    };
    effective_at: string;
}

export interface ThemePaletteColor {
    r: number;
    g: number;
    b: number;
}

export interface ThemePalette {
    accent: ThemePaletteColor;
    background: ThemePaletteColor;
    textPrimary: ThemePaletteColor;
    textSecondary: ThemePaletteColor;
}

export interface ThemePaletteResponse {
    palette: ThemePalette;
    source: 'stored' | 'default';
    updated_at: string | null;
}

export interface ReportVolumeTrendResponse {
    report: 'volume_trend';
    range: string;
    chart: Array<{
        date: string;
        volume: number;
        status: string | null;
    }>;
    summary: {
        total_volume: number;
        average_volume: number;
        period_sessions: number;
    };
    source: 'database' | 'cache';
    fallback: boolean;
    generated_at: string;
}

export interface ReportRpeDistributionResponse {
    report: 'rpe_distribution';
    range: string;
    chart: Array<{
        label: string;
        value: number;
    }>;
    summary: {
        total_sessions: number;
        heavy_share: number;
        light_share: number;
    };
    source: 'database' | 'cache';
    fallback: boolean;
    generated_at: string;
}

export type ReportResponse = ReportVolumeTrendResponse | ReportRpeDistributionResponse;

export interface ExerciseLevelSummary {
    id: string;
    exerciseKey: string;
    level: string;
    title: string;
    execution: string;
    technique: string;
    improvement: string;
    sets: number | null;
    reps: number | null;
    image1: string | null;
    image2: string | null;
    image3: string | null;
    disciplineId: string | null;
    orderIndex: number | null;
}

export interface ExerciseCatalogItem {
    key: string;
    title: string;
    focus: string;
    description: string;
    cue: string;
    levels: ExerciseLevelSummary[];
    latest_progress: {
        level: string | null;
        decision: string | null;
        session_date: string | null;
        updated_at: string | null;
    } | null;
}

export interface ExerciseCatalogResponse {
    items: Array<Partial<ExerciseCatalogItem>>;
    generated_at: string;
    pagination: PaginationMeta;
    cached?: boolean;
}

export interface ExerciseListItem {
    id: string;
    exerciseKey: string;
    title: string;
    focus: string | null;
    description: string | null;
    cue: string | null;
    programId: string | null;
}

export type ExerciseListResponse = Array<Partial<ExerciseListItem>>;

export interface ExerciseHistoryEntry {
    level_target: string | null;
    level_result: string | null;
    volume_target: number | null;
    volume_actual: number | null;
    rpe: number | null;
    decision: string | null;
    notes: string | null;
    session_date: string | null;
    recorded_at: Date;
}

export interface ExerciseHistoryResponse {
    exercise: string;
    items: ExerciseHistoryEntry[];
}

export interface ExerciseLevelsResponse {
    exercise_key: string;
    items: Array<{
        id: string;
        exerciseKey: string;
        level: string;
        title: string;
        execution: string;
        technique: string;
        improvement: string;
        sets: number | null;
        reps: number | null;
        image1: string | null;
        image2: string | null;
        image3: string | null;
        disciplineId: string | null;
        orderIndex: number | null;
    }>;
}

export interface SessionExercisePayload {
    id: string;
    exercise_key: string;
    exerciseKey: string;
    exercise_id: string | null;
    exerciseId: string | null;
    exercise_level_id: string | null;
    exerciseLevelId: string | null;
    level_code: string | null;
    levelCode: string | null;
    profileId: string | null;
    name: string | null;
    target: {
        level: string | null;
        sets: number | null;
        reps: number | null;
        durationSeconds: number | null;
    };
    actual: number | null;
    actualReps: number | null;
    actualSets: number | null;
    completed_duration_seconds: number | null;
    order: number | null;
    images: string[];
    image_url: string | null;
    programId: string | null;
    userProgramId: string | null;
    disciplineId: string | null;
}

export interface SessionPayload {
    id: string;
    profileId: string;
    status: string;
    notes: string | null;
    disciplineId: string | null;
    programId: string | null;
    userProgramId: string | null;
    comment?: string | null;
    tabataRounds?: number | null;
    tabataTotalSeconds?: number | null;
    workIntervalSeconds?: number | null;
    restIntervalSeconds?: number | null;
    restBetweenSetsSeconds?: number | null;
    restBetweenExercisesSeconds?: number | null;
    plannedAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    exercises: SessionExercisePayload[];
    [key: string]: unknown;
}

export interface SessionTodayResponse {
    session: SessionPayload | null;
    source: 'database';
}

export interface SessionWeekResponse {
    week_start: string;
    week_end: string;
    sessions: SessionPayload[];
    source: 'database';
}

export interface SessionSingleResponse {
    session: SessionPayload;
}

export interface SessionDeleteResponse {
    message: string;
}

export interface UserProgramSummary {
    id: string;
    profileId: string;
    disciplineId: string | null;
    programId: string | null;
    initialLevels: Record<string, number> | null;
    currentLevels: Record<string, number> | null;
    isActive: boolean;
    createdAt: string | Date;
    updatedAt: string | Date;
    discipline: {
        id: string;
        name: string;
        description: string | null;
        imageUrl: string | null;
        isActive: boolean | null;
        createdAt: string | Date;
        updatedAt: string | Date;
    } | null;
    program: {
        id: string;
        disciplineId: string | null;
        name: string;
        description: string | null;
        frequency: number | null;
        restDay: string | null;
        programData: unknown;
        isActive: boolean | null;
        createdAt: string | Date;
        updatedAt: string | Date;
    } | null;
}

export interface UserProgramResponse {
    userProgram: UserProgramSummary | null;
}

export interface UserProgramDetailsResponse extends UserProgramSummary {
    source: 'database';
    fallback: boolean;
}
