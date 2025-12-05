// User and Profile Types
export interface TelegramUser {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    is_premium?: boolean;
    allows_write_to_pm?: boolean;
}

// Re-export shared types from backend
export type {
    TrainingSessionStatusValue,
    ThemeColor,
    ThemePalette,
    Profile,
    Exercise,
    TrainingSessionExerciseTarget,
    TrainingSessionExercise,
    TrainingSession,
    ApiResponse,
    AuthResponse,
    PinVerificationResponse,
    SessionTodayResponse,
    SessionWeekResponse
} from '@backend-types/api/shared';

// Re-export constants
export {
    TrainingSessionStatus,
    sessionStatusValues
} from '@backend-types/api/shared';

// Frontend-specific types (extended or UI-only)

export interface ProfileSummary {
    profile: import('@backend-types/api/shared').Profile;
    highlights?: {
        focus?: string;
        next_goal?: string;
        hero_image?: string;
        [key: string]: any;
    };
    upcoming_session?: {
        focus?: string;
        date?: string;
        [key: string]: any;
    };
    adherence?: {
        adherence_percent?: number;
        [key: string]: any;
    };
    [key: string]: any;
}

export interface ThemePaletteResponse {
    palette: import('@backend-types/api/shared').ThemePalette;
    source: 'stored' | 'default';
    updated_at: string | null;
}

export interface AssistantLatencyStats {
    lastMs: number | null;
    averageMs: number | null;
    samples: number;
    slowThresholdMs: number;
    slowTurns: number;
    slowRatio: number;
    worstMs: number | null;
    lastUpdatedAt: string | null;
}

export interface AssistantLatencyAlert {
    severity: 'warn' | 'error';
    reason: 'slow_turn' | 'slow_ratio' | 'average_latency';
    message: string;
    latencyMs: number | null;
    thresholdMs: number;
    slowRatio: number;
    averageMs: number | null;
    samples: number;
    triggeredAt: string;
}

export interface AssistantSessionState {
    status: 'active' | 'idle' | 'closed';
    lastUserMessageAt: string | null;
    lastAssistantMessageAt: string | null;
    lastIntent: string | null;
    lastMode: string | null;
    totalUserMessages: number;
    totalAssistantMessages: number;
    totalTurns: number;
    closedAt: string | null;
    closedReason: string | null;
    closedSummary: Record<string, any> | null;
    lastUpdatedAt: string | null;
    lastLatencyMs: number | null;
    slowResponse: boolean;
    latencyStats: AssistantLatencyStats | null;
    latencyAlert: AssistantLatencyAlert | null;
    latencyAlertHistory: AssistantLatencyAlert[];
}

export interface AssistantReplyResponse {
    reply: string | null;
    intent?: string;
    confidence?: number;
    candidates?: string[];
    saved?: boolean;
    latency_ms?: number;
    latency_stats?: {
        last_ms?: number;
        average_ms?: number;
        samples?: number;
        slow_threshold_ms?: number;
        slow_turns?: number;
        slow_ratio?: number;
        worst_ms?: number;
        last_updated_at?: string;
    };
    slow_response?: boolean;
    latency_alert?: {
        severity?: 'warn' | 'error';
        reason?: 'slow_turn' | 'slow_ratio' | 'average_latency';
        message?: string;
        latency_ms?: number;
        threshold_ms?: number;
        slow_ratio?: number;
        average_ms?: number | null;
        samples?: number;
        triggered_at?: string;
    };
}

// Exercise Types
export interface ExerciseCatalogItem {
    key: string;
    exerciseKey?: string;
    title: string;
    focus?: string;
    description?: string;
    cue?: string;
    tags?: string[];
    levels?: ExerciseLevel[];
    media?: {
        video?: string;
        image?: string;
    };
    latest_progress?: {
        level?: string;
        session_date?: string;
    };
    [key: string]: any;
}

export interface ExerciseLevel {
    id: string;
    exerciseKey: string;
    level: string;
    name?: string;
    title?: string;
    description?: string;
    execution?: string;
    technique?: string;
    improvement?: string;
    image1?: string;
    image2?: string;
    image3?: string;
    sets?: number | null;
    reps?: number | null;
    orderIndex?: number | null;
    [key: string]: any;
}

export interface ExerciseLevelsResponse {
    exercise_key?: string;
    items: ExerciseLevel[];
}

export interface ExerciseHistoryItem {
    id: string;
    sessionId: string;
    exerciseKey: string;
    levelResult?: string;
    rpe?: number;
    decision?: string;
    session?: {
        date?: string;
        [key: string]: any;
    };
    [key: string]: any;
}

// Training Program Types
export interface TrainingDirection {
    id: string;
    slug?: string;
    name: string;
    description?: string;
    isActive: boolean;
    createdAt?: string;
    updatedAt?: string;
    [key: string]: any;
}

export interface TrainingDiscipline {
    id: string;
    name: string;
    description?: string;
    imageUrl?: string;
    isActive: boolean;
    createdAt?: string;
    updatedAt?: string;
    [key: string]: any;
}

