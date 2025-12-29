export interface AiAdvisorContextEntry {
    exerciseKey: string;
    currentLevel: string;
    goals: string[];
    performance: Record<string, string>;
    advice: string;
    nextSteps: string[];
    tips: string[];
    createdAt: string;
}

export interface AiAdvisorContextState {
    entries: AiAdvisorContextEntry[];
}

export interface AiAdvisorPersonalizationProfile {
    firstName?: string;
    lastName?: string;
    timezone?: string;
    notificationTime?: string;
    preferredLanguage?: string;
}

export interface AiAdvisorPersonalizationStats {
    completionRate30d?: number;
    plannedSessions30d?: number;
    completedSessions30d?: number;
    latestSessionStatus?: string;
    latestSessionDiscipline?: string;
    latestSessionPlannedAt?: string;
}

export interface AiAdvisorPersonalizationAchievements {
    latestTitle?: string;
    latestAwardedAt?: string;
    totalCount?: number;
}

export interface AiAdvisorPersonalizationReadiness {
    avgRpe7d?: number;
}

export interface AiAdvisorPersonalization {
    profile?: AiAdvisorPersonalizationProfile;
    goals?: string[];
    equipment?: string[];
    focusAreas?: string[];
    injuries?: string[];
    tone?: string;
    stats?: AiAdvisorPersonalizationStats;
    achievements?: AiAdvisorPersonalizationAchievements;
    readiness?: AiAdvisorPersonalizationReadiness;
    aiSummary?: {
        totalWorkouts: number;
        currentStreak: number;
        bestStreak: number;
        weeklyAverage: number;
        monthlyWorkouts: number;
        trainingDays: string[];
        level: 'beginner' | 'intermediate' | 'advanced';
        notes: string[];
        patterns: {
            bestDay: string;
            avgSessionMinutes: number;
            preferredTime: string;
        };
    };
}
