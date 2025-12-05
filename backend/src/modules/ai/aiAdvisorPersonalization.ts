import type { SafePrismaClient } from '../../types/prisma.js';
import type { AiAdvisorPersonalization } from '../../types/aiAdvisor.js';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const sanitizeString = (value: unknown, limit: number): string | undefined => {
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return undefined;
    }
    if (trimmed.length <= limit) {
        return trimmed;
    }
    return trimmed.slice(0, limit);
};

const sanitizeList = (value: unknown, limit: number, maxItems: number): string[] => {
    if (!Array.isArray(value)) {
        return [];
    }
    const result: string[] = [];
    for (const entry of value) {
        const normalized = sanitizeString(entry, limit);
        if (normalized) {
            result.push(normalized);
        }
        if (result.length >= maxItems) {
            break;
        }
    }
    return result;
};

const extractGoals = (raw: unknown): string[] => {
    if (Array.isArray(raw)) {
        return sanitizeList(raw, 120, 6);
    }
    if (raw && typeof raw === 'object') {
        const entries: string[] = [];
        const record = raw as Record<string, unknown>;
        const candidates = [
            record.description,
            record.primary,
            record.secondary,
            record.focus,
        ];
        for (const candidate of candidates) {
            const normalized = sanitizeString(candidate, 160);
            if (normalized) {
                entries.push(normalized);
            }
        }
        const listCandidate = Array.isArray(record.items) ? record.items : undefined;
        if (listCandidate) {
            entries.push(...sanitizeList(listCandidate, 160, 6));
        }
        return entries.slice(0, 6);
    }
    return [];
};

const toNumber = (value: unknown): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    if (value && typeof value === 'object' && typeof (value as any).toNumber === 'function') {
        const parsed = (value as any).toNumber();
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return undefined;
};

const formatTime = (input: Date | null | undefined): string | undefined => {
    if (!input) {
        return undefined;
    }
    const iso = input.toISOString();
    const timeSection = iso.split('T')[1];
    if (!timeSection) {
        return undefined;
    }
    return timeSection.slice(0, 5);
};

export async function loadAiAdvisorPersonalization(
    prisma: SafePrismaClient,
    profileId: string,
): Promise<AiAdvisorPersonalization | null> {
    const profile = await prisma.profile.findUnique({
        where: { id: profileId },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            timezone: true,
            notificationTime: true,
            equipment: true,
            goals: true,
            preferences: true,
        },
    });

    if (!profile) {
        return null;
    }

    const since30d = new Date(Date.now() - THIRTY_DAYS_MS);
    const since7d = new Date(Date.now() - SEVEN_DAYS_MS);

    const [
        plannedSessions,
        completedSessions,
        latestSession,
        latestAchievement,
        totalAchievements,
        recentRpeSamples,
    ] = await Promise.all([
        prisma.trainingSession.count({
            where: { profileId, plannedAt: { gte: since30d } },
        }),
        prisma.trainingSession.count({
            where: { profileId, status: 'done', plannedAt: { gte: since30d } },
        }),
        prisma.trainingSession.findFirst({
            where: { profileId },
            orderBy: { plannedAt: 'desc' },
            select: {
                status: true,
                plannedAt: true,
                discipline: { select: { name: true } },
            },
        }),
        prisma.achievement.findFirst({
            where: { profileId },
            orderBy: { awardedAt: 'desc' },
            select: { title: true, awardedAt: true },
        }),
        prisma.achievement.count({ where: { profileId } }),
        prisma.exerciseProgress.findMany({
            where: { profileId, createdAt: { gte: since7d } },
            orderBy: { createdAt: 'desc' },
            select: { rpe: true },
            take: 5,
        }),
    ]);

    const completionRate = plannedSessions > 0 ? Math.round((completedSessions / plannedSessions) * 100) : 0;

    const preferences = (profile.preferences ?? {}) as Record<string, unknown>;

    const readinessSamples = recentRpeSamples
        .map((entry) => toNumber(entry.rpe))
        .filter((value): value is number => typeof value === 'number' && value > 0);
    const avgRpe =
        readinessSamples.length > 0
            ? Math.round((readinessSamples.reduce((acc, value) => acc + value, 0) / readinessSamples.length) * 10) / 10
            : undefined;

    const payload: AiAdvisorPersonalization = {
        profile: {
            firstName: sanitizeString(profile.firstName, 64),
            lastName: sanitizeString(profile.lastName, 64),
            timezone: sanitizeString(profile.timezone, 64),
            notificationTime: formatTime(profile.notificationTime),
            preferredLanguage: sanitizeString(preferences.language, 32),
        },
        goals: extractGoals(profile.goals),
        equipment: sanitizeList(profile.equipment, 48, 12),
        focusAreas: sanitizeList(preferences.focusAreas, 64, 6),
        injuries: sanitizeList(preferences.injuries, 64, 6),
        tone: sanitizeString(preferences.aiTone ?? preferences.communicationStyle, 48),
        stats: {
            completionRate30d: completionRate,
            plannedSessions30d: plannedSessions,
            completedSessions30d: completedSessions,
            latestSessionStatus: latestSession?.status ?? undefined,
            latestSessionPlannedAt: latestSession?.plannedAt?.toISOString(),
            latestSessionDiscipline: latestSession?.discipline?.name,
        },
        achievements: {
            latestTitle: sanitizeString(latestAchievement?.title, 160),
            latestAwardedAt: latestAchievement?.awardedAt?.toISOString(),
            totalCount: totalAchievements,
        },
        readiness: avgRpe ? { avgRpe7d: avgRpe } : undefined,
    };

    return payload;
}