export interface TrainingProgram {
    id: string;
    name: string;
    description?: string;
    frequency: number;
    restDay: string;
    programData: any;
    disciplineId?: string;
    discipline?: {
        id: string;
        name: string;
        [key: string]: any;
    };
    isActive?: boolean;
    createdAt?: string;
    updatedAt?: string;
    locked?: boolean;
    [key: string]: any;
}

export type UserProgramLevels = Record<string, number | { level?: number; currentLevel?: number }>;

export interface UserProgramSnapshot {
    id: string;
    profileId?: string;
    disciplineId: string;
    programId: string;
    initialLevels: UserProgramLevels;
    currentLevels: UserProgramLevels;
    isActive?: boolean;
    createdAt?: string;
    updatedAt?: string;
    discipline?: TrainingDiscipline | null;
    program?: TrainingProgram | null;
    source?: string | null;
}

// Exercise from exercises table
export interface ProgramExercise {
    id: string;
    exerciseKey: string;
    title: string;
    focus?: string | null;
    description?: string | null;
    cue?: string | null;
    programId?: string | null;
    iconUrl?: string | null;
    iconUrlHover?: string | null;
    createdAt?: string;
    updatedAt?: string;
    [key: string]: any;
}

// Report Types
export interface ReportData<TChart = unknown, TSummary = Record<string, unknown>> {
    report?: string;
    range?: string;
    chart?: TChart;
    summary?: TSummary;
    source?: string | null;
    fallback?: boolean;
    message?: string | null;
    generated_at?: string;
    cachedAt?: string | null;
    metadata?: Record<string, unknown>;
    [key: string]: unknown;
}

export interface VolumeTrendSummary extends Record<string, number | undefined> {
    period_sessions?: number;
    average_volume?: number;
    total_volume?: number;
}

export interface VolumeTrendChartPoint {
    date: string;
    volume: number;
    label?: string;
}

export type VolumeTrendReport = ReportData<VolumeTrendChartPoint[], VolumeTrendSummary> & {
    report?: 'volume_trend';
};

export interface RpeDistributionSummary extends Record<string, number | undefined> {
    heavy_share?: number;
    moderate_share?: number;
    light_share?: number;
    total_sessions?: number;
}

export interface RpeDistributionPoint {
    label: string;
    value: number;
    options?: any;
}

export type RpeDistributionReport = ReportData<RpeDistributionPoint[], RpeDistributionSummary> & {
    report?: 'rpe_distribution';
};

export interface PaginationMeta {
    page: number;
    page_size: number;
    total?: number;
    total_pages?: number;
    has_more: boolean;
}

export interface AssistantNote {
    id: string;
    title?: string | null;
    content: string;
    created_at: string;
    createdAt?: string;
    tags?: string[];
    archived?: boolean;
    metadata?: Record<string, any> | null;
}

export interface AssistantNotesResponse {
    notes: AssistantNote[];
    pagination?: PaginationMeta;
    source?: string | null;
    fallback?: boolean;
    message?: string | null;
    cachedAt?: string | null;
}

export interface AchievementResponse {
    achievements: Achievement[];
    source?: string | null;
    fallback?: boolean;
    message?: string | null;
    cachedAt?: string | null;
    pagination?: PaginationMeta;
}

// Achievement Types
export interface Achievement {
    id: string;
    title: string;
    description: string;
    icon: string;
    unlocked: boolean;
    unlockedAt?: string;
    [key: string]: any;
}

// Daily Advice Types
export interface DailyAdvice {
    id: string;
    date: string;
    type: 'training' | 'rest' | 'nutrition' | 'recovery';
    title: string;
    content: string;
    tips?: string[];
    [key: string]: any;
}

export interface CreateSessionPayload {
    planned_at: string;
    status?: import('@backend-types/api/shared').TrainingSessionStatusValue;
    notes?: string;
}

export interface UpdateSessionPayload {
    planned_at?: string;
    status?: import('@backend-types/api/shared').TrainingSessionStatusValue;
    notes?: string;
}

export interface UserProgramRequest {
    disciplineId: string;
    programId: string;
    initialLevels?: UserProgramLevels;
    currentLevels?: UserProgramLevels;
}

export interface UserProgramUpdateRequest {
    disciplineId?: string;
    programId?: string;
    initialLevels?: UserProgramLevels;
    currentLevels?: UserProgramLevels;
}

export interface CreateAssistantNoteResponse {
    note: {
        id: string;
        title?: string;
        content: string;
        created_at: string;
        tags?: string[];
    };
}

// Analytics Visualization Types
export type VisualizationType = 'sessions_trend' | 'discipline_breakdown' | 'program_completion';

export interface AnalyticsFilters {
    profileId?: string;
    programId?: string;
    disciplineId?: string;
    status?: import('@backend-types/api/shared').TrainingSessionStatusValue;
    dateFrom?: string;
    dateTo?: string;
}

export interface VisualizationResponse {
    type: VisualizationType;
    data: any; // Chart.js data structure
    options?: any; // Chart.js options
    generatedAt: string;
}
