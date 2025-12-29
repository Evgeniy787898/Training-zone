/**
 * AI Summary Service
 * Aggregates user data into a compact context for the AI trainer
 * 
 * Phase 3 of AI Trainer Enhancement
 */

import type { PrismaClient } from '@prisma/client';

// =============================================================================
// Types
// =============================================================================

export interface AISummary {
    // Profile
    profile: {
        name: string;
        goals: string[];
        trainingDays: string[];
        level: 'beginner' | 'intermediate' | 'advanced';
        preferences: string[];
    };

    // Stats
    stats: {
        totalWorkouts: number;
        currentStreak: number;
        bestStreak: number;
        lastWorkoutDate: string;
        weeklyAverage: number;
        monthlyWorkouts: number;
    };

    // Progress (top 6 exercises)
    progress: Record<string, {
        level: number;
        maxLevel: number;
        lastResult: string;
        trend: '↑' | '→' | '↓';
        lastDone: string;
    }>;

    // Recent notes (last 5)
    notes: string[];

    // Behavior patterns
    patterns: {
        bestDay: string;
        worstDay: string;
        avgSessionMinutes: number;
        preferredTime: 'утро' | 'день' | 'вечер';
        skipReasons: string[];
    };

    // Recent AI interaction topics
    recentTopics: string[];

    // Metadata
    updatedAt: string;
    version: number;
}

// =============================================================================
// Service
// =============================================================================

export class AISummaryService {
    constructor(private prisma: PrismaClient) { }

    /**
     * Build and update the AI summary for a user
     */
    async updateSummary(profileId: string): Promise<AISummary> {
        const [profile, sessions, userProgram, notes] = await Promise.all([
            this.prisma.profile.findUnique({
                where: { id: profileId },
                select: {
                    firstName: true,
                    lastName: true,
                    aiSummary: true,
                }
            }),
            this.prisma.trainingSession.findMany({
                where: { profileId },
                orderBy: { plannedAt: 'desc' },
                take: 100,
                select: {
                    id: true,
                    plannedAt: true,
                    status: true,
                }
            }),
            this.prisma.userTrainingProgram.findFirst({
                where: { profileId, isActive: true },
                select: {
                    currentLevels: true,
                }
            }),
            this.prisma.assistantNote.findMany({
                where: { profileId },
                orderBy: { createdAt: 'desc' },
                take: 10,
                select: {
                    content: true,
                    tags: true,
                }
            }),
        ]);

        const completedSessions = sessions.filter((s: { status: string }) => s.status === 'done');

        const summary: AISummary = {
            profile: {
                name: [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || 'Атлет',
                goals: this.extractGoals(notes),
                trainingDays: this.calculateTrainingDays(completedSessions),
                level: this.determineLevel(completedSessions.length),
                preferences: this.extractPreferences(notes),
            },
            stats: {
                totalWorkouts: completedSessions.length,
                currentStreak: 0,
                bestStreak: 0,
                lastWorkoutDate: completedSessions[0]?.plannedAt?.toISOString() || '',
                weeklyAverage: this.calculateWeeklyAvg(completedSessions),
                monthlyWorkouts: this.countMonthlyWorkouts(completedSessions),
            },
            progress: this.buildProgressMap(userProgram?.currentLevels),
            notes: notes.map((n: { content: string }) => n.content).slice(0, 5),
            patterns: this.analyzePatterns(completedSessions),
            recentTopics: [],
            updatedAt: new Date().toISOString(),
            version: 2,
        };

        // Save to profile
        await this.prisma.profile.update({
            where: { id: profileId },
            data: { aiSummary: summary as any },
        });

        return summary;
    }

    /**
     * Get cached summary or build fresh one if stale (>1 hour)
     */
    async getSummary(profileId: string): Promise<AISummary | null> {
        const profile = await this.prisma.profile.findUnique({
            where: { id: profileId },
            select: { aiSummary: true },
        });

        const cached = profile?.aiSummary as unknown as AISummary | null;

        if (cached?.updatedAt) {
            const age = Date.now() - new Date(cached.updatedAt).getTime();
            const ONE_HOUR = 60 * 60 * 1000;

            if (age < ONE_HOUR) {
                return cached;
            }
        }

        // Stale or missing - rebuild
        return this.updateSummary(profileId);
    }

    // =============================================================================
    // Private Helpers
    // =============================================================================

    private extractGoals(notes: { content: string; tags: string[] | null }[]): string[] {
        const goalKeywords = ['цель', 'хочу', 'планирую', 'набрать', 'похудеть', 'сила', 'выносливость'];
        const goals: string[] = [];

        for (const note of notes) {
            const tags = note.tags || [];
            if (tags.some(t => t.toLowerCase().includes('цель'))) {
                goals.push(note.content.slice(0, 50));
            }

            const lc = note.content.toLowerCase();
            for (const kw of goalKeywords) {
                if (lc.includes(kw) && !goals.includes(note.content.slice(0, 50))) {
                    goals.push(note.content.slice(0, 50));
                    break;
                }
            }
        }

        return goals.slice(0, 3);
    }

    private extractPreferences(notes: { content: string }[]): string[] {
        const prefKeywords = ['без', 'не люблю', 'предпочитаю', 'дома', 'зал', 'оборудование'];
        const prefs: string[] = [];

        for (const note of notes) {
            const lc = note.content.toLowerCase();
            for (const kw of prefKeywords) {
                if (lc.includes(kw)) {
                    prefs.push(note.content.slice(0, 40));
                    break;
                }
            }
        }

        return prefs.slice(0, 3);
    }

    private calculateTrainingDays(sessions: { plannedAt: Date; status: string }[]): string[] {
        const dayNames = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
        const dayCounts: Record<number, number> = {};

        for (const s of sessions) {
            const day = s.plannedAt.getDay();
            dayCounts[day] = (dayCounts[day] || 0) + 1;
        }

        // Return top 3 training days
        return Object.entries(dayCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([day]) => dayNames[parseInt(day)]);
    }

    private determineLevel(totalWorkouts: number): 'beginner' | 'intermediate' | 'advanced' {
        if (totalWorkouts < 20) return 'beginner';
        if (totalWorkouts < 100) return 'intermediate';
        return 'advanced';
    }

    private calculateWeeklyAvg(sessions: { plannedAt: Date }[]): number {
        if (sessions.length === 0) return 0;
        if (sessions.length < 2) return sessions.length;

        const oldest = sessions[sessions.length - 1].plannedAt;
        const newest = sessions[0].plannedAt;
        const weeks = Math.max(1, (newest.getTime() - oldest.getTime()) / (7 * 24 * 60 * 60 * 1000));

        return Math.round((sessions.length / weeks) * 10) / 10;
    }

    private countMonthlyWorkouts(sessions: { plannedAt: Date }[]): number {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        return sessions.filter(s => new Date(s.plannedAt) > oneMonthAgo).length;
    }

    private buildProgressMap(currentLevels: any): AISummary['progress'] {
        const progress: AISummary['progress'] = {};

        if (!currentLevels || typeof currentLevels !== 'object') {
            return progress;
        }

        // Take top 6 exercises
        const entries = Object.entries(currentLevels).slice(0, 6);

        for (const [key, value] of entries) {
            const level = typeof value === 'number' ? value : (value as any)?.level || 1;
            progress[key] = {
                level,
                maxLevel: 10,
                lastResult: '',
                trend: '→',
                lastDone: '',
            };
        }

        return progress;
    }

    private analyzePatterns(sessions: { plannedAt: Date; status: string }[]): AISummary['patterns'] {
        const dayNames = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
        const dayCounts: Record<number, number> = {};
        const hourCounts: Record<string, number> = { 'утро': 0, 'день': 0, 'вечер': 0 };
        let sessionsCount = 0;

        for (const s of sessions) {
            const day = s.plannedAt.getDay();
            dayCounts[day] = (dayCounts[day] || 0) + 1;

            const hour = s.plannedAt.getHours();
            if (hour < 12) hourCounts['утро']++;
            else if (hour < 17) hourCounts['день']++;
            else hourCounts['вечер']++;

            sessionsCount++;
        }

        const sortedDays = Object.entries(dayCounts).sort((a, b) => b[1] - a[1]);
        const bestDayIdx = sortedDays[0]?.[0];
        const worstDayIdx = sortedDays[sortedDays.length - 1]?.[0];

        const preferredTime = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'день';

        return {
            bestDay: bestDayIdx ? dayNames[parseInt(bestDayIdx)] : 'н/д',
            worstDay: worstDayIdx ? dayNames[parseInt(worstDayIdx)] : 'н/д',
            avgSessionMinutes: 30, // Default since we don't track duration yet
            preferredTime: preferredTime as 'утро' | 'день' | 'вечер',
            skipReasons: [],
        };
    }
}
